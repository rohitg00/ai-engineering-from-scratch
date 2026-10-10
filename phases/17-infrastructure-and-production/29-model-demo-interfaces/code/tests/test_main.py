"""Tests for the model demo interface: validator, rate limiter, errors, stream, and HTTP server."""

from __future__ import annotations

import contextlib
import io
import json
import os
import socket
import sys
import unittest
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    CONTENT_SECURITY_POLICY,
    EXAMPLES,
    MAX_CHARS,
    PAGE_SCRIPT,
    DemoApp,
    DemoConfig,
    DemoError,
    DemoHandler,
    FakeClock,
    PrivacyLog,
    RateLimiter,
    TokenBucket,
    UsageCap,
    check_auth,
    check_body_size,
    csp_hash,
    error_body,
    http_request,
    parse_json_body,
    parse_sse,
    predict,
    render_page,
    run_selftest,
    sse_event,
    start_background_server,
    stop_server,
    stream_events,
    validate_text,
)


def raised(fn) -> DemoError:
    try:
        fn()
    except DemoError as err:
        return err
    raise AssertionError("expected DemoError")


class ModelTests(unittest.TestCase):
    def test_examples_cover_three_labels(self) -> None:
        labels = [predict(text)["label"] for text in EXAMPLES]
        self.assertEqual(labels, ["positive", "negative", "neutral"])

    def test_predict_is_deterministic(self) -> None:
        self.assertEqual(predict(EXAMPLES[0]), predict(EXAMPLES[0]))


class ValidatorTests(unittest.TestCase):
    def test_accepts_and_strips(self) -> None:
        self.assertEqual(validate_text({"text": "  works well \n"}), "works well")

    def test_accepts_text_at_the_limit(self) -> None:
        self.assertEqual(len(validate_text({"text": "a" * MAX_CHARS})), MAX_CHARS)

    def test_rejects_missing_field(self) -> None:
        self.assertEqual(raised(lambda: validate_text({})).code, "missing_text")

    def test_rejects_non_string(self) -> None:
        self.assertEqual(raised(lambda: validate_text({"text": 42})).code, "text_not_string")

    def test_rejects_whitespace_only(self) -> None:
        err = raised(lambda: validate_text({"text": " \t\n "}))
        self.assertEqual((err.status, err.code), (422, "empty_text"))

    def test_rejects_long_text_with_numbers_in_message(self) -> None:
        err = raised(lambda: validate_text({"text": "a" * (MAX_CHARS + 1)}))
        self.assertEqual(err.code, "text_too_long")
        self.assertIn(str(MAX_CHARS + 1), err.message)
        self.assertIn(str(MAX_CHARS), err.hint)

    def test_rejects_control_characters(self) -> None:
        self.assertEqual(raised(lambda: validate_text({"text": "ok\x00ok"})).code, "control_characters")


class BodyTests(unittest.TestCase):
    def test_missing_length(self) -> None:
        self.assertEqual(raised(lambda: check_body_size(None)).status, 411)

    def test_bad_length(self) -> None:
        self.assertEqual(raised(lambda: check_body_size("ten")).code, "bad_length")
        self.assertEqual(raised(lambda: check_body_size("-5")).code, "bad_length")

    def test_body_over_limit(self) -> None:
        err = raised(lambda: check_body_size("5000", max_bytes=4096))
        self.assertEqual((err.status, err.code), (413, "body_too_large"))

    def test_wrong_content_type(self) -> None:
        self.assertEqual(raised(lambda: parse_json_body("text/plain", b"{}")).status, 415)

    def test_bad_json_and_non_object(self) -> None:
        self.assertEqual(raised(lambda: parse_json_body("application/json", b"{oops")).code, "bad_json")
        self.assertEqual(raised(lambda: parse_json_body("application/json", b"[1, 2]")).code, "bad_json")

    def test_charset_parameter_is_accepted(self) -> None:
        payload = parse_json_body("application/json; charset=utf-8", b'{"text": "hi"}')
        self.assertEqual(payload, {"text": "hi"})


