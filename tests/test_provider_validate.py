"""Tests for the provider-layer validation, report and write
(update.validate_provider_layer / provider_report_lines / write_endpoints)
— plan 022, step 3."""

import io
import json
import os
import tempfile
import unittest
from contextlib import redirect_stdout

import update


def stats(
    p50_latency=100,
    p75_latency=150,
    p90_latency=200,
    p95_latency=250,
    p99_latency=300,
    p50_throughput=50,
    p75_throughput=60,
    p90_throughput=70,
    p95_throughput=80,
    p99_throughput=90,
):
    return {
        "p50_latency": p50_latency,
        "p75_latency": p75_latency,
        "p90_latency": p90_latency,
        "p95_latency": p95_latency,
        "p99_latency": p99_latency,
        "p50_throughput": p50_throughput,
        "p75_throughput": p75_throughput,
        "p90_throughput": p90_throughput,
        "p95_throughput": p95_throughput,
        "p99_throughput": p99_throughput,
        "latency_request_count": 10,
        "throughput_request_count": 10,
        "request_count": 10,
        "window_minutes": 30,
    }


def entry(price="0.000001", stats=None, provider="P"):
    return {
        "provider": provider,
        "tag": "tag",
        "model_id": "org/model",
        "pricing": {"prompt": price, "completion": price},
        "stats": stats,
    }


def row(or_id, api=2, page=2, joined=2, unjoined=0, merged=0, entries=2,
        with_stats=2):
    return {
        "or_id": or_id,
        "api_endpoints": api,
        "page_endpoints": page,
        "joined": joined,
        "page_unjoined": unjoined,
        "duplicates_merged": merged,
        "entries": entries,
        "entries_with_stats": with_stats,
    }


class TestValidateProviderLayer(unittest.TestCase):
    def test_zero_api_endpoints_dies(self):
        detail = [
            row("a/b", api=0, page=0, joined=0, entries=0, with_stats=0),
            row("c/d"),
        ]
        layer = {"a/b": [], "c/d": [entry(stats=stats())]}
        with self.assertRaises(SystemExit) as ctx:
            update.validate_provider_layer(layer, detail)
        self.assertEqual(ctx.exception.code, 1)

    def test_below_half_models_with_stats_dies(self):
        detail = [
            row("a/b", with_stats=1),
            row("c/d", with_stats=0, entries=2),
            row("e/f", with_stats=0, entries=2),
        ]
        layer = {
            "a/b": [entry(stats=stats())],
            "c/d": [entry()],
            "e/f": [entry()],
        }
        with self.assertRaises(SystemExit):
            update.validate_provider_layer(layer, detail)

    def test_half_models_with_stats_passes(self):
        detail = [
            row("a/b", with_stats=1, entries=1),
            row("c/d", with_stats=0, entries=1),
        ]
        layer = {"a/b": [entry(stats=stats())], "c/d": [entry()]}
        update.validate_provider_layer(layer, detail)

    def test_below_80_percent_models_with_stats_warns(self):
        detail = [
            row("a/b", with_stats=1, entries=1),
            row("c/d", with_stats=1, entries=1),
            row("e/f", with_stats=1, entries=1),
            row("g/h", with_stats=0, entries=1),
            row("i/j", with_stats=0, entries=1),
        ]
        layer = {
            "a/b": [entry(stats=stats())],
            "c/d": [entry(stats=stats())],
            "e/f": [entry(stats=stats())],
            "g/h": [entry()],
            "i/j": [entry()],
        }
        buf = io.StringIO()
        with redirect_stdout(buf):
            update.validate_provider_layer(layer, detail)
        self.assertIn("provider warn", buf.getvalue())
        self.assertIn("3/5", buf.getvalue())

    def test_join_hit_rate_below_90_percent_dies(self):
        detail = [
            row("a/b", page=10, joined=8, unjoined=2, entries=10,
                with_stats=10)
        ]
        layer = {"a/b": [entry(stats=stats())] * 10}
        with self.assertRaises(SystemExit):
            update.validate_provider_layer(layer, detail)

    def test_join_hit_rate_at_90_percent_passes(self):
        detail = [
            row("a/b", page=10, joined=9, unjoined=1, entries=10,
                with_stats=10)
        ]
        layer = {"a/b": [entry(stats=stats())] * 10}
        update.validate_provider_layer(layer, detail)

    def test_non_monotonic_latency_percentiles_die(self):
        bad = stats(p50_latency=200, p75_latency=100)
        detail = [row("a/b", api=1, page=1, joined=1, entries=1, with_stats=1)]
        layer = {"a/b": [entry(stats=bad)]}
        with self.assertRaises(SystemExit):
            update.validate_provider_layer(layer, detail)

    def test_zero_throughput_percentile_passes(self):
        # relocated 2026-09-18: a zero t/s percentile is upstream junk on a
        # single endpoint — build_provider_layer now drops that endpoint's
        # stats (and counts it) instead of the validator dying the run
        bad = stats(p50_throughput=0)
        detail = [row("a/b", api=1, page=1, joined=1, entries=1, with_stats=1)]
        layer = {"a/b": [entry(stats=bad)]}
        update.validate_provider_layer(layer, detail)

    def test_prompt_price_not_positive_dies(self):
        detail = [row("a/b", api=1, page=1, joined=1, entries=1, with_stats=1)]
        layer = {"a/b": [entry(price="0", stats=stats())]}
        with self.assertRaises(SystemExit):
            update.validate_provider_layer(layer, detail)

    def test_healthy_layer_passes(self):
        detail = [row("a/b"), row("c/d")]
        layer = {
            "a/b": [entry(stats=stats())],
            "c/d": [entry(stats=stats())],
        }
        buf = io.StringIO()
        with redirect_stdout(buf):
            update.validate_provider_layer(layer, detail)
        self.assertEqual(buf.getvalue(), "")


