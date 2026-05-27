"""Phase 13 Lesson 16 - OAuth 2.1 + PKCE + step-up state machine (SEP-835).

In-memory state machine that walks through:
  1. Authorization code flow with PKCE
  2. Token with resource indicator (RFC 8707)
  3. Audience validation on the resource server
  4. 403 insufficient_scope triggering step-up flow

Stdlib only.

Run: python code/main.py
"""

from __future__ import annotations

import base64
import hashlib
import secrets
import time
from dataclasses import dataclass, field


AUTH_SERVER = "https://auth.example.com"
NOTES_SERVER = "https://notes.example.com"


@dataclass
class Token:
    value: str
    client_id: str
    user_id: str
    scopes: set[str]
    resource: str
    expires_at: float


@dataclass
class AuthorizationServer:
    name: str = AUTH_SERVER
    pending_codes: dict = field(default_factory=dict)
    tokens: dict = field(default_factory=dict)

    def authorize(self, client_id: str, user_id: str, scopes: set[str],
                  code_challenge: str, resource: str) -> str:
        code = f"code_{secrets.token_hex(8)}"
        self.pending_codes[code] = {
            "client_id": client_id, "user_id": user_id, "scopes": scopes,
            "code_challenge": code_challenge, "resource": resource,
            "expires_at": time.time() + 600,
        }
        return code

    def exchange(self, code: str, code_verifier: str, resource: str) -> Token | None:
        rec = self.pending_codes.pop(code, None)
        if not rec:
            return None
        if rec["resource"] != resource:
            print("    AS: resource mismatch - reject")
            return None
        h = hashlib.sha256(code_verifier.encode()).digest()
        challenge_expected = base64.urlsafe_b64encode(h).rstrip(b"=").decode()
        if challenge_expected != rec["code_challenge"]:
            print("    AS: PKCE mismatch - reject")
            return None
        tok = Token(value=f"tok_{secrets.token_hex(12)}", client_id=rec["client_id"],
                    user_id=rec["user_id"], scopes=rec["scopes"],
                    resource=resource, expires_at=time.time() + 3600)
        self.tokens[tok.value] = tok
        return tok


@dataclass
class ResourceServer:
    resource_url: str = NOTES_SERVER
    scope_requirements: dict = field(default_factory=lambda: {
        "list": "notes:read", "read": "notes:read",
        "create": "notes:write", "delete": "notes:delete",
    })

    def call(self, tool: str, token: Token) -> dict:
        if token is None:
            return {"status": 401, "error": "no token"}
        if token.expires_at < time.time():
            return {"status": 401, "error": "token expired"}
        if token.resource != self.resource_url:
            return {"status": 401, "error": "aud mismatch", "seen": token.resource}
        required = self.scope_requirements.get(tool)
        if required and required not in token.scopes:
            return {
                "status": 403,
                "error": "insufficient_scope",
                "www_authenticate": f'Bearer error="insufficient_scope", '
                                    f'scope="{required}", resource="{self.resource_url}"',
            }
        return {"status": 200, "content": f"{tool} ok as {token.user_id}"}


def pkce_pair() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(32)
    challenge = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    return verifier, challenge


class Client:
    def __init__(self, client_id: str, user_id: str) -> None:
        self.client_id = client_id
        self.user_id = user_id
        self.tokens: dict[str, Token] = {}

    def oauth_flow(self, auth_server: AuthorizationServer, scopes: set[str],
                   resource: str) -> Token:
        print(f"  CLIENT: request scopes={scopes} resource={resource}")
        verifier, challenge = pkce_pair()
        code = auth_server.authorize(self.client_id, self.user_id, scopes,
                                     challenge, resource)
        print(f"    AS   : issued authorization code, challenge stored")
        tok = auth_server.exchange(code, verifier, resource)
        if tok is None:
            raise RuntimeError("token exchange failed")
        self.tokens[resource] = tok
        print(f"    AS   : issued access token aud={tok.resource} scopes={tok.scopes}")
        return tok

    def call_with_step_up(self, tool: str, resource_server: ResourceServer,
                          auth_server: AuthorizationServer) -> dict:
        tok = self.tokens.get(resource_server.resource_url)
        if tok is None:
            tok = self.oauth_flow(auth_server, scopes={"notes:read"},
                                  resource=resource_server.resource_url)
        while True:
            resp = resource_server.call(tool, tok)
            if resp["status"] != 403:
                return resp
            print(f"  RS   : 403 insufficient_scope ({resp['www_authenticate']!r})")
            required = resp["www_authenticate"].split('scope="')[1].split('"')[0]
            print(f"  CLIENT: step-up required for {required}")
            new_scopes = tok.scopes | {required}
            tok = self.oauth_flow(auth_server, scopes=new_scopes,
                                  resource=resource_server.resource_url)


def demo() -> None:
    print("=" * 72)
    print("PHASE 13 LESSON 16 - OAUTH 2.1 + PKCE + STEP-UP (SEP-835)")
    print("=" * 72)

    auth = AuthorizationServer()
    rs = ResourceServer()
    client = Client(client_id="claude-desktop", user_id="alice")

    print("\n--- step 1: user asks to list notes (needs notes:read) ---")
    resp = client.call_with_step_up("list", rs, auth)
    print(f"  RS   : {resp}")

    print("\n--- step 2: user asks to create a note (needs notes:write) ---")
    resp = client.call_with_step_up("create", rs, auth)
    print(f"  RS   : {resp}")

    print("\n--- step 3: user asks to delete a note (needs notes:delete) ---")
    resp = client.call_with_step_up("delete", rs, auth)
    print(f"  RS   : {resp}")

    print("\n--- confused deputy attempt: present this token to a different server ---")
    other_server = ResourceServer(resource_url="https://github.example.com",
                                  scope_requirements={"list": "notes:read"})
    resp = other_server.call("list", client.tokens[NOTES_SERVER])
    print(f"  other RS : {resp}  (audience mismatch blocks the reuse)")


if __name__ == "__main__":
    demo()
