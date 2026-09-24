# Authorizing Access to an MCP Server

> A bearer token proves the client was issued credentials for this server, not that the server should trust everything the token's holder asks for, so the protocol makes the client prove the token, prove the audience, and prove the issuer, every single time.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 22
**Time:** ~45 minutes

## Learning Objectives

- Explain why the MCP server plays the OAuth 2.1 resource server, the MCP client plays the OAuth client, and a separate authorization server issues tokens, and why stdio servers are told to skip this flow entirely
- Trace Protected Resource Metadata discovery from a 401 response's WWW-Authenticate header through the well-known fallback order a client uses when the header is silent
- Trace authorization server metadata discovery for a path-scoped issuer and a root issuer, and explain why the returned issuer value must match the one used to build the request
- Generate a PKCE S256 code challenge from a code verifier with the standard library, and explain why a client must refuse to proceed when an authorization server does not advertise code_challenge_methods_supported
- Apply the resource parameter from RFC 8707 to bind a token request to one canonical server URI, and validate an incoming token's audience against that same URI
- Apply the four-row iss validation table from RFC 9207 to defend against mix-up attacks, and tell 401, 403, and 400 apart on an MCP server's authorization responses

## The Problem

Most of what this track has covered so far assumes a request is legitimate the moment it is well formed: the right `_meta`, a known tool, valid arguments. That assumption breaks the moment an MCP server holds something worth protecting, a database of customer records, a key rotation tool, a billing system. A server exposing that kind of primitive cannot let every syntactically valid `tools/call` through. It needs to know who is asking, on whose authority, and for what, before it does anything the caller cannot undo.

Authorization for MCP is optional at the protocol level: a local stdio server has no need for it, because the process boundary and the user's own environment already establish trust, and an implementation there SHOULD NOT run an OAuth flow at all, reading credentials from the environment instead. The moment a server moves to a remote, HTTP-based deployment, though, that boundary disappears, and the specification says an HTTP implementation SHOULD conform to the authorization flow this lesson covers. The hard part is not encryption or transport; both of those are already handled below this layer. The hard part is proving, on every single request, that a token in hand was issued for this exact server, by an authorization server the client actually trusts, to a user who actually consented, all without a session to lean on.

## The Concept

Three roles carry the whole flow, and the vocabulary matters because the specification's language uses it precisely. The MCP server is an **OAuth 2.1 resource server**: it holds the protected primitive and accepts or rejects bearer tokens. The MCP client is an **OAuth 2.1 client**: it drives the browser-based authorization flow on the user's behalf and attaches tokens to requests. The **authorization server** is a third role, often a separate service entirely, such as a hosted identity provider, responsible for authenticating the user and minting tokens. None of those three roles is the model: authorization happens at the transport layer, entirely below anything the model ever sees. The trust zones mapped in the previous lesson place this third role outside the host's boundary altogether: the client talks to it directly, and the MCP server itself may never see the user's original credentials, only the token that comes out the other end.

The flow starts with rejection. A client sends an ordinary `tools/call` with no token, and the server answers with plain HTTP `401 Unauthorized`, not a JSON-RPC error: at this point the request never got far enough to be parsed as a protocol message at all, so there is no `result` and no `error` body, only the HTTP layer's own status and headers. A server SHOULD include a `WWW-Authenticate` header naming where to find more information:

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource/mcp"
```

That URL points at a **Protected Resource Metadata** document (RFC 9728), which every MCP server MUST implement. A client that finds `resource_metadata` in the header fetches exactly that URL. A client that does not, the header can be absent for infrastructure reasons or simply lack the parameter, MUST fall back to constructing well-known URIs itself, in order: the path-specific location first, `/.well-known/oauth-protected-resource` plus the MCP endpoint's own path, then the root, `/.well-known/oauth-protected-resource` with no path at all. For an endpoint at `https://mcp.example.com/mcp` with no header to read, that is exactly two URLs to try, path-specific first. The document that comes back names the authorization server or servers behind this resource:

```json
{
  "resource": "https://mcp.example.com/mcp",
  "authorization_servers": ["https://auth.example.com/tenant-a"],
  "scopes_supported": ["vault:rotate"]
}
```

With an authorization server identified, the client discovers its endpoints. MCP reuses the default `oauth-authorization-server` well-known suffix from RFC 8414 rather than inventing its own, and because issuers show up both with and without a path component, a client MUST try more than one shape. An issuer with a path, `https://auth.example.com/tenant-a`, is tried in this order: OAuth metadata with the path inserted after `.well-known`, then OpenID Connect discovery with the path inserted the same way, then OpenID Connect discovery with the path appended before `.well-known`. An issuer with no path skips straight to the first two shapes, without any path insertion. Whichever URL answers, the document's own `issuer` field MUST equal, character for character, the issuer identifier used to build that URL. A document fetched from `https://attacker.example/.well-known/oauth-authorization-server` that claims `"issuer": "https://honest.example"` MUST be rejected outright: accepting it would let an attacker who merely controls a hostname vouch for a completely different authorization server's identity.

