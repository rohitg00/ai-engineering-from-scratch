# MCP Auth 上生产 —— 在 iii 原语上实现 DCR、JWKS 轮换与 audience 绑定 token

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 第 16 课在内存里跑通了 OAuth 2.1 状态机。到 2026 年，每个真正交付给企业的 MCP 服务器背后都得有一套生产级 auth：dynamic client registration（动态客户端注册，RFC 7591）、authorization-server metadata discovery（授权服务器元数据发现，RFC 8414）、能熬过凌晨 3 点 token 校验的 JWKS 轮换，以及 audience 绑定（audience-pinned）的 token，拒绝 confused-deputy（混淆代理）式重放。本课把这些全部接到 iii 原语上 —— 用 `iii.registerTrigger` 注册 HTTP 与 cron 触发器、用 `iii.registerFunction` 注册 auth 逻辑、用 `state::set/get` 缓存密钥 —— 这样整个 auth 表面就和引擎里其它工作负载一样可观测、可重启、可重放。

**Type:** Build
**Languages:** Python（标准库，本课环境里 iii 原语是 mock 实现）
**Prerequisites:** Phase 13 · 16（OAuth 2.1 状态机）、Phase 13 · 17（gateways）
**Time:** ~90 分钟

## 学习目标（Learning Objectives）

- 通过 RFC 8414 元数据发现 authorization server，并校验契约。
- 实现 RFC 7591 动态客户端注册，让 MCP 客户端无需管理员介入即可入网。
- 用 cron 触发器缓存并轮换 JWKS 密钥，让签名验证能熬过密钥滚动。
- 用 RFC 8707 resource indicator 把 token 绑定到单一 MCP resource，拒绝 confused-deputy 重放。
- 把所有 endpoint 与后台任务都接成 iii 原语 —— HTTP triggers、cron triggers、命名 function、`state::*` 读取 —— 这样一次重启就能重建整个 auth 表面。
- 读懂 IdP 能力矩阵；当 IdP 无法满足 MCP 的 auth profile 时，拒绝部署。

## 问题（The Problem）

第 16 课的模拟器在内存里跑 OAuth 2.1。生产环境有三个仅靠内存模拟器看不到的运维缺口。

第一个缺口是 **入网（enrollment）**。一个真正的组织内部跑着上百个 MCP 服务器、上千个 MCP 客户端。运维不可能手动把每个 Cursor 用户都注册成一个 OAuth client。RFC 7591 动态客户端注册让 client 直接 `POST /register` 到 authorization server，当场拿到 `client_id`（以及可选的 `client_secret`）。server 在 RFC 8414 元数据里发布 `registration_endpoint`，client 不需要任何带外配置就能发现它。

第二个缺口是 **密钥轮换**。JWT 校验依赖 authorization server 的签名密钥，密钥以 JSON Web Key Set（JWKS）的形式发布。authorization server 会定期轮换这些密钥（通常每小时一次，事件响应时甚至更快）。如果 MCP 服务器在启动时只 fetch 一次 JWKS，那么校验在轮换窗口前都没问题 —— 一进入轮换窗口，每个请求都失败，直到重启。生产做法是把 JWKS 缓存起来，配上一个刷新任务，在旧密钥过期前覆盖缓存；再加一个 cache miss 时的兜底 fetch，处理签名密钥比缓存还新的 token。

第三个缺口是 **audience 绑定**。第 16 课介绍了 RFC 8707 resource indicator。在生产里，这个 indicator 在每个请求上都变成一个硬性 claim 检查。MCP 服务器把 `token.aud` 跟自身规范的 resource URL 比对，不一致就回 HTTP 401。在同一个信任网格里，这是抵御「上游 MCP 服务器（或者持有发给某个 server 的 token 的恶意 client）把这个 token 重放给另一个 server」的唯一防线。

