"""The tool invocation lifecycle and its JSON-RPC error codes.

A runnable mock of a server that pushes every tools/call request through
four checkpoints: parsed, validated, executed, result. Each checkpoint can
fail with its own named JSON-RPC 2.0 error, keyed to the request id, the
way the MCPA exam's "Interactions and Execution" domain describes it. There
is no network and no SDK, so the exchange is deterministic and portable,
but the message shapes are the real ones MCP 2026-07-28 uses. See
docs/en.md for the walkthrough.

Run: python3 code/main.py
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Callable


PROTOCOL_VERSION = "2026-07-28"

# The five JSON-RPC 2.0 error codes a tools/call request can end with, one
# per lifecycle checkpoint. See docs/en.md for what each one means.
PARSE_ERROR = -32700
INVALID_REQUEST = -32600
METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602
INTERNAL_ERROR = -32603


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict[str, Any]
    handler: Callable[[dict[str, Any]], Any]


@dataclass
class LifecycleServer:
    """Runs every tools/call request through parse, validate, execute, result."""

    name: str
    tools: dict[str, Tool] = field(default_factory=dict)

    def register(self, tool: Tool) -> None:
        self.tools[tool.name] = tool

    def handle_raw(self, raw: str) -> dict[str, Any]:
        """Checkpoint 1: parsed. `raw` is exactly what a transport would deliver."""
        try:
            request = json.loads(raw)
        except json.JSONDecodeError as exc:
            return _error(None, PARSE_ERROR, f"invalid JSON: {exc}")
        return self.handle(request)

    def handle(self, request: Any) -> dict[str, Any]:
        """Checkpoints 1b-4: envelope shape, routing, schema, execution, result."""
        is_valid_envelope = (
            isinstance(request, dict)
            and request.get("jsonrpc") == "2.0"
            and "method" in request
            and "id" in request
        )
        if not is_valid_envelope:
            request_id = request.get("id") if isinstance(request, dict) else None
            return _error(request_id, INVALID_REQUEST, "not a well-formed JSON-RPC 2.0 request")

        request_id = request["id"]
        method = request["method"]
        if method != "tools/call":
            return _error(request_id, METHOD_NOT_FOUND, f"unknown method: {method!r}")

        params = request.get("params")
        if not isinstance(params, dict) or "name" not in params:
            return _error(request_id, INVALID_PARAMS, "params.name is required")

        name = params["name"]
        if name not in self.tools:
            return _error(request_id, METHOD_NOT_FOUND, f"unknown tool: {name!r}")

        tool = self.tools[name]
        arguments = params.get("arguments", {})
        if not isinstance(arguments, dict):
            return _error(request_id, INVALID_PARAMS, "arguments must be an object")
        required = tool.input_schema.get("required", [])
        missing = [key for key in required if key not in arguments]
        if missing:
            return _error(request_id, INVALID_PARAMS, f"missing arguments: {missing}")

        try:
            value = tool.handler(arguments)
        except Exception as exc:  # the handler is arbitrary code; never trust it
            return _error(request_id, INTERNAL_ERROR, f"tool raised: {exc}")

        return _result(request_id, {"content": [{"type": "text", "text": str(value)}]})


def _result(request_id: Any, result: Any) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


def _error(request_id: Any, code: int, message: str) -> dict[str, Any]:
    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}


def build_lifecycle_server() -> LifecycleServer:
    server = LifecycleServer(name="lifecycle-demo")
    server.register(Tool(
        name="convert_temperature",
        description="Convert a Celsius reading to Fahrenheit.",
        input_schema={"type": "object", "properties": {"celsius": {"type": "number"}}, "required": ["celsius"]},
        handler=lambda args: args["celsius"] * 9 / 5 + 32,
    ))
    server.register(Tool(
        name="divide",
        description="Divide a by b; raises on a zero divisor to demonstrate internal error.",
        input_schema={
            "type": "object",
            "properties": {"a": {"type": "number"}, "b": {"type": "number"}},
            "required": ["a", "b"],
        },
        handler=lambda args: args["a"] / args["b"],
    ))
    return server


def demo() -> None:
    server = build_lifecycle_server()
    print("protocol ->", PROTOCOL_VERSION)

    ok = server.handle_raw(json.dumps({
        "jsonrpc": "2.0", "id": 1, "method": "tools/call",
        "params": {"name": "convert_temperature", "arguments": {"celsius": 100}},
    }))
    print("result ->", json.dumps(ok))

    parse_fail = server.handle_raw("{not json")
    print("parse error ->", json.dumps(parse_fail))

    invalid_request = server.handle({"method": "tools/call"})
    print("invalid request ->", json.dumps(invalid_request))

    not_found = server.handle({
        "jsonrpc": "2.0", "id": 2, "method": "tools/call",
        "params": {"name": "delete_everything", "arguments": {}},
    })
    print("method not found ->", json.dumps(not_found))

    bad_params = server.handle({
        "jsonrpc": "2.0", "id": 3, "method": "tools/call",
        "params": {"name": "convert_temperature", "arguments": {}},
    })
    print("invalid params ->", json.dumps(bad_params))

    internal = server.handle({
        "jsonrpc": "2.0", "id": 4, "method": "tools/call",
        "params": {"name": "divide", "arguments": {"a": 1, "b": 0}},
    })
    print("internal error ->", json.dumps(internal))


if __name__ == "__main__":
    demo()
