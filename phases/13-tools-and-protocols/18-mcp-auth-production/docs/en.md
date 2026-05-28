# MCP Auth in Production — DCR、JWKS Rotation、iii Primitives 上の Audience-Pinned Tokens

> Lesson 16 では OAuth 2.1 状態機械を memory 内で立ち上げました。2026 年には、実組織に出荷するすべての MCP server が production auth の背後に置かれます。Dynamic client registration (RFC 7591)、authorization-server metadata discovery (RFC 8414)、午前 3 時の token validation を壊さない JWKS rotation、そして confused-deputy reuse を拒否する audience-pinned tokens が必要です。このレッスンでは、それらを iii primitives に接続します。HTTP と cron には `iii.registerTrigger`、auth logic には `iii.registerFunction`、cached keys には `state::set/get` を使い、engine 内の他 workload と同じく auth surface を observable、restartable、replayable にします。

**種別:** 構築
**言語:** Python (stdlib、lesson environment 用に mock した iii primitives)
**前提条件:** Phase 13 · 16 (OAuth 2.1 state machine), Phase 13 · 17 (gateways)
**所要時間:** 約90分

## 学習目標

- RFC 8414 metadata を通じて authorization server を discovery し、contract を検証する。
- RFC 7591 dynamic client registration を実装し、MCP clients が admin intervention なしに enroll できるようにする。
- Cron trigger を使って JWKS keys を cache / rotate し、key roll-over 後も signature verification を生存させる。
- RFC 8707 resource indicators で token を単一 MCP resource に pin し、confused-deputy reuse を拒否する。
- すべての endpoint と background job を iii primitives として接続する。HTTP triggers、cron triggers、named functions、`state::*` reads により、単一 restart で auth surface を再構築する。
- IdP capability matrix を読み、IdP が MCP auth profile を満たせない場合は deploy を拒否する。

## 問題

Lesson 16 の simulator は OAuth 2.1 を memory 内で実行します。Production には、memory-only simulator では見えない 3 つの operational gap があります。

最初の gap は enrollment です。実組織では数百の MCP server と数千の MCP client が動きます。Operator がすべての Cursor user を OAuth client として手作業で登録することはありません。RFC 7591 dynamic client registration により、client は authorization server の `POST /register` に送信し、その場で `client_id` (必要なら `client_secret`) を受け取れます。Server は RFC 8414 metadata に `registration_endpoint` を公開し、client は out-of-band configuration なしにそれを discovery します。

2 つ目の gap は key rotation です。JWT validation は authorization server の signing keys に依存します。これは JSON Web Key Set (JWKS) として公開されます。Authorization server はこれを schedule に従って rotate します (多くは hourly、incident response ではさらに速いこともあります)。Boot 時に 1 回だけ JWKS を fetch する MCP server は、rotation window までは正常に validate できますが、その後は restart まで全 request が失敗します。Production では JWKS を cached value とし、previous keys が expire する前に cache を上書きする refresh job を置きます。さらに、cache より新しい key で署名された token が到着した場合に備え、cache miss 時の fall-back fetch も加えます。

3 つ目の gap は audience binding です。Lesson 16 では RFC 8707 resource indicators を導入しました。Production では、この indicator はすべての request で hard claim check になります。MCP server は `token.aud` を自分の canonical resource URL と比較し、不一致なら HTTP 401 で拒否します。これは、upstream MCP server (またはある server 向け token を持つ悪意ある client) が同じ trust mesh 内の別 server に token を replay する攻撃に対する唯一の防御です。

このレッスンでは、これらすべての gap を iii primitive として扱います。Metadata document は function の output を返す HTTP trigger です。JWKS rotation は `auth::rotate-jwks` を呼ぶ cron trigger で、`state::set("auth/jwks/<issuer>", ...)` に書き込みます。JWT validation は他の処理が `iii.trigger("auth::validate-jwt", token)` で呼ぶ function です。MCP server 自体も、dispatch 前に validation を呼ぶただの HTTP trigger です。Engine を restart すると trigger registry が再構築され、state は残り、auth surface は手動 reconciliation なしに operational になります。

## コンセプト

### RFC 8414 — OAuth Authorization Server Metadata

`/.well-known/oauth-authorization-server` の document は、client が必要とするすべてを記述します。

