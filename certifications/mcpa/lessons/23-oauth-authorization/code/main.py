"""Companion code for:
certifications/mcpa/lessons/23-oauth-authorization/docs/en.md
OAuth 2.1 authorization guarding one MCP tool call.
Sources: MCP 2026-07-28 Authorization; OAuth 2.1; RFCs 7636, 8414, 8707, 9207, and 9728.
"""

from __future__ import annotations

import base64
import hashlib
import json
import re
import secrets
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlsplit


PROTOCOL_VERSION = "2026-07-28"
PV_KEY = "io.modelcontextprotocol/protocolVersion"
CAPS_KEY = "io.modelcontextprotocol/clientCapabilities"
CLIENT_INFO_KEY = "io.modelcontextprotocol/clientInfo"
SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo"

INVALID_PARAMS = -32602

RESOURCE_SERVER_URL = "https://mcp.example.com/mcp"
RESOURCE_METADATA_RE = re.compile(r'resource_metadata="([^"]+)"')


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


def www_authenticate_challenge(resource_metadata_url: str, scope: str | None = None) -> str:
    challenge = f'Bearer resource_metadata="{resource_metadata_url}"'
    if scope:
        challenge += f', scope="{scope}"'
    return challenge


def parse_resource_metadata_url(www_authenticate: str | None) -> str | None:
    if not www_authenticate:
        return None
    match = RESOURCE_METADATA_RE.search(www_authenticate)
    return match.group(1) if match else None


def protected_resource_metadata_urls(mcp_endpoint: str) -> list[str]:
    parts = urlsplit(mcp_endpoint)
    root = f"{parts.scheme}://{parts.netloc}"
    urls: list[str] = []
    if parts.path and parts.path != "/":
        urls.append(f"{root}/.well-known/oauth-protected-resource{parts.path}")
    urls.append(f"{root}/.well-known/oauth-protected-resource")
    return urls


def discover_protected_resource_metadata(mcp_endpoint: str, www_authenticate: str | None = None) -> list[str]:
    header_url = parse_resource_metadata_url(www_authenticate)
    if header_url:
        return [header_url]
    return protected_resource_metadata_urls(mcp_endpoint)


def as_metadata_discovery_urls(issuer: str) -> list[str]:
    parts = urlsplit(issuer)
    root = f"{parts.scheme}://{parts.netloc}"
    path = parts.path.rstrip("/")
    if path:
        return [
            f"{root}/.well-known/oauth-authorization-server{path}",
            f"{root}/.well-known/openid-configuration{path}",
            f"{root}{path}/.well-known/openid-configuration",
        ]
    return [
        f"{root}/.well-known/oauth-authorization-server",
        f"{root}/.well-known/openid-configuration",
    ]


class MetadataValidationError(ValueError):
    pass


def validate_authorization_server_metadata(issuer: str, metadata: dict) -> dict:
    if metadata.get("issuer") != issuer:
        raise MetadataValidationError(
            f"authorization server metadata issuer {metadata.get('issuer')!r} does not match {issuer!r}; refusing to use it"
        )
    return metadata


def generate_code_verifier(nbytes: int = 32) -> str:
    return base64.urlsafe_b64encode(secrets.token_bytes(nbytes)).rstrip(b"=").decode("ascii")


def code_challenge_s256(code_verifier: str) -> str:
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def require_pkce_s256_support(as_metadata: dict) -> None:
    methods = as_metadata.get("code_challenge_methods_supported")
    if not methods:
        raise MetadataValidationError(
            "authorization server does not advertise code_challenge_methods_supported; refusing to proceed"
        )
    if "S256" not in methods:
        raise MetadataValidationError("authorization server does not support the S256 code challenge method")


def canonical_resource_uri(url: str) -> str:
    parts = urlsplit(url)
    if not parts.scheme or not parts.netloc:
        raise ValueError(f"{url!r} is not a valid canonical resource URI: missing scheme or host")
    if parts.fragment:
        raise ValueError(f"{url!r} is not a valid canonical resource URI: fragments are not allowed")
    return f"{parts.scheme.lower()}://{parts.netloc.lower()}{parts.path.rstrip('/')}"


