"""Companion code for:
certifications/mcpa/lessons/03-json-rpc-and-meta/docs/en.md
Classify JSON-RPC message shapes and validate _meta keys.
Sources: JSON-RPC 2.0; MCP 2026-07-28 basic protocol and _meta rules; SEP-414.
"""

from __future__ import annotations

import json
import re
from typing import Any


PROTOCOL_VERSION = "2026-07-28"
PV_KEY = "io.modelcontextprotocol/protocolVersion"
CAPS_KEY = "io.modelcontextprotocol/clientCapabilities"
CLIENT_INFO_KEY = "io.modelcontextprotocol/clientInfo"
SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo"

INVALID_PARAMS = -32602

RESERVED_BARE_META_KEYS = {"progressToken", "traceparent", "tracestate", "baggage"}
RESERVED_SECOND_LABELS = {"modelcontextprotocol", "mcp"}
_META_LABEL = r"[A-Za-z](?:[A-Za-z0-9-]*[A-Za-z0-9])?"
_META_PREFIX_RE = re.compile(r"^(" + _META_LABEL + r"(?:\." + _META_LABEL + r")*)/(.*)$")
_META_NAME_RE = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$")


def make_request(request_id: int, method: str, params: dict | None = None, capabilities: dict | None = None,
                 version: str = PROTOCOL_VERSION) -> dict:
    body = dict(params or {})
    body["_meta"] = {
        PV_KEY: version,
        CAPS_KEY: capabilities or {},
        CLIENT_INFO_KEY: {"name": "lesson-client", "version": "1.0.0"},
    }
    return {"jsonrpc": "2.0", "id": request_id, "method": method, "params": body}


def make_result(request_id: Any, result_type: str = "complete", **fields: Any) -> dict:
    return {"jsonrpc": "2.0", "id": request_id, "result": {"resultType": result_type, **fields}}


def make_error(request_id: Any, code: int, message: str, data: Any = None) -> dict:
    error: dict[str, Any] = {"code": code, "message": message}
    if data is not None:
        error["data"] = data
    return {"jsonrpc": "2.0", "id": request_id, "error": error}


def make_notification(method: str, params: dict | None = None) -> dict:
    message: dict[str, Any] = {"jsonrpc": "2.0", "method": method}
    if params is not None:
        message["params"] = params
    return message


def is_valid_request_id(value: Any) -> bool:
    return isinstance(value, (str, int)) and not isinstance(value, bool)


def classify_message(message: Any) -> str:
    if not isinstance(message, dict) or message.get("jsonrpc") != "2.0":
        return "invalid"
    has_method = "method" in message
    has_id = "id" in message
    if has_method and has_id:
        return "request" if is_valid_request_id(message.get("id")) else "invalid"
    if has_method:
        return "notification"
    if "result" in message:
        return "result"
    if "error" in message:
        return "error"
    return "invalid"


def validate_notification_shape(message: dict) -> list[str]:
    problems = []
    if "method" not in message:
        problems.append("a notification must include a method")
    if "id" in message:
        problems.append("a notification must not include an id")
    return problems


def validate_result_shape(message: dict) -> list[str]:
    problems = []
    if "id" not in message:
        problems.append("a result response must echo the request id")
    result = message.get("result")
    if not isinstance(result, dict):
        problems.append("a result response must include a result object")
        return problems
    if not isinstance(result.get("resultType"), str) or not result["resultType"]:
        problems.append("result must include a non-empty resultType")
    return problems


def validate_error_shape(message: dict) -> list[str]:
    problems = []
    error = message.get("error")
    if not isinstance(error, dict):
        problems.append("an error response must include an error object")
        return problems
    if not isinstance(error.get("code"), int) or isinstance(error.get("code"), bool):
        problems.append("error.code must be an integer")
    if not isinstance(error.get("message"), str) or not error["message"]:
        problems.append("error.message must be a non-empty string")
    return problems


def meta_key_status(key: Any) -> str:
    if not isinstance(key, str) or not key:
        return "invalid"
    if key in RESERVED_BARE_META_KEYS:
        return "reserved"
    match = _META_PREFIX_RE.match(key)
    if match:
        prefix, name = match.group(1), match.group(2)
    else:
        prefix, name = "", key
    if not _META_NAME_RE.match(name):
        return "invalid"
    if prefix:
        labels = prefix.split(".")
        if len(labels) >= 2 and labels[1] in RESERVED_SECOND_LABELS:
            return "reserved"
    return "free"


