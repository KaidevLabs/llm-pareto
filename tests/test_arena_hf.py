"""Characterization tests for the HF arena source (plan 047)."""

import io
import json
import unittest
from contextlib import redirect_stderr
from unittest import mock

import update


class TestArenaName(unittest.TestCase):
    def test_display_name_with_config_suffix(self):
        self.assertEqual(
            update.arena_name("Gemini 4 Argon (High)"), "gemini-4-argon-high"
        )

    def test_display_name_with_max_config(self):
        self.assertEqual(
            update.arena_name("Claude Fable 5.1 (Max)"), "claude-fable-5.1-max"
        )

    def test_display_name_without_config_suffix(self):
        self.assertEqual(
            update.arena_name("Gemini 3.1 Pro Preview"), "gemini-3.1-pro-preview"
        )

    def test_config_with_comma_and_spaces(self):
        self.assertEqual(
            update.arena_name("Claude Opus 4 (Non-Thinking, 09-2025)"),
            "claude-opus-4-non-thinking-09-2025",
        )

    def test_already_slug_name_passes_through(self):
        self.assertEqual(update.arena_name("amazon-nova-2-lite"), "amazon-nova-2-lite")


class TestResolveOrg(unittest.TestCase):
    def test_known_slug_resolves_to_display_name(self):
        self.assertEqual(
            update.resolve_org("google", {"google": "Google", "zai": "Z.ai"}),
            "Google",
        )

    def test_unknown_slug_passes_through_verbatim(self):
        self.assertEqual(update.resolve_org("nvidia", {"google": "Google"}), "nvidia")

    def test_empty_slug_passes_through(self):
        self.assertEqual(update.resolve_org("", {"google": "Google"}), "")


ROW = {
    "model_name": "Gemini 4 Argon (High)",
    "organization": "google",
    "license": "Proprietary",
    "rating": 1525.7265988779627,
    "rating_lower": 1519.151932519802,
    "rating_upper": 1532.3012652361235,
    "variance": 11.252557879384431,
    "vote_count": 10083.0,
    "rank": 1.0,
    "category": "overall",
    "leaderboard_publish_date": "2026-10-22",
}


class TestParseArenaRows(unittest.TestCase):
    def test_maps_one_row_to_join_keys(self):
        self.assertEqual(
            update.parse_arena_rows([ROW], {"google": "Google"}),
            [
                {
                    "modelDisplayName": "gemini-4-argon-high",
                    "rank": 1,
                    "rankUpper": 1,
                    "rankLower": 1,
                    "rating": 1525.7265988779627,
                    "ratingUpper": 1532.3012652361235,
                    "ratingLower": 1519.151932519802,
                    "votes": 10083,
                    "modelOrganization": "Google",
                    "license": "Proprietary",
                    "modelUrl": None,
                    "contextLength": None,
                    "inputPricePerMillion": None,
                    "outputPricePerMillion": None,
                    "publishDate": "2026-10-22",
                }
            ],
        )

    def test_row_missing_rating_dies(self):
        row = dict(ROW)
        row["rating"] = None
        with redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit) as ctx:
                update.parse_arena_rows([row], {"google": "Google"})
        self.assertEqual(ctx.exception.code, 1)


class TestFetchArenaRows(unittest.TestCase):
    def test_pages_until_category_changes(self):
        pages = [
            [{"category": "overall"}, {"category": "overall"}],
            [{"category": "overall"}, {"category": "chinese"}],
        ]
        calls = []

        def fetcher(url):
            calls.append(url)
            return json.dumps(
                {"rows": [{"row": r} for r in pages[len(calls) - 1]]}
            )

        with mock.patch.object(update, "HF_PAGE", 2):
            rows = update.fetch_arena_rows(fetcher)
        self.assertEqual(len(rows), 3)
        self.assertEqual(len(calls), 2)

    def test_first_page_not_overall_dies(self):
        pages = [[{"category": "chinese"}, {"category": "chinese"}]]
        calls = []

        def fetcher(url):
            calls.append(url)
            return json.dumps(
                {"rows": [{"row": r} for r in pages[len(calls) - 1]]}
            )

        with mock.patch.object(update, "HF_PAGE", 2):
            with redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit) as ctx:
                    update.fetch_arena_rows(fetcher)
        self.assertEqual(ctx.exception.code, 1)

    def test_cap_exhausted_dies(self):
        def fetcher(url):
            return json.dumps(
                {"rows": [{"row": {"category": "overall"}} for _ in range(2)]}
            )

        with mock.patch.object(update, "HF_PAGE", 2), mock.patch.object(
            update, "HF_MAX_PAGES", 2
        ), redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit) as ctx:
                update.fetch_arena_rows(fetcher)
        self.assertEqual(ctx.exception.code, 1)


if __name__ == "__main__":
    unittest.main()