本课把每一个缺口都当成一个 iii 原语来处理。元数据文档是一个 HTTP trigger，返回某个 function 的输出。JWKS 轮换是一个 cron trigger，调用 `auth::rotate-jwks`，写到 `state::set("auth/jwks/<issuer>", ...)`。JWT 校验是一个 function，别人通过 `iii.trigger("auth::validate-jwt", token)` 调用它。MCP 服务器本身不过是另一个 HTTP trigger，在分发之前先调一次校验。重启引擎：trigger 注册表会重建，state 还在，整个 auth 表面无需手工对账即可恢复运行。

## 概念（The Concept）

### RFC 8414 —— OAuth Authorization Server 元数据

`/.well-known/oauth-authorization-server` 这个文档描述了 client 需要的一切：

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

拿到一个 MCP resource URL 的 client 走的是链式发现：先取 RFC 9728 的 `oauth-protected-resource`（resource server 的文档），从中拿到 issuer，再取 `oauth-authorization-server`（也就是这个 RFC），从中拿到所有 endpoint。client 永远不会硬编码 authorization URL。

把 IdP 接入 MCP 之前必须验证的契约：

- `code_challenge_methods_supported` 包含 `S256`（按 RFC 7636 实施 PKCE）。
- `grant_types_supported` 包含 `authorization_code`，并拒绝 `password` 与 `implicit`。
- `registration_endpoint` 存在（即支持 RFC 7591）。
- `response_types_supported` 严格等于 `["code"]`，符合 OAuth 2.1。

只要少一项，MCP 服务器就拒绝在这个 IdP 上部署。错的是部署清单，不是代码。

### RFC 9728（回顾）—— Protected Resource 元数据

第 16 课讲过 RFC 9728。生产环境的差别在于：这个文档是 client 寻找「*这个* MCP 服务器信任哪些 authorization server」的唯一入口。一个 MCP 服务器可以接受来自多个 IdP 的 token（一个给员工，一个给合作伙伴）。RFC 9728 声明这个集合，RFC 8414 描述每个 IdP 各自支持什么。

```json
{
  "resource": "https://notes.example.com",
  "authorization_servers": ["https://auth.example.com", "https://partners.example.com"],
  "scopes_supported": ["mcp:tools.invoke"],
  "bearer_methods_supported": ["header"],
  "resource_documentation": "https://notes.example.com/docs"
}
```

### RFC 7591 —— 动态客户端注册（Dynamic Client Registration）

没有 DCR 时，每个 MCP 客户端（Cursor、Claude Desktop、自定义 agent）都得跟 IdP 管理员做一次带外交互。有了 DCR，client 直接 POST：

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

server 返回一个 `client_id`，外加用于后续更新的 `registration_access_token`：

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

`token_endpoint_auth_method: none` 是跑在用户设备上的 MCP 客户端的合理默认 —— 它们只拿 `client_id`，没有可被外泄的 `client_secret`。public client 需要的 proof-of-possession 由 PKCE 提供。

三个生产级坑：

- 注册端点必须按源 IP 限速。否则恶意方可以脚本化跑出几百万次假注册，把 `client_id` 命名空间打爆。iii 让这事很简单：注册 HTTP trigger 在分发到注册器之前先调一个 `auth::rate-limit` function。
- 部分企业 IdP 要求 `software_statement`（一个为 client 背书的签名 JWT）。本课的 mock 跳过它，生产里要接一道校验：除了 localhost 重定向 URI 之外，未签名的注册一律拒绝。
- `registration_access_token` 必须以哈希形式存储，不能存明文。这个 token 一旦泄露，攻击者就能改写 client 的 redirect URIs。

### RFC 8707（回顾）—— Resource Indicators

第 16 课确立了形式。生产规则：每次 token 请求都带上 `resource=<canonical-mcp-url>`，MCP 服务器在每次调用时校验 `token.aud` 是否匹配自身的 resource URL。如果 MCP 服务器在 `https://notes.example.com/mcp` 可达，那么规范 URL 是 `https://notes.example.com` —— 路径部分被排除在外，这样同一个 server 可以在同一个 audience 下托管多条路径。