class TokenBucketTests(unittest.TestCase):
    def test_burst_then_reject_with_exact_wait(self) -> None:
        bucket = TokenBucket(capacity=2, refill_per_second=0.5, now=0.0)
        self.assertEqual(bucket.take(0.0), 0.0)
        self.assertEqual(bucket.take(0.0), 0.0)
        self.assertAlmostEqual(bucket.take(0.0), 2.0)

    def test_refill_never_exceeds_capacity(self) -> None:
        bucket = TokenBucket(capacity=3, refill_per_second=1.0, now=0.0)
        bucket.take(0.0)
        bucket.take(10_000.0)
        self.assertAlmostEqual(bucket.tokens, 2.0)

    def test_invalid_settings(self) -> None:
        with self.assertRaises(ValueError):
            TokenBucket(capacity=0, refill_per_second=1.0, now=0.0)
        with self.assertRaises(ValueError):
            RateLimiter(capacity=2, refill_per_second=0.0)

    def test_clients_have_separate_buckets(self) -> None:
        clock = FakeClock()
        limiter = RateLimiter(capacity=1, refill_per_second=1.0, clock=clock)
        self.assertEqual(limiter.check("a"), 0.0)
        self.assertGreater(limiter.check("a"), 0.0)
        self.assertEqual(limiter.check("b"), 0.0)

    def test_refill_after_waiting(self) -> None:
        clock = FakeClock()
        limiter = RateLimiter(capacity=1, refill_per_second=0.25, clock=clock)
        limiter.check("a")
        wait = limiter.check("a")
        clock.advance(wait)
        self.assertEqual(limiter.check("a"), 0.0)

    def test_oldest_client_is_evicted(self) -> None:
        limiter = RateLimiter(capacity=1, refill_per_second=1.0, clock=FakeClock(), max_clients=2)
        for client in ("a", "b", "c"):
            limiter.check(client)
        self.assertEqual(list(limiter.buckets), ["b", "c"])


class UsageCapTests(unittest.TestCase):
    def test_cap_blocks_until_window_ends(self) -> None:
        clock = FakeClock(start=100.0)
        cap = UsageCap(max_calls=2, window_seconds=1000.0, clock=clock)
        self.assertEqual([cap.spend(), cap.spend()], [0.0, 0.0])
        self.assertAlmostEqual(cap.spend(), 900.0)
        clock.advance(900.0)
        self.assertEqual(cap.spend(), 0.0)


class ErrorFormatTests(unittest.TestCase):
    def test_error_body_shape(self) -> None:
        body = error_body(DemoError(422, "empty_text", "The text is empty.", "Type a sentence."), "req1")
        self.assertEqual(body, {"error": {"code": "empty_text", "message": "The text is empty.",
                                          "hint": "Type a sentence.", "request_id": "req1"}})

    def test_rate_limit_error_has_retry_after(self) -> None:
        app = DemoApp(DemoConfig(bucket_capacity=1, refill_per_second=0.5), clock=FakeClock())
        app.admit("1.2.3.4", None)
        err = raised(lambda: app.admit("1.2.3.4", None))
        self.assertEqual((err.status, err.code), (429, "rate_limited"))
        self.assertEqual(err.headers["Retry-After"], "2")
        self.assertIn("2 seconds", err.hint)

    def test_usage_cap_error(self) -> None:
        app = DemoApp(DemoConfig(daily_call_cap=1), wall_clock=FakeClock())
        app.charge()
        err = raised(app.charge)
        self.assertEqual((err.status, err.code), (503, "usage_cap_reached"))
        self.assertIn("Retry-After", err.headers)

    def test_auth(self) -> None:
        check_auth(None, None)
        check_auth("Bearer test-token", "test-token")
        err = raised(lambda: check_auth("Bearer wrong", "test-token"))
        self.assertEqual(err.status, 401)
        self.assertIn("WWW-Authenticate", err.headers)
        self.assertEqual(raised(lambda: check_auth(None, "test-token")).code, "unauthorized")


