"""Companion code for:
certifications/mcpa/lessons/24-client-registration-and-identity/docs/en.md
A registration planner and a CIMD validator for an MCP client an authorization server has never
met.
Sources: MCP 2026-07-28 Client Registration page; Client ID Metadata Documents; RFC 7591.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlparse


PROTOCOL_VERSION = "2026-07-28"
PV_KEY = "io.modelcontextprotocol/protocolVersion"
CAPS_KEY = "io.modelcontextprotocol/clientCapabilities"
CLIENT_INFO_KEY = "io.modelcontextprotocol/clientInfo"
SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo"

INVALID_PARAMS = -32602
METHOD_NOT_FOUND = -32601


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


CLIENT_CREDENTIALS_EXTENSION = "io.modelcontextprotocol/oauth-client-credentials"
ENTERPRISE_MANAGED_EXTENSION = "io.modelcontextprotocol/enterprise-managed-authorization"
NAME_HEADER_FIELD = {"tools/call": "name", "prompts/get": "name", "resources/read": "uri"}
LOCALHOST_HOSTS = {"localhost", "127.0.0.1", "::1"}
REQUIRED_CIMD_FIELDS = ("client_id", "client_name", "redirect_uris")


@dataclass
class AuthServerMetadata:
    issuer: str
    client_id_metadata_document_supported: bool = False
    registration_endpoint: str | None = None


@dataclass
class ClientCredentials:
    client_id: str
    issuer: str
    method: str


@dataclass
class RegistrationDecision:
    path: str
    reason: str
    deprecated: bool = False


def choose_registration_path(as_metadata: AuthServerMetadata, pre_registered: dict[str, ClientCredentials]) -> RegistrationDecision:
    if as_metadata.issuer in pre_registered:
        return RegistrationDecision(
            "pre-registered",
            f"a client id is already on file for issuer {as_metadata.issuer}",
        )
    if as_metadata.client_id_metadata_document_supported:
        return RegistrationDecision(
            "cimd",
            "the authorization server advertises client_id_metadata_document_supported",
        )
    if as_metadata.registration_endpoint:
        return RegistrationDecision(
            "dcr",
            "no pre-registration or CIMD support; Dynamic Client Registration is the deprecated fallback",
            deprecated=True,
        )
    return RegistrationDecision("ask-user", "no automated registration path is available")


def validate_cimd(url: str, document: dict[str, Any]) -> list[str]:
    problems: list[str] = []
    parsed = urlparse(url)
    if parsed.scheme != "https":
        problems.append(f"client_id URL must use https, not {parsed.scheme or 'no scheme'!r}")
    if not parsed.path or parsed.path == "/":
        problems.append("client_id URL must contain a path component")
    for required in REQUIRED_CIMD_FIELDS:
        if not document.get(required):
            problems.append(f"metadata document is missing required field {required!r}")
    if document.get("client_id") != url:
        problems.append(f"document client_id {document.get('client_id')!r} does not match the fetched URL {url!r}")
    for uri in document.get("redirect_uris") or []:
        redirect = urlparse(str(uri))
        if redirect.scheme == "https":
            continue
        if redirect.scheme == "http" and redirect.hostname in LOCALHOST_HOSTS:
            continue
        problems.append(f"redirect_uri {uri!r} must be https, or http on localhost")
    return problems


def application_type_for(redirect_uri: str) -> str:
    parsed = urlparse(redirect_uri)
    if parsed.scheme not in ("http", "https") or parsed.hostname in LOCALHOST_HOSTS:
        return "native"
    return "web"


@dataclass
class CredentialStore:
    _by_issuer: dict[str, ClientCredentials] = field(default_factory=dict)

    def register(self, creds: ClientCredentials) -> None:
        self._by_issuer[creds.issuer] = creds

    def credentials_for(self, issuer: str) -> ClientCredentials | None:
        return self._by_issuer.get(issuer)

    def use(self, issuer: str, creds: ClientCredentials) -> ClientCredentials:
        if creds.issuer != issuer:
            raise ValueError(
                f"credentials registered for issuer {creds.issuer!r} cannot be used against issuer {issuer!r}; re-register instead"
            )
        return creds


@dataclass
class ProxyConsentLedger:
    consented: set[tuple[str, str]] = field(default_factory=set)

    def record_consent(self, static_client_id: str, downstream_client_id: str) -> None:
        self.consented.add((static_client_id, downstream_client_id))

    def may_forward(self, static_client_id: str, downstream_client_id: str) -> bool:
        return (static_client_id, downstream_client_id) in self.consented


def recommend_auth_extension(has_interactive_user: bool, enterprise_idp: bool) -> str | None:
    if not has_interactive_user:
        return CLIENT_CREDENTIALS_EXTENSION
    if enterprise_idp:
        return ENTERPRISE_MANAGED_EXTENSION
    return None


def build_authorization_servers() -> dict[str, AuthServerMetadata]:
    return {
        "https://auth.acme-ops.example": AuthServerMetadata(
            issuer="https://auth.acme-ops.example",
            client_id_metadata_document_supported=True,
        ),
        "https://login.legacy-crm.example": AuthServerMetadata(
            issuer="https://login.legacy-crm.example",
            registration_endpoint="https://login.legacy-crm.example/register",
        ),
        "https://id.partner-net.example": AuthServerMetadata(
            issuer="https://id.partner-net.example",
        ),
    }


PRE_REGISTERED: dict[str, ClientCredentials] = {
    "https://auth.acme-ops.example": ClientCredentials(
        client_id="acme-ops-cli-2024",
        issuer="https://auth.acme-ops.example",
        method="pre-registered",
    ),
}

VALID_CIMD_URL = "https://ops-cli.example.com/oauth/client-metadata.json"
VALID_CIMD_DOCUMENT = {
    "client_id": VALID_CIMD_URL,
    "client_name": "Acme Ops CLI",
    "client_uri": "https://ops-cli.example.com",
    "redirect_uris": [
        "http://127.0.0.1:8945/callback",
        "https://ops-cli.example.com/callback",
    ],
    "grant_types": ["authorization_code"],
    "response_types": ["code"],
    "token_endpoint_auth_method": "none",
}
MISMATCHED_CIMD_DOCUMENT = dict(VALID_CIMD_DOCUMENT, client_id="https://ops-cli.example.com/oauth/other-client.json")
HTTP_CIMD_URL = "http://ops-cli.example.com/oauth/client-metadata.json"
HTTP_CIMD_DOCUMENT = dict(VALID_CIMD_DOCUMENT, client_id=HTTP_CIMD_URL)
INCOMPLETE_CIMD_DOCUMENT = {"client_id": VALID_CIMD_URL, "client_name": "Acme Ops CLI"}


@dataclass
class RegisteredMcpServer:
    name: str
    required_scope: str

    def _server_meta(self) -> dict[str, Any]:
        return {SERVER_INFO_KEY: {"name": self.name, "version": "1.0.0"}}

    def handle(self, message: dict[str, Any]) -> dict[str, Any]:
        request_id = message.get("id")
        params = message.get("params") or {}
        meta = params.get("_meta") or {}
        if not isinstance(meta.get(PV_KEY), str) or not isinstance(meta.get(CAPS_KEY), dict):
            return make_error(request_id, INVALID_PARAMS, "Missing required _meta fields")
        method = message.get("method")
        if method == "server/discover":
            return make_result(
                request_id,
                supportedVersions=[PROTOCOL_VERSION],
                capabilities={"tools": {"listChanged": False}, "extensions": {CLIENT_CREDENTIALS_EXTENSION: {}}},
                ttlMs=300000,
                cacheScope="public",
                _meta=self._server_meta(),
            )
        if method == "tools/call":
            name = params.get("name")
            return make_result(
                request_id,
                content=[{"type": "text", "text": f"{name} accepted a client-credentials token scoped for {self.required_scope}"}],
                isError=False,
                _meta=self._server_meta(),
            )
        return make_error(request_id, METHOD_NOT_FOUND, f"Method not found: {method}")


def obtain_client_credentials_token(client_id: str, issuer: str) -> str:
    return f"cc-token.{client_id}.{issuer.split('//')[-1]}"


def wrap_http(message: dict[str, Any], token: str) -> dict[str, Any]:
    method = message["method"]
    params = message.get("params") or {}
    meta = params.get("_meta") or {}
    headers = {
        "MCP-Protocol-Version": meta.get(PV_KEY, PROTOCOL_VERSION),
        "Mcp-Method": method,
        "Authorization": f"Bearer {token}",
    }
    field_name = NAME_HEADER_FIELD.get(method)
    if field_name:
        headers["Mcp-Name"] = params.get(field_name)
    return {"http": {"headers": headers, "status": 200}, "message": message}


class RegisteredClient:
    def __init__(self, server: RegisteredMcpServer, token: str) -> None:
        self.server = server
        self.token = token
        self.next_id = 0
        self.log: list[dict[str, Any]] = []

    def send(self, method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        self.next_id += 1
        request = make_request(
            self.next_id, method, params,
            capabilities={"extensions": {CLIENT_CREDENTIALS_EXTENSION: {}}},
        )
        response = self.server.handle(request)
        self.log.append(wrap_http(request, self.token))
        self.log.append(response)
        return response

    def discover(self) -> dict[str, Any]:
        return self.send("server/discover")["result"]

    def call(self, name: str, arguments: dict[str, Any] | None = None) -> dict[str, Any]:
        return self.send("tools/call", {"name": name, "arguments": arguments or {}})


def run_scenario() -> dict[str, Any]:
    servers = build_authorization_servers()
    decisions = {
        issuer: choose_registration_path(metadata, PRE_REGISTERED)
        for issuer, metadata in servers.items()
    }

    cimd_reports = {
        "valid": validate_cimd(VALID_CIMD_URL, VALID_CIMD_DOCUMENT),
        "mismatched_client_id": validate_cimd(VALID_CIMD_URL, MISMATCHED_CIMD_DOCUMENT),
        "http_scheme": validate_cimd(HTTP_CIMD_URL, HTTP_CIMD_DOCUMENT),
        "incomplete": validate_cimd(VALID_CIMD_URL, INCOMPLETE_CIMD_DOCUMENT),
    }

    store = CredentialStore()
    store.register(PRE_REGISTERED["https://auth.acme-ops.example"])
    acme_creds = store.credentials_for("https://auth.acme-ops.example")

    ledger = ProxyConsentLedger()
    proxy_client_id = "https://proxy.acme.example/oauth/client-metadata.json"
    downstream_client = "finance-bot"
    ledger_before_consent = ledger.may_forward(proxy_client_id, downstream_client)
    ledger.record_consent(proxy_client_id, downstream_client)
    ledger_after_consent = ledger.may_forward(proxy_client_id, downstream_client)

    token = obtain_client_credentials_token(acme_creds.client_id, acme_creds.issuer)
    server = RegisteredMcpServer(name="acme-ops", required_scope="incidents:read")
    client = RegisteredClient(server, token)
    client.discover()
    client.call("list_open_incidents")

    return {
        "servers": servers,
        "decisions": decisions,
        "cimd_reports": cimd_reports,
        "store": store,
        "acme_creds": acme_creds,
        "ledger": ledger,
        "ledger_before_consent": ledger_before_consent,
        "ledger_after_consent": ledger_after_consent,
        "client": client,
        "token": token,
    }


def transcript() -> list[dict[str, Any]]:
    return run_scenario()["client"].log


def render_decision(issuer: str, decision: RegistrationDecision) -> None:
    tag = " (deprecated)" if decision.deprecated else ""
    print(f"  {issuer}: {decision.path}{tag}, {decision.reason}")


def demo() -> None:
    scenario = run_scenario()

    print("registration path chosen per authorization server")
    for issuer, decision in scenario["decisions"].items():
        render_decision(issuer, decision)

    print("\nClient ID Metadata Document validation")
    for label, problems in scenario["cimd_reports"].items():
        status = "no problems" if not problems else "; ".join(problems)
        print(f"  {label}: {status}")

    print("\napplication_type by redirect URI")
    for uri in ("http://127.0.0.1:8945/callback", "https://ops-cli.example.com/callback", "com.acme.opscli:/callback"):
        print(f"  {uri}: {application_type_for(uri)}")

    print("\nauthorization server binding")
    creds = scenario["acme_creds"]
    print(f"  credentials {creds.client_id!r} are bound to {creds.issuer!r}")
    try:
        scenario["store"].use("https://login.legacy-crm.example", creds)
    except ValueError as exc:
        print(f"  cross-issuer reuse rejected: {exc}")

    print("\nconfused deputy: a proxy forwarding a dynamically registered downstream client")
    print(f"  before consent, may_forward = {scenario['ledger_before_consent']}")
    print(f"  after consent,  may_forward = {scenario['ledger_after_consent']}")

    print("\nauthorization extension recommended by scenario")
    print("  unattended CI pipeline:      ", recommend_auth_extension(has_interactive_user=False, enterprise_idp=False))
    print("  employee behind a corporate IdP:", recommend_auth_extension(has_interactive_user=True, enterprise_idp=True))
    print("  ordinary interactive signup: ", recommend_auth_extension(has_interactive_user=True, enterprise_idp=False))

    print("\nwire exchange once acme-ops-cli holds a client-credentials token")
    for message in scenario["client"].log:
        print("  " + json.dumps(message, sort_keys=True)[:160])


if __name__ == "__main__":
    demo()
