---
name: mcp-auth-iii-wiring
description: Wire production MCP authorization (RFC 8414, 7591, 8707, 7636 PKCE, 9728) onto iii primitives — registerTrigger for HTTP/cron, registerFunction for validation, state::* for JWKS cache.
version: 1.0.0
phase: 13
lesson: 18
tags: [mcp, oauth, dcr, jwks, iii, rfc8414, rfc7591, rfc8707, rfc7636, rfc9728]
---

Given an MCP server config and an IdP capability set, emit the iii primitives and refusal rules that constitute the production auth surface.

Inputs:

- `mcp_resource_url` — canonical resource URL (no path), used as `aud` and as the protected-resource metadata `resource` value.
- `idp_metadata_url` — the IdP's `/.well-known/oauth-authorization-server` URL.
- `idp_capabilities` — observed values for `code_challenge_methods_supported`, `grant_types_supported`, `registration_endpoint`, `response_types_supported`.
- `tools` — the MCP tool list with the scope each requires.

Produce:

1. **Refusal gate.** If any of the four conditions fails, refuse to wire and stop:
   - `S256` is missing from `code_challenge_methods_supported`.
   - `authorization_code` is missing from `grant_types_supported`.
   - `registration_endpoint` is absent (no RFC 7591 DCR).
   - `response_types_supported` is anything other than exactly `["code"]`.

2. **Protected-resource metadata document** (RFC 9728) for the MCP server to publish at `/.well-known/oauth-protected-resource`. Includes `resource`, `authorization_servers` (the issuer allow-list), `scopes_supported`, `bearer_methods_supported: ["header"]`.

3. **iii trigger registrations.** Emit each call literally:
   - `iii.registerTrigger("http", {"path": "/.well-known/oauth-protected-resource", "method": "GET"}, "auth::serve-protected-resource")`
   - `iii.registerTrigger("http", {"path": "/mcp", "method": "POST"}, "mcp::dispatch")` — the dispatcher calls `iii.trigger("auth::validate-jwt", ...)` before any tool runs.
   - `iii.registerTrigger("cron", {"schedule": "<rotation_schedule>"}, "auth::rotate-jwks")` — schedule is `0 */6 * * *` by default; tighten to `*/15 * * * *` for high-rotation IdPs.

4. **iii function registrations.** Emit each call literally:
   - `iii.registerFunction("auth::validate-jwt", handler)` — checks `iss` allow-list, signature against cached JWKS, `aud == mcp_resource_url`, `exp`, required scope.
   - `iii.registerFunction("auth::rotate-jwks", handler)` — fetches `jwks_uri`, writes `state::set("auth/jwks/<iss>", {keys, fetched_at})`.
   - `iii.registerFunction("auth::serve-protected-resource", handler)` — returns the document from (2).
   - `iii.registerFunction("auth::issue-step-up", handler)` — only if the tool list contains operations gated behind a scope the user does not initially grant.

5. **State key plan.** One key per accepted issuer: `auth/jwks/<issuer>` holding `{keys, fetched_at}`. Document the read pattern: validator reads from `state::get`, falls back to a synchronous `iii.trigger("auth::rotate-jwks", ...)` on `kid` miss.

6. **Scope mapping.** Map every tool to the scope it requires. Output a table:
   `| tool | required_scope | rationale |`. Group destructive tools under their own scope; never reuse a read scope for a write tool.

7. **Refusal rules at runtime** (the validator must encode these — emit them in the handler body):
   - Reject when `aud != mcp_resource_url`.
   - Reject when `iss not in authorization_servers`.
   - Reject when `kid` not in cached JWKS after a single rotation fall-back.
   - Reject when required scope is absent → 403 `Bearer error="insufficient_scope", scope="<required>", resource="<mcp_resource_url>"`.
   - Reject any token request without `code_verifier` or `resource` parameter.

Hard rejects (never wire any of these — refuse the request and document why):

- Storing `client_secret` in plaintext in the iii state store. Public clients use `token_endpoint_auth_method: none`; confidential clients use `private_key_jwt`. No plaintext shared secrets in `state::*` or in the registration response logs.
- Skipping the `aud` check on the validator. Confused-deputy is the entire reason for RFC 8707 + RFC 9728.
- Allowing PKCE-less authorization code requests. OAuth 2.1 forbids it; the validator must reject any `/token` exchange whose stored authorization-code record lacks a `code_challenge`.
- Caching JWKS without a refresh job. Either the cron trigger ships, or the auth surface does not deploy.
- Trusting the `iss` claim without an allow-list. Any validator that accepts a token from any `iss` lets an attacker stand up their own IdP and forge tokens.
- Storing `registration_access_token` in plaintext. Hash-at-rest; require cleartext on every update.

Output: a one-page wiring plan with the protected-resource document, the three `registerTrigger` calls, the four `registerFunction` calls, the state key plan, the scope mapping table, and the encoded runtime refusal rules. End with the single deployment-blocking gap most likely to surface against the chosen IdP — typically DCR availability for enterprise SSO.
