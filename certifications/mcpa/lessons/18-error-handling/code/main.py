"""Companion code for:
certifications/mcpa/lessons/18-error-handling/docs/en.md
An error classifier and responder that refuses legacy and retired JSON-RPC codes.
Sources: JSON-RPC 2.0; SEP-1303; SEP-2164; MCP 2026-07-28 error code allocation.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any


PROTOCOL_VERSION = "2026-07-28"
PV_KEY = "io.modelcontextprotocol/protocolVersion"
CAPS_KEY = "io.modelcontextprotocol/clientCapabilities"
CLIENT_INFO_KEY = "io.modelcontextprotocol/clientInfo"
SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo"

PARSE_ERROR = -32700
INVALID_REQUEST = -32600
METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602
INTERNAL_ERROR = -32603
HEADER_MISMATCH = -32020
MISSING_REQUIRED_CLIENT_CAPABILITY = -32021
UNSUPPORTED_PROTOCOL_VERSION = -32022

STANDARD_CODES = {PARSE_ERROR, INVALID_REQUEST, METHOD_NOT_FOUND, INVALID_PARAMS, INTERNAL_ERROR}
DEFINED_RESERVED_CODES = {HEADER_MISMATCH, MISSING_REQUIRED_CLIENT_CAPABILITY, UNSUPPORTED_PROTOCOL_VERSION}

HTTP_STATUS_FOR_CODE: dict[int, int] = {
    METHOD_NOT_FOUND: 404,
    INVALID_PARAMS: 400,
    HEADER_MISMATCH: 400,
    MISSING_REQUIRED_CLIENT_CAPABILITY: 400,
    UNSUPPORTED_PROTOCOL_VERSION: 400,
}

HTTP_STATUS_FOR_TRANSPORT_EVENT: dict[str, int] = {
    "notification_accepted": 202,
    "get_or_delete_to_mcp_endpoint": 405,
    "missing_or_invalid_token": 401,
    "insufficient_scope": 403,
}


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


class ForbiddenErrorCode(ValueError):
    pass


def is_forbidden_error_code(code: int) -> bool:
    if -32019 <= code <= -32000:
        return True
    if -32099 <= code <= -32020 and code not in DEFINED_RESERVED_CODES:
        return True
    return False


def safe_error(request_id: Any, code: int, message: str, data: Any = None) -> dict:
    if is_forbidden_error_code(code):
        raise ForbiddenErrorCode(
            f"refusing to put {code} on the wire: it is outside the 2026-07-28 allocation policy for new implementations"
        )
    return make_error(request_id, code, message, data)


def parse_client_message(raw: str) -> dict:
    try:
        return json.loads(raw)
    except ValueError:
        return safe_error(None, PARSE_ERROR, "Parse error: request body was not valid JSON")


TOOLS: dict[str, dict[str, Any]] = {
    "close_ticket": {
        "requires": {},
        "required_args": ("ticket_id", "resolution"),
        "enum": {"resolution": ("fixed", "wontfix", "duplicate")},
    },
    "archive_workspace": {
        "requires": {"elicitation": {}},
        "required_args": ("workspace_id",),
        "enum": {},
    },
}


@dataclass
class Server:
    name: str = "helpdesk"
    version: str = "1.4.0"

    def _server_meta(self) -> dict:
        return {SERVER_INFO_KEY: {"name": self.name, "version": self.version}}

    def handle(self, message: dict) -> dict:
        request_id = message.get("id")
        method = message.get("method")
        params = message.get("params") or {}
        meta = params.get("_meta") or {}
        if PV_KEY not in meta or CAPS_KEY not in meta:
            return safe_error(request_id, INVALID_PARAMS, "Missing required _meta fields")
        if meta[PV_KEY] != PROTOCOL_VERSION:
            return safe_error(
                request_id,
                UNSUPPORTED_PROTOCOL_VERSION,
                "Unsupported protocol version",
                {"supported": [PROTOCOL_VERSION], "requested": meta[PV_KEY]},
            )
        if method == "server/discover":
            return make_result(
                request_id,
                supportedVersions=[PROTOCOL_VERSION],
                capabilities={"tools": {"listChanged": False}},
                ttlMs=300000,
                cacheScope="public",
                _meta=self._server_meta(),
            )
        if method == "tools/list":
            tools = [{"name": name, "inputSchema": {"type": "object"}} for name in sorted(TOOLS)]
            return make_result(request_id, tools=tools, ttlMs=300000, cacheScope="public", _meta=self._server_meta())
        if method == "tools/call":
            return self._call(request_id, params, meta[CAPS_KEY])
        return safe_error(request_id, METHOD_NOT_FOUND, f"Method not found: {method}")

    def _call(self, request_id: Any, params: dict, client_capabilities: dict) -> dict:
        name = params.get("name")
        tool = TOOLS.get(name)
        if tool is None:
            return safe_error(request_id, INVALID_PARAMS, f"Unknown tool: {name}")
        missing_caps = {key: value for key, value in tool["requires"].items() if key not in client_capabilities}
        if missing_caps:
            return safe_error(
                request_id,
                MISSING_REQUIRED_CLIENT_CAPABILITY,
                f"{name} requires a capability this request did not declare",
                {"requiredCapabilities": missing_caps},
            )
        arguments = params.get("arguments") or {}
        problem = self._validate(name, tool, arguments)
        if problem is not None:
            return make_result(request_id, content=[{"type": "text", "text": problem}], isError=True, _meta=self._server_meta())
        return make_result(
            request_id,
            content=[{"type": "text", "text": f"{name} ok"}],
            structuredContent={"tool": name, "arguments": arguments},
            isError=False,
            _meta=self._server_meta(),
        )

    def _validate(self, name: str, tool: dict, arguments: dict) -> str | None:
        for key in tool["required_args"]:
            if key not in arguments:
                return f"{key} is required for {name}"
        for key, allowed in tool["enum"].items():
            if key in arguments and arguments[key] not in allowed:
                return f"{key} must be one of {', '.join(allowed)}, got {arguments[key]!r}"
        return None


class Client:
    def __init__(self, server: Server) -> None:
        self.server = server
        self.next_id = 0
        self.log: list[Any] = []

    def send(self, method: str, params: dict | None = None, capabilities: dict | None = None,
             version: str = PROTOCOL_VERSION) -> dict:
        self.next_id += 1
        request = make_request(self.next_id, method, params, capabilities=capabilities, version=version)
        response = self.server.handle(request)
        self.log.extend([request, response])
        return response

    def call(self, name: str, arguments: dict, capabilities: dict | None = None) -> dict:
        return self.send("tools/call", {"name": name, "arguments": arguments}, capabilities=capabilities)


def wrap_errors_with_http_status(entries: list[Any]) -> list[Any]:
    wrapped: list[Any] = []
    for entry in entries:
        if isinstance(entry, dict) and "jsonrpc" in entry and "error" in entry:
            status = HTTP_STATUS_FOR_CODE.get(entry["error"].get("code"))
            if status is not None:
                wrapped.append({"http": {"status": status}, "message": entry})
                continue
        wrapped.append(entry)
    return wrapped


def run_scenario() -> Client:
    client = Client(Server())
    client.send("server/discover")
    client.send("tools/list")
    client.call("close_ticket", {"ticket_id": "TCK-42", "resolution": "fixed"})
    client.call("close_ticket", {"ticket_id": "TCK-42"})
    client.call("close_ticket", {"ticket_id": "TCK-42", "resolution": "escalate"})
    client.call("delete_everything", {})
    client.call("archive_workspace", {"workspace_id": "ws-1"}, capabilities={})
    client.call("archive_workspace", {"workspace_id": "ws-1"}, capabilities={"elicitation": {}})
    client.send("resources/list")
    client.send("tools/list", version="2024-11-05")

    malformed_request = {"jsonrpc": "2.0", "id": 999, "method": "tools/list", "params": {}}
    client.log.append({
        "violation": "a request without _meta carries no protocol version or client capabilities, so the server has nothing to check the request against",
        "message": malformed_request,
    })
    client.log.append(client.server.handle(malformed_request))

    client.log = wrap_errors_with_http_status(client.log)

    client.log.append(parse_client_message("{not valid json"))

    client.log.append({
        "violation": "-32001 sits in the -32000 to -32019 legacy sub-range that new implementations must not use; safe_error refuses it, and a 2026-07-28 server reports a failed tool call as isError instead of inventing a code",
        "message": make_error(101, -32001, "Tool call failed"),
    })
    client.log.append({
        "violation": "-32002 was the resource-not-found code before 2026-07-28 (SEP-2164); this revision replaces it with -32602, and safe_error refuses to emit -32002",
        "message": make_error(102, -32002, "Resource not found", {"uri": "file:///missing.txt"}),
    })

    return client


def transcript() -> list[Any]:
    return run_scenario().log


def demo() -> None:
    client = run_scenario()
    print("error classifier and responder: protocol errors, tool execution errors, and the codes each channel may use")
    for entry in client.log:
        if isinstance(entry, dict) and "violation" in entry:
            print("  [violation] " + entry["violation"])
            print("    " + json.dumps(entry["message"], sort_keys=True)[:160])
        elif isinstance(entry, dict) and "http" in entry:
            print(f"  [http {entry['http']['status']}] " + json.dumps(entry["message"], sort_keys=True)[:160])
        else:
            print("  " + json.dumps(entry, sort_keys=True)[:160])
    print()
    print("transport events outside the JSON-RPC error taxonomy:")
    for event, status in sorted(HTTP_STATUS_FOR_TRANSPORT_EVENT.items()):
        print(f"  {event}: HTTP {status}")
    print()
    for code in (-32001, -32002, -32042, -32090):
        try:
            safe_error(0, code, "demo")
        except ForbiddenErrorCode as exc:
            print(f"guard refused {code}: {exc}")


if __name__ == "__main__":
    demo()
