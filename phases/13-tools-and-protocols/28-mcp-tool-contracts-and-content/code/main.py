"""Phase 13 Lesson 28: MCP tool contracts and content.
Lesson: ../docs/en.md
Specification: https://modelcontextprotocol.io/specification/2026-07-28/server/tools
Utilities: completion and pagination in the MCP 2026-07-28 specification.
This example uses only Python's standard library.
"""

from __future__ import annotations

import base64
import json
import re
from dataclasses import dataclass
from typing import Any


PROTOCOL_VERSION = "2026-07-28"
PROTOCOL_META = "io.modelcontextprotocol/protocolVersion"
CAPABILITIES_META = "io.modelcontextprotocol/clientCapabilities"
CLIENT_INFO_META = "io.modelcontextprotocol/clientInfo"
SERVER_INFO_META = "io.modelcontextprotocol/serverInfo"
HEADER_TOKEN = re.compile(r"[!#$%&'*+\-.^_`|~0-9A-Za-z]+")
BASE64_SENTINEL_PREFIX = "=?base64?"
BASE64_SENTINEL_SUFFIX = "?="
JS_SAFE_INTEGER_MIN = -(2**53) + 1
JS_SAFE_INTEGER_MAX = 2**53 - 1
MAX_TOOL_LIST_PAGES = 100
SENSITIVE_NAMES = {
    "api_key",
    "apikey",
    "authorization",
    "password",
    "secret",
    "token",
}


class ContractViolation(ValueError):
    """Raised when a descriptor or result violates the enforced contract."""


@dataclass
class McpError(Exception):
    code: int
    message: str
    data: dict[str, Any] | None = None


def request_meta() -> dict[str, Any]:
    return {
        PROTOCOL_META: PROTOCOL_VERSION,
        CAPABILITIES_META: {"completions": {}},
        CLIENT_INFO_META: {"name": "contract-client", "version": "1.0.0"},
    }


def server_meta() -> dict[str, Any]:
    return {SERVER_INFO_META: {"name": "contract-lab", "version": "1.0.0"}}


def complete(**fields: Any) -> dict[str, Any]:
    return {"resultType": "complete", **fields, "_meta": server_meta()}


def validate_request_meta(params: dict[str, Any]) -> None:
    meta = params.get("_meta")
    if not isinstance(meta, dict):
        raise McpError(-32602, "missing request _meta")
    version = meta.get(PROTOCOL_META)
    if not isinstance(version, str):
        raise McpError(-32602, "missing protocol version")
    if version != PROTOCOL_VERSION:
        raise McpError(
            -32022,
            "unsupported protocol version",
            {"supported": [PROTOCOL_VERSION], "requested": version},
        )
    if not isinstance(meta.get(CAPABILITIES_META), dict):
        raise McpError(-32602, "missing client capabilities")


def _matches_type(value: Any, expected: str) -> bool:
    if expected == "null":
        return value is None
    if expected == "boolean":
        return isinstance(value, bool)
    if expected == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if expected == "string":
        return isinstance(value, str)
    if expected == "array":
        return isinstance(value, list)
    if expected == "object":
        return isinstance(value, dict)
    raise ContractViolation(f"unsupported schema type at validation boundary: {expected}")


