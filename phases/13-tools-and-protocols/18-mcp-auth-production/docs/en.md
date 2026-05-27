# MCP Auth in Production — DCR, JWKS Rotation, Audience-Pinned Tokens on iii Primitives

> Lesson 16 stood up the OAuth 2.1 state machine in memory. By 2026, every MCP server you ship to a real org sits behind production auth: dynamic client registration (RFC 7591), authorization-server metadata discovery (RFC 8414), JWKS rotation that does not break a 3 a.m. token validation, and audience-pinned tokens that refuse confused-deputy reuse. This lesson wires all of that through iii primitives — `iii.registerTrigger` for HTTP and cron, `iii.registerFunction` for auth logic, `state::set/get` for cached keys — so the auth surface is observable, restartable, and replayable like every other workload in the engine.

**Type:** Build
**Languages:** Python (stdlib, iii primitives mocked for the lesson environment)
**Prerequisites:** Phase 13 · 16 (OAuth 2.1 state machine), Phase 13 · 17 (gateways)
**Time:** ~90 minutes

## Learning Objectives

- Discover an authorization server through RFC 8414 metadata and verify the contract.
- Implement RFC 7591 dynamic client registration so MCP clients enroll without admin intervention.
- Cache and rotate JWKS keys using a cron trigger so signature verification survives key roll-over.
- Pin tokens to a single MCP resource using RFC 8707 resource indicators and refuse confused-deputy reuse.
- Wire every endpoint and background job as iii primitives — HTTP triggers, cron triggers, named functions, and `state::*` reads — so a single restart rebuilds the auth surface.
- Read an IdP capability matrix and refuse to deploy when the IdP cannot satisfy MCP's auth profile.

## The Problem

The Lesson 16 simulator runs OAuth 2.1 in memory. Production has three operational gaps that a memory-only simulator does not see.

The first gap is enrollment. A real org runs hundreds of MCP servers and thousands of MCP clients. Operators do not hand-register every Cursor user as an OAuth client. RFC 7591 dynamic client registration lets a client `POST /register` against the authorization server and receive a `client_id` (and optionally `client_secret`) on the spot. The server publishes `registration_endpoint` in its RFC 8414 metadata; the client discovers it without out-of-band configuration.

The second gap is key rotation. JWT validation depends on the authorization server's signing keys, published as a JSON Web Key Set (JWKS). The authorization server rotates these on a schedule (often hourly, sometimes faster under incident response). An MCP server that fetches JWKS once at boot validates fine until the rotation window — then every request fails until restart. Production wires JWKS as a cached value with a refresh job that overwrites the cache before the previous keys expire, plus a fall-back fetch on cache miss for the case where a token signed by a key newer than the cache arrives.

The third gap is audience binding. Lesson 16 introduced RFC 8707 resource indicators. In production, that indicator becomes a hard claim check on every request. The MCP server compares `token.aud` against its own canonical resource URL and rejects mismatches with HTTP 401. This is the only defense against an upstream MCP server (or a malicious client holding a token meant for one server) replaying that token against another server in the same trust mesh.

This lesson treats every one of those gaps as an iii primitive. The metadata document is an HTTP trigger that returns a function's output. JWKS rotation is a cron trigger that calls `auth::rotate-jwks`, which writes to `state::set("auth/jwks/<issuer>", ...)`. JWT validation is a function others call via `iii.trigger("auth::validate-jwt", token)`. The MCP server itself is just another HTTP trigger that calls into validation before dispatching. Restart the engine: the trigger registry rebuilds; state survives; the auth surface is operational without manual reconciliation.

## The Concept

### RFC 8414 — OAuth Authorization Server Metadata

A document at `/.well-known/oauth-authorization-server` describes everything a client needs:

```json
{
  "issuer": "https://auth.example.com",
  "authorization_endpoint": "https://auth.example.com/authorize",
  "token_endpoint": "https://auth.example.com/token",
  "jwks_uri": "https://auth.example.com/.well-known/jwks.json",
  "registration_endpoint": "https://auth.example.com/register",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "scopes_supported": ["mcp:tools.read", "mcp:tools.invoke"],
  "token_endpoint_auth_methods_supported": ["none", "private_key_jwt"]
}
```