### RFC 7636（回顾）—— PKCE

PKCE 在 OAuth 2.1 里是强制的。本课的 authorization-code flow 始终携带 `code_challenge` 与 `code_verifier`。任何不带 verifier，或 verifier 哈希后与已存 challenge 不一致的 token 请求，server 都拒绝。

### MCP Spec 2025-11-25 Auth Profile

MCP spec（2025-11-25）对 MCP 服务器授权层必须做什么有明确规定：

- 发布 `/.well-known/oauth-protected-resource`（RFC 9728）。
- 仅通过 `Authorization: Bearer ...` 接收 token。
- 在每个请求上校验 `aud`、`iss`、`exp` 与所需 scope。
- 每个 401 与 403 响应都要带 `WWW-Authenticate`，里面是 `Bearer error=...`，必要时还要带上 `scope=` 与 `resource=` 参数。
- 拒绝 `aud` 与规范 resource 不匹配的 token。
- 拒绝 `iss` 不在 protected-resource 元数据 `authorization_servers` 列表中的 token。

OAuth 2.1 草案是底层基础；RFC 8414/7591/8707/9728 + RFC 7636 是表面接口；MCP spec 是 profile。

### IdP 能力矩阵

并非所有 IdP 都支持完整 MCP profile。下表记录的是截至 2025-11-25 spec 时的事实性能力声明。这是一张 *部署门禁*，不是推荐表。

| IdP 类别 | RFC 8414 元数据 | RFC 7591 DCR | RFC 8707 resource | RFC 7636 S256 PKCE | 备注 |
|---|---|---|---|---|---|
| 自托管（Keycloak） | 是 | 是 | 是（24.x 起） | 是 | 本课 MCP profile 的参考 IdP；端到端支持每一份 RFC。 |
| 企业 SSO（Microsoft Entra ID） | 是 | 是（高级层级） | 是 | 是 | DCR 是否可用因 tenant 层级而异，部署前请在目标 tenant 验证。 |
| 企业 SSO（Okta） | 是 | 是（Okta CIC / Auth0） | 是 | 是 | DCR 在 Auth0（现 Okta CIC）上可用；经典 Okta org 仍要求管理员预注册。 |
| 社交登录 IdP（通用） | 视情况 | 通常没有 | 通常没有 | 是 | 多数社交 IdP 把 client 当作静态合作方，不要指望 DCR。仅作为身份源使用，在其上叠一层自己的 MCP-aware authorization server。 |
| 自研 / 自家搭建 | 看实现 | 看实现 | 看实现 | 看实现 | 如果是自家发布的，就得发布完整 profile。上面四份 RFC 缺任何一份都会破坏 MCP auth 契约。 |

部署清单的拒绝规则：如果选定的 IdP 没有返回 `registration_endpoint`，或者没有在 `code_challenge_methods_supported` 中列出 `S256`，那 MCP 服务器拒绝启动。没有降级模式。

### 用 iii 实现 JWKS 轮换模式

生产中最常见的故障模式是 JWKS 缓存过期。用一个 cron trigger 加一份 `state::*` 缓存来解决：

```python
iii.registerTrigger(
    "cron",
    {"schedule": "0 */6 * * *", "name": "auth::jwks-refresh"},
    "auth::rotate-jwks",
)
```

每六小时，cron trigger 调一次 `auth::rotate-jwks`，它去 fetch `<issuer>/.well-known/jwks.json`，再写到 `state::set("auth/jwks/<issuer>", {keys, fetched_at})`。validator 从 `state::get` 读取。如果某个 token 的 `kid` 不在缓存里，会同步触发一次 `auth::rotate-jwks` 兜底。这样同时覆盖两个场景：定期轮换（cron）与密钥重叠窗口（同步兜底）。

state 形状：

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

稳态下同时存在两把密钥。authorization server 通过先引入下一把密钥（`k_2026_04`）、再退役旧密钥（`k_2026_03`）的方式轮换，这样旧密钥签发的 token 在过期前仍然有效。缓存里存的是并集，validator 按 `kid` 选用。

