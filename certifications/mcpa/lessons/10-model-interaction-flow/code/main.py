"""Companion code for:
certifications/mcpa/lessons/10-model-interaction-flow/docs/en.md
A scripted model driving one host loop over a mock server.
Sources: MCP 2026-07-28 Tools and multi round-trip requests (MRTR) pages.
"""

from __future__ import annotations

import base64
import json
import re
from dataclasses import dataclass, field
from typing import Any, Callable


PROTOCOL_VERSION = "2026-07-28"
PV_KEY = "io.modelcontextprotocol/protocolVersion"
CAPS_KEY = "io.modelcontextprotocol/clientCapabilities"
CLIENT_INFO_KEY = "io.modelcontextprotocol/clientInfo"
SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo"

INVALID_PARAMS = -32602
METHOD_NOT_FOUND = -32601

PRIORITY_REQUEST_KEY = "priority"


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


def encode_request_state(payload: dict) -> str:
    return base64.b64encode(json.dumps(payload, sort_keys=True).encode("utf-8")).decode("ascii")


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict
    handler: Callable[..., dict]
    annotations: dict = field(default_factory=dict)

    def definition(self) -> dict:
        body = {"name": self.name, "description": self.description, "inputSchema": self.input_schema}
        if self.annotations:
            body["annotations"] = self.annotations
        return body


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
        return tool.handler(request_id, arguments, params, self._server_meta())


def handle_get_forecast(request_id: Any, arguments: dict, params: dict, meta: dict) -> dict:
    if "city" not in arguments:
        return make_result(
            request_id,
            content=[{"type": "text", "text": "Missing required argument: city. Provide it and call again."}],
            isError=True,
            _meta=meta,
        )
    city = arguments["city"]
    text = f"{city}: 21C, clear skies"
    return make_result(
        request_id,
        content=[{"type": "text", "text": text}],
        structuredContent={"city": city, "celsius": 21, "sky": "clear"},
        isError=False,
        _meta=meta,
    )


def make_open_ticket_handler(tickets: dict) -> Callable[..., dict]:
    def handler(request_id: Any, arguments: dict, params: dict, meta: dict) -> dict:
        if "title" not in arguments:
            return make_result(
                request_id,
                content=[{"type": "text", "text": "Missing required argument: title. Provide it and call again."}],
                isError=True,
                _meta=meta,
            )
        title = arguments["title"]
        input_responses = params.get("inputResponses")
        if not input_responses:
            state = encode_request_state({"title": title})
            return make_result(
                request_id,
                result_type="input_required",
                inputRequests={
                    PRIORITY_REQUEST_KEY: {
                        "method": "elicitation/create",
                        "params": {
                            "mode": "form",
                            "message": "Every new ticket needs a human-confirmed priority. What priority should this ticket have?",
                            "requestedSchema": {
                                "type": "object",
                                "properties": {"priority": {"type": "string", "enum": ["low", "medium", "high"]}},
                                "required": ["priority"],
                            },
                        },
                    }
                },
                requestState=state,
            )
        answer = input_responses.get(PRIORITY_REQUEST_KEY) or {}
        if answer.get("action") != "accept":
            return make_result(
                request_id,
                content=[{"type": "text", "text": "Ticket was not opened: priority was not confirmed."}],
                isError=True,
                _meta=meta,
            )
        priority = answer.get("content", {}).get("priority", "medium")
        ticket_id = f"TCK-{len(tickets) + 1}"
        tickets[ticket_id] = {"title": title, "priority": priority}
        return make_result(
            request_id,
            content=[{"type": "text", "text": f"Opened {ticket_id}: {title} (priority {priority})"}],
            structuredContent={"id": ticket_id, "title": title, "priority": priority},
            isError=False,
            _meta=meta,
        )
    return handler


def make_close_ticket_handler(tickets: dict) -> Callable[..., dict]:
    def handler(request_id: Any, arguments: dict, params: dict, meta: dict) -> dict:
        ticket_id = arguments.get("ticket_id")
        if ticket_id not in tickets:
            return make_result(
                request_id,
                content=[{"type": "text", "text": f"Unknown ticket: {ticket_id}. It may already be closed."}],
                isError=True,
                _meta=meta,
            )
        tickets.pop(ticket_id)
        return make_result(
            request_id,
            content=[{"type": "text", "text": f"Closed {ticket_id}"}],
            isError=False,
            _meta=meta,
        )
    return handler


def build_server() -> tuple[Server, dict]:
    tickets = {
        "TCK-1": {"title": "Legacy VPN ticket", "priority": "medium"},
        "TCK-2": {"title": "Old printer request", "priority": "low"},
    }
    server = Server("helpdesk")
    server.add(Tool(
        name="get_forecast",
        description="Get today's forecast for a city, used to decide if field work should be rescheduled.",
        input_schema={"type": "object", "properties": {"city": {"type": "string"}}, "required": ["city"]},
        handler=handle_get_forecast,
        annotations={"readOnlyHint": True, "destructiveHint": False, "idempotentHint": True, "openWorldHint": True},
    ))
    server.add(Tool(
        name="open_ticket",
        description="Open a support ticket after a human confirms its priority.",
        input_schema={"type": "object", "properties": {"title": {"type": "string"}}, "required": ["title"]},
        handler=make_open_ticket_handler(tickets),
        annotations={"readOnlyHint": False, "destructiveHint": False, "idempotentHint": False, "openWorldHint": False},
    ))
    server.add(Tool(
        name="close_ticket",
        description="Close an existing support ticket.",
        input_schema={"type": "object", "properties": {"ticket_id": {"type": "string"}}, "required": ["ticket_id"]},
        handler=make_close_ticket_handler(tickets),
    ))
    return server, tickets