def validate_json_schema(value: Any, schema: dict[str, Any], path: str = "$") -> None:
    """Validate the small JSON Schema 2020-12 subset used by this lesson."""

    if not isinstance(schema, dict):
        raise ContractViolation(f"{path}: schema must be an object")
    if "enum" in schema and value not in schema["enum"]:
        raise ContractViolation(f"{path}: value is not in enum")

    expected = schema.get("type")
    if expected is not None:
        if not isinstance(expected, str) or not _matches_type(value, expected):
            raise ContractViolation(f"{path}: expected {expected}")

    if isinstance(value, dict):
        properties = schema.get("properties", {})
        required = schema.get("required", [])
        if not isinstance(properties, dict) or not isinstance(required, list):
            raise ContractViolation(f"{path}: malformed object schema")
        for name in required:
            if name not in value:
                raise ContractViolation(f"{path}.{name}: required property missing")
        for name, item in value.items():
            if name in properties:
                validate_json_schema(item, properties[name], f"{path}.{name}")
            elif schema.get("additionalProperties") is False:
                raise ContractViolation(f"{path}.{name}: additional property rejected")

    if isinstance(value, list) and "items" in schema:
        for index, item in enumerate(value):
            validate_json_schema(item, schema["items"], f"{path}[{index}]")

    if isinstance(value, str):
        minimum = schema.get("minLength")
        if isinstance(minimum, int) and len(value) < minimum:
            raise ContractViolation(f"{path}: string is shorter than minLength")


def iter_header_annotation_nodes(
    node: Any,
    path: tuple[str | int, ...] = (),
) -> list[tuple[tuple[str | int, ...], dict[str, Any]]]:
    """Find x-mcp-header anywhere, including combinators and definitions."""

    found: list[tuple[tuple[str | int, ...], dict[str, Any]]] = []
    if isinstance(node, dict):
        if "x-mcp-header" in node:
            found.append((path, node))
        for key, child in node.items():
            if isinstance(child, (dict, list)):
                found.extend(iter_header_annotation_nodes(child, (*path, key)))
    elif isinstance(node, list):
        for index, child in enumerate(node):
            if isinstance(child, (dict, list)):
                found.extend(iter_header_annotation_nodes(child, (*path, index)))
    return found


def validate_header_annotations(tool: dict[str, Any]) -> list[tuple[tuple[str, ...], str]]:
    """Validate x-mcp-header plus a deployment policy for sensitive fields."""

    input_schema = tool.get("inputSchema")
    if not isinstance(input_schema, dict):
        raise ContractViolation("inputSchema must be an object")
    headers: list[tuple[tuple[str, ...], str]] = []
    seen: set[str] = set()
    for schema_path, property_schema in iter_header_annotation_nodes(input_schema):
        if (
            len(schema_path) != 2
            or schema_path[0] != "properties"
            or not isinstance(schema_path[1], str)
        ):
            raise ContractViolation(
                "x-mcp-header is allowed only on a direct inputSchema property"
            )
        property_name = schema_path[1]
        header_name = property_schema["x-mcp-header"]
        if not isinstance(header_name, str) or not HEADER_TOKEN.fullmatch(header_name):
            raise ContractViolation("x-mcp-header must be a valid HTTP field-name token")
        lowered = header_name.lower()
        if lowered in seen:
            raise ContractViolation("x-mcp-header names must be unique ignoring case")
        seen.add(lowered)
        if property_schema.get("type") not in {"string", "integer", "boolean"}:
            raise ContractViolation("x-mcp-header requires string, integer, or boolean")
        if property_name.lower() in SENSITIVE_NAMES or lowered in SENSITIVE_NAMES:
            raise ContractViolation("sensitive arguments must not be mirrored to headers")
        headers.append(((property_name,), header_name))
    return headers


def validate_tool_descriptor(tool: dict[str, Any]) -> None:
    if not isinstance(tool.get("name"), str) or not tool["name"]:
        raise ContractViolation("tool name must be a non-empty string")
    input_schema = tool.get("inputSchema")
    if not isinstance(input_schema, dict) or input_schema.get("type") != "object":
        raise ContractViolation("inputSchema must be an object schema")
    output_schema = tool.get("outputSchema")
    if output_schema is not None and not isinstance(output_schema, dict):
        raise ContractViolation("outputSchema must be a JSON Schema object")
    if output_schema is not None and iter_header_annotation_nodes(output_schema):
        raise ContractViolation("x-mcp-header is not allowed in outputSchema")
    validate_header_annotations(tool)


