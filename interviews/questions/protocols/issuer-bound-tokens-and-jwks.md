---
id: issuer-bound-tokens-and-jwks
title: Two issuers, one resource server, no outage
card: protocols
kind: design
level: 4
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [system-design, design-review]
tags: [mcp, oauth, cimd, audience, jwks, issuer]
minutes: 15
lessons: [phases/13-tools-and-protocols/16-mcp-security-oauth-2-1, phases/13-tools-and-protocols/18-mcp-auth-production]
manuals: []
practice: []
cheatsheet: [mcp-security-auth]
related: [protocols/header-body-mismatch-order, protocols/descriptor-pin-rug-pull]
updated: 2026-11-03
---

You deploy a remote MCP server that accepts tokens from two authorization servers, one for staff and one for partners. Design the client enrollment, the per-request token validation and the key handling so that three things hold: a token minted for a sibling MCP server is refused, a signing key rotation causes no outage, and a client steered to a hostile token endpoint never hands over its authorization code.

## Short answer

Publish RFC 9728 protected-resource metadata that names both issuers, and treat that list as the issuer allow-list. Enroll a client with its pre-registered credentials when it has an explicit relationship with that issuer, otherwise with a Client ID Metadata Document when the issuer advertises support, and use deprecated dynamic registration only as an explicit fallback with the correct `application_type`. On every request validate the pinned `iss`, an `aud` equal to this server's canonical resource URI, `exp` and the scope the tool needs; answer `401` for an invalid token and `403` with `insufficient_scope` for a valid token that lacks the scope. Refresh the JWKS on a schedule and re-fetch once on an unknown `kid`, and let the client record the issuer before it redirects and compare the RFC 9207 `iss` in the authorization response exactly before it redeems the code.

## Full answer

### Discovery and the deployment gate

The client starts from the MCP resource URL, fetches the RFC 9728 document, selects an advertised authorization server and fetches its RFC 8414 metadata. Keep the resource path when you build the well-known URL: a resource served at the path `/mcp` resolves to `/.well-known/oauth-protected-resource/mcp` on the same host. Before trusting an issuer, check the metadata mechanically: `S256` must be advertised or you stop, `response_types_supported` is `["code"]`, and at least one enrollment path exists.

### Enrollment priority

| Path | When | Note |
|---|---|---|
| pre-registered client | an explicit relationship with that issuer exists | credentials keyed by issuer |
| Client ID Metadata Document | the issuer advertises support | the HTTPS URL with a path is the `client_id` and the document's `client_id` equals it |
| dynamic registration | neither of the above | deprecated; declare `native` or `web`; never a silent fallback after a CIMD failure |

Fetching a CIMD is an SSRF-sensitive operation for the issuer. Store issuer-minted credentials under the exact issuer and access tokens under `(issuer, resource)`. If discovery moves from one issuer to another, re-evaluate trust and never send the first issuer's secret, registration token or tokens to the second. A CIMD URL is portable because it is self-hosted, not minted.

### Validation on every request

```text
token.iss in protected_resource_metadata.authorization_servers
token.aud == canonical MCP resource URI
token.exp in the future
required scope present
```

A missing `aud` is a rejection, never a wildcard. The replay walkthrough: a token for `notes.example.com` presented to `tasks.example.com` passes the issuer check and fails the audience check, and the server returns `401` with `WWW-Authenticate: Bearer error="invalid_token"` and a `resource_metadata` pointer. The spec calls this access-token privilege restriction. Never forward the inbound token to a downstream API; obtain a separate downstream token.

### Rotate at the issuer, refresh at the server

The issuer rotates by publishing the next key before retiring the previous one, so two keys at once is the steady state. The resource server only refreshes: a scheduled job overwrites `cache[issuer] = {keys, fetched_at}`, and a token with an unknown `kid` triggers one synchronous re-fetch and then fails if the key is still missing. Never wire the cache miss to rotate-and-mint: the new key still does not match, and attacker-chosen `kid` values become a key-creation denial of service.

### The mix-up defense lives in the client

A hostile authorization server can steer a client to redeem an honest issuer's code at the attacker's token endpoint. PKCE does not stop it, because the client hands its `code_verifier` to whatever endpoint it was steered to. The client records the expected issuer before redirecting and compares the returned `iss` as a plain string, with no case folding, slash or port normalization, before it sends the code anywhere.

### Declared failure policy

| Failure | Behavior |
|---|---|
| scheduled JWKS refresh fails, known `kid` still cached | continue only within a declared stale-on-error window |
| unknown `kid` and the one refresh fails | reject |
| introspection unavailable for an opaque token | fail closed; never convert a network error into `active: true` |
| issuer metadata changes unexpectedly | stop new enrollment and token acquisition |

## Follow-ups

- **Level 3:** Why is a per-connection token check not enough? Expected: there is no protocol session; every request carries its own bearer token and is validated on its own.
- **Level 3:** A scope step-up is needed for one tool. What does the server return? Expected: `403` with `WWW-Authenticate: Bearer error="insufficient_scope"` naming the scope and the `resource_metadata` URL; the client obtains consent and retries with a new request id.
- **Level 4:** Two concurrent step-ups produce two tokens with different scopes. Which does the validator use? Expected: the token presented on the request, never a lookup of "the user's current scope", which would open a time-of-check race.
- **Level 4:** The partner issuer changes its issuer URL in discovery. What may the client reuse? Expected: only a portable CIMD URL; prior issuer-minted credentials, registration tokens and access tokens are refused, and the client re-enrolls.

## Wrong answers

- "Any token from our own identity provider is fine." A token minted for a sibling server passes the issuer check; only the audience check refuses it.
- "Fetch the JWKS once at boot." The validator rejects every token after the next rotation until a restart; refresh on a schedule and once on a miss.
- "Fall back to dynamic registration when CIMD validation fails." A security failure must not select a weaker enrollment path; the fallback is an explicit configuration decision.

## Taught in

The [OAuth lesson](../../../phases/13-tools-and-protocols/16-mcp-security-oauth-2-1/) builds the enrollment and the flow, and the [production auth lesson](../../../phases/13-tools-and-protocols/18-mcp-auth-production/) adds JWKS refresh, audience replay and the failure table.
