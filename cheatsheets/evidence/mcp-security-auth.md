# Evidence: cheatsheets/mcp-security-auth.md

Abbreviations: P = phases/13-tools-and-protocols. L15 = P/15-mcp-security-tool-poisoning, L16 = P/16-mcp-security-oauth-2-1, L18 = P/18-mcp-auth-production, PI = phases/14-agent-engineering/27-prompt-injection-defense. d = docs/en.md, c = code/main.py.

## Token refusals (troubleshooting, 8)
- 401 malformed when jwt_decode fails: L18/c:486-489
- 401 iss not allowed, allowed_issuers, authorization_servers allow-list: L18/c:494-495, L18/d:316
- 401 unknown kid after one refetch, fix the refresh job: L18/c:500-509, L18/d:310
- 401 bad signature, never accept unverifiable signature: L18/c:512-513, L18/d:275
- 401 audience mismatch, request with resource: L18/c:514-515, L18/d:176, L16/d:157
- 401 expired: L18/c:516-517, L16/d:176
- 403 insufficient_scope, step up with combined scopes and new JSON-RPC id: L18/c:518-519, L16/d:180-188
- stale JWKS after rotation, scheduled refresh plus cache-miss refetch: L18/d:220, 310

## Gateway and content findings (troubleshooting, 8)
- metadata_poisoning, block and review: L15/c:157-158, L15/d:99
- rug_pull, quarantine until re-approved: L15/c:162-163, L15/d:97
- unapproved, quarantine until review: L15/c:160-161, L15/d:96
- shadowing, namespace notes.search: L15/c:164-166, L15/d:98, 111-116
- -32020 header mismatch before backend, RBAC, rate limit: L15/d:75, L15/c:237-241
- -32021 for URL-only elicitation: L15/d:190
- requestState bound to exact arguments, mismatch refused: L15/d:192, L15/c:330
- no content-source metadata; validator on each tool call: PI/d:63, 55

## Validation order on the resource server (flow, 7)
1. jwt_decode failure gives 401 malformed: L18/c:486-489
2. iss allow-list checked before JWKS: L18/c:491-495
3. kid lookup in jwks_cache, refresh_jwks once on miss: L18/c:496-507
4. jwt_verify failure gives bad signature: L18/c:512-513
5. aud mismatch: L18/c:514-515
6. exp past: L18/c:516-517
7. 403 insufficient_scope with scope: L18/c:518-519

## Authorization code with PKCE (flow, 7)
1. protected-resource metadata, advertised issuer: L16/d:61
2. code_verifier and S256 code_challenge, pkce_pair: L16/d:149-150, L16/c:90-94
3. client_id, redirect_uri, scope, code_challenge, resource: L16/d:151
4. code and iss: L16/d:152
5. exact iss compare, drop on mismatch: L16/d:153, 163, L16/c:572-573
6. exchange with code_verifier, same redirect URI and resource: L16/d:154
7. store under (issuer, resource): L16/d:155, L16/c:580

## Tasks in code (task-table, 8)
- descriptor_digest(tool): L15/c:129
- scan_catalog(catalog, approved): L15/c:146-149
- scan_description(description): L15/c:134
- verifier, challenge = pkce_pair(): L16/c:90, 563
- client.call_with_step_up(tool, server, auth): L16/c:584, 621
- server.validate(bearer_token, required_scope=...): L18/d:245
- server.refresh_jwks(): L18/c:461, 703
- python3 -m unittest discover code/tests -v: L15/d:251, L16/d:255

## PVE: validate before execute (annotated-code, 10 lines)
- Validator allowed_tools and sensitive_tools: PI/c:49-51, 114-117
- ToolCall search with intent research: PI/c:125-126
- Content with user_message source is skipped by the scan: PI/c:62-64, 128
- validator.assess checks allowlist, args, retrieved content: PI/c:53-72, 129
- executor.run after approval: PI/c:78-82, 131-132
- looks_like_directive returns marker or None: PI/c:31-38
- memory_write_guard(MemoryWrite(...)) refuses directive-shaped writes: PI/c:98-106, 162-166

## Client enrollment paths (comparison, 6 rows)
- priority: pre-registered first, then CIMD, DCR deprecated fallback: L16/d:86, L18/d:130
- client id from operator, HTTPS URL with a path, POST /register: L18/d:130, L16/d:103, L18/d:137, 153
- client_id_metadata_document_supported, registration_endpoint: L18/d:80
- application_type optional on CIMD, required native or web on DCR: L16/d:103, 113-126
- new issuer: new credentials, portable CIMD URL, re-register: L16/d:141-143
- risks: SSRF on CIMD fetch, registration spam and registration token theft: L16/d:105, L18/d:125, 170-172

## Seven attack surfaces (concepts, 7)
- Metadata poisoning: L15/d:32
- Descriptor rug pull: L15/d:33
- Cross-server shadowing: L15/d:34
- Header and body confusion: L15/d:35
- Capability escalation: L15/d:36
- MRTR state tampering: L15/d:37
- Identity confusion: L15/d:38

## Rules (tips, 7)
- bearer in Authorization header on every request, never URL: L16/d:47
- no OAuth flow on stdio: L16/d:45
- no token passthrough: L16/d:234
- iss exact compare without case folding, trailing slash, port changes: L16/d:163
- refresh vs rotate: L18/d:217-218
- introspection down fails closed, never active true: L18/d:276
- rule of two: L15/d:200-206

## Questions (qa, 5)
- clientInfo self-reported: L15/d:61
- hash pin proves stability not safety: L15/d:101
- PKCE does not stop mix-up: L18/d:306
- capabilities are compatibility declarations: L15/d:122
- prompt instruction is not enforcement: PI/d:65

## Abbreviations (glossary, 8)
- CIMD: L16/d:287, L18/d:376
- DCR RFC 7591 deprecated: L18/d:377
- PKCE: L16/d:290
- JWKS from jwks_uri indexed by kid: L18/d:378
- RFC 9728: L16/d:286
- RFC 8707: L16/d:292
- RFC 9207 iss stops mix-up: L18/d:384
- PVE: PI/d:113