@dataclass
class AuthorizationRequest:
    client_id: str
    redirect_uri: str
    resource: str
    state: str
    code_challenge: str
    code_challenge_method: str = "S256"
    response_type: str = "code"
    scope: str | None = None


def build_authorization_request(as_metadata: dict, client_id: str, redirect_uri: str, resource: str,
                                code_verifier: str, scope: str | None = None) -> AuthorizationRequest:
    require_pkce_s256_support(as_metadata)
    return AuthorizationRequest(
        client_id=client_id,
        redirect_uri=redirect_uri,
        resource=canonical_resource_uri(resource),
        state=secrets.token_urlsafe(16),
        code_challenge=code_challenge_s256(code_verifier),
        scope=scope,
    )


class IssuerMismatch(ValueError):
    pass


def validate_authorization_response_issuer(expected_issuer: str, returned_iss: str | None,
                                           issuer_param_advertised: bool) -> None:
    if issuer_param_advertised and returned_iss is None:
        raise IssuerMismatch(
            "authorization server advertises authorization_response_iss_parameter_supported "
            "but the response omitted iss; rejecting"
        )
    if returned_iss is not None and returned_iss != expected_issuer:
        raise IssuerMismatch(
            f"iss {returned_iss!r} does not match the expected issuer {expected_issuer!r}; "
            "rejecting the response as a possible mix-up attack"
        )


@dataclass
class TokenRequest:
    grant_type: str
    code: str
    redirect_uri: str
    client_id: str
    code_verifier: str
    resource: str


def build_token_request(authorization_request: AuthorizationRequest, code: str, code_verifier: str) -> TokenRequest:
    return TokenRequest(
        grant_type="authorization_code",
        code=code,
        redirect_uri=authorization_request.redirect_uri,
        client_id=authorization_request.client_id,
        code_verifier=code_verifier,
        resource=authorization_request.resource,
    )


@dataclass
class AccessToken:
    value: str
    audience: str
    subject: str
    scopes: tuple[str, ...] = field(default_factory=tuple)


@dataclass
class AuthDecision:
    ok: bool
    status: int
    reason: str
    token: AccessToken | None = None


class ResourceServer:
    def __init__(self, canonical_uri: str, tokens: list[AccessToken]) -> None:
        self.canonical_uri = canonical_uri
        self._tokens = {token.value: token for token in tokens}

    def authorize(self, authorization_header: str | None) -> AuthDecision:
        if not authorization_header or not authorization_header.startswith("Bearer "):
            return AuthDecision(False, 401, "missing or malformed Authorization header")
        token_value = authorization_header[len("Bearer "):].strip()
        token = self._tokens.get(token_value)
        if token is None:
            return AuthDecision(False, 401, "unknown or expired token")
        if token.audience != self.canonical_uri:
            return AuthDecision(
                False, 401, f"token audience {token.audience!r} does not match this server {self.canonical_uri!r}"
            )
        return AuthDecision(True, 200, "ok", token)


def build_request_target(canonical_uri: str, token_value: str) -> tuple[str, dict[str, str]]:
    return canonical_uri, {"Authorization": f"Bearer {token_value}"}


class McpServer:
    def __init__(self, canonical_uri: str, resource_server: ResourceServer, name: str = "credential-vault") -> None:
        self.canonical_uri = canonical_uri
        self.resource_server = resource_server
        self.name = name

    def _server_meta(self) -> dict:
        return {SERVER_INFO_KEY: {"name": self.name, "version": "1.0.0"}}

    def handle_tools_call(self, message: dict, authorization_header: str | None) -> tuple[int, dict | None]:
        decision = self.resource_server.authorize(authorization_header)
        if not decision.ok:
            return decision.status, None
        request_id = message.get("id")
        params = message.get("params") or {}
        meta = params.get("_meta") or {}
        if PV_KEY not in meta or CAPS_KEY not in meta:
            return 400, make_error(request_id, INVALID_PARAMS, "Missing required _meta fields")
        arguments = params.get("arguments") or {}
        credential_id = arguments.get("credential_id", "unknown")
        result = make_result(
            request_id,
            content=[{"type": "text", "text": f"Rotated credential {credential_id}"}],
            structuredContent={"credential_id": credential_id, "rotated": True, "subject": decision.token.subject},
            isError=False,
            _meta=self._server_meta(),
        )
        return 200, result


