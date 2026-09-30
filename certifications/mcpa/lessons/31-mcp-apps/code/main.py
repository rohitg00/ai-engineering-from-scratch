"""Companion code for:
certifications/mcpa/lessons/31-mcp-apps/docs/en.md
A host-side loader that constructs CSP from declared domains, grants only the permissions its
own policy allows, enforces tool visibility, and falls back to text otherwise.
Sources: SEP-1865; MCP Apps specification 2026-01-26 (ext-apps).
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any


PROTOCOL_VERSION = "2026-07-28"
PV_KEY = "io.modelcontextprotocol/protocolVersion"
CAPS_KEY = "io.modelcontextprotocol/clientCapabilities"
CLIENT_INFO_KEY = "io.modelcontextprotocol/clientInfo"
SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo"

UI_EXTENSION = "io.modelcontextprotocol/ui"
UI_CAPS = {"extensions": {UI_EXTENSION: {}}}
UI_MIME_TYPE = "text/html;profile=mcp-app"
DEFAULT_VISIBILITY = ("model", "app")

TOOL_NAME = "sales_by_region"
REFRESH_TOOL_NAME = "refresh_sales_view"
EXPORT_TOOL_NAME = "export_sales_report"
RESOURCE_URI = "ui://dashboard/sales-by-region.html"
LEGACY_RESOURCE_URI = "ui://dashboard/legacy-widget.html"
UNTRUSTED_RESOURCE_URI = "ui://dashboard/scripts-widget.html"
MINIMAL_RESOURCE_URI = "ui://dashboard/minimal-widget.html"

HOST_TRUSTED_DOMAINS = {"https://cdn.trusted-charts.example", "https://api.sales-metrics.example"}
HOST_GRANTED_PERMISSIONS = {"camera"}

RESTRICTIVE_DEFAULT_CSP = (
    "default-src 'none'; script-src 'self' 'unsafe-inline'; "
    "style-src 'self' 'unsafe-inline'; img-src 'self' data:; "
    "media-src 'self' data:; connect-src 'none'"
)

METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602
UNSUPPORTED_PROTOCOL_VERSION = -32022


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


def _resource_catalog() -> dict[str, dict]:
    return {
        RESOURCE_URI: {
            "mimeType": UI_MIME_TYPE,
            "text": "<!doctype html><html><body>Interactive sales-by-region view.</body></html>",
            "ui": {
                "csp": {
                    "connectDomains": ["https://api.sales-metrics.example"],
                    "resourceDomains": ["https://cdn.trusted-charts.example"],
                },
                "permissions": {"camera": {}, "geolocation": {}},
                "prefersBorder": True,
            },
        },
        LEGACY_RESOURCE_URI: {
            "mimeType": "text/html",
            "text": "<!doctype html><html><body>Legacy widget, no mcp-app profile.</body></html>",
            "ui": {
                "csp": {"resourceDomains": ["https://cdn.trusted-charts.example"]},
                "permissions": {},
            },
        },
        UNTRUSTED_RESOURCE_URI: {
            "mimeType": UI_MIME_TYPE,
            "text": "<!doctype html><html><body>Widget that wants a second script origin.</body></html>",
            "ui": {
                "csp": {"resourceDomains": ["https://cdn.trusted-charts.example", "https://evil.example.net"]},
                "permissions": {},
            },
        },
        MINIMAL_RESOURCE_URI: {
            "mimeType": UI_MIME_TYPE,
            "text": "<!doctype html><html><body>No external origins declared.</body></html>",
            "ui": {},
        },
    }


@dataclass
class Server:
    name: str
    resources: dict[str, dict] = field(default_factory=_resource_catalog)
    capabilities: dict = field(default_factory=lambda: {
        "tools": {"listChanged": False},
        "resources": {"listChanged": False, "subscribe": False},
        "extensions": {UI_EXTENSION: {}},
    })

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
            return self._discover(request_id)
        if method == "tools/list":
            return self._list_tools(request_id)
        if method == "tools/call":
            return self._call_tool(request_id, params)
        if method == "resources/list":
            return self._list_resources(request_id)
        if method == "resources/read":
            return self._read_resource(request_id, params)
        return make_error(request_id, METHOD_NOT_FOUND, f"Method not found: {method}")

    def _discover(self, request_id: Any) -> dict:
        return make_result(
            request_id,
            "complete",
            supportedVersions=[PROTOCOL_VERSION],
            capabilities=self.capabilities,
            ttlMs=300000,
            cacheScope="public",
            _meta=self._server_meta(),
        )

    def _list_tools(self, request_id: Any) -> dict:
        tools = [
            {
                "name": TOOL_NAME,
                "description": "Show sales for each region for a chosen metric.",
                "inputSchema": {
                    "type": "object",
                    "properties": {"metric": {"type": "string"}},
                    "required": ["metric"],
                },
                "_meta": {"ui": {"resourceUri": RESOURCE_URI}},
            },
            {
                "name": REFRESH_TOOL_NAME,
                "description": "Refresh the sales view's underlying data without a new model turn.",
                "inputSchema": {"type": "object", "additionalProperties": False},
                "_meta": {"ui": {"resourceUri": RESOURCE_URI, "visibility": ["app"]}},
            },
            {
                "name": EXPORT_TOOL_NAME,
                "description": "Export the current sales view as a report.",
                "inputSchema": {"type": "object", "additionalProperties": False},
                "_meta": {"ui": {"resourceUri": RESOURCE_URI, "visibility": ["model"]}},
            },
        ]
        return make_result(request_id, "complete", tools=tools, ttlMs=300000, cacheScope="public", _meta=self._server_meta())

    def _call_tool(self, request_id: Any, params: dict) -> dict:
        name = params.get("name")
        arguments = params.get("arguments") or {}
        if name == TOOL_NAME:
            if "metric" not in arguments:
                return make_result(
                    request_id,
                    "complete",
                    content=[{"type": "text", "text": "Missing required argument: metric. Provide it and call again."}],
                    isError=True,
                    _meta=self._server_meta(),
                )
            metric = arguments["metric"]
            text = f"Sales by region for {metric}: north 41, south 33, east 28, west 37."
            structured = {"metric": metric, "regions": {"north": 41, "south": 33, "east": 28, "west": 37}}
            return make_result(
                request_id,
                "complete",
                content=[{"type": "text", "text": text}],
                structuredContent=structured,
                isError=False,
                _meta=self._server_meta(),
            )
        if name == REFRESH_TOOL_NAME:
            return make_result(request_id, "complete", content=[{"type": "text", "text": "Sales view refreshed."}], isError=False, _meta=self._server_meta())
        if name == EXPORT_TOOL_NAME:
            return make_result(request_id, "complete", content=[{"type": "text", "text": "Report exported as sales-report.pdf."}], isError=False, _meta=self._server_meta())
        return make_error(request_id, INVALID_PARAMS, f"Unknown tool: {name}")

    def _list_resources(self, request_id: Any) -> dict:
        entry = self.resources[RESOURCE_URI]
        listing = {
            "uri": RESOURCE_URI,
            "name": "Sales by region",
            "description": "Interactive sales-by-region view.",
            "mimeType": entry["mimeType"],
        }
        return make_result(request_id, "complete", resources=[listing], ttlMs=300000, cacheScope="public", _meta=self._server_meta())

    def _read_resource(self, request_id: Any, params: dict) -> dict:
        uri = params.get("uri")
        entry = self.resources.get(uri)
        if entry is None:
            return make_error(request_id, INVALID_PARAMS, f"Resource not found: {uri}", {"uri": uri})
        content = {"uri": uri, "mimeType": entry["mimeType"], "text": entry["text"], "_meta": {"ui": entry["ui"]}}
        return make_result(request_id, "complete", contents=[content], ttlMs=60000, cacheScope="public", _meta=self._server_meta())


class Client:
    def __init__(self, server: Server) -> None:
        self.server = server
        self.next_id = 0
        self.log: list[dict] = []

    def send(self, method: str, params: dict | None = None, capabilities: dict | None = None,
              version: str = PROTOCOL_VERSION) -> dict:
        self.next_id += 1
        request = make_request(self.next_id, method, params, capabilities, version)
        response = self.server.handle(request)
        self.log.extend([request, response])
        return response


def negotiated_extensions(client_capabilities: dict, server_capabilities: dict) -> set[str]:
    client_extensions = set((client_capabilities or {}).get("extensions") or {})
    server_extensions = set((server_capabilities or {}).get("extensions") or {})
    return client_extensions & server_extensions


def tool_visibility(tool: dict) -> tuple:
    ui_meta = ((tool.get("_meta") or {}).get("ui")) or {}
    return tuple(ui_meta.get("visibility", DEFAULT_VISIBILITY))


def agent_visible_tools(tools: list[dict]) -> list[dict]:
    return [tool for tool in tools if "model" in tool_visibility(tool)]


def build_csp(csp: dict | None) -> str:
    if not csp:
        return RESTRICTIVE_DEFAULT_CSP + "; frame-src 'none'; base-uri 'self'"
    resource_sources = " ".join(csp.get("resourceDomains") or [])

    def with_resources(base: str) -> str:
        return f"{base} {resource_sources}" if resource_sources else base

    directives = [
        "default-src 'none'",
        with_resources("script-src 'self' 'unsafe-inline'"),
        with_resources("style-src 'self' 'unsafe-inline'"),
        with_resources("img-src 'self' data:"),
        with_resources("media-src 'self' data:"),
    ]
    if resource_sources:
        directives.append(f"font-src {resource_sources}")
    connect_domains = csp.get("connectDomains") or []
    directives.append("connect-src " + (" ".join(connect_domains) if connect_domains else "'none'"))
    frame_domains = csp.get("frameDomains") or []
    directives.append("frame-src " + (" ".join(frame_domains) if frame_domains else "'none'"))
    base_uri_domains = csp.get("baseUriDomains") or []
    directives.append("base-uri " + (" ".join(base_uri_domains) if base_uri_domains else "'self'"))
    directives.append("object-src 'none'")
    return "; ".join(directives)


def review_app_resource(content: dict, host_trusted_domains: set[str]) -> dict:
    mime_type = content.get("mimeType")
    if mime_type != UI_MIME_TYPE:
        return {"accepted": False, "reason": f"mimeType {mime_type!r} is not {UI_MIME_TYPE!r}"}
    ui_meta = ((content.get("_meta") or {}).get("ui")) or {}
    csp = ui_meta.get("csp") or {}
    declared_domains: set[str] = set()
    for key in ("connectDomains", "resourceDomains", "frameDomains", "baseUriDomains"):
        declared_domains.update(csp.get(key) or [])
    outside = sorted(declared_domains - host_trusted_domains)
    if outside:
        return {"accepted": False, "reason": f"host policy does not trust: {outside}"}
    return {"accepted": True, "reason": ""}


def grant_permissions(requested: dict, host_granted_permissions: set[str]) -> set[str]:
    requested_keys = set((requested or {}).keys())
    return requested_keys & host_granted_permissions


class HostAppLoader:
    def __init__(self, client: Client, host_trusted_domains: set[str], host_granted_permissions: set[str]) -> None:
        self.client = client
        self.host_trusted_domains = host_trusted_domains
        self.host_granted_permissions = host_granted_permissions

    def load(self, tool: dict, arguments: dict, declare_ui: bool) -> dict:
        capabilities = UI_CAPS if declare_ui else {}
        call_response = self.client.send("tools/call", {"name": tool["name"], "arguments": arguments}, capabilities=capabilities)
        call_result = call_response["result"]
        fallback_text = call_result["content"][0]["text"]
        binding = ((tool.get("_meta") or {}).get("ui") or {}).get("resourceUri")
        if not declare_ui or not binding:
            return {"mode": "text", "text": fallback_text}
        read_response = self.client.send("resources/read", {"uri": binding}, capabilities=capabilities)
        if "error" in read_response:
            return {"mode": "text", "text": fallback_text, "reason": read_response["error"]["message"]}
        content = read_response["result"]["contents"][0]
        review = review_app_resource(content, self.host_trusted_domains)
        if not review["accepted"]:
            return {"mode": "text", "text": fallback_text, "reason": review["reason"]}
        ui_meta = ((content.get("_meta") or {}).get("ui")) or {}
        granted = grant_permissions(ui_meta.get("permissions") or {}, self.host_granted_permissions)
        return {
            "mode": "app",
            "uri": content["uri"],
            "mimeType": content["mimeType"],
            "csp": build_csp(ui_meta.get("csp")),
            "grantedPermissions": sorted(granted),
        }


def request_tool_call_from_app(client: Client, tool: dict, arguments: dict, approved: bool) -> dict:
    visibility = tool_visibility(tool)
    if "app" not in visibility:
        return {"routed": False, "reason": f"tool {tool['name']!r} visibility {list(visibility)} excludes app callers"}
    if not approved:
        return {"routed": False, "reason": "declined by host consent gate"}
    response = client.send("tools/call", {"name": tool["name"], "arguments": arguments}, capabilities=UI_CAPS)
    return {"routed": True, "response": response}


def run_scenario() -> tuple[Client, dict[str, Any]]:
    server = Server("dashboards")
    client = Client(server)
    loader = HostAppLoader(client, HOST_TRUSTED_DOMAINS, HOST_GRANTED_PERMISSIONS)

    discover = client.send("server/discover", capabilities=UI_CAPS)
    negotiated = negotiated_extensions(UI_CAPS, discover["result"]["capabilities"])

    client.send("resources/list")

    tools = client.send("tools/list")["result"]["tools"]
    visible_tools = agent_visible_tools(tools)
    tool = next(t for t in tools if t["name"] == TOOL_NAME)
    refresh_tool = next(t for t in tools if t["name"] == REFRESH_TOOL_NAME)
    export_tool = next(t for t in tools if t["name"] == EXPORT_TOOL_NAME)

    app_plan = loader.load(tool, {"metric": "revenue"}, declare_ui=True)
    text_plan = loader.load(tool, {"metric": "revenue"}, declare_ui=False)

    legacy_read = client.send("resources/read", {"uri": LEGACY_RESOURCE_URI}, capabilities=UI_CAPS)
    legacy_review = review_app_resource(legacy_read["result"]["contents"][0], HOST_TRUSTED_DOMAINS)

    untrusted_read = client.send("resources/read", {"uri": UNTRUSTED_RESOURCE_URI}, capabilities=UI_CAPS)
    untrusted_review = review_app_resource(untrusted_read["result"]["contents"][0], HOST_TRUSTED_DOMAINS)

    minimal_read = client.send("resources/read", {"uri": MINIMAL_RESOURCE_URI}, capabilities=UI_CAPS)
    minimal_ui_meta = (minimal_read["result"]["contents"][0].get("_meta") or {}).get("ui") or {}
    minimal_csp = build_csp(minimal_ui_meta.get("csp"))

    declined = request_tool_call_from_app(client, refresh_tool, {}, approved=False)
    approved = request_tool_call_from_app(client, refresh_tool, {}, approved=True)
    blocked_by_visibility = request_tool_call_from_app(client, export_tool, {}, approved=True)

    missing = client.send("resources/read", {"uri": "ui://dashboard/does-not-exist.html"}, capabilities=UI_CAPS)

    info = {
        "negotiated": negotiated,
        "visible_tool_names": [t["name"] for t in visible_tools],
        "app_plan": app_plan,
        "text_plan": text_plan,
        "legacy_review": legacy_review,
        "untrusted_review": untrusted_review,
        "minimal_csp": minimal_csp,
        "declined": declined,
        "approved": approved,
        "blocked_by_visibility": blocked_by_visibility,
        "missing": missing,
    }
    return client, info


def transcript() -> list[dict]:
    client, _ = run_scenario()
    return client.log


def demo() -> None:
    client, info = run_scenario()
    print("mcp apps: csp construction, permission grants, and tool visibility")
    print("  negotiated extensions:  ", sorted(info["negotiated"]))
    print("  agent-visible tools:    ", info["visible_tool_names"])
    print("  app-aware plan:         ", info["app_plan"])
    print("  text-only plan:         ", info["text_plan"])
    print("  legacy mime review:     ", info["legacy_review"])
    print("  untrusted domain review:", info["untrusted_review"])
    print("  omitted-csp default:    ", info["minimal_csp"])
    print("  app call declined:      ", info["declined"])
    print("  app call approved:      ", {"routed": info["approved"]["routed"], "id": info["approved"]["response"]["id"]})
    print("  app call blocked by visibility:", info["blocked_by_visibility"])
    print("\nfull transcript")
    for message in client.log:
        print("  " + json.dumps(message, sort_keys=True)[:200])


if __name__ == "__main__":
    demo()
