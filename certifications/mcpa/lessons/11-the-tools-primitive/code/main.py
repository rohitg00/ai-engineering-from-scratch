"""Companion code for:
certifications/mcpa/lessons/11-the-tools-primitive/docs/en.md
Calling a tool and reading every shape its result can take.
Sources: MCP 2026-07-28 Tools and Subscriptions pages.
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
SUBSCRIPTION_ID_KEY = "io.modelcontextprotocol/subscriptionId"

INVALID_PARAMS = -32602
METHOD_NOT_FOUND = -32601

PAGE_SIZE = 2

ANNOTATION_DEFAULTS = {
    "readOnlyHint": False,
    "destructiveHint": True,
    "idempotentHint": False,
    "openWorldHint": True,
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


def _start_for_cursor(cursor: Any) -> int | None:
    if cursor is None:
        return 0
    if not isinstance(cursor, str):
        return None
    if cursor == "":
        return 4
    if cursor.isdigit():
        return int(cursor)
    return None


def _cursor_for_start(index: int) -> str:
    return "" if index == 4 else str(index)


def render_for_audience(blocks: list[dict], audience: str) -> list[dict]:
    visible = []
    for block in blocks:
        declared = (block.get("annotations") or {}).get("audience")
        if not declared or audience in declared:
            visible.append(block)
    return visible


def effective_tool_annotations(tool_definition: dict) -> dict:
    declared = tool_definition.get("annotations") or {}
    return {**ANNOTATION_DEFAULTS, **declared}


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict
    handler: Callable[[dict], dict]
    output_schema: dict | None = None
    annotations: dict | None = None

    def definition(self) -> dict:
        body = {"name": self.name, "description": self.description, "inputSchema": self.input_schema}
        if self.output_schema is not None:
            body["outputSchema"] = self.output_schema
        if self.annotations is not None:
            body["annotations"] = self.annotations
        return body


@dataclass
class Server:
    name: str
    tools: dict[str, Tool] = field(default_factory=dict)
    pending_notifications: list[dict] = field(default_factory=list)

    def add_tool(self, tool: Tool) -> None:
        self.tools[tool.name] = tool

    def _server_meta(self) -> dict:
        return {SERVER_INFO_KEY: {"name": self.name, "version": "1.0.0"}}

    def _meta_error(self, request_id: Any, meta: Any) -> dict | None:
        if not isinstance(meta, dict) or PV_KEY not in meta or CAPS_KEY not in meta:
            return make_error(request_id, INVALID_PARAMS, "Missing required _meta fields")
        return None

    def handle(self, message: dict) -> dict:
        request_id = message.get("id")
        method = message.get("method")
        params = message.get("params") or {}
        error = self._meta_error(request_id, params.get("_meta"))
        if error is not None:
            return error
        if method == "tools/list":
            return self._list_tools(request_id, params.get("cursor"))
        if method == "tools/call":
            return self._call_tool(request_id, params)
        return make_error(request_id, METHOD_NOT_FOUND, f"Unexpected method for this lesson: {method}")

    def _list_tools(self, request_id: Any, cursor: Any) -> dict:
        start = _start_for_cursor(cursor)
        names = sorted(self.tools)
        if start is None or start > len(names):
            return make_error(request_id, INVALID_PARAMS, f"Invalid cursor: {cursor!r}")
        end = start + PAGE_SIZE
        page = [self.tools[name].definition() for name in names[start:end]]
        fields: dict[str, Any] = {"tools": page, "ttlMs": 300000, "cacheScope": "public", "_meta": self._server_meta()}
        if end < len(names):
            fields["nextCursor"] = _cursor_for_start(end)
        return make_result(request_id, **fields)

    def _call_tool(self, request_id: Any, params: dict) -> dict:
        name = params.get("name")
        tool = self.tools.get(name)
        if tool is None:
            return make_error(request_id, INVALID_PARAMS, f"Unknown tool: {name}")
        arguments = params.get("arguments") or {}
        outcome = tool.handler(arguments)
        fields: dict[str, Any] = {"content": outcome["content"], "_meta": self._server_meta()}
        if "structuredContent" in outcome:
            fields["structuredContent"] = outcome["structuredContent"]
        if outcome.get("isError"):
            fields["isError"] = True
        return make_result(request_id, **fields)

    def acknowledge_subscription(self, request: dict) -> dict:
        requested = (request.get("params") or {}).get("notifications") or {}
        honored = {key: value for key, value in requested.items() if key == "toolsListChanged" and value}
        return {
            "jsonrpc": "2.0",
            "method": "notifications/subscriptions/acknowledged",
            "params": {"notifications": honored, "_meta": {SUBSCRIPTION_ID_KEY: request["id"]}},
        }

    def queue_tools_list_changed(self, subscription_id: Any) -> None:
        self.pending_notifications.append({
            "jsonrpc": "2.0",
            "method": "notifications/tools/list_changed",
            "params": {"_meta": {SUBSCRIPTION_ID_KEY: subscription_id}},
        })

    def pop_notification(self) -> dict:
        return self.pending_notifications.pop(0)

    def close_subscription(self, subscription_id: Any) -> dict:
        return {
            "jsonrpc": "2.0",
            "id": subscription_id,
            "result": {"resultType": "complete", "_meta": {SUBSCRIPTION_ID_KEY: subscription_id}},
        }


class Client:
    def __init__(self, server: Server) -> None:
        self.server = server
        self.next_id = 0
        self.log: list[dict] = []

    def _new_id(self) -> int:
        self.next_id += 1
        return self.next_id

    def send(self, method: str, params: dict | None = None) -> dict:
        request = make_request(self._new_id(), method, params)
        response = self.server.handle(request)
        self.log.extend([request, response])
        return response

    def list_tools_page(self, cursor: str | None = None) -> dict:
        params = {"cursor": cursor} if cursor is not None else {}
        return self.send("tools/list", params)

    def list_all_tool_definitions(self) -> list[dict]:
        definitions: list[dict] = []
        cursor = None
        while True:
            result = self.list_tools_page(cursor)["result"]
            definitions.extend(result["tools"])
            if "nextCursor" not in result:
                return definitions
            cursor = result["nextCursor"]

    def call(self, name: str, arguments: dict) -> dict:
        return self.send("tools/call", {"name": name, "arguments": arguments})

    def open_listen(self, notification_filter: dict) -> dict:
        request = make_request(self._new_id(), "subscriptions/listen", {"notifications": notification_filter})
        ack = self.server.acknowledge_subscription(request)
        self.log.extend([request, ack])
        return request

    def expect_list_changed(self) -> dict:
        notification = self.server.pop_notification()
        self.log.append(notification)
        return notification

    def close_listen(self, listen_request: dict) -> dict:
        result = self.server.close_subscription(listen_request["id"])
        self.log.append(result)
        return result


def _summarize_ticket(args: dict) -> dict:
    summary = {"id": args["ticket_id"], "title": "VPN drops every hour", "status": "open"}
    return {
        "content": [{"type": "text", "text": json.dumps(summary)}],
        "structuredContent": summary,
    }


def build_tool_server() -> Server:
    server = Server("release-desk")
    server.add_tool(Tool(
        name="describe_release",
        description="Describe the current release train in one line.",
        input_schema={"type": "object", "additionalProperties": False},
        handler=lambda args: {
            "content": [{"type": "text", "text": "release-desk 4.2.0 ships Friday; three incidents are open."}],
        },
    ))
    server.add_tool(Tool(
        name="summarize_ticket",
        description="Summarize one support ticket by id.",
        input_schema={
            "type": "object",
            "properties": {"ticket_id": {"type": "string"}},
            "required": ["ticket_id"],
        },
        output_schema={
            "type": "object",
            "properties": {
                "id": {"type": "string"},
                "title": {"type": "string"},
                "status": {"type": "string"},
            },
            "required": ["id", "title", "status"],
        },
        handler=_summarize_ticket,
    ))
    server.add_tool(Tool(
        name="render_badge",
        description="Render a status badge image for a release.",
        input_schema={
            "type": "object",
            "properties": {"status": {"type": "string", "enum": ["green", "yellow", "red"]}},
            "required": ["status"],
        },
        annotations={"readOnlyHint": True},
        handler=lambda args: {
            "content": [{
                "type": "image",
                "data": "iVBORfakebadgedataforlesson11==",
                "mimeType": "image/png",
                "annotations": {"audience": ["user"], "priority": 0.9},
            }],
        },
    ))
    server.add_tool(Tool(
        name="speak_greeting",
        description="Synthesize a short spoken greeting for a teammate.",
        input_schema={
            "type": "object",
            "properties": {"name": {"type": "string"}},
            "required": ["name"],
        },
        handler=lambda args: {
            "content": [{
                "type": "audio",
                "data": "UklGRfakewavedataforlesson11==",
                "mimeType": "audio/wav",
            }],
        },
    ))
    server.add_tool(Tool(
        name="get_readme_link",
        description="Point at the project README instead of inlining it.",
        input_schema={"type": "object", "additionalProperties": False},
        handler=lambda args: {
            "content": [{
                "type": "resource_link",
                "uri": "file:///project/README.md",
                "name": "README.md",
                "description": "Project overview and setup",
                "mimeType": "text/markdown",
            }],
        },
    ))
    server.add_tool(Tool(
        name="embed_config",
        description="Embed the release desk's current threshold configuration.",
        input_schema={"type": "object", "additionalProperties": False},
        annotations={"readOnlyHint": True, "idempotentHint": True},
        handler=lambda args: {
            "content": [{
                "type": "resource",
                "resource": {
                    "uri": "config://release-desk/thresholds",
                    "mimeType": "application/json",
                    "text": json.dumps({"maxOpenIncidents": 5}),
                },
                "annotations": {
                    "audience": ["user", "assistant"],
                    "priority": 0.7,
                    "lastModified": "2026-07-01T00:00:00Z",
                },
            }],
        },
    ))
    return server


def build_triage_incident_tool() -> Tool:
    return Tool(
        name="triage_incident",
        description="Open a triage task for the release's most urgent incident.",
        input_schema={"type": "object", "additionalProperties": False},
        annotations={"destructiveHint": False, "idempotentHint": False},
        handler=lambda args: {"content": [{"type": "text", "text": "Triage task opened for INC-201."}]},
    )


def run_tool_scenario() -> Client:
    client = Client(build_tool_server())
    client.list_all_tool_definitions()
    client.call("describe_release", {})
    client.call("summarize_ticket", {"ticket_id": "TCK-9"})
    client.call("render_badge", {"status": "yellow"})
    client.call("speak_greeting", {"name": "Priya"})
    client.call("get_readme_link", {})
    client.call("embed_config", {})
    client.call("archive_release", {})
    listen_request = client.open_listen({"toolsListChanged": True})
    client.server.add_tool(build_triage_incident_tool())
    client.server.queue_tools_list_changed(listen_request["id"])
    client.expect_list_changed()
    client.list_all_tool_definitions()
    client.close_listen(listen_request)
    return client


def transcript() -> list[dict]:
    return run_tool_scenario().log


def demo() -> None:
    client = run_tool_scenario()
    print("full transcript, request by request")
    for message in client.log:
        print("  " + json.dumps(message, sort_keys=True)[:170])

    badge = client.call("render_badge", {"status": "green"})
    blocks = badge["result"]["content"]
    print("\nrender_badge content kept for the user:", render_for_audience(blocks, "user"))
    print("render_badge content kept for the assistant:", render_for_audience(blocks, "assistant"))

    fresh = build_tool_server()
    print("\neffective annotations, render_badge:", effective_tool_annotations(fresh.tools["render_badge"].definition()))
    print("effective annotations, speak_greeting (none declared):", effective_tool_annotations(fresh.tools["speak_greeting"].definition()))


if __name__ == "__main__":
    demo()
