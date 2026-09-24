"""Companion code for:
certifications/mcpa/lessons/19-transports-and-http-headers/docs/en.md
Framing a stdio message and validating an HTTP header mirror.
Sources: MCP 2026-07-28 stdio and Streamable HTTP transport pages; SEP-2243.
"""

from __future__ import annotations

import base64
import json
from dataclasses import dataclass, field
from typing import Any, Callable


PROTOCOL_VERSION = "2026-07-28"
PV_KEY = "io.modelcontextprotocol/protocolVersion"
CAPS_KEY = "io.modelcontextprotocol/clientCapabilities"
CLIENT_INFO_KEY = "io.modelcontextprotocol/clientInfo"
SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo"

INVALID_PARAMS = -32602
HEADER_MISMATCH = -32020

NAME_HEADER_METHODS = {"tools/call": "name", "resources/read": "uri", "prompts/get": "name"}
BASE64_PREFIX = "=?base64?"
BASE64_SUFFIX = "?="


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


def frame_line(text: str) -> str:
    if "\n" in text or "\r" in text:
        raise ValueError("stdio frames must not contain embedded newlines")
    return text + "\n"


def frame_message(message: dict) -> str:
    return frame_line(json.dumps(message, sort_keys=True, separators=(",", ":")))


def parse_frames(stream: str) -> list[dict]:
    return [json.loads(line) for line in stream.split("\n") if line]


def _is_safe_header_char(character: str) -> bool:
    code = ord(character)
    return code == 0x09 or 0x20 <= code <= 0x7E


def needs_base64_encoding(text: str) -> bool:
    if any(not _is_safe_header_char(character) for character in text):
        return True
    if text != text.strip():
        return True
    if text.startswith(BASE64_PREFIX) and text.endswith(BASE64_SUFFIX):
        return True
    return False


