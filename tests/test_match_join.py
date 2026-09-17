"""Characterization tests for update.match_arena / join / build_or_lookup."""

import unittest

import update

OR_MODELS = [
    {
        "id": "openai/gpt-5.5",
        "name": "GPT-5.5",
        "org": "openai",
        "price_in_per_m": 1.0,
        "price_out_per_m": 2.0,
        "vision": False,
        "context_length": 128000,
    },
    {
        "id": "org/gpt-5",
        "name": "GPT-5",
        "org": "org",
        "price_in_per_m": 0.5,
        "price_out_per_m": 1.0,
        "vision": False,
        "context_length": 64000,
    },
    {
        "id": "google/gemma-4-31b-it",
        "name": "Gemma 4 31B",
        "org": "google",
        "price_in_per_m": 0.1,
        "price_out_per_m": 0.2,
        "vision": False,
        "context_length": 8000,
    },
    {
        "id": "google/gemma-4-9b-it",
        "name": "Gemma 4 9B",
        "org": "google",
        "price_in_per_m": 0.05,
        "price_out_per_m": 0.1,
        "vision": False,
        "context_length": 8000,
    },
    {
        "id": "mistralai/mistral-medium",
        "name": "Mistral Medium",
        "org": "mistralai",
        "price_in_per_m": 0.5,
        "price_out_per_m": 1.5,
        "vision": False,
        "context_length": 32000,
    },
    {
        "id": "synthetic/qwen3-vl-235b-thinkinx",
        "name": "Qwen3 VL 235B Thinkinx",
        "org": "synthetic",
        "price_in_per_m": 0.3,
        "price_out_per_m": 0.6,
        "vision": True,
        "context_length": 260000,
    },
    {
        "id": "meta/muse-spark-1.1",
        "name": "Muse Spark 1.1",
        "org": "meta",
        "price_in_per_m": 0.1,
        "price_out_per_m": 0.4,
        "vision": False,
        "context_length": 64000,
    },
    {
        "id": "meta/muse-spark-1.3",
        "name": "Muse Spark 1.3",
        "org": "meta",
        "price_in_per_m": 0.2,
        "price_out_per_m": 0.8,
        "vision": False,
        "context_length": 64000,
    },
]


def arena_entry(rank, name, rating, votes=100, **extra):
    entry = {
        "rank": rank,
        "modelDisplayName": name,
        "rating": rating,
        "votes": votes,
    }
    entry.update(extra)
    return entry


class TestBuildOrLookup(unittest.TestCase):
    def test_keys_are_normalized_basenames(self):
        lookup, _ = update.build_or_lookup(OR_MODELS)
        self.assertEqual(lookup["gpt-5-5"], "openai/gpt-5.5")
        self.assertEqual(lookup["gemma-4-31b-it"], "google/gemma-4-31b-it")
        self.assertEqual(lookup["mistral-medium"], "mistralai/mistral-medium")

    def test_collision_keeps_shorter_basename(self):
        models = [
            {
                "id": "org2/foo-",
                "name": "F",
                "org": "org2",
                "price_in_per_m": None,
                "price_out_per_m": None,
                "vision": False,
                "context_length": None,
            },
            {
                "id": "org/foo",
                "name": "F2",
                "org": "org",
                "price_in_per_m": None,
                "price_out_per_m": None,
                "vision": False,
                "context_length": None,
            },
        ]
        lookup, collisions = update.build_or_lookup(models)
        self.assertEqual(lookup, {"foo": "org/foo"})
        self.assertEqual(collisions, ["foo: org2/foo- vs org/foo"])


class TestMatchArena(unittest.TestCase):
    def setUp(self):
        self.lookup, self.collisions = update.build_or_lookup(OR_MODELS)
        self.keys = set(self.lookup)
        self.overrides = {"muse-spark": "meta/muse-spark-1.3"}

    def test_exact_match(self):
        self.assertEqual(
            update.match_arena("GPT-5.5", self.lookup, self.keys, self.overrides),
            ("openai/gpt-5.5", "exact", None),
        )

    def test_override_wins_over_exact(self):
        overrides = {"gpt-5-5": "synthetic/forced-id"}
        self.assertEqual(
            update.match_arena("GPT-5.5", self.lookup, self.keys, overrides),
            ("synthetic/forced-id", "override", None),
        )

    def test_override_fixes_ambiguous_bare_name(self):
        # overrides.json: muse-spark is ambiguous among muse-spark-1.1/1.2/1.3.
        self.assertEqual(
            update.match_arena("muse-spark", self.lookup, self.keys, self.overrides),
            ("meta/muse-spark-1.3", "override", None),
        )

    def test_config_suffix_stripped_before_exact_match(self):
        self.assertEqual(
            update.match_arena("gpt-5.5-high", self.lookup, self.keys, self.overrides),
            ("openai/gpt-5.5", "exact", None),
        )

    def test_prefix_base_picks_longest_base(self):
        self.assertEqual(
            update.match_arena(
                "gpt-5.5-instant", self.lookup, self.keys, self.overrides
            ),
            ("openai/gpt-5.5", "prefix-base", None),
        )

    def test_preserved_low_suffix_still_joins_via_prefix_base(self):
        self.assertEqual(
            update.match_arena("gpt-5.5-low", self.lookup, self.keys, self.overrides),
            ("openai/gpt-5.5", "prefix-base", None),
        )

    def test_prefix_variant_unique(self):
        self.assertEqual(
            update.match_arena("gemma-4-31b", self.lookup, self.keys, self.overrides),
            ("google/gemma-4-31b-it", "prefix-variant", None),
        )

    def test_ambiguous_prefix_variant_reports_candidates(self):
        self.assertEqual(
            update.match_arena("gemma-4", self.lookup, self.keys, self.overrides),
            (None, None, ["gemma-4-31b-it", "gemma-4-9b-it"]),
        )

    def test_fuzzy_match_auto_applies_at_or_above_0_95(self):
        # normalized "mistralmedium" vs key "mistral-medium" ratios 0.963.
        self.assertEqual(
            update.match_arena(
                "Mistral Medium", self.lookup, self.keys, self.overrides
            ),
            ("mistralai/mistral-medium", "fuzzy", 0.96),
        )

    def test_fuzzy_below_0_95_stays_unmatched_with_candidates(self):
        # normalized "qwen3vl235bthinkinx" vs "qwen3-vl-235b-thinkinx" is 0.93.
        self.assertEqual(
            update.match_arena(
                "Qwen3 VL 235B Thinkinx", self.lookup, self.keys, self.overrides
            ),
            (None, None, ["qwen3-vl-235b-thinkinx"]),
        )

    def test_no_match_reports_no_candidates(self):
        self.assertEqual(
            update.match_arena(
                "Totally Unknown", self.lookup, self.keys, self.overrides
            ),
            (None, None, []),
        )