class TestProviderReportLines(unittest.TestCase):
    def test_report_lines_pinned(self):
        rep = {
            "models_detail": [
                row("a/b", api=3, page=3, joined=3, entries=3, with_stats=3),
                row("c/d", api=2, page=2, joined=1, unjoined=1, entries=2,
                    with_stats=1),
                row("e/f", api=5, page=5, joined=5, entries=5, with_stats=5),
            ],
            "providers_distinct": 7,
            "entries": 10,
            "entries_with_stats": 9,
            "page_unjoined": 1,
            "duplicates_merged": 0,
            "top_providers": [("Google", 4), ("Azure", 3), ("Baidu", 1)],
            "join_misses": ["c/d: Baidu (baidu/fp8)"],
        }
        self.assertEqual(
            update.provider_report_lines(rep),
            [
                "  endpoints per model: min 2, median 3, max 5 (3 models)",
                "  providers distinct: 7",
                "  stats coverage: 3/3 models (100%), 9/10 endpoints (90%)",
                "  join misses: 1 page endpoints",
                "    c/d: Baidu (baidu/fp8)",
                "  duplicates merged: 0",
                "  top providers by endpoints: Google (4), Azure (3), Baidu (1)",
            ],
        )

    def test_no_join_miss_detail_lines(self):
        rep = {
            "models_detail": [row("a/b")],
            "providers_distinct": 1,
            "entries": 2,
            "entries_with_stats": 2,
            "page_unjoined": 0,
            "duplicates_merged": 1,
            "top_providers": [("P", 2)],
            "join_misses": [],
        }
        self.assertEqual(
            update.provider_report_lines(rep),
            [
                "  endpoints per model: min 2, median 2, max 2 (1 models)",
                "  providers distinct: 1",
                "  stats coverage: 1/1 models (100%), 2/2 endpoints (100%)",
                "  join misses: 0 page endpoints",
                "  duplicates merged: 1",
                "  top providers by endpoints: P (2)",
            ],
        )


class TestWriteEndpoints(unittest.TestCase):
    def _tmp_path(self):
        fd, path = tempfile.mkstemp(suffix=".json")
        os.close(fd)
        os.unlink(path)
        return path

    def test_writes_canonical_sorted_content(self):
        path = self._tmp_path()
        layer = {
            "b/x": [entry(provider="B")],
            "a/y": [entry(provider="A")],
        }
        try:
            self.assertTrue(update.write_endpoints(layer, path))
            with open(path) as f:
                content = f.read()
            expected = (
                json.dumps(
                    {k: layer[k] for k in sorted(layer)},
                    indent=1,
                    ensure_ascii=False,
                )
                + "\n"
            )
            self.assertEqual(content, expected)
            self.assertLess(content.index('"a/y"'), content.index('"b/x"'))
        finally:
            if os.path.exists(path):
                os.unlink(path)

    def test_unchanged_state_skips_write(self):
        path = self._tmp_path()
        layer = {"a/y": [entry(provider="A")]}
        try:
            update.write_endpoints(layer, path)
            with open(path) as f:
                first = f.read()
            self.assertFalse(update.write_endpoints(layer, path))
            with open(path) as f:
                self.assertEqual(f.read(), first)
        finally:
            if os.path.exists(path):
                os.unlink(path)

    def test_changed_state_rewrites(self):
        path = self._tmp_path()
        try:
            update.write_endpoints({"a/y": [entry(provider="A")]}, path)
            self.assertTrue(
                update.write_endpoints({"a/y": [entry(provider="Z")]}, path)
            )
            with open(path) as f:
                self.assertIn('"Z"', f.read())
        finally:
            if os.path.exists(path):
                os.unlink(path)


if __name__ == "__main__":
    unittest.main()
