---
name: mcp-auth-wiring
description: Stand up production MCP authorization (RFC 8414, CIMD, 7591, 8707, 7636 PKCE, 9728, 9207) — protected-resource metadata, enrollment, JWKS refresh, and per-request token validation.
version: 1.1.0
phase: 13
lesson: 18
tags: [mcp, oauth, cimd, dcr, jwks, rfc8414, rfc7591, rfc8707, rfc7636, rfc9728, rfc9207]
---

Given an MCP server config and an IdP capability set, emit the auth surface and refusal rules that constitute a production MCP authorization layer.

Inputs:

- `mcp_resource_url` — canonical resource URL (most-specific identifier; keep a path only when it distinguishes co-hosted servers), used as `aud` and as the protected-resource metadata `resource` value.
- `idp_metadata_url` — the IdP's `/.well-known/oauth-authorization-server` (or OpenID Connect Discovery) URL.
- `idp_capabilities` — observed values for `code_challenge_methods_supported`, `grant_types_supported`, `client_id_metadata_document_supported` (CIMD), `registration_endpoint` (DCR), `response_types_supported`, `authorization_response_iss_parameter_supported` (RFC 9207).
- `tools` — the MCP tool list with the scope each requires.

Produce:

1. **Refusal gate.** Refuse to wire and stop if any hard condition fails:
   - `S256` is missing from `code_challenge_methods_supported` (PKCE has no degraded mode).
   - `authorization_code` is missing from `grant_types_supported`.
   - `response_types_supported` is anything other than exactly `["code"]`.
   - No enrollment path exists: none of a pre-registered `client_id`, `client_id_metadata_document_supported: true` (CIMD), or a `registration_endpoint` (DCR) is available. Any one suffices — DCR absence alone is no longer a refusal (2025-11-25 demoted DCR to a `MAY`; CIMD is the preferred default).

2. **Protected-resource metadata document** (RFC 9728) for the MCP server to publish at `/.well-known/oauth-protected-resource`. Includes `resource`, `authorization_servers` (the issuer allow-list), `scopes_supported`, `bearer_methods_supported: ["header"]`.

3. **HTTP endpoints.**
   - `GET /.well-known/oauth-protected-resource` — returns the document from (2).
   - `POST /mcp` (the MCP transport) — runs token validation before any tool dispatches.
   - (DCR path only) `POST /register` — the registrar, with a rate-limit check ahead of it.

4. **Background job + routines.**
   - A scheduled JWKS refresh that re-fetches `jwks_uri` into the cache `{keys, fetched_at}`. Idempotent; never mints keys. The AS rotates; the resource server only refreshes. Default `0 */6 * * *`; tighten to `*/15 * * * *` for high-rotation IdPs.
   - A `validate` routine — checks `iss` allow-list, signature against cached JWKS, `aud == mcp_resource_url`, `exp`, required scope.
   - A step-up issuance path — only if the tool list contains operations gated behind a scope the user does not initially grant.

5. **Cache plan.** One entry per accepted issuer keyed by `issuer`, holding `{keys, fetched_at}`. Document the read pattern: the validator reads the cache and falls back to a single synchronous refresh on `kid` miss (re-fetch, not rotate — re-fetch is idempotent and cannot be turned into a key-creation DoS).

6. **Scope mapping.** Map every tool to the scope it requires. Output a table:
   `| tool | required_scope | rationale |`. Group destructive tools under their own scope; never reuse a read scope for a write tool.

7. **Refusal rules at runtime** (the validator must encode these):
   - Reject when `aud != mcp_resource_url` → 401 `Bearer error="invalid_token", error_description="audience mismatch", resource_metadata="<prm_url>"`.
   - Reject when `iss not in authorization_servers`.
   - Reject when `kid` not in cached JWKS after a single re-fetch fall-back.
   - Reject when required scope is absent → 403 `Bearer error="insufficient_scope", scope="<required>", resource_metadata="<prm_url>"`.
   - Reject any token request without `code_verifier` or `resource` parameter.

Hard rejects (never wire any of these — refuse the request and document why):

- Storing `client_secret` in plaintext. Public clients use `token_endpoint_auth_method: none`; confidential clients use `private_key_jwt`. No plaintext shared secrets at rest or in the registration response logs.
- Skipping the `aud` check on the validator. Audience binding (access-token privilege restriction) is the entire reason for RFC 8707 + RFC 9728.
- Wiring the JWKS cache-miss fall-back to a rotate-and-mint instead of a re-fetch. It never produces the missing `kid` and lets attacker-controlled `kid` values force unbounded key creation. The fall-back must be the idempotent refresh.
- Allowing PKCE-less authorization code requests. OAuth 2.1 forbids it; the validator must reject any `/token` exchange whose stored authorization-code record lacks a `code_challenge`.
- Caching JWKS without a refresh job. Either the scheduled refresh ships, or the auth surface does not deploy.
- Trusting the `iss` claim without an allow-list. Any validator that accepts a token from any `iss` lets an attacker stand up their own IdP and forge tokens.
- Forwarding the inbound MCP token to an upstream API (token passthrough). If the MCP server calls upstream APIs it MUST obtain its own separate token; passthrough creates the confused-deputy problem.
- Storing `registration_access_token` in plaintext. Hash-at-rest; require cleartext on every update.

Output: a one-page plan with the protected-resource document, the chosen enrollment path (CIMD / pre-registration / DCR), the HTTP endpoints, the JWKS refresh job, the cache plan, the scope mapping table, and the encoded runtime refusal rules. End with the single deployment-blocking gap most likely to surface against the chosen IdP — typically whether CIMD is supported yet, falling back to DCR availability for enterprise SSO.
