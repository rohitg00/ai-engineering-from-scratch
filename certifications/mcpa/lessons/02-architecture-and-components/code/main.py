"""MCP architecture and components, modeled with the standard library.

A runnable mock of the process topology the MCPA exam's "Architecture and
Components" domain describes: one host process that embeds two clients,
each client holding exactly one connection to exactly one server process.
There is no network and no SDK, so the exchange is deterministic and
portable, but the message shapes are the real JSON-RPC 2.0 envelopes that
MCP 2026-07-28 uses. See docs/en.md for the walkthrough.

Run: python3 code/main.py
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Callable


PROTOCOL_VERSION = "2026-07-28"

METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602
INVALID_REQUEST = -32600
# -32000 to -32099 is the JSON-RPC reserved range for implementation-defined
# server errors; a protocol version mismatch during initialize lives here.
VERSION_MISMATCH = -32050


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict[str, Any]
    handler: Callable[[dict[str, Any]], Any]


@dataclass
class MockServer:
    """A separate process: it declares its own version and capabilities,
    then advertises and runs the tools it registers."""

    name: str
    protocol_version: str = PROTOCOL_VERSION
    capabilities: dict[str, Any] = field(default_factory=lambda: {"tools": {"listChanged": False}})
    tools: dict[str, Tool] = field(default_factory=dict)

    def register(self, tool: Tool) -> None:
        self.tools[tool.name] = tool

    def handle(self, request: dict[str, Any]) -> dict[str, Any]:
        if request.get("jsonrpc") != "2.0" or "method" not in request or "id" not in request:
            return _error(request.get("id"), INVALID_REQUEST, "not a JSON-RPC 2.0 request")
        method = request["method"]
        params = request.get("params", {})
        if method == "initialize":
            requested = params.get("protocolVersion")
            if requested != self.protocol_version:
                return _error(
                    request["id"],
                    VERSION_MISMATCH,
                    f"server speaks {self.protocol_version!r}, client requested {requested!r}",
                )
            return _result(request["id"], {
                "protocolVersion": self.protocol_version,
                "serverInfo": {"name": self.name},
                "capabilities": self.capabilities,
            })
        if method == "tools/list":
            return _result(request["id"], {
                "tools": [
                    {"name": tool.name, "description": tool.description, "inputSchema": tool.input_schema}
                    for tool in self.tools.values()
                ]
            })
        if method == "tools/call":
            name = params.get("name")
            if name not in self.tools:
                return _error(request["id"], METHOD_NOT_FOUND, f"unknown tool: {name!r}")
            arguments = params.get("arguments", {})
            required = self.tools[name].input_schema.get("required", [])
            missing = [key for key in required if key not in arguments]
            if missing:
                return _error(request["id"], INVALID_PARAMS, f"missing arguments: {missing}")
            value = self.tools[name].handler(arguments)
            return _result(request["id"], {"content": [{"type": "text", "text": str(value)}]})
        return _error(request["id"], METHOD_NOT_FOUND, f"unknown method: {method!r}")


@dataclass
class MockClient:
    """A client inside a host: it owns exactly one connection to exactly
    one server, and its own request id sequence belongs to that connection
    alone."""

    server: MockServer
    server_info: dict[str, Any] | None = field(default=None, init=False)
    capabilities: dict[str, Any] | None = field(default=None, init=False)
    _next_id: int = field(default=1, init=False)

    def _request(self, method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        request = {"jsonrpc": "2.0", "id": self._next_id, "method": method}
        if params is not None:
            request["params"] = params
        self._next_id += 1
        return self.server.handle(request)

    def initialize(self) -> dict[str, Any]:
        response = self._request("initialize", {"protocolVersion": PROTOCOL_VERSION})
        if "result" in response:
            self.server_info = response["result"]["serverInfo"]
            self.capabilities = response["result"]["capabilities"]
        return response

    def list_tools(self) -> list[dict[str, Any]]:
        return self._request("tools/list")["result"]["tools"]

    def call_tool(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        return self._request("tools/call", {"name": name, "arguments": arguments})


@dataclass
class Host:
    """The application the user interacts with; it embeds one or more
    clients, one per connected server."""

    clients: dict[str, MockClient] = field(default_factory=dict)

    def connect(self, client: MockClient) -> dict[str, Any]:
        """Perform the handshake for one connection. A successful handshake
        registers the client under its server's name; a failed one (for
        example a version mismatch) is reported back and never registered."""
        handshake = client.initialize()
        if "result" in handshake:
            self.clients[client.server.name] = client
        return handshake

    def tool_directory(self) -> dict[str, str]:
        """Map every tool name discovered across all connected servers to
        the name of the server that declared it."""
        directory: dict[str, str] = {}
        for server_name, client in self.clients.items():
            for tool in client.list_tools():
                directory[tool["name"]] = server_name
        return directory

    def route_tool_call(self, tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        """Send a tools/call to whichever connected server declared this
        tool. An unrecognized tool name fails the same structured way a
        server-side error would, rather than raising."""
        server_name = self.tool_directory().get(tool_name)
        if server_name is None:
            return _error(None, METHOD_NOT_FOUND, f"no connected server offers tool {tool_name!r}")
        return self.clients[server_name].call_tool(tool_name, arguments)


def _result(request_id: Any, result: Any) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


def _error(request_id: Any, code: int, message: str) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}


def build_files_server() -> MockServer:
    server = MockServer(name="files", capabilities={"tools": {"listChanged": False}})
    server.register(Tool(
        name="read_file",
        description="Return the contents of a file by path.",
        input_schema={"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]},
        handler=lambda args: f"files: {args['path']} -> 42 bytes",
    ))
    return server


def build_search_server() -> MockServer:
    server = MockServer(name="search", capabilities={"tools": {"listChanged": True}, "resources": {}})
    server.register(Tool(
        name="web_search",
        description="Return a short result snippet for a query.",
        input_schema={"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]},
        handler=lambda args: f"search: {args['query']} -> 3 results",
    ))
    return server


def build_mismatched_server() -> MockServer:
    """A server stuck on an older protocol release, to demonstrate that a
    version mismatch is reported as an error, not a crash."""
    return MockServer(name="legacy", protocol_version="2025-01-01")


def demo() -> None:
    host = Host()

    files_handshake = host.connect(MockClient(server=build_files_server()))
    print("connect files ->", json.dumps(files_handshake["result"], indent=None))

    search_handshake = host.connect(MockClient(server=build_search_server()))
    print("connect search ->", json.dumps(search_handshake["result"], indent=None))

    print("connected servers ->", sorted(host.clients))

    directory = host.tool_directory()
    print("tool directory ->", json.dumps(directory, indent=None))

    read = host.route_tool_call("read_file", {"path": "notes.txt"})
    print("route read_file ->", json.dumps(read["result"], indent=None))

    search = host.route_tool_call("web_search", {"query": "process topology"})
    print("route web_search ->", json.dumps(search["result"], indent=None))

    missing = host.route_tool_call("delete_everything", {})
    print("route unknown tool ->", json.dumps(missing["error"], indent=None))

    mismatch = host.connect(MockClient(server=build_mismatched_server()))
    print("connect legacy (mismatch) ->", json.dumps(mismatch["error"], indent=None))
    print("connected servers after mismatch ->", sorted(host.clients))


if __name__ == "__main__":
    demo()
