"""Requests, notifications, and the three server primitives.

A runnable mock of the rule the MCPA exam's "Interactions and Execution"
domain builds on: a JSON-RPC message with an id is a request and always
gets exactly one response; a message with no id is a notification and
never gets one, even when its method is unknown. The same dispatcher also
lists and invokes the three primitive families a server can expose: tools,
resources, and prompts. There is no network and no SDK, so the exchange is
deterministic and portable, but the message shapes are the real JSON-RPC
2.0 envelopes that MCP 2026-07-28 uses. See docs/en.md for the walkthrough.

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


class ServerError(Exception):
    """A protocol-level failure that becomes a JSON-RPC error, but only
    for a request. Raising this from a notification handler still yields
    no response at all, because an error is a response and a notification
    has no id to key one to."""

    def __init__(self, code: int, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict[str, Any]
    handler: Callable[[dict[str, Any]], Any]


@dataclass
class Resource:
    uri: str
    name: str
    description: str
    handler: Callable[[], str]


@dataclass
class Prompt:
    name: str
    description: str
    arguments: list[str]
    handler: Callable[[dict[str, Any]], list[dict[str, Any]]]


@dataclass
class MockServer:
    """A minimal MCP server: it exposes tools, resources, and prompts,
    and it dispatches every incoming JSON-RPC message according to one
    rule, whether the message carries an id."""

    name: str
    tools: dict[str, Tool] = field(default_factory=dict)
    resources: dict[str, Resource] = field(default_factory=dict)
    prompts: dict[str, Prompt] = field(default_factory=dict)
    log: list[str] = field(default_factory=list)

    def register_tool(self, tool: Tool) -> None:
        self.tools[tool.name] = tool

    def register_resource(self, resource: Resource) -> None:
        self.resources[resource.uri] = resource

    def register_prompt(self, prompt: Prompt) -> None:
        self.prompts[prompt.name] = prompt

    def dispatch(self, message: dict[str, Any]) -> dict[str, Any] | None:
        is_request = "id" in message
        if message.get("jsonrpc") != "2.0" or "method" not in message:
            if is_request:
                return _error(message["id"], INVALID_REQUEST, "not a JSON-RPC 2.0 request")
            return None
        method = message["method"]
        params = message.get("params", {})
        try:
            result = self._route(method, params)
        except ServerError as exc:
            return _error(message["id"], exc.code, exc.message) if is_request else None
        return _result(message["id"], result) if is_request else None

    def _route(self, method: str, params: dict[str, Any]) -> Any:
        if method == "initialize":
            return {
                "protocolVersion": PROTOCOL_VERSION,
                "serverInfo": {"name": self.name},
                "capabilities": {
                    "tools": {"listChanged": False},
                    "resources": {"listChanged": False},
                    "prompts": {"listChanged": False},
                },
            }
        if method == "notifications/initialized":
            self.log.append("client acknowledged initialize; no reply is owed")
            return None
        if method == "tools/list":
            return {"tools": [
                {"name": tool.name, "description": tool.description, "inputSchema": tool.input_schema}
                for tool in self.tools.values()
            ]}
        if method == "tools/call":
            return self._call_tool(params)
        if method == "resources/list":
            return {"resources": [
                {"uri": resource.uri, "name": resource.name, "description": resource.description}
                for resource in self.resources.values()
            ]}
        if method == "resources/read":
            return self._read_resource(params)
        if method == "prompts/list":
            return {"prompts": [
                {"name": prompt.name, "description": prompt.description, "arguments": prompt.arguments}
                for prompt in self.prompts.values()
            ]}
        if method == "prompts/get":
            return self._get_prompt(params)
        raise ServerError(METHOD_NOT_FOUND, f"unknown method: {method!r}")

    def _call_tool(self, params: dict[str, Any]) -> dict[str, Any]:
        name = params.get("name")
        if name not in self.tools:
            raise ServerError(INVALID_PARAMS, f"unknown tool: {name!r}")
        tool = self.tools[name]
        arguments = params.get("arguments", {})
        required = tool.input_schema.get("required", [])
        missing = [key for key in required if key not in arguments]
        if missing:
            raise ServerError(INVALID_PARAMS, f"missing arguments: {missing}")
        value = tool.handler(arguments)
        return {"content": [{"type": "text", "text": str(value)}]}

    def _read_resource(self, params: dict[str, Any]) -> dict[str, Any]:
        uri = params.get("uri")
        if uri not in self.resources:
            raise ServerError(INVALID_PARAMS, f"unknown or invalid resource uri: {uri!r}")
        resource = self.resources[uri]
        return {"contents": [{"uri": resource.uri, "mimeType": "text/plain", "text": resource.handler()}]}

    def _get_prompt(self, params: dict[str, Any]) -> dict[str, Any]:
        name = params.get("name")
        if name not in self.prompts:
            raise ServerError(INVALID_PARAMS, f"unknown prompt: {name!r}")
        prompt = self.prompts[name]
        arguments = params.get("arguments", {})
        missing = [key for key in prompt.arguments if key not in arguments]
        if missing:
            raise ServerError(INVALID_PARAMS, f"missing arguments: {missing}")
        return {"messages": prompt.handler(arguments)}


@dataclass
class MockClient:
    """A client inside a host: it owns one connection to one server and
    knows which of its own outgoing messages expect a reply."""

    server: MockServer
    _next_id: int = 1

    def _send_request(self, method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        message: dict[str, Any] = {"jsonrpc": "2.0", "id": self._next_id, "method": method}
        if params is not None:
            message["params"] = params
        self._next_id += 1
        response = self.server.dispatch(message)
        assert response is not None, "a request must always receive a response"
        return response

    def _send_notification(self, method: str, params: dict[str, Any] | None = None) -> None:
        message: dict[str, Any] = {"jsonrpc": "2.0", "method": method}
        if params is not None:
            message["params"] = params
        response = self.server.dispatch(message)
        assert response is None, "a notification must never receive a response"

    def initialize(self) -> dict[str, Any]:
        return self._send_request("initialize", {"protocolVersion": PROTOCOL_VERSION})

    def notify_initialized(self) -> None:
        self._send_notification("notifications/initialized")

    def list_tools(self) -> list[dict[str, Any]]:
        return self._send_request("tools/list")["result"]["tools"]

    def call_tool(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        return self._send_request("tools/call", {"name": name, "arguments": arguments})

    def list_resources(self) -> list[dict[str, Any]]:
        return self._send_request("resources/list")["result"]["resources"]

    def read_resource(self, uri: str) -> dict[str, Any]:
        return self._send_request("resources/read", {"uri": uri})

    def list_prompts(self) -> list[dict[str, Any]]:
        return self._send_request("prompts/list")["result"]["prompts"]

    def get_prompt(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        return self._send_request("prompts/get", {"name": name, "arguments": arguments})


def _result(request_id: Any, result: Any) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


def _error(request_id: Any, code: int, message: str) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}


def build_demo_server() -> MockServer:
    server = MockServer(name="primitives-demo")
    server.register_tool(Tool(
        name="add",
        description="Add two integers and return the sum.",
        input_schema={
            "type": "object",
            "properties": {"a": {"type": "integer"}, "b": {"type": "integer"}},
            "required": ["a", "b"],
        },
        handler=lambda args: args["a"] + args["b"],
    ))
    server.register_resource(Resource(
        uri="notes://overview",
        name="Overview note",
        description="A short static note a host can attach to context.",
        handler=lambda: "MCP servers can expose tools, resources, and prompts.",
    ))
    server.register_prompt(Prompt(
        name="greet_user",
        description="A reusable greeting template a user can select.",
        arguments=["name"],
        handler=lambda args: [
            {"role": "user", "content": {"type": "text", "text": f"Say hello to {args['name']}."}}
        ],
    ))
    return server


def demo() -> None:
    client = MockClient(server=build_demo_server())

    handshake = client.initialize()
    print("initialize (request, id 1) ->", json.dumps(handshake["result"], indent=None))

    client.notify_initialized()
    print("notifications/initialized (notification, no id) -> no response sent")

    print("tools/list ->", json.dumps(client.list_tools(), indent=None))
    print("resources/list ->", json.dumps(client.list_resources(), indent=None))
    print("prompts/list ->", json.dumps(client.list_prompts(), indent=None))

    added = client.call_tool("add", {"a": 2, "b": 3})
    print("tools/call ->", json.dumps(added["result"], indent=None))

    note = client.read_resource("notes://overview")
    print("resources/read ->", json.dumps(note["result"], indent=None))

    greeting = client.get_prompt("greet_user", {"name": "Ada"})
    print("prompts/get ->", json.dumps(greeting["result"], indent=None))

    as_request = client.server.dispatch({"jsonrpc": "2.0", "id": 99, "method": "widgets/list"})
    print("unknown method as a request ->", json.dumps(as_request["error"], indent=None))

    as_notification = client.server.dispatch({"jsonrpc": "2.0", "method": "widgets/list"})
    print("unknown method as a notification -> no response sent:", as_notification is None)


if __name__ == "__main__":
    demo()
