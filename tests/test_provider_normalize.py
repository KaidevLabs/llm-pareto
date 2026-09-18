"""Tests for the provider-layer parse + normalize functions
(update.parse_provider_page / parse_endpoints_api / merge_duplicate_endpoints
/ join_provider_layers / round_uptime) — plan 022, step 2. Synthetic RSC
fixtures, hand-written, minimal (house discipline)."""

import io
import json
import unittest
from contextlib import redirect_stderr

import update

STATS_KEYS = (
    "p50_latency", "p75_latency", "p90_latency", "p95_latency", "p99_latency",
    "p50_throughput", "p75_throughput", "p90_throughput", "p95_throughput",
    "p99_throughput", "latency_request_count", "throughput_request_count",
    "request_count", "window_minutes",
)


def stats(**over):
    s = {
        "endpoint_id": "uuid-stats",
        "latency_metric": "latency",
        "p50_latency": 400,
        "p75_latency": 500,
        "p90_latency": 600,
        "p95_latency": 700,
        "p99_latency": 900,
        "p50_throughput": 50,
        "p75_throughput": 60,
        "p90_throughput": 70,
        "p95_throughput": 80,
        "p99_throughput": 90,
        "latency_request_count": 100,
        "throughput_request_count": 100,
        "request_count": 120,
        "window_minutes": 30,
    }
    s.update(over)
    return s


def page_ep(provider, slug, info_slug, model="test/model-20260101", **over):
    ep = {
        "id": "uuid-" + provider.lower(),
        "name": f"{provider} | test/model",
        "provider_name": provider,
        "provider_slug": slug,
        "provider_info": {"name": provider, "slug": info_slug},
        "model_variant_permaslug": model,
        "adapter_name": provider + "Adapter",
        "data_policy": ["retainsPrompts"],
        "limit_rpm": 10,
        "limit_rpd": None,
        "provider_region": None,
        "is_hipaa_eligible": False,
        "is_hidden": False,
        "is_deranked": False,
        "is_free": False,
        "created_at": "2026-01-01T00:00:00.000Z",
        "deprecation_date": None,
        "supports_reasoning": True,
        "pricing_version_id": "pv-1",
        "context_length": 131072,
        "max_completion_tokens": 8192,
        "quantization": "fp8",
        "status": 0,
        "supported_parameters": ["temperature"],
        "pricing": {"prompt": "0.000003", "completion": "0.000006"},
        "stats": None,
    }
    ep.update(over)
    return ep


def api_ep(provider, tag, model="test/model", **over):
    ep = {
        "provider_name": provider,
        "tag": tag,
        "model_id": model,
        "pricing": {
            "prompt": "0.000001",
            "completion": "0.000002",
            "discount": 0.5,
        },
        "context_length": 128000,
        "max_completion_tokens": 8192,
        "quantization": "fp8",
        "status": 0,
        "uptime_last_1d": 97.37,
        "uptime_last_5m": None,
        "uptime_last_30m": 99,
        "supported_parameters": ["temperature"],
    }
    ep.update(over)
    return ep


def rsc_html(*chunks):
    parts = []
    for chunk in chunks:
        raw = json.dumps(chunk)[1:-1]
        parts.append(f'<script>self.__next_f.push([1,"{raw}"])</script>')
    return "<html>" + "".join(parts) + "</html>"


def page_html(eps):
    payload = (
        '{"queryKey":["model-page","endpointStats",'
        '{"permaslug":"test/model","variant":"standard"}],"queryHash":"h"},'
        '{"dehydratedAt":1789627742828,"state":{"data":'
        + json.dumps(eps)
        + "}}"
    )
    return rsc_html(payload)


def assert_dies(test, fn):
    with redirect_stderr(io.StringIO()):
        with test.assertRaises(SystemExit) as ctx:
            fn()
    test.assertEqual(ctx.exception.code, 1)


class TestParseProviderPage(unittest.TestCase):
    def test_extracts_endpoint_stats_array(self):
        eps = [
            page_ep("StreamLake", "streamlake/fp8", "streamlake", stats=stats()),
            page_ep("Baidu", "baidu/fp8", "baidu"),
        ]
        self.assertEqual(update.parse_provider_page(page_html(eps)), eps)

    def test_dies_without_rsc_chunks(self):
        assert_dies(self, lambda: update.parse_provider_page("<html>nope</html>"))

    def test_raises_page_format_error_when_anchor_missing(self):
        # the anchor-missing signal is an exception the fetch seam can catch
        # and retry on (transient partial SSR), not a die — see
        # fetch_parse_model_page (2026-09-18).
        with self.assertRaises(update._PageFormatError):
            update.parse_provider_page(rsc_html('2:{"other":[1]}'))

    def test_raises_page_format_error_when_dehydrated_missing(self):
        html = rsc_html(
            '{"queryKey":["model-page","endpointStats",'
            '{"permaslug":"test/model"}],"queryHash":"h"}'
        )
        with self.assertRaises(update._PageFormatError):
            update.parse_provider_page(html)

    def test_dies_when_array_not_json(self):
        html = rsc_html(
            '{"queryKey":["model-page","endpointStats",'
            '{"permaslug":"test/model"}],"queryHash":"h"},'
            '{"dehydratedAt":123,"state":{"data":[oops]}}'
        )
        assert_dies(self, lambda: update.parse_provider_page(html))