```json
{
  "issuer": "https://auth.example.com",
  "authorization_endpoint": "https://auth.example.com/authorize",
  "token_endpoint": "https://auth.example.com/token",
  "jwks_uri": "https://auth.example.com/.well-known/jwks.json",
  "registration_endpoint": "https://auth.example.com/register",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "scopes_supported": ["mcp:tools.read", "mcp:tools.invoke"],
  "token_endpoint_auth_methods_supported": ["none", "private_key_jwt"]
}
```

MCP resource URL を与えられた client は discovery を chain します。RFC 9728 の `oauth-protected-resource` (resource server の document) が issuer を示し、次に `oauth-authorization-server` (この RFC) がすべての endpoint を示します。Client は authorization URL を hard-code しません。

MCP 用に IdP を信頼する前に検証する contract:

- `code_challenge_methods_supported` が `S256` を含む (RFC 7636 による PKCE)。
- `grant_types_supported` が `authorization_code` を含み、`password` と `implicit` を拒否する。
- `registration_endpoint` が存在する (RFC 7591 support)。
- `response_types_supported` は OAuth 2.1 では正確に `["code"]`。

これらのいずれかが欠けている場合、MCP server はこの IdP への deploy を拒否します。間違っているのは deployment manifest であって、code ではありません。

### RFC 9728 (recap) — Protected Resource Metadata

Lesson 16 では RFC 9728 を扱いました。Production での差分は、この document が、client が *この* MCP server に信頼された authorization servers を見つける唯一の場所になることです。1 つの MCP server が複数 IdP からの token を受け入れることもあります (staff 用と partners 用など)。RFC 9728 はその set を宣言し、RFC 8414 は各 IdP が何を support するかを document します。

```json
{
  "resource": "https://notes.example.com",
  "authorization_servers": ["https://auth.example.com", "https://partners.example.com"],
  "scopes_supported": ["mcp:tools.invoke"],
  "bearer_methods_supported": ["header"],
  "resource_documentation": "https://notes.example.com/docs"
}
```

### RFC 7591 — Dynamic Client Registration

DCR がない場合、すべての MCP client (Cursor、Claude Desktop、custom agent) は IdP admin との out-of-band exchange を必要とします。DCR では、client は次を post します。

```json
POST /register
Content-Type: application/json

{
  "redirect_uris": ["http://127.0.0.1:7333/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none",
  "scope": "mcp:tools.invoke",
  "client_name": "Cursor",
  "software_id": "com.cursor.cursor",
  "software_version": "0.42.0"
}
```

Server は `client_id` と、後の update 用 `registration_access_token` を返します。

```json
{
  "client_id": "c_3e7f1a",
  "client_id_issued_at": 1769472000,
  "redirect_uris": ["http://127.0.0.1:7333/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "registration_access_token": "regt_b2...",
  "registration_client_uri": "https://auth.example.com/register/c_3e7f1a"
}
```

`token_endpoint_auth_method: none` は、user の device 上で動く MCP clients の正しい default です。Client が得るのは `client_id` だけで、exfiltrate される `client_secret` はありません。PKCE が public clients に必要な proof-of-possession を提供します。

Production の pitfall は 3 つあります。

- Registration endpoint は source IP で rate-limit する必要があります。これがないと、敵対者が数百万の fake registration を script し、`client_id` namespace を枯渇させられます。iii ではこれは単純です。Registration HTTP trigger は registrar に dispatch する前に `auth::rate-limit` function を呼びます。
- `software_statement` (client を保証する signed JWT) を必須にする enterprise IdP があります。この lesson の mock は省略しています。Production では、localhost redirect URI 以外からの unsigned registration を拒否する verification step を接続します。
- `registration_access_token` は plaintext ではなく hash として保存する必要があります。この token が盗まれると、attacker は client の redirect URI を書き換えられます。

### RFC 8707 (recap) — Resource Indicators

Lesson 16 で形を確立しました。Production rule は、すべての token request が `resource=<canonical-mcp-url>` を含み、MCP server がすべての call で `token.aud` と自分の resource URL の一致を検証することです。MCP server が `https://notes.example.com/mcp` で到達可能な場合、canonical URL は `https://notes.example.com` です。単一 server が 1 audience の下で複数 path を host できるよう、path component は除外します。

