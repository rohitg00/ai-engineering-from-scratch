# MCP Authorization: CIMD, Issuer Binding, PKCE, and Step-Up

> A remote MCP request is stateless, but its authorization is not anonymous. Bind every credential to the issuer that created it and every token to the resource that receives it.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 13 · 09 (transports), Phase 13 · 15 (security)
**Time:** ~90 minutes

## Learning Objectives

- Discover authorization servers through protected-resource metadata.
- Prefer Client ID Metadata Documents over deprecated Dynamic Client Registration.
- Declare the correct `application_type` when a DCR compatibility path is unavoidable.
- Validate authorization response `iss` and isolate credentials by issuer.
- Use PKCE, resource indicators, audience validation, and incremental scopes.
- Send authorized MCP 2026-07-28 requests without protocol sessions.

## The Problem

A remote MCP server may read private records, write external systems, or trigger costly work. Authentication tells it who presented a credential. Authorization must also answer:

- Which authorization server issued the credential?
- Which MCP resource is the token for?
- Which client and redirect URI completed the flow?
- Which operations did the user approve?
- Does this exact request still fit that approval?

The 2026-07-28 authorization profile hardens client enrollment and issuer handling. It prefers Client ID Metadata Documents, deprecates Dynamic Client Registration, requires the right `application_type` on DCR, validates RFC 9207 issuer responses, and forbids credential reuse across issuers.

These rules complement the stateless core. They do not restore a core handshake or `Mcp-Session-Id`.

## The Concept

### Know the three roles

- **MCP client:** sends requests on behalf of a resource owner.
- **MCP resource server:** accepts the access token and serves the MCP endpoint.
- **Authorization server:** authenticates the resource owner, collects consent, and issues tokens.

The resource server and authorization server can be operated together, but keep their identifiers and validation responsibilities separate.

### Authorization applies to HTTP

The MCP authorization specification applies to HTTP-based transports. A local stdio server runs under the process and operating-system trust boundary. Do not add a fake browser OAuth flow to stdio merely for symmetry.

For remote Streamable HTTP, send the bearer token in the `Authorization` header on every request. Never place it in the URL.

### Start with protected-resource metadata

The resource server publishes RFC 9728 metadata:

```json
{
  "resource": "https://notes.example.com/mcp",
  "authorization_servers": ["https://auth.example.com"],
  "scopes_supported": ["notes:delete", "notes:read", "notes:write"]
}
```

The client starts from the MCP resource URL, fetches this document, selects an advertised authorization server, and then fetches that server's OAuth or OpenID Connect metadata.

Preserve the resource path when constructing the RFC 9728 well-known URL. For the resource `https://notes.example.com/mcp`, this lesson uses `https://notes.example.com/.well-known/oauth-protected-resource/mcp`. Dropping the `/mcp` suffix can select metadata for a different protected resource on the same origin.

Do not guess the authorization server from a hostname. Do not follow an issuer discovered from an unvalidated error body. Keep a policy for which issuers the client is willing to trust.

### Verify authorization server metadata

The metadata should expose endpoints and supported controls:

```json
{
  "issuer": "https://auth.example.com",
  "authorization_endpoint": "https://auth.example.com/authorize",
  "token_endpoint": "https://auth.example.com/token",
  "code_challenge_methods_supported": ["S256"],
  "authorization_response_iss_parameter_supported": true,
  "client_id_metadata_document_supported": true
}
```

Require S256 for PKCE. Record the exact issuer string. That exact value becomes the key for registration and token storage.

### Follow the registration priority

Use pre-registered client information when the client already has an explicit relationship with the selected issuer. Otherwise prefer Client ID Metadata Documents when the authorization server advertises support. Use DCR only as the deprecated compatibility fallback, then prompt for client information if none of those mechanisms is available.

### Prefer Client ID Metadata Documents

A Client ID Metadata Document gives the authorization server an HTTPS URL that is both the client identifier and the location of its metadata:

```json
{
  "client_id": "https://client.example.com/oauth/metadata.json",
  "client_name": "Notes desktop client",
  "application_type": "native",
  "redirect_uris": ["http://127.0.0.1:8765/callback"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"]
}
```

The authorization server fetches and validates the document. The `client_id` must be an HTTPS URL with a path, and the value inside the document must equal that URL exactly. The required document fields are `client_id`, `client_name`, and `redirect_uris`. `application_type` appears in this example but is not a CIMD requirement. Its new mandatory use is specifically the DCR path.

Treat fetching the document as an SSRF-sensitive operation. Resolve and validate the destination, reject loopback, private, link-local, and otherwise disallowed addresses, re-check after redirects and DNS changes, limit redirects, bytes, and time, require JSON, and cache only according to validated HTTP cache controls. Treat `client_name` and other display fields as untrusted text.

