---
name: mcp-auth-wiring
description: Design MCP 2026-07-28 authorization with issuer-bound enrollment, CIMD, protected-resource metadata, JWKS refresh, audience pinning, and per-request validation.
version: 2.0.0
phase: 13
lesson: 18
tags: [mcp, oauth, cimd, dcr, jwks, rfc8414, rfc7591, rfc8707, rfc7636, rfc9728, rfc9207]
---

Given an MCP server config and an IdP capability set, emit the auth surface and refusal rules that constitute a production MCP authorization layer.

Inputs:

- `mcp_resource_url` — canonical resource URL (most-specific identifier; keep a path only when it distinguishes co-hosted servers), used as `aud` and as the protected-resource metadata `resource` value.
- `idp_metadata_url` — the IdP's `/.well-known/oauth-authorization-server` (or OpenID Connect Discovery) URL.
- `idp_capabilities`: observed values for `issuer`, `code_challenge_methods_supported`, `grant_types_supported`, `client_id_metadata_document_supported`, deprecated `registration_endpoint`, `response_types_supported`, and `authorization_response_iss_parameter_supported`.
- `pre_registered_client_ids`: optional issuer-to-client-ID map provisioned by authorization-server operators. Prefer this issuer-scoped identity before CIMD, then use deprecated DCR only as the final compatibility path.
- `application_type`: `native` or `web`, required when deprecated DCR compatibility is selected.
- `credential_store`: client IDs and registration credentials keyed by authorization-server issuer, with access tokens keyed by `(issuer, mcp_resource_url)`.
- `tools`: the MCP tool list with the scope each requires.

Produce:

1. **Refusal gate.** Refuse to wire and stop if any hard condition fails:
   - `S256` is missing from `code_challenge_methods_supported` (PKCE has no degraded mode).
   - `authorization_code` is missing from `grant_types_supported`.
   - `response_types_supported` is anything other than exactly `["code"]`.
   - No enrollment path exists: none of a pre-registered `client_id`, `client_id_metadata_document_supported: true`, or a deprecated DCR compatibility endpoint is available.
   - CIMD is selected but its `client_id` is not the absolute HTTPS document URL with a path, does not match the document URL, or the document lacks a non-empty `client_name` or `redirect_uris` array. `application_type` is optional for CIMD.
   - A returned RFC 9207 `iss` differs from the issuer recorded before redirect, or is omitted when the server advertised it as supported.
   - Deprecated DCR lacks `application_type`, or its redirect URI policy conflicts with `native` or `web`.

2. **Protected-resource metadata document** (RFC 9728) for the MCP server. For a resource with a path, insert the well-known segment before that path: `https://host/team/mcp` maps to `https://host/.well-known/oauth-protected-resource/team/mcp`. Include `resource`, `authorization_servers` (the issuer allow-list), `scopes_supported`, and `bearer_methods_supported: ["header"]`.

3. **HTTP endpoints.**
   - `GET /.well-known/oauth-protected-resource` — returns the document from (2).
   - `POST /mcp` (the stateless MCP transport): validates the bearer token for this request before any tool dispatches.
   - DCR compatibility only: `POST /register`, with an application-type check and a rate-limit check ahead of it.

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
   - Reject any authorization request without an S256 `code_challenge`, and reject any token request whose `code_verifier`, client, redirect URI, or `resource` does not match the one-time authorization-code record.
   - Reject any credential or token whose issuer does not match its credential-store key. Issuer change requires new enrollment.

Hard rejects (never wire any of these — refuse the request and document why):

- Storing `client_secret` in plaintext. Public clients use `token_endpoint_auth_method: none`; confidential clients use `private_key_jwt`. No plaintext shared secrets at rest or in the registration response logs.
- Skipping the `aud` check on the validator. Audience binding (access-token privilege restriction) is the entire reason for RFC 8707 + RFC 9728.
- Wiring the JWKS cache-miss fall-back to a rotate-and-mint instead of a re-fetch. It never produces the missing `kid` and lets attacker-controlled `kid` values force unbounded key creation. The fall-back must be the idempotent refresh.
- Allowing PKCE-less authorization code requests. OAuth 2.1 forbids it; the validator must reject any `/token` exchange whose stored authorization-code record lacks a `code_challenge`.
- Caching JWKS without a refresh job. Either the scheduled refresh ships, or the auth surface does not deploy.
- Trusting the `iss` claim without an allow-list. Any validator that accepts a token from any `iss` lets an attacker stand up their own IdP and forge tokens.
- Forwarding the inbound MCP token to an upstream API (token passthrough). If the MCP server calls upstream APIs it MUST obtain its own separate token; passthrough creates the confused-deputy problem.
- Storing `registration_access_token` in plaintext. Hash-at-rest; require cleartext on every update.
- Treating MCP request metadata or a removed protocol session as authorization state. The 2026-07-28 transport is stateless; authenticate and authorize every request.

Output: a one-page plan with the protected-resource document, issuer-keyed enrollment layout, issuer-and-resource token layout, chosen enrollment path, HTTP endpoints, JWKS refresh job, scope mapping, and runtime refusal rules. End with the first unmet deployment gate found in the authorization server's actual metadata.
