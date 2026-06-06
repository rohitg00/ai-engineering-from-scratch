"""Tests for JSON-RPC 2.0 stdio transport: error codes, notifications, batches."""

from __future__ import annotations

import io
import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    ERR_INTERNAL,
    ERR_INVALID_PARAMS,
    ERR_INVALID_REQUEST,
    ERR_METHOD_NOT_FOUND,
    ERR_PARSE,
    InvalidParams,
    MethodNotFound,
    StdioTransport,
    serve,
)


def _drive(requests, handler):
    """Encode requests as newline-delimited JSON and run the server over them."""
    stdin = io.BytesIO()
    for r in requests:
        if isinstance(r, (bytes, bytearray)):
            stdin.write(r)
        else:
            stdin.write((json.dumps(r) + "\n").encode("utf-8"))
    stdin.seek(0)
    stdout = io.BytesIO()
    transport = StdioTransport(stdin, stdout)
    serve(handler, transport)
    stdout.seek(0)
    return [json.loads(line) for line in stdout.read().decode("utf-8").splitlines() if line.strip()]


def echo_handler(method, params):
    if method == "echo":
        return params
    if method == "addone":
        if not isinstance(params, dict) or "n" not in params:
            raise InvalidParams("n required")
        return params["n"] + 1
    raise MethodNotFound(f"method {method!r}")


class TestErrorCodes(unittest.TestCase):
    def test_parse_error(self) -> None:
        out = _drive([b"{ not json\n"], echo_handler)
        self.assertEqual(out[0]["error"]["code"], ERR_PARSE)
        self.assertIsNone(out[0]["id"])

    def test_invalid_request_wrong_version(self) -> None:
        out = _drive([{"jsonrpc": "1.0", "id": 1, "method": "echo"}], echo_handler)
        self.assertEqual(out[0]["error"]["code"], ERR_INVALID_REQUEST)

    def test_invalid_request_no_method(self) -> None:
        out = _drive([{"jsonrpc": "2.0", "id": 1}], echo_handler)
        self.assertEqual(out[0]["error"]["code"], ERR_INVALID_REQUEST)

    def test_method_not_found(self) -> None:
        out = _drive([{"jsonrpc": "2.0", "id": 1, "method": "nope"}], echo_handler)
        self.assertEqual(out[0]["error"]["code"], ERR_METHOD_NOT_FOUND)
        self.assertEqual(out[0]["id"], 1)

    def test_invalid_params(self) -> None:
        out = _drive([{"jsonrpc": "2.0", "id": 1, "method": "addone", "params": {}}], echo_handler)
        self.assertEqual(out[0]["error"]["code"], ERR_INVALID_PARAMS)

    def test_internal_error_carries_exception_name(self) -> None:
        def bad(m, p):
            raise ValueError("kaboom")
        out = _drive([{"jsonrpc": "2.0", "id": 1, "method": "x"}], bad)
        self.assertEqual(out[0]["error"]["code"], ERR_INTERNAL)
        self.assertEqual(out[0]["error"]["data"]["exception"], "ValueError")

    def test_boolean_id_rejected(self) -> None:
        out_true = _drive([{"jsonrpc": "2.0", "id": True, "method": "echo"}], echo_handler)
        self.assertEqual(out_true[0]["error"]["code"], ERR_INVALID_REQUEST)
        out_false = _drive([{"jsonrpc": "2.0", "id": False, "method": "echo"}], echo_handler)
        self.assertEqual(out_false[0]["error"]["code"], ERR_INVALID_REQUEST)


class TestNotifications(unittest.TestCase):
    def test_notification_no_response(self) -> None:
        out = _drive([{"jsonrpc": "2.0", "method": "echo", "params": {"v": "x"}}], echo_handler)
        self.assertEqual(out, [])

    def test_notification_handler_exception_silent(self) -> None:
        out = _drive([{"jsonrpc": "2.0", "method": "missing"}], echo_handler)
        self.assertEqual(out, [])


class TestBatches(unittest.TestCase):
    def test_batch_mixed_returns_only_non_notifications(self) -> None:
        out = _drive([[
            {"jsonrpc": "2.0", "id": 1, "method": "echo", "params": {"v": "a"}},
            {"jsonrpc": "2.0", "method": "echo", "params": {"v": "b"}},
            {"jsonrpc": "2.0", "id": 3, "method": "echo", "params": {"v": "c"}},
        ]], echo_handler)
        self.assertEqual(len(out), 1)
        self.assertIsInstance(out[0], list)
        self.assertEqual(len(out[0]), 2)
        ids = {r["id"] for r in out[0]}
        self.assertEqual(ids, {1, 3})

    def test_batch_all_notifications_silent(self) -> None:
        out = _drive([[
            {"jsonrpc": "2.0", "method": "echo", "params": {"v": "a"}},
            {"jsonrpc": "2.0", "method": "echo", "params": {"v": "b"}},
        ]], echo_handler)
        self.assertEqual(out, [])

    def test_empty_batch_invalid_request(self) -> None:
        out = _drive([[]], echo_handler)
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["error"]["code"], ERR_INVALID_REQUEST)


class TestStreamDoesNotPoison(unittest.TestCase):
    def test_parse_error_then_continue(self) -> None:
        stdin = io.BytesIO()
        stdin.write(b"{ broken\n")
        stdin.write((json.dumps({"jsonrpc": "2.0", "id": 1, "method": "echo", "params": {"v": "ok"}}) + "\n").encode("utf-8"))
        stdin.seek(0)
        stdout = io.BytesIO()
        transport = StdioTransport(stdin, stdout)
        serve(echo_handler, transport)
        stdout.seek(0)
        lines = [json.loads(line) for line in stdout.read().decode("utf-8").splitlines() if line.strip()]
        self.assertEqual(lines[0]["error"]["code"], ERR_PARSE)
        self.assertEqual(lines[1]["result"], {"v": "ok"})

    def test_empty_lines_skipped(self) -> None:
        stdin = io.BytesIO(b"\n\n" + json.dumps({"jsonrpc": "2.0", "id": 1, "method": "echo", "params": {"n": 5}}).encode("utf-8") + b"\n")
        stdout = io.BytesIO()
        transport = StdioTransport(stdin, stdout)
        serve(echo_handler, transport)
        stdout.seek(0)
        lines = [json.loads(line) for line in stdout.read().decode("utf-8").splitlines() if line.strip()]
        self.assertEqual(len(lines), 1)
        self.assertEqual(lines[0]["result"], {"n": 5})


class TestNotificationHelper(unittest.TestCase):
    def test_write_notification_no_id(self) -> None:
        stdin = io.BytesIO()
        stdout = io.BytesIO()
        transport = StdioTransport(stdin, stdout)
        transport.write_notification("progress", {"pct": 50})
        stdout.seek(0)
        obj = json.loads(stdout.read().decode("utf-8").splitlines()[0])
        self.assertEqual(obj["method"], "progress")
        self.assertNotIn("id", obj)
        self.assertEqual(obj["jsonrpc"], "2.0")


if __name__ == "__main__":
    unittest.main()