class StreamTests(unittest.TestCase):
    def test_tokens_then_done(self) -> None:
        events = parse_sse(b"".join(stream_events(EXAMPLES[1])))
        names = [name for name, _ in events]
        self.assertEqual(names[-1], "done")
        self.assertTrue(all(name == "token" for name in names[:-1]))
        self.assertEqual(events[-1][1]["tokens"], len(names) - 1)
        self.assertEqual(events[-1][1]["label"], "negative")

    def test_tokens_join_to_full_reply(self) -> None:
        events = parse_sse(b"".join(stream_events(EXAMPLES[0])))
        streamed = "".join(data["text"] for name, data in events if name == "token")
        self.assertEqual(streamed, predict(EXAMPLES[0])["reply"])

    def test_frame_format(self) -> None:
        frame = sse_event("token", {"index": 0, "text": "Label:"})
        self.assertEqual(frame, b'event: token\ndata: {"index":0,"text":"Label:"}\n\n')

    def test_failure_mid_stream_sends_error_event(self) -> None:
        def broken(text):
            yield "Label:"
            raise RuntimeError("model crashed")

        events = parse_sse(b"".join(stream_events("anything", generate_fn=broken)))
        self.assertEqual([name for name, _ in events], ["token", "error"])
        self.assertEqual(events[1][1]["code"], "model_error")
        self.assertIn("hint", events[1][1])

    def test_delay_uses_injected_sleep(self) -> None:
        pauses = []
        frames = list(stream_events(EXAMPLES[2], delay=0.05, sleep=pauses.append))
        self.assertEqual(len(pauses), len(frames) - 1)
        self.assertTrue(all(p == 0.05 for p in pauses))


class PrivacyLogTests(unittest.TestCase):
    def test_record_keeps_no_text_and_no_address(self) -> None:
        log = PrivacyLog(salt=b"fixed-test-salt")
        secret_text = "My account number is 12345 and I am angry"
        entry = log.record("req1", "/api/predict", "203.0.113.7", 200, len(secret_text), 12.3)
        dumped = json.dumps(entry)
        self.assertNotIn("12345", dumped)
        self.assertNotIn("203.0.113.7", dumped)
        self.assertEqual(entry["input_chars"], len(secret_text))

    def test_pseudonym_stable_per_salt(self) -> None:
        one, two = PrivacyLog(salt=b"salt-one"), PrivacyLog(salt=b"salt-two")
        self.assertEqual(one.pseudonym("203.0.113.7"), one.pseudonym("203.0.113.7"))
        self.assertNotEqual(one.pseudonym("203.0.113.7"), two.pseudonym("203.0.113.7"))


class PageTests(unittest.TestCase):
    def test_page_has_no_external_scripts(self) -> None:
        page = render_page(DemoConfig())
        self.assertNotIn("<script src", page)
        self.assertNotIn("http://", page)
        self.assertNotIn("https://", page)
        self.assertIn(f'maxlength="{MAX_CHARS}"', page)

    def test_csp_allows_exactly_the_inline_script(self) -> None:
        self.assertIn(csp_hash(PAGE_SCRIPT), CONTENT_SECURITY_POLICY)
        self.assertIn("default-src 'none'", CONTENT_SECURITY_POLICY)

    def test_token_field_only_when_auth_is_on(self) -> None:
        self.assertNotIn('id="token"', render_page(DemoConfig()))
        self.assertIn('id="token"', render_page(DemoConfig(access_token="test-token")))


