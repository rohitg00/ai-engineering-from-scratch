"""Companion code for:
certifications/mcpa/lessons/02-the-integration-problem/docs/en.md
One client driving two servers it was never built for.
Sources: MCP 2026-07-28 architecture overview, server/discover, and Tools pages.
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


def integrations_without_protocol(hosts: int, systems: int) -> int:
    return hosts * systems


def integrations_with_protocol(hosts: int, systems: int) -> int:
    return hosts + systems


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict
    handler: Callable[[dict], dict]

    def definition(self) -> dict:
        return {"name": self.name, "description": self.description, "inputSchema": self.input_schema}


@dataclass
class Server:
    name: str
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
        if meta[PV_KEY] != PROTOCOL_VERSION:
            return make_error(
                request_id,
                UNSUPPORTED_PROTOCOL_VERSION,
                "Unsupported protocol version",
                {"supported": [PROTOCOL_VERSION], "requested": meta[PV_KEY]},
            )
        method = message.get("method")
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
        output = tool.handler(arguments)
        return make_result(
            request_id,
            content=[{"type": "text", "text": output["text"]}],
            structuredContent=output["data"],
            isError=False,
            _meta=self._server_meta(),
        )


class Client:
    def __init__(self, server: Server) -> None:
        self.server = server
        self.next_id = 0
        self.log: list[dict] = []

    def send(self, method: str, params: dict | None = None, version: str = PROTOCOL_VERSION) -> dict:
        self.next_id += 1
        request = make_request(self.next_id, method, params, version=version)
        response = self.server.handle(request)
        self.log.extend([request, response])
        return response

    def discover(self) -> dict:
        return self.send("server/discover")["result"]

    def list_tools(self) -> list[dict]:
        return self.send("tools/list")["result"]["tools"]

    def call(self, name: str, arguments: dict) -> dict:
        return self.send("tools/call", {"name": name, "arguments": arguments})


def build_weather_server() -> Server:
    server = Server("weather")
    server.add(Tool(
        name="get_forecast",
        description="Get tomorrow's forecast for a city.",
        input_schema={"type": "object", "properties": {"city": {"type": "string"}}, "required": ["city"]},
        handler=lambda args: {"text": f"{args['city']}: 24C, light rain", "data": {"city": args["city"], "celsius": 24, "sky": "light rain"}},
    ))
    return server


def build_ticket_server() -> Server:
    server = Server("tickets")
    server.add(Tool(
        name="open_ticket",
        description="Open a support ticket and return its id.",
        input_schema={"type": "object", "properties": {"title": {"type": "string"}}, "required": ["title"]},
        handler=lambda args: {"text": f"Opened TCK-101: {args['title']}", "data": {"id": "TCK-101", "title": args["title"]}},
    ))
    server.add(Tool(
        name="count_open_tickets",
        description="Count open support tickets.",
        input_schema={"type": "object", "additionalProperties": False},
        handler=lambda args: {"text": "3 open tickets", "data": {"open": 3}},
    ))
    return server


def run_scenario() -> tuple[Client, Client]:
    weather = Client(build_weather_server())
    tickets = Client(build_ticket_server())
    for client in (weather, tickets):
        client.discover()
        client.list_tools()
    weather.call("get_forecast", {"city": "Pune"})
    weather.call("get_forecast", {})
    tickets.call("open_ticket", {"title": "VPN drops every hour"})
    tickets.call("delete_all_tickets", {})
    tickets.send("tools/list", version="1999-01-01")
    return weather, tickets


def transcript() -> list[dict]:
    weather, tickets = run_scenario()
    return weather.log + tickets.log


def demo() -> None:
    print("integrations for 4 hosts and 6 systems")
    print("  without a shared protocol:", integrations_without_protocol(4, 6))
    print("  with one protocol:        ", integrations_with_protocol(4, 6))
    weather, tickets = run_scenario()
    for label, client in (("weather", weather), ("tickets", tickets)):
        print(f"\n{label} server exchanges")
        for message in client.log:
            print("  " + json.dumps(message, sort_keys=True)[:160])


if __name__ == "__main__":
    demo()
