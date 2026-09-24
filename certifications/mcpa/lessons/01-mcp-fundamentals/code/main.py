"""MCP fundamentals, modeled with the standard library.

A runnable mock of the four MCP roles and the message flow the MCPA exam's
"MCP Fundamentals" domain describes. There is no network and no SDK, so the
exchange is deterministic and portable, but the message shapes are the real
JSON-RPC 2.0 envelopes that MCP 2026-07-28 uses. See docs/en.md for the
walkthrough.

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


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict[str, Any]
    handler: Callable[[dict[str, Any]], Any]


@dataclass
class MockServer:
    """A minimal MCP server: it advertises tools and runs them on request."""

    name: str
    tools: dict[str, Tool] = field(default_factory=dict)

    def register(self, tool: Tool) -> None:
        self.tools[tool.name] = tool

    def handle(self, request: dict[str, Any]) -> dict[str, Any]:
        if request.get("jsonrpc") != "2.0" or "method" not in request or "id" not in request:
            return _error(request.get("id"), INVALID_REQUEST, "not a JSON-RPC 2.0 request")
        method = request["method"]
        params = request.get("params", {})
        if method == "initialize":
            return _result(request["id"], {
                "protocolVersion": PROTOCOL_VERSION,
                "serverInfo": {"name": self.name},
                "capabilities": {"tools": {"listChanged": False}},
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
    """A client inside a host: it owns one connection to one server."""

    server: MockServer
    _next_id: int = 1

    def _request(self, method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        request = {"jsonrpc": "2.0", "id": self._next_id, "method": method}
        if params is not None:
            request["params"] = params
        self._next_id += 1
        return self.server.handle(request)

    def initialize(self) -> dict[str, Any]:
        return self._request("initialize", {"protocolVersion": PROTOCOL_VERSION})

    def list_tools(self) -> list[dict[str, Any]]:
        return self._request("tools/list")["result"]["tools"]

    def call_tool(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        return self._request("tools/call", {"name": name, "arguments": arguments})


def _result(request_id: Any, result: Any) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


def _error(request_id: Any, code: int, message: str) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}


def build_weather_server() -> MockServer:
    server = MockServer(name="weather")
    server.register(Tool(
        name="get_forecast",
        description="Return a short forecast for a city.",
        input_schema={"type": "object", "properties": {"city": {"type": "string"}}, "required": ["city"]},
        handler=lambda args: f"{args['city']}: clear, 21C",
    ))
    return server


def demo() -> None:
    client = MockClient(server=build_weather_server())

    handshake = client.initialize()
    print("initialize ->", json.dumps(handshake["result"], indent=None))

    tools = client.list_tools()
    print("tools/list ->", json.dumps(tools, indent=None))

    ok = client.call_tool("get_forecast", {"city": "Amsterdam"})
    print("tools/call ->", json.dumps(ok["result"], indent=None))

    unknown = client.call_tool("delete_everything", {})
    print("unknown tool ->", json.dumps(unknown["error"], indent=None))


if __name__ == "__main__":
    demo()
