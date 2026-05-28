"""newline-delimited stdio 上の JSON-RPC 2.0。

Conceptual references:
- ./docs/en.md (this lesson)
- JSON-RPC 2.0 specification (https://www.jsonrpc.org/specification)
- RFC 8259 (JSON)

stdlib のみ。実行: python3 code/main.py
"""

from __future__ import annotations

import io
import json
import sys
from dataclasses import dataclass
from typing import Any, BinaryIO, Callable, Iterable


ERR_PARSE = -32700
ERR_INVALID_REQUEST = -32600
ERR_METHOD_NOT_FOUND = -32601
ERR_INVALID_PARAMS = -32602
ERR_INTERNAL = -32603


class JsonRpcError(Exception):
    code: int = ERR_INTERNAL

    def __init__(self, message: str, data: Any | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.data = data


class MethodNotFound(JsonRpcError):
    code = ERR_METHOD_NOT_FOUND


class InvalidParams(JsonRpcError):
    code = ERR_INVALID_PARAMS


@dataclass
class Request:
    method: str
    params: Any
    id: int | str | None
    is_notification: bool


def _is_valid_envelope(msg: Any) -> bool:
    if not isinstance(msg, dict):
        return False
    if msg.get("jsonrpc") != "2.0":
        return False
    if not isinstance(msg.get("method"), str):
        return False
    if "params" in msg and not isinstance(msg["params"], (dict, list)):
        return False
    if "id" in msg:
        rid = msg["id"]
        if isinstance(rid, bool):
            return False
        if not isinstance(rid, (int, str, type(None))):
            return False
    return True


def parse_request(raw: str) -> tuple[Request | None, dict | None]:
    """JSON line を 1 つ parse する。成功時は (Request, None)、失敗時は (None, error_dict) を返す。

    error_dict はそのまま書き出せる JSON-RPC error response。
    """
    try:
        msg = json.loads(raw)
    except json.JSONDecodeError as exc:
        return None, _err_envelope(None, ERR_PARSE, f"parse error: {exc}")
    if not _is_valid_envelope(msg):
        rid = msg.get("id") if isinstance(msg, dict) else None
        return None, _err_envelope(rid, ERR_INVALID_REQUEST, "invalid request envelope")
    is_notif = "id" not in msg
    return Request(
        method=msg["method"],
        params=msg.get("params"),
        id=msg.get("id"),
        is_notification=is_notif,
    ), None


def _err_envelope(rid: int | str | None, code: int, message: str, data: Any | None = None) -> dict:
    err: dict[str, Any] = {"code": code, "message": message}
    if data is not None:
        err["data"] = data
    return {"jsonrpc": "2.0", "id": rid, "error": err}


def _ok_envelope(rid: int | str | None, result: Any) -> dict:
    return {"jsonrpc": "2.0", "id": rid, "result": result}


def _notification_envelope(method: str, params: Any | None) -> dict:
    env: dict[str, Any] = {"jsonrpc": "2.0", "method": method}
    if params is not None:
        env["params"] = params
    return env


class StdioTransport:
    """byte stream pair 上の newline-delimited JSON-RPC 2.0。"""

    def __init__(self, stdin: BinaryIO, stdout: BinaryIO) -> None:
        self._in: BinaryIO = stdin
        self._out: BinaryIO = stdout

    def read_line(self) -> bytes | None:
        line = self._in.readline()
        if not line:
            return None
        return line

    def write_response(self, rid: int | str | None, result: Any) -> None:
        self._write(_ok_envelope(rid, result))

    def write_error(self, rid: int | str | None, code: int, message: str, data: Any | None = None) -> None:
        self._write(_err_envelope(rid, code, message, data))

    def write_notification(self, method: str, params: Any | None = None) -> None:
        self._write(_notification_envelope(method, params))

    def _write(self, obj: dict) -> None:
        encoded = json.dumps(obj, separators=(",", ":"))
        self._out.write((encoded + "\n").encode("utf-8"))
        self._out.flush()


Handler = Callable[[str, Any], Any]


def _handle_one(handler: Handler, transport: StdioTransport, req: Request) -> dict | None:
    """単一の Request を dispatch する。response envelope を返す（notification なら None）。"""
    try:
        result = handler(req.method, req.params)
    except MethodNotFound as exc:
        return None if req.is_notification else _err_envelope(req.id, exc.code, exc.message, exc.data)
    except InvalidParams as exc:
        return None if req.is_notification else _err_envelope(req.id, exc.code, exc.message, exc.data)
    except JsonRpcError as exc:
        return None if req.is_notification else _err_envelope(req.id, exc.code, exc.message, exc.data)
    except Exception as exc:
        return None if req.is_notification else _err_envelope(
            req.id, ERR_INTERNAL, "internal error",
            {"exception": type(exc).__name__, "detail": str(exc)},
        )
    if req.is_notification:
        return None
    return _ok_envelope(req.id, result)


def _process_batch(handler: Handler, transport: StdioTransport, items: list) -> list | None:
    out: list = []
    for raw in items:
        if not isinstance(raw, dict) or not _is_valid_envelope(raw):
            rid = raw.get("id") if isinstance(raw, dict) else None
            out.append(_err_envelope(rid, ERR_INVALID_REQUEST, "invalid request envelope"))
            continue
        is_notif = "id" not in raw
        req = Request(
            method=raw["method"], params=raw.get("params"),
            id=raw.get("id"), is_notification=is_notif,
        )
        resp = _handle_one(handler, transport, req)
        if resp is not None:
            out.append(resp)
    if not out:
        return None
    return out


def _write_raw(transport: StdioTransport, obj: Any) -> None:
    encoded = json.dumps(obj, separators=(",", ":"))
    transport._out.write((encoded + "\n").encode("utf-8"))
    transport._out.flush()


def serve(handler: Handler, transport: StdioTransport) -> None:
    """EOF まで transport から request を読み、各 request を handler に dispatch する。"""
    while True:
        line = transport.read_line()
        if line is None:
            return
        text = line.decode("utf-8").rstrip("\n").strip()
        if not text:
            continue
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError as exc:
            transport.write_error(None, ERR_PARSE, f"parse error: {exc}")
            continue
        if isinstance(parsed, list):
            if not parsed:
                transport.write_error(None, ERR_INVALID_REQUEST, "empty batch")
                continue
            batch_out = _process_batch(handler, transport, parsed)
            if batch_out is not None:
                _write_raw(transport, batch_out)
            continue
        req, err = parse_request(text)
        if err is not None:
            _write_raw(transport, err)
            continue
        resp = _handle_one(handler, transport, req)
        if resp is not None:
            _write_raw(transport, resp)


def _demo() -> None:
    """io.BytesIO を使う self-terminating demo。process は spawn しない。"""

    def handler(method: str, params: Any) -> Any:
        if method == "math.add":
            if not isinstance(params, dict) or "a" not in params or "b" not in params:
                raise InvalidParams("a と b が必要です")
            return params["a"] + params["b"]
        if method == "echo":
            return params
        if method == "boom":
            raise RuntimeError("意図的な失敗")
        raise MethodNotFound(f"method {method!r}")

    requests = [
        {"jsonrpc": "2.0", "id": 1, "method": "math.add", "params": {"a": 2, "b": 3}},
        {"jsonrpc": "2.0", "id": 2, "method": "math.add", "params": {"a": 5}},
        {"jsonrpc": "2.0", "id": 3, "method": "missing"},
        {"jsonrpc": "2.0", "id": 4, "method": "boom"},
        {"jsonrpc": "2.0", "method": "log", "params": {"level": "info"}},
        [
            {"jsonrpc": "2.0", "id": 10, "method": "echo", "params": {"text": "hi"}},
            {"jsonrpc": "2.0", "method": "log", "params": {"msg": "skip-me"}},
            {"jsonrpc": "2.0", "id": 11, "method": "math.add", "params": {"a": 1, "b": 1}},
        ],
    ]

    stdin = io.BytesIO()
    for r in requests:
        stdin.write((json.dumps(r) + "\n").encode("utf-8"))
    stdin.write(b"{not json\n")
    stdin.seek(0)
    stdout = io.BytesIO()
    transport = StdioTransport(stdin, stdout)
    serve(handler, transport)
    stdout.seek(0)
    lines = [json.loads(line) for line in stdout.read().decode("utf-8").splitlines() if line]
    print(json.dumps({"server_responses": lines}, indent=2))


if __name__ == "__main__":
    _demo()