class HttpTests(unittest.TestCase):
    def setUp(self) -> None:
        self.app = DemoApp(DemoConfig(bucket_capacity=3, refill_per_second=0.01))
        self.server, self.thread = start_background_server(self.app)
        self.base = f"http://127.0.0.1:{self.server.server_address[1]}"

    def tearDown(self) -> None:
        stop_server(self.server, self.thread)
        self.assertFalse(self.thread.is_alive())

    def test_home_page_and_security_headers(self) -> None:
        status, headers, body = http_request(self.base + "/")
        self.assertEqual(status, 200)
        self.assertTrue(headers["Content-Type"].startswith("text/html"))
        self.assertEqual(headers["Content-Security-Policy"], CONTENT_SECURITY_POLICY)
        self.assertIn(b"demo-form", body)

    def test_predict_ok(self) -> None:
        status, headers, body = http_request(self.base + "/api/predict", "POST", {"text": EXAMPLES[0]})
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["label"], "positive")
        self.assertIn("X-Request-Id", headers)

    def test_validation_error_is_json(self) -> None:
        status, headers, body = http_request(self.base + "/api/predict", "POST", {"text": "   "})
        self.assertEqual(status, 422)
        error = json.loads(body)["error"]
        self.assertEqual(error["code"], "empty_text")
        self.assertEqual(error["request_id"], headers["X-Request-Id"])

    def test_wrong_content_type(self) -> None:
        status, _, body = http_request(self.base + "/api/predict", "POST", {"text": "hi"},
                                       headers={"Content-Type": "text/plain"})
        self.assertEqual(status, 415)
        self.assertEqual(json.loads(body)["error"]["code"], "unsupported_media_type")

    def test_body_too_large(self) -> None:
        status, _, body = http_request(self.base + "/api/predict", "POST", {"text": "a" * 5000})
        self.assertEqual(status, 413)
        self.assertEqual(json.loads(body)["error"]["code"], "body_too_large")

    def test_stream_endpoint(self) -> None:
        status, headers, body = http_request(self.base + "/api/stream", "POST", {"text": EXAMPLES[1]})
        self.assertEqual(status, 200)
        self.assertTrue(headers["Content-Type"].startswith("text/event-stream"))
        events = parse_sse(body)
        self.assertEqual(events[-1][0], "done")

    def test_rate_limit_returns_429(self) -> None:
        statuses = [http_request(self.base + "/api/predict", "POST", {"text": "ok"})[0] for _ in range(3)]
        status, headers, body = http_request(self.base + "/api/predict", "POST", {"text": "ok"})
        self.assertEqual(statuses, [200, 200, 200])
        self.assertEqual(status, 429)
        self.assertGreaterEqual(int(headers["Retry-After"]), 1)
        self.assertEqual(json.loads(body)["error"]["code"], "rate_limited")

    def test_stalled_body_closes_the_connection(self) -> None:
        with mock.patch.object(DemoHandler, "timeout", 0.2):
            with socket.create_connection(self.server.server_address, timeout=5) as conn:
                conn.sendall(b"POST /api/predict HTTP/1.0\r\nContent-Type: application/json\r\n"
                             b"Content-Length: 100\r\n\r\n{\"text\"")
                self.assertEqual(conn.recv(1024), b"")
        self.assertEqual([r["code"] for r in self.app.log.records], ["request_timeout"])

    def test_unknown_path_and_log_privacy(self) -> None:
        status, _, body = http_request(self.base + "/api/other?text=private", "POST", {"text": "private words"})
        self.assertEqual(status, 404)
        self.assertEqual(json.loads(body)["error"]["code"], "not_found")
        logged = json.dumps(list(self.app.log.records))
        self.assertNotIn("private", logged)
        self.assertIn('"route": "other"', logged)


class SelfTestTests(unittest.TestCase):
    def test_selftest_passes_and_returns(self) -> None:
        with contextlib.redirect_stdout(io.StringIO()) as out:
            code = run_selftest()
        self.assertEqual(code, 0, out.getvalue())


if __name__ == "__main__":
    unittest.main()
