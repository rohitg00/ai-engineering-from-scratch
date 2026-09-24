"""Trust boundaries and consent, modeled with the standard library.

A runnable mock of a consent gate for the MCPA exam's "Security and
Governance" domain: where the trust boundary sits between a host/client and
a server/tool, and how a side-effecting tool call must clear an explicit,
per-tool consent check before it runs. There is no network and no SDK, so
the exchange is deterministic and portable, but the message shapes are the
real JSON-RPC 2.0 envelopes that MCP 2026-07-28 uses. See docs/en.md for the
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
# Implementation-defined server error, in the range JSON-RPC 2.0 reserves
# for servers to signal a condition the base spec does not name.
CONSENT_REQUIRED = -32001


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict[str, Any]
    side_effecting: bool
    handler: Callable[[dict[str, Any]], Any]


@dataclass
class ConsentGate:
    """Tracks which specific tools the user has approved this session.

    A grant is keyed by tool name only. There is no wildcard, no category,
    and no "approve this server" shortcut: approving one tool never
    authorizes any other tool, however similar its name or purpose.
    """

    approved_tools: set[str] = field(default_factory=set)

    def approve(self, tool_name: str, token: str) -> None:
        if not token:
            raise ValueError("an approval token is required to grant consent")
        self.approved_tools.add(tool_name)

    def is_approved(self, tool_name: str) -> bool:
        return tool_name in self.approved_tools


@dataclass
class MockServer:
    """A minimal MCP server that gates side-effecting tools on consent."""

    name: str
    tools: dict[str, Tool] = field(default_factory=dict)
    gate: ConsentGate = field(default_factory=ConsentGate)

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
                    {
                        "name": tool.name,
                        "description": tool.description,
                        "inputSchema": tool.input_schema,
                        "annotations": {"sideEffecting": tool.side_effecting},
                    }
                    for tool in self.tools.values()
                ]
            })
        if method == "tools/call":
            return self._call_tool(request["id"], params)
        return _error(request["id"], METHOD_NOT_FOUND, f"unknown method: {method!r}")

    def _call_tool(self, request_id: Any, params: dict[str, Any]) -> dict[str, Any]:
        name = params.get("name")
        if name not in self.tools:
            return _error(request_id, METHOD_NOT_FOUND, f"unknown tool: {name!r}")
        tool = self.tools[name]
        arguments = params.get("arguments", {})
        required = tool.input_schema.get("required", [])
        missing = [key for key in required if key not in arguments]
        if missing:
            return _error(request_id, INVALID_PARAMS, f"missing arguments: {missing}")
        if tool.side_effecting and not self.gate.is_approved(name):
            return _error(
                request_id,
                CONSENT_REQUIRED,
                f"tool {name!r} is side-effecting and has no recorded consent",
            )
        value = tool.handler(arguments)
        # Content crossing back from a server is untrusted: it is data the
        # model must read, not an instruction the host already vetted.
        return _result(request_id, {
            "content": [{"type": "text", "text": str(value), "trust": "untrusted"}],
        })


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

    def grant_consent(self, name: str, token: str) -> None:
        """Simulate the user approving one named tool, and only that tool."""
        self.server.gate.approve(name, token)


def _result(request_id: Any, result: Any) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


def _error(request_id: Any, code: int, message: str) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}


def build_files_server() -> MockServer:
    server = MockServer(name="files")
    server.register(Tool(
        name="list_files",
        description="List file names in the working directory.",
        input_schema={"type": "object", "properties": {}, "required": []},
        side_effecting=False,
        handler=lambda args: ["report.csv", "notes.txt"],
    ))
    server.register(Tool(
        name="delete_file",
        description="Delete a file by name.",
        input_schema={"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]},
        side_effecting=True,
        handler=lambda args: f"deleted {args['path']}",
    ))
    server.register(Tool(
        name="send_email",
        description="Send an email to a recipient.",
        input_schema={"type": "object", "properties": {"to": {"type": "string"}}, "required": ["to"]},
        side_effecting=True,
        handler=lambda args: f"sent to {args['to']}",
    ))
    return server


def demo() -> None:
    client = MockClient(server=build_files_server())
    client.initialize()

    read_only = client.call_tool("list_files", {})
    print("read-only, no consent ->", json.dumps(read_only["result"], indent=None))

    refused = client.call_tool("delete_file", {"path": "notes.txt"})
    print("side-effecting, no consent ->", json.dumps(refused["error"], indent=None))

    client.grant_consent("delete_file", token="user-approved-1")
    approved = client.call_tool("delete_file", {"path": "notes.txt"})
    print("side-effecting, with consent ->", json.dumps(approved["result"], indent=None))

    different_tool = client.call_tool("send_email", {"to": "ceo@example.com"})
    print("different tool, no consent of its own ->", json.dumps(different_tool["error"], indent=None))


if __name__ == "__main__":
    demo()