CIMD removes the need to mint a fresh dynamic identifier for every first contact. It does not remove redirect URI validation, issuer policy, or user consent.

### DCR is a compatibility path

Dynamic Client Registration remains available for older authorization servers, but it is deprecated for new MCP implementations.

When using DCR, declare `application_type`:

```json
{
  "client_name": "Notes desktop client",
  "application_type": "native",
  "redirect_uris": ["http://127.0.0.1:8765/callback"],
  "grant_types": ["authorization_code"],
  "response_types": ["code"]
}
```

- Desktop, mobile, command-line, and loopback clients use `native`.
- Remotely hosted browser applications use `web` and remote HTTPS redirects.

Omitting the field can default to `web` in an OpenID Connect registration implementation and make a legitimate loopback redirect fail.

Keep DCR code behind an explicit fallback decision. Do not silently fall back after an arbitrary CIMD validation failure. That could turn a security failure into a weaker enrollment path.

### Bind credentials to the issuer

Store issuer-minted enrollment material under the exact issuer:

```text
issuer_credentials[issuer] = pre_registered_or_dcr_client
tokens[(issuer, resource)] = access_token
```

If protected-resource discovery changes from `https://auth-one.example` to `https://auth-two.example`, re-evaluate trust. Never send the first issuer's client secret, DCR client id, registration access token, refresh token, or access token to the second. Pre-registered and DCR clients must use credentials issued for the new issuer.

A CIMD client id is different because it is a self-hosted HTTPS URL, not a credential minted by an authorization server. The same CIMD URL is portable: a new trusted issuer fetches and validates the document without DCR re-registration. Authorization responses and tokens are still validated and stored under the new issuer.

### Authorization code with PKCE

The interactive flow is:

1. Generate a high-entropy `code_verifier`.
2. Derive the S256 `code_challenge`.
3. Send the authorization request with exact `client_id`, `redirect_uri`, `scope`, `code_challenge`, and `resource`.
4. Receive an authorization response containing `code` and, when provided, `iss`.
5. Validate `iss` against the exact recorded issuer before using any response field.
6. Exchange the code with `code_verifier`, the same redirect URI, and the same `resource`.
7. Store the resulting token under `(issuer, resource)`.

The `resource` parameter from RFC 8707 appears in both authorization and token requests. It identifies the canonical MCP server URI.

### Validate `iss` exactly

RFC 9207 prevents an authorization response from one issuer being confused with a response from another.

When `iss` is present, compare it to the recorded issuer without case folding, trailing-slash changes, default-port removal, or percent-encoding normalization. On mismatch, do not act on the code or even display attacker-controlled error details from that response.

An authorization server that includes `iss` advertises `authorization_response_iss_parameter_supported: true`. Current clients still validate a present `iss` even when that advertisement is missing.

### Validate audience at the MCP server

The resource server accepts only tokens issued for itself:

```text
token.issuer == configured_authorization_server
token.audience == canonical_mcp_resource
```

Invalid, expired, wrong-issuer, or wrong-audience tokens receive 401. The MCP server must not accept or transit a token meant for another service.

### Request the smallest current scope

Start with the scope needed now. If a later tool requires more, the server returns 403 with an authoritative scope challenge:

```text
WWW-Authenticate: Bearer error="insufficient_scope",
  scope="notes:delete",
  resource_metadata="https://notes.example.com/.well-known/oauth-protected-resource/mcp"
```

The client explains the new permission, obtains consent, performs a new authorization flow with the combined scope set, and retries the MCP request with a new JSON-RPC id.

Do not assume the challenged scope is a subset of `scopes_supported`. The challenge is authoritative for the current operation.

### Authorization and the stateless MCP wire

An authorized tool call still carries the complete current request envelope:

```text
POST /mcp
Authorization: Bearer <access-token>
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: notes.delete
```

```json
{
  "jsonrpc": "2.0",
  "id": 12,
  "method": "tools/call",
  "params": {
    "name": "notes.delete",
    "arguments": {"id": "note-7"},
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        "name": "oauth-lesson-client",
        "version": "1.0.0"
      }
    }
  }
}
```

The token authorizes the principal. The request metadata negotiates protocol behavior. Neither substitutes for the other.

Validate the wire in a fixed order: JSON-RPC and metadata types, header and body equality, then protocol support. A routing or version-header mismatch returns HTTP 400 with `-32020`. If header and body agree on an unsupported version, return HTTP 400 with `-32022` and `data` exactly `{"supported":["2026-07-28"],"requested":"<actual>"}`. An unknown method returns HTTP 404 with `-32601`.