class TestParseEndpointsApi(unittest.TestCase):
    def test_returns_endpoints_list(self):
        raw = json.dumps(
            {"data": {"id": "test/model", "endpoints": [api_ep("Baidu", "baidu/fp8")]}}
        )
        self.assertEqual(
            update.parse_endpoints_api(raw), [api_ep("Baidu", "baidu/fp8")]
        )

    def test_dies_on_bad_json(self):
        assert_dies(self, lambda: update.parse_endpoints_api("not json"))

    def test_dies_when_endpoints_missing(self):
        assert_dies(
            self, lambda: update.parse_endpoints_api(json.dumps({"data": {}}))
        )

    def test_dies_on_non_object_endpoint(self):
        raw = json.dumps({"data": {"endpoints": [1]}})
        assert_dies(self, lambda: update.parse_endpoints_api(raw))


class TestMergeDuplicateEndpoints(unittest.TestCase):
    def test_no_duplicates_passthrough(self):
        eps = [
            api_ep("Baidu", "baidu/fp8"),
            api_ep("Alibaba", "alibaba"),
        ]
        merged, n = update.merge_duplicate_endpoints(eps)
        self.assertEqual(merged, eps)
        self.assertEqual(n, 0)

    def test_merges_exact_duplicates_keeping_more_populated_uptime(self):
        sparse = api_ep("BaseTen", "baseten/fp4", uptime_last_1d=None)
        full = api_ep("BaseTen", "baseten/fp4", uptime_last_1d=97.3)
        merged, n = update.merge_duplicate_endpoints([sparse, full])
        self.assertEqual(merged, [full])
        self.assertEqual(n, 1)

    def test_same_provider_and_tag_different_model_id_stay_distinct(self):
        eps = [
            api_ep("DeepSeek", "deepseek", model="test/model-20260813"),
            api_ep("DeepSeek", "deepseek", model="test/model-20260923"),
        ]
        merged, n = update.merge_duplicate_endpoints(eps)
        self.assertEqual(merged, eps)
        self.assertEqual(n, 0)


class TestBuildProviderLayer(unittest.TestCase):
    def _raw(self, eps):
        return json.dumps({"data": {"endpoints": eps}})

    def test_zero_throughput_stats_dropped_and_counted(self):
        # a 0 t/s percentile is upstream junk (DeepInfra llama-3.1-70b,
        # 2026-09-18): the endpoint's stats are dropped, the entry stays —
        # the run does NOT die (validator check removed same day)
        raw = self._raw([api_ep("DeepInfra", "deepinfra")])
        page = [
            page_ep("DeepInfra", "deepinfra", "deepinfra",
                    stats=stats(p50_throughput=0))
        ]
        layer, rep = update.build_provider_layer([("t/m", raw, "", page)])
        self.assertIsNone(layer["t/m"][0]["stats"])
        self.assertEqual(rep["stats_dropped"], 1)
        self.assertEqual(rep["entries_with_stats"], 0)

    def test_healthy_stats_survive_build(self):
        raw = self._raw([api_ep("DeepInfra", "deepinfra")])
        page = [
            page_ep("DeepInfra", "deepinfra", "deepinfra", stats=stats())
        ]
        layer, rep = update.build_provider_layer([("t/m", raw, "", page)])
        self.assertIsNotNone(layer["t/m"][0]["stats"])
        self.assertEqual(rep["stats_dropped"], 0)
        self.assertEqual(rep["entries_with_stats"], 1)


