---
id: mcp-security-auth
title: MCP Security and Authorization
code: SA
subtitle: Find and fix token refusals, poisoned tool metadata and injected content. CIMD, PKCE, iss, audience and PVE checks.
hue: 350
sources: phases/13-tools-and-protocols/15-mcp-security-tool-poisoning, phases/13-tools-and-protocols/16-mcp-security-oauth-2-1, phases/13-tools-and-protocols/18-mcp-auth-production, phases/14-agent-engineering/27-prompt-injection-defense
source_hash: 697206fef977f478
---

## Token refusals
type: troubleshooting
from: phases/13-tools-and-protocols/18-mcp-auth-production/code/main.py, phases/13-tools-and-protocols/18-mcp-auth-production/docs/en.md, phases/13-tools-and-protocols/16-mcp-security-oauth-2-1/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| 401 `malformed` | Token does not decode | Send a valid JWT in `Authorization` |
| 401 `iss not allowed` | Issuer not in `allowed_issuers` | Trust only `authorization_servers` issuers |
| 401 `unknown kid` | Key missing after one refetch | Fix the JWKS refresh job |
| 401 `bad signature` | Signature does not verify | Reject. There is no fallback |
| 401 `audience mismatch` | Token is for another resource | Request it with this `resource` |
| 401 `expired` | `exp` is in the past | Get a new token |
| 403 `insufficient_scope` | Tool needs a larger scope | Step up with combined scopes, new id |
| Valid tokens fail after a key change | Stale JWKS cache | Scheduled refresh plus one refetch on a miss |

## Gateway and content findings
type: troubleshooting
from: phases/13-tools-and-protocols/15-mcp-security-tool-poisoning/code/main.py, phases/13-tools-and-protocols/15-mcp-security-tool-poisoning/docs/en.md, phases/14-agent-engineering/27-prompt-injection-defense/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| `metadata_poisoning` finding | Scanner hit in a description | Block and review the full descriptor |
| `rug_pull` finding | Approved descriptor changed | Quarantine until re-approval |
| `unapproved` finding | No approved digest for the key | Quarantine until review |
| `shadowing` finding | Two servers expose one name | Namespace it, for example `notes.search` |
| `-32020` | `Mcp-Method` or `Mcp-Name` differs from the body | Reject before routing, RBAC and rate limits |
| `-32021` on a form request | Client declared URL-only elicitation | Declare `elicitation` form support |
| Retry refused after confirm | `requestState` bound to other arguments | Ask for a new confirmation |
| Agent obeys a web page | No source tag on retrieved content | Tag content and validate each tool call |

## Validation order on the resource server
type: flow
from: phases/13-tools-and-protocols/18-mcp-auth-production/code/main.py

1. **Decode**: `jwt_decode` fails. Return 401 malformed.
2. **Issuer**: `iss` not in `allowed_issuers`. Return 401 before any JWKS fetch.
3. **Key**: look up `kid` in `jwks_cache`. On a miss call `refresh_jwks` one time.
4. **Signature**: `jwt_verify` fails. Return 401 bad signature.
5. **Audience**: `aud` is not this resource. Return 401 audience mismatch.
6. **Expiry**: `exp` is in the past. Return 401 expired.
7. **Scope**: required scope is absent. Return 403 `insufficient_scope` with the scope.

## Authorization code with PKCE
type: flow
from: phases/13-tools-and-protocols/16-mcp-security-oauth-2-1/docs/en.md, phases/13-tools-and-protocols/16-mcp-security-oauth-2-1/code/main.py

1. **Client**: fetch protected-resource metadata. Pick an advertised issuer.
2. **Client**: make a `code_verifier` and its S256 `code_challenge` with `pkce_pair`.
3. **Client**: send `client_id`, `redirect_uri`, `scope`, `code_challenge` and `resource`.
4. **Authorization server**: returns `code` and `iss`.
5. **Client**: compare `iss` with the recorded issuer exactly. On mismatch, drop the response.
6. **Client**: exchange the code with `code_verifier`, the same redirect URI and `resource`.
7. **Client**: store the token under `(issuer, resource)` in `tokens_by_issuer_resource`.

## Tasks in code
type: task-table
from: phases/13-tools-and-protocols/15-mcp-security-tool-poisoning/code/main.py, phases/13-tools-and-protocols/16-mcp-security-oauth-2-1/code/main.py, phases/13-tools-and-protocols/18-mcp-auth-production/code/main.py, phases/13-tools-and-protocols/18-mcp-auth-production/docs/en.md

