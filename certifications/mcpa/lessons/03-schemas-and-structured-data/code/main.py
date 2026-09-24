"""Tool schemas and structured data, modeled with the standard library.

A runnable mock of an MCP tool's inputSchema and the validation a conformant
server performs before a tools/call handler ever runs. It extends the mock
from certifications/mcpa/lessons/01-mcp-fundamentals with a small JSON Schema
validator covering object type, typed properties, a required array, and
enum. There is no network and no SDK, so the exchange is deterministic and
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

_SCHEMA_TYPES: dict[str, tuple[type, ...]] = {
    "string": (str,),
    "integer": (int,),
    "number": (int, float),
    "boolean": (bool,),
    "array": (list,),
    "object": (dict,),
}


def _matches_type(value: Any, expected: str) -> bool:
    python_types = _SCHEMA_TYPES.get(expected)
    if python_types is None:
        return True
    if expected != "boolean" and isinstance(value, bool):
        return False
    return isinstance(value, python_types)


def validate_arguments(schema: dict[str, Any], arguments: Any) -> list[str]:
    """Validate `arguments` against a JSON Schema subset used by MCP tools.

    Covers exactly the keywords an inputSchema needs for this lesson: the
    top-level object type, properties with a declared type, a required
    array, and an enum on any property. Returns a list of error strings;
    an empty list means the arguments are valid.
    """
    if schema.get("type") == "object" and not isinstance(arguments, dict):
        return [f"arguments must be an object, got {type(arguments).__name__}"]
    if not isinstance(arguments, dict):
        return []

    errors: list[str] = []
    for name in schema.get("required", []):
        if name not in arguments:
            errors.append(f"missing required field: {name!r}")

    properties = schema.get("properties", {})
    for key, value in arguments.items():
        prop_schema = properties.get(key)
        if prop_schema is None:
            continue
        expected_type = prop_schema.get("type")
        if expected_type and not _matches_type(value, expected_type):
            errors.append(f"field {key!r} must be of type {expected_type!r}, got {type(value).__name__}")
            continue
        enum = prop_schema.get("enum")
        if enum is not None and value not in enum:
            errors.append(f"field {key!r} must be one of {enum!r}, got {value!r}")
    return errors


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict[str, Any]
    handler: Callable[[dict[str, Any]], Any]


@dataclass
class MockServer:
    """A minimal MCP server: it advertises tools and validates arguments before it runs them."""

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
            tool = self.tools[name]
            arguments = params.get("arguments", {})
            errors = validate_arguments(tool.input_schema, arguments)
            if errors:
                return _error(request["id"], INVALID_PARAMS, "; ".join(errors))
            value = tool.handler(arguments)
            return _result(request["id"], {"content": [{"type": "text", "text": json.dumps(value)}]})
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


def build_ticket_server() -> MockServer:
    server = MockServer(name="tickets")
    server.register(Tool(
        name="create_ticket",
        description="Create a support ticket with a title, a priority, and an optional points estimate.",
        input_schema={
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "priority": {"type": "string", "enum": ["low", "medium", "high"]},
                "points": {"type": "integer"},
            },
            "required": ["title", "priority"],
        },
        handler=lambda args: {
            "id": "TCK-1001",
            "title": args["title"],
            "priority": args["priority"],
            "points": args.get("points", 0),
        },
    ))
    return server


def demo() -> None:
    client = MockClient(server=build_ticket_server())

    handshake = client.initialize()
    print("initialize ->", json.dumps(handshake["result"], indent=None))

    tools = client.list_tools()
    print("tools/list ->", json.dumps(tools, indent=None))

    ok = client.call_tool("create_ticket", {"title": "Login button unresponsive", "priority": "high", "points": 3})
    print("tools/call valid ->", json.dumps(ok["result"], indent=None))

    missing = client.call_tool("create_ticket", {"title": "No priority given"})
    print("tools/call missing required ->", json.dumps(missing["error"], indent=None))

    wrong_type = client.call_tool("create_ticket", {"title": "Bad points type", "priority": "low", "points": "five"})
    print("tools/call wrong type ->", json.dumps(wrong_type["error"], indent=None))

    bad_enum = client.call_tool("create_ticket", {"title": "Bad priority value", "priority": "urgent"})
    print("tools/call enum violation ->", json.dumps(bad_enum["error"], indent=None))


if __name__ == "__main__":
    demo()