def _validate_base64(value: Any, field: str) -> None:
    if not isinstance(value, str):
        raise ContractViolation(f"{field} must be a base64 string")
    try:
        base64.b64decode(value, validate=True)
    except (ValueError, base64.binascii.Error) as exc:
        raise ContractViolation(f"{field} is not valid base64") from exc


def validate_content_block(block: dict[str, Any]) -> None:
    if not isinstance(block, dict):
        raise ContractViolation("content block must be an object")
    block_type = block.get("type")
    if block_type == "text":
        if not isinstance(block.get("text"), str):
            raise ContractViolation("text content requires text")
    elif block_type in {"image", "audio"}:
        _validate_base64(block.get("data"), f"{block_type}.data")
        if not isinstance(block.get("mimeType"), str):
            raise ContractViolation(f"{block_type} content requires mimeType")
    elif block_type == "resource_link":
        if not all(isinstance(block.get(field), str) for field in ("uri", "name")):
            raise ContractViolation("resource_link requires uri and name")
    elif block_type == "resource":
        resource = block.get("resource")
        if not isinstance(resource, dict) or not isinstance(resource.get("uri"), str):
            raise ContractViolation("embedded resource requires a uri")
        if "text" not in resource and "blob" not in resource:
            raise ContractViolation("embedded resource requires text or blob")
    else:
        raise ContractViolation(f"unknown content block type: {block_type}")


def validate_tool_result(tool: dict[str, Any], result: dict[str, Any]) -> None:
    if result.get("resultType") != "complete":
        raise ContractViolation("tool result must be complete")
    content = result.get("content")
    if not isinstance(content, list) or not content:
        raise ContractViolation("tool result must contain at least one content block")
    for block in content:
        validate_content_block(block)

    output_schema = tool.get("outputSchema")
    if output_schema is not None:
        if "structuredContent" not in result:
            raise ContractViolation("outputSchema requires structuredContent")
        validate_json_schema(result["structuredContent"], output_schema)
        if not any(block.get("type") == "text" for block in content):
            raise ContractViolation("structured results require compatibility text")


def _descriptor(
    name: str,
    description: str,
    input_schema: dict[str, Any],
    output_schema: dict[str, Any],
) -> dict[str, Any]:
    return {
        "name": name,
        "description": description,
        "inputSchema": input_schema,
        "outputSchema": output_schema,
    }


TOOLS = [
    _descriptor(
        "tag_catalog",
        "Return an array of tags to prove structuredContent is not object-only.",
        {"type": "object", "additionalProperties": False},
        {"type": "array", "items": {"type": "string"}},
    ),
    _descriptor(
        "evidence_bundle",
        "Return text, media, a resource link, and an embedded resource.",
        {"type": "object", "additionalProperties": False},
        {
            "type": "object",
            "properties": {
                "artifact": {"type": "string"},
                "blockCount": {"type": "integer"},
            },
            "required": ["artifact", "blockCount"],
            "additionalProperties": False,
        },
    ),
    _descriptor(
        "route_report",
        "Route a report by a non-sensitive region argument.",
        {
            "type": "object",
            "properties": {
                "region": {"type": "string", "x-mcp-header": "Region"},
                "report": {"type": "string", "minLength": 1},
            },
            "required": ["region", "report"],
            "additionalProperties": False,
        },
        {
            "type": "object",
            "properties": {
                "region": {"type": "string"},
                "accepted": {"type": "boolean"},
            },
            "required": ["region", "accepted"],
            "additionalProperties": False,
        },
    ),
    _descriptor(
        "blocked_secret_route",
        "Deliberately unsafe descriptor used to exercise client rejection.",
        {
            "type": "object",
            "properties": {
                "token": {"type": "string", "x-mcp-header": "Token"},
            },
            "required": ["token"],
            "additionalProperties": False,
        },
        {"type": "boolean"},
    ),
]


