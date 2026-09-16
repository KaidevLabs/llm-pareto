"""Characterization tests for update.normalize: current behavior, as-is."""

import unittest

import update


class TestNormalize(unittest.TestCase):
    def test_lowercases_and_maps_dots_to_dashes(self):
        self.assertEqual(update.normalize("GPT-5.5"), "gpt-5-5")

    def test_strips_parentheticals(self):
        self.assertEqual(
            update.normalize("Claude Sonnet 4.5 (Thinking)"), "claudesonnet4-5"
        )

    def test_strips_config_suffixes_high_xhigh_max(self):
        self.assertEqual(update.normalize("gpt-5.5-high"), "gpt-5-5")
        self.assertEqual(update.normalize("gpt-5-xhigh"), "gpt-5")
        self.assertEqual(update.normalize("kimi-k2-max"), "kimi-k2")

    def test_preserves_medium_and_low_suffixes(self):
        # -medium/-low occur inside real model names (mistral-medium,
        # gemini-3.5-flash-medium): only -high/-xhigh/-max are config suffixes.
        self.assertEqual(update.normalize("mistral-medium"), "mistral-medium")
        self.assertEqual(
            update.normalize("gemini-3.5-flash-medium"), "gemini-3-5-flash-medium"
        )
        self.assertEqual(update.normalize("foo-low"), "foo-low")

    def test_strips_beta_preview_exp_markers(self):
        self.assertEqual(update.normalize("grok-3-beta"), "grok-3")
        self.assertEqual(update.normalize("grok-4-beta2"), "grok-4")
        self.assertEqual(update.normalize("gemini-3-flash-preview"), "gemini-3-flash")
        self.assertEqual(update.normalize("deepseek-v3.2-exp"), "deepseek-v3-2")

    def test_strips_date_tokens(self):
        self.assertEqual(update.normalize("kimi-k2-0905"), "kimi-k2")
        self.assertEqual(update.normalize("mistral-large-2411"), "mistral-large")
        self.assertEqual(
            update.normalize("gpt-5-latest-20260101"), "gpt-5"
        )

    def test_strips_enumerated_tier_suffixes_batch_free(self):
        self.assertEqual(update.normalize("gpt-4o:free"), "gpt-4o")
        self.assertEqual(update.normalize("deepseek-chat:batch"), "deepseek-chat")

    def test_keeps_unlisted_tier_suffixes(self):
        # Only :batch and :free are enumerated; any other :token survives.
        self.assertEqual(update.normalize("foo:nodebug"), "foo:nodebug")

    def test_strips_suffixes_across_repeated_passes(self):
        self.assertEqual(update.normalize("model-max:batch"), "model")
        self.assertEqual(update.normalize("model-x-high:free"), "model-x")

    def test_removes_spaces_without_introducing_dashes(self):
        self.assertEqual(update.normalize("Qwen3 235B"), "qwen3235b")
        self.assertEqual(update.normalize("  Llama 4  "), "llama4")

    def test_parenthetical_removal_precedes_config_suffix(self):
        self.assertEqual(update.normalize("gpt-5.5 (high)"), "gpt-5-5")

    def test_collapses_to_empty_string(self):
        self.assertEqual(update.normalize("(x)"), "")
        self.assertEqual(update.normalize(""), "")


if __name__ == "__main__":
    unittest.main()