class TestJoinProviderLayers(unittest.TestCase):
    def test_joins_via_info_slug_when_provider_slug_differs(self):
        api = [api_ep("StreamLake", "streamlake")]
        page = [
            page_ep("StreamLake", "streamlake/fp8", "streamlake", stats=stats())
        ]
        entries, unjoined, n = update.join_provider_layers(api, page)
        self.assertEqual(n, 1)
        self.assertEqual(unjoined, [])
        self.assertEqual(
            entries[0],
            {
                "provider": "StreamLake",
                "tag": "streamlake",
                "model_id": "test/model",
                "pricing": {
                    "prompt": "0.000001",
                    "completion": "0.000002",
                    "discount": 0.5,
                },
                "context_length": 128000,
                "max_completion_tokens": 8192,
                "quantization": "fp8",
                "status": 0,
                "uptime_last_1d": 97.4,
                "supported_parameters": ["temperature"],
                "adapter": "StreamLakeAdapter",
                "data_policy": ["retainsPrompts"],
                "limit_rpm": 10,
                "limit_rpd": None,
                "provider_info": {"name": "StreamLake", "slug": "streamlake"},
                "provider_region": None,
                "is_hipaa_eligible": False,
                "is_hidden": False,
                "is_deranked": False,
                "is_free": False,
                "created_at": "2026-01-01T00:00:00.000Z",
                "deprecation_date": None,
                "supports_reasoning": True,
                "pricing_version_id": "pv-1",
                "stats": {
                    "p50_latency": 400,
                    "p75_latency": 500,
                    "p90_latency": 600,
                    "p95_latency": 700,
                    "p99_latency": 900,
                    "p50_throughput": 50,
                    "p75_throughput": 60,
                    "p90_throughput": 70,
                    "p95_throughput": 80,
                    "p99_throughput": 90,
                    "latency_request_count": 100,
                    "throughput_request_count": 100,
                    "request_count": 120,
                    "window_minutes": 30,
                },
            },
        )

    def test_exact_provider_slug_match_wins(self):
        api = [
            api_ep("Baidu", "baidu"),
            api_ep("Baidu", "baidu/fp8"),
        ]
        page = [
            page_ep("Baidu", "baidu/fp8", "baidu", stats=stats(request_count=7))
        ]
        entries, unjoined, n = update.join_provider_layers(api, page)
        self.assertEqual(n, 1)
        self.assertEqual(unjoined, [])
        self.assertIsNone(entries[0]["stats"])
        self.assertEqual(entries[1]["stats"]["request_count"], 7)

    def test_unjoined_page_endpoint_kept_stats_only(self):
        api = [api_ep("StreamLake", "streamlake")]
        page = [
            page_ep("Baidu", "baidu/fp8", "baidu", stats=stats(request_count=9))
        ]
        entries, unjoined, n = update.join_provider_layers(api, page)
        self.assertEqual(n, 0)
        self.assertIsNone(entries[0]["stats"])
        self.assertEqual(len(unjoined), 1)
        self.assertEqual(unjoined[0]["provider"], "Baidu")
        self.assertEqual(unjoined[0]["tag"], "baidu/fp8")
        self.assertEqual(unjoined[0]["model_id"], "test/model-20260101")
        self.assertEqual(unjoined[0]["stats"]["request_count"], 9)
        self.assertIsNone(unjoined[0]["uptime_last_1d"])

    def test_ambiguous_match_stays_unjoined(self):
        api = [
            api_ep("DeepSeek", "deepseek", model="test/model-20260813"),
            api_ep("DeepSeek", "deepseek", model="test/model-20260923"),
        ]
        page = [page_ep("DeepSeek", "deepseek", "deepseek", stats=stats())]
        entries, unjoined, n = update.join_provider_layers(api, page)
        self.assertEqual(n, 0)
        self.assertEqual(len(unjoined), 1)
        self.assertIsNone(entries[0]["stats"])
        self.assertIsNone(entries[1]["stats"])

    def test_duplicate_page_rows_join_highest_request_count(self):
        api = [api_ep("BaseTen", "baseten/fp4")]
        page = [
            page_ep(
                "BaseTen",
                "baseten/fp4",
                "baseten",
                stats=stats(request_count=2248, p50_throughput=95),
            ),
            page_ep(
                "BaseTen",
                "baseten/fp4",
                "baseten",
                stats=stats(request_count=2505, p50_throughput=40),
            ),
        ]
        entries, unjoined, n = update.join_provider_layers(api, page)
        self.assertEqual(n, 2)
        self.assertEqual(unjoined, [])
        self.assertEqual(entries[0]["stats"]["request_count"], 2505)
        self.assertEqual(entries[0]["stats"]["p50_throughput"], 40)

    def test_stats_are_whitelisted_and_as_received(self):
        api = [api_ep("StreamLake", "streamlake")]
        page = [
            page_ep(
                "StreamLake",
                "streamlake/fp8",
                "streamlake",
                stats=stats(extra_key="dropped"),
            )
        ]
        entries, _, _ = update.join_provider_layers(api, page)
        self.assertEqual(set(entries[0]["stats"]), set(STATS_KEYS))
        self.assertNotIn("endpoint_id", entries[0]["stats"])


class TestRoundUptime(unittest.TestCase):
    def test_rounds_to_tenth_percent(self):
        self.assertEqual(update.round_uptime(97.37), 97.4)

    def test_int_and_none_pass_through(self):
        self.assertEqual(update.round_uptime(100), 100)
        self.assertIsNone(update.round_uptime(None))


if __name__ == "__main__":
    unittest.main()