class ContractServer:
    def __init__(self) -> None:
        self.completion_calls: dict[str, int] = {}

    def server_discover(self, params: dict[str, Any]) -> dict[str, Any]:
        validate_request_meta(params)
        return complete(
            supportedVersions=[PROTOCOL_VERSION],
            capabilities={"tools": {"listChanged": False}, "completions": {}},
            ttlMs=300_000,
            cacheScope="public",
        )

    def tools_list(self, params: dict[str, Any]) -> dict[str, Any]:
        validate_request_meta(params)
        ordered = sorted(TOOLS, key=lambda tool: tool["name"])
        has_cursor = "cursor" in params
        cursor = params.get("cursor")
        if not has_cursor:
            page = ordered[:2]
            next_cursor: str | None = ""
        elif cursor == "":
            page = ordered[2:]
            next_cursor = None
        else:
            raise McpError(-32602, "invalid cursor")
        fields: dict[str, Any] = {
            "tools": page,
            "ttlMs": 60_000,
            "cacheScope": "public",
        }
        if next_cursor is not None:
            fields["nextCursor"] = next_cursor
        return complete(**fields)

    def tools_call(self, params: dict[str, Any]) -> dict[str, Any]:
        validate_request_meta(params)
        name = params.get("name")
        tool = next((item for item in TOOLS if item["name"] == name), None)
        if tool is None:
            raise McpError(-32602, "unknown tool")
        arguments = params.get("arguments", {})
        if not isinstance(arguments, dict):
            raise McpError(-32602, "arguments must be an object")
        try:
            validate_json_schema(arguments, tool["inputSchema"])
        except ContractViolation as exc:
            return complete(
                content=[{"type": "text", "text": str(exc)}],
                isError=True,
            )

        if name == "tag_catalog":
            structured: Any = ["contracts", "mcp", "stateless"]
            return complete(
                content=[{"type": "text", "text": json.dumps(structured)}],
                structuredContent=structured,
                isError=False,
            )
        if name == "evidence_bundle":
            structured = {"artifact": "contract-report", "blockCount": 5}
            return complete(
                content=[
                    {"type": "text", "text": json.dumps(structured, sort_keys=True)},
                    {"type": "image", "data": "iVBORw0KGgo=", "mimeType": "image/png"},
                    {"type": "audio", "data": "UklGRg==", "mimeType": "audio/wav"},
                    {
                        "type": "resource_link",
                        "uri": "evidence://contract-report",
                        "name": "contract-report",
                        "mimeType": "application/json",
                    },
                    {
                        "type": "resource",
                        "resource": {
                            "uri": "evidence://contract-report/summary",
                            "mimeType": "text/plain",
                            "text": "All contract checks passed.",
                        },
                    },
                ],
                structuredContent=structured,
                isError=False,
            )
        if name == "route_report":
            if arguments["report"] == "unavailable":
                return complete(
                    content=[{"type": "text", "text": "Report source is unavailable."}],
                    structuredContent={
                        "region": arguments["region"],
                        "accepted": False,
                    },
                    isError=True,
                )
            structured = {"region": arguments["region"], "accepted": True}
            return complete(
                content=[{"type": "text", "text": json.dumps(structured, sort_keys=True)}],
                structuredContent=structured,
                isError=False,
            )
        structured = True
        return complete(
            content=[{"type": "text", "text": "true"}],
            structuredContent=structured,
            isError=False,
        )

    def completion_complete(
        self,
        params: dict[str, Any],
        *,
        principal: str,
    ) -> dict[str, Any]:
        validate_request_meta(params)
        self.completion_calls[principal] = self.completion_calls.get(principal, 0) + 1
        if self.completion_calls[principal] > 3:
            raise McpError(-32029, "completion rate limit exceeded")

        reference = params.get("ref")
        argument = params.get("argument")
        if reference != {"type": "ref/prompt", "name": "deployment_review"}:
            raise McpError(-32602, "unknown completion reference")
        if not isinstance(argument, dict) or argument.get("name") != "environment":
            raise McpError(-32602, "unknown completion argument")
        prefix = argument.get("value")
        if not isinstance(prefix, str):
            raise McpError(-32602, "completion value must be a string")

        allowed = {
            "analyst": ["development", "staging"],
            "operator": ["development", "production", "staging"],
        }.get(principal, [])
        matches = [item for item in allowed if item.startswith(prefix)]
        return complete(
            completion={"values": matches[:100], "total": len(matches), "hasMore": False}
        )

    def dispatch(
        self,
        request: dict[str, Any],
        *,
        principal: str = "analyst",
    ) -> dict[str, Any] | None:
        is_notification = "id" not in request
        request_id = request.get("id")
        try:
            params = request.get("params", {})
            if not isinstance(params, dict):
                raise McpError(-32602, "params must be an object")
            method = request.get("method")
            if method == "server/discover":
                result = self.server_discover(params)
            elif method == "tools/list":
                result = self.tools_list(params)
            elif method == "tools/call":
                result = self.tools_call(params)
            elif method == "completion/complete":
                result = self.completion_complete(params, principal=principal)
            else:
                raise McpError(-32601, "method not found")
            if is_notification:
                return None
            return {"jsonrpc": "2.0", "id": request_id, "result": result}
        except McpError as exc:
            if is_notification:
                return None
            error: dict[str, Any] = {"code": exc.code, "message": exc.message}
            if exc.data is not None:
                error["data"] = exc.data
            return {"jsonrpc": "2.0", "id": request_id, "error": error}


