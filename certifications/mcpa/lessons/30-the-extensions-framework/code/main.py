"""Companion code for:
certifications/mcpa/lessons/30-the-extensions-framework/docs/en.md
Negotiating optional MCP extensions per request, falling back to core behavior, and rejecting a
call that needs an extension neither side mutually activated.
Sources: SEP-2133; MCP extensions overview (extension negotiation).
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Callable


PROTOCOL_VERSION = "2026-07-28"
PV_KEY = "io.modelcontextprotocol/protocolVersion"
CAPS_KEY = "io.modelcontextprotocol/clientCapabilities"
CLIENT_INFO_KEY = "io.modelcontextprotocol/clientInfo"
SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo"

METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602
MISSING_REQUIRED_CLIENT_CAPABILITY = -32021
UNSUPPORTED_PROTOCOL_VERSION = -32022

PRIORITY_EXTENSION = "com.example/priority-routing"
EXPORT_EXTENSION = "com.example/bulk-export"


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


def is_well_formed_extension_id(identifier: Any) -> bool:
    if not isinstance(identifier, str) or identifier.count("/") != 1:
        return False
    prefix, name = identifier.split("/")
    return bool(prefix) and bool(name)


def negotiate_extensions(client_extensions: dict[str, dict], server_extensions: dict[str, dict]) -> dict[str, dict]:
    active: dict[str, dict] = {}
    for identifier, settings in client_extensions.items():
        if is_well_formed_extension_id(identifier) and identifier in server_extensions:
            active[identifier] = settings
    return active


def _summarize_incidents(arguments: dict, active: dict[str, dict]) -> dict:
    settings = active.get(PRIORITY_EXTENSION)
    if settings is None:
        return {"text": "3 open incidents", "data": {"open": 3}}
    tier = settings.get("tier", "standard")
    return {"text": f"3 open incidents, sorted for {tier} tier", "data": {"open": 3, "tier": tier}}


def _export_dataset(arguments: dict, active: dict[str, dict]) -> dict:
    dataset = arguments.get("dataset", "incidents")
    return {"text": f"Bulk export of {dataset} accepted as a background job.", "data": {"dataset": dataset, "accepted": True}}


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict
    handler: Callable[[dict, dict[str, dict]], dict]
    mandatory_extension: str | None = None

    def definition(self) -> dict:
        return {"name": self.name, "description": self.description, "inputSchema": self.input_schema}


@dataclass
class Server:
    name: str
    tools: dict[str, Tool] = field(default_factory=dict)
    extensions: dict[str, dict] = field(default_factory=dict)

    def add(self, tool: Tool) -> None:
        self.tools[tool.name] = tool

    def _server_meta(self) -> dict:
        return {SERVER_INFO_KEY: {"name": self.name, "version": "1.0.0"}}

    def handle(self, message: dict) -> dict:
        request_id = message.get("id")
        params = message.get("params") or {}
        meta = params.get("_meta") or {}
        if not isinstance(meta.get(PV_KEY), str) or not isinstance(meta.get(CAPS_KEY), dict):
            return make_error(request_id, INVALID_PARAMS, "Missing required _meta fields")
        if meta[PV_KEY] != PROTOCOL_VERSION:
            return make_error(
                request_id,
                UNSUPPORTED_PROTOCOL_VERSION,
                "Unsupported protocol version",
                {"supported": [PROTOCOL_VERSION], "requested": meta[PV_KEY]},
            )
        method = message.get("method")
        if method == "server/discover":
            return self._discover(request_id)
        if method == "tools/list":
            return self._list_tools(request_id)
        if method == "tools/call":
            return self._call(request_id, params, meta)
        return make_error(request_id, METHOD_NOT_FOUND, f"Method not found: {method}")

    def _discover(self, request_id: Any) -> dict:
        return make_result(
            request_id,
            supportedVersions=[PROTOCOL_VERSION],
            capabilities={"tools": {"listChanged": False}, "extensions": dict(self.extensions)},
            ttlMs=300000,
            cacheScope="public",
            _meta=self._server_meta(),
        )

    def _list_tools(self, request_id: Any) -> dict:
        tools = [self.tools[name].definition() for name in sorted(self.tools)]
        return make_result(request_id, tools=tools, ttlMs=300000, cacheScope="public", _meta=self._server_meta())

    def _call(self, request_id: Any, params: dict, meta: dict) -> dict:
        name = params.get("name")
        tool = self.tools.get(name)
        if tool is None:
            return make_error(request_id, INVALID_PARAMS, f"Unknown tool: {name}")
        client_extensions = (meta.get(CAPS_KEY) or {}).get("extensions") or {}
        active = negotiate_extensions(client_extensions, self.extensions)
        if tool.mandatory_extension and tool.mandatory_extension not in active:
            return make_error(
                request_id,
                MISSING_REQUIRED_CLIENT_CAPABILITY,
                "Missing required client capability",
                {"requiredCapabilities": {"extensions": {tool.mandatory_extension: {}}}},
            )
        arguments = params.get("arguments") or {}
        output = tool.handler(arguments, active)
        return make_result(
            request_id,
            content=[{"type": "text", "text": output["text"]}],
            structuredContent=output["data"],
            isError=False,
            _meta=self._server_meta(),
        )


def build_server() -> Server:
    server = Server("ops")
    server.extensions = {PRIORITY_EXTENSION: {}, EXPORT_EXTENSION: {}}
    server.add(Tool(
        name="summarize_incidents",
        description="Summarize open incidents, ranked by priority tier when the priority-routing extension is active.",
        input_schema={"type": "object", "additionalProperties": False},
        handler=_summarize_incidents,
    ))
    server.add(Tool(
        name="export_dataset",
        description="Export a full dataset as a background job. Needs the bulk-export extension to hand back a job.",
        input_schema={"type": "object", "properties": {"dataset": {"type": "string"}}, "required": []},
        handler=_export_dataset,
        mandatory_extension=EXPORT_EXTENSION,
    ))
    return server


class Client:
    def __init__(self, server: Server) -> None:
        self.server = server
        self.next_id = 0
        self.log: list[dict] = []

    def send(self, method: str, params: dict | None = None, capabilities: dict | None = None,
              version: str = PROTOCOL_VERSION) -> dict:
        self.next_id += 1
        request = make_request(self.next_id, method, params, capabilities, version)
        response = self.server.handle(request)
        self.log.extend([request, response])
        return response


def run_scenario() -> Client:
    server = build_server()
    client = Client(server)

    client.send("server/discover")

    client.send("tools/call", {"name": "summarize_incidents", "arguments": {}})
    client.send(
        "tools/call", {"name": "summarize_incidents", "arguments": {}},
        capabilities={"extensions": {PRIORITY_EXTENSION: {}}},
    )
    client.send(
        "tools/call", {"name": "summarize_incidents", "arguments": {}},
        capabilities={"extensions": {PRIORITY_EXTENSION: {"tier": "gold"}}},
    )

    client.send("tools/call", {"name": "export_dataset", "arguments": {"dataset": "incidents"}})
    client.send(
        "tools/call", {"name": "export_dataset", "arguments": {"dataset": "incidents"}},
        capabilities={"extensions": {EXPORT_EXTENSION: {}}},
    )

    client.send(
        "tools/call", {"name": "summarize_incidents", "arguments": {}},
        capabilities={"extensions": {"no-slash-here": {}, PRIORITY_EXTENSION: {"tier": "silver"}}},
    )

    client.send("tools/call", {"name": "purge_everything", "arguments": {}})

    return client


def transcript() -> list[dict]:
    return run_scenario().log


def demo() -> None:
    client = run_scenario()
    print("extension negotiation: com.example/priority-routing (optional) and com.example/bulk-export (mandatory)")
    for message in client.log:
        print("  " + json.dumps(message, sort_keys=True)[:200])


if __name__ == "__main__":
    demo()
