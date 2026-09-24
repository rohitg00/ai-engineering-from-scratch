"""Companion code for:
certifications/mcpa/lessons/08-tool-schemas-and-structured-content/docs/en.md
A tool's schema contract, enforced as tool execution errors, not protocol errors.
Sources: MCP 2026-07-28 Tools page; JSON Schema 2020-12; SEP-1303.
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

INVALID_PARAMS = -32602
METHOD_NOT_FOUND = -32601

DEFAULT_DIALECT = "https://json-schema.org/draft/2020-12/schema"
TOOL_NAME_CHARS = set(
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-."
)

_SCHEMA_TYPES: dict[str, tuple[type, ...]] = {
    "string": (str,),
    "integer": (int,),
    "number": (int, float),
    "boolean": (bool,),
    "array": (list,),
    "object": (dict,),
}


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


def is_valid_tool_name(name: str) -> bool:
    return 1 <= len(name) <= 128 and all(char in TOOL_NAME_CHARS for char in name)


def find_network_refs(node: Any) -> list[str]:
    refs: list[str] = []
    if isinstance(node, dict):
        ref = node.get("$ref")
        if isinstance(ref, str) and (ref.startswith("http://") or ref.startswith("https://")):
            refs.append(ref)
        for value in node.values():
            refs.extend(find_network_refs(value))
    elif isinstance(node, list):
        for item in node:
            refs.extend(find_network_refs(item))
    return refs


def _matches_type(value: Any, expected: str) -> bool:
    python_types = _SCHEMA_TYPES.get(expected)
    if python_types is None:
        return True
    if expected != "boolean" and isinstance(value, bool):
        return False
    return isinstance(value, python_types)


def validate_arguments(schema: dict[str, Any], arguments: Any) -> list[str]:
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

    if schema.get("additionalProperties") is False:
        allowed = set(properties.keys())
        for key in arguments:
            if key not in allowed:
                errors.append(f"unexpected property {key!r} is not declared in properties")
    return errors


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict[str, Any]
    output_schema: dict[str, Any] | None
    handler: Callable[[dict[str, Any]], dict[str, Any]]

    def definition(self) -> dict[str, Any]:
        body = {"name": self.name, "description": self.description, "inputSchema": self.input_schema}
        if self.output_schema is not None:
            body["outputSchema"] = self.output_schema
        return body


@dataclass
class Server:
    name: str
    tools: dict[str, Tool] = field(default_factory=dict)

    def register(self, tool: Tool) -> None:
        if not is_valid_tool_name(tool.name):
            raise ValueError(f"tool name {tool.name!r} does not satisfy the naming rules")
        network_refs = find_network_refs(tool.input_schema) + find_network_refs(tool.output_schema or {})
        if network_refs:
            raise ValueError(
                f"refusing to register {tool.name!r}: its schema has a network $ref {network_refs!r}; "
                "a conformant server never auto-dereferences a network URI"
            )
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
        errors = validate_arguments(tool.input_schema, arguments)
        if errors:
            explanation = "; ".join(errors) + ". Fix the arguments and call tools/call again."
            return make_result(
                request_id,
                content=[{"type": "text", "text": explanation}],
                isError=True,
                _meta=self._server_meta(),
            )
        output = tool.handler(arguments)
        return make_result(
            request_id,
            content=[{"type": "text", "text": json.dumps(output, sort_keys=True)}],
            structuredContent=output,
            isError=False,
            _meta=self._server_meta(),
        )


class Client:
    def __init__(self, server: Server) -> None:
        self.server = server
        self.next_id = 0
        self.log: list[dict] = []

    def send(self, method: str, params: dict | None = None) -> dict:
        self.next_id += 1
        request = make_request(self.next_id, method, params)
        response = self.server.handle(request)
        self.log.extend([request, response])
        return response

    def list_tools(self) -> list[dict]:
        return self.send("tools/list")["result"]["tools"]

    def call(self, name: str, arguments: dict) -> dict:
        return self.send("tools/call", {"name": name, "arguments": arguments})


def build_catalog_server() -> Server:
    server = Server("catalog")
    server.register(Tool(
        name="lookup_product",
        description="Look up a product by SKU and return its price and stock status.",
        input_schema={
            "type": "object",
            "properties": {
                "sku": {"type": "string"},
                "region": {"type": "string", "enum": ["us", "eu", "in"]},
            },
            "required": ["sku"],
            "additionalProperties": False,
        },
        output_schema={
            "type": "object",
            "properties": {
                "sku": {"type": "string"},
                "name": {"type": "string"},
                "priceUsd": {"type": "number"},
                "inStock": {"type": "boolean"},
            },
            "required": ["sku", "name", "priceUsd", "inStock"],
        },
        handler=lambda args: {
            "sku": args["sku"],
            "name": "Wireless Mouse" if args["sku"] == "SKU-100" else "Mechanical Keyboard",
            "priceUsd": 24.99 if args["sku"] == "SKU-100" else 89.0,
            "inStock": args["sku"] == "SKU-100",
        },
    ))
    server.register(Tool(
        name="server_time",
        description="Return the lesson server's fixed clock reading. Takes no parameters.",
        input_schema={
            "$schema": DEFAULT_DIALECT,
            "type": "object",
            "additionalProperties": False,
        },
        output_schema={
            "type": "object",
            "properties": {"utc": {"type": "string"}},
            "required": ["utc"],
        },
        handler=lambda args: {"utc": "2026-07-28T00:00:00Z"},
    ))
    return server


def attempt_network_ref_registration() -> str:
    tool = Tool(
        name="lookup_by_ref",
        description="Deliberately invalid: its inputSchema dereferences a network $ref.",
        input_schema={
            "type": "object",
            "properties": {
                "target": {"$ref": "https://schemas.example.com/catalog.json#/definitions/Sku"},
            },
        },
        output_schema=None,
        handler=lambda args: args,
    )
    server = Server("untrusted")
    try:
        server.register(tool)
    except ValueError as exc:
        return str(exc)
    return "registered without a check, which a conformant server must never do"


def run_scenario() -> Client:
    client = Client(build_catalog_server())
    client.list_tools()
    client.call("lookup_product", {"sku": "SKU-100"})
    client.call("lookup_product", {"region": "us"})
    client.call("lookup_product", {"sku": "SKU-100", "region": "mars"})
    client.call("lookup_product", {"sku": 100})
    client.call("lookup_product", {"sku": "SKU-100", "coupon": "SAVE10"})
    client.call("server_time", {})
    client.call("server_time", {"tz": "UTC"})
    client.call("delete_catalog", {})
    return client


def transcript() -> list[Any]:
    client = run_scenario()
    entries: list[Any] = list(client.log)
    entries.append({
        "violation": (
            "Before SEP-1303 (2025-11-25), a schema-invalid argument such as a missing 'sku' was reported "
            "with a JSON-RPC protocol error. The correct 2026-07-28 response to that same mistake is the "
            "isError true tool result shown earlier in this transcript, which the model can read and act on."
        ),
        "message": {
            "jsonrpc": "2.0",
            "id": 999,
            "error": {"code": INVALID_PARAMS, "message": "Invalid params: 'sku' is a required property"},
        },
    })
    return entries


def demo() -> None:
    client = run_scenario()
    print("catalog server exchanges")
    for message in client.log:
        print("  " + json.dumps(message, sort_keys=True)[:200])

    print("\ntool name checks")
    for name in ("lookup_product", "look up product", "x" * 129, "admin.tools.list"):
        label = name if len(name) <= 24 else name[:24] + "..."
        print(f"  is_valid_tool_name({label!r}) -> {is_valid_tool_name(name)}")

    print("\nregistration-time $ref check")
    print(" ", attempt_network_ref_registration())


if __name__ == "__main__":
    demo()