def make_request(request_id: int, method: str, params: dict[str, Any]) -> dict[str, Any]:
    return {
        "jsonrpc": "2.0",
        "id": request_id,
        "method": method,
        "params": {**params, "_meta": request_meta()},
    }


MISSING = object()


def _read_path(arguments: dict[str, Any], path: tuple[str, ...]) -> Any:
    value: Any = arguments
    for segment in path:
        if not isinstance(value, dict) or segment not in value:
            return MISSING
        value = value[segment]
    return value


def _parameter_text(value: Any, expected_type: str) -> str:
    if expected_type == "string" and isinstance(value, str):
        return value
    if expected_type == "boolean" and isinstance(value, bool):
        return "true" if value else "false"
    if expected_type == "integer" and isinstance(value, int) and not isinstance(value, bool):
        if not JS_SAFE_INTEGER_MIN <= value <= JS_SAFE_INTEGER_MAX:
            raise ContractViolation("mirrored integer is outside the JavaScript safe range")
        return str(value)
    raise ContractViolation(f"mirrored value does not match declared {expected_type} type")


def _is_plain_visible_ascii(value: str) -> bool:
    return bool(value) and all(0x21 <= ord(character) <= 0x7E for character in value)


def encode_parameter_header_value(value: str) -> str:
    """Apply MCP's exact sentinel encoding when plain transport is ambiguous."""

    sentinel_looking = value.startswith(BASE64_SENTINEL_PREFIX)
    if _is_plain_visible_ascii(value) and not sentinel_looking:
        return value
    payload = base64.b64encode(value.encode("utf-8")).decode("ascii")
    return f"{BASE64_SENTINEL_PREFIX}{payload}{BASE64_SENTINEL_SUFFIX}"


def decode_parameter_header_value(value: str) -> str:
    """Decode a canonical MCP parameter-header value at the HTTP boundary."""

    if not isinstance(value, str):
        raise ContractViolation("parameter header value must be a string")
    if value.startswith(BASE64_SENTINEL_PREFIX):
        if not value.endswith(BASE64_SENTINEL_SUFFIX):
            raise ContractViolation("parameter header uses a malformed base64 sentinel")
        payload = value[len(BASE64_SENTINEL_PREFIX) : -len(BASE64_SENTINEL_SUFFIX)]
        try:
            raw = base64.b64decode(payload, validate=True)
            decoded = raw.decode("utf-8")
        except (ValueError, UnicodeDecodeError, base64.binascii.Error) as exc:
            raise ContractViolation("parameter header uses invalid base64 UTF-8") from exc
        if base64.b64encode(raw).decode("ascii") != payload:
            raise ContractViolation("parameter header base64 is not canonical")
        return decoded
    if not _is_plain_visible_ascii(value):
        raise ContractViolation("plain parameter header is not visible ASCII")
    return value


