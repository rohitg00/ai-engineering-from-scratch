---
name: mcp-auth-iii-wiring
description: Production MCP authorization（RFC 8414, 7591, 8707, 7636 PKCE, 9728）をiii primitivesへ配線する。HTTP/cronはregisterTrigger、validationはregisterFunction、JWKS cacheはstate::*。
version: 1.0.0
phase: 13
lesson: 18
tags: [mcp, oauth, dcr, jwks, iii, rfc8414, rfc7591, rfc8707, rfc7636, rfc9728]
---

MCP server configとIdP capability setを受け取り、production auth surfaceを構成するiii primitivesとrefusal rulesをemitする。

Inputs:

- `mcp_resource_url` — canonical resource URL（pathなし）。`aud`とprotected-resource metadataの`resource` valueとして使う。
- `idp_metadata_url` — IdPの`/.well-known/oauth-authorization-server` URL。
- `idp_capabilities` — `code_challenge_methods_supported`、`grant_types_supported`、`registration_endpoint`、`response_types_supported`のobserved values。
- `tools` — 各toolが必要とするscopeを含むMCP tool list。

Produce:

1. **Refusal gate.** 次の4 conditionsのいずれかがfailしたら、配線を拒否して停止する。
   - `S256`が`code_challenge_methods_supported`にない。
   - `authorization_code`が`grant_types_supported`にない。
   - `registration_endpoint`がない（RFC 7591 DCRなし）。
   - `response_types_supported`が正確に`["code"]`ではない。

2. **Protected-resource metadata document**（RFC 9728）をMCP serverが`/.well-known/oauth-protected-resource`で公開する。`resource`、`authorization_servers`（issuer allow-list）、`scopes_supported`、`bearer_methods_supported: ["header"]`を含める。

3. **iii trigger registrations.** 各callをliteralにemitする。
   - `iii.registerTrigger("http", {"path": "/.well-known/oauth-protected-resource", "method": "GET"}, "auth::serve-protected-resource")`
   - `iii.registerTrigger("http", {"path": "/mcp", "method": "POST"}, "mcp::dispatch")` — dispatcherはtool実行前に`iii.trigger("auth::validate-jwt", ...)`を呼ぶ。
   - `iii.registerTrigger("cron", {"schedule": "<rotation_schedule>"}, "auth::rotate-jwks")` — default scheduleは`0 */6 * * *`。High-rotation IdPsでは`*/15 * * * *`へtightenする。

4. **iii function registrations.** 各callをliteralにemitする。
   - `iii.registerFunction("auth::validate-jwt", handler)` — `iss` allow-list、cached JWKSでのsignature、`aud == mcp_resource_url`、`exp`、required scopeをcheckする。
   - `iii.registerFunction("auth::rotate-jwks", handler)` — `jwks_uri`をfetchし、`state::set("auth/jwks/<iss>", {keys, fetched_at})`へwriteする。
   - `iii.registerFunction("auth::serve-protected-resource", handler)` — (2)のdocumentを返す。
   - `iii.registerFunction("auth::issue-step-up", handler)` — userがinitially grantしていないscopeでguardされたoperationがtool listにある場合のみ。

5. **State key plan.** Accepted issuerごとに1 key: `{keys, fetched_at}`を持つ`auth/jwks/<issuer>`。Read patternをdocumentする。Validatorは`state::get`から読み、`kid` miss時はsynchronousな`iii.trigger("auth::rotate-jwks", ...)`へfall backする。

6. **Scope mapping.** すべてのtoolを必要scopeへmapする。次のtableをoutputする:
   `| tool | required_scope | rationale |`。Destructive toolsは専用scopeにgroupする。Read scopeをwrite toolへ再利用しない。

7. **Refusal rules at runtime**（validatorはこれらをencodeする。handler bodyへemitする）:
   - `aud != mcp_resource_url`ならreject。
   - `iss not in authorization_servers`ならreject。
   - Single rotation fall-back後も`kid`がcached JWKSになければreject。
   - Required scopeがなければreject → 403 `Bearer error="insufficient_scope", scope="<required>", resource="<mcp_resource_url>"`。
   - `code_verifier`または`resource` parameterのないtoken requestをreject。

Hard rejects（これらは絶対に配線しない。拒否し理由をdocumentする）:

- `client_secret`をiii state storeへplaintextで保存する。Public clientsは`token_endpoint_auth_method: none`を使い、confidential clientsは`private_key_jwt`を使う。Plaintext shared secretsを`state::*`やregistration response logsへ残さない。
- Validatorの`aud` checkをskipする。Confused-deputyがRFC 8707 + RFC 9728の主な理由である。
- PKCEなしauthorization code requestsを許す。OAuth 2.1は禁止している。Validatorは、stored authorization-code recordに`code_challenge`がない`/token` exchangeをrejectしなければならない。
- Refresh jobなしでJWKSをcacheする。Cron triggerをshipするか、auth surfaceをdeployしない。
- Allow-listなしで`iss` claimを信頼する。任意`iss`のtokenを受け入れるvalidatorは、attackerが自分のIdPを立ててtokensをforgeできる。
- `registration_access_token`をplaintextで保存する。Hash-at-restにし、update時は毎回cleartextを要求する。

Output: protected-resource document、3つの`registerTrigger` calls、4つの`registerFunction` calls、state key plan、scope mapping table、encoded runtime refusal rulesを含む1ページwiring plan。最後に、chosen IdPで最も出やすいdeployment-blocking gapを1つ示す。多くの場合enterprise SSOでのDCR availabilityである。