### iii 原语接线（这才是这节课真正在讲的事）

整个 auth 表面由五个原语组成：

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

MCP 服务器自己永远不直接调校验，它做的是：

```python
result = iii.trigger("auth::validate-jwt", {"token": bearer_token, "resource": self.resource})
if not result["valid"]:
    return {"status": 401, "WWW-Authenticate": result["www_authenticate"]}
```

这层间接是 iii 押的注。明天你想把 validator 换成并行问询两个 IdP 的扇出，或者加一个 span 发射器，或者缓存通过的校验结果 —— MCP 服务器都不用改。

### 用 audience 绑定走一遍 confused-deputy

Server A（`notes.example.com`）和 Server B（`tasks.example.com`）都在同一个 authorization server 下注册。Server A 被入侵。攻击者拿到用户的 notes token，重放给 Server B。

Server B 的 validator：

1. 解码 JWT，按 `kid` fetch JWKS，验签。
2. 用自己 protected-resource 元数据里的 `authorization_servers` 校验 `iss`。（通过 —— 同一个 IdP。）
3. 校验 `aud == "https://tasks.example.com"`。（失败 —— token 的 `aud` 是 `https://notes.example.com`。）
4. 返回 401，附 `WWW-Authenticate: Bearer error="invalid_token", error_description="audience mismatch"`。

在协议层面，audience claim 是抵御这类攻击的唯一防线。为了性能跳过这一步是生产里最常见的失误 —— validator 必须在每个请求上跑，不能只在会话开始时跑一次。

### 故障模式

- **过期 JWKS。** 密钥轮换后 validator 拒绝合法 token。修法是上面的 cron + 兜底模式。永远不要在没有刷新任务的情况下缓存 JWKS。
- **缺失 `aud` claim。** 部分 IdP 默认在 token 请求里没有 `resource` 时不发 `aud`。validator 必须拒绝缺失 `aud` 的 token，不能把缺失当通配符处理。
- **scope 升级竞争。** 同一用户两条并发 step-up 流可能都成功，产出两条 scope 不同的 access token。validator 必须用请求上呈递的 token，而不是去查「该用户当前的 scope」—— 后者会开出一个 TOCTOU 窗口。
- **registration token 被盗。** 泄露的 `registration_access_token` 让攻击者改写 redirect URI。落盘哈希；要求 client 每次更新都呈递明文；可疑就轮换。
- **`iss` 没有锁定。** 接受任意 `iss` 的 validator 让攻击者可以自己起一个 authorization server，给目标 audience 注册一个 client，签发 token。protected-resource 元数据的 `authorization_servers` 列表是 allowlist（白名单），必须强制执行。

## 用起来（Use It）

`code/main.py` 用标准库 Python 加一个小型 `iii_mock` 注册表演示完整生产流程，mock 模拟了 `iii.registerFunction`、`iii.registerTrigger`、`iii.trigger` 与 `state::set/get`。流程：

1. authorization server 在 `/.well-known/oauth-authorization-server` 发布 RFC 8414 元数据。
2. MCP 客户端调用元数据端点，发现注册端点。
3. MCP 客户端 POST 到 `/register`（RFC 7591），拿到 `client_id`。
4. MCP 客户端跑 PKCE 保护的 authorization code flow（RFC 7636），带上 `resource` indicator（RFC 8707）。
5. MCP 客户端用 `Authorization: Bearer ...` 调 MCP 服务器上的一个工具。
6. MCP 服务器触发 `auth::validate-jwt`，validator 从 `state::get` 读 JWKS。
7. cron trigger 触发 `auth::rotate-jwks`，替换 state 里的 JWKS。
8. 下一次调用无需重启即可用新密钥校验。
9. 针对另一个 MCP resource 的 confused-deputy 尝试以 audience 不匹配收到 401。

