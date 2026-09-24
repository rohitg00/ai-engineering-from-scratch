"""Companion code for:
certifications/mcpa/lessons/25-consent-and-least-privilege/docs/en.md
A consent broker that elicits approval for sensitive tool calls and steps up OAuth scope on a
403 challenge.
Sources: MCP 2026-07-28 Elicitation page and Authorization page (step-up authorization).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
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

CLIENT_CAPABILITIES = {"elicitation": {"form": {}}}
REQUEST_STATE_SECRET = b"mcpa-lesson-25-demo-secret-do-not-reuse"
MAX_STEP_UP_ATTEMPTS = 3


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


def _arguments_digest(arguments: dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(arguments, sort_keys=True).encode("utf-8")).hexdigest()


def _sign_request_state(payload: dict[str, Any]) -> str:
    body = json.dumps(payload, sort_keys=True).encode("utf-8")
    digest = hmac.new(REQUEST_STATE_SECRET, body, hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(body).decode("ascii") + "." + digest


def _open_request_state(token: Any) -> dict[str, Any] | None:
    if not isinstance(token, str) or "." not in token:
        return None
    body_b64, _, digest = token.partition(".")
    try:
        body = base64.urlsafe_b64decode(body_b64.encode("ascii"))
    except Exception:
        return None
    expected = hmac.new(REQUEST_STATE_SECRET, body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, digest):
        return None
    try:
        return json.loads(body)
    except Exception:
        return None


def union_scopes(previous: Any, challenge: Any) -> frozenset:
    return frozenset(previous) | frozenset(challenge)


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict[str, Any]
    annotations: dict[str, bool]
    handler: Callable[[dict[str, Any]], dict[str, Any]]
    required_scope: str | None = None

    def definition(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "inputSchema": self.input_schema,
            "annotations": self.annotations,
        }

    def needs_consent(self) -> bool:
        if self.annotations.get("readOnlyHint", False):
            return bool(self.annotations.get("openWorldHint", True))
        return bool(self.annotations.get("destructiveHint", True) or self.annotations.get("openWorldHint", True))


@dataclass
class ConsentGate:
    approved: set[str] = field(default_factory=set)

    def grant(self, tool_name: str) -> None:
        self.approved.add(tool_name)

    def has(self, tool_name: str) -> bool:
        return tool_name in self.approved


@dataclass
class Server:
    name: str
    tools: dict[str, Tool] = field(default_factory=dict)
    gate: ConsentGate = field(default_factory=ConsentGate)
    consumed_states: set[str] = field(default_factory=set)
    filesystem: list[str] = field(default_factory=lambda: ["report.csv", "notes.txt"])

    def add(self, tool: Tool) -> None:
        self.tools[tool.name] = tool

    def _server_meta(self) -> dict[str, Any]:
        return {SERVER_INFO_KEY: {"name": self.name, "version": "1.0.0"}}

    def handle(self, message: dict[str, Any], scopes: frozenset = frozenset()) -> dict[str, Any]:
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
                ttlMs=120000,
                cacheScope="public",
                _meta=self._server_meta(),
            )
        if method == "tools/list":
            visible = [
                tool.definition()
                for name, tool in sorted(self.tools.items())
                if tool.required_scope is None or tool.required_scope in scopes
            ]
            return make_result(request_id, tools=visible, ttlMs=60000, cacheScope="private", _meta=self._server_meta())
        if method == "tools/call":
            return self._call(request_id, params, scopes)
        return make_error(request_id, METHOD_NOT_FOUND, f"Method not found: {method}")

    def _call(self, request_id: Any, params: dict[str, Any], scopes: frozenset) -> dict[str, Any]:
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
        if tool.required_scope is not None and tool.required_scope not in scopes:
            return {"scopeChallenge": [tool.required_scope]}
        if tool.needs_consent() and not self.gate.has(name):
            input_responses = params.get("inputResponses")
            request_state = params.get("requestState")
            if isinstance(input_responses, dict) and "confirm" in input_responses:
                return self._resolve_consent(request_id, tool, arguments, input_responses["confirm"], request_state)
            return self._elicit_consent(request_id, tool, arguments)
        return self._run(request_id, tool, arguments)

    def _elicit_consent(self, request_id: Any, tool: Tool, arguments: dict[str, Any]) -> dict[str, Any]:
        state = _sign_request_state({"tool": tool.name, "argsDigest": _arguments_digest(arguments), "issuedFor": request_id})
        return make_result(
            request_id,
            result_type="input_required",
            inputRequests={
                "confirm": {
                    "method": "elicitation/create",
                    "params": {
                        "mode": "form",
                        "message": f"Allow {tool.name} to run with arguments {json.dumps(arguments, sort_keys=True)}?",
                        "requestedSchema": {
                            "type": "object",
                            "properties": {"approved": {"type": "boolean", "title": "Approve this call", "default": False}},
                            "required": ["approved"],
                        },
                    },
                }
            },
            requestState=state,
        )

    def _resolve_consent(self, request_id: Any, tool: Tool, arguments: dict[str, Any], confirm_response: dict[str, Any],
                          request_state: Any) -> dict[str, Any]:
        payload = _open_request_state(request_state)
        if payload is None or payload.get("tool") != tool.name:
            return make_result(
                request_id,
                content=[{"type": "text", "text": "This confirmation does not match a consent request this server issued. Call the tool again to request fresh consent."}],
                isError=True,
                _meta=self._server_meta(),
            )
        if request_state in self.consumed_states:
            return make_result(
                request_id,
                content=[{"type": "text", "text": "This consent confirmation has already been used and cannot be replayed. Call the tool again to request fresh consent."}],
                isError=True,
                _meta=self._server_meta(),
            )
        if payload.get("argsDigest") != _arguments_digest(arguments):
            return make_result(
                request_id,
                content=[{"type": "text", "text": "The arguments on this retry do not match what the user was asked to approve. Refusing to run."}],
                isError=True,
                _meta=self._server_meta(),
            )
        self.consumed_states.add(request_state)
        response = confirm_response if isinstance(confirm_response, dict) else {}
        action = response.get("action")
        content = response.get("content")
        if action != "accept" or not isinstance(content, dict) or content.get("approved") is not True:
            return make_result(
                request_id,
                content=[{"type": "text", "text": f"The user did not approve {tool.name} (action: {action}). The call did not run."}],
                isError=True,
                _meta=self._server_meta(),
            )
        self.gate.grant(tool.name)
        return self._run(request_id, tool, arguments)

    def _run(self, request_id: Any, tool: Tool, arguments: dict[str, Any]) -> dict[str, Any]:
        output = tool.handler(arguments)
        return make_result(
            request_id,
            content=[{"type": "text", "text": output["text"]}],
            structuredContent=output["data"],
            isError=False,
            _meta=self._server_meta(),
        )


@dataclass
class Client:
    server: Server
    next_id: int = 0
    log: list[Any] = field(default_factory=list)

    def _fresh_id(self) -> int:
        self.next_id += 1
        return self.next_id

    def send(self, method: str, params: dict | None = None, scopes: frozenset = frozenset()) -> dict[str, Any]:
        request = make_request(self._fresh_id(), method, params, capabilities=CLIENT_CAPABILITIES)
        response = self.server.handle(request, scopes=scopes)
        self.log.extend([request, response])
        return response

    def discover(self) -> dict:
        return self.send("server/discover")["result"]

    def list_tools(self, scopes: frozenset = frozenset()) -> list[dict]:
        return self.send("tools/list", scopes=scopes)["result"]["tools"]

    def call(self, name: str, arguments: dict[str, Any], scopes: frozenset = frozenset(), input_responses: dict | None = None,
             request_state: Any = None, violation: str | None = None) -> dict[str, Any]:
        params: dict[str, Any] = {"name": name, "arguments": arguments}
        if input_responses is not None:
            params["inputResponses"] = input_responses
        if request_state is not None:
            params["requestState"] = request_state
        request = make_request(self._fresh_id(), "tools/call", params, capabilities=CLIENT_CAPABILITIES)
        response = self.server.handle(request, scopes=scopes)
        if violation is not None:
            self.log.append({"violation": violation, "message": request})
        else:
            self.log.append(request)
        self.log.append(response)
        return response

    def call_with_step_up(self, name: str, arguments: dict[str, Any], scopes: Any,
                           authorize: Callable[[frozenset], frozenset]) -> tuple[dict[str, Any], frozenset]:
        granted = frozenset(scopes)
        attempts = 0
        while True:
            request = make_request(self._fresh_id(), "tools/call", {"name": name, "arguments": arguments}, capabilities=CLIENT_CAPABILITIES)
            response = self.server.handle(request, scopes=granted)
            if "scopeChallenge" not in response:
                self.log.extend([request, response])
                return response, granted
            challenge = frozenset(response["scopeChallenge"])
            attempts += 1
            if attempts > MAX_STEP_UP_ATTEMPTS:
                raise PermissionError(f"gave up requesting step-up authorization for {name!r} after {attempts - 1} attempt(s)")
            self.log.append({
                "http": {
                    "status": 403,
                    "headers": {
                        "MCP-Protocol-Version": PROTOCOL_VERSION,
                        "Mcp-Method": "tools/call",
                        "Mcp-Name": name,
                        "WWW-Authenticate": (
                            'Bearer error="insufficient_scope", scope="' + " ".join(sorted(challenge)) +
                            '", resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource"'
                        ),
                    },
                },
                "message": request,
            })
            granted = authorize(union_scopes(granted, challenge))


def build_files_server() -> Server:
    server = Server("files")

    def list_files(arguments: dict[str, Any]) -> dict[str, Any]:
        return {"text": ", ".join(server.filesystem), "data": {"files": list(server.filesystem)}}

    def search_web(arguments: dict[str, Any]) -> dict[str, Any]:
        return {"text": f"3 results for {arguments['query']}", "data": {"query": arguments["query"], "count": 3}}

    def delete_file(arguments: dict[str, Any]) -> dict[str, Any]:
        path = arguments["path"]
        server.filesystem.remove(path)
        return {"text": f"Deleted {path}", "data": {"deleted": path, "remaining": list(server.filesystem)}}

    def send_payment(arguments: dict[str, Any]) -> dict[str, Any]:
        return {"text": f"Sent {arguments['amountUsd']} to {arguments['payee']}", "data": {"payee": arguments["payee"], "amountUsd": arguments["amountUsd"]}}

    server.add(Tool(
        name="list_files",
        description="List file names in the working directory.",
        input_schema={"type": "object", "additionalProperties": False},
        annotations={"readOnlyHint": True, "destructiveHint": False, "openWorldHint": False},
        handler=list_files,
    ))
    server.add(Tool(
        name="search_web",
        description="Search the open web for a query and return the top results.",
        input_schema={"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]},
        annotations={"readOnlyHint": True, "destructiveHint": False, "openWorldHint": True},
        handler=search_web,
    ))
    server.add(Tool(
        name="delete_file",
        description="Delete a file from the working directory by name.",
        input_schema={"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]},
        annotations={"readOnlyHint": False, "destructiveHint": True, "openWorldHint": False},
        handler=delete_file,
    ))
    server.add(Tool(
        name="send_payment",
        description="Send a payment in US dollars to a named payee.",
        input_schema={"type": "object", "properties": {"payee": {"type": "string"}, "amountUsd": {"type": "number"}}, "required": ["payee", "amountUsd"]},
        annotations={"readOnlyHint": False, "destructiveHint": True, "openWorldHint": True},
        required_scope="payments:write",
        handler=send_payment,
    ))
    return server


def run_scenario() -> dict[str, Any]:
    server = build_files_server()
    client = Client(server)

    client.discover()
    client.list_tools()

    read_only = client.call("list_files", {})

    denied = client.call("delete_file", {"path": "notes.txt"})
    declined = client.call(
        "delete_file", {"path": "notes.txt"},
        input_responses={"confirm": {"action": "decline"}},
        request_state=denied["result"]["requestState"],
    )

    prompted_again = client.call("delete_file", {"path": "notes.txt"})
    state_for_delete = prompted_again["result"]["requestState"]
    tampered = client.call(
        "delete_file", {"path": "report.csv"},
        input_responses={"confirm": {"action": "accept", "content": {"approved": True}}},
        request_state=state_for_delete,
        violation="retrying tools/call with different arguments than the ones the user was asked to approve; the server detects this from the signed requestState instead of trusting the retry",
    )
    approved = client.call(
        "delete_file", {"path": "notes.txt"},
        input_responses={"confirm": {"action": "accept", "content": {"approved": True}}},
        request_state=state_for_delete,
    )

    different_tool_prompt = client.call("send_payment", {"payee": "acme", "amountUsd": 40}, scopes=frozenset({"payments:write"}))

    def authorize(requested: frozenset) -> frozenset:
        return requested

    payment_response, final_scopes = client.call_with_step_up(
        "send_payment", {"payee": "acme", "amountUsd": 40}, scopes=frozenset({"payments:read"}), authorize=authorize,
    )
    payment_approved = client.call(
        "send_payment", {"payee": "acme", "amountUsd": 40}, scopes=final_scopes,
        input_responses={"confirm": {"action": "accept", "content": {"approved": True}}},
        request_state=payment_response["result"]["requestState"],
    )

    scoped_tools_before = client.list_tools(scopes=frozenset({"payments:read"}))
    scoped_tools_after = client.list_tools(scopes=frozenset({"payments:read", "payments:write"}))

    return {
        "client": client,
        "server": server,
        "read_only": read_only,
        "denied": denied,
        "declined": declined,
        "tampered": tampered,
        "approved": approved,
        "different_tool_prompt": different_tool_prompt,
        "payment_response": payment_response,
        "final_scopes": final_scopes,
        "payment_approved": payment_approved,
        "scoped_tools_before": scoped_tools_before,
        "scoped_tools_after": scoped_tools_after,
    }


def transcript() -> list[Any]:
    return run_scenario()["client"].log


def demo() -> None:
    scenario = run_scenario()
    print("read-only list_files, no prompt ->", scenario["read_only"]["result"]["resultType"], scenario["read_only"]["result"]["isError"])
    print("delete_file with no consent on record ->", scenario["denied"]["result"]["resultType"])
    print("decline ->", scenario["declined"]["result"]["content"][0]["text"])
    print("tampered retry (different arguments) ->", scenario["tampered"]["result"]["content"][0]["text"])
    print("accept after re-elicitation ->", scenario["approved"]["result"]["isError"], scenario["server"].filesystem)
    print("send_payment prompt even though delete_file is approved ->", scenario["different_tool_prompt"]["result"]["resultType"])
    print("send_payment after step-up scopes ->", sorted(scenario["final_scopes"]))
    print("send_payment approved ->", scenario["payment_approved"]["result"]["content"][0]["text"])
    print("tools/list with payments:read only ->", [tool["name"] for tool in scenario["scoped_tools_before"]])
    print("tools/list with payments:read and payments:write ->", [tool["name"] for tool in scenario["scoped_tools_after"]])
    print("union of scopes ->", sorted(union_scopes({"payments:read"}, {"payments:write"})))
    stubborn_server = build_files_server()
    stubborn_client = Client(stubborn_server)
    try:
        stubborn_client.call_with_step_up(
            "send_payment", {"payee": "mallory", "amountUsd": 999}, scopes=frozenset({"payments:read"}),
            authorize=lambda requested: frozenset({"payments:read"}),
        )
    except PermissionError as exc:
        print("retry cap enforced ->", exc)
    print("\nfull transcript")
    for message in transcript():
        print("  " + json.dumps(message, sort_keys=True)[:170])


if __name__ == "__main__":
    demo()
