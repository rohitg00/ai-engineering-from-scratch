"""Companion code for:
certifications/mcpa/lessons/06-hosts-clients-and-servers/docs/en.md
A host aggregates three servers behind one collision-safe tool registry.
Sources: MCP 2026-07-28 architecture overview and Tools pages (tool name collisions).
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


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict
    handler: Callable[[dict], str]

    def definition(self) -> dict:
        return {"name": self.name, "description": self.description, "inputSchema": self.input_schema}


@dataclass
class Server:
    name: str
    transport: str
    capabilities: dict
    tools: dict[str, Tool] = field(default_factory=dict)

    def add(self, tool: Tool) -> None:
        self.tools[tool.name] = tool

    def _server_meta(self) -> dict:
        return {SERVER_INFO_KEY: {"name": self.name, "version": "1.0.0"}}

    def handle(self, message: dict) -> dict:
        request_id = message.get("id")
        params = message.get("params") or {}
        meta = params.get("_meta") or {}
        if PV_KEY not in meta or CAPS_KEY not in meta:
            return make_error(request_id, INVALID_PARAMS, "Missing required _meta fields")
        method = message.get("method")
        if method == "server/discover":
            return make_result(
                request_id,
                supportedVersions=[PROTOCOL_VERSION],
                capabilities=self.capabilities,
                ttlMs=300000,
                cacheScope="public",
                _meta=self._server_meta(),
            )
        if method == "tools/list":
            tools = [self.tools[name].definition() for name in sorted(self.tools)]
            return make_result(request_id, tools=tools, ttlMs=300000, cacheScope="public", _meta=self._server_meta())
        if method == "tools/call":
            return self._call(request_id, params)
        return make_error(request_id, METHOD_NOT_FOUND, f"Method not found: {method}")

    def _call(self, request_id: Any, params: dict) -> dict:
        name = params.get("name")
        tool = self.tools.get(name)
        if tool is None:
            return make_error(request_id, INVALID_PARAMS, f"Unknown tool: {name}")
        arguments = params.get("arguments") or {}
        missing = [key for key in tool.input_schema.get("required", []) if key not in arguments]
        if missing:
            return make_result(
                request_id,
                content=[{"type": "text", "text": f"Missing required argument: {', '.join(missing)}. Provide it and call again."}],
                isError=True,
                _meta=self._server_meta(),
            )
        return make_result(
            request_id,
            content=[{"type": "text", "text": tool.handler(arguments)}],
            isError=False,
            _meta=self._server_meta(),
        )


class Client:
    def __init__(self, server_id: str, server: Server) -> None:
        self.server_id = server_id
        self.server = server
        self.next_id = 0
        self.log: list[dict] = []
        self.capabilities: dict | None = None
        self.server_info: dict | None = None

    def send(self, method: str, params: dict | None = None) -> dict:
        self.next_id += 1
        request = make_request(self.next_id, method, params)
        response = self.server.handle(request)
        self.log.extend([request, response])
        return response

    def discover(self) -> dict:
        result = self.send("server/discover")["result"]
        self.capabilities = result["capabilities"]
        self.server_info = result["_meta"][SERVER_INFO_KEY]
        return result

    def list_tools(self) -> list[dict]:
        return self.send("tools/list")["result"]["tools"]

    def call(self, name: str, arguments: dict) -> dict:
        return self.send("tools/call", {"name": name, "arguments": arguments})


@dataclass
class Host:
    connections: dict[str, Client] = field(default_factory=dict)
    registry: dict[str, tuple[str, str]] = field(default_factory=dict)

    def connect(self, server_id: str, server: Server) -> Client:
        client = Client(server_id, server)
        client.discover()
        self.connections[server_id] = client
        return client

    def build_registry(self) -> dict[str, tuple[str, str]]:
        registry: dict[str, tuple[str, str]] = {}
        for server_id in sorted(self.connections):
            client = self.connections[server_id]
            if not client.capabilities or "tools" not in client.capabilities:
                continue
            for tool in client.list_tools():
                name = tool["name"]
                key = name if name not in registry else f"{server_id}/{name}"
                registry[key] = (server_id, name)
        self.registry = registry
        return registry

    def route(self, tool_name: str, arguments: dict) -> dict:
        target = self.registry.get(tool_name)
        if target is None:
            raise KeyError(f"no connected server registered tool {tool_name!r}")
        server_id, local_name = target
        return self.connections[server_id].call(local_name, arguments)


def build_files_server() -> Server:
    server = Server(name="primary", transport="stdio", capabilities={"tools": {"listChanged": False}})
    server.add(Tool(
        name="read_file",
        description="Return the contents of a file by path.",
        input_schema={"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]},
        handler=lambda args: f"files: {args['path']} -> 128 bytes",
    ))
    server.add(Tool(
        name="search",
        description="Search indexed files for a query.",
        input_schema={"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]},
        handler=lambda args: f"files: 2 files match {args['query']!r}",
    ))
    return server


def build_notes_server() -> Server:
    server = Server(name="primary", transport="stdio", capabilities={"tools": {"listChanged": False}})
    server.add(Tool(
        name="save_note",
        description="Save a short note and return its id.",
        input_schema={"type": "object", "properties": {"title": {"type": "string"}}, "required": ["title"]},
        handler=lambda args: f"notes: saved {args['title']!r} as NOTE-9",
    ))
    server.add(Tool(
        name="search",
        description="Search saved notes for a query.",
        input_schema={"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]},
        handler=lambda args: f"notes: 1 note matches {args['query']!r}",
    ))
    return server


def build_metrics_server() -> Server:
    return Server(
        name="metrics-svc",
        transport="streamable-http",
        capabilities={"resources": {"listChanged": False, "subscribe": False}},
    )


def build_host() -> tuple[Host, Client, Client, Client]:
    host = Host()
    files_client = host.connect("files", build_files_server())
    notes_client = host.connect("notes", build_notes_server())
    metrics_client = host.connect("metrics", build_metrics_server())
    host.build_registry()
    return host, files_client, notes_client, metrics_client


def run_scenario() -> tuple[Host, Client, Client, Client]:
    host, files_client, notes_client, metrics_client = build_host()
    host.route("search", {"query": "onboarding checklist"})
    host.route("notes/search", {"query": "onboarding checklist"})
    host.route("save_note", {"title": "call Sam back"})
    host.route("save_note", {})
    notes_client.call("delete_note", {})
    return host, files_client, notes_client, metrics_client


def transcript() -> list[dict]:
    _, files_client, notes_client, metrics_client = run_scenario()
    return files_client.log + notes_client.log + metrics_client.log


def demo() -> None:
    host, files_client, notes_client, metrics_client = run_scenario()
    print("connections: host-assigned id -> serverInfo.name (transport)")
    for server_id in sorted(host.connections):
        client = host.connections[server_id]
        print(f"  {server_id:8s} -> {client.server_info['name']!r} ({client.server.transport})")
    print("\naggregated tool registry: canonical/prefixed name -> (server_id, local name)")
    for key in sorted(host.registry):
        print(f"  {key:16s} -> {host.registry[key]}")
    for label, client in (("files", files_client), ("notes", notes_client), ("metrics", metrics_client)):
        print(f"\n{label} client exchanges")
        for message in client.log:
            print("  " + json.dumps(message, sort_keys=True)[:160])


if __name__ == "__main__":
    demo()