这里的 mock JWT 用的是 HS256 + 共享密钥（这样本课只用标准库就能跑）。生产里用 RS256 或 EdDSA 配合上面的 JWKS 模式；除此之外校验逻辑完全一致。

## 上线部署（Ship It）

本课产出 `outputs/skill-mcp-auth-iii.md`。给定一份 MCP 服务器配置和 IdP 能力清单，这份 skill 会输出要注册的 iii 原语、JWKS 轮换排程、scope 映射，以及当 IdP 不支持完整 RFC profile 时要应用的拒绝规则。

## 练习（Exercises）

1. 跑 `code/main.py`。跟踪这 9 步流程。注意 `state::get` 在 `auth::rotate-jwks` 覆盖之前返回的是过期数据，以及下一个请求是怎么用新密钥通过校验的。

2. 在 protected-resource 元数据的 `authorization_servers` 列表里新增一个 IdP。签发一份新 IdP 签名的 token，确认 validator 接受；再签发一份未列出 IdP 签名的 token，确认 validator 用 `WWW-Authenticate: Bearer error="invalid_token", error_description="iss not allowed"` 拒绝。

3. 把 `auth::rate-limit` 实现成一个 iii function，在注册器跑之前由注册 HTTP trigger 调用它。用 `state::set("auth/ratelimit/<ip>", ...)` 维护一个按源 IP 计数的 token-bucket。

4. 读 RFC 7591，找出本课 `/register` handler 没有校验的两个字段，把校验补上。（提示：`software_statement` 和 `redirect_uris` 的 URI scheme。）

5. 读 MCP spec 2025-11-25 的授权章节。找出本课 validator 当前没有在 `WWW-Authenticate` header 里发出的那一条规范性要求，把它加上。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际是什么 |
|------|----------------|------------------------|
| ASM | 「OAuth 元数据文档」 | RFC 8414 `/.well-known/oauth-authorization-server` JSON |
| DCR | 「客户端自助注册」 | RFC 7591 `POST /register` 流程 |
| JWKS | 「用于 JWT 校验的公钥」 | JSON Web Key Set，从 `jwks_uri` fetch，按 `kid` 索引 |
| Resource indicator | 「audience 参数」 | RFC 8707 `resource` 参数，把 token 绑定到一台 server |
| `aud` claim | 「audience」 | JWT 中由 validator 与规范 resource URL 比对的 claim |
| Confused deputy（混淆代理） | 「token 重放」 | 把签发给 Server A 的 token 拿去递交给 Server B 的攻击 |
| `iss` allowlist（白名单） | 「受信任的 authorization server」 | protected-resource 元数据里 `authorization_servers` 所列的集合 |
| Key rotation（密钥轮换） | 「滚动 JWKS」 | 带重叠窗口地周期性替换签名密钥 |
| Public client | 「原生或浏览器 client」 | 没有 `client_secret` 的 OAuth client；由 PKCE 来弥补 |
| `WWW-Authenticate` | 「401/403 响应头」 | 携带 `Bearer error=...` 指令，引导 client 恢复 |

## 延伸阅读（Further Reading）

- [MCP — Authorization spec (2025-11-25)](https://modelcontextprotocol.io/specification/draft/basic/authorization) — 本课实现的 MCP auth profile
- [RFC 8414 — OAuth 2.0 Authorization Server Metadata](https://datatracker.ietf.org/doc/html/rfc8414) — 发现契约
- [RFC 7591 — OAuth 2.0 Dynamic Client Registration Protocol](https://datatracker.ietf.org/doc/html/rfc7591) — DCR
- [RFC 7636 — Proof Key for Code Exchange (PKCE)](https://datatracker.ietf.org/doc/html/rfc7636) — public client 的 proof-of-possession
- [RFC 8707 — Resource Indicators for OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc8707) — audience 绑定
- [RFC 9728 — OAuth 2.0 Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728) — resource server 发现
- [OAuth 2.1 draft](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1) — 整合后的 OAuth 基础底座
