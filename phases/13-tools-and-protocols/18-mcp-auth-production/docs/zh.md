# 18 · 生产环境中的 MCP 鉴权——基于 iii 原语的 DCR、JWKS 轮换与受众绑定令牌

> 第 16 课在内存中搭起了 OAuth 2.1 状态机。到 2026 年，你交付给真实组织的每一台 MCP 服务器都置于生产级鉴权之后：动态客户端注册（Dynamic Client Registration，RFC 7591）、授权服务器元数据发现（RFC 8414）、不会在凌晨三点搞砸令牌校验的 JWKS 轮换，以及拒绝「混淆代理（confused-deputy）」式复用的受众绑定（audience-pinned）令牌。本课把这一切都接入 iii 原语——用 `iii.registerTrigger` 处理 HTTP 与 cron，用 `iii.registerFunction` 承载鉴权逻辑，用 `state::set/get` 缓存密钥——从而让鉴权面像引擎中的其它工作负载一样可观测、可重启、可重放。

**类型：** 构建
**语言：** Python（标准库，iii 原语在本课环境中以 mock 形式提供）
**前置：** 第 13 阶段 · 16（OAuth 2.1 状态机）、第 13 阶段 · 17（网关）
**时长：** 约 90 分钟

## 学习目标

- 通过 RFC 8414 元数据发现授权服务器，并核验其契约。
- 实现 RFC 7591 动态客户端注册，使 MCP 客户端无需管理员介入即可登记。
- 用 cron 触发器缓存并轮换 JWKS 密钥，使签名校验能挺过密钥滚动更替。
- 用 RFC 8707 资源指示符（resource indicators）把令牌绑定到单一 MCP 资源，并拒绝混淆代理式复用。
- 把每个端点与后台任务都接成 iii 原语——HTTP 触发器、cron 触发器、命名函数与 `state::*` 读取——使单次重启即可重建整个鉴权面。
- 读懂身份提供方（IdP）能力矩阵，并在 IdP 无法满足 MCP 鉴权画像时拒绝部署。

## 问题所在

第 16 课的模拟器在内存中运行 OAuth 2.1。生产环境存在三处运行性缺口，是纯内存模拟器看不到的。

第一处缺口是登记。一个真实组织运行着数百台 MCP 服务器和数千个 MCP 客户端。运维人员不会逐个把每位 Cursor 用户手动注册为 OAuth 客户端。RFC 7591 动态客户端注册让客户端可以向授权服务器发起 `POST /register`，并当场获得 `client_id`（以及可选的 `client_secret`）。服务器在其 RFC 8414 元数据中发布 `registration_endpoint`；客户端无需带外配置即可发现它。

第二处缺口是密钥轮换。JWT 校验依赖授权服务器的签名密钥，这些密钥以 JSON Web 密钥集（JSON Web Key Set，JWKS）的形式发布。授权服务器按计划轮换它们（常常每小时一次，事件响应期间可能更快）。一台在启动时只拉取一次 JWKS 的 MCP 服务器，在轮换窗口到来之前校验都正常——之后每个请求都会失败，直到重启。生产环境把 JWKS 接成一个带刷新任务的缓存值，刷新任务会在旧密钥过期之前覆盖缓存；同时在缓存未命中时提供一次兜底拉取，以应对收到由比缓存更新的密钥所签发令牌的情况。

第三处缺口是受众绑定。第 16 课引入了 RFC 8707 资源指示符。在生产环境中，这个指示符会变成对每个请求的硬性声明（claim）检查。MCP 服务器把 `token.aud` 与自身的规范资源 URL 比对，不匹配则以 HTTP 401 拒绝。这是抵御以下情形的唯一防线：某个上游 MCP 服务器（或持有发给某台服务器的令牌的恶意客户端）将该令牌在同一信任网格中的另一台服务器上重放。

本课把上述每一处缺口都当作 iii 原语来处理。元数据文档是一个返回某函数输出的 HTTP 触发器。JWKS 轮换是一个调用 `auth::rotate-jwks` 的 cron 触发器，后者写入 `state::set("auth/jwks/<issuer>", ...)`。JWT 校验是一个供他人通过 `iii.trigger("auth::validate-jwt", token)` 调用的函数。MCP 服务器本身只是另一个 HTTP 触发器，它在分发之前先调用校验。重启引擎：触发器注册表得到重建；状态得以存续；鉴权面无需人工对账即可投入运行。