class TestJoin(unittest.TestCase):
    def setUp(self):
        self.overrides = {"muse-spark": "meta/muse-spark-1.3"}

    def test_config_variants_collapse_to_max_elo_point(self):
        entries = [
            arena_entry(3, "GPT-5.5", 1500, 100),
            arena_entry(5, "GPT-5.5 (high)", 1600, 90),
        ]
        combined, unmatched, _, method_counts, variants_collapsed, applied = (
            update.join(entries, OR_MODELS, self.overrides)
        )
        self.assertEqual(len(combined), 1)
        self.assertEqual(
            combined[0],
            {
                "or_id": "openai/gpt-5.5",
                "or_name": "GPT-5.5",
                "price_in_per_m": 1.0,
                "price_out_per_m": 2.0,
                "vision": False,
                "context_length": 128000,
                "arena_rank": 5,
                "arena_elo": 1600,
                "arena_elo_upper": None,
                "arena_elo_lower": None,
                "arena_votes": 90,
                "arena_org": "openai",
                "arena_license": None,
                "arena_model": "GPT-5.5 (high)",
                "arena_variants": ["GPT-5.5", "GPT-5.5 (high)"],
                "arena_context_length": None,
                "arena_model_url": None,
                "arena_price_in_per_m": None,
                "arena_price_out_per_m": None,
                "match_method": "exact",
                "match_ratio": None,
            },
        )
        self.assertEqual(variants_collapsed, 1)
        self.assertEqual(method_counts, {"exact": 2})
        self.assertEqual(unmatched, [])
        self.assertEqual(applied, [])

    def test_model_url_and_arena_price_carry_from_best_entry(self):
        entries = [
            arena_entry(
                3,
                "GPT-5.5",
                1500,
                100,
                modelUrl="https://example.com/base",
                inputPricePerMillion=1.0,
                outputPricePerMillion=2.0,
            ),
            arena_entry(
                5,
                "GPT-5.5 (high)",
                1600,
                90,
                modelUrl="https://example.com/high",
                inputPricePerMillion=4.0,
                outputPricePerMillion=8.0,
            ),
        ]
        combined, _, _, _, _, _ = update.join(entries, OR_MODELS, self.overrides)
        record = combined[0]
        self.assertEqual(record["arena_model_url"], "https://example.com/high")
        self.assertEqual(record["arena_price_in_per_m"], 4.0)
        self.assertEqual(record["arena_price_out_per_m"], 8.0)

    def test_override_applied_recorded_and_org_falls_back(self):
        entries = [arena_entry(9, "muse-spark", 1300, 50)]
        combined, _, _, method_counts, _, applied = update.join(
            entries, OR_MODELS, self.overrides
        )
        record = combined[0]
        self.assertEqual(record["or_id"], "meta/muse-spark-1.3")
        self.assertEqual(record["match_method"], "override")
        self.assertEqual(record["arena_org"], "meta")
        self.assertEqual(applied, [{"arena": "muse-spark",
                                    "openrouter_id": "meta/muse-spark-1.3"}])
        self.assertEqual(method_counts, {"override": 1})

    def test_combined_sorted_by_rank_with_none_last(self):
        entries = [
            arena_entry(9, "muse-spark", 1300, 50),
            arena_entry(2, "GPT-5.5", 1600, 200),
            arena_entry(None, "mistral-medium", 800, 10),
        ]
        combined, _, _, _, _, _ = update.join(
            entries, OR_MODELS, self.overrides
        )
        self.assertEqual(
            [c["arena_rank"] for c in combined], [2, 9, None]
        )

    def test_unmatched_arena_entries_reported_with_candidates(self):
        entries = [arena_entry(7, "gemma-4", 1400)]
        combined, unmatched, _, _, _, _ = update.join(
            entries, OR_MODELS, self.overrides
        )
        self.assertEqual(combined, [])
        self.assertEqual(
            unmatched,
            [
                {
                    "name": "gemma-4",
                    "rank": 7,
                    "candidates": [
                        "google/gemma-4-31b-it",
                        "google/gemma-4-9b-it",
                    ],
                }
            ],
        )

    def test_unmatched_space_names_report_no_candidates(self):
        # "Gemma 4 31B" normalizes to "gemma431b": no prefix or fuzzy path
        # fires, so the candidate list is empty.
        entries = [arena_entry(7, "Gemma 4 31B", 1400)]
        _, unmatched, _, _, _, _ = update.join(entries, OR_MODELS, self.overrides)
        self.assertEqual(unmatched[0]["candidates"], [])


if __name__ == "__main__":
    unittest.main()
