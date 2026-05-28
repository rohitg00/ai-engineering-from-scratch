# MCP Security II — OAuth 2.1、Resource Indicators、Incremental Scopes

> リモート MCP server に必要なのは authentication だけではありません。authorization も必要です。2025-11-25 spec は OAuth 2.1 + PKCE + resource indicators (RFC 8707) + protected-resource metadata (RFC 9728) に揃えられました。SEP-835 は、403 WWW-Authenticate を受けたときに step-up authorization で incremental scope consent を追加します。このレッスンでは step-up flow を状態機械として実装し、すべての遷移を見えるようにします。

**種別:** 構築
**言語:** Python (stdlib、OAuth 状態機械シミュレーター)
**前提条件:** Phase 13 · 09 (transports), Phase 13 · 15 (security I)
**所要時間:** 約75分

## 学習目標

- Resource server と authorization server の責務を区別する。
- PKCE で保護された OAuth 2.1 authorization code flow をたどる。
- `resource` (RFC 8707) と protected-resource metadata (RFC 9728) を使い、confused-deputy 攻撃を防ぐ。
- Step-up authorization を実装する。server はより高い scope を求める WWW-Authenticate 付き 403 で応答し、client は user consent を再提示してリトライする。

## 問題

初期の MCP (2025 年以前) のリモート server は、場当たり的な API key、場合によっては auth なしで提供されていました。2025-11-25 spec は、完全な OAuth 2.1 profile でその穴を閉じます。

現実には次の 3 つが必要になります。

- **通常のリモート server。** User が Notion / GitHub / Gmail にアクセスするリモート MCP server をインストールする。OAuth 2.1 with PKCE が適切な形です。
- **Scope escalation。** `notes:read` を付与された notes server が、特定の操作で後から `notes:write` を必要とすることがある。全 flow をやり直す代わりに、step-up (SEP-835) が追加 scope を求めます。
- **Confused deputy prevention。** Client は Server A 向け audience に scope された token を持っている。悪意ある Server A がその token を Server B に提示しようとする。Resource indicators (RFC 8707) は token を意図した audience に固定します。

OAuth 2.1 自体は新しいものではありません。新しいのは MCP の profile です。必須 flow が具体化され (authorization code + PKCE のみ、implicit なし、client credentials はデフォルトではなし)、すべての token request で resource indicators が必須になり、client が行き先を知るための protected-resource metadata が公開されます。

## コンセプト

### Roles

- **Client。** MCP client (Claude Desktop、Cursor など)。
- **Resource server。** MCP server (notes、GitHub、Postgres など)。
- **Authorization server。** Token を発行する。Resource server と同じ service でも、別の IdP (Auth0、Keycloak、Cognito) でもよい。

MCP の profile では、resource server と authorization server は同じ host でも構いませんが、URL では区別するべきです。

### Authorization code + PKCE

Flow は次の通りです。

1. Client が `code_verifier` (random) と `code_challenge` (SHA256) を生成する。
2. Client が user を `/authorize?response_type=code&client_id=...&redirect_uri=...&scope=notes:read&code_challenge=...&resource=https://notes.example.com` にリダイレクトする。
3. User が consent する。Authorization server は `redirect_uri?code=...` にリダイレクトする。
4. Client が `/token?grant_type=authorization_code&code=...&code_verifier=...&resource=...` に POST する。
5. Authorization server が、保存済み challenge に対して verifier の hash を検証し、access token を発行する。
6. Client は resource server への全リクエストで `Authorization: Bearer ...` として token を使う。

PKCE は authorization-code interception attack を防ぎます。Resource indicators は token が別の場所で有効になることを防ぎます。

### Protected-resource metadata (RFC 9728)

Resource server は `.well-known/oauth-protected-resource` document を公開します。

```json
{
  "resource": "https://notes.example.com",
  "authorization_servers": ["https://auth.example.com"],
  "scopes_supported": ["notes:read", "notes:write", "notes:delete"]
}
```

Client は resource server から authorization server を discovery します。これにより設定が減ります。Client が必要とするのは resource URL だけです。

### Resource indicators (RFC 8707)

Token request の `resource` parameter は、token の意図された audience を固定します。発行された token には `aud: "https://notes.example.com"` が入ります。別の MCP server がこの token を受け取った場合、`aud` を確認して拒否します。

### Scope model

Scope は space-separated strings です。よくある MCP conventions は次の通りです。

- `notes:read`, `notes:write`, `notes:delete`
- admin capability 用の `admin:*` (控えめに使う)
- identity 用の `profile:read`

Scope selection は least-privilege にするべきです。今必要なものだけを要求し、さらに必要になった時点で step up します。

### Step-up authorization (SEP-835)

User が `notes:read` を付与します。その後、agent に note の削除を頼みます。Server は次のように応答します。

```text
HTTP/1.1 403 Forbidden
WWW-Authenticate: Bearer error="insufficient_scope",
    scope="notes:delete", resource="https://notes.example.com"
```