Before redirecting the user's browser anywhere, the client generates a PKCE pair, because MCP requires PKCE unconditionally and requires the `S256` method specifically whenever the client is technically capable of it. Since neither OAuth 2.1 nor PKCE defines a way to ask an authorization server whether it supports PKCE, MCP clients read `code_challenge_methods_supported` off the metadata document instead: if that field is missing, the client MUST refuse to proceed, full stop, because there is no other way to know PKCE will be honored. The verifier is a random string the client keeps to itself; the challenge is what travels on the wire:

```python
import base64
import hashlib
import secrets

verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b"=").decode("ascii")
digest = hashlib.sha256(verifier.encode("ascii")).digest()
challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
```

Two more values travel on both the authorization request and the later token request. The `resource` parameter (RFC 8707) names the canonical URI of the MCP server the client actually wants to use the token with, scheme and host in lowercase, no fragment, no trailing slash unless the slash is meaningful; sending it is mandatory even when the authorization server ignores it, because it is what lets a careful authorization server mint a token scoped to exactly one resource instead of every resource it has ever issued for. The `state` parameter, generated fresh per request and checked on return, is what stops an attacker from substituting a different authorization response for the one the client actually started.

The authorization server issues the code and reports back with a redirect. Before the client trusts anything in that redirect, it applies the `iss` check from RFC 9207, because an attacker who controls one authorization server the client happens to trust can otherwise trick the client into sending an authorization code meant for one issuer to a completely different one, a mix-up attack. The issuer recorded before redirecting is compared against the returned `iss` by these four rules:

| Server advertises `authorization_response_iss_parameter_supported` | `iss` in the response | Client action |
|---|---|---|
| true | present | compare to the recorded issuer exactly |
| true | absent | reject the response |
| false or absent | present | compare to the recorded issuer exactly |
| false or absent | absent | proceed |

Only an exact match proceeds, with no case folding, port elision, or trailing-slash normalization before the comparison. The check applies to error responses too: on a mismatch the client must not act on or display `error`, `error_description`, or `error_uri`, because they came from an issuer the client never chose. With the code validated, the client exchanges it at the token endpoint, sending the same `resource` parameter and the PKCE `code_verifier` so the authorization server can check it against the `code_challenge` it saw earlier. What comes back is a bearer token.

Using that token repeats a discipline this track already established: a credential rides fresh on every request, in a header, the same way `_meta` carries protocol version and capabilities on every request instead of once at the start of a connection, matching the stateless core from the earlier lesson. Concretely: `Authorization: Bearer <token>` on every HTTP request to the server, and the access token MUST NOT appear in the URI query string, where it would leak into logs, proxies, and browser history. Receiving a token is not the same as trusting it. The resource server MUST validate that the token's audience names this server specifically, the same canonical URI from the `resource` parameter, and MUST reject anything else, including a perfectly valid token that some other MCP server issued for itself. If this server calls further upstream APIs on the user's behalf, it acts as its own OAuth client there and uses a separate token for that hop; forwarding the token it just received, token passthrough, is forbidden outright, because it lets the upstream API mistake this server's authority for the original caller's, bypassing whatever scope the upstream actually meant to grant.

Three HTTP status codes carry the outcome, and the exam likes to blur them: `401 Unauthorized` means no token or an invalid one, missing, expired, unparseable, or bound to the wrong audience, `403 Forbidden` means a token that authenticates fine but lacks a required scope, and `400 Bad Request` means the authorization request itself was malformed before a token even entered the picture. Registering a client, how it gets a `client_id` in the first place, and requesting more scope once a token already exists, are both substantial enough to earn their own lessons next.

```figure
mcpa-23-oauth-flow
```

## Interactive Lab

The figure follows one credential-rotation call through all three lanes. In the top lane, the client's first attempt carries no token at all, and the server's only reply is an HTTP 401 with a `WWW-Authenticate` header, no JSON-RPC body, because the rejection happens before the message is ever parsed as a protocol message. In the middle lane, the client resolves that header into a Protected Resource Metadata fetch, then an authorization server metadata fetch using the path-issuer order, generates its PKCE pair, and comes back from the authorization server with a code and an `iss` value it checks against what it recorded before redirecting anywhere. In the bottom lane, the client repeats the exact same `tools/call`, this time with `Authorization: Bearer` set, and the server's resource server layer accepts it because the token's audience is this server's own canonical URI, and only then does the request reach the ordinary tool-handling code this track has been building since the earlier lessons.

## Practice Lab