### RFC 7636 (recap) — PKCE

PKCE は OAuth 2.1 で必須です。この lesson の authorization-code flow は常に `code_challenge` と `code_verifier` を運びます。Server は verifier がない token request、または保存済み challenge に hash が一致しない verifier を持つ request を拒否します。

### MCP Spec 2025-11-25 Auth Profile

MCP spec (2025-11-25) は、MCP server の authorization layer が何をすべきかを明確に定めています。

- `/.well-known/oauth-protected-resource` (RFC 9728) を公開する。
- Token は `Authorization: Bearer ...` 経由でのみ受け入れる。
- Request ごとに `aud`、`iss`、`exp`、required scopes を validate する。
- すべての 401 と 403 に対して、`Bearer error=...` を含む `WWW-Authenticate` で応答する。該当する場合は `scope=` と `resource=` parameters も含める。
- `aud` が canonical resource と一致しない token を拒否する。
- `iss` が protected-resource metadata の `authorization_servers` list にない token を拒否する。

OAuth 2.1 draft が substrate、RFC 8414/7591/8707/9728 + RFC 7636 が surface、MCP spec が profile です。

### IdP capability matrix

すべての IdP が完全な MCP profile を support するわけではありません。下の matrix は 2025-11-25 spec 時点の factual capability statements を document します。これは recommendation ではなく *deployment gate* です。

| IdP category | RFC 8414 metadata | RFC 7591 DCR | RFC 8707 resource | RFC 7636 S256 PKCE | Notes |
|---|---|---|---|---|---|
| Self-hosted (Keycloak) | yes | yes | yes (since 24.x) | yes | この lesson での MCP profile の reference IdP。すべての RFC を end-to-end に support する。 |
| Enterprise SSO (Microsoft Entra ID) | yes | yes (premium tiers) | yes | yes | DCR availability は tenant tier によって異なる。Deploy 前に target tenant で確認する。 |
| Enterprise SSO (Okta) | yes | yes (Okta CIC / Auth0) | yes | yes | DCR は Auth0 (now Okta CIC) で利用可能。Classic Okta orgs は admin pre-registration が必要。 |
| Social login IdPs (generic) | varies | rarely | rarely | yes | 多くの social IdP は client を static partner として扱う。DCR に依存しないこと。Identity source としてだけ使い、その上に MCP-aware authorization server を layer する。 |
| Custom / homegrown | depends | depends | depends | depends | 自前で出荷するなら full profile を出荷する。上記 4 RFC のどれか 1 つを省略すると MCP auth contract が壊れる。 |

Deployment manifest の refusal rule: 選択した IdP が `registration_endpoint` を返さず、`code_challenge_methods_supported` に `S256` を listed していない場合、MCP server は start を拒否します。Degraded mode はありません。

### iii を使った JWKS rotation pattern

Production failure mode は stale JWKS cache です。Cron trigger と `state::*` cache で解きます。

```python
iii.registerTrigger(
    "cron",
    {"schedule": "0 */6 * * *", "name": "auth::jwks-refresh"},
    "auth::rotate-jwks",
)
```

6 時間ごとに cron trigger が `auth::rotate-jwks` を呼び、`<issuer>/.well-known/jwks.json` を fetch して、`state::set("auth/jwks/<issuer>", {keys, fetched_at})` に書きます。Validator は `state::get` から読みます。Cache にない `kid` を持つ token は、fall-back として同期的な `auth::rotate-jwks` call を trigger します。これにより scheduled rotation (cron) と key-overlap windows (synchronous fall-back) の 2 ケースを同時に扱えます。

State shape:

```json
{
  "auth/jwks/https://auth.example.com": {
    "keys": [
      {"kid": "k_2026_03", "kty": "RSA", "n": "...", "e": "AQAB", "alg": "RS256", "use": "sig"},
      {"kid": "k_2026_04", "kty": "RSA", "n": "...", "e": "AQAB", "alg": "RS256", "use": "sig"}
    ],
    "fetched_at": 1772668800
  }
}
```