## 核心概念

### RFC 8414——OAuth 授权服务器元数据

位于 `/.well-known/oauth-authorization-server` 的文档描述了客户端所需的一切：

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

拿到 MCP 资源 URL 的客户端会链式发现：先从 RFC 9728 的 `oauth-protected-resource`（资源服务器的文档）中得知 issuer，再从（本 RFC 的）`oauth-authorization-server` 中得知每一个端点。客户端从不硬编码授权 URL。

在信任某个 IdP 用于 MCP 之前，你需要核验的契约：

- `code_challenge_methods_supported` 包含 `S256`（即 RFC 7636 定义的 PKCE）。
- `grant_types_supported` 包含 `authorization_code`，并拒绝 `password` 与 `implicit`。
- `registration_endpoint` 存在（支持 RFC 7591）。
- `response_types_supported` 对 OAuth 2.1 而言恰好是 `["code"]`。

只要其中任意一项缺失，MCP 服务器就拒绝针对该 IdP 部署。错的是部署清单（manifest），不是代码。

### RFC 9728（回顾）——受保护资源元数据

第 16 课讲过 RFC 9728。在生产中的增量在于：这份文档是客户端查找*此* MCP 服务器所信任的授权服务器的唯一去处。单台 MCP 服务器可以接受来自多个 IdP 的令牌（一个面向员工，一个面向合作伙伴）。RFC 9728 声明了这个集合；RFC 8414 记录了每个 IdP 支持什么。

```json
{
  "resource": "https://notes.example.com",
  "authorization_servers": ["https://auth.example.com", "https://partners.example.com"],
  "scopes_supported": ["mcp:tools.invoke"],
  "bearer_methods_supported": ["header"],
  "resource_documentation": "https://notes.example.com/docs"
}
```

### RFC 7591——动态客户端注册

没有 DCR，每个 MCP 客户端（Cursor、Claude Desktop、自定义代理）都需要与 IdP 管理员进行一次带外交换。有了 DCR，客户端只需发起：

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

服务器返回 `client_id`，以及用于后续更新的 `registration_access_token`：

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

对于运行在用户设备上的 MCP 客户端，`token_endpoint_auth_method: none` 是正确的默认值。它们只拿到 `client_id`——没有可被窃取的 `client_secret`。PKCE 为公开客户端（public client）提供了所需的持有证明（proof-of-possession）。

三个生产陷阱：

- 注册端点必须按源 IP 进行限流。否则，敌对方会脚本化地发起数百万次伪造注册，耗尽 `client_id` 命名空间。iii 让这件事变得轻而易举：注册 HTTP 触发器在分发给注册器之前先调用一个 `auth::rate-limit` 函数。
- 某些企业 IdP 要求提供 `software_statement`（一个为客户端背书的已签名 JWT）。本课的 mock 跳过了它；生产环境会接入一个校验步骤，对除 localhost 重定向 URI 以外、来自任何来源的未签名注册予以拒绝。
- `registration_access_token` 必须以哈希形式存储，而非明文。一旦该令牌被盗，攻击者就能改写客户端的重定向 URI。

### RFC 8707（回顾）——资源指示符

第 16 课确立了其形态。生产规则是：每次令牌请求都包含 `resource=<canonical-mcp-url>`，且 MCP 服务器在每次调用时核验 `token.aud` 与自身资源 URL 匹配。如果 MCP 服务器可在 `https://notes.example.com/mcp` 访问，那么规范 URL 是 `https://notes.example.com`——路径部分被排除在外，这样单台服务器就能在同一受众下托管多条路径。

### RFC 7636（回顾）——PKCE

PKCE 在 OAuth 2.1 中是强制的。本课的授权码流程始终携带 `code_challenge` 与 `code_verifier`。服务器会拒绝任何没有 verifier、或 verifier 哈希结果与所存 challenge 不符的令牌请求。

### MCP 规范 2025-11-25 鉴权画像

