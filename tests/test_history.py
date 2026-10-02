"""Characterization tests for the update.py snapshot store (plan 043,
step 01): stamp formatting, speed-map extraction, the append-only index
(ts-deduped, ascending), and the git-history backfill path."""

import json
import tempfile
import unittest
from pathlib import Path

import update


def _rows(n=3):
    return [{"or_id": f"org/{i}", "arena_elo": 1300 + i} for i in range(n)]


def _meta(ts, combined=3, unmatched_arena=1, unmatched_openrouter=2):
    return {
        "fetched_at": ts,
        "sources": {
            "arena": {"url": "https://arena.ai/leaderboard/text", "entries": 10},
            "openrouter": {"url": "https://openrouter.ai/api/v1/models", "models": 20},
        },
        "join": {
            "combined": combined,
            "unmatched_arena": unmatched_arena,
            "unmatched_openrouter": unmatched_openrouter,
        },
        "logos": {"OpenAI": "openai.svg"},
    }


class TestSpeedMap(unittest.TestCase):
    def test_mediates_eligible_endpoints_and_sums_request_count(self):
        layer = {
            "a/b": [
                {"stats": {"p50_throughput": 100, "request_count": 1200}},
                {"stats": {"p50_throughput": 200, "request_count": 300}},
            ],
        }
        self.assertEqual(
            update.speed_map(layer),
            {"a/b": {"p50_throughput": 150.0, "request_count": 1500}},
        )

    def test_single_eligible_endpoint_passes_through(self):
        layer = {
            "a/b": [
                {"stats": {"p50_throughput": 81, "request_count": 1200}},
            ],
        }
        self.assertEqual(
            update.speed_map(layer),
            {"a/b": {"p50_throughput": 81, "request_count": 1200}},
        )

    def test_odd_count_median_is_the_middle_value(self):
        layer = {
            "a/b": [
                {"stats": {"p50_throughput": 300, "request_count": 100}},
                {"stats": {"p50_throughput": 100, "request_count": 100}},
                {"stats": {"p50_throughput": 200, "request_count": 100}},
            ],
        }
        self.assertEqual(
            update.speed_map(layer),
            {"a/b": {"p50_throughput": 200, "request_count": 300}},
        )

    def test_omits_models_without_eligible_stats(self):
        layer = {
            "a/b": [{"stats": None}],
            "c/d": [],
        }
        self.assertEqual(update.speed_map(layer), {})

    def test_below_request_count_floor_is_omitted(self):
        layer = {
            "a/b": [{"stats": {"p50_throughput": 50, "request_count": 29}}],
        }
        self.assertEqual(update.speed_map(layer), {})

    def test_zero_throughput_is_omitted(self):
        layer = {
            "a/b": [{"stats": {"p50_throughput": 0, "request_count": 500}}],
        }
        self.assertEqual(update.speed_map(layer), {})

    def test_eligible_endpoint_mixed_with_statsless_ones(self):
        layer = {
            "a/b": [
                {"stats": None},
                {"stats": {"p50_throughput": 81, "request_count": 1200}},
                {"stats": {"p50_throughput": 0, "request_count": 500}},
            ],
        }
        self.assertEqual(
            update.speed_map(layer),
            {"a/b": {"p50_throughput": 81, "request_count": 1200}},
        )


class TestStoreSnapshots(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self._tmp.name)

    def tearDown(self):
        self._tmp.cleanup()

    def test_new_ts_writes_snapshot_and_appends_index_entry(self):
        speed = {"a/b": {"p50_throughput": 81, "request_count": 1200}}
        index, n = update.store_snapshots(
            [(_rows(3), _meta("2026-09-29T06:45:04Z"), speed, True)], self.dir
        )
        self.assertEqual(n, 1)
        self.assertEqual(
            index,
            [
                {
                    "ts": "2026-09-29T06:45:04Z",
                    "file": "20260929T064504Z.json",
                    "combined": 3,
                    "unmatched_arena": 1,
                    "unmatched_openrouter": 2,
                    "speed": True,
                }
            ],
        )
        snap = json.loads((self.dir / "20260929T064504Z.json").read_text())
        self.assertEqual(snap["ts"], "2026-09-29T06:45:04Z")
        self.assertEqual(snap["rows"], _rows(3))
        self.assertEqual(snap["speed"], speed)
        self.assertNotIn("logos", snap["meta"])
        self.assertEqual(snap["meta"]["fetched_at"], "2026-09-29T06:45:04Z")
        self.assertEqual(
            json.loads((self.dir / "index.json").read_text()), index
        )

    def test_indexed_ts_is_kept_not_duplicated(self):
        item = (_rows(3), _meta("2026-09-29T06:45:04Z"), {}, True)
        update.store_snapshots([item], self.dir)
        first = (self.dir / "index.json").read_bytes()
        index, n = update.store_snapshots([item], self.dir)
        self.assertEqual(n, 0)
        self.assertEqual(len(index), 1)
        self.assertEqual((self.dir / "index.json").read_bytes(), first)

    def test_keeps_index_ts_ascending_on_out_of_order_items(self):
        items = [
            (_rows(3), _meta("2026-09-29T06:45:04Z"), {}, True),
            (_rows(2), _meta("2026-09-16T01:13:42Z", combined=2), {}, True),
        ]
        index, n = update.store_snapshots(items, self.dir)
        self.assertEqual(n, 2)
        self.assertEqual(
            [e["ts"] for e in index],
            ["2026-09-16T01:13:42Z", "2026-09-29T06:45:04Z"],
        )

    def test_backfilled_item_flags_speed_false_in_index(self):
        index, n = update.store_snapshots(
            [(_rows(2), _meta("2026-09-16T01:13:42Z", combined=2), {}, False)],
            self.dir,
        )
        self.assertEqual(n, 1)
        self.assertIs(index[0]["speed"], False)
        snap = json.loads((self.dir / "20260916T011342Z.json").read_text())
        self.assertEqual(snap["speed"], {})

    def test_corrupt_index_dies(self):
        (self.dir / "index.json").write_text("{ not a list")
        with self.assertRaises(SystemExit):
            update.store_snapshots(
                [(_rows(2), _meta("2026-09-16T01:13:42Z", combined=2), {}, True)],
                self.dir,
            )

    def test_index_entry_without_ts_dies(self):
        (self.dir / "index.json").write_text('[{"file": "x.json"}]')
        with self.assertRaises(SystemExit):
            update.store_snapshots(
                [(_rows(2), _meta("2026-09-16T01:13:42Z", combined=2), {}, True)],
                self.dir,
            )


