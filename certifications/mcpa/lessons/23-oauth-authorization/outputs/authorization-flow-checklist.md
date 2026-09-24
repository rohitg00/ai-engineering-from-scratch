# OAuth Authorization Flow Checklist

A one-page reference for authorizing HTTP-based MCP servers, aligned to MCP 2026-07-28.

## The three roles

- MCP server: an OAuth 2.1 resource server. It accepts or rejects bearer tokens.
- MCP client: an OAuth 2.1 client. It drives the flow and attaches tokens to requests.
- Authorization server: a separate service that authenticates the user and issues tokens.
- stdio servers SHOULD NOT run this flow at all; they read credentials from the environment instead.

## Protected Resource Metadata discovery (after a 401)

1. Parse `WWW-Authenticate` for `resource_metadata="..."`. If present, fetch that URL and stop.
2. Otherwise, fall back to well-known URIs, in order:
   - `https://<host>/.well-known/oauth-protected-resource<path>` (path-specific)
   - `https://<host>/.well-known/oauth-protected-resource` (root)

The document names `resource` and at least one entry in `authorization_servers`.

## Authorization server metadata discovery

For an issuer with a path component (`https://auth.example.com/tenant1`):

1. `https://auth.example.com/.well-known/oauth-authorization-server/tenant1`
2. `https://auth.example.com/.well-known/openid-configuration/tenant1`
3. `https://auth.example.com/tenant1/.well-known/openid-configuration`

For an issuer with no path (`https://auth.example.com`):

1. `https://auth.example.com/.well-known/oauth-authorization-server`
2. `https://auth.example.com/.well-known/openid-configuration`

The fetched document's `issuer` field MUST equal the issuer identifier used to build the URL. Reject the document otherwise, even if the fetch itself succeeded.

## PKCE

- PKCE is mandatory; use `S256` whenever technically capable.
- If `code_challenge_methods_supported` is absent from the authorization server's metadata, refuse to proceed. There is no other way to confirm PKCE support.
- `code_challenge = base64url(sha256(code_verifier))`, computed with `hashlib` and `base64` from the standard library.

## Resource indicator (RFC 8707)

- Send `resource` on both the authorization request and the token request, always, even if the authorization server ignores it.
- Value is the canonical URI of the MCP server: lowercase scheme and host, no fragment, no trailing slash unless the slash is meaningful.
- Example: `https://mcp.example.com/mcp`.

## iss validation (RFC 9207): the four-row table

| Server advertises `authorization_response_iss_parameter_supported` | `iss` in the response | Client action |
|---|---|---|
| true | present | compare to the recorded issuer exactly |
| true | absent | reject the response |
| false or absent | present | compare to the recorded issuer exactly |
| false or absent | absent | proceed |

Record the expected issuer before redirecting. Apply this check to error responses too.

## Token usage

- `Authorization: Bearer <token>` on every HTTP request. Never in the query string.
- The server MUST validate the token's audience against its own canonical URI and reject anything else.
- Token passthrough to upstream APIs is forbidden; use a separate token for upstream calls.
- Refresh tokens are never guaranteed; public clients' refresh tokens are rotated.

## Status codes

| Code | Meaning | When |
|---|---|---|
| 401 | Unauthorized | No token, invalid token, expired token, or wrong audience |
| 403 | Forbidden | Token is valid but lacks a required scope |
| 400 | Bad Request | The authorization request itself was malformed |

## Remember for the exam

- Rejection for a missing or invalid token happens at the HTTP layer: no JSON-RPC error body.
- PKCE without `S256` support advertised is a hard refusal, not a warning.
- A well-formed, unexpired token with the wrong audience is still rejected with 401.
- Client registration (how a `client_id` is obtained) and runtime scope step-up are separate lessons.

Source: `certifications/mcpa/research/mcp-2026-07-28-brief.md`, section 12.