Open `code/main.py`. `simulate_authorization_flow` builds the metadata discovery, PKCE, resource indicator, and issuer checks entirely as Python data, the way a client actually computes them, with no JSON-RPC anywhere in that part: a `dict` for Protected Resource Metadata, a `dict` for authorization server metadata, `AuthorizationRequest` and `TokenRequest` dataclasses for the two OAuth requests. Separately, `McpServer` and `McpClient` model only the MCP side: one tool, `rotate_credential`, guarded by a `ResourceServer` that holds two issued tokens, one whose audience matches this server's canonical URI and one issued for a different server entirely. Run it from the lesson directory:

```bash
python3 code/main.py
```

Read the printed discovery orders against the concept section first: two Protected Resource Metadata URLs, path-specific then root, and three authorization server metadata URLs, because the issuer used in the demo has a path component. Then read the two transcript entries. The first is the unauthenticated `tools/call`, wrapped with the HTTP status and headers that actually carried it, `401`, no `result`, no `error`, exactly the shape the specification produces when rejection happens below the JSON-RPC layer. The second pair is the same call retried with a valid bearer token: the wrapped request now carries `Authorization: Bearer tok_valid_abc` and status `200`, followed by an ordinary `resultType: "complete"` result with a new request id. Change `foreign_token`'s value to the one used in the valid call and rerun to watch a token issued for `https://other-server.example.com/mcp` get rejected by this server's audience check even though the token itself is perfectly well formed.

## Shipped Artifact

`outputs/authorization-flow-checklist.md` is the one-page version: the discovery order for both Protected Resource Metadata and authorization server metadata, the PKCE refusal rule, what the `resource` parameter must look like, the `iss` decision table, and the three status codes with what each one actually means. Keep it next to you the first time you stand up authorization for a remote MCP server.

## Verify It

Run the tests from the lesson directory:

```bash
python3 -m unittest discover code/tests
```

They check the claims in this lesson: that Protected Resource Metadata discovery prefers a `WWW-Authenticate` header's `resource_metadata` value and otherwise falls back to well-known URLs in the path-specific-then-root order, that authorization server metadata discovery orders three URLs for a path issuer and two for a root issuer, that a metadata document whose `issuer` does not match what was requested is rejected, that a PKCE `S256` challenge equals `base64url(sha256(verifier))` computed independently, that an authorization server missing `code_challenge_methods_supported` is refused before any redirect happens, that the `resource` parameter is canonicalized and carried onto both the authorization and token requests, that the four-row `iss` table is enforced in both directions, that a token issued for a different server's audience is rejected with `401` even though it is otherwise valid, and that a token is never placed in a URL. The repository's wire checker also validates the lesson's transcript against the 2026-07-28 rules:

```bash
python3 scripts/check_mcpa_wire.py certifications/mcpa/lessons/23-oauth-authorization
```

## Capstone Connection

The capstone's end-to-end exchange includes a resource server that validates audience and rejects a token issued for another server, exactly the check built here. Everything the capstone assumes about that step, that a bearer token is only as trustworthy as the audience it was minted for, that rejection at the HTTP layer produces no JSON-RPC body, that a canonical resource URI is the thing tokens actually get bound to, comes directly from this lesson.

## Key Terms

| Term | Meaning |
|------|---------|
| Resource server | The role the MCP server plays in OAuth 2.1: it accepts or rejects bearer tokens |
| Authorization server | The separate service that authenticates the user and issues tokens |
| Protected Resource Metadata | An RFC 9728 document naming a resource server's authorization server or servers |
| PKCE | A verifier and challenge pair that stops a stolen authorization code from being redeemed elsewhere |
| S256 | The mandatory PKCE method: the challenge equals base64url(sha256(verifier)) |
| Resource indicator | The RFC 8707 resource parameter binding a token request to one canonical server URI |
| iss validation | Comparing an authorization response's issuer against the one recorded before redirecting, per RFC 9207 |
| Audience validation | A resource server confirming a token was issued specifically for it before accepting the token |
| Token passthrough | Forwarding a client's token to an upstream API instead of using a separate token; forbidden |
| 401 vs 403 vs 400 | No or invalid token, insufficient scope, and a malformed authorization request, respectively |

## Further Reading

- [MCP specification 2026-07-28: Authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- [MCP specification 2026-07-28: Authorization Server Discovery](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/authorization-server-discovery)
- [MCP specification 2026-07-28: Authorization Security Considerations](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/security-considerations)
- [MCP tutorial: Understanding Authorization](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/authorization)
- `certifications/mcpa/research/mcp-2026-07-28-brief.md`, section 12
- `phases/13-tools-and-protocols/16-mcp-security-oauth-2-1` and `phases/13-tools-and-protocols/18-mcp-auth-production`, which build the OAuth flow and its production hardening in depth
