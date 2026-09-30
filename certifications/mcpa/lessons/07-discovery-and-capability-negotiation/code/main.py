"""Companion code for:
certifications/mcpa/lessons/07-discovery-and-capability-negotiation/docs/en.md
The server/discover request and per-request capability negotiation.
Sources: MCP 2026-07-28 server/discover and versioning pages; SEP-2575.
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

INVALID_PARAMS = -32602
METHOD_NOT_FOUND = -32601
MISSING_REQUIRED_CLIENT_CAPABILITY = -32021
UNSUPPORTED_PROTOCOL_VERSION = -32022


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


SERVER_CAPABILITIES: dict[str, Any] = {
    "tools": {"listChanged": False},
    "resources": {"listChanged": False, "subscribe": False},
    "prompts": {"listChanged": False},
    "completions": {},
    "logging": {},
    "extensions": {},
}

TOOLS: dict[str, dict[str, Any]] = {
    "notify_oncall": {
        "requires": {"elicitation": {}},
    },
    "list_incidents": {
        "requires": {},
    },
}


@dataclass
class DeployServer:
    name: str = "deploy-console"
    version: str = "2.4.0"

    def _server_meta(self) -> dict:
        return {SERVER_INFO_KEY: {"name": self.name, "version": self.version}}

    def handle(self, message: dict) -> dict:
        request_id = message.get("id")
        method = message.get("method")
        params = message.get("params") or {}
        meta = params.get("_meta") or {}
        if PV_KEY not in meta or CAPS_KEY not in meta:
            return make_error(request_id, INVALID_PARAMS, "Missing required _meta fields")
        if meta[PV_KEY] != PROTOCOL_VERSION:
            return make_error(
                request_id,
                UNSUPPORTED_PROTOCOL_VERSION,
                "Unsupported protocol version",
                {"supported": [PROTOCOL_VERSION], "requested": meta[PV_KEY]},
            )
        if method == "server/discover":
            return self._discover(request_id)
        if method == "tools/call":
            return self._call(request_id, params, meta[CAPS_KEY])
        return make_error(request_id, METHOD_NOT_FOUND, f"Method not found: {method}")

    def _discover(self, request_id: Any) -> dict:
        return make_result(
            request_id,
            supportedVersions=[PROTOCOL_VERSION],
            capabilities=SERVER_CAPABILITIES,
            instructions="Call notify_oncall only when the caller can accept a follow-up confirmation.",
            ttlMs=3600000,
            cacheScope="public",
            _meta=self._server_meta(),
        )

    def _call(self, request_id: Any, params: dict, client_capabilities: dict) -> dict:
        name = params.get("name")
        tool = TOOLS.get(name)
        if tool is None:
            return make_error(request_id, INVALID_PARAMS, f"Unknown tool: {name}")
        missing = {key: value for key, value in tool["requires"].items() if key not in client_capabilities}
        if missing:
            return make_error(
                request_id,
                MISSING_REQUIRED_CLIENT_CAPABILITY,
                f"{name} requires a capability this request did not declare",
                {"requiredCapabilities": missing},
            )
        arguments = params.get("arguments") or {}
        message_text = arguments.get("message", "no message supplied")
        return make_result(
            request_id,
            content=[{"type": "text", "text": f"{name} ok: {message_text}"}],
            isError=False,
            _meta=self._server_meta(),
        )


class Client:
    def __init__(self, server: DeployServer) -> None:
        self.server = server
        self.next_id = 0
        self.log: list[dict] = []

    def send(self, method: str, params: dict | None = None, capabilities: dict | None = None,
             version: str = PROTOCOL_VERSION) -> dict:
        self.next_id += 1
        request = make_request(self.next_id, method, params, capabilities=capabilities, version=version)
        response = self.server.handle(request)
        self.log.extend([request, response])
        return response

    def discover(self, version: str = PROTOCOL_VERSION) -> dict:
        return self.send("server/discover", version=version)

    def call(self, name: str, arguments: dict, capabilities: dict | None = None) -> dict:
        return self.send("tools/call", {"name": name, "arguments": arguments}, capabilities=capabilities)


def run_scenario() -> Client:
    client = Client(DeployServer())
    client.discover()
    client.call("notify_oncall", {"message": "database failover started"}, capabilities={})
    client.call("notify_oncall", {"message": "database failover started"}, capabilities={"elicitation": {"form": {}}})
    client.call("close_all_incidents", {}, capabilities={"elicitation": {"form": {}}})
    mismatch = client.discover(version="2025-11-25")
    supported_version = mismatch["error"]["data"]["supported"][0]
    client.discover(version=supported_version)
    return client


def transcript() -> list[dict]:
    return run_scenario().log


def demo() -> None:
    client = run_scenario()
    print("server/discover once, then per-request capability negotiation on every tools/call")
    for message in client.log:
        print("  " + json.dumps(message, sort_keys=True)[:200])


if __name__ == "__main__":
    demo()
