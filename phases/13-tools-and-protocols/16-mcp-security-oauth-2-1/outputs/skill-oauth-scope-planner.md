---
name: oauth-scope-planner
description: Design MCP 2026-07-28 authorization with CIMD, issuer isolation, resource indicators, and step-up scopes.
version: 2.0.0
phase: 13
lesson: 16
tags: [mcp, oauth, cimd, pkce, issuer, resource-indicators]
---

Given a remote HTTP MCP server and its tool list, design the complete authorization boundary.

## Required inputs

- Canonical MCP resource URI and protected-resource metadata location.
- Allowed authorization server issuers.
- Client runtime: native or web, with exact redirect URIs.
- Tool-to-scope mapping and consequential operations.
- Token, refresh, and credential-storage constraints.
- Legacy authorization servers that lack CIMD, if any.

## Produce

1. Resource metadata. Draft RFC 9728 `resource`, `authorization_servers`, and `scopes_supported`. Preserve the resource path after the well-known segment, such as `https://notes.example.com/.well-known/oauth-protected-resource/mcp` for `https://notes.example.com/mcp`.
2. Issuer policy. State exact allowed issuers, metadata validation, change handling, and RFC 9207 `iss` comparison.
3. Enrollment. Use pre-registration when available, otherwise prefer a Client ID Metadata Document. Its HTTPS URL with a path is the `client_id`; require exact redirect URIs and treat display metadata as untrusted. `application_type` is optional here.
4. DCR fallback. If required, label it deprecated, declare `application_type`, and define the precise condition that allows fallback. Do not downgrade after a generic CIMD security failure.
5. Credential keys. Store pre-registered and DCR credentials under issuer and tokens under `(issuer, resource)`. Forbid reuse across issuers. State that a self-hosted CIMD URL is portable and does not require DCR re-registration when a trusted issuer changes.
6. PKCE flow. Require S256, exact redirect URI, authorization response issuer validation, and the same resource in authorization and token requests.
7. Scope model. Map every tool to its minimum scope. Treat the current `WWW-Authenticate` scope challenge as authoritative.
8. Step-up experience. Identify the additional scope, user explanation, consent point, new authorization, and retry with a fresh MCP request id.
9. Resource-server checks. Implement advertised `tools/list` with valid object-root schemas, deterministic order, result type, server identity, and cache hints. Validate issuer, audience, expiry, scope, current MCP headers, and request metadata before tool dispatch.
10. Token hygiene. Bearer header only, no query token, no token passthrough, confidential refresh storage, and rotation plan.
11. Error contract. Preserve every request id in a JSON-RPC error envelope, including OAuth failures. Require HTTP 400 `-32020` for header mismatch before the HTTP 400 `-32022` version support check, exact supported and requested data, HTTP 404 `-32601` for unknown methods, and 202 with an empty body for accepted notifications.
12. Transport boundary. Label parsed-body examples as in-process protocol models and attach them to Lesson 09's complete Streamable HTTP adapter for JSON Content-Type and JSON plus SSE Accept validation.

## Hard rejects

- DCR presented as the preferred new enrollment mechanism.
- DCR without `application_type`.
- Reusing issuer-minted registration credentials, access tokens, or refresh tokens after the issuer changes. A self-hosted CIMD URL is the portable exception, not an issuer-minted secret.
- Normalizing an authorization response `iss` before comparison.
- Missing PKCE S256 or missing `resource` in authorization and token requests.
- Accepting a token for another audience or forwarding the MCP token downstream.
- Using `clientInfo`, `serverInfo`, capabilities, or a removed protocol session as authentication.
- Adding OAuth to local stdio solely to imitate remote HTTP.
- Dropping the protected resource path when constructing the RFC 9728 metadata URL.
- Returning a plain-text or ad hoc object for an MCP request error instead of a JSON-RPC envelope with the same id.

## Output format

Return sections named Resource, Issuers, Enrollment, Credential Store, PKCE Flow, Scope Matrix, Step-Up, Server Validation, Token Hygiene, and Compatibility. End with the exact event that forces issuer review and, for issuer-minted clients, re-enrollment.