MCP 规范（2025-11-25）对 MCP 服务器鉴权层必须做到的事给出了精确规定：

- 发布 `/.well-known/oauth-protected-resource`（RFC 9728）。
- 仅通过 `Authorization: Bearer ...` 接受令牌。
- 在每个请求上校验 `aud`、`iss`、`exp` 与所需 scope。
- 对每个 401 和 403 都以携带 `Bearer error=...` 的 `WWW-Authenticate` 响应，在适用处包含 `scope=` 与 `resource=` 参数。
- 拒绝其 `aud` 与规范资源不匹配的令牌。
- 拒绝其 `iss` 不在受保护资源元数据 `authorization_servers` 列表中的令牌。

OAuth 2.1 草案是基底；RFC 8414/7591/8707/9728 加上 RFC 7636 是表面；MCP 规范是画像。

### IdP 能力矩阵

并非每个 IdP 都支持完整的 MCP 画像。下表记录的是截至 2025-11-25 规范的事实性能力陈述。它是一道*部署闸门*，而非推荐。

| IdP 类别 | RFC 8414 元数据 | RFC 7591 DCR | RFC 8707 资源 | RFC 7636 S256 PKCE | 备注 |
|---|---|---|---|---|---|
| 自托管（Keycloak） | 支持 | 支持 | 支持（自 24.x 起） | 支持 | 本课中 MCP 画像的参考 IdP；端到端支持每一项 RFC。 |
| 企业 SSO（Microsoft Entra ID） | 支持 | 支持（高级套餐） | 支持 | 支持 | DCR 是否可用因租户套餐而异；部署前请在目标租户中核实。 |
| 企业 SSO（Okta） | 支持 | 支持（Okta CIC / Auth0） | 支持 | 支持 | DCR 在 Auth0（现 Okta CIC）上可用；传统 Okta 组织需要管理员预注册。 |
| 社交登录 IdP（通用） | 不一定 | 很少 | 很少 | 支持 | 多数社交 IdP 把客户端视作静态合作伙伴；不要依赖其 DCR。仅作为身份来源使用，并在其上叠加你自己的、感知 MCP 的授权服务器。 |
| 自定义 / 自研 | 视情况 | 视情况 | 视情况 | 视情况 | 如果你自己交付，就交付完整画像。略过上述四项 RFC 中的任意一项都会破坏 MCP 鉴权契约。 |

部署清单的拒绝规则：如果所选 IdP 不返回 `registration_endpoint`，且未在 `code_challenge_methods_supported` 中列出 `S256`，则 MCP 服务器拒绝启动。没有降级模式。

### 基于 iii 的 JWKS 轮换模式

生产环境的故障模式是 JWKS 缓存过期。用一个 cron 触发器加一个 `state::*` 缓存来解决它：

```python
iii.registerTrigger(
    "cron",
    {"schedule": "0 */6 * * *", "name": "auth::jwks-refresh"},
    "auth::rotate-jwks",
)
```

每六小时，cron 触发器调用 `auth::rotate-jwks`，后者拉取 `<issuer>/.well-known/jwks.json` 并写入 `state::set("auth/jwks/<issuer>", {keys, fetched_at})`。校验器从 `state::get` 读取。若某令牌的 `kid` 在缓存中缺失，则会触发一次同步的 `auth::rotate-jwks` 调用作为兜底。这一举处理了两种情况：计划性轮换（cron）与密钥重叠窗口（同步兜底）。

状态形态：

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

同时持有两个密钥是稳态。授权服务器轮换时会先引入下一个密钥（`k_2026_04`），再退役上一个（`k_2026_03`），因此在旧密钥下签发的令牌在过期之前仍然有效。缓存持有二者的并集；校验器按 `kid` 选取。

### iii 原语接线（本课真正要讲的部分）

五个原语组合出整个鉴权面：

