"""Characterization tests for update.validate: threshold behavior, as-is."""

import io
import unittest
from contextlib import redirect_stderr

import update

ARENA_COUNT_MIN = 50
ARENA_COUNT_MAX = 2000
OR_COUNT_MIN = 100
OR_COUNT_MAX = 5000


def arena_entries(count=50):
    return [
        {
            "rank": i,
            "modelDisplayName": f"model-{i}",
            "rating": 1500,
            "votes": 1000,
        }
        for i in range(1, count + 1)
    ]


def or_models(count=100, unpriced=0):
    return [
        {
            "id": f"org/m-{i}",
            "name": f"M{i}",
            "org": "org",
            "price_in_per_m": None if i < unpriced else 1.0,
            "price_out_per_m": None if i < unpriced else 2.0,
            "vision": False,
            "context_length": 1000,
        }
        for i in range(count)
    ]


COMBINED = [{"or_id": "openai/gpt-5.5"}]


class TestValidate(unittest.TestCase):
    def assert_dies(self, arena, or_models_list, combined, unmatched):
        with redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit) as ctx:
                update.validate(arena, or_models_list, combined, unmatched)
        self.assertEqual(ctx.exception.code, 1)

    def test_valid_inputs_pass(self):
        result = update.validate(arena_entries(), or_models(), COMBINED, [])
        self.assertIsNone(result)

    def test_arena_count_below_min_dies(self):
        self.assert_dies(
            arena_entries(ARENA_COUNT_MIN - 1), or_models(), COMBINED, []
        )

    def test_arena_count_above_max_dies(self):
        self.assert_dies(
            arena_entries(ARENA_COUNT_MAX + 1), or_models(), COMBINED, []
        )

    def test_openrouter_count_below_min_dies(self):
        self.assert_dies(
            arena_entries(), or_models(OR_COUNT_MIN - 1), COMBINED, []
        )

    def test_openrouter_count_above_max_dies(self):
        self.assert_dies(
            arena_entries(), or_models(OR_COUNT_MAX + 1), COMBINED, []
        )

    def test_missing_required_fields_over_5_percent_dies(self):
        entries = arena_entries()
        entries[10]["votes"] = None
        entries[20]["votes"] = None
        entries[30]["votes"] = None
        self.assert_dies(entries, or_models(), COMBINED, [])

    def test_missing_required_fields_under_threshold_passes(self):
        entries = arena_entries()
        entries[10]["votes"] = None
        entries[20]["votes"] = None
        self.assertIsNone(
            update.validate(entries, or_models(), COMBINED, [])
        )

    def test_pricing_below_90_percent_dies(self):
        self.assert_dies(arena_entries(), or_models(unpriced=11), COMBINED, [])

    def test_pricing_at_91_percent_passes(self):
        self.assertIsNone(
            update.validate(arena_entries(), or_models(unpriced=9), COMBINED, [])
        )

    def test_top20_match_below_18_dies(self):
        unmatched = [{"name": f"model-{i}", "rank": i} for i in (1, 2, 3)]
        self.assert_dies(arena_entries(), or_models(), COMBINED, unmatched)

    def test_top20_match_at_18_passes(self):
        unmatched = [{"name": f"model-{i}", "rank": i} for i in (1, 2)]
        self.assertIsNone(
            update.validate(arena_entries(), or_models(), COMBINED, unmatched)
        )

    def test_overall_match_rate_below_40_percent_dies(self):
        unmatched = [{"name": f"model-{i}", "rank": i} for i in range(21, 51)]
        unmatched.append({"name": "model-20", "rank": 20})
        self.assert_dies(arena_entries(), or_models(), COMBINED, unmatched)

    def test_overall_match_rate_at_40_percent_passes(self):
        unmatched = [{"name": f"model-{i}", "rank": i} for i in range(21, 51)]
        self.assertIsNone(
            update.validate(arena_entries(), or_models(), COMBINED, unmatched)
        )

    def test_empty_combined_dies(self):
        self.assert_dies(arena_entries(), or_models(), [], [])


class TestDie(unittest.TestCase):
    def test_die_exits_non_zero(self):
        with redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit) as ctx:
                update.die("boom")
        self.assertEqual(ctx.exception.code, 1)


if __name__ == "__main__":
    unittest.main()
