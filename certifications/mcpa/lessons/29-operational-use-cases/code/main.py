"""Companion code for:
certifications/mcpa/lessons/29-operational-use-cases/docs/en.md
A use-case recommender mapping operational scenarios to MCP primitives, transport, auth,
extensions, and cache scope.
Sources: MCP extensions overview; MCP 2026-07-28 Authorization page.
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
UNSUPPORTED_PROTOCOL_VERSION = -32022

TASKS_EXTENSION = "io.modelcontextprotocol/tasks"
UI_EXTENSION = "io.modelcontextprotocol/ui"
SKILLS_EXTENSION = "io.modelcontextprotocol/skills"
CLIENT_CREDENTIALS_EXTENSION = "io.modelcontextprotocol/oauth-client-credentials"
ENTERPRISE_AUTH_EXTENSION = "io.modelcontextprotocol/enterprise-managed-authorization"

PRIMITIVE_BY_INITIATOR = {"model": "tool", "system": "tool", "application": "resource", "user": "prompt"}


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


@dataclass
class UseCaseProfile:
    name: str
    initiator: str
    data_sensitivity: str
    duration: str
    ui_need: str
    human_present: bool
    locality: str
    external_system: bool = True
    reusable_workflow: bool = False
    enterprise_managed: bool = False


@dataclass
class Recommendation:
    use_case: str
    recommended: bool
    primitive: str | None
    transport: str | None
    auth: str | None
    extensions: list[str]
    cache_scope: str | None
    consent: str
    observability: str
    reasoning: list[str]


def recommend(profile: UseCaseProfile) -> Recommendation:
    reasoning: list[str] = []
    if not profile.external_system:
        reasoning.append(
            "no external system or shared context crosses a process boundary here, and MCP's value is "
            "interoperability across hosts and servers, so a direct in-process function call is simpler "
            "than standing up a server for it"
        )
        return Recommendation(
            use_case=profile.name, recommended=False, primitive=None, transport=None, auth=None,
            extensions=[], cache_scope=None, consent="not applicable", observability="not applicable",
            reasoning=reasoning,
        )

    primitive = PRIMITIVE_BY_INITIATOR[profile.initiator]
    if profile.initiator == "system":
        reasoning.append(f"an unattended caller still exercises this as a model-controlled action once invoked, so it takes the shape of a {primitive} call")
    else:
        reasoning.append(f"the {profile.initiator} initiates this action, and MCP assigns control of a {primitive} to that party")

    transport = "stdio" if profile.locality == "local" else "streamable-http"
    reasoning.append(f"the system behind this use case runs {profile.locality}ly, so {transport} is the fitting transport")

    extensions: list[str] = []
    if profile.duration == "long":
        extensions.append(TASKS_EXTENSION)
        reasoning.append(
            "the work runs long enough that a blocking request risks a transport timeout, so the tasks "
            "extension returns a durable taskId to poll instead of holding the connection open"
        )
    if profile.ui_need == "interactive":
        extensions.append(UI_EXTENSION)
        reasoning.append(
            "the result is easier to explore as an interactive surface than as plain text, so MCP Apps "
            "renders it in a sandboxed iframe, with a meaningful text fallback for a host without the extension"
        )
    if profile.reusable_workflow:
        extensions.append(SKILLS_EXTENSION)
        reasoning.append(
            "this is a cataloged multi-step procedure rather than a single call, so Skills over MCP serves "
            "its instructions and supporting files through resources/read"
        )

    if transport == "stdio":
        auth = "credentials read from the environment; stdio implementations should not run an OAuth flow"
        reasoning.append("stdio servers run as a trusted local subprocess, so there is no redirect to broker")
    elif profile.initiator == "system" and not profile.human_present:
        auth = "the OAuth client credentials authorization extension, authenticating the machine directly"
        extensions.append(CLIENT_CREDENTIALS_EXTENSION)
        reasoning.append("no human is present to approve a redirect, so a client credentials grant authenticates the caller as a machine identity")
    elif profile.enterprise_managed:
        auth = "the Enterprise-Managed Authorization extension, applying central identity provider policy"
        extensions.append(ENTERPRISE_AUTH_EXTENSION)
        reasoning.append("the deployment sits inside an organization with a central identity provider, so IdP policy replaces a one-off per-server grant")
    else:
        auth = "the core authorization framework's interactive OAuth 2.1 code flow with PKCE"
        reasoning.append("a human is present over a remote transport, so the interactive authorization code flow applies")

    cache_scope = "private" if profile.data_sensitivity == "private" else "public"
    reasoning.append(f"the data behind this use case is {profile.data_sensitivity}, so its cacheable results carry cacheScope {cache_scope!r}")

    if not profile.human_present:
        consent = "no interactive consent; the caller acts within a pre-authorized scope"
    elif profile.data_sensitivity == "private" or profile.duration == "long":
        consent = "an MRTR elicitation confirms the action or the missing detail before the server proceeds"
    else:
        consent = "a host-level approval dialog before the call is enough; no elicitation round trip is required"

    observability = (
        "trace context (traceparent, tracestate) propagates through _meta, and the audit record keys on "
        "the authenticated principal, never on the self-reported clientInfo"
    )

    return Recommendation(
        use_case=profile.name, recommended=True, primitive=primitive, transport=transport, auth=auth,
        extensions=extensions, cache_scope=cache_scope, consent=consent, observability=observability,
        reasoning=reasoning,
    )


CATALOG: list[UseCaseProfile] = [
    UseCaseProfile(name="developer tools: code search", initiator="model", data_sensitivity="private",
                    duration="instant", ui_need="none", human_present=True, locality="local"),
    UseCaseProfile(name="data access: ticket context", initiator="application", data_sensitivity="private",
                    duration="instant", ui_need="none", human_present=True, locality="remote"),
    UseCaseProfile(name="enterprise systems of record: HR update", initiator="model", data_sensitivity="private",
                    duration="instant", ui_need="none", human_present=True, locality="remote", enterprise_managed=True),
    UseCaseProfile(name="workflow automation: deploy pipeline", initiator="model", data_sensitivity="private",
                    duration="long", ui_need="none", human_present=True, locality="remote"),
    UseCaseProfile(name="interactive UI: usage dashboard", initiator="model", data_sensitivity="private",
                    duration="instant", ui_need="interactive", human_present=True, locality="remote"),
    UseCaseProfile(name="reusable workflow: code review skill", initiator="user", data_sensitivity="public",
                    duration="instant", ui_need="none", human_present=True, locality="remote", reusable_workflow=True),
    UseCaseProfile(name="machine-to-machine: nightly sync", initiator="system", data_sensitivity="private",
                    duration="instant", ui_need="none", human_present=False, locality="remote"),
    UseCaseProfile(name="in-process formatting: no external system", initiator="model", data_sensitivity="public",
                    duration="instant", ui_need="none", human_present=True, locality="local", external_system=False),
]


@dataclass
class ToolDef:
    name: str
    description: str
    input_schema: dict
    handler: Callable[[dict, dict], str]

    def definition(self) -> dict:
        return {"name": self.name, "description": self.description, "inputSchema": self.input_schema}


@dataclass
class Server:
    name: str
    tools: dict[str, ToolDef] = field(default_factory=dict)

    def add(self, tool: ToolDef) -> None:
        self.tools[tool.name] = tool

    def _server_meta(self) -> dict:
        return {SERVER_INFO_KEY: {"name": self.name, "version": "1.0.0"}}

    def handle(self, message: dict) -> dict:
        request_id = message.get("id")
        params = message.get("params") or {}
        meta = params.get("_meta") or {}
        if not isinstance(meta.get(PV_KEY), str) or not isinstance(meta.get(CAPS_KEY), dict):
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
                capabilities={"tools": {"listChanged": False}, "extensions": {UI_EXTENSION: {}}},
                instructions="Search internal docs or open the usage dashboard.",
                ttlMs=600000,
                cacheScope="public",
                _meta=self._server_meta(),
            )
        if method == "tools/list":
            tools = [self.tools[name].definition() for name in sorted(self.tools)]
            return make_result(request_id, tools=tools, ttlMs=300000, cacheScope="private", _meta=self._server_meta())
        if method == "tools/call":
            return self._call(request_id, params, meta)
        return make_error(request_id, METHOD_NOT_FOUND, f"Method not found: {method}")

    def _call(self, request_id: Any, params: dict, meta: dict) -> dict:
        name = params.get("name")
        tool = self.tools.get(name)
        if tool is None:
            return make_error(request_id, INVALID_PARAMS, f"Unknown tool: {name}")
        arguments = params.get("arguments") or {}
        capabilities = meta.get(CAPS_KEY) or {}
        text = tool.handler(arguments, capabilities)
        return make_result(request_id, content=[{"type": "text", "text": text}], isError=False, _meta=self._server_meta())


def handle_search(arguments: dict, capabilities: dict) -> str:
    query = arguments.get("query", "")
    return f"3 matches for '{query}': onboarding.md, access-policy.md, oncall-runbook.md"


def handle_dashboard(arguments: dict, capabilities: dict) -> str:
    extensions = capabilities.get("extensions") or {}
    if UI_EXTENSION in extensions:
        return "usage dashboard: 42 active users, 3 alerts (rendered as an interactive ui://usage-dashboard surface)"
    return "usage dashboard: 42 active users, 3 alerts (interactive chart unavailable without the io.modelcontextprotocol/ui extension)"


def build_opsdesk_server() -> Server:
    server = Server("opsdesk")
    server.add(ToolDef(
        name="search_internal_docs",
        description="Search the internal knowledge base.",
        input_schema={"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]},
        handler=handle_search,
    ))
    server.add(ToolDef(
        name="usage_dashboard",
        description="Show a usage dashboard; falls back to a text summary without the ui extension.",
        input_schema={"type": "object", "additionalProperties": False},
        handler=handle_dashboard,
    ))
    return server


class Client:
    def __init__(self, server: Server) -> None:
        self.server = server
        self.next_id = 0
        self.log: list[dict] = []

    def send(self, method: str, params: dict | None = None, capabilities: dict | None = None,
              version: str = PROTOCOL_VERSION) -> dict:
        self.next_id += 1
        request = make_request(self.next_id, method, params, capabilities=capabilities, version=version)
        response = self.server.handle(request)
        self.log.extend([request, response])
        return response

    def discover(self) -> dict:
        return self.send("server/discover")["result"]

    def list_tools(self) -> list[dict]:
        return self.send("tools/list")["result"]["tools"]

    def call(self, name: str, arguments: dict, capabilities: dict | None = None) -> dict:
        return self.send("tools/call", {"name": name, "arguments": arguments}, capabilities=capabilities)


def run_scenario() -> Client:
    client = Client(build_opsdesk_server())
    client.discover()
    client.list_tools()
    client.call("search_internal_docs", {"query": "onboarding checklist"})
    client.call("usage_dashboard", {})
    client.call("usage_dashboard", {}, capabilities={"extensions": {UI_EXTENSION: {}}})
    client.call("open_incident_bridge", {})
    return client


def transcript() -> list[dict]:
    return run_scenario().log


def demo() -> None:
    print("operational use case catalog")
    for profile in CATALOG:
        rec = recommend(profile)
        print(f"\n{profile.name}")
        if not rec.recommended:
            print("  not a good fit for MCP:", rec.reasoning[0])
            continue
        print("  primitive:   ", rec.primitive)
        print("  transport:   ", rec.transport)
        print("  auth:        ", rec.auth)
        print("  extensions:  ", rec.extensions or ["none"])
        print("  cache scope: ", rec.cache_scope)
        print("  consent:     ", rec.consent)
    client = run_scenario()
    print("\nopsdesk server exchanges")
    for message in client.log:
        print("  " + json.dumps(message, sort_keys=True)[:160])


if __name__ == "__main__":
    demo()