Client は insufficient_scope error を見て、追加 scope への consent dialog を user に提示し、その scope 用の小さな OAuth flow を実行し、新しい token で request をリトライします。

### Token audience validation

すべての request で、server は `token.aud == self.resource_url` を確認します。不一致なら 401 です。これで server 間の token reuse を止めます。

### Short-lived tokens and rotation

Access tokens は short-lived にするべきです (default は 1 hour)。Refresh tokens は refresh のたびに rotate します。Client は background で silent refresh を処理します。

### No token passthrough

Sampling servers (Phase 13 · 11) は、client の token を他 service に渡してはいけません。Sampling request が境界です。

### Confused deputy prevention

Token は `aud` に bind されます。Client は `client_id` に bind されます。すべての request を両方に照らして検証します。Spec は、MCP 以前の remote tool ecosystem で一般的だった古い「pass-the-token」pattern を明示的に禁止しています。

### Client ID discovery

各 MCP client は、自分の metadata を固定 URL で公開します。Authorization server は client の metadata document を取得して、redirect URI と連絡先情報を discovery できます。これにより手動の client registration が不要になります。

### Gateways and OAuth

Phase 13 · 17 では、enterprise gateway が OAuth をどう扱うかを示します。Gateway は upstream server 用の credentials を保持し、client への token は gateway が発行し、upstream token は gateway の外に出ません。これにより trust model が反転します。User は gateway に一度 authenticate し、gateway が N 個の server authorization を処理します。

## 使ってみる

`code/main.py` は、OAuth 2.1 step-up flow 全体を状態機械としてシミュレートします。実装内容は次の通りです。

- PKCE code-verifier / challenge generation。
- Resource indicator 付き authorization code flow。
- Protected-resource metadata endpoint。
- Audience check 付き token validation。
- `insufficient_scope` による step-up。

このレッスンには HTTP server はありません。状態機械は memory 内で動くため、すべての遷移を追跡できます。Phase 13 · 17 の gateway lesson では、これを実際の transport に接続します。

## 出荷物

このレッスンは `outputs/skill-oauth-scope-planner.md` を生成します。Remote MCP server と tools が与えられると、この skill は scope set、pinning rules、step-up policy を設計します。

## 演習

1. `code/main.py` を実行する。2-scope の step-up flow をたどり、step-up でどの遷移が繰り返されるかを確認する。

2. Refresh-token rotation を追加する。Refresh のたびに新しい refresh token を発行し、古いものを無効化する。盗まれた refresh token が rotation 後に使われるケースをシミュレートし、失敗することを確認する。

3. Protected-resource metadata endpoint を、stdlib http.server を使った実際の HTTP response として実装する。Lesson 09 の /mcp endpoint をまねる。

4. GitHub MCP server 用の scope hierarchy を設計する: repo read、PR write、PR approve、PR merge、admin。各 level の間で step-up を使う。

5. RFC 8707 と RFC 9728 を読む。MCP が RFC の example と違う使い方をしている 9728 の field を 1 つ特定する。(Hint: `scopes_supported` に関係する。)

## 重要用語

| Term | よく言われること | 実際の意味 |
|------|------------------|------------|
| OAuth 2.1 | "Modern OAuth" | PKCE を必須にし、implicit flow を禁止する consolidated RFC |
| PKCE | "Proof-of-possession" | Authorization-code interception を防ぐ code verifier + challenge |
| Resource indicator | "Token audience" | Token を 1 つの server に固定する RFC 8707 `resource` parameter |
| Protected-resource metadata | "Discovery doc" | RFC 9728 `.well-known/oauth-protected-resource` |
| Step-up authorization | "Incremental consent" | 必要時に scope を追加する SEP-835 flow |
| `insufficient_scope` | "403 with WWW-Authenticate" | より大きい scope への再 consent を求める server signal |
| Confused deputy | "Token reuse across services" | 信頼された holder が token を不適切に転送する攻撃 |
| Short-lived token | "Access token TTL" | すぐ失効する bearer。Refresh token が更新する |
| Scope hierarchy | "Least privilege stack" | level 間で step-up する段階的な scope set |
| Client ID metadata | "Client discovery doc" | Client が自分の OAuth metadata を公開する URL |

## 参考資料

- [MCP — Authorization spec](https://modelcontextprotocol.io/specification/draft/basic/authorization) — 正典となる MCP OAuth profile
- [den.dev — MCP November authorization spec](https://den.dev/blog/mcp-november-authorization-spec/) — 2025-11-25 の変更点の walkthrough
- [RFC 8707 — Resource indicators for OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc8707) — audience-pinning RFC
- [RFC 9728 — OAuth 2.0 protected resource metadata](https://datatracker.ietf.org/doc/html/rfc9728) — discovery-document RFC
- [Aembit — MCP OAuth 2.1, PKCE and the future of AI authorization](https://aembit.io/blog/mcp-oauth-2-1-pkce-and-the-future-of-ai-authorization/) — 実践的な step-up-flow walkthrough