def build_parameter_headers(
    tool: dict[str, Any],
    arguments: dict[str, Any],
    audit_log: list[dict[str, Any]],
) -> dict[str, str]:
    headers: dict[str, str] = {}
    encoded_names: list[str] = []
    properties = tool["inputSchema"].get("properties", {})
    for path, name in validate_header_annotations(tool):
        value = _read_path(arguments, path)
        if value is MISSING:
            continue
        property_schema = properties[path[0]]
        rendered = _parameter_text(value, property_schema["type"])
        header_name = f"Mcp-Param-{name}"
        encoded = encode_parameter_header_value(rendered)
        headers[header_name] = encoded
        if encoded != rendered:
            encoded_names.append(header_name)
    audit_log.append(
        {
            "event": "parameter_headers_built",
            "headerNames": sorted(headers),
            "encodedHeaderNames": sorted(encoded_names),
        }
    )
    return headers


def validate_parameter_headers(
    tool: dict[str, Any],
    arguments: dict[str, Any],
    headers: dict[str, str],
    audit_log: list[dict[str, Any]],
) -> None:
    """Compare recognized parameter headers with body arguments exactly."""

    normalized: dict[str, list[tuple[str, str]]] = {}
    for supplied_name, supplied_value in headers.items():
        normalized.setdefault(supplied_name.casefold(), []).append(
            (supplied_name, supplied_value)
        )

    checked_names: list[str] = []
    properties = tool["inputSchema"].get("properties", {})
    for path, suffix in validate_header_annotations(tool):
        expected_name = f"Mcp-Param-{suffix}"
        supplied = normalized.get(expected_name.casefold(), [])
        body_value = _read_path(arguments, path)
        if body_value is MISSING:
            if supplied:
                raise ContractViolation("recognized parameter header has no body argument")
            continue
        if not supplied:
            raise ContractViolation("recognized parameter header is missing")
        if len(supplied) != 1:
            raise ContractViolation("recognized parameter header is duplicated")
        decoded = decode_parameter_header_value(supplied[0][1])
        expected = _parameter_text(body_value, properties[path[0]]["type"])
        if decoded != expected:
            raise ContractViolation("recognized parameter header does not match the body")
        checked_names.append(expected_name)

    audit_log.append(
        {
            "event": "parameter_headers_validated",
            "headerNames": sorted(checked_names),
        }
    )


def streamable_http_tool_call(
    server: ContractServer,
    request: dict[str, Any],
    headers: dict[str, str],
    audit_log: list[dict[str, Any]],
    *,
    principal: str = "analyst",
) -> tuple[int, dict[str, Any] | None]:
    """Model the Streamable HTTP parity gate before JSON-RPC dispatch."""

    if request.get("method") == "tools/call":
        params = request.get("params")
        if isinstance(params, dict):
            arguments = params.get("arguments")
            tool = next((item for item in TOOLS if item["name"] == params.get("name")), None)
            if tool is not None and isinstance(arguments, dict):
                try:
                    validate_parameter_headers(tool, arguments, headers, audit_log)
                except ContractViolation as exc:
                    return 400, {
                        "jsonrpc": "2.0",
                        "id": request.get("id"),
                        "error": {
                            "code": -32020,
                            "message": "parameter headers do not match request body",
                            "data": {"reason": str(exc)},
                        },
                    }
    return 200, server.dispatch(request, principal=principal)