class Client:
    def __init__(self, server: Server) -> None:
        self.server = server
        self.next_id = 0
        self.log: list[dict] = []
        self.capabilities = {"elicitation": {"form": True}}

    def send(self, method: str, params: dict | None = None) -> dict:
        self.next_id += 1
        request = make_request(self.next_id, method, params, capabilities=self.capabilities)
        response = self.server.handle(request)
        self.log.extend([request, response])
        return response

    def discover(self) -> dict:
        return self.send("server/discover")["result"]

    def list_tools(self) -> list[dict]:
        return self.send("tools/list")["result"]["tools"]

    def call(self, name: str, arguments: dict, input_responses: dict | None = None, request_state: str | None = None) -> dict:
        params: dict[str, Any] = {"name": name, "arguments": arguments}
        if input_responses is not None:
            params["inputResponses"] = input_responses
        if request_state is not None:
            params["requestState"] = request_state
        return self.send("tools/call", params)


def requires_confirmation(annotations: dict) -> bool:
    read_only = annotations.get("readOnlyHint", False)
    destructive = annotations.get("destructiveHint", True)
    return (not read_only) and destructive


def missing_argument(error_text: str) -> str | None:
    match = re.search(r"Missing required argument: (\w+)", error_text)
    return match.group(1) if match else None


def extract_city(request_text: str) -> str | None:
    match = re.search(r"weather in ([A-Za-z ]+?)[\?\.]?$", request_text)
    return match.group(1).strip() if match else None


def extract_title(request_text: str) -> str | None:
    match = re.search(r"titled '([^']+)'", request_text)
    return match.group(1) if match else None


def extract_ticket_id(request_text: str) -> str | None:
    match = re.search(r"TCK-\d+", request_text)
    return match.group(0) if match else None


def choose_priority(title: str) -> str:
    urgent_words = ("drops", "down", "outage", "urgent")
    return "high" if any(word in title.lower() for word in urgent_words) else "medium"


def approve_close(ticket_id: str, tickets_view: dict) -> bool:
    ticket = tickets_view.get(ticket_id, {})
    return ticket.get("priority") != "low"


@dataclass
class SessionResult:
    transcript: list[dict]
    final_answer: str
    closed: list[str]
    denied: list[str]
    unsupported: list[str]
    gate_log: list[dict]


def run_session() -> SessionResult:
    server, tickets = build_server()
    client = Client(server)
    client.discover()
    context = [dict(item) for item in client.list_tools()]
    tools_by_name = {item["name"]: item for item in context}

    notes: list[str] = []
    closed: list[str] = []
    denied: list[str] = []
    unsupported: list[str] = []
    gate_log: list[dict] = []

    forecast_turn = "What is the weather in Pune?"
    response = client.call("get_forecast", {})
    result = response["result"]
    if result.get("isError"):
        field_name = missing_argument(result["content"][0]["text"])
        city = extract_city(forecast_turn) if field_name == "city" else None
        response = client.call("get_forecast", {"city": city})
        result = response["result"]
    notes.append(result["content"][0]["text"])

    ticket_turn = "Open a ticket titled 'VPN drops every hour'."
    title = extract_title(ticket_turn)
    response = client.call("open_ticket", {"title": title})
    result = response["result"]
    if result["resultType"] == "input_required":
        request_state = result["requestState"]
        priority = choose_priority(title)
        response = client.call(
            "open_ticket",
            {"title": title},
            input_responses={PRIORITY_REQUEST_KEY: {"action": "accept", "content": {"priority": priority}}},
            request_state=request_state,
        )
        result = response["result"]
    notes.append(result["content"][0]["text"])

    client.list_tools()

    close_annotations = tools_by_name["close_ticket"].get("annotations", {})
    for close_turn in ("Close ticket TCK-1, it is stale.", "Close ticket TCK-2 as well."):
        ticket_id = extract_ticket_id(close_turn)
        proposed_inputs = {"ticket_id": ticket_id}
        gate_required = requires_confirmation(close_annotations)
        approve = gate_required and approve_close(ticket_id, tickets)
        gate_log.append({"tool": "close_ticket", "arguments": proposed_inputs, "gated": gate_required, "approved": approve})
        if not gate_required or approve:
            response = client.call("close_ticket", proposed_inputs)
            notes.append(response["result"]["content"][0]["text"])
            closed.append(ticket_id)
        else:
            denied.append(ticket_id)
            notes.append(f"Held {ticket_id}: a low-priority ticket needs a second reviewer before it can close.")

    response = client.call("archive_ticket", {})
    if "error" in response:
        unsupported.append("archive_ticket")
        notes.append("archive_ticket is not offered by this server; the model did not retry the same call.")

    final_answer = " ".join(notes)
    return SessionResult(
        transcript=client.log,
        final_answer=final_answer,
        closed=closed,
        denied=denied,
        unsupported=unsupported,
        gate_log=gate_log,
    )


def transcript() -> list[dict]:
    return run_session().transcript


def demo() -> None:
    result = run_session()
    print("wire transcript (host to client to server)")
    for message in result.transcript:
        print("  " + json.dumps(message, sort_keys=True)[:170])
    print("\nconfirmation gate: inputs shown to a human before a destructive call")
    for entry in result.gate_log:
        decision = "approved" if entry["approved"] else "denied"
        print(f"  {entry['tool']}{entry['arguments']} -> {decision}")
    print("\nclosed:", result.closed)
    print("denied:", result.denied)
    print("unsupported:", result.unsupported)
    print("\nfinal answer handed back to the user")
    print(" ", result.final_answer)


if __name__ == "__main__":
    demo()
