"""Ecosystem portability: one MCP server, driven unchanged by many hosts.

A runnable mock of the MCPA "Use Cases and Ecosystem" domain: the same
MockServer, unmodified, is discovered and called by two independent hosts
that present results differently. There is no network and no SDK, so the
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
    """A minimal MCP server. It has no idea which host, or how many hosts, call it."""

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


def build_internal_server() -> MockServer:
    """One server exposing two operational capabilities: data search and a workflow read.

    Nothing here mentions a host, because this function runs once, before any
    host exists. Both hosts in demo() receive this exact same MockServer instance.
    """
    server = MockServer(name="internal-ops")
    catalog = {
        "deploy pipeline": "runbooks/deploy-pipeline.md",
        "oncall rotation": "runbooks/oncall-rotation.md",
    }
    tickets = [
        {"id": "OPS-101", "title": "Rotate staging credentials", "status": "open"},
        {"id": "OPS-104", "title": "Add read replica", "status": "open"},
    ]
    server.register(Tool(
        name="search_knowledge_base",
        description="Search internal runbooks by topic.",
        input_schema={"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]},
        handler=lambda args: {
            topic: path for topic, path in catalog.items() if args["query"].lower() in topic
        } or {"match": "none"},
    ))
    server.register(Tool(
        name="list_open_tickets",
        description="List open operational tickets.",
        input_schema={"type": "object", "properties": {}, "required": []},
        handler=lambda args: [ticket for ticket in tickets if ticket["status"] == "open"],
    ))
    return server


@dataclass
class Host:
    """An application that embeds a client and renders results its own way.

    Two hosts below share nothing but the protocol. Each owns its own MockClient
    and its own rendering, but both point at the same MockServer instance.
    """

    label: str
    client: MockClient
    render: Callable[[str, dict[str, Any]], str]

    def discover(self) -> list[dict[str, Any]]:
        return self.client.list_tools()

    def run(self, tool_name: str, arguments: dict[str, Any]) -> tuple[dict[str, Any], str]:
        response = self.client.call_tool(tool_name, arguments)
        return response, self.render(tool_name, response)


def render_as_chat_bubble(tool_name: str, response: dict[str, Any]) -> str:
    if "error" in response:
        return f"[chat] {tool_name} failed: {response['error']['message']}"
    text = response["result"]["content"][0]["text"]
    return f"[chat] {tool_name} said: {text}"


def render_as_sidebar_panel(tool_name: str, response: dict[str, Any]) -> str:
    if "error" in response:
        return f"<panel error tool={tool_name!r}>{response['error']['message']}</panel>"
    text = response["result"]["content"][0]["text"]
    return f"<panel tool={tool_name!r}>{text}</panel>"


def demo() -> None:
    server = build_internal_server()

    chat_host = Host(label="assistant-chat", client=MockClient(server=server), render=render_as_chat_bubble)
    sidebar_host = Host(label="ide-sidebar", client=MockClient(server=server), render=render_as_sidebar_panel)

    for host in (chat_host, sidebar_host):
        handshake = host.client.initialize()
        print(f"{host.label} initialize ->", json.dumps(handshake["result"], indent=None))

    chat_tools = [tool["name"] for tool in chat_host.discover()]
    sidebar_tools = [tool["name"] for tool in sidebar_host.discover()]
    print("assistant-chat tools/list ->", json.dumps(chat_tools, indent=None))
    print("ide-sidebar tools/list ->", json.dumps(sidebar_tools, indent=None))

    chat_response, chat_view = chat_host.run("search_knowledge_base", {"query": "deploy"})
    sidebar_response, sidebar_view = sidebar_host.run("search_knowledge_base", {"query": "deploy"})
    print(chat_view)
    print(sidebar_view)
    print("payloads match ->", chat_response["result"] == sidebar_response["result"])

    _, unknown_view = chat_host.run("delete_everything", {})
    print(unknown_view)


if __name__ == "__main__":
    demo()