同時に 2 つの key がある状態が steady state です。Authorization server は next key (`k_2026_04`) を導入してから previous key (`k_2026_03`) を retire することで rotate します。そのため、old key で発行された token は expire まで有効です。Cache は union を保持し、validator は `kid` で選びます。

### iii primitive wiring (この lesson の本題)

5 つの primitive が auth surface を構成します。

```python
# 1. RFC 8414 metadata document
iii.registerTrigger(
    "http",
    {"path": "/.well-known/oauth-authorization-server", "method": "GET"},
    "auth::serve-asm",
)

# 2. RFC 7591 dynamic client registration
iii.registerTrigger(
    "http",
    {"path": "/register", "method": "POST"},
    "auth::register-client",
)

# 3. JWT validation as a callable function (the resource server triggers it)
iii.registerFunction("auth::validate-jwt", validate_jwt_handler)

# 4. Step-up issuance for incremental scope (SEP-835 from L16)
iii.registerFunction("auth::issue-step-up", issue_step_up_handler)

# 5. Cron-driven JWKS rotation
iii.registerTrigger(
    "cron",
    {"schedule": "0 */6 * * *"},
    "auth::rotate-jwks",
)
iii.registerFunction("auth::rotate-jwks", rotate_jwks_handler)
```

MCP server 自体は validation を直接呼びません。次のようにします。

```python
result = iii.trigger("auth::validate-jwt", {"token": bearer_token, "resource": self.resource})
if not result["valid"]:
    return {"status": 401, "WWW-Authenticate": result["www_authenticate"]}
```

この indirection が iii の賭けです。明日 validator を、2 つの IdP に parallel consult する fanout に交換したり、span emitter を追加したり、positive validation を cache したりできます。MCP server は変わりません。

### Audience binding による confused-deputy walkthrough

Server A (`notes.example.com`) と Server B (`tasks.example.com`) は同じ authorization server に登録されています。Server A が compromise されました。Attacker は user の notes token を取り、Server B に replay します。

Server B の validator:

1. JWT を decode し、`kid` で JWKS を fetch し、signature を verify する。
2. `iss` を protected-resource metadata の `authorization_servers` と照合する。(Pass — same IdP.)
3. `aud == "https://tasks.example.com"` を確認する。(Fail — token の `aud` は `https://notes.example.com`。)
4. `WWW-Authenticate: Bearer error="invalid_token", error_description="audience mismatch"` 付き 401 を返す。

Audience claim は、この攻撃に対する protocol layer の唯一の防御です。Performance のために省略することが最も一般的な production mistake です。Validator は session start だけではなく、すべての request で実行されなければなりません。

### Failure modes

- **Stale JWKS。** Key rotation 後、validator が有効な token を拒否する。Fix は上の cron+fall-back pattern。Refresh job なしに JWKS を cache してはいけない。
- **Missing `aud` claim。** 一部の IdP は token request に `resource` がない限り、default で `aud` を省略する。Validator は `aud` missing token を reject し、absence を wildcard として扱ってはいけない。
- **Scope upgrade race。** 同じ user に対する 2 つの concurrent step-up flow が両方成功し、scope の異なる 2 つの access token を生成することがある。Validator は request で提示された token を使わなければならない。"user's current scope" を lookup すると TOCTOU window が生まれる。
- **Registration token theft。** Leaked `registration_access_token` により attacker は redirect URI を書き換えられる。At rest では hash 化し、update ごとに client に cleartext を提示させ、疑わしい場合は rotate する。
- **`iss` not pinned。** 任意の `iss` を受け入れる validator では、attacker が自分の authorization server を立て、target audience 用 client を登録し、token を発行できる。Protected-resource metadata の `authorization_servers` list が allow-list であり、これを強制する。

## 使ってみる

`code/main.py` は、stdlib Python と小さな `iii_mock` registry で full production flow をたどります。`iii_mock` は `iii.registerFunction`、`iii.registerTrigger`、`iii.trigger`、`state::set/get` をまねます。Flow:

