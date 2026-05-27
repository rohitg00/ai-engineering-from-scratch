# MCP Security II — OAuth 2.1, Resource Indicators, Incremental Scopes

> Remote MCP servers need authorization, not just authentication. The 2025-11-25 spec aligns with OAuth 2.1 + PKCE + resource indicators (RFC 8707) + protected-resource metadata (RFC 9728). SEP-835 adds incremental scope consent with step-up authorization on 403 WWW-Authenticate. This lesson implements the step-up flow as a state machine so you can see every hop.

**Type:** Build
**Languages:** Python (stdlib, OAuth state machine simulator)
**Prerequisites:** Phase 13 · 09 (transports), Phase 13 · 15 (security I)
**Time:** ~75 minutes

## Learning Objectives

- Distinguish resource server from authorization server responsibilities.
- Walk the PKCE-protected OAuth 2.1 authorization code flow.
- Use `resource` (RFC 8707) and protected-resource metadata (RFC 9728) to prevent confused-deputy attacks.
- Implement step-up authorization: server responds 403 with WWW-Authenticate asking for a higher scope; client re-prompts user consent and retries.

## The Problem

Early MCP (pre-2025) shipped remote servers with ad-hoc API keys or even no auth. The 2025-11-25 spec closes that gap with a full OAuth 2.1 profile.

Three real-world needs:

- **Ordinary remote servers.** User installs a remote MCP server that accesses their Notion / GitHub / Gmail. OAuth 2.1 with PKCE is the right shape.
- **Scope escalation.** A notes server granted `notes:read` can later need `notes:write` for a specific action. Instead of re-doing the whole flow, step-up (SEP-835) asks for the additional scope.
- **Confused deputy prevention.** Client holds a token audience-scoped for Server A. Server A is malicious and tries to present the token to Server B. Resource indicators (RFC 8707) pin the token to its intended audience.

OAuth 2.1 is not new. What is new is MCP's profile: specific required flows (authorization code + PKCE only; no implicit, no client credentials by default), resource indicators mandatory on every token request, and protected-resource metadata published so clients know where to go.

## The Concept

### Roles

- **Client.** The MCP client (Claude Desktop, Cursor, etc.).
- **Resource server.** The MCP server (notes, GitHub, Postgres, whatever).
- **Authorization server.** Issues tokens. May be the same service as the resource server or a separate IdP (Auth0, Keycloak, Cognito).

In MCP's profile, resource and authorization servers CAN be the same host but SHOULD be distinguished by URLs.

### Authorization code + PKCE

The flow:

1. Client generates `code_verifier` (random) and `code_challenge` (SHA256).
2. Client redirects user to `/authorize?response_type=code&client_id=...&redirect_uri=...&scope=notes:read&code_challenge=...&resource=https://notes.example.com`.
3. User consents. Authorization server redirects to `redirect_uri?code=...`.
4. Client POSTs to `/token?grant_type=authorization_code&code=...&code_verifier=...&resource=...`.
5. Authorization server validates the verifier's hash against the stored challenge and issues an access token.
6. Client uses the token: `Authorization: Bearer ...` on every request to the resource server.

PKCE prevents authorization-code interception attacks. Resource indicators prevent the token from being valid elsewhere.

### Protected-resource metadata (RFC 9728)

The resource server publishes a `.well-known/oauth-protected-resource` document:

```json
{
  "resource": "https://notes.example.com",
  "authorization_servers": ["https://auth.example.com"],
  "scopes_supported": ["notes:read", "notes:write", "notes:delete"]
}
```

Client discovers the authorization server from the resource server. Reduces configuration — the client only needs the resource URL.

### Resource indicators (RFC 8707)

`resource` parameter in the token request pins the token's intended audience. The issued token contains `aud: "https://notes.example.com"`. Another MCP server receiving this token checks `aud` and rejects it.

### Scope model

Scopes are space-separated strings. Common MCP conventions:

- `notes:read`, `notes:write`, `notes:delete`
- `admin:*` for admin capabilities (use sparingly)
- `profile:read` for identity

Scope selection should be least-privilege: request what you need now, step up when you need more.

### Step-up authorization (SEP-835)

User grants `notes:read`. They later ask the agent to delete a note. The server responds:

```
HTTP/1.1 403 Forbidden
WWW-Authenticate: Bearer error="insufficient_scope",
    scope="notes:delete", resource="https://notes.example.com"
```

