"""Phase 13 Lesson 18 - MCP auth in production on iii primitives.

A stdlib walk-through of the production MCP auth surface:

  - RFC 8414 authorization server metadata on an HTTP trigger
  - RFC 7591 dynamic client registration on an HTTP trigger
  - PKCE (RFC 7636) authorization code flow with audience pinning (RFC 8707)
  - JWT validation as a registered iii function
  - JWKS rotation on a cron trigger, cached via state::set / state::get
  - Confused-deputy rejection via aud claim

iii primitives are mocked in the iii_mock module below: a dict-backed registry
of functions, a list of triggers, a dict of state, and a synchronous dispatcher
that mimics iii.trigger. Real iii ships an async websocket runtime; the API
shape is identical.

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
from typing import Any, Callable


# ---------------------------------------------------------------------------
# iii_mock - dict-backed mock of the iii primitives this lesson uses
# ---------------------------------------------------------------------------


class IIIMock:
    """In-process mock of the iii runtime.

    Real iii (see iii-sdk) gives the same shape over a websocket:
        await iii.register_function("auth::validate-jwt", handler)
        await iii.register_trigger("http", {"path": "/register"}, "auth::register-client")
        await iii.trigger("auth::validate-jwt", {"token": ...})
        await iii.state.set("auth/jwks/<iss>", {...})
    """

    def __init__(self) -> None:
        self.functions: dict[str, Callable[[dict], dict]] = {}
        self.triggers: list[dict] = []
        self.state: dict[str, Any] = {}

    def registerFunction(self, name: str, handler: Callable[[dict], dict]) -> None:
        self.functions[name] = handler
        print(f"  iii.registerFunction({name!r})")

    def registerTrigger(self, kind: str, config: dict, function_name: str) -> None:
        self.triggers.append({"kind": kind, "config": config, "fn": function_name})
        print(f"  iii.registerTrigger({kind!r}, {config!r}, fn={function_name!r})")

    def trigger(self, name: str, payload: dict) -> dict:
        if name not in self.functions:
            raise RuntimeError(f"unknown iii function: {name}")
        return self.functions[name](payload)

    def state_set(self, key: str, value: Any) -> None:
        self.state[key] = value

    def state_get(self, key: str, default: Any = None) -> Any:
        return self.state.get(key, default)

    def fire_http(self, path: str, method: str, body: dict | None = None) -> dict:
        for tr in self.triggers:
            if tr["kind"] != "http":
                continue
            if tr["config"]["path"] == path and tr["config"]["method"] == method:
                return self.trigger(tr["fn"], {"body": body or {}, "path": path, "method": method})
        return {"status": 404}

    def fire_cron(self, schedule: str) -> list[dict]:
        results = []
        for tr in self.triggers:
            if tr["kind"] == "cron" and tr["config"]["schedule"] == schedule:
                results.append(self.trigger(tr["fn"], {"schedule": schedule}))
        return results


iii = IIIMock()


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


# ---------------------------------------------------------------------------
# Mock authorization server state - lives outside the iii functions so the
# rotation cron has something to fetch from. Production keeps this in the IdP.
# ---------------------------------------------------------------------------


@dataclass
class IdPKey:
    kid: str
    secret: bytes
    issued_at: float


@dataclass
class MockIdP:
    issuer: str = "https://auth.example.com"
    keys: list[IdPKey] = field(default_factory=list)
    clients: dict[str, dict] = field(default_factory=dict)
    pending_codes: dict[str, dict] = field(default_factory=dict)

    def current_key(self) -> IdPKey:
        return self.keys[-1]

    def rotate_key(self) -> IdPKey:
        new_kid = f"k_{int(time.time())}_{secrets.token_hex(2)}"
        new = IdPKey(kid=new_kid, secret=secrets.token_bytes(32), issued_at=time.time())
        self.keys.append(new)
        if len(self.keys) > 2:
            self.keys = self.keys[-2:]
        return new

    def jwks(self) -> dict:
        return {
            "keys": [
                {
                    "kid": k.kid,
                    "kty": "oct",
                    "alg": "HS256",
                    "use": "sig",
                    "k": b64url(k.secret),
                }
                for k in self.keys
            ]
        }


idp = MockIdP()
idp.rotate_key()

MCP_RESOURCE = "https://notes.example.com"
OTHER_MCP_RESOURCE = "https://tasks.example.com"


# ---------------------------------------------------------------------------
# iii functions - one per concern, all named auth::*
# ---------------------------------------------------------------------------


def serve_asm(_: dict) -> dict:
    return {
        "status": 200,
        "body": {
            "issuer": idp.issuer,
            "authorization_endpoint": f"{idp.issuer}/authorize",
            "token_endpoint": f"{idp.issuer}/token",
            "jwks_uri": f"{idp.issuer}/.well-known/jwks.json",
            "registration_endpoint": f"{idp.issuer}/register",
            "response_types_supported": ["code"],
            "grant_types_supported": ["authorization_code", "refresh_token"],
            "code_challenge_methods_supported": ["S256"],
            "scopes_supported": ["mcp:tools.read", "mcp:tools.invoke"],
            "token_endpoint_auth_methods_supported": ["none", "private_key_jwt"],
        },
    }


def register_client(payload: dict) -> dict:
    body = payload["body"]
    redirect_uris = body.get("redirect_uris", [])
    if not redirect_uris:
        return {"status": 400, "body": {"error": "invalid_redirect_uri"}}
    if body.get("token_endpoint_auth_method") not in {"none", "private_key_jwt"}:
        return {"status": 400, "body": {"error": "invalid_client_metadata"}}
    cid = f"c_{secrets.token_hex(4)}"
    reg_token = secrets.token_urlsafe(24)
    idp.clients[cid] = {
        "redirect_uris": redirect_uris,
        "grant_types": body.get("grant_types", ["authorization_code"]),
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
            "registration_client_uri": f"{idp.issuer}/register/{cid}",
        },
    }


def rotate_jwks(_: dict) -> dict:
    new_key = idp.rotate_key()
    iii.state_set(
        f"auth/jwks/{idp.issuer}",
        {"keys": idp.jwks()["keys"], "fetched_at": time.time()},
    )
    return {"rotated": True, "new_kid": new_key.kid, "key_count": len(idp.keys)}


def validate_jwt(payload: dict) -> dict:
    token = payload["token"]
    expected_resource = payload["resource"]
    allowed_issuers = payload.get("allowed_issuers", [idp.issuer])

    try:
        header, claims, _ = jwt_decode(token)
    except Exception:
        return {
            "valid": False,
            "status": 401,
            "www_authenticate": 'Bearer error="invalid_token", error_description="malformed"',
        }

    cache = iii.state_get(f"auth/jwks/{claims.get('iss', '')}")
    if cache is None:
        iii.trigger("auth::rotate-jwks", {})
        cache = iii.state_get(f"auth/jwks/{claims.get('iss', '')}")

    matching = next((k for k in cache["keys"] if k["kid"] == header.get("kid")), None) if cache else None
    if matching is None:
        iii.trigger("auth::rotate-jwks", {})
        cache = iii.state_get(f"auth/jwks/{claims.get('iss', '')}")
        matching = next((k for k in cache["keys"] if k["kid"] == header.get("kid")), None) if cache else None
    if matching is None:
        return {
            "valid": False,
            "status": 401,
            "www_authenticate": 'Bearer error="invalid_token", error_description="unknown kid"',
        }

    if not jwt_verify(token, b64url_decode(matching["k"])):
        return {
            "valid": False,
            "status": 401,
            "www_authenticate": 'Bearer error="invalid_token", error_description="bad signature"',
        }

    if claims.get("iss") not in allowed_issuers:
        return {
            "valid": False,
            "status": 401,
            "www_authenticate": 'Bearer error="invalid_token", error_description="iss not allowed"',
        }
    if claims.get("aud") != expected_resource:
        return {
            "valid": False,
            "status": 401,
            "www_authenticate": (
                f'Bearer error="invalid_token", error_description="audience mismatch", '
                f'resource="{expected_resource}"'
            ),
        }
    if claims.get("exp", 0) < time.time():
        return {
            "valid": False,
            "status": 401,
            "www_authenticate": 'Bearer error="invalid_token", error_description="expired"',
        }
    required = payload.get("required_scope")
    if required and required not in set(claims.get("scope", "").split()):
        return {
            "valid": False,
            "status": 403,
            "www_authenticate": (
                f'Bearer error="insufficient_scope", scope="{required}", '
                f'resource="{expected_resource}"'
            ),
        }
    return {"valid": True, "claims": claims}


def issue_step_up(payload: dict) -> dict:
    """Issue a new token with an enlarged scope set. Used after 403 insufficient_scope."""
    user = payload["user"]
    client_id = payload["client_id"]
    new_scopes = payload["scopes"]
    resource = payload["resource"]
    key = idp.current_key()
    claims = {
        "iss": idp.issuer,
        "sub": user,
        "aud": resource,
        "azp": client_id,
        "scope": " ".join(sorted(new_scopes)),
        "iat": int(time.time()),
        "exp": int(time.time()) + 3600,
    }
    return {"token": jwt_sign(claims, kid=key.kid, secret=key.secret), "claims": claims}


# ---------------------------------------------------------------------------
# Registration of every iii primitive this lesson uses
# ---------------------------------------------------------------------------


def install_auth_surface() -> None:
    print("[install] registering iii primitives:")
    iii.registerTrigger(
        "http",
        {"path": "/.well-known/oauth-authorization-server", "method": "GET"},
        "auth::serve-asm",
    )
    iii.registerTrigger("http", {"path": "/register", "method": "POST"}, "auth::register-client")
    iii.registerTrigger("cron", {"schedule": "0 */6 * * *"}, "auth::rotate-jwks")
    iii.registerFunction("auth::serve-asm", serve_asm)
    iii.registerFunction("auth::register-client", register_client)
    iii.registerFunction("auth::rotate-jwks", rotate_jwks)
    iii.registerFunction("auth::validate-jwt", validate_jwt)
    iii.registerFunction("auth::issue-step-up", issue_step_up)
    iii.trigger("auth::rotate-jwks", {})


# ---------------------------------------------------------------------------
# Mock MCP client - PKCE + DCR + audience-pinned token request
# ---------------------------------------------------------------------------


class MockMCPClient:
    def __init__(self, name: str) -> None:
        self.name = name
        self.client_id: str | None = None
        self.tokens: dict[str, str] = {}

    def discover(self) -> dict:
        resp = iii.fire_http("/.well-known/oauth-authorization-server", "GET")
        assert resp["status"] == 200
        meta = resp["body"]
        for required in ("registration_endpoint", "code_challenge_methods_supported"):
            assert required in meta, f"ASM missing {required}"
        assert "S256" in meta["code_challenge_methods_supported"]
        return meta

    def register(self, asm: dict) -> str:
        resp = iii.fire_http(
            "/register",
            "POST",
            {
                "redirect_uris": ["http://127.0.0.1:7333/callback"],
                "grant_types": ["authorization_code", "refresh_token"],
                "response_types": ["code"],
                "token_endpoint_auth_method": "none",
                "scope": "mcp:tools.invoke",
                "client_name": self.name,
            },
        )
        assert resp["status"] == 201
        self.client_id = resp["body"]["client_id"]
        return self.client_id

    def authorize(self, scopes: set[str], resource: str, user: str) -> str:
        verifier = secrets.token_urlsafe(32)
        challenge = b64url(hashlib.sha256(verifier.encode()).digest())
        key = idp.current_key()
        claims = {
            "iss": idp.issuer,
            "sub": user,
            "aud": resource,
            "azp": self.client_id,
            "scope": " ".join(sorted(scopes)),
            "iat": int(time.time()),
            "exp": int(time.time()) + 3600,
            "cnf": {"x5t#S256": challenge[:16]},
        }
        token = jwt_sign(claims, kid=key.kid, secret=key.secret)
        self.tokens[resource] = token
        return token


# ---------------------------------------------------------------------------
# Mock MCP server - calls auth::validate-jwt via iii.trigger on every request
# ---------------------------------------------------------------------------


class MockMCPServer:
    def __init__(self, resource: str, allowed_issuers: list[str]) -> None:
        self.resource = resource
        self.allowed_issuers = allowed_issuers

    def call_tool(self, tool: str, bearer: str) -> dict:
        scope_required = "mcp:tools.invoke"
        result = iii.trigger(
            "auth::validate-jwt",
            {
                "token": bearer,
                "resource": self.resource,
                "allowed_issuers": self.allowed_issuers,
                "required_scope": scope_required,
            },
        )
        if not result["valid"]:
            return {"status": result["status"], "WWW-Authenticate": result["www_authenticate"]}
        return {
            "status": 200,
            "body": {"tool": tool, "user": result["claims"]["sub"], "ok": True},
        }


# ---------------------------------------------------------------------------
# Demo - the 9-step production flow
# ---------------------------------------------------------------------------


def demo() -> None:
    print("=" * 72)
    print("PHASE 13 LESSON 18 - MCP AUTH IN PRODUCTION ON iii PRIMITIVES")
    print("=" * 72)

    print("\n--- step 1: install auth surface (registers HTTP + cron triggers) ---")
    install_auth_surface()

    print("\n--- step 2: client discovers the authorization server (RFC 8414) ---")
    client = MockMCPClient(name="Cursor")
    asm = client.discover()
    print(f"  client got registration_endpoint={asm['registration_endpoint']}")
    print(f"  client confirmed S256 PKCE supported")

    print("\n--- step 3: client self-registers via DCR (RFC 7591) ---")
    cid = client.register(asm)
    print(f"  client_id issued: {cid}")

    print("\n--- step 4: client runs PKCE authorization flow with resource indicator ---")
    bearer = client.authorize(
        scopes={"mcp:tools.invoke"}, resource=MCP_RESOURCE, user="alice@example.com"
    )
    print(f"  bearer issued (kid={idp.current_key().kid}, aud={MCP_RESOURCE})")

    print("\n--- step 5: client calls MCP tool, server validates via iii.trigger ---")
    server = MockMCPServer(resource=MCP_RESOURCE, allowed_issuers=[idp.issuer])
    resp = server.call_tool("notes.list", bearer)
    print(f"  server response: {resp}")
    assert resp["status"] == 200

    print("\n--- step 6: cron fires auth::rotate-jwks (every 6h schedule) ---")
    pre_rotation_keys = [k["kid"] for k in iii.state_get(f"auth/jwks/{idp.issuer}")["keys"]]
    print(f"  state::get keys before rotation: {pre_rotation_keys}")
    iii.fire_cron("0 */6 * * *")
    post_rotation_keys = [k["kid"] for k in iii.state_get(f"auth/jwks/{idp.issuer}")["keys"]]
    print(f"  state::get keys after rotation:  {post_rotation_keys}")

    print("\n--- step 7: existing token still validates (overlap window) ---")
    resp = server.call_tool("notes.list", bearer)
    print(f"  server response: {resp}")
    assert resp["status"] == 200

    print("\n--- step 8: new token signed with new key validates against rotated JWKS ---")
    fresh_bearer = client.authorize(
        scopes={"mcp:tools.invoke"}, resource=MCP_RESOURCE, user="alice@example.com"
    )
    fresh_header, _, _ = jwt_decode(fresh_bearer)
    print(f"  fresh token kid: {fresh_header['kid']}")
    resp = server.call_tool("notes.read", fresh_bearer)
    print(f"  server response: {resp}")
    assert resp["status"] == 200

    print("\n--- step 9: confused-deputy attempt against a different MCP resource ---")
    other_server = MockMCPServer(resource=OTHER_MCP_RESOURCE, allowed_issuers=[idp.issuer])
    resp = other_server.call_tool("tasks.list", bearer)
    print(f"  other server response: {resp}")
    assert resp["status"] == 401
    assert "audience mismatch" in resp["WWW-Authenticate"]

    print("\n--- bonus: step-up flow for a higher-privilege scope ---")
    elevated = iii.trigger(
        "auth::issue-step-up",
        {
            "user": "alice@example.com",
            "client_id": cid,
            "scopes": {"mcp:tools.invoke", "mcp:tools.delete"},
            "resource": MCP_RESOURCE,
        },
    )
    elevated_resp = server.call_tool("notes.delete", elevated["token"])
    print(f"  elevated token scopes: {elevated['claims']['scope']}")
    print(f"  server response: {elevated_resp}")

    print("\n" + "=" * 72)
    print("DONE - every endpoint, function, and rotation job is an iii primitive")
    print("=" * 72)


if __name__ == "__main__":
    demo()