def check_required_request_meta(message: dict) -> dict | None:
    request_id = message.get("id")
    params = message.get("params") if isinstance(message.get("params"), dict) else {}
    meta = params.get("_meta") if isinstance(params.get("_meta"), dict) else {}
    missing = []
    if not isinstance(meta.get(PV_KEY), str):
        missing.append(PV_KEY)
    if not isinstance(meta.get(CAPS_KEY), dict):
        missing.append(CAPS_KEY)
    if missing:
        return make_error(request_id, INVALID_PARAMS, "Missing required _meta field(s): " + ", ".join(missing))
    return None


def handle_request(message: dict) -> dict:
    meta_error = check_required_request_meta(message)
    if meta_error is not None:
        return meta_error
    request_id = message.get("id")
    params = message.get("params") or {}
    name = params.get("name")
    if name != "get_weather":
        return make_error(request_id, INVALID_PARAMS, f"Unknown tool: {name}")
    location = (params.get("arguments") or {}).get("location", "an unspecified location")
    return make_result(
        request_id,
        content=[{"type": "text", "text": f"{location}: sunny, 26C"}],
        isError=False,
        _meta={SERVER_INFO_KEY: {"name": "envelope-demo", "version": "1.0.0"}},
    )


def run_scenario() -> list[Any]:
    log: list[Any] = []

    request = make_request(1, "tools/call", {"name": "get_weather", "arguments": {"location": "Pune"}})
    log.append(request)
    log.append(handle_request(request))

    progress = make_notification(
        "notifications/progress",
        {"progressToken": 1, "progress": 1, "total": 1, "message": "weather lookup complete"},
    )
    log.append(progress)

    mistaken_notification = {
        "jsonrpc": "2.0",
        "id": 99,
        "method": "notifications/progress",
        "params": {"progressToken": 1, "progress": 1},
    }
    log.append({
        "violation": "a notification must never carry an id; once it has one, nothing distinguishes it from a request that nobody will answer",
        "message": mistaken_notification,
    })

    null_id_request = {
        "jsonrpc": "2.0",
        "id": None,
        "method": "tools/call",
        "params": {
            "name": "get_weather",
            "arguments": {"location": "Pune"},
            "_meta": {
                PV_KEY: PROTOCOL_VERSION,
                CAPS_KEY: {},
                CLIENT_INFO_KEY: {"name": "lesson-client", "version": "1.0.0"},
            },
        },
    }
    log.append({
        "violation": "a request id must never be null, even when every other field is well formed",
        "message": null_id_request,
    })

    meta_less_request = {
        "jsonrpc": "2.0",
        "id": 3,
        "method": "tools/call",
        "params": {"name": "get_weather", "arguments": {"location": "Pune"}},
    }
    log.append({
        "violation": "a request without _meta cannot be processed; the server has no protocol version or capabilities to reason about",
        "message": meta_less_request,
    })
    log.append(handle_request(meta_less_request))

    return log


def transcript() -> list[Any]:
    return run_scenario()


def demo() -> None:
    print("classifying raw JSON-RPC messages")
    samples = [
        ("request", {"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {}}),
        ("notification", {"jsonrpc": "2.0", "method": "notifications/progress", "params": {}}),
        ("result", {"jsonrpc": "2.0", "id": 1, "result": {"resultType": "complete"}}),
        ("error", {"jsonrpc": "2.0", "id": 1, "error": {"code": INVALID_PARAMS, "message": "bad"}}),
        ("null id request", {"jsonrpc": "2.0", "id": None, "method": "tools/call", "params": {}}),
    ]
    for label, message in samples:
        print(f"  {label:16s} -> {classify_message(message)}")

    print("\nchecking _meta key names against the prefix rules")
    keys = [
        "io.modelcontextprotocol/protocolVersion",
        "dev.mcp/experimentalHint",
        "com.example.mcp/scanId",
        "com.example/scanId",
        "progressToken",
        "traceparent",
        "9invalid/name",
    ]
    for key in keys:
        print(f"  {key:42s} -> {meta_key_status(key)}")

    print("\nrunning the envelope demo scenario")
    for message in run_scenario():
        if isinstance(message, dict) and "violation" in message:
            print(f"  [violation] {message['violation']}")
            print("    " + json.dumps(message["message"], sort_keys=True)[:140])
        else:
            print("  " + json.dumps(message, sort_keys=True)[:140])


if __name__ == "__main__":
    demo()
