"""Companion code for:
certifications/mcpa/lessons/32-registry-gateways-and-sdk-tiers/docs/en.md
A registry admission check, an SDK tier lookup, and a gateway that routes on headers and
partitions its cache by caller.
Sources: MCP Registry documentation; SEP-1730 (SDK tiers); SEP-2243.
"""

from __future__ import annotations

import hashlib
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
HEADER_MISMATCH = -32020

NAME_HEADER_METHODS = {"tools/call": "name", "prompts/get": "name", "resources/read": "uri"}


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


SCHEMA_VERSION_RE = re.compile(r"/schemas/(\d{4}-\d{2}-\d{2})/")


def schema_version_from_url(schema_url: str) -> str | None:
    match = SCHEMA_VERSION_RE.search(schema_url)
    return match.group(1) if match else None


RANGE_CHARACTERS = ("^", "~", "<", ">", "*", "|")


def looks_like_version_range(version: str) -> bool:
    if any(character in version for character in RANGE_CHARACTERS):
        return True
    if version.endswith(".x") or version == "x":
        return True
    if re.search(r"\d\s+-\s+\d", version):
        return True
    return False


@dataclass
class ServerPackage:
    registry_type: str
    identifier: str
    version: str
    transport: str


@dataclass
class ServerRemote:
    type: str
    url: str


@dataclass
class ServerEntry:
    schema_url: str
    name: str
    version: str
    visibility: str
    packages: list[ServerPackage] = field(default_factory=list)
    remotes: list[ServerRemote] = field(default_factory=list)


@dataclass
class AdmissionResult:
    accepted: bool
    reason: str


def split_namespace(name: str) -> tuple[str, str]:
    authority, _, slug = name.rpartition("/")
    return authority, slug


def admit_to_registry(entry: ServerEntry, publisher_id: str, verified_owners: dict[str, str]) -> AdmissionResult:
    authority, slug = split_namespace(entry.name)
    if not authority or not slug:
        return AdmissionResult(False, "name must be an authority/slug reverse-DNS pair")
    if verified_owners.get(authority) != publisher_id:
        return AdmissionResult(False, f"namespace {authority!r} is not verified for publisher {publisher_id!r}")
    if entry.visibility != "public":
        return AdmissionResult(False, "the MCP Registry only accepts publicly accessible servers")
    if looks_like_version_range(entry.version):
        return AdmissionResult(False, f"version {entry.version!r} looks like a version range, which the registry prohibits")
    return AdmissionResult(True, "accepted")


def resolve_install_target(entry: ServerEntry, prefer: str = "remote") -> dict[str, str]:
    if prefer == "remote" and entry.remotes:
        remote = entry.remotes[0]
        return {"kind": "remote", "type": remote.type, "location": remote.url}
    if entry.packages:
        package = entry.packages[0]
        return {"kind": "package", "registryType": package.registry_type, "location": package.identifier, "transport": package.transport}
    if entry.remotes:
        remote = entry.remotes[0]
        return {"kind": "remote", "type": remote.type, "location": remote.url}
    raise ValueError("server.json has neither packages nor remotes")


TIER_REQUIREMENTS = {
    1: {"conformancePct": 100, "featureTimeline": "before the next spec release", "triageDays": 2, "criticalBugDays": 7, "stableRelease": True},
    2: {"conformancePct": 80, "featureTimeline": "within 6 months", "triageDays": 30, "criticalBugDays": 14, "stableRelease": True},
    3: {"conformancePct": 0, "featureTimeline": "no timeline commitment", "triageDays": None, "criticalBugDays": None, "stableRelease": False},
}


def tier_requirement(tier: int, field_name: str) -> Any:
    return TIER_REQUIREMENTS[tier][field_name]


def relegate(tier: int, conformance_pct: float, weeks_failing: int) -> int:
    if weeks_failing < 4:
        return tier
    if tier == 1 and conformance_pct < 100:
        return 2
    if tier == 2 and conformance_pct < 80:
        return 3
    return tier


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict
    handler: Callable[[dict], str]