class McpClient:
    def __init__(self, server: McpServer) -> None:
        self.server = server
        self.next_id = 0
        self.log: list[Any] = []

    def call_tool(self, name: str, arguments: dict, authorization_header: str | None) -> tuple[int, dict | None]:
        self.next_id += 1
        message = make_request(self.next_id, "tools/call", {"name": name, "arguments": arguments})
        status, response = self.server.handle_tools_call(message, authorization_header)
        meta = message["params"]["_meta"]
        headers = {
            "MCP-Protocol-Version": meta[PV_KEY],
            "Mcp-Method": "tools/call",
            "Mcp-Name": name,
        }
        entry: dict[str, Any] = {"http": {"headers": headers, "status": status}}
        if authorization_header:
            headers["Authorization"] = authorization_header
        else:
            prm_url = protected_resource_metadata_urls(self.server.canonical_uri)[-1]
            entry["http"]["wwwAuthenticate"] = www_authenticate_challenge(prm_url)
        entry["message"] = message
        self.log.append(entry)
        if response is not None:
            self.log.append(response)
        return status, response


def simulate_authorization_flow() -> dict[str, Any]:
    issuer = "https://auth.example.com/tenant-a"
    prm_urls = discover_protected_resource_metadata(RESOURCE_SERVER_URL, www_authenticate=None)
    as_urls = as_metadata_discovery_urls(issuer)
    as_metadata = {
        "issuer": issuer,
        "authorization_endpoint": issuer + "/authorize",
        "token_endpoint": issuer + "/token",
        "code_challenge_methods_supported": ["S256"],
        "authorization_response_iss_parameter_supported": True,
    }
    validate_authorization_server_metadata(issuer, as_metadata)
    verifier = generate_code_verifier()
    authorization_request = build_authorization_request(
        as_metadata,
        client_id="https://client.example.com/mcp-client.json",
        redirect_uri="https://client.example.com/callback",
        resource=RESOURCE_SERVER_URL,
        code_verifier=verifier,
        scope="vault:rotate",
    )
    validate_authorization_response_issuer(
        issuer, issuer, as_metadata["authorization_response_iss_parameter_supported"]
    )
    token_request = build_token_request(authorization_request, code="auth-code-abc123", code_verifier=verifier)
    return {
        "prm_urls": prm_urls,
        "as_urls": as_urls,
        "as_metadata": as_metadata,
        "code_verifier": verifier,
        "authorization_request": authorization_request,
        "token_request": token_request,
    }


def run_scenario() -> McpClient:
    valid_token = AccessToken(value="tok_valid_abc", audience=RESOURCE_SERVER_URL, subject="user_42",
                              scopes=("vault:rotate",))
    foreign_token = AccessToken(value="tok_foreign_xyz", audience="https://other-server.example.com/mcp",
                                subject="user_42", scopes=("vault:rotate",))
    resource_server = ResourceServer(RESOURCE_SERVER_URL, [valid_token, foreign_token])
    server = McpServer(RESOURCE_SERVER_URL, resource_server)
    client = McpClient(server)
    client.call_tool("rotate_credential", {"credential_id": "db-prod"}, authorization_header=None)
    client.call_tool("rotate_credential", {"credential_id": "db-prod"},
                     authorization_header=f"Bearer {valid_token.value}")
    return client


def transcript() -> list[Any]:
    return run_scenario().log


def demo() -> None:
    flow = simulate_authorization_flow()
    print("Protected Resource Metadata discovery order (no WWW-Authenticate header)")
    for url in flow["prm_urls"]:
        print("  " + url)
    print("Authorization server metadata discovery order (path issuer)")
    for url in flow["as_urls"]:
        print("  " + url)
    print("PKCE code_challenge (S256):", flow["authorization_request"].code_challenge)
    print("resource indicator on the authorization request:", flow["authorization_request"].resource)
    print("resource indicator on the token request:        ", flow["token_request"].resource)
    print()
    print("MCP side: unauthenticated call, then the same call with a valid token")
    for entry in transcript():
        print("  " + json.dumps(entry, sort_keys=True)[:180])


if __name__ == "__main__":
    demo()