Every request error, including 401 invalid token and 403 insufficient scope, is a JSON-RPC error envelope with the original request `id`. Structured recovery information belongs in optional error `data`; `WWW-Authenticate` remains an HTTP response header. A notification has no `id`, so it receives no JSON-RPC body. An accepted HTTP notification returns 202 with an empty body.

The server implements `server/discover` and advertises tools, so it also implements the mandatory `tools/list` method. Its tool descriptors have stable names, descriptions, and object-root `inputSchema` values. The list is deterministic and returns `resultType`, server identity metadata, a bounded `ttlMs`, and `cacheScope`. Discovery and a user-independent tool list can be available before authorization. Apply normal policy and private caching if either varies by principal.

### No token passthrough

An MCP server must not forward the client's MCP access token to a downstream API. Obtain a separate downstream token with the right audience or use an explicit token-exchange design. Audience validation only works when services refuse tokens minted for someone else.

### Refresh tokens

Refresh tokens are optional. When issued, store them confidentially and key them by issuer and resource. Do not assume they exist. Rotate them when the authorization server supports rotation and detect reuse of invalidated values.

```figure
t3-scope-stepup
```

## Build It

`code/main.py` is an in-process protocol and authorization simulator. It implements protected-resource discovery, authorization server metadata, CIMD enrollment, version-gated DCR fallback, application type checks, PKCE, issuer validation, resource-bound tokens, scope step-up, `server/discover`, `tools/list`, and a stateless tool request.

The model receives parsed request bodies and routing headers. It is not a complete HTTP adapter and does not parse `Content-Type` or `Accept`. Connect it to Lesson 09's Streamable HTTP adapter, which requires `Content-Type: application/json` and an `Accept` value containing both `application/json` and `text/event-stream`.

Run it:

```bash
cd phases/13-tools-and-protocols/16-mcp-security-oauth-2-1
python3 code/main.py
python3 -m unittest discover code/tests -v
```

The output shows discovery first, CIMD enrollment, an ordinary read, two separate scope step-ups, and issuer-keyed credential storage.

## Use It

Map the simulator objects to production components:

- `ResourceServer.protected_resource_metadata` becomes the RFC 9728 endpoint.
- `AuthorizationServer.metadata` becomes RFC 8414 or OpenID Connect discovery.
- `Client.enroll` becomes CIMD resolution plus an explicit DCR compatibility branch.
- Issuer-minted client credentials and `tokens_by_issuer_resource` become encrypted records. A CIMD URL may remain portable while its authorization results remain issuer-bound.
- `ResourceServer.handle` becomes middleware that validates current MCP headers, token, and tool scope before dispatch while keeping every request error in a matching JSON-RPC envelope.

## Ship It

This lesson ships `outputs/skill-oauth-scope-planner.md`. It now designs enrollment priority, issuer-bound credential storage, application type, PKCE, resource indicators, scope challenges, and the current stateless request boundary.

## Exercises

1. Add refresh-token rotation and reject reuse of the previous refresh token.
2. Add an issuer allowlist. On issuer change, reuse only a portable CIMD URL; refuse all prior issuer-minted credentials and tokens.
3. Add an expiry to authorization codes and confirm a late exchange fails.
4. Build a web client variant with a remote HTTPS redirect and compare its DCR metadata to the native client.
5. Add a second resource under the same issuer. Confirm its access token cannot be used at the first resource.

## Key Terms

| Term | Meaning |
|------|---------|
| Protected-resource metadata | RFC 9728 document that identifies the resource and authorization servers |
| CIMD | HTTPS metadata document whose URL is the OAuth client identifier |
| DCR | Deprecated dynamic client enrollment retained for compatibility |
| `application_type` | `native` or `web`, used to validate redirect URI rules |
| PKCE | Verifier and S256 challenge that protect an intercepted authorization code |
| `iss` | RFC 9207 authorization response issuer identifier |
| Resource indicator | RFC 8707 parameter that binds a token request to an MCP resource |
| Audience | Resource for which a token is valid |
| Step-up | New consent and token issuance for an additional current-operation scope |
| Issuer-bound credentials | Registration and token records isolated by exact authorization server issuer |

## Further Reading

- [MCP 2026-07-28 authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- [RFC 9728: OAuth 2.0 Protected Resource Metadata](https://www.rfc-editor.org/rfc/rfc9728)
- [RFC 8707: Resource Indicators for OAuth 2.0](https://www.rfc-editor.org/rfc/rfc8707)
- [RFC 9207: OAuth 2.0 Authorization Server Issuer Identification](https://www.rfc-editor.org/rfc/rfc9207)
- [OAuth Client ID Metadata Document draft](https://datatracker.ietf.org/doc/draft-ietf-oauth-client-id-metadata-document/)
