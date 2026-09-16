"""Tests for update.fetch: transient-failure retry (plan 013, D5)."""

import io
import unittest
import urllib.error
from unittest import mock

import update


class _FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def read(self):
        return self._payload

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def _http_error(code):
    return urllib.error.HTTPError("https://x", code, "error", None, None)


class TestFetch(unittest.TestCase):
    def test_returns_payload_without_retry_on_success(self):
        with mock.patch("urllib.request.urlopen") as urlopen, mock.patch(
            "time.sleep"
        ) as sleep:
            urlopen.return_value = _FakeResponse(b"hello")
            self.assertEqual(update.fetch("https://x"), "hello")
        self.assertEqual(urlopen.call_count, 1)
        sleep.assert_not_called()

    def test_retries_transient_5xx_then_succeeds(self):
        with mock.patch("urllib.request.urlopen") as urlopen, mock.patch(
            "time.sleep"
        ) as sleep:
            urlopen.side_effect = [_http_error(503), _FakeResponse(b"ok")]
            self.assertEqual(update.fetch("https://x"), "ok")
        self.assertEqual(urlopen.call_count, 2)
        sleep.assert_called_once_with(2)

    def test_429_is_transient(self):
        with mock.patch("urllib.request.urlopen") as urlopen, mock.patch(
            "time.sleep"
        ) as sleep:
            urlopen.side_effect = [_http_error(429), _FakeResponse(b"ok")]
            self.assertEqual(update.fetch("https://x"), "ok")
        self.assertEqual(urlopen.call_count, 2)
        sleep.assert_called_once_with(2)

    def test_timeout_is_transient(self):
        with mock.patch("urllib.request.urlopen") as urlopen, mock.patch(
            "time.sleep"
        ) as sleep:
            urlopen.side_effect = [
                TimeoutError("read timed out"),
                _FakeResponse(b"ok"),
            ]
            self.assertEqual(update.fetch("https://x"), "ok")
        self.assertEqual(urlopen.call_count, 2)
        sleep.assert_called_once_with(2)

    def test_connection_error_is_transient(self):
        with mock.patch("urllib.request.urlopen") as urlopen, mock.patch(
            "time.sleep"
        ) as sleep:
            urlopen.side_effect = [
                urllib.error.URLError("Connection reset"),
                _FakeResponse(b"ok"),
            ]
            self.assertEqual(update.fetch("https://x"), "ok")
        self.assertEqual(urlopen.call_count, 2)
        sleep.assert_called_once_with(2)

    def test_non_transient_4xx_fails_fast(self):
        with mock.patch("urllib.request.urlopen") as urlopen, mock.patch(
            "time.sleep"
        ) as sleep:
            urlopen.side_effect = _http_error(404)
            with self.assertRaises(SystemExit) as ctx:
                update.fetch("https://x")
        self.assertEqual(ctx.exception.code, 1)
        self.assertEqual(urlopen.call_count, 1)
        sleep.assert_not_called()

    def test_gives_up_after_three_attempts_with_doubling_backoff(self):
        with mock.patch("urllib.request.urlopen") as urlopen, mock.patch(
            "time.sleep"
        ) as sleep:
            urlopen.side_effect = _http_error(500)
            with self.assertRaises(SystemExit) as ctx:
                update.fetch("https://x")
        self.assertEqual(ctx.exception.code, 1)
        self.assertEqual(urlopen.call_count, 3)
        self.assertEqual([c.args[0] for c in sleep.call_args_list], [2, 4])

    def test_final_failure_keeps_die_message_on_stderr(self):
        with mock.patch("urllib.request.urlopen") as urlopen, mock.patch(
            "time.sleep"
        ), mock.patch("sys.stderr", new_callable=io.StringIO) as err:
            urlopen.side_effect = _http_error(500)
            with self.assertRaises(SystemExit):
                update.fetch("https://x")
        self.assertIn("ERROR: fetch failed: https://x", err.getvalue())


if __name__ == "__main__":
    unittest.main()
