"""Phase 13 Lesson 18 - MCP auth in production.

A stdlib walk-through of the production MCP auth surface:

  - RFC 8414 authorization server metadata
  - RFC 7591 dynamic client registration (DCR fallback path)
  - PKCE (RFC 7636) authorization code flow with audience pinning (RFC 8707)
  - JWT validation on the resource server
  - JWKS cache refresh on a schedule (the IdP rotates keys; the resource
    server only re-fetches them)
  - Audience-replay rejection via the aud claim

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
import time
from dataclasses import dataclass, field


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


MCP_RESOURCE = "https://notes.example.com"
OTHER_MCP_RESOURCE = "https://tasks.example.com"

# RFC 9728 protected-resource metadata URLs. Every 401/403 names this in the
# WWW-Authenticate header so the client can rediscover the auth server.
MCP_RESOURCE_METADATA = f"{MCP_RESOURCE}/.well-known/oauth-protected-resource"
OTHER_MCP_RESOURCE_METADATA = f"{OTHER_MCP_RESOURCE}/.well-known/oauth-protected-resource"

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
            # CIMD is the recommended default in 2025-11-25; advertise it here
            # so a CIMD-capable client can skip DCR.
            "client_id_metadata_document_supported": True,
        }

    def register_client(self, body: dict) -> dict:
        """RFC 7591 dynamic client registration (the DCR fallback path)."""
        redirect_uris = body.get("redirect_uris", [])
        if not redirect_uris:
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
            "issued_at": time.time(),
        }
        return {
            "status": 201,
            "body": {
                "client_id": cid,
                "client_id_issued_at": int(time.time()),
                "redirect_uris": redirect_uris,
                "grant_types": body.get("grant_types", ["authorization_code"]),
                "registration_access_token": reg_token,
                "registration_client_uri": f"{self.issuer}/register/{cid}",
            },
        }

    def issue_token(self, client_id: str, user: str, scopes: set[str], resource: str) -> str:
        """Issue an audience-pinned access token signed by the current key."""
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
        return f"{self.resource}/.well-known/oauth-protected-resource"

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
    client_id: str | None = None

    def discover(self) -> dict:
        meta = self.auth_server.metadata()
        # Verify the IdP satisfies the MCP auth profile before trusting it.
        if "S256" not in meta["code_challenge_methods_supported"]:
            raise ValueError("authorization server does not advertise S256 PKCE")
        if not (meta.get("client_id_metadata_document_supported") or "registration_endpoint" in meta):
            raise ValueError("authorization server advertises no client enrollment path")
        return meta

    def register(self) -> str:
        resp = self.auth_server.register_client(
            {
                "redirect_uris": ["http://127.0.0.1:7333/callback"],
                "grant_types": ["authorization_code", "refresh_token"],
                "response_types": ["code"],
                "token_endpoint_auth_method": "none",
                "scope": "mcp:tools.invoke",
                "client_name": self.name,
            }
        )
        if resp["status"] != 201:
            raise ValueError(f"client registration failed: {resp}")
        self.client_id = resp["body"]["client_id"]
        return self.client_id

    def authorize(self, scopes: set[str], resource: str, user: str) -> str:
        # PKCE: the client proves possession of the verifier behind the challenge.
        verifier = secrets.token_urlsafe(32)
        _challenge = b64url(hashlib.sha256(verifier.encode()).digest())
        # The AS would validate the verifier against the stored challenge before
        # issuing; here it issues directly for the walk-through.
        return self.auth_server.issue_token(self.client_id, user, scopes, resource)


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
    client = Client(name="Cursor", auth_server=auth)
    meta = client.discover()
    print(f"  registration_endpoint={meta['registration_endpoint']}")
    print(f"  S256 PKCE supported, CIMD supported={meta['client_id_metadata_document_supported']}")

    print("\n--- step 3: client self-registers via DCR (RFC 7591) ---")
    cid = client.register()
    print(f"  client_id issued: {cid}")
    print("  (a CIMD client would instead present its own HTTPS client_id and skip this)")

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
    print("DONE - discovery, enrollment, audience binding, and JWKS refresh")
    print("=" * 72)


if __name__ == "__main__":
    demo()