Client sees the insufficient_scope error, prompts the user with a consent dialog for the additional scope, performs a mini OAuth flow for it, retries the request with the new token.

### Token audience validation

Every request: server checks `token.aud == self.resource_url`. Mismatch = 401. This stops cross-server token reuse.

### Short-lived tokens and rotation

Access tokens SHOULD be short-lived (1 hour default). Refresh tokens rotate on every refresh. The client handles silent refresh in the background.

### No token passthrough

Sampling servers (Phase 13 · 11) MUST NOT pass the client's token through to other services. The sampling request is the boundary.

### Confused deputy prevention

Token binds to `aud`. Client binds to `client_id`. Every request validated against both. The spec explicitly bans the old "pass-the-token" pattern that was common in pre-MCP remote tool ecosystems.

### Client ID discovery

Each MCP client publishes its metadata at a fixed URL. Authorization servers can fetch the client's metadata document to discover redirect URIs and contact info. This removes manual client registration.

### Gateways and OAuth

Phase 13 · 17 shows how an enterprise gateway handles OAuth: gateway holds credentials for upstream servers, tokens to the client are gateway-issued, and upstream tokens never leave the gateway. This flips the trust model — users authenticate with the gateway once; gateway handles N server authorizations.

## Use It

`code/main.py` simulates the full OAuth 2.1 step-up flow as a state machine. It implements:

- PKCE code-verifier / challenge generation.
- Authorization code flow with resource indicator.
- Protected-resource metadata endpoint.
- Token validation with audience check.
- Step-up on `insufficient_scope`.

No HTTP server in this lesson; the state machine runs in memory so you can trace every hop. Phase 13 · 17's gateway lesson wires it to an actual transport.

## Ship It

This lesson produces `outputs/skill-oauth-scope-planner.md`. Given a remote MCP server with tools, the skill designs the scope set, pinning rules, and step-up policy.

## Exercises

1. Run `code/main.py`. Trace the two-scope step-up flow. Note which hops repeat on step-up.

2. Add refresh-token rotation: every refresh issues a new refresh token and invalidates the old one. Simulate a stolen refresh token being used after rotation and confirm it fails.

3. Implement the protected-resource metadata endpoint as a real HTTP response using stdlib http.server. Mirror the /mcp endpoint from Lesson 09.

4. Design a scope hierarchy for a GitHub MCP server: read repo, write PR, approve PR, merge PR, admin. Use step-up between each level.

5. Read RFC 8707 and RFC 9728. Identify the one field in 9728 that MCP uses differently from the RFC's example. (Hint: it concerns `scopes_supported`.)

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| OAuth 2.1 | "Modern OAuth" | Consolidated RFC that mandates PKCE and forbids implicit flow |
| PKCE | "Proof-of-possession" | Code verifier + challenge defeating authorization-code interception |
| Resource indicator | "Token audience" | RFC 8707 `resource` parameter pinning token to one server |
| Protected-resource metadata | "Discovery doc" | RFC 9728 `.well-known/oauth-protected-resource` |
| Step-up authorization | "Incremental consent" | SEP-835 flow for adding scopes on demand |
| `insufficient_scope` | "403 with WWW-Authenticate" | Server signal to re-consent for a larger scope |
| Confused deputy | "Token reuse across services" | Attack where a trusted holder forwards a token inappropriately |
| Short-lived token | "Access token TTL" | Bearer that expires quickly; refresh token renews |
| Scope hierarchy | "Least privilege stack" | Graduated scope set with step-up between levels |
| Client ID metadata | "Client discovery doc" | URL at which the client publishes its own OAuth metadata |

## Further Reading

- [MCP — Authorization spec](https://modelcontextprotocol.io/specification/draft/basic/authorization) — canonical MCP OAuth profile
- [den.dev — MCP November authorization spec](https://den.dev/blog/mcp-november-authorization-spec/) — walkthrough of the 2025-11-25 changes
- [RFC 8707 — Resource indicators for OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc8707) — the audience-pinning RFC
- [RFC 9728 — OAuth 2.0 protected resource metadata](https://datatracker.ietf.org/doc/html/rfc9728) — the discovery-document RFC
- [Aembit — MCP OAuth 2.1, PKCE and the future of AI authorization](https://aembit.io/blog/mcp-oauth-2-1-pkce-and-the-future-of-ai-authorization/) — practical step-up-flow walk-through