class TestBackfillHistory(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self._tmp.name)

    def tearDown(self):
        self._tmp.cleanup()

    def _payloads(self):
        return [
            (
                json.dumps(_rows(2)),
                json.dumps(_meta("2026-09-16T01:13:42Z", combined=2)),
            ),
            (
                json.dumps(_rows(3)),
                json.dumps(_meta("2026-09-29T06:45:04Z", combined=3)),
            ),
        ]

    def test_parses_git_show_texts_into_snapshots(self):
        n_written, n_kept = update.backfill_history(
            self._payloads(), history_dir=self.dir
        )
        self.assertEqual((n_written, n_kept), (2, 0))
        index = json.loads((self.dir / "index.json").read_text())
        self.assertEqual(
            [e["ts"] for e in index],
            ["2026-09-16T01:13:42Z", "2026-09-29T06:45:04Z"],
        )
        self.assertEqual(index[0]["file"], "20260916T011342Z.json")
        self.assertTrue(all(e["speed"] is False for e in index))
        self.assertEqual(index[0]["combined"], 2)
        self.assertEqual(index[1]["combined"], 3)
        snap = json.loads((self.dir / "20260916T011342Z.json").read_text())
        self.assertEqual(snap["rows"], _rows(2))
        self.assertEqual(snap["speed"], {})
        self.assertNotIn("logos", snap["meta"])

    def test_re_run_is_idempotent(self):
        update.backfill_history(self._payloads(), history_dir=self.dir)
        first = (self.dir / "index.json").read_bytes()
        n_written, n_kept = update.backfill_history(
            self._payloads(), history_dir=self.dir
        )
        self.assertEqual((n_written, n_kept), (0, 2))
        self.assertEqual((self.dir / "index.json").read_bytes(), first)
        index = json.loads(first.decode())
        self.assertEqual(len(index), 2)

    def test_dedups_against_existing_index_entries(self):
        # a live-run entry already indexed by ts is kept, not replaced
        update.store_snapshots(
            [(_rows(3), _meta("2026-09-29T06:45:04Z"), {}, True)], self.dir
        )
        n_written, n_kept = update.backfill_history(
            [
                (
                    json.dumps(_rows(3)),
                    json.dumps(_meta("2026-09-29T06:45:04Z", combined=3)),
                )
            ],
            history_dir=self.dir,
        )
        self.assertEqual((n_written, n_kept), (0, 1))
        index = json.loads((self.dir / "index.json").read_text())
        self.assertEqual(len(index), 1)
        self.assertIs(index[0]["speed"], True)

    def test_bad_combined_blob_dies(self):
        with self.assertRaises(SystemExit):
            update.backfill_history(
                [("not json", json.dumps(_meta("2026-09-16T01:13:42Z")))],
                history_dir=self.dir,
            )

    def test_meta_without_fetched_at_dies(self):
        with self.assertRaises(SystemExit):
            update.backfill_history(
                [("[]", json.dumps({"sources": {}}))], history_dir=self.dir
            )


class TestSnapshotStamp(unittest.TestCase):
    def test_strips_dashes_and_colons(self):
        self.assertEqual(
            update.snapshot_stamp("2026-09-29T06:45:04Z"),
            "20260929T064504Z",
        )

    def test_stamps_are_filename_safe(self):
        stamp = update.snapshot_stamp("2026-01-02T03:04:05Z")
        self.assertEqual(stamp, "20260102T030405Z")
        self.assertNotIn("-", stamp)
        self.assertNotIn(":", stamp)