def stringify_header_value(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def encode_header_value(value: Any) -> str:
    text = stringify_header_value(value)
    if needs_base64_encoding(text):
        encoded = base64.b64encode(text.encode("utf-8")).decode("ascii")
        return f"{BASE64_PREFIX}{encoded}{BASE64_SUFFIX}"
    return text


def decode_header_value(value: str) -> str | None:
    if value.startswith(BASE64_PREFIX) and value.endswith(BASE64_SUFFIX):
        payload = value[len(BASE64_PREFIX):-len(BASE64_SUFFIX)]
        try:
            return base64.b64decode(payload, validate=True).decode("utf-8")
        except ValueError:
            return None
    return value


def build_http_headers(message: dict, header_params: dict[str, str] | None = None) -> dict[str, str]:
    params = message.get("params") or {}
    meta = params.get("_meta") or {}
    method = message.get("method")
    headers = {"MCP-Protocol-Version": meta.get(PV_KEY), "Mcp-Method": method}
    name_field = NAME_HEADER_METHODS.get(method)
    if name_field and name_field in params:
        headers["Mcp-Name"] = encode_header_value(params[name_field])
    if header_params:
        arguments = params.get("arguments") or {}
        for argument_name, header_name in header_params.items():
            if argument_name in arguments and arguments[argument_name] is not None:
                headers[f"Mcp-Param-{header_name}"] = encode_header_value(arguments[argument_name])
    return headers


def validate_http_headers(headers: dict[str, str], message: dict, header_params: dict[str, str] | None = None) -> list[str]:
    normalized = {str(key).lower(): value for key, value in headers.items()}
    params = message.get("params") or {}
    meta = params.get("_meta") or {}
    method = message.get("method")
    mismatches = []
    if normalized.get("mcp-protocol-version") != meta.get(PV_KEY):
        mismatches.append("MCP-Protocol-Version")
    if normalized.get("mcp-method") != method:
        mismatches.append("Mcp-Method")
    name_field = NAME_HEADER_METHODS.get(method)
    if name_field and name_field in params:
        expected = stringify_header_value(params[name_field])
        if decode_header_value(normalized.get("mcp-name", "")) != expected:
            mismatches.append("Mcp-Name")
    if header_params:
        arguments = params.get("arguments") or {}
        for argument_name, header_name in header_params.items():
            if argument_name not in arguments or arguments[argument_name] is None:
                continue
            expected = stringify_header_value(arguments[argument_name])
            key = f"mcp-param-{header_name}".lower()
            if decode_header_value(normalized.get(key, "")) != expected:
                mismatches.append(f"Mcp-Param-{header_name}")
    return mismatches


def handle_http_request(headers: dict[str, str], message: dict, header_params: dict[str, str] | None = None) -> tuple[int, dict | None]:
    mismatches = validate_http_headers(headers, message, header_params)
    if mismatches:
        error = make_error(
            message.get("id"), HEADER_MISMATCH, "Header mismatch: " + ", ".join(mismatches), {"headers": mismatches}
        )
        return 400, error
    return 200, None


def handle_http_get_or_delete(http_method: str) -> tuple[int, None]:
    return 405, None


def validate_origin(origin: str | None, allowed_origins: set[str]) -> tuple[int, dict | None]:
    if origin is not None and origin not in allowed_origins:
        return 403, {"error": "origin_not_allowed", "origin": origin}
    return 200, None


def handle_http_notification(message: dict) -> tuple[int, dict | None]:
    if "id" in message or not isinstance(message.get("method"), str):
        return 400, make_error(message.get("id"), INVALID_PARAMS, "Not a well-formed JSON-RPC notification")
    return 202, None


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict
    header_params: dict[str, str]
    handler: Callable[[dict], str]

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
        if not isinstance(meta.get(PV_KEY), str) or not isinstance(meta.get(CAPS_KEY), dict):
            return make_error(request_id, INVALID_PARAMS, "Missing required _meta fields")
        if message.get("method") != "tools/call":
            return make_error(request_id, INVALID_PARAMS, "This lesson server only implements tools/call")
        name = params.get("name")
        tool = self.tools.get(name)
        if tool is None:
            return make_error(request_id, INVALID_PARAMS, f"Unknown tool: {name}")
        arguments = params.get("arguments") or {}
        text = tool.handler(arguments)
        return make_result(request_id, content=[{"type": "text", "text": text}], isError=False, _meta=self._server_meta())


class Client:
    def __init__(self, server: Server) -> None:
        self.server = server
        self.next_id = 0
        self.log: list[Any] = []

    def _next_id(self) -> int:
        self.next_id += 1
        return self.next_id

    def _build_request(self, tool: Tool, arguments: dict) -> dict:
        return make_request(self._next_id(), "tools/call", {"name": tool.name, "arguments": arguments})

    def call_stdio(self, tool: Tool, arguments: dict) -> dict:
        request = self._build_request(tool, arguments)
        response = self.server.handle(request)
        self.log.append(request)
        self.log.append(response)
        return response

    def call_http(self, tool: Tool, arguments: dict) -> dict:
        request = self._build_request(tool, arguments)
        headers = build_http_headers(request, tool.header_params)
        self.log.append({"http": {"headers": headers}, "message": request})
        status, error = handle_http_request(headers, request, tool.header_params)
        if error is not None:
            self.log.append({"http": {"status": status}, "message": error})
            return error
        response = self.server.handle(request)
        self.log.append({"http": {"status": 200}, "message": response})
        return response

    def call_http_with_header_mismatch(self, tool: Tool, arguments: dict, reason: str) -> dict:
        request = self._build_request(tool, arguments)
        headers = build_http_headers(request, tool.header_params)
        headers["Mcp-Method"] = "prompts/get"
        self.log.append({"violation": reason, "http": {"headers": headers}, "message": request})
        status, error = handle_http_request(headers, request, tool.header_params)
        self.log.append({"http": {"status": status}, "message": error})
        return error


def build_server() -> Server:
    server = Server("geo-reports")
    server.add(Tool(
        name="run_report",
        description="Run a usage report for one cloud region.",
        input_schema={
            "type": "object",
            "properties": {
                "region": {"type": "string", "description": "Cloud region to query.", "x-mcp-header": "Region"},
                "dataset": {"type": "string", "description": "Dataset name."},
            },
            "required": ["region", "dataset"],
        },
        header_params={"region": "Region"},
        handler=lambda args: f"{args['dataset']} in {args['region']}: 128 rows",
    ))
    return server


def run_scenario() -> Client:
    client = Client(build_server())
    tool = client.server.tools["run_report"]
    arguments = {"region": "us-west1", "dataset": "signups"}
    client.call_stdio(tool, arguments)
    client.call_http(tool, arguments)
    client.call_http_with_header_mismatch(
        tool, arguments, "Mcp-Method says prompts/get but the JSON-RPC method in the body is tools/call"
    )
    return client


def transcript() -> list[Any]:
    return run_scenario().log


def demo() -> None:
    sample = make_request(1, "tools/call", {"name": "run_report", "arguments": {"region": "us-west1", "dataset": "signups"}})
    framed = frame_message(sample)
    print("stdio frame (newline-delimited, one JSON-RPC message per line):")
    print(" ", framed.rstrip("\n")[:120], "...")
    print("parses back to the same message:", parse_frames(framed) == [sample])
    print()
    print("value encoding at the HTTP boundary:")
    for value in ("us-west1", "Hello, 世界", " padded ", "line1\nline2"):
        print(f"  {value!r:22} -> {encode_header_value(value)}")
    print()
    client = run_scenario()
    for entry in client.log:
        message = entry["message"] if isinstance(entry, dict) and "message" in entry else entry
        tag = "wire "
        if isinstance(entry, dict):
            if entry.get("violation"):
                tag = "viol "
            elif "http" in entry:
                tag = "http "
        print(" ", tag, json.dumps(message, sort_keys=True)[:150])


if __name__ == "__main__":
    demo()
