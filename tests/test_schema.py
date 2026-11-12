"""Characterization tests for the upstream schema fingerprint (plan 047 step 02b)."""

import io
import json
import tempfile
import unittest
from contextlib import redirect_stderr
from pathlib import Path

import update


class TestSchemaSignature(unittest.TestCase):
    def test_unions_fields_across_objects(self):
        self.assertEqual(
            update.schema_signature([{"a": 1, "b": 2}, {"b": 2, "c": 3}]),
            ["a", "b", "c"],
        )

    def test_ignores_non_objects(self):
        self.assertEqual(update.schema_signature([{"a": None}, "x", None]), ["a"])

    def test_empty_payload_is_empty(self):
        self.assertEqual(update.schema_signature([]), [])


class TestSchemaDiff(unittest.TestCase):
    def test_added_only(self):
        self.assertEqual(
            update.schema_diff(["a"], ["a", "b"]), (["b"], [])
        )

    def test_removed_only(self):
        self.assertEqual(
            update.schema_diff(["a", "b"], ["a"]), ([], ["b"])
        )

    def test_both(self):
        self.assertEqual(
            update.schema_diff(["a", "b"], ["a", "c"]), (["c"], ["b"])
        )


class TestCheckSchema(unittest.TestCase):
    def _prev(self, tmp, payload):
        path = Path(tmp) / "prev.json"
        path.write_text(payload if isinstance(payload, str) else json.dumps(payload))
        return path

    def _sections(self, rows, stats):
        return {
            "arena_rows": rows,
            "openrouter_models": [],
            "endpoints_api": [],
            "model_page_endpoint": [],
            "model_page_stats": stats,
        }

    def test_first_run_reports_baseline(self):
        with tempfile.TemporaryDirectory() as tmp:
            prev = Path(tmp) / "prev.json"  # never written
            sections = self._sections(["a", "b"], ["p99_throughput"])
            lines, block = update.check_schema(sections, prev_path=prev)
        self.assertTrue(all(line.endswith("(baseline)") for line in lines))
        self.assertEqual(len(lines), len(update.SCHEMA_SECTIONS))
        self.assertEqual(block, {name: sections[name] for name in update.SCHEMA_SECTIONS})

    def test_unchanged_reports_field_count(self):
        with tempfile.TemporaryDirectory() as tmp:
            sections = self._sections(["a", "b"], ["p99_throughput"])
            prev = self._prev(tmp, {"schema": sections})
            lines, _ = update.check_schema(sections, prev_path=prev)
        self.assertIn("  schema: arena_rows: 2 fields (unchanged)", lines)

    def test_added_field_is_reported_not_fatal(self):
        with tempfile.TemporaryDirectory() as tmp:
            prev = self._prev(
                tmp, {"schema": self._sections(["a", "b"], ["p99_throughput"])}
            )
            sections = self._sections(
                ["a", "b"], ["p99_throughput", "throughput_window_minutes"]
            )
            lines, _ = update.check_schema(sections, prev_path=prev)
        line = next(l for l in lines if l.startswith("  schema: model_page_stats:"))
        self.assertIn("+throughput_window_minutes", line)

    def test_removed_field_is_reported_not_fatal(self):
        with tempfile.TemporaryDirectory() as tmp:
            prev = self._prev(
                tmp, {"schema": self._sections([], ["p99_throughput"])}
            )
            sections = self._sections([], [])
            lines, _ = update.check_schema(sections, prev_path=prev)
        line = next(l for l in lines if l.startswith("  schema: model_page_stats:"))
        self.assertIn("-p99_throughput", line)

    def test_corrupt_previous_meta_dies(self):
        with tempfile.TemporaryDirectory() as tmp:
            prev = self._prev(tmp, "not json")
            stderr = io.StringIO()
            with redirect_stderr(stderr), self.assertRaises(SystemExit):
                update.check_schema(self._sections([], []), prev_path=prev)
        self.assertIn("schema: previous meta.json unreadable", stderr.getvalue())


if __name__ == "__main__":
    unittest.main()