@dataclass
class Resource:
    uri: str
    description: str
    cache_scope: str
    handler: Callable[[str], str]


@dataclass
class Backend:
    name: str
    tools: dict[str, Tool] = field(default_factory=dict)
    resources: dict[str, Resource] = field(default_factory=dict)
    call_count: dict[str, int] = field(default_factory=dict)
    read_count: dict[str, int] = field(default_factory=dict)

    def _server_meta(self) -> dict:
        return {SERVER_INFO_KEY: {"name": self.name, "version": "1.0.0"}}

    def handle(self, message: dict) -> dict:
        request_id = message.get("id")
        params = message.get("params") or {}
        meta = params.get("_meta") or {}
        if not isinstance(meta.get(PV_KEY), str) or not isinstance(meta.get(CAPS_KEY), dict):
            return make_error(request_id, INVALID_PARAMS, "Missing required _meta fields")
        method = message.get("method")
        if method == "tools/call":
            return self._call_tool(request_id, params)
        if method == "resources/read":
            return self._read_resource(request_id, params)
        return make_error(request_id, METHOD_NOT_FOUND, f"This backend does not implement {method}")

    def _call_tool(self, request_id: Any, params: dict) -> dict:
        name = params.get("name")
        tool = self.tools.get(name)
        if tool is None:
            return make_error(request_id, INVALID_PARAMS, f"Unknown tool: {name}")
        self.call_count[name] = self.call_count.get(name, 0) + 1
        arguments = params.get("arguments") or {}
        text = tool.handler(arguments)
        return make_result(request_id, content=[{"type": "text", "text": text}], isError=False, _meta=self._server_meta())

    def _read_resource(self, request_id: Any, params: dict) -> dict:
        uri = params.get("uri")
        resource = self.resources.get(uri)
        if resource is None:
            return make_error(request_id, INVALID_PARAMS, f"Unknown resource: {uri}", {"uri": uri})
        self.read_count[uri] = self.read_count.get(uri, 0) + 1
        text = resource.handler(uri)
        return make_result(
            request_id,
            contents=[{"uri": uri, "mimeType": "text/plain", "text": text}],
            ttlMs=60000,
            cacheScope=resource.cache_scope,
            _meta=self._server_meta(),
        )


def principal_ref(token: str | None) -> str:
    if not token:
        return "anonymous"
    return "principal-" + hashlib.sha256(token.encode("utf-8")).hexdigest()[:12]