A client given an MCP resource URL chains discovery: `oauth-protected-resource` from RFC 9728 (the resource server's document) names the issuer, then `oauth-authorization-server` (this RFC) names every endpoint. The client never hard-codes an authorization URL.

The contract you verify before trusting an IdP for MCP:

- `code_challenge_methods_supported` includes `S256` (PKCE per RFC 7636).
- `grant_types_supported` includes `authorization_code` and rejects `password` and `implicit`.
- `registration_endpoint` is present (RFC 7591 support).
- `response_types_supported` is exactly `["code"]` for OAuth 2.1.

If any of those is missing, the MCP server refuses to deploy against this IdP. The deployment manifest is wrong, not the code.

### RFC 9728 (recap) — Protected Resource Metadata

Lesson 16 covered RFC 9728. The delta in production: this document is the only place a client looks to find the authorization servers trusted by *this* MCP server. A single MCP server may accept tokens from multiple IdPs (one for staff, one for partners). RFC 9728 declares that set; RFC 8414 documents what each IdP supports.

```json
{
  "resource": "https://notes.example.com",
  "authorization_servers": ["https://auth.example.com", "https://partners.example.com"],
  "scopes_supported": ["mcp:tools.invoke"],
  "bearer_methods_supported": ["header"],
  "resource_documentation": "https://notes.example.com/docs"
}
```

### RFC 7591 — Dynamic Client Registration

Without DCR, every MCP client (Cursor, Claude Desktop, a custom agent) needs an out-of-band exchange with the IdP admin. With DCR, the client posts:

```json
POST /register
Content-Type: application/json

{
  "redirect_uris": ["http://127.0.0.1:7333/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none",
  "scope": "mcp:tools.invoke",
  "client_name": "Cursor",
  "software_id": "com.cursor.cursor",
  "software_version": "0.42.0"
}
```

The server responds with `client_id` and a `registration_access_token` for later updates:

```json
{
  "client_id": "c_3e7f1a",
  "client_id_issued_at": 1769472000,
  "redirect_uris": ["http://127.0.0.1:7333/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "registration_access_token": "regt_b2...",
  "registration_client_uri": "https://auth.example.com/register/c_3e7f1a"
}
```

`token_endpoint_auth_method: none` is the right default for MCP clients that run on the user's device. They get a `client_id` only — no `client_secret` to exfiltrate. PKCE provides the proof-of-possession that public clients need.

Three production pitfalls:

- The registration endpoint must rate-limit by source IP. Without that, a hostile actor scripts millions of fake registrations and exhausts the `client_id` namespace. iii makes this trivial: the registration HTTP trigger calls a `auth::rate-limit` function before dispatching to the registrar.
- `software_statement` (a signed JWT vouching for the client) is required by some enterprise IdPs. The lesson's mock skips it; production wires a verification step that rejects unsigned registrations from anything other than localhost redirect URIs.
- The `registration_access_token` must be stored as a hash, not plaintext. Theft of this token means the attacker can rewrite the client's redirect URIs.

### RFC 8707 (recap) — Resource Indicators

Lesson 16 established the shape. The production rule: every token request includes `resource=<canonical-mcp-url>`, and the MCP server verifies `token.aud` matches its own resource URL on every call. If the MCP server is reachable at `https://notes.example.com/mcp`, the canonical URL is `https://notes.example.com` — the path component is excluded so a single server hosts multiple paths under one audience.

### RFC 7636 (recap) — PKCE

PKCE is mandatory in OAuth 2.1. The lesson's authorization-code flow always carries `code_challenge` and `code_verifier`. The server rejects any token request without a verifier or with a verifier that does not hash to the stored challenge.

### MCP Spec 2025-11-25 Auth Profile

The MCP spec (2025-11-25) is precise about what an MCP server's authorization layer must do:

- Publish `/.well-known/oauth-protected-resource` (RFC 9728).
- Accept tokens only via `Authorization: Bearer ...`.
- Validate `aud`, `iss`, `exp`, and required scopes per request.
- Respond with `WWW-Authenticate` carrying `Bearer error=...` for every 401 and 403, including `scope=` and `resource=` parameters where applicable.
- Reject tokens whose `aud` does not match the canonical resource.
- Reject tokens whose `iss` is not in the protected-resource metadata's `authorization_servers` list.

The OAuth 2.1 draft is the substrate; RFC 8414/7591/8707/9728 + RFC 7636 are the surface; the MCP spec is the profile.

### IdP capability matrix

Not every IdP supports the full MCP profile. The matrix below documents factual capability statements as of the 2025-11-25 spec. It is a *deployment gate*, not a recommendation.

| IdP category | RFC 8414 metadata | RFC 7591 DCR | RFC 8707 resource | RFC 7636 S256 PKCE | Notes |
|---|---|---|---|---|---|
| Self-hosted (Keycloak) | yes | yes | yes (since 24.x) | yes | Reference IdP for the MCP profile in this lesson; supports every RFC end-to-end. |
| Enterprise SSO (Microsoft Entra ID) | yes | yes (premium tiers) | yes | yes | DCR availability differs by tenant tier; verify in target tenant before deploying. |
| Enterprise SSO (Okta) | yes | yes (Okta CIC / Auth0) | yes | yes | DCR available on Auth0 (now Okta CIC); classic Okta orgs require admin pre-registration. |
| Social login IdPs (generic) | varies | rarely | rarely | yes | Most social IdPs treat clients as static partners; do not rely on DCR. Use as identity source only, layer your own MCP-aware authorization server on top. |
| Custom / homegrown | depends | depends | depends | depends | If you ship your own, ship the full profile. Skipping any one of the four RFCs above breaks the MCP auth contract. |

Refusal rule for the deployment manifest: if the chosen IdP does not return `registration_endpoint` and does not list `S256` in `code_challenge_methods_supported`, the MCP server refuses to start. There is no degraded mode.

### JWKS rotation pattern with iii

The production failure mode is a stale JWKS cache. Solve it with a cron trigger and a `state::*` cache:

```python
iii.registerTrigger(
    "cron",
    {"schedule": "0 */6 * * *", "name": "auth::jwks-refresh"},
    "auth::rotate-jwks",
)
```

Every six hours, the cron trigger calls `auth::rotate-jwks`, which fetches `<issuer>/.well-known/jwks.json` and writes to `state::set("auth/jwks/<issuer>", {keys, fetched_at})`. The validator reads from `state::get`. A token whose `kid` is missing from the cache triggers a synchronous `auth::rotate-jwks` call as a fall-back. This handles two cases at once: scheduled rotation (cron) and key-overlap windows (synchronous fall-back).

The state shape:

```json
{
  "auth/jwks/https://auth.example.com": {
    "keys": [
      {"kid": "k_2026_03", "kty": "RSA", "n": "...", "e": "AQAB", "alg": "RS256", "use": "sig"},
      {"kid": "k_2026_04", "kty": "RSA", "n": "...", "e": "AQAB", "alg": "RS256", "use": "sig"}
    ],
    "fetched_at": 1772668800
  }
}
```

Two keys at once is the steady state. Authorization servers rotate by introducing the next key (`k_2026_04`) before retiring the previous (`k_2026_03`), so tokens issued under the old key remain valid until they expire. The cache holds the union; the validator picks by `kid`.

### iii primitive wiring (the part this lesson is actually about)

Five primitives compose the auth surface:

```python
# 1. RFC 8414 metadata document
iii.registerTrigger(
    "http",
    {"path": "/.well-known/oauth-authorization-server", "method": "GET"},
    "auth::serve-asm",
)

# 2. RFC 7591 dynamic client registration
iii.registerTrigger(
    "http",
    {"path": "/register", "method": "POST"},
    "auth::register-client",
)

# 3. JWT validation as a callable function (the resource server triggers it)
iii.registerFunction("auth::validate-jwt", validate_jwt_handler)

# 4. Step-up issuance for incremental scope (SEP-835 from L16)
iii.registerFunction("auth::issue-step-up", issue_step_up_handler)

# 5. Cron-driven JWKS rotation
iii.registerTrigger(
    "cron",
    {"schedule": "0 */6 * * *"},
    "auth::rotate-jwks",
)
iii.registerFunction("auth::rotate-jwks", rotate_jwks_handler)
```

The MCP server itself never calls validation directly. It does:

```python
result = iii.trigger("auth::validate-jwt", {"token": bearer_token, "resource": self.resource})
if not result["valid"]:
    return {"status": 401, "WWW-Authenticate": result["www_authenticate"]}
```

This indirection is the iii bet. Tomorrow you swap the validator for a fanout that consults two IdPs in parallel, or you add a span emitter, or you cache positive validations. The MCP server does not change.

### Confused-deputy walkthrough with audience binding

Server A (`notes.example.com`) and Server B (`tasks.example.com`) both register against the same authorization server. Server A is compromised. The attacker takes a user's notes token and replays it against Server B.

Server B's validator:

1. Decode JWT, fetch JWKS by `kid`, verify signature.
2. Check `iss` against its protected-resource metadata's `authorization_servers`. (Pass — same IdP.)
3. Check `aud == "https://tasks.example.com"`. (Fail — token's `aud` is `https://notes.example.com`.)
4. Return 401 with `WWW-Authenticate: Bearer error="invalid_token", error_description="audience mismatch"`.

The audience claim is the only defense against this attack at the protocol layer. Skipping it for performance is the most common production mistake; the validator must run on every request, not just at session start.

### Failure modes

- **Stale JWKS.** The validator rejects valid tokens after key rotation. The fix is the cron+fall-back pattern above. Never cache JWKS without a refresh job.
- **Missing `aud` claim.** Some IdPs default to omitting `aud` unless `resource` is present in the token request. The validator must reject tokens with missing `aud`, not treat absence as wildcard.
- **Scope upgrade race.** Two concurrent step-up flows for the same user can both succeed and produce two access tokens with different scopes. The validator must use the token presented on the request, not look up "the user's current scope" — that creates a TOCTOU window.
- **Registration token theft.** A leaked `registration_access_token` lets the attacker rewrite redirect URIs. Hash these at rest; require the client to present the cleartext on every update; rotate on suspicion.
- **`iss` not pinned.** A validator that accepts any `iss` lets an attacker stand up their own authorization server, register a client for the target audience, and issue tokens. The protected-resource metadata's `authorization_servers` list is the allow-list; enforce it.

## Use It

`code/main.py` walks the full production flow with stdlib Python and a small `iii_mock` registry that mimics `iii.registerFunction`, `iii.registerTrigger`, `iii.trigger`, and `state::set/get`. The flow:

1. Authorization server publishes RFC 8414 metadata at `/.well-known/oauth-authorization-server`.
2. MCP client calls the metadata endpoint, discovers the registration endpoint.
3. MCP client posts to `/register` (RFC 7591) and receives a `client_id`.
4. MCP client runs PKCE-protected authorization code flow (RFC 7636) with `resource` indicator (RFC 8707).
5. MCP client calls a tool on the MCP server with `Authorization: Bearer ...`.
6. MCP server triggers `auth::validate-jwt`, which reads JWKS from `state::get`.
7. The cron trigger fires `auth::rotate-jwks`, replacing the JWKS in state.
8. The next call validates against the new keys without restart.
9. A confused-deputy attempt against a different MCP resource gets 401 with audience mismatch.

The mock JWT here uses HS256 with a shared secret (so the lesson runs on stdlib only). Production uses RS256 or EdDSA with the JWKS pattern above; the validation logic is otherwise identical.

## Ship It

This lesson produces `outputs/skill-mcp-auth-iii.md`. Given an MCP server config and an IdP capability set, the skill emits the iii primitives to register, the JWKS rotation schedule, the scope mapping, and the refusal rules to apply when the IdP does not support the full RFC profile.

## Exercises

1. Run `code/main.py`. Trace the 9-step flow. Note where `state::get` returns stale data immediately before `auth::rotate-jwks` overwrites it, and how the next request now validates against the new key.

2. Add a new IdP to the protected-resource metadata's `authorization_servers` list. Issue a token signed by the new IdP and confirm the validator accepts it. Issue a token signed by an unlisted IdP and confirm the validator rejects with `WWW-Authenticate: Bearer error="invalid_token", error_description="iss not allowed"`.

3. Implement `auth::rate-limit` as an iii function and call it from inside the registration HTTP trigger before the registrar runs. Use a token-bucket per source IP held in `state::set("auth/ratelimit/<ip>", ...)`.

4. Read RFC 7591 and identify two fields the lesson's `/register` handler does not validate. Add the validation. (Hint: `software_statement` and `redirect_uris` URI scheme.)

5. Read the MCP spec 2025-11-25 authorization section. Find the one normative requirement on `WWW-Authenticate` headers that the lesson's validator does not currently emit. Add it.

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| ASM | "OAuth metadata document" | RFC 8414 `/.well-known/oauth-authorization-server` JSON |
| DCR | "Self-service client registration" | RFC 7591 `POST /register` flow |
| JWKS | "Public keys for JWT validation" | JSON Web Key Set, fetched from `jwks_uri`, indexed by `kid` |
| Resource indicator | "Audience parameter" | RFC 8707 `resource` parameter pinning the token to one server |
| `aud` claim | "Audience" | JWT claim the validator compares against the canonical resource URL |
| Confused deputy | "Token replay" | Attack where a token issued for Server A is presented to Server B |
| `iss` allow-list | "Trusted authorization servers" | The set named in protected-resource metadata's `authorization_servers` |
| Key rotation | "Rolling JWKS" | Periodic replacement of signing keys with overlap windows |
| Public client | "Native or browser client" | OAuth client with no `client_secret`; PKCE compensates |
| `WWW-Authenticate` | "401/403 response header" | Carries `Bearer error=...` directives that drive client recovery |

## Further Reading

- [MCP — Authorization spec (2025-11-25)](https://modelcontextprotocol.io/specification/draft/basic/authorization) — the MCP auth profile this lesson implements
- [RFC 8414 — OAuth 2.0 Authorization Server Metadata](https://datatracker.ietf.org/doc/html/rfc8414) — discovery contract
- [RFC 7591 — OAuth 2.0 Dynamic Client Registration Protocol](https://datatracker.ietf.org/doc/html/rfc7591) — DCR
- [RFC 7636 — Proof Key for Code Exchange (PKCE)](https://datatracker.ietf.org/doc/html/rfc7636) — public-client proof-of-possession
- [RFC 8707 — Resource Indicators for OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc8707) — audience pinning
- [RFC 9728 — OAuth 2.0 Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728) — resource server discovery
- [OAuth 2.1 draft](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1) — the consolidated OAuth substrate
