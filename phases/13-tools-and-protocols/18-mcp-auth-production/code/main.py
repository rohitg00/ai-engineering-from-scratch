"""Phase 13 Lesson 18: MCP 2026-07-28 authorization in production.

A stdlib walk-through of the current MCP authorization surface:

  - RFC 8414 authorization server metadata
  - Client ID Metadata Documents first, deprecated RFC 7591 DCR as fallback
  - PKCE (RFC 7636) authorization code flow with audience pinning (RFC 8707)
  - RFC 9207 authorization-response issuer validation
  - JWT validation on the resource server
  - JWKS cache refresh on a schedule (the IdP rotates keys; the resource
    server only re-fetches them)
  - Audience-replay rejection via the aud claim
  - Client registration keyed by issuer and access tokens keyed by issuer plus resource

Three roles model the system: an AuthorizationServer that issues tokens and
rotates its signing keys, a ResourceServer (the MCP server) that caches the
JWKS and validates every request, and a Client that enrolls and obtains tokens.

Stdlib only. Run: python3 main.py
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import threading
import time
from dataclasses import dataclass, field
from urllib.parse import urlparse


# ---------------------------------------------------------------------------
# JWT helpers - HS256 keeps the lesson stdlib-only; production uses RS256/EdDSA
# ---------------------------------------------------------------------------


def b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def jwt_sign(payload: dict, kid: str, secret: bytes) -> str:
    header = {"alg": "HS256", "typ": "JWT", "kid": kid}
    h = b64url(json.dumps(header, separators=(",", ":")).encode())
    p = b64url(json.dumps(payload, separators=(",", ":")).encode())
    sig = hmac.new(secret, f"{h}.{p}".encode(), hashlib.sha256).digest()
    return f"{h}.{p}.{b64url(sig)}"


def jwt_decode(token: str) -> tuple[dict, dict, str]:
    h_b64, p_b64, sig_b64 = token.split(".")
    header = json.loads(b64url_decode(h_b64))
    payload = json.loads(b64url_decode(p_b64))
    return header, payload, sig_b64


def jwt_verify(token: str, secret: bytes) -> bool:
    h_b64, p_b64, sig_b64 = token.split(".")
    expected = hmac.new(secret, f"{h_b64}.{p_b64}".encode(), hashlib.sha256).digest()
    return hmac.compare_digest(expected, b64url_decode(sig_b64))


def protected_resource_metadata_url(resource: str) -> str:
    parsed = urlparse(resource)
    if parsed.scheme != "https" or not parsed.netloc or parsed.query or parsed.fragment:
        raise ValueError("MCP resource must be an absolute HTTPS URL without query or fragment")
    suffix = "" if parsed.path in {"", "/"} else parsed.path
    return f"{parsed.scheme}://{parsed.netloc}/.well-known/oauth-protected-resource{suffix}"


MCP_RESOURCE = "https://notes.example.com"
OTHER_MCP_RESOURCE = "https://tasks.example.com"

# RFC 9728 protected-resource metadata URLs. Every 401/403 names this in the
# WWW-Authenticate header so the client can rediscover the auth server.
MCP_RESOURCE_METADATA = protected_resource_metadata_url(MCP_RESOURCE)
OTHER_MCP_RESOURCE_METADATA = protected_resource_metadata_url(OTHER_MCP_RESOURCE)

# Each tool declares the scope it needs. Destructive tools sit behind a stronger
# scope (mcp:tools.delete) that is NOT in the IdP's minimal scopes_supported, so
# a client reaches it only via the step-up flow.
TOOL_SCOPES = {
    "notes.list": "mcp:tools.invoke",
    "notes.read": "mcp:tools.invoke",
    "notes.delete": "mcp:tools.delete",
    "tasks.list": "mcp:tools.invoke",
}
DEFAULT_TOOL_SCOPE = "mcp:tools.invoke"
AUTHORIZATION_CODE_TTL_SECONDS = 300


def parsed_absolute_redirect_uri(value: object):
    if (
        not isinstance(value, str)
        or not value
        or value != value.strip()
        or any(character.isspace() or ord(character) < 0x20 or ord(character) == 0x7F for character in value)
    ):
        return None
    try:
        parsed = urlparse(value)
        hostname = parsed.hostname
        _ = parsed.port
    except ValueError:
        return None
    if not parsed.scheme or parsed.fragment or parsed.username is not None or parsed.password is not None:
        return None
    if parsed.scheme in {"http", "https"} and (not parsed.netloc or hostname is None):
        return None
    return parsed


def valid_web_redirect_uri(value: object) -> bool:
    parsed = parsed_absolute_redirect_uri(value)
    return parsed is not None and parsed.scheme == "https" and parsed.hostname is not None


def valid_private_use_scheme(scheme: str) -> bool:
    labels = scheme.split(".")
    return len(labels) >= 2 and all(
        label
        and label.isascii()
        and label[0].isalnum()
        and label[-1].isalnum()
        and all(character.isalnum() or character == "-" for character in label)
        for label in labels
    )


def valid_native_redirect_uri(value: object) -> bool:
    parsed = parsed_absolute_redirect_uri(value)
    if parsed is None:
        return False
    if parsed.scheme == "https":
        return parsed.hostname is not None
    if parsed.scheme == "http":
        return parsed.hostname in {"localhost", "127.0.0.1", "::1"}
    return valid_private_use_scheme(parsed.scheme)


# ---------------------------------------------------------------------------
# Authorization server - issues tokens, registers clients, rotates signing keys
# ---------------------------------------------------------------------------


@dataclass
class IdPKey:
    kid: str
    secret: bytes
    issued_at: float


@dataclass
class AuthorizationServer:
    issuer: str = "https://auth.example.com"
    keys: list[IdPKey] = field(default_factory=list)
    clients: dict[str, dict] = field(default_factory=dict)
    authorization_codes: dict[str, dict] = field(default_factory=dict)
    _authorization_codes_lock: threading.Lock = field(
        default_factory=threading.Lock,
        repr=False,
        compare=False,
    )

    def current_key(self) -> IdPKey:
        return self.keys[-1]

    def rotate_key(self) -> IdPKey:
        """AS-side key rotation: introduce the next key, retire the oldest.

        Steady state is two overlapping keys, so tokens signed by the previous
        key stay valid until they expire.
        """
        new_kid = f"k_{int(time.time())}_{secrets.token_hex(2)}"
        new = IdPKey(kid=new_kid, secret=secrets.token_bytes(32), issued_at=time.time())
        self.keys.append(new)
        if len(self.keys) > 2:
            self.keys = self.keys[-2:]
        return new

    def jwks(self) -> dict:
        return {
            "keys": [
                {"kid": k.kid, "kty": "oct", "alg": "HS256", "use": "sig", "k": b64url(k.secret)}
                for k in self.keys
            ]
        }

    def metadata(self) -> dict:
        """RFC 8414 authorization server metadata."""
        return {
            "issuer": self.issuer,
            "authorization_endpoint": f"{self.issuer}/authorize",
            "token_endpoint": f"{self.issuer}/token",
            "jwks_uri": f"{self.issuer}/.well-known/jwks.json",
            "registration_endpoint": f"{self.issuer}/register",
            "response_types_supported": ["code"],
            "grant_types_supported": ["authorization_code", "refresh_token"],
            "code_challenge_methods_supported": ["S256"],
            "scopes_supported": ["mcp:tools.read", "mcp:tools.invoke"],
            "token_endpoint_auth_methods_supported": ["none", "private_key_jwt"],
            "authorization_response_iss_parameter_supported": True,
            "client_id_metadata_document_supported": True,
        }

    def register_cimd(self, document_url: str, document: dict) -> str:
        """Resolve a Client ID Metadata Document without minting an identifier."""
        parsed = urlparse(document_url)
        if parsed.scheme != "https" or not parsed.netloc or parsed.path in {"", "/"}:
            raise ValueError("CIMD client_id must be an absolute HTTPS URL with a path")
        if document.get("client_id") != document_url:
            raise ValueError("CIMD client_id must equal its document URL")
        client_name = document.get("client_name")
        if not isinstance(client_name, str) or not client_name.strip():
            raise ValueError("CIMD requires a non-empty client_name")
        application_type = document.get("application_type")
        if application_type is not None and application_type not in {"native", "web"}:
            raise ValueError("CIMD application_type, when present, must be native or web")
        redirect_application_type = application_type or "native"
        redirect_uris = document.get("redirect_uris", [])
        if (
            not isinstance(redirect_uris, list)
            or not redirect_uris
            or any(parsed_absolute_redirect_uri(uri) is None for uri in redirect_uris)
        ):
            raise ValueError(
                "CIMD requires absolute redirect URIs without fragments"
            )
        if redirect_application_type == "web" and any(
            not valid_web_redirect_uri(uri) for uri in redirect_uris
        ):
            raise ValueError(
                "CIMD web clients require absolute HTTPS redirect URIs "
                "with a host and no fragment"
            )
        if redirect_application_type == "native" and any(
            not valid_native_redirect_uri(uri) for uri in redirect_uris
        ):
            raise ValueError(
                "CIMD native clients require HTTPS, a loopback HTTP URI, or a "
                "domain-based private-use scheme"
            )
        self.clients[document_url] = {
            "redirect_uris": redirect_uris,
            "grant_types": document.get("grant_types", ["authorization_code"]),
            "application_type": application_type,
            "client_name": client_name,
            "enrollment": "cimd",
            "issued_at": time.time(),
        }
        return document_url

    def register_client(self, body: dict) -> dict:
        """Deprecated RFC 7591 registration retained for compatibility."""
        redirect_uris = body.get("redirect_uris", [])
        if (
            not isinstance(redirect_uris, list)
            or not redirect_uris
            or any(parsed_absolute_redirect_uri(uri) is None for uri in redirect_uris)
        ):
            return {"status": 400, "body": {"error": "invalid_redirect_uri"}}
        application_type = body.get("application_type")
        if application_type not in {"native", "web"}:
            return {"status": 400, "body": {"error": "invalid_client_metadata"}}
        if application_type == "web" and any(
            not valid_web_redirect_uri(uri) for uri in redirect_uris
        ):
            return {"status": 400, "body": {"error": "invalid_redirect_uri"}}
        if application_type == "native" and any(
            not valid_native_redirect_uri(uri) for uri in redirect_uris
        ):
            return {"status": 400, "body": {"error": "invalid_redirect_uri"}}
        if body.get("token_endpoint_auth_method", "none") not in {"none", "private_key_jwt"}:
            return {"status": 400, "body": {"error": "invalid_client_metadata"}}
        cid = f"c_{secrets.token_hex(4)}"
        reg_token = secrets.token_urlsafe(24)
        self.clients[cid] = {
            "redirect_uris": redirect_uris,
            "grant_types": body.get("grant_types", ["authorization_code"]),
            # Store only a hash; theft of this token lets an attacker rewrite redirect URIs.
            "registration_access_token_hash": hashlib.sha256(reg_token.encode()).hexdigest(),
            "client_name": body.get("client_name", ""),
            "application_type": application_type,
            "enrollment": "dcr",
            "issued_at": time.time(),
        }
        return {
            "status": 201,
            "body": {
                "client_id": cid,
                "client_id_issued_at": int(time.time()),
                "redirect_uris": redirect_uris,
                "grant_types": body.get("grant_types", ["authorization_code"]),
                "application_type": application_type,
                "registration_access_token": reg_token,
                "registration_client_uri": f"{self.issuer}/register/{cid}",
            },
        }

    def pre_register_client(
        self,
        client_id: str,
        *,
        redirect_uris: list[str],
        client_name: str,
        application_type: str = "native",
    ) -> str:
        if not client_id or not redirect_uris or not client_name.strip():
            raise ValueError("pre-registration requires client_id, client_name, and redirect_uris")
        if application_type not in {"native", "web"}:
            raise ValueError("pre-registration application_type must be native or web")
        if (
            not isinstance(redirect_uris, list)
            or any(parsed_absolute_redirect_uri(uri) is None for uri in redirect_uris)
        ):
            raise ValueError(
                "pre-registration requires absolute redirect URIs without fragments"
            )
        if application_type == "web" and any(
            not valid_web_redirect_uri(uri) for uri in redirect_uris
        ):
            raise ValueError(
                "pre-registered web clients require absolute HTTPS redirect URIs "
                "with a host and no fragment"
            )
        if application_type == "native" and any(
            not valid_native_redirect_uri(uri) for uri in redirect_uris
        ):
            raise ValueError(
                "pre-registered native clients require HTTPS redirect URIs, "
                "loopback HTTP redirect URIs, or a domain-based private-use scheme"
            )
        self.clients[client_id] = {
            "redirect_uris": list(redirect_uris),
            "grant_types": ["authorization_code"],
            "application_type": application_type,
            "client_name": client_name,
            "enrollment": "pre_registered",
            "issued_at": time.time(),
        }
        return client_id

    def begin_authorization(
        self,
        *,
        client_id: str,
        redirect_uri: str,
        code_challenge: str,
        code_challenge_method: str,
        scopes: set[str],
        resource: str,
        user: str,
    ) -> dict[str, str]:
        client = self.clients.get(client_id)
        if client is None:
            raise ValueError("client is not enrolled with this issuer")
        if redirect_uri not in client.get("redirect_uris", []):
            raise ValueError("authorization redirect_uri is not registered")
        if not isinstance(code_challenge, str) or not code_challenge:
            raise ValueError("authorization request requires an S256 code_challenge")
        if code_challenge_method != "S256":
            raise ValueError("authorization request requires code_challenge_method S256")
        parsed_resource = urlparse(resource)
        if parsed_resource.scheme != "https" or not parsed_resource.netloc:
            raise ValueError("resource must be an absolute HTTPS URL")
        with self._authorization_codes_lock:
            now = time.time()
            expired_codes = [
                code
                for code, record in self.authorization_codes.items()
                if record["expires_at"] <= now
            ]
            for expired_code in expired_codes:
                self.authorization_codes.pop(expired_code, None)
            code = secrets.token_urlsafe(24)
            while code in self.authorization_codes:
                code = secrets.token_urlsafe(24)
            self.authorization_codes[code] = {
                "client_id": client_id,
                "redirect_uri": redirect_uri,
                "code_challenge": code_challenge,
                "code_challenge_method": code_challenge_method,
                "scopes": set(scopes),
                "resource": resource,
                "user": user,
                "expires_at": now + AUTHORIZATION_CODE_TTL_SECONDS,
            }
        return {"code": code, "iss": self.issuer}

    def redeem_code(
        self,
        *,
        code: str,
        client_id: str,
        redirect_uri: str,
        code_verifier: str,
        resource: str,
    ) -> str:
        with self._authorization_codes_lock:
            record = self.authorization_codes.get(code)
            if record is None:
                raise ValueError("authorization code is invalid or already used")
            if record["expires_at"] <= time.time():
                self.authorization_codes.pop(code, None)
                raise ValueError("authorization code is expired")
            if record["client_id"] != client_id or record["redirect_uri"] != redirect_uri:
                raise ValueError("authorization code is not bound to this client redirect")
            if record["resource"] != resource:
                raise ValueError("token resource does not match the authorization request")
            supplied_challenge = b64url(hashlib.sha256(code_verifier.encode()).digest())
            if not hmac.compare_digest(record["code_challenge"], supplied_challenge):
                raise ValueError("PKCE code_verifier does not match the stored challenge")
            self.authorization_codes.pop(code)
        return self.issue_token(
            client_id,
            record["user"],
            record["scopes"],
            record["resource"],
        )

    def issue_token(self, client_id: str, user: str, scopes: set[str], resource: str) -> str:
        """Issue an audience-pinned access token signed by the current key."""
        if client_id not in self.clients:
            raise ValueError("client is not enrolled with this issuer")
        key = self.current_key()
        claims = {
            "iss": self.issuer,
            "sub": user,
            "aud": resource,
            "azp": client_id,
            "scope": " ".join(sorted(scopes)),
            "iat": int(time.time()),
            "exp": int(time.time()) + 3600,
        }
        return jwt_sign(claims, kid=key.kid, secret=key.secret)


# ---------------------------------------------------------------------------
# Resource server (the MCP server) - caches JWKS, validates every request
# ---------------------------------------------------------------------------


@dataclass
class ResourceServer:
    resource: str
    auth_server: AuthorizationServer
    allowed_issuers: list[str] = field(default_factory=list)
    jwks_cache: dict[str, dict] = field(default_factory=dict)

    @property
    def resource_metadata(self) -> str:
        return protected_resource_metadata_url(self.resource)

    def refresh_jwks(self) -> dict:
        """Re-fetch the AS's published JWKS into the cache. Idempotent.

        Key *rotation* happens at the authorization server, not here. A resource
        server cannot mint or roll the AS's signing keys; it can only re-pull the
        published set. Both the scheduled refresh job and the validator's
        cache-miss fall-back call this. Because it is a pure fetch, an attacker
        who sends tokens with random `kid` values triggers at most one harmless
        re-fetch, not an unbounded series of key rotations (the bug you get if
        you wire the fall-back to a rotate-and-mint instead).
        """
        keys = self.auth_server.jwks()["keys"]
        self.jwks_cache[self.auth_server.issuer] = {"keys": keys, "fetched_at": time.time()}
        return {"refreshed": True, "kids": [k["kid"] for k in keys]}

    def cached_kids(self) -> list[str]:
        entry = self.jwks_cache.get(self.auth_server.issuer, {"keys": []})
        return [k["kid"] for k in entry["keys"]]

    def validate(self, token: str, required_scope: str | None = None) -> dict:
        rm = self.resource_metadata

        def challenge(status: int, params: str) -> dict:
            return {"valid": False, "status": status, "www_authenticate": f"Bearer {params}"}

        try:
            header, claims, _ = jwt_decode(token)
        except Exception:
            return challenge(401, f'error="invalid_token", error_description="malformed", resource_metadata="{rm}"')

        iss = claims.get("iss", "")
        # Check the issuer allow-list first: an untrusted iss should never cost
        # us a JWKS refresh, and "iss not allowed" is the correct error to return.
        if iss not in self.allowed_issuers:
            return challenge(401, f'error="invalid_token", error_description="iss not allowed", resource_metadata="{rm}"')
        cache = self.jwks_cache.get(iss)
        if cache is None:
            self.refresh_jwks()
            cache = self.jwks_cache.get(iss)

        matching = next((k for k in cache["keys"] if k["kid"] == header.get("kid")), None) if cache else None
        if matching is None:
            # Key-overlap window: a token signed by a key newer than our cache.
            # Re-fetch (not rotate) once, then re-check. A bogus kid simply falls
            # through to the 401 below after one idempotent fetch.
            self.refresh_jwks()
            cache = self.jwks_cache.get(iss)
            matching = next((k for k in cache["keys"] if k["kid"] == header.get("kid")), None) if cache else None
        if matching is None:
            return challenge(401, f'error="invalid_token", error_description="unknown kid", resource_metadata="{rm}"')

        if not jwt_verify(token, b64url_decode(matching["k"])):
            return challenge(401, f'error="invalid_token", error_description="bad signature", resource_metadata="{rm}"')
        if claims.get("aud") != self.resource:
            return challenge(401, f'error="invalid_token", error_description="audience mismatch", resource_metadata="{rm}"')
        if claims.get("exp", 0) < time.time():
            return challenge(401, f'error="invalid_token", error_description="expired", resource_metadata="{rm}"')
        if required_scope and required_scope not in set(claims.get("scope", "").split()):
            return challenge(403, f'error="insufficient_scope", scope="{required_scope}", resource_metadata="{rm}"')
        return {"valid": True, "claims": claims}

    def call_tool(self, tool: str, bearer: str) -> dict:
        required_scope = TOOL_SCOPES.get(tool, DEFAULT_TOOL_SCOPE)
        result = self.validate(bearer, required_scope=required_scope)
        if not result["valid"]:
            return {"status": result["status"], "WWW-Authenticate": result["www_authenticate"]}
        return {"status": 200, "body": {"tool": tool, "user": result["claims"]["sub"], "ok": True}}


# ---------------------------------------------------------------------------
# Client - discovery, DCR enrollment, PKCE + audience-pinned token request
# ---------------------------------------------------------------------------


@dataclass
class Client:
    name: str
    auth_server: AuthorizationServer
    client_metadata_url: str | None = None
    client_metadata: dict | None = None
    pre_registered_client_ids_by_issuer: dict[str, str] = field(default_factory=dict)
    client_ids_by_issuer: dict[str, str] = field(default_factory=dict)
    access_tokens_by_issuer_resource: dict[tuple[str, str], str] = field(default_factory=dict)
    expected_issuer: str | None = None
    require_response_issuer: bool = False

    def discover(self) -> dict:
        meta = self.auth_server.metadata()
        if meta.get("issuer") != self.auth_server.issuer:
            raise ValueError("authorization metadata issuer mismatch")
        if "S256" not in meta["code_challenge_methods_supported"]:
            raise ValueError("authorization server does not advertise S256 PKCE")
        if not (meta.get("client_id_metadata_document_supported") or "registration_endpoint" in meta):
            raise ValueError("authorization server advertises no client enrollment path")
        self.expected_issuer = meta["issuer"]
        self.require_response_issuer = bool(
            meta.get("authorization_response_iss_parameter_supported")
        )
        return meta

    def register(self) -> str:
        """Use the deprecated DCR fallback and key the credential by issuer."""
        resp = self.auth_server.register_client(
            {
                "redirect_uris": ["http://127.0.0.1:7333/callback"],
                "grant_types": ["authorization_code", "refresh_token"],
                "response_types": ["code"],
                "token_endpoint_auth_method": "none",
                "application_type": "native",
                "scope": "mcp:tools.invoke",
                "client_name": self.name,
            }
        )
        if resp["status"] != 201:
            raise ValueError(f"client registration failed: {resp}")
        issuer = self.auth_server.issuer
        self.client_ids_by_issuer[issuer] = resp["body"]["client_id"]
        return self.client_ids_by_issuer[issuer]

    def enroll(self) -> str:
        """Prefer CIMD; use DCR only when the current issuer cannot resolve it."""
        meta = self.discover()
        issuer = meta["issuer"]
        if issuer in self.client_ids_by_issuer:
            return self.client_ids_by_issuer[issuer]
        pre_registered = self.pre_registered_client_ids_by_issuer.get(issuer)
        if pre_registered is not None:
            if pre_registered not in self.auth_server.clients:
                raise ValueError("pre-registered client_id is not known to this issuer")
            self.client_ids_by_issuer[issuer] = pre_registered
            return pre_registered
        if meta.get("client_id_metadata_document_supported"):
            if not self.client_metadata_url or not self.client_metadata:
                raise ValueError("CIMD-capable issuer requires a client metadata document")
            client_id = self.auth_server.register_cimd(
                self.client_metadata_url, self.client_metadata
            )
            self.client_ids_by_issuer[issuer] = client_id
            return client_id
        return self.register()

    def validate_authorization_response_issuer(self, returned_issuer: str | None) -> None:
        if self.expected_issuer is None:
            raise ValueError("authorization server metadata was not discovered")
        if returned_issuer is None:
            if self.require_response_issuer:
                raise ValueError("authorization response omitted required iss")
            return
        if returned_issuer != self.expected_issuer:
            raise ValueError("authorization response issuer mismatch")

    def use_authorization_server(self, auth_server: AuthorizationServer) -> None:
        """Switch issuer without copying a client identifier or access token."""
        self.auth_server = auth_server
        self.expected_issuer = None
        self.require_response_issuer = False

    def authorize(self, scopes: set[str], resource: str, user: str) -> str:
        issuer = self.auth_server.issuer
        client_id = self.client_ids_by_issuer.get(issuer)
        if client_id is None:
            raise ValueError("client must enroll separately with this issuer")
        redirect_uris = self.auth_server.clients[client_id].get("redirect_uris", [])
        if not redirect_uris:
            raise ValueError("client has no registered redirect URI")
        redirect_uri = redirect_uris[0]
        verifier = secrets.token_urlsafe(32)
        challenge = b64url(hashlib.sha256(verifier.encode()).digest())
        authorization_response = self.auth_server.begin_authorization(
            client_id=client_id,
            redirect_uri=redirect_uri,
            code_challenge=challenge,
            code_challenge_method="S256",
            scopes=scopes,
            resource=resource,
            user=user,
        )
        self.validate_authorization_response_issuer(authorization_response.get("iss"))
        token = self.auth_server.redeem_code(
            code=authorization_response["code"],
            client_id=client_id,
            redirect_uri=redirect_uri,
            code_verifier=verifier,
            resource=resource,
        )
        self.access_tokens_by_issuer_resource[(issuer, resource)] = token
        return token


# ---------------------------------------------------------------------------
# Demo - the production flow
# ---------------------------------------------------------------------------


def demo() -> None:
    print("=" * 72)
    print("PHASE 13 LESSON 18 - MCP AUTH IN PRODUCTION")
    print("=" * 72)

    print("\n--- step 1: stand up the authorization server (two overlapping keys) ---")
    auth = AuthorizationServer()
    auth.rotate_key()
    auth.rotate_key()
    print(f"  issuer={auth.issuer}, keys={[k.kid for k in auth.keys]}")

    print("\n--- step 2: client discovers the authorization server (RFC 8414) ---")
    cimd_url = "https://client.example.com/oauth/client.json"
    client = Client(
        name="Example native client",
        auth_server=auth,
        client_metadata_url=cimd_url,
        client_metadata={
            "client_id": cimd_url,
            "client_name": "Example native client",
            "redirect_uris": ["http://127.0.0.1:7333/callback"],
            "grant_types": ["authorization_code", "refresh_token"],
            "response_types": ["code"],
            "token_endpoint_auth_method": "none",
        },
    )
    meta = client.discover()
    print(f"  issuer={meta['issuer']}, S256 PKCE supported")
    print(f"  CIMD supported={meta['client_id_metadata_document_supported']}")

    print("\n--- step 3: client enrolls through CIMD without DCR ---")
    cid = client.enroll()
    print(f"  client_id metadata URL: {cid}")
    print(f"  credential cache issuer keys: {list(client.client_ids_by_issuer)}")

    print("\n--- step 4: client runs PKCE authorization flow with resource indicator ---")
    bearer = client.authorize(scopes={"mcp:tools.invoke"}, resource=MCP_RESOURCE, user="alice@example.com")
    print(f"  bearer issued (kid={auth.current_key().kid}, aud={MCP_RESOURCE})")

    print("\n--- step 5: MCP server validates the request, JWKS cache primed on first use ---")
    server = ResourceServer(resource=MCP_RESOURCE, auth_server=auth, allowed_issuers=[auth.issuer])
    resp = server.call_tool("notes.list", bearer)
    print(f"  server response: {resp}")
    assert resp["status"] == 200

    print("\n--- step 6: IdP rotates a key, scheduled refresh re-pulls the JWKS ---")
    print(f"  cached kids before refresh: {server.cached_kids()}")
    auth.rotate_key()  # authorization-server-side rotation, independent of the MCP server
    server.refresh_jwks()  # scheduled job re-pulls the published JWKS
    print(f"  cached kids after refresh:  {server.cached_kids()}")

    print("\n--- step 7: existing token still validates (overlap window) ---")
    resp = server.call_tool("notes.list", bearer)
    print(f"  server response: {resp}")
    assert resp["status"] == 200

    print("\n--- step 8: new token signed with new key validates against refreshed JWKS ---")
    fresh_bearer = client.authorize(scopes={"mcp:tools.invoke"}, resource=MCP_RESOURCE, user="alice@example.com")
    fresh_header, _, _ = jwt_decode(fresh_bearer)
    print(f"  fresh token kid: {fresh_header['kid']}")
    resp = server.call_tool("notes.read", fresh_bearer)
    print(f"  server response: {resp}")
    assert resp["status"] == 200

    print("\n--- step 9: audience-replay attempt against a different MCP resource ---")
    other_server = ResourceServer(resource=OTHER_MCP_RESOURCE, auth_server=auth, allowed_issuers=[auth.issuer])
    resp = other_server.call_tool("tasks.list", bearer)
    print(f"  other server response: {resp}")
    assert resp["status"] == 401
    assert "audience mismatch" in resp["WWW-Authenticate"]

    print("\n--- bonus: step-up flow for a higher-privilege scope ---")
    elevated = client.authorize(
        scopes={"mcp:tools.invoke", "mcp:tools.delete"}, resource=MCP_RESOURCE, user="alice@example.com"
    )
    elevated_resp = server.call_tool("notes.delete", elevated)
    print(f"  server response: {elevated_resp}")

    print("\n" + "=" * 72)
    print("DONE - issuer-bound enrollment, response iss, audience, and JWKS refresh")
    print("=" * 72)


if __name__ == "__main__":
    demo()
