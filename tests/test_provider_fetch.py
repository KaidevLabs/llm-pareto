"""Tests for update.fetch_endpoints / update.fetch_model_page: the
per-model provider-layer fetchers (plan 022, step 1) — URL construction
plus the inherited fetch() retry/backoff/fail-fast behavior, at the seam."""

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


class TestFetchEndpoints(unittest.TestCase):
    def test_builds_api_url_and_returns_payload(self):
        with mock.patch("urllib.request.urlopen") as urlopen, mock.patch(
            "time.sleep"
        ):
            urlopen.return_value = _FakeResponse(b'{"data": {}}')
            out = update.fetch_endpoints("openai/gpt-5.2")
        self.assertEqual(out, '{"data": {}}')
        self.assertEqual(
            urlopen.call_args[0][0].full_url,
            "https://openrouter.ai/api/v1/models/openai/gpt-5.2/endpoints",
        )

    def test_retries_transient_5xx_then_succeeds(self):
        with mock.patch("urllib.request.urlopen") as urlopen, mock.patch(
            "time.sleep"
        ) as sleep:
            urlopen.side_effect = [_http_error(503), _FakeResponse(b"ok")]
            self.assertEqual(update.fetch_endpoints("z-ai/glm-5"), "ok")
        self.assertEqual(urlopen.call_count, 2)
        sleep.assert_called_once_with(2)

    def test_429_is_transient(self):
        with mock.patch("urllib.request.urlopen") as urlopen, mock.patch(
            "time.sleep"
        ) as sleep:
            urlopen.side_effect = [_http_error(429), _FakeResponse(b"ok")]
            self.assertEqual(update.fetch_endpoints("z-ai/glm-5"), "ok")
        self.assertEqual(urlopen.call_count, 2)
        sleep.assert_called_once_with(2)

    def test_404_fails_fast_without_retry(self):
        with mock.patch("urllib.request.urlopen") as urlopen, mock.patch(
            "time.sleep"
        ) as sleep:
            urlopen.side_effect = _http_error(404)
            with self.assertRaises(SystemExit) as ctx:
                update.fetch_endpoints("nope/missing-model")
        self.assertEqual(ctx.exception.code, 1)
        self.assertEqual(urlopen.call_count, 1)
        sleep.assert_not_called()

    def test_sustained_500_gives_up_after_three_attempts_with_backoff(self):
        with mock.patch("urllib.request.urlopen") as urlopen, mock.patch(
            "time.sleep"
        ) as sleep:
            urlopen.side_effect = _http_error(500)
            with self.assertRaises(SystemExit):
                update.fetch_endpoints("z-ai/glm-5")
        self.assertEqual(urlopen.call_count, 3)
        self.assertEqual([c.args[0] for c in sleep.call_args_list], [2, 4])


class TestFetchModelPage(unittest.TestCase):
    def test_builds_page_url_and_returns_payload(self):
        with mock.patch("urllib.request.urlopen") as urlopen, mock.patch(
            "time.sleep"
        ):
            urlopen.return_value = _FakeResponse(b"<html></html>")
            out = update.fetch_model_page("openai/gpt-5.2")
        self.assertEqual(out, "<html></html>")
        self.assertEqual(
            urlopen.call_args[0][0].full_url,
            "https://openrouter.ai/openai/gpt-5.2",
        )

    def test_retries_transient_5xx_then_succeeds(self):
        with mock.patch("urllib.request.urlopen") as urlopen, mock.patch(
            "time.sleep"
        ) as sleep:
            urlopen.side_effect = [_http_error(503), _FakeResponse(b"ok")]
            self.assertEqual(update.fetch_model_page("z-ai/glm-5"), "ok")
        self.assertEqual(urlopen.call_count, 2)
        sleep.assert_called_once_with(2)

    def test_404_fails_fast_without_retry(self):
        with mock.patch("urllib.request.urlopen") as urlopen, mock.patch(
            "time.sleep"
        ) as sleep:
            urlopen.side_effect = _http_error(404)
            with self.assertRaises(SystemExit) as ctx:
                update.fetch_model_page("nope/missing-model")
        self.assertEqual(ctx.exception.code, 1)
        self.assertEqual(urlopen.call_count, 1)
        sleep.assert_not_called()


if __name__ == "__main__":
    unittest.main()
