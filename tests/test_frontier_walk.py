"""Characterization tests for the frontier_walk analysis module
(plan 044, step 01): the frontier walk, the convex-hull supported
set, gate+direction champion selection, the rc>=30 speed rule and the
snapshot readers. Expected values are pinned from the module's
actual output on hand-written synthetic fixtures."""

import json
import tempfile
import unittest
from pathlib import Path

from tests import frontier_walk as fw


def row(or_id, price, elo, lo=None, hi=None, toks=None):
    lo = elo - 5.0 if lo is None and elo is not None else lo
    hi = elo + 5.0 if hi is None and elo is not None else hi
    return {
        "id": or_id,
        "price": price,
        "elo": elo,
        "elo_lo": lo,
        "elo_hi": hi,
        "speed": toks,
    }


# A synthetic frontier: five non-dominated points whose middle is a
# concave dip (below the chord in log-price space).
FRONT = [
    row("a/cheap", 1.0, 1000.0),
    row("b/dip", 4.0, 1100.0),
    row("c/mid", 16.0, 1300.0),
    row("d/high", 64.0, 1310.0),
    row("e/top", 256.0, 1500.0),
]


class TestFrontier(unittest.TestCase):
    def test_non_dominated_points_survive_price_ascending(self):
        front = fw.frontier(FRONT)
        self.assertEqual([p["id"] for p in front], [p["id"] for p in FRONT])

    def test_dominated_point_is_dropped(self):
        # (2, 1000) is dominated by a/cheap (1, 1000): same elo, lower price.
        pts = FRONT + [row("x/dominated", 2.0, 1000.0)]
        front = fw.frontier(pts)
        self.assertNotIn("x/dominated", [p["id"] for p in front])

    def test_zero_and_none_priced_rows_are_dropped(self):
        pts = FRONT + [row("z/free", 0.0, 1600.0), row("n/null", None, 1600.0)]
        front = fw.frontier(pts)
        self.assertEqual(len(front), 5)

    def test_zero_and_none_elo_rows_are_dropped(self):
        pts = FRONT + [row("z/zero-elo", 8.0, 0.0), row("n/null-elo", 8.0, None)]
        front = fw.frontier(pts)
        self.assertEqual(len(front), 5)


class TestSupported(unittest.TestCase):
    def test_concave_dips_below_the_chord_are_unsupported(self):
        _, uns = fw.supported(fw.frontier(FRONT))
        self.assertEqual([p["id"] for p in uns], ["b/dip", "d/high"])

    def test_hull_vertices_are_supported(self):
        sup, _ = fw.supported(fw.frontier(FRONT))
        self.assertEqual(
            [p["id"] for p in sup], ["a/cheap", "c/mid", "e/top"]
        )

    def test_single_point_frontier_is_supported(self):
        sup, uns = fw.supported(fw.frontier(FRONT[:1]))
        self.assertEqual([p["id"] for p in sup], ["a/cheap"])
        self.assertEqual(uns, [])


class TestWalk(unittest.TestCase):
    def test_steps_are_consecutive_pairs_with_price_multiple_and_elo_gain(self):
        steps = fw.walk(fw.frontier(FRONT))
        self.assertEqual(len(steps), 4)
        self.assertEqual(steps[0]["to"], "b/dip")
        self.assertAlmostEqual(steps[0]["price_multiple"], 4.0)
        self.assertAlmostEqual(steps[0]["elo_gain"], 100.0)

    def test_inside_ci_true_when_the_elo_intervals_overlap(self):
        pts = [row("a", 1.0, 1000.0, 990.0, 1010.0), row("b", 2.0, 1005.0, 1000.0, 1010.0)]
        step = fw.walk(pts)[0]
        self.assertTrue(step["inside_ci"])

    def test_inside_ci_false_when_the_intervals_are_disjoint(self):
        pts = [row("a", 1.0, 1000.0, 990.0, 1010.0), row("b", 2.0, 1100.0, 1090.0, 1110.0)]
        step = fw.walk(pts)[0]
        self.assertFalse(step["inside_ci"])

    def test_toks_delta_is_the_speed_difference(self):
        pts = [
            row("a", 1.0, 1000.0, 990.0, 1010.0, 10.0),
            row("b", 2.0, 1100.0, 1090.0, 1110.0, 30.0),
        ]
        step = fw.walk(pts)[0]
        self.assertAlmostEqual(step["toks_delta"], 20.0)


