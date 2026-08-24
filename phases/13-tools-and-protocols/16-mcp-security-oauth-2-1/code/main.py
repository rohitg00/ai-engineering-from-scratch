"""Phase 13 Lesson 16: MCP 2026-07-28 authorization simulator.

Companion to ../docs/en.md. Implements an in-process protocol model with
protected-resource discovery, CIMD-first enrollment, deprecated DCR fallback,
PKCE, issuer validation, resource-bound tokens, scope step-up, discovery, and
tools/list. Lesson 09 supplies the complete Streamable HTTP adapter.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import secrets
import threading
import time
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlparse


PROTOCOL_VERSION = "2026-07-28"
PROTOCOL_META = "io.modelcontextprotocol/protocolVersion"
CLIENT_CAPABILITIES_META = "io.modelcontextprotocol/clientCapabilities"
CLIENT_INFO_META = "io.modelcontextprotocol/clientInfo"
SERVER_INFO_META = "io.modelcontextprotocol/serverInfo"
RESOURCE = "https://notes.example.com/mcp"
RESOURCE_METADATA_URI = "https://notes.example.com/.well-known/oauth-protected-resource/mcp"
ISSUER = "https://auth.example.com"
CLIENT_METADATA_URL = "https://client.example.com/oauth/metadata.json"
SERVER_INFO = {"name": "notes-server", "version": "2.0.0"}
BASE64_SENTINEL_PREFIX = "=?base64?"
BASE64_SENTINEL_SUFFIX = "?="
FORBIDDEN_CIMD_SECRET_FIELDS = {
    "client_secret",
    "client_secret_expires_at",
    "private_key",
    "private_key_jwk",
    "private_key_pem",
}
PRIVATE_JWK_FIELDS = {"d", "p", "q", "dp", "dq", "qi", "oth", "k"}

TOOL_DESCRIPTORS = [
    {
        "name": "notes.create",
        "description": "Create a note.",
        "inputSchema": {
            "type": "object",
            "properties": {"title": {"type": "string"}},
            "required": ["title"],
        },
    },
    {
        "name": "notes.delete",
        "description": "Delete a note by identifier.",
        "inputSchema": {
            "type": "object",
            "properties": {"id": {"type": "string"}},
            "required": ["id"],
        },
    },
    {
        "name": "notes.list",
        "description": "List notes visible to the principal.",
        "inputSchema": {"type": "object", "properties": {}},
    },
]


@dataclass(frozen=True)
class Token:
    value: str
    issuer: str
    audience: str
    subject: str
    client_id: str
    scopes: frozenset[str]
    expires_at: float


@dataclass(frozen=True)
class ProtocolError(Exception):
    code: int
    message: str
    data: dict[str, Any] | None = None
    http_status: int = 400
    headers: dict[str, str] | None = None


def pkce_pair() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(32)
    digest = hashlib.sha256(verifier.encode()).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return verifier, challenge


def request_meta() -> dict[str, Any]:
    return {
        PROTOCOL_META: PROTOCOL_VERSION,
        CLIENT_CAPABILITIES_META: {},
        CLIENT_INFO_META: {"name": "oauth-lesson-client", "version": "1.0.0"},
    }


def encode_mcp_header_value(value: str) -> str:
    is_safe = (
        value.isascii()
        and value == value.strip()
        and all(0x20 <= ord(character) <= 0x7E for character in value)
        and not (
            value.startswith(BASE64_SENTINEL_PREFIX)
            and value.endswith(BASE64_SENTINEL_SUFFIX)
        )
    )
    if is_safe:
        return value
    payload = base64.b64encode(value.encode("utf-8")).decode("ascii")
    return f"{BASE64_SENTINEL_PREFIX}{payload}{BASE64_SENTINEL_SUFFIX}"


def decode_mcp_header_value(value: Any) -> str:
    if not isinstance(value, str):
        raise ProtocolError(-32020, "Mcp-Name header is missing or malformed")
    if value.startswith(BASE64_SENTINEL_PREFIX) and value.endswith(BASE64_SENTINEL_SUFFIX):
        payload = value[len(BASE64_SENTINEL_PREFIX):-len(BASE64_SENTINEL_SUFFIX)]
        try:
            return base64.b64decode(payload, validate=True).decode("utf-8")
        except (binascii.Error, UnicodeDecodeError, ValueError) as exc:
            raise ProtocolError(-32020, "Mcp-Name header has invalid Base64 encoding") from exc
    if (
        not value.isascii()
        or value != value.strip()
        or any(not 0x20 <= ord(character) <= 0x7E for character in value)
    ):
        raise ProtocolError(-32020, "Mcp-Name header is not safely encoded")
    return value


def make_mcp_request(request_id: int, tool: str, arguments: dict[str, Any] | None = None):
    params = {"name": tool, "arguments": dict(arguments or {}), "_meta": request_meta()}
    body = {"jsonrpc": "2.0", "id": request_id, "method": "tools/call", "params": params}
    headers = {
        "MCP-Protocol-Version": PROTOCOL_VERSION,
        "Mcp-Method": "tools/call",
        "Mcp-Name": encode_mcp_header_value(tool),
    }
    return body, headers


def make_discover_request(request_id: int = 0):
    body = {
        "jsonrpc": "2.0",
        "id": request_id,
        "method": "server/discover",
        "params": {"_meta": request_meta()},
    }
    headers = {
        "MCP-Protocol-Version": PROTOCOL_VERSION,
        "Mcp-Method": "server/discover",
    }
    return body, headers


def make_tools_list_request(request_id: int = 0):
    body = {
        "jsonrpc": "2.0",
        "id": request_id,
        "method": "tools/list",
        "params": {"_meta": request_meta()},
    }
    headers = {
        "MCP-Protocol-Version": PROTOCOL_VERSION,
        "Mcp-Method": "tools/list",
    }
    return body, headers


@dataclass
class AuthorizationServer:
    issuer: str = ISSUER
    supports_cimd: bool = True
    supports_dcr: bool = True
    clients: dict[str, dict[str, Any]] = field(default_factory=dict)
    pending_codes: dict[str, dict[str, Any]] = field(default_factory=dict)
    _pending_codes_lock: threading.Lock = field(
        default_factory=threading.Lock,
        init=False,
        repr=False,
    )

    def metadata(self) -> dict[str, Any]:
        metadata = {
            "issuer": self.issuer,
            "authorization_endpoint": f"{self.issuer}/authorize",
            "token_endpoint": f"{self.issuer}/token",
            "code_challenge_methods_supported": ["S256"],
            "authorization_response_iss_parameter_supported": True,
            "client_id_metadata_document_supported": self.supports_cimd,
        }
        if self.supports_dcr:
            metadata["registration_endpoint"] = f"{self.issuer}/register"
        return metadata

    @staticmethod
    def _validate_application(metadata: dict[str, Any], *, require_application_type: bool) -> None:
        application_type = metadata.get("application_type")
        if require_application_type and application_type not in {"native", "web"}:
            raise ValueError("application_type must be native or web")
        if application_type is not None and application_type not in {"native", "web"}:
            raise ValueError("application_type must be native or web")
        redirect_uris = metadata.get("redirect_uris")
        if not isinstance(redirect_uris, list) or not redirect_uris:
            raise ValueError("redirect_uris is required")
        parsed_redirects = []
        for redirect_uri in redirect_uris:
            if (
                not isinstance(redirect_uri, str)
                or not redirect_uri
                or redirect_uri != redirect_uri.strip()
                or any(character.isspace() for character in redirect_uri)
            ):
                raise ValueError(
                    "redirect_uris entries must be non-empty absolute URIs without fragments"
                )
            try:
                parsed = urlparse(redirect_uri)
                hostname = parsed.hostname
            except ValueError as exc:
                raise ValueError(
                    "redirect_uris entries must be non-empty absolute URIs without fragments"
                ) from exc
            if (
                not parsed.scheme
                or parsed.fragment
                or (
                    parsed.scheme in {"http", "https"}
                    and (not parsed.netloc or hostname is None)
                )
            ):
                raise ValueError(
                    "redirect_uris entries must be non-empty absolute URIs without fragments"
                )
            parsed_redirects.append(parsed)
        if application_type == "web":
            for parsed in parsed_redirects:
                if parsed.scheme != "https" or parsed.hostname in {"localhost", "127.0.0.1"}:
                    raise ValueError("web redirect URIs must use remote HTTPS")

    def enroll_cimd(self, metadata_url: str, document: dict[str, Any]) -> str:
        if not self.supports_cimd:
            raise ValueError("CIMD is not supported")
        parsed = urlparse(metadata_url)
        if parsed.scheme != "https" or not parsed.netloc or parsed.path in {"", "/"}:
            raise ValueError("CIMD client_id must be an HTTPS URL with a path")
        if parsed.username is not None or parsed.password is not None:
            raise ValueError("CIMD client_id must not contain userinfo")
        if parsed.fragment:
            raise ValueError("CIMD client_id must not contain a fragment")
        if any(segment in {".", ".."} for segment in parsed.path.split("/")):
            raise ValueError("CIMD client_id must not contain dot path segments")
        if document.get("client_id") != metadata_url:
            raise ValueError("CIMD client_id must equal its metadata URL")
        if not isinstance(document.get("client_name"), str) or not document["client_name"]:
            raise ValueError("client_name is required")
        auth_method = document.get("token_endpoint_auth_method")
        if auth_method is not None and not isinstance(auth_method, str):
            raise ValueError("token_endpoint_auth_method must be a string")
        if isinstance(auth_method, str) and auth_method.startswith("client_secret"):
            raise ValueError("CIMD must not use shared-secret client authentication")
        forbidden_fields = FORBIDDEN_CIMD_SECRET_FIELDS.intersection(document)
        if forbidden_fields:
            raise ValueError("CIMD must not contain client secrets or private keys")
        jwks = document.get("jwks")
        if isinstance(jwks, dict):
            keys = jwks.get("keys", [])
            if isinstance(keys, list) and any(
                isinstance(key, dict) and PRIVATE_JWK_FIELDS.intersection(key)
                for key in keys
            ):
                raise ValueError("CIMD jwks must contain public keys only")
        self._validate_application(document, require_application_type=False)
        self.clients[metadata_url] = {**document, "enrollment": "cimd"}
        return metadata_url

    def dynamic_register(self, metadata: dict[str, Any]) -> str:
        if not self.supports_dcr:
            raise ValueError("DCR is not supported")
        self._validate_application(metadata, require_application_type=True)
        client_id = f"dcr_{secrets.token_hex(6)}"
        self.clients[client_id] = {**metadata, "enrollment": "dcr-compatibility"}
        return client_id

    def authorize(
        self,
        *,
        client_id: str,
        redirect_uri: str,
        subject: str,
        scopes: set[str],
        challenge: str,
        resource: str,
    ) -> dict[str, str]:
        client = self.clients.get(client_id)
        if client is None or redirect_uri not in client["redirect_uris"]:
            raise ValueError("unknown client or redirect URI")
        code = f"code_{secrets.token_hex(8)}"
        self.pending_codes[code] = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "subject": subject,
            "scopes": frozenset(scopes),
            "challenge": challenge,
            "resource": resource,
            "expires_at": time.time() + 300,
        }
        return {"code": code, "iss": self.issuer}

    def exchange(
        self,
        *,
        code: str,
        client_id: str,
        verifier: str,
        redirect_uri: str,
        resource: str,
    ) -> Token:
        with self._pending_codes_lock:
            record = self.pending_codes.get(code)
            if record is None:
                raise ValueError("invalid authorization code")
            if record["expires_at"] <= time.time():
                self.pending_codes.pop(code, None)
                raise ValueError("invalid authorization code")
            if record["client_id"] != client_id:
                raise ValueError("client_id mismatch")
            if record["redirect_uri"] != redirect_uri:
                raise ValueError("redirect_uri mismatch")
            if record["resource"] != resource:
                raise ValueError("resource mismatch")
            challenge = base64.urlsafe_b64encode(
                hashlib.sha256(verifier.encode()).digest()
            ).rstrip(b"=").decode()
            if not secrets.compare_digest(challenge, record["challenge"]):
                raise ValueError("PKCE mismatch")
            self.pending_codes.pop(code)
        return Token(
            value=f"tok_{secrets.token_hex(12)}",
            issuer=self.issuer,
            audience=resource,
            subject=record["subject"],
            client_id=record["client_id"],
            scopes=record["scopes"],
            expires_at=time.time() + 3600,
        )


@dataclass
class ResourceServer:
    resource: str = RESOURCE
    issuer: str = ISSUER
    scopes: dict[str, str] = field(default_factory=lambda: {
        "notes.list": "notes:read",
        "notes.create": "notes:write",
        "notes.delete": "notes:delete",
    })

    def protected_resource_metadata(self) -> dict[str, Any]:
        return {
            "resource": self.resource,
            "authorization_servers": [self.issuer],
            "scopes_supported": sorted(set(self.scopes.values())),
        }

    @staticmethod
    def _success(request_id: Any, result: dict[str, Any]) -> dict[str, Any]:
        payload = dict(result)
        payload.setdefault("resultType", "complete")
        payload.setdefault("_meta", {})[SERVER_INFO_META] = SERVER_INFO
        return {"jsonrpc": "2.0", "id": request_id, "result": payload}

    @staticmethod
    def _error(request_id: Any, error: ProtocolError) -> dict[str, Any]:
        payload: dict[str, Any] = {"code": error.code, "message": error.message}
        if error.data is not None:
            payload["data"] = error.data
        return {"jsonrpc": "2.0", "id": request_id, "error": payload}

    @staticmethod
    def _validate_wire(body: dict[str, Any], headers: dict[str, str]) -> dict[str, Any]:
        if body.get("jsonrpc") != "2.0":
            raise ProtocolError(-32600, "Invalid Request")
        method = body.get("method")
        params = body.get("params")
        if not isinstance(method, str) or not isinstance(params, dict):
            raise ProtocolError(-32600, "Invalid Request")
        meta = params.get("_meta") if isinstance(params, dict) else None
        if not isinstance(meta, dict):
            raise ProtocolError(-32602, "params._meta must be an object")
        requested_version = meta.get(PROTOCOL_META)
        if not isinstance(requested_version, str):
            raise ProtocolError(-32602, "protocolVersion must be a string")
        if not isinstance(meta.get(CLIENT_CAPABILITIES_META), dict):
            raise ProtocolError(-32602, "clientCapabilities must be an object")
        if headers.get("MCP-Protocol-Version") != requested_version:
            raise ProtocolError(-32020, "MCP-Protocol-Version header mismatch")
        if headers.get("Mcp-Method") != method:
            raise ProtocolError(-32020, "Mcp-Method header mismatch")
        if method in {"tools/call", "resources/read", "prompts/get"}:
            expected_name = params.get("name") or params.get("uri")
            supplied_name = decode_mcp_header_value(headers.get("Mcp-Name"))
            if supplied_name != expected_name:
                raise ProtocolError(-32020, "Mcp-Name header mismatch")
        if requested_version != PROTOCOL_VERSION:
            raise ProtocolError(
                -32022,
                "Unsupported protocol version",
                {"supported": [PROTOCOL_VERSION], "requested": requested_version},
            )
        return params

    def discover(
        self,
        body: dict[str, Any],
        headers: dict[str, str],
        *,
        http_method: str = "POST",
    ) -> tuple[int, dict[str, Any] | None, dict[str, str]]:
        return self.handle(body, headers, None, http_method=http_method)

    def call(
        self,
        body: dict[str, Any],
        headers: dict[str, str],
        token: Token | None,
        *,
        http_method: str = "POST",
    ) -> tuple[int, dict[str, Any] | None, dict[str, str]]:
        return self.handle(body, headers, token, http_method=http_method)

    def handle(
        self,
        body: dict[str, Any],
        headers: dict[str, str],
        token: Token | None = None,
        *,
        http_method: str = "POST",
    ) -> tuple[int, dict[str, Any] | None, dict[str, str]]:
        is_notification = "id" not in body
        try:
            if http_method != "POST":
                raise ProtocolError(-32600, "HTTP method not allowed", http_status=405)
            params = self._validate_wire(body, headers)
            method = body["method"]
            if method == "server/discover":
                result = {
                    "supportedVersions": [PROTOCOL_VERSION],
                    "capabilities": {"tools": {"listChanged": False}},
                    "ttlMs": 60_000,
                    "cacheScope": "public",
                }
            elif method == "tools/list":
                result = {
                    "tools": sorted(TOOL_DESCRIPTORS, key=lambda tool: tool["name"]),
                    "ttlMs": 60_000,
                    "cacheScope": "public",
                }
            elif method == "tools/call":
                challenge_base = f'Bearer resource_metadata="{RESOURCE_METADATA_URI}"'
                challenge_headers = {"WWW-Authenticate": challenge_base}
                if token is None or token.expires_at < time.time():
                    raise ProtocolError(
                        -32001,
                        "Unauthorized",
                        {"reason": "invalid_token"},
                        401,
                        challenge_headers,
                    )
                if token.issuer != self.issuer or token.audience != self.resource:
                    raise ProtocolError(
                        -32001,
                        "Unauthorized",
                        {"reason": "invalid_token"},
                        401,
                        challenge_headers,
                    )
                required = self.scopes.get(params.get("name"))
                if required is None:
                    raise ProtocolError(
                        -32602,
                        "Unknown tool",
                        {"name": params.get("name")},
                        404,
                    )
                if required not in token.scopes:
                    challenge = f'{challenge_base}, error="insufficient_scope", scope="{required}"'
                    raise ProtocolError(
                        -32003,
                        "Insufficient scope",
                        {"requiredScope": required},
                        403,
                        {"WWW-Authenticate": challenge},
                    )
                result = {
                    "content": [{
                        "type": "text",
                        "text": f"{params['name']} allowed for {token.subject}",
                    }],
                    "isError": False,
                }
            else:
                raise ProtocolError(-32601, "Method not found", http_status=404)
            if is_notification:
                return 202, None, {}
            return 200, self._success(body["id"], result), {}
        except ProtocolError as error:
            if is_notification:
                return error.http_status, None, dict(error.headers or {})
            return (
                error.http_status,
                self._error(body.get("id"), error),
                dict(error.headers or {}),
            )


class Client:
    def __init__(self, *, subject: str = "alice", application_type: str = "native") -> None:
        self.subject = subject
        self.application_type = application_type
        self.redirect_uri = "http://127.0.0.1:8765/callback" if application_type == "native" else "https://client.example.com/callback"
        self.client_ids_by_issuer: dict[str, str] = {}
        self.tokens_by_issuer_resource: dict[tuple[str, str], Token] = {}
        self.next_request_id = 1

    def _client_document(self) -> dict[str, Any]:
        return {
            "client_id": CLIENT_METADATA_URL,
            "client_name": "OAuth lesson client",
            "application_type": self.application_type,
            "redirect_uris": [self.redirect_uri],
            "grant_types": ["authorization_code"],
            "response_types": ["code"],
        }

    def enroll(self, auth: AuthorizationServer) -> str:
        metadata = auth.metadata()
        if metadata.get("issuer") != auth.issuer:
            raise ValueError("authorization metadata issuer mismatch")
        if metadata.get("client_id_metadata_document_supported"):
            client_id = auth.enroll_cimd(CLIENT_METADATA_URL, self._client_document())
        elif metadata.get("registration_endpoint"):
            fallback = self._client_document()
            fallback.pop("client_id")
            client_id = auth.dynamic_register(fallback)
        else:
            raise ValueError("authorization server offers no supported client enrollment")
        self.client_ids_by_issuer[auth.issuer] = client_id
        return client_id

    def authorize(self, auth: AuthorizationServer, resource: str, scopes: set[str]) -> Token:
        client_id = self.client_ids_by_issuer.get(auth.issuer)
        if client_id is None:
            client_id = self.enroll(auth)
        verifier, challenge = pkce_pair()
        response = auth.authorize(
            client_id=client_id,
            redirect_uri=self.redirect_uri,
            subject=self.subject,
            scopes=scopes,
            challenge=challenge,
            resource=resource,
        )
        if response.get("iss") != auth.issuer:
            raise ValueError("authorization response issuer mismatch")
        token = auth.exchange(
            code=response["code"],
            client_id=client_id,
            verifier=verifier,
            redirect_uri=self.redirect_uri,
            resource=resource,
        )
        self.tokens_by_issuer_resource[(auth.issuer, resource)] = token
        return token

    def call_with_step_up(
        self,
        tool: str,
        server: ResourceServer,
        auth: AuthorizationServer,
    ) -> tuple[int, dict[str, Any] | None, dict[str, str]]:
        if server.issuer != auth.issuer:
            raise ValueError("protected resource selected a different issuer")
        key = (auth.issuer, server.resource)
        token = self.tokens_by_issuer_resource.get(key)
        if token is None:
            token = self.authorize(auth, server.resource, {"notes:read"})
        body, headers = make_mcp_request(self.next_request_id, tool)
        self.next_request_id += 1
        status, response, response_headers = server.call(body, headers, token)
        if status == 403 and response is not None and response.get("error", {}).get("code") == -32003:
            required = response_headers["WWW-Authenticate"].split('scope="', 1)[1].split('"', 1)[0]
            token = self.authorize(auth, server.resource, set(token.scopes) | {required})
            body, headers = make_mcp_request(self.next_request_id, tool)
            self.next_request_id += 1
            status, response, response_headers = server.call(body, headers, token)
        return status, response, response_headers


def demo() -> None:
    auth = AuthorizationServer()
    server = ResourceServer()
    client = Client()
    discover_body, discover_headers = make_discover_request()
    _, discovery, _ = server.discover(discover_body, discover_headers)
    print("server discovery:", discovery["result"] if discovery else None)
    list_body, list_headers = make_tools_list_request()
    _, listing, _ = server.handle(list_body, list_headers)
    print("tools:", [tool["name"] for tool in listing["result"]["tools"]] if listing else None)
    print("protected resource metadata:", server.protected_resource_metadata())
    print("CIMD client_id:", client.enroll(auth))
    for tool in ("notes.list", "notes.create", "notes.delete"):
        status, response, _ = client.call_with_step_up(tool, server, auth)
        print(tool, status, response.get("result", {}).get("content") if response else None)
    print("effective client ids by issuer:", sorted(client.client_ids_by_issuer))


if __name__ == "__main__":
    demo()