class ContractClient:
    def __init__(
        self,
        server: ContractServer,
        *,
        principal: str = "analyst",
        max_list_pages: int = MAX_TOOL_LIST_PAGES,
    ) -> None:
        if type(max_list_pages) is not int or max_list_pages <= 0:
            raise ContractViolation("tools/list page limit must be a positive integer")
        self.server = server
        self.principal = principal
        self.max_list_pages = max_list_pages
        self.rejections: list[dict[str, str]] = []
        self.cursor_trace: list[str | None] = []
        self.tools: dict[str, dict[str, Any]] = {}

    def discover_tools(self) -> dict[str, dict[str, Any]]:
        cursor: str | None = None
        request_id = 1
        seen_cursors: set[str] = set()
        for _ in range(self.max_list_pages):
            params: dict[str, Any] = {}
            if cursor is not None:
                params["cursor"] = cursor
            self.cursor_trace.append(cursor)
            response = self.server.dispatch(make_request(request_id, "tools/list", params))
            if response is None or "error" in response:
                raise ContractViolation("tools/list failed")
            result = response["result"]
            for tool in result["tools"]:
                try:
                    validate_tool_descriptor(tool)
                except ContractViolation as exc:
                    self.rejections.append({"tool": tool.get("name", "<unknown>"), "reason": str(exc)})
                    continue
                self.tools[tool["name"]] = tool
            next_cursor = result.get("nextCursor")
            if next_cursor is None:
                return self.tools
            if not isinstance(next_cursor, str):
                raise ContractViolation("tools/list nextCursor must be a string or null")
            if next_cursor in seen_cursors:
                raise ContractViolation("tools/list returned a repeated or cyclic nextCursor")
            seen_cursors.add(next_cursor)
            cursor = next_cursor
            request_id += 1
        raise ContractViolation(
            f"tools/list exceeded the page limit of {self.max_list_pages}"
        )

    def call(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        if not self.tools:
            self.discover_tools()
        tool = self.tools.get(name)
        if tool is None:
            raise ContractViolation(f"tool is not admitted: {name}")
        response = self.server.dispatch(
            make_request(20, "tools/call", {"name": name, "arguments": arguments}),
            principal=self.principal,
        )
        if response is None or "error" in response:
            raise ContractViolation("tools/call returned a protocol error")
        validate_tool_result(tool, response["result"])
        return response["result"]

    def complete_environment(self, prefix: str) -> list[str]:
        response = self.server.dispatch(
            make_request(
                30,
                "completion/complete",
                {
                    "ref": {"type": "ref/prompt", "name": "deployment_review"},
                    "argument": {"name": "environment", "value": prefix},
                },
            ),
            principal=self.principal,
        )
        if response is None or "error" in response:
            raise ContractViolation("completion request failed")
        return response["result"]["completion"]["values"]


def main() -> None:
    server = ContractServer()
    client = ContractClient(server)
    tools = client.discover_tools()
    tags = client.call("tag_catalog", {})
    bundle = client.call("evidence_bundle", {})
    audit_log: list[dict[str, Any]] = []
    route_tool = tools["route_report"]
    headers = build_parameter_headers(
        route_tool,
        {"region": "europe-λ", "report": "quarterly"},
        audit_log,
    )
    http_status, _ = streamable_http_tool_call(
        server,
        make_request(
            40,
            "tools/call",
            {
                "name": "route_report",
                "arguments": {"region": "europe-λ", "report": "quarterly"},
            },
        ),
        {name.lower(): value for name, value in headers.items()},
        audit_log,
    )

    print("visible tools:", ", ".join(sorted(tools)))
    print("rejected tools:", ", ".join(item["tool"] for item in client.rejections))
    print("cursor trace:", ["<first>" if item is None else repr(item) for item in client.cursor_trace])
    print("array structuredContent:", tags["structuredContent"])
    print("content block types:", [block["type"] for block in bundle["content"]])
    print("mirrored header names:", sorted(headers))
    print("encoded parameter value:", headers["Mcp-Param-Region"].startswith(BASE64_SENTINEL_PREFIX))
    print("HTTP parity status:", http_status)
    print("audit event:", audit_log[0])
    print("analyst completions:", client.complete_environment(""))


if __name__ == "__main__":
    main()