@dataclass
class Gateway:
    routes: dict[str, Backend]
    next_id: int = 0
    log: list[Any] = field(default_factory=list)
    cache: dict[tuple, dict] = field(default_factory=dict)
    known_scope: dict[str, str] = field(default_factory=dict)

    def _next_id(self) -> int:
        self.next_id += 1
        return self.next_id

    def _headers_for(self, method: str, name: str) -> dict[str, str]:
        return {"MCP-Protocol-Version": PROTOCOL_VERSION, "Mcp-Method": method, "Mcp-Name": name}

    def _validate_headers(self, headers: dict[str, str], message: dict) -> list[str]:
        params = message.get("params") or {}
        meta = params.get("_meta") or {}
        method = message.get("method")
        name_field = NAME_HEADER_METHODS.get(method)
        expected_name = params.get(name_field) if name_field else None
        mismatches = []
        if headers.get("MCP-Protocol-Version") != meta.get(PV_KEY):
            mismatches.append("MCP-Protocol-Version")
        if headers.get("Mcp-Method") != method:
            mismatches.append("Mcp-Method")
        if expected_name is not None and headers.get("Mcp-Name") != expected_name:
            mismatches.append("Mcp-Name")
        return mismatches

    def _cache_key(self, scope: str, token: str, name: str) -> tuple:
        if scope == "private":
            return ("private", token, name)
        return ("public", name)

    def call_tool(self, token: str, name: str, arguments: dict) -> dict:
        request = make_request(self._next_id(), "tools/call", {"name": name, "arguments": arguments})
        headers = self._headers_for("tools/call", name)
        self.log.append({"http": {"headers": headers}, "principal": principal_ref(token), "message": request})
        mismatches = self._validate_headers(headers, request)
        if mismatches:
            error = make_error(request["id"], HEADER_MISMATCH, "Header mismatch: " + ", ".join(mismatches), {"headers": mismatches})
            self.log.append({"http": {"status": 400}, "message": error})
            return error
        backend = self.routes.get(headers["Mcp-Name"])
        if backend is None:
            error = make_error(request["id"], INVALID_PARAMS, f"No backend exposes tool: {name}")
            self.log.append({"http": {"status": 400}, "message": error})
            return error
        response = backend.handle(request)
        self.log.append({"http": {"status": 200}, "message": response})
        return response

    def call_tool_with_mismatched_method_header(self, token: str, name: str, arguments: dict, reason: str) -> dict:
        request = make_request(self._next_id(), "tools/call", {"name": name, "arguments": arguments})
        headers = self._headers_for("tools/call", name)
        headers["Mcp-Method"] = "prompts/get"
        self.log.append({"violation": reason, "http": {"headers": headers}, "principal": principal_ref(token), "message": request})
        mismatches = self._validate_headers(headers, request)
        error = make_error(request["id"], HEADER_MISMATCH, "Header mismatch: " + ", ".join(mismatches), {"headers": mismatches})
        self.log.append({"http": {"status": 400}, "message": error})
        return error

    def _serve_from_cache(self, uri: str, scope: str, cached: dict) -> dict:
        request_id = self._next_id()
        request = make_request(request_id, "resources/read", {"uri": uri})
        headers = self._headers_for("resources/read", uri)
        self.log.append({"http": {"headers": headers}, "message": request})
        response = make_result(request_id, contents=cached["contents"], ttlMs=cached["ttlMs"], cacheScope=scope, _meta=cached["_meta"])
        self.log.append({"http": {"status": 200}, "message": response})
        return response

    def _read_through(self, token: str, uri: str) -> dict:
        request = make_request(self._next_id(), "resources/read", {"uri": uri})
        headers = self._headers_for("resources/read", uri)
        self.log.append({"http": {"headers": headers}, "principal": principal_ref(token), "message": request})
        mismatches = self._validate_headers(headers, request)
        if mismatches:
            error = make_error(request["id"], HEADER_MISMATCH, "Header mismatch: " + ", ".join(mismatches), {"headers": mismatches})
            self.log.append({"http": {"status": 400}, "message": error})
            return error
        backend = self.routes.get(headers["Mcp-Name"])
        if backend is None:
            error = make_error(request["id"], INVALID_PARAMS, f"No backend exposes resource: {uri}")
            self.log.append({"http": {"status": 400}, "message": error})
            return error
        response = backend.handle(request)
        self.log.append({"http": {"status": 200}, "message": response})
        result = response.get("result")
        if isinstance(result, dict) and "contents" in result:
            scope = result.get("cacheScope")
            self.known_scope[uri] = scope
            key = self._cache_key(scope, token, uri)
            self.cache[key] = {"contents": result["contents"], "ttlMs": result["ttlMs"], "_meta": result.get("_meta")}
        return response

    def read_resource(self, token: str, uri: str) -> dict:
        scope_hint = self.known_scope.get(uri)
        if scope_hint:
            key = self._cache_key(scope_hint, token, uri)
            cached = self.cache.get(key)
            if cached is not None:
                return self._serve_from_cache(uri, scope_hint, cached)
        return self._read_through(token, uri)


def build_accounts_backend() -> Backend:
    backend = Backend("accounts")
    backend.tools["lookup_account"] = Tool(
        name="lookup_account",
        description="Look up the authenticated caller's account summary.",
        input_schema={"type": "object", "properties": {"accountId": {"type": "string"}}, "required": ["accountId"]},
        handler=lambda args: f"account {args['accountId']}: active, plan=team",
    )
    backend.resources["billing://acct/statement"] = Resource(
        uri="billing://acct/statement",
        description="The caller's own billing statement.",
        cache_scope="private",
        handler=lambda uri: "statement: 42.00 due 2026-10-01",
    )
    return backend