```python
# 1. RFC 8414 元数据文档
iii.registerTrigger(
    "http",
    {"path": "/.well-known/oauth-authorization-server", "method": "GET"},
    "auth::serve-asm",
)

# 2. RFC 7591 动态客户端注册
iii.registerTrigger(
    "http",
    {"path": "/register", "method": "POST"},
    "auth::register-client",
)

# 3. 作为可调用函数的 JWT 校验（资源服务器触发它）
iii.registerFunction("auth::validate-jwt", validate_jwt_handler)

# 4. 面向增量 scope 的升级签发（来自 L16 的 SEP-835）
iii.registerFunction("auth::issue-step-up", issue_step_up_handler)

# 5. cron 驱动的 JWKS 轮换
iii.registerTrigger(
    "cron",
    {"schedule": "0 */6 * * *"},
    "auth::rotate-jwks",
)
iii.registerFunction("auth::rotate-jwks", rotate_jwks_handler)
```

MCP 服务器本身从不直接调用校验。它这样做：

```python
result = iii.trigger("auth::validate-jwt", {"token": bearer_token, "resource": self.resource})
if not result["valid"]:
    return {"status": 401, "WWW-Authenticate": result["www_authenticate"]}
```

这层间接正是 iii 的赌注。明天你把校验器换成一个并行咨询两个 IdP 的扇出（fanout），或者加上一个 span 发射器，或者缓存正向校验结果。MCP 服务器都无需改动。

### 受众绑定下的混淆代理演练

服务器 A（`notes.example.com`）和服务器 B（`tasks.example.com`）都向同一个授权服务器注册。服务器 A 被攻陷。攻击者拿走某用户的 notes 令牌，并在服务器 B 上重放它。

服务器 B 的校验器：

1. 解码 JWT，按 `kid` 拉取 JWKS，校验签名。
2. 用自身受保护资源元数据的 `authorization_servers` 检查 `iss`。（通过——同一个 IdP。）
3. 检查 `aud == "https://tasks.example.com"`。（失败——令牌的 `aud` 是 `https://notes.example.com`。）
4. 返回 401，附带 `WWW-Authenticate: Bearer error="invalid_token", error_description="audience mismatch"`。

在协议层，受众声明是抵御此类攻击的唯一防线。为了性能而略过它是最常见的生产错误；校验器必须在每个请求上运行，而不只是在会话开始时。

### 故障模式

- **JWKS 过期。** 密钥轮换后校验器拒绝有效令牌。修复办法就是上文的 cron + 兜底模式。绝不要在没有刷新任务的情况下缓存 JWKS。
- **缺失 `aud` 声明。** 某些 IdP 在令牌请求中不含 `resource` 时默认省略 `aud`。校验器必须拒绝缺失 `aud` 的令牌，而不能把缺失当作通配符。
- **scope 升级竞态。** 针对同一用户的两个并发升级流程可能都成功，产出两个 scope 不同的访问令牌。校验器必须使用请求中所携带的令牌，而非去查询「该用户当前的 scope」——后者会制造一个 TOCTOU 窗口。
- **注册令牌被盗。** 泄露的 `registration_access_token` 让攻击者得以改写重定向 URI。把它们静态哈希存储；要求客户端在每次更新时出示明文；一旦怀疑即轮换。
- **`iss` 未绑定。** 接受任意 `iss` 的校验器，会让攻击者得以架起自己的授权服务器、为目标受众注册客户端并签发令牌。受保护资源元数据的 `authorization_servers` 列表就是白名单；务必强制执行它。

## 动手用

`code/main.py` 用标准库 Python 和一个小型 `iii_mock` 注册表走完整套生产流程，该注册表模拟了 `iii.registerFunction`、`iii.registerTrigger`、`iii.trigger` 以及 `state::set/get`。流程如下：

1. 授权服务器在 `/.well-known/oauth-authorization-server` 发布 RFC 8414 元数据。
2. MCP 客户端调用元数据端点，发现注册端点。
3. MCP 客户端向 `/register` 发起请求（RFC 7591），收到 `client_id`。
4. MCP 客户端运行受 PKCE 保护的授权码流程（RFC 7636），携带 `resource` 指示符（RFC 8707）。
5. MCP 客户端用 `Authorization: Bearer ...` 调用 MCP 服务器上的某个工具。
6. MCP 服务器触发 `auth::validate-jwt`，后者从 `state::get` 读取 JWKS。
7. cron 触发器触发 `auth::rotate-jwks`，替换 state 中的 JWKS。
8. 下一次调用在无需重启的情况下针对新密钥完成校验。
9. 针对另一 MCP 资源的混淆代理尝试因受众不匹配而得到 401。