| Task | Code |
|---|---|
| Pin a whole descriptor | `descriptor_digest(tool)` |
| Scan a catalog against pins | `scan_catalog(catalog, approved)` |
| Scan one description | `scan_description(description)` |
| Make a PKCE pair | `verifier, challenge = pkce_pair()` |
| Step up a scope on 403 | `client.call_with_step_up(tool, server, auth)` |
| Validate a bearer token | `server.validate(bearer_token, required_scope=<s>)` |
| Re-fetch the key set | `server.refresh_jwks()` |
| Run the lesson tests | `python3 -m unittest discover code/tests -v` |

## PVE: validate before execute
type: annotated-code
lang: python
from: phases/14-agent-engineering/27-prompt-injection-defense/code/main.py

```python
validator = Validator(
    allowed_tools=("search", "send_message", "read_memory"),
    sensitive_tools=("send_message",))
call = ToolCall("search", {"query": "<query>"}, intent="research")
contents = [Content("<text>", "user_message")]  # user text is not scanned
ok, reason = validator.assess(call, contents)   # allowlist, args, retrieved text
if ok:
    executor.run(call)                          # runs only after approval
looks_like_directive("<text>")                  # first marker hit or None
memory_write_guard(MemoryWrite("<text>"))       # refuses directive-shaped writes
```

## Client enrollment paths
type: comparison
from: phases/13-tools-and-protocols/16-mcp-security-oauth-2-1/docs/en.md, phases/13-tools-and-protocols/18-mcp-auth-production/docs/en.md

| Factor | Pre-registered | CIMD | DCR |
|---|---|---|---|
| Status | Use first if it exists | Preferred | Deprecated fallback |
| Client id | From the operator | HTTPS URL with a path | Minted by `POST /register` |
| AS signal | Known relationship | `client_id_metadata_document_supported` | `registration_endpoint` |
| `application_type` | Not required | Optional | Required: `native` or `web` |
| New issuer | New credentials | URL stays portable | Register again |
| Main risk | Reuse at a new issuer | SSRF on the fetch | Registration spam, token theft |

## Seven attack surfaces
type: concepts
from: phases/13-tools-and-protocols/15-mcp-security-tool-poisoning/docs/en.md

- **Metadata poisoning**: a description holds instructions unrelated to the tool.
- **Descriptor rug pull**: an approved name, description, schema or annotation changes.
- **Cross-server shadowing**: two backends expose one unqualified name.
- **Header and body confusion**: `Mcp-Method` or `Mcp-Name` disagrees with the body.
- **Capability escalation**: a declared feature is read as authorization.
- **MRTR state tampering**: a changed `requestState` or reused confirmation.
- **Identity confusion**: a familiar display name is read as publisher proof.

## Rules
type: tips
from: phases/13-tools-and-protocols/16-mcp-security-oauth-2-1/docs/en.md, phases/13-tools-and-protocols/18-mcp-auth-production/docs/en.md, phases/13-tools-and-protocols/15-mcp-security-tool-poisoning/docs/en.md

- Send the bearer token in the `Authorization` header on every request. Never in the URL.
- Do not add an OAuth flow to a local stdio server.
- Never forward the MCP token to a downstream API. Get a separate token.
- Compare `iss` exactly. No case folding, slash or port changes.
- The resource server refreshes JWKS. Only the authorization server rotates keys.
- Fail closed when introspection is down. Network failure is never `active: true`.
- Rule of two: one step never combines untrusted input, sensitive data and an external action.

## Questions
type: qa
from: phases/13-tools-and-protocols/15-mcp-security-tool-poisoning/docs/en.md, phases/13-tools-and-protocols/18-mcp-auth-production/docs/en.md, phases/14-agent-engineering/27-prompt-injection-defense/docs/en.md

- **Is `clientInfo` an identity?** No. It is self-reported.
- **Does a hash pin prove a tool is safe?** No. It proves stability only.
- **Does PKCE stop a mix-up attack?** No. The client must validate `iss`.
- **Do client capabilities grant access?** No. They declare compatibility only.
- **Is "ignore untrusted instructions" in the prompt enough?** No. That is not enforcement.

## Abbreviations
type: glossary
from: phases/13-tools-and-protocols/16-mcp-security-oauth-2-1/docs/en.md, phases/13-tools-and-protocols/18-mcp-auth-production/docs/en.md, phases/14-agent-engineering/27-prompt-injection-defense/docs/en.md

- **CIMD**: Client ID Metadata Document. Its HTTPS URL is the client id.
- **DCR**: Dynamic Client Registration. RFC 7591, deprecated.
- **PKCE**: verifier and S256 challenge that protect the code.
- **JWKS**: JSON Web Key Set, fetched from `jwks_uri`, indexed by `kid`.
- **RFC 9728**: protected-resource metadata. Names the authorization servers.
- **RFC 8707**: resource indicator. Binds the token to one MCP resource.
- **RFC 9207**: `iss` in the authorization response. Stops mix-up.
- **PVE**: Prompt-Validator-Executor. Cheap validator before the main model.
