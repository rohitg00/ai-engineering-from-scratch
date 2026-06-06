"""Minimal MCP server + in-process client round-trip.

The reference SDK is `mcp` on PyPI (install with `pip install mcp`). This file
does not import it so the demo runs on any Python 3.10+ without extra deps.
Instead it speaks raw JSON-RPC 2.0 over an in-memory pipe — the same wire
format an MCP stdio host uses — so you can see how tools, resources, and
prompts flow end to end.

Run with:
    python main.py
"""

from __future__ import annotations

import json
import queue
from dataclasses import dataclass
from typing import Any, Callable


PROTOCOL_VERSION = "2025-06-18"


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict[str, Any]
    handler: Callable[..., Any]
    destructive: bool = False


@dataclass
class Resource:
    uri: str
    description: str
    handler: Callable[[], str]


@dataclass
class Prompt:
    name: str
    description: str
    arguments: list[str]
    handler: Callable[..., str]


class MCPServer:
    """Toy MCP server covering the three primitives and the discovery handshake."""

    def __init__(self, name: str) -> None:
        self.name = name
        self.tools: dict[str, Tool] = {}
        self.resources: dict[str, Resource] = {}
        self.prompts: dict[str, Prompt] = {}

    # Registration helpers -------------------------------------------------

    def tool(self, name: str, description: str, schema: dict[str, Any], *, destructive: bool = False):
        def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
            self.tools[name] = Tool(name, description, schema, fn, destructive)
            return fn
        return decorator

    def resource(self, uri: str, description: str):
        def decorator(fn: Callable[[], str]) -> Callable[[], str]:
            self.resources[uri] = Resource(uri, description, fn)
            return fn
        return decorator

    def prompt(self, name: str, description: str, arguments: list[str]):
        def decorator(fn: Callable[..., str]) -> Callable[..., str]:
            self.prompts[name] = Prompt(name, description, arguments, fn)
            return fn
        return decorator

    # JSON-RPC dispatch ----------------------------------------------------

    def handle(self, message: dict[str, Any]) -> dict[str, Any]:
        method = message.get("method")
        params = message.get("params") or {}
        request_id = message.get("id")

        try:
            if method == "initialize":
                result: Any = {
                    "protocolVersion": PROTOCOL_VERSION,
                    "serverInfo": {"name": self.name, "version": "0.1.0"},
                    "capabilities": {"tools": {}, "resources": {}, "prompts": {}},
                }
            elif method == "tools/list":
                result = {"tools": [
                    {
                        "name": t.name,
                        "description": t.description,
                        "inputSchema": t.input_schema,
                        "annotations": {"destructiveHint": t.destructive} if t.destructive else {},
                    }
                    for t in self.tools.values()
                ]}
            elif method == "tools/call":
                tool = self.tools[params["name"]]
                output = tool.handler(**params.get("arguments", {}))
                result = {"content": [{"type": "text", "text": json.dumps(output)}]}
            elif method == "resources/list":
                result = {"resources": [
                    {"uri": r.uri, "description": r.description} for r in self.resources.values()
                ]}
            elif method == "resources/read":
                res = self.resources[params["uri"]]
                result = {"contents": [{"uri": res.uri, "mimeType": "text/plain", "text": res.handler()}]}
            elif method == "prompts/list":
                result = {"prompts": [
                    {"name": p.name, "description": p.description, "arguments": [
                        {"name": a, "required": True} for a in p.arguments
                    ]}
                    for p in self.prompts.values()
                ]}
            elif method == "prompts/get":
                p = self.prompts[params["name"]]
                rendered = p.handler(**params.get("arguments", {}))
                result = {"messages": [{"role": "user", "content": {"type": "text", "text": rendered}}]}
            else:
                return {"jsonrpc": "2.0", "id": request_id, "error": {"code": -32601, "message": f"unknown method: {method}"}}
        except KeyError as e:
            return {"jsonrpc": "2.0", "id": request_id, "error": {"code": -32602, "message": f"missing key: {e}"}}

        return {"jsonrpc": "2.0", "id": request_id, "result": result}


class MCPClient:
    """In-memory client. Real clients read/write framed JSON over stdio or HTTP."""

    def __init__(self, server: MCPServer) -> None:
        self.server = server
        self._id = 0
        self.inbox: queue.SimpleQueue[dict[str, Any]] = queue.SimpleQueue()

    def _next_id(self) -> int:
        self._id += 1
        return self._id

    def request(self, method: str, params: dict[str, Any] | None = None) -> Any:
        message = {"jsonrpc": "2.0", "id": self._next_id(), "method": method, "params": params or {}}
        response = self.server.handle(message)
        if "error" in response:
            raise RuntimeError(response["error"]["message"])
        return response["result"]


# Build a demo server ------------------------------------------------------

server = MCPServer("demo-server")


@server.tool(
    name="add",
    description="Add two integers and return the sum.",
    schema={
        "type": "object",
        "properties": {"a": {"type": "integer"}, "b": {"type": "integer"}},
        "required": ["a", "b"],
    },
)
def add(a: int, b: int) -> dict[str, int]:
    return {"sum": a + b}


@server.tool(
    name="delete_user",
    description="Delete a user by id. Mutating; requires approval.",
    schema={"type": "object", "properties": {"user_id": {"type": "integer"}}, "required": ["user_id"]},
    destructive=True,
)
def delete_user(user_id: int) -> dict[str, Any]:
    return {"deleted": user_id, "note": "simulated; real impl would hit DB"}


@server.resource("config://app", "Application config as JSON text.")
def app_config() -> str:
    return json.dumps({"env": "prod", "region": "us-east-1"})


@server.prompt("code_review", "Prompt the model to review code in a language.", ["language", "code"])
def code_review(language: str, code: str) -> str:
    return f"You are a senior {language} reviewer. Review for correctness and style:\n\n{code}"


# Drive it -----------------------------------------------------------------

def main() -> None:
    client = MCPClient(server)
    init = client.request("initialize", {"protocolVersion": PROTOCOL_VERSION, "clientInfo": {"name": "demo-client"}})
    print(f"Connected to {init['serverInfo']['name']} (protocol {init['protocolVersion']})")

    tools = client.request("tools/list")["tools"]
    print(f"\n{len(tools)} tool(s) discovered:")
    for t in tools:
        flag = " [destructive]" if t.get("annotations", {}).get("destructiveHint") else ""
        print(f"  - {t['name']}{flag}: {t['description']}")

    add_result = client.request("tools/call", {"name": "add", "arguments": {"a": 40, "b": 2}})
    print("\nCall add(40, 2) ->", add_result["content"][0]["text"])

    resources = client.request("resources/list")["resources"]
    print(f"\n{len(resources)} resource(s):")
    for r in resources:
        print(f"  - {r['uri']}: {r['description']}")

    config = client.request("resources/read", {"uri": "config://app"})
    print("\nRead config://app ->", config["contents"][0]["text"])

    prompt = client.request("prompts/get", {"name": "code_review", "arguments": {"language": "Python", "code": "x = 1\n"}})
    print("\nRender code_review prompt ->", prompt["messages"][0]["content"]["text"][:80], "...")


if __name__ == "__main__":
    main()