def build_status_backend() -> Backend:
    backend = Backend("status")
    backend.resources["status://service"] = Resource(
        uri="status://service",
        description="Public service uptime status.",
        cache_scope="public",
        handler=lambda uri: "all systems operational",
    )
    return backend


def build_gateway() -> tuple[Gateway, Backend, Backend]:
    accounts = build_accounts_backend()
    status = build_status_backend()
    routes = {
        "lookup_account": accounts,
        "billing://acct/statement": accounts,
        "status://service": status,
    }
    return Gateway(routes=routes), accounts, status


def run_scenario() -> tuple[Gateway, Backend, Backend]:
    gateway, accounts, status = build_gateway()
    gateway.call_tool("token-alice", "lookup_account", {"accountId": "acct-1"})
    gateway.read_resource("token-alice", "billing://acct/statement")
    gateway.read_resource("token-alice", "billing://acct/statement")
    gateway.read_resource("token-bob", "billing://acct/statement")
    gateway.read_resource("token-alice", "status://service")
    gateway.read_resource("token-bob", "status://service")
    gateway.call_tool_with_mismatched_method_header(
        "token-alice", "lookup_account", {"accountId": "acct-1"},
        "Mcp-Method says prompts/get but the JSON-RPC method in the body is tools/call",
    )
    return gateway, accounts, status


def transcript() -> list[Any]:
    gateway, _, _ = run_scenario()
    return gateway.log


REGISTRY_SCHEMA_URL = "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json"


def demo() -> None:
    verified_owners = {"io.github.acme": "acme-org", "com.example": "example-domain-owner"}

    owned_entry = ServerEntry(
        schema_url=REGISTRY_SCHEMA_URL,
        name="io.github.acme/weather-mcp",
        version="1.0.0",
        visibility="public",
        packages=[ServerPackage("npm", "@acme/weather-mcp", "1.0.0", "stdio")],
    )
    owned_result = admit_to_registry(owned_entry, "acme-org", verified_owners)
    print(f"registry admission: {owned_entry.name} published by acme-org -> accepted={owned_result.accepted} ({owned_result.reason})")

    spoofed_entry = ServerEntry(schema_url=REGISTRY_SCHEMA_URL, name="io.github.acme/weather-mcp", version="1.0.0", visibility="public")
    spoofed_result = admit_to_registry(spoofed_entry, "mallory", verified_owners)
    print(f"registry admission: {spoofed_entry.name} published by mallory -> accepted={spoofed_result.accepted} ({spoofed_result.reason})")

    private_entry = ServerEntry(schema_url=REGISTRY_SCHEMA_URL, name="com.example/internal-tool", version="1.0.0", visibility="private")
    private_result = admit_to_registry(private_entry, "example-domain-owner", verified_owners)
    print(f"registry admission: {private_entry.name} (private) -> accepted={private_result.accepted} ({private_result.reason})")

    print(f"server.json schema version {schema_version_from_url(REGISTRY_SCHEMA_URL)!r} is independent of protocol version {PROTOCOL_VERSION!r}")
    print("install target (prefer remote):", resolve_install_target(owned_entry, prefer="remote"))

    print()
    print("SDK tier requirements")
    for tier in (1, 2, 3):
        print(f"  tier {tier}: {TIER_REQUIREMENTS[tier]}")
    print("  tier 1 sustained failure for 4 weeks relegates to tier", relegate(1, 99, 4))

    print()
    print("gateway: routing, header validation, and cache scoping")
    gateway, accounts, status = run_scenario()
    for entry in gateway.log:
        message = entry["message"] if isinstance(entry, dict) and "message" in entry else entry
        tag = "viol " if isinstance(entry, dict) and entry.get("violation") else "http "
        print("  " + tag + json.dumps(message, sort_keys=True)[:150])
    print("  accounts.read_count:", accounts.read_count, " accounts.call_count:", accounts.call_count)
    print("  status.read_count:", status.read_count)


if __name__ == "__main__":
    demo()