class TestChampions(unittest.TestCase):
    def test_gate_drops_rows_below_the_elo_floor(self):
        ranked = fw.champions(fw.frontier(FRONT), 1300.0, "min_price")
        self.assertEqual(
            [r["id"] for r in ranked], ["c/mid", "d/high", "e/top"]
        )

    def test_min_price_direction_ranks_cheapest_first(self):
        ranked = fw.champions(fw.frontier(FRONT), 1000.0, "min_price")
        self.assertEqual(ranked[0]["id"], "a/cheap")

    def test_max_speed_direction_ranks_fastest_first(self):
        pts = [
            row("slow", 1.0, 1400.0, 1390.0, 1410.0, 20.0),
            row("fast", 8.0, 1410.0, 1400.0, 1420.0, 90.0),
        ]
        ranked = fw.champions(pts, 1300.0, "max_speed")
        self.assertEqual(ranked[0]["id"], "fast")


class TestSpeedMap(unittest.TestCase):
    def test_median_of_eligible_endpoints(self):
        layer = {
            "a/b": [
                {"stats": {"p50_throughput": 10, "throughput_request_count": 100}},
                {"stats": {"p50_throughput": 30, "throughput_request_count": 200}},
            ]
        }
        self.assertEqual(fw.speed_map(layer), {"a/b": 20.0})

    def test_endpoints_below_the_request_floor_are_excluded(self):
        layer = {
            "a/b": [
                {"stats": {"p50_throughput": 10, "throughput_request_count": 100}},
                {"stats": {"p50_throughput": 999, "throughput_request_count": 10}},
            ]
        }
        self.assertEqual(fw.speed_map(layer), {"a/b": 10.0})

    def test_models_without_eligible_endpoints_are_omitted(self):
        layer = {"a/b": [{"stats": {"p50_throughput": 5, "throughput_request_count": 10}}]}
        self.assertEqual(fw.speed_map(layer), {})


class TestLoad(unittest.TestCase):
    def test_load_returns_canonical_rows_from_temp_files(self):
        with tempfile.TemporaryDirectory() as td:
            combined = Path(td) / "combined.json"
            combined.write_text(
                json.dumps(
                    [
                        {
                            "or_id": "o/m",
                            "price_out_per_m": 2.0,
                            "arena_elo": 1400.0,
                            "arena_elo_lower": 1390.0,
                            "arena_elo_upper": 1410.0,
                        }
                    ]
                )
            )
            rows = fw.load(combined)
            self.assertEqual(rows[0]["id"], "o/m")
            self.assertEqual(rows[0]["price"], 2.0)
            self.assertEqual(rows[0]["elo"], 1400.0)

    def test_snapshot_speed_map_becomes_the_speed_field(self):
        with tempfile.TemporaryDirectory() as td:
            snap = Path(td) / "snap.json"
            snap.write_text(
                json.dumps(
                    {
                        "ts": "2026-10-03T00:00:00Z",
                        "rows": [
                            {
                                "or_id": "o/m",
                                "price_out_per_m": 2.0,
                                "arena_elo": 1400.0,
                                "arena_elo_lower": 1390.0,
                                "arena_elo_upper": 1410.0,
                            }
                        ],
                        "speed": {
                            "o/m": {
                                "p50_throughput": 42.0,
                                "throughput_request_count": 500,
                            }
                        },
                    }
                )
            )
            rows = fw.load(snap)
            self.assertEqual(rows[0]["speed"], 42.0)


if __name__ == "__main__":
    unittest.main()