1. Authorization server が RFC 8414 metadata を `/.well-known/oauth-authorization-server` で公開する。
2. MCP client が metadata endpoint を呼び、registration endpoint を discovery する。
3. MCP client が `/register` (RFC 7591) に post し、`client_id` を受け取る。
4. MCP client が `resource` indicator (RFC 8707) 付きの PKCE-protected authorization code flow (RFC 7636) を実行する。
5. MCP client が `Authorization: Bearer ...` で MCP server の tool を呼ぶ。
6. MCP server が `auth::validate-jwt` を trigger し、これは `state::get` から JWKS を読む。
7. Cron trigger が `auth::rotate-jwks` を fire し、state 内の JWKS を置き換える。
8. 次の call は restart なしで new keys に対して validate される。
9. 別の MCP resource への confused-deputy attempt は、audience mismatch 付き 401 になる。

ここでの mock JWT は HS256 と shared secret を使います (lesson を stdlib only で動かすため)。Production は上の JWKS pattern とともに RS256 または EdDSA を使います。Validation logic はそれ以外同じです。

## 出荷物

このレッスンは `outputs/skill-mcp-auth-iii.md` を生成します。MCP server config と IdP capability set が与えられると、この skill は登録する iii primitives、JWKS rotation schedule、scope mapping、IdP が full RFC profile を support しない場合に適用する refusal rules を emit します。

## 演習

1. `code/main.py` を実行する。9-step flow をたどる。`auth::rotate-jwks` が上書きする直前に `state::get` が stale data を返す位置と、次の request が new key に対して validate される仕組みを確認する。

2. Protected-resource metadata の `authorization_servers` list に新しい IdP を追加する。新しい IdP で署名した token を発行し、validator が受け入れることを確認する。Listed されていない IdP で署名した token を発行し、validator が `WWW-Authenticate: Bearer error="invalid_token", error_description="iss not allowed"` で拒否することを確認する。

3. `auth::rate-limit` を iii function として実装し、registrar が走る前に registration HTTP trigger の中から呼ぶ。`state::set("auth/ratelimit/<ip>", ...)` に保持する source IP ごとの token-bucket を使う。

4. RFC 7591 を読み、この lesson の `/register` handler が validate していない field を 2 つ特定する。Validation を追加する。(Hint: `software_statement` と `redirect_uris` URI scheme。)

5. MCP spec 2025-11-25 authorization section を読む。この lesson の validator が現在 emit していない `WWW-Authenticate` headers に関する normative requirement を 1 つ見つける。それを追加する。

## 重要用語

| Term | よく言われること | 実際の意味 |
|------|------------------|------------|
| ASM | "OAuth metadata document" | RFC 8414 `/.well-known/oauth-authorization-server` JSON |
| DCR | "Self-service client registration" | RFC 7591 `POST /register` flow |
| JWKS | "Public keys for JWT validation" | `jwks_uri` から取得し、`kid` で index する JSON Web Key Set |
| Resource indicator | "Audience parameter" | Token を 1 つの server に固定する RFC 8707 `resource` parameter |
| `aud` claim | "Audience" | Validator が canonical resource URL と比較する JWT claim |
| Confused deputy | "Token replay" | Server A 向けに発行された token が Server B に提示される攻撃 |
| `iss` allow-list | "Trusted authorization servers" | Protected-resource metadata の `authorization_servers` に named された set |
| Key rotation | "Rolling JWKS" | Overlap windows を伴う signing key の periodic replacement |
| Public client | "Native or browser client" | `client_secret` を持たない OAuth client。PKCE が補う |
| `WWW-Authenticate` | "401/403 response header" | Client recovery を駆動する `Bearer error=...` directives を運ぶ |

## 参考資料

- [MCP — Authorization spec (2025-11-25)](https://modelcontextprotocol.io/specification/draft/basic/authorization) — この lesson が実装する MCP auth profile
- [RFC 8414 — OAuth 2.0 Authorization Server Metadata](https://datatracker.ietf.org/doc/html/rfc8414) — discovery contract
- [RFC 7591 — OAuth 2.0 Dynamic Client Registration Protocol](https://datatracker.ietf.org/doc/html/rfc7591) — DCR
- [RFC 7636 — Proof Key for Code Exchange (PKCE)](https://datatracker.ietf.org/doc/html/rfc7636) — public-client proof-of-possession
- [RFC 8707 — Resource Indicators for OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc8707) — audience pinning
- [RFC 9728 — OAuth 2.0 Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728) — resource server discovery
- [OAuth 2.1 draft](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1) — consolidated OAuth substrate
