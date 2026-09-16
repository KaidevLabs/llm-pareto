"""Characterization tests for update.parse_arena over a synthetic RSC payload."""

import io
import json
import unittest
from contextlib import redirect_stderr

import update

ENTRIES = [
    {
        "rank": 1,
        "modelDisplayName": 'Foo [X] "Bar"',
        "rating": 1500,
        "votes": 100,
        "ratingUpper": 1510,
        "ratingLower": 1490,
        "modelOrganization": "Org",
        "license": None,
        "contextLength": 128000,
        "extraField": "ignored",
    },
    {
        "rank": 2,
        "modelDisplayName": "Ünïcode Model ✓",
        "rating": 1400,
        "votes": 90,
    },
]


def rsc_html(*chunks):
    parts = []
    for chunk in chunks:
        raw = json.dumps(chunk)[1:-1]
        parts.append(f'<script>self.__next_f.push([1,"{raw}"])</script>')
    return "<html>" + "".join(parts) + "</html>"


def arena_page(entries):
    body = "2:" + json.dumps({"entries": entries})[1:]
    return rsc_html(body)


def assert_dies(test, html):
    with redirect_stderr(io.StringIO()):
        with test.assertRaises(SystemExit) as ctx:
            update.parse_arena(html)
    test.assertEqual(ctx.exception.code, 1)


class TestParseArena(unittest.TestCase):
    def test_parses_full_schema_entries_in_order(self):
        self.assertEqual(update.parse_arena(arena_page(ENTRIES)), ENTRIES)

    def test_entries_array_spanning_chunks_is_joined(self):
        html = rsc_html(
            '2:{"entries":[{"rank":1,"modelDisplayName":"A"',
            ',"rating":1500,"votes":1}]}',
        )
        self.assertEqual(
            update.parse_arena(html),
            [{"rank": 1, "modelDisplayName": "A", "rating": 1500, "votes": 1}],
        )

    def test_chunk_with_real_newline_uses_escape_fallback(self):
        html = (
            '<html><script>self.__next_f.push([1,"2:{'
            + "\n"
            + '\\"entries\\":[{\\"rank\\":1,\\"modelDisplayName\\":\\"NL Model\\"}]}"'
            + "])</script></html>"
        )
        self.assertEqual(
            update.parse_arena(html),
            [{"rank": 1, "modelDisplayName": "NL Model"}],
        )

    def test_no_rsc_chunks_dies(self):
        assert_dies(self, "<html>nothing here</html>")

    def test_missing_entries_anchor_dies(self):
        assert_dies(self, rsc_html('2:{"other":[1]}'))

    def test_empty_entries_dies(self):
        assert_dies(self, rsc_html('2:{"entries":[]}'))

    def test_non_object_entry_dies(self):
        assert_dies(self, rsc_html('2:{"entries":[1]}'))

    def test_unterminated_array_dies(self):
        assert_dies(self, rsc_html('2:{"entries":[{"rank":1}'))

    def test_unparseable_array_dies(self):
        assert_dies(self, rsc_html('2:{"entries":[{"rank":1,}]}'))


if __name__ == "__main__":
    unittest.main()