此处的 mock JWT 使用带共享密钥的 HS256（以便本课仅凭标准库即可运行）。生产环境使用 RS256 或 EdDSA 配合上文的 JWKS 模式；除此之外校验逻辑完全一致。

## 交付物

本课产出 `outputs/skill-mcp-auth-iii.md`。给定一份 MCP 服务器配置与一组 IdP 能力，该技能会输出需要注册的 iii 原语、JWKS 轮换计划、scope 映射，以及在 IdP 不支持完整 RFC 画像时应施加的拒绝规则。

## 练习

1. 运行 `code/main.py`。追踪这 9 步流程。注意 `state::get` 在 `auth::rotate-jwks` 覆盖它之前的那一刻返回了过期数据，以及下一个请求如何随即针对新密钥完成校验。

2. 往受保护资源元数据的 `authorization_servers` 列表里加入一个新的 IdP。签发一个由新 IdP 签名的令牌，确认校验器接受它。再签发一个由未列入名单的 IdP 签名的令牌，确认校验器以 `WWW-Authenticate: Bearer error="invalid_token", error_description="iss not allowed"` 拒绝它。

3. 把 `auth::rate-limit` 实现为一个 iii 函数，并在注册 HTTP 触发器内部、注册器运行之前调用它。使用一个按源 IP 分桶的令牌桶（token-bucket），存于 `state::set("auth/ratelimit/<ip>", ...)`。

4. 阅读 RFC 7591，找出本课 `/register` 处理器未校验的两个字段。把校验加上。（提示：`software_statement` 与 `redirect_uris` 的 URI scheme。）

5. 阅读 MCP 规范 2025-11-25 的授权章节。找出本课校验器目前尚未发出的、关于 `WWW-Authenticate` 头的那条规范性（normative）要求。把它加上。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|----------------|------------------------|
| ASM | 「OAuth 元数据文档」 | RFC 8414 的 `/.well-known/oauth-authorization-server` JSON |
| DCR | 「自助式客户端注册」 | RFC 7591 的 `POST /register` 流程 |
| JWKS | 「用于 JWT 校验的公钥」 | JSON Web 密钥集，从 `jwks_uri` 拉取，按 `kid` 索引 |
| 资源指示符 | 「受众参数」 | RFC 8707 的 `resource` 参数，把令牌绑定到一台服务器 |
| `aud` 声明 | 「受众」 | 校验器与规范资源 URL 比对的 JWT 声明 |
| 混淆代理 | 「令牌重放」 | 把为服务器 A 签发的令牌出示给服务器 B 的攻击 |
| `iss` 白名单 | 「受信任的授权服务器」 | 受保护资源元数据 `authorization_servers` 中命名的集合 |
| 密钥轮换 | 「滚动 JWKS」 | 带重叠窗口地周期性替换签名密钥 |
| 公开客户端 | 「原生或浏览器客户端」 | 没有 `client_secret` 的 OAuth 客户端；由 PKCE 补偿 |
| `WWW-Authenticate` | 「401/403 响应头」 | 携带驱动客户端恢复的 `Bearer error=...` 指令 |

## 延伸阅读

- [MCP——授权规范（2025-11-25）](https://modelcontextprotocol.io/specification/draft/basic/authorization)——本课所实现的 MCP 鉴权画像
- [RFC 8414——OAuth 2.0 授权服务器元数据](https://datatracker.ietf.org/doc/html/rfc8414)——发现契约
- [RFC 7591——OAuth 2.0 动态客户端注册协议](https://datatracker.ietf.org/doc/html/rfc7591)——DCR
- [RFC 7636——授权码交换证明密钥（PKCE）](https://datatracker.ietf.org/doc/html/rfc7636)——公开客户端的持有证明
- [RFC 8707——OAuth 2.0 资源指示符](https://datatracker.ietf.org/doc/html/rfc8707)——受众绑定
- [RFC 9728——OAuth 2.0 受保护资源元数据](https://datatracker.ietf.org/doc/html/rfc9728)——资源服务器发现
- [OAuth 2.1 草案](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1)——整合后的 OAuth 基底
