# MCP 生产环境身份验证 — DCR、JWKS 轮换、基于 iii 原语的受众固定令牌

> 第 16 课在内存中建立了 OAuth 2.1 状态机。到 2026 年，你发布到真实组织的每个 MCP 服务器都位于生产身份验证之后：动态客户端注册 (RFC 7591)、授权服务器元数据发现 (RFC 8414)、不会在凌晨 3 点破坏令牌验证的 JWKS 轮换，以及拒绝混淆代理重用的受众固定令牌。本课通过 iii 原语连接所有这些 — 用于 HTTP 和 cron 的 `iii.registerTrigger`、用于身份验证逻辑的 `iii.registerFunction`、`state::set/get` 用于缓存密钥 — 因此身份验证表面是可观察的、可重启的，并且可以像引擎中的其他工作负载一样重放。

**类型：** 构建
**语言：** Python (stdlib, iii 原语为课程环境模拟)
**前置条件：** 阶段 13 · 16 (OAuth 2.1 状态机), 阶段 13 · 17 (网关)
**时间：** ~90 分钟

## 学习目标

- 通过 RFC 8414 元数据发现授权服务器并验证契约。
- 实现 RFC 7591 动态客户端注册，以便 MCP 客户端无需管理员干预即可注册。
- 使用 cron 触发器缓存和轮换 JWKS 密钥，以便签名验证在密钥滚动时不会中断。
- 使用 RFC 8707 资源指示器将令牌固定到单个 MCP 资源，并拒绝混淆代理重用。
- 将每个端点和后台作业连接为 iii 原语 — HTTP 触发器、cron 触发器、命名函数、和 `state::*` 读取 — 因此单次重启会重建身份验证表面。
- 读取 IdP 能力矩阵，并在 IdP 无法满足 MCP 的身份验证配置文件时拒绝部署。

## 问题背景

第 16 课模拟器在内存中运行 OAuth 2.1。生产环境有三个操作差距，仅内存模拟器看不到。

第一个差距是注册。真实组织运行数百个 MCP 服务器和数千个 MCP 客户端。操作员不会手动注册每个 Cursor 用户作为 OAuth 客户端。RFC 7591 动态客户端注册允许客户端针对授权服务器 `POST /register` 并立即接收 `client_id`（以及可选的 `client_secret`）。服务器在其 RFC 8414 元数据中发布 `registration_endpoint`；客户端发现它而无需带外配置。

第二个差距是密钥轮换。JWT 验证取决于授权服务器的签名密钥，发布为 JSON Web 密钥集 (JWKS)。授权服务器按计划轮换这些密钥（通常每小时一次，有时在事件响应下更快）。在启动时获取一次 JWKS 的 MCP 服务器验证正常，直到轮换窗口 — 然后每个请求失败直到重启。生产环境将 JWKS 连接为具有刷新作业的缓存值，该作业在先前密钥过期之前覆盖缓存，加上在缓存未命中时的回退获取，用于处理由比缓存更新的密钥签名的令牌到达的情况。

第三个差距是受众绑定。第 16 课介绍了 RFC 8707 资源指示器。在生产环境中，该指示器成为每个请求上的硬性声明检查。MCP 服务器将 `token.aud` 与其自己的规范资源 URL 进行比较，并拒绝不匹配的 HTTP 401。这是针对上游 MCP 服务器（或持有用于一个服务器的令牌的恶意客户端）针对同一信任网格中的另一个服务器重放该令牌的攻击的唯一防御。

本课将每个这些差距视为 iii 原语。元数据文档是一个返回函数输出的 HTTP 触发器。JWKS 轮换是一个调用 `auth::rotate-jwks` 的 cron 触发器，它写入 `state::set("auth/jwks/<issuer>", ...)`。JWT 验证是其他人通过 `iii.trigger("auth::validate-jwt", token)` 调用的函数。MCP 服务器本身只是另一个在调度之前调用验证的 HTTP 触发器。重启引擎：触发器注册表重建；状态存活；身份验证表面在没有手动对账的情况下运行。

## 概念详解

### RFC 8414 — OAuth 授权服务器元数据

位于 `/.well-known/oauth-authorization-server` 的文档描述了客户端需要的一切：

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

客户端给定 MCP 资源 URL 链发现：`oauth-protected-resource` 来自 RFC 9728（资源服务器的文档）命名颁发者，然后 `oauth-authorization-server`（此 RFC）命名每个端点。客户端永远不会硬编码授权 URL。

在信任 IdP 进行 MCP 之前验证的契约：

- `code_challenge_methods_supported` 包括 `S256`（根据 RFC 7636 的 PKCE）。
- `grant_types_supported` 包括 `authorization_code` 并拒绝 `password` 和 `implicit`。
- `registration_endpoint` 存在（RFC 7591 支持）。
- `response_types_supported` 对于 OAuth 2.1 正好是 `["code"]`。

如果这些中的任何一个缺失，MCP 服务器拒绝针对此 IdP 部署。部署清单是错误的，而不是代码。

### RFC 9728（回顾）— 受保护资源元数据

第 16 课涵盖了 RFC 9728。生产环境中的增量：此文档是客户端查找 *此* MCP 服务器信任的授权服务器的唯一位置。单个 MCP 服务器可以接受来自多个 IdP 的令牌（一个用于员工，一个用于合作伙伴）。RFC 9728 声明该集合；RFC 8414 记录了每个 IdP 支持的内容。

```json
{
  "resource": "https://notes.example.com",
  "authorization_servers": ["https://auth.example.com", "https://partners.example.com"],
  "scopes_supported": ["mcp:tools.invoke"],
  "bearer_methods_supported": ["header"],
  "resource_documentation": "https://notes.example.com/docs"
}
```

### RFC 7591 — 动态客户端注册

没有 DCR，每个 MCP 客户端（Cursor、Claude Desktop、自定义智能体）都需要与 IdP 管理员进行带外交换。使用 DCR，客户端发布：

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

服务器响应 `client_id` 和用于以后更新的 `registration_access_token`：

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

`token_endpoint_auth_method: none` 是在用户设备上运行的 MCP 客户端的正确默认设置。他们只获得 `client_id` — 没有要泄露的 `client_secret`。PKCE 提供公共客户端需要的拥有证明。

三个生产陷阱：

- 注册端点必须按源 IP 进行速率限制。没有这个，恶意行为者脚本化数百万个假注册并耗尽 `client_id` 命名空间。iii 使这变得简单：注册 HTTP 触发器在调度到注册器之前调用 `auth::rate-limit` 函数。
- 某些企业 IdP 需要 `software_statement`（为客户端担保的签名 JWT）。课程的模拟跳过它；生产连接一个验证步骤，拒绝来自 localhost 重定向 URI 以外的任何东西的未签名注册。
- `registration_access_token` 必须存储为哈希，而不是明文。此令牌的盗窃意味着攻击者可以重写客户端的重定向 URI。

### RFC 8707（回顾）— 资源指示器

第 16 课建立了形态。生产规则：每个令牌请求都包括 `resource=<canonical-mcp-url>`，并且 MCP 服务器在每个调用上验证 `token.aud` 与其自己的资源 URL 匹配。如果 MCP 服务器可以在 `https://notes.example.com/mcp` 访问，`canonical URL` 是 `https://notes.example.com` — 排除路径组件，以便单个服务器在一个受众下托管多个路径。

### RFC 7636（回顾）— PKCE

PKCE 在 OAuth 2.1 中是强制性的。课程的授权代码流程始终携带 `code_challenge` 和 `code_verifier`。服务器拒绝任何没有验证器或验证器未哈希到存储的 challenge 的令牌请求。

### MCP 规范 2025-11-25 身份验证配置文件

MCP 规范 (2025-11-25) 关于 MCP 服务器的授权层必须做什么非常精确：

- 发布 `/.well-known/oauth-protected-resource` (RFC 9728)。
- 仅通过 `Authorization: Bearer ...` 接受令牌。
- 根据每个请求验证 `aud`、`iss`、`exp` 和所需作用域。
- 使用携带 `Bearer error=...` 的 `WWW-Authenticate` 响应每个 401 和 403，包括适用的 `scope=` 和 `resource=` 参数。
- 拒绝 `aud` 与规范资源不匹配的令牌。
- 拒绝 `iss` 不在受保护资源元数据的 `authorization_servers` 列表中的令牌。

OAuth 2.1 草案是基底；RFC 8414/7591/8707/9728 + RFC 7636 是表面；MCP 规范是配置文件。

### IdP 能力矩阵

并非每个 IdP 都支持完整的 MCP 配置文件。下表记录了截至 2025-11-25 规范的 factual 能力声明。它是一个 *部署门控*，而不是建议。

| IdP 类别 | RFC 8414 元数据 | RFC 7591 DCR | RFC 8707 资源 | RFC 7636 S256 PKCE | 备注 |
|---|---|---|---|---|---|
| 自托管 (Keycloak) | 是 | 是 | 是（自 24.x 起）| 是 | 本课中 MCP 配置文件的参考 IdP；端到端支持每个 RFC。 |
| 企业 SSO (Microsoft Entra ID) | 是 | 是（高级层）| 是 | 是 | DCR 可用性因租户层而异；在部署前在目标租户中验证。 |
| 企业 SSO (Okta) | 是 | 是 (Okta CIC / Auth0) | 是 | 是 | DCR 在 Auth0 上可用（现在 Okta CIC）；经典 Okta 组织需要管理员预注册。 |
| 社交登录 IdP（通用）| 变化 | 很少 | 很少 | 是 | 大多数社交 IdP 将客户端视为静态合作伙伴；不要依赖 DCR。仅用作身份来源，在你的上方分层你自己的 MCP 感知授权服务器。 |
| 自定义 / 本土 | 取决于 | 取决于 | 取决于 | 取决于 | 如果你发布你自己的，发布完整的配置文件。跳过上述四个 RFC 中的任何一个都会破坏 MCP 身份验证契约。 |

部署清单的拒绝规则：如果选择的 IdP 不返回 `registration_endpoint` 并且不在 `code_challenge_methods_supported` 中列出 `S256`，MCP 服务器拒绝启动。没有降级模式。

### 使用 iii 的 JWKS 轮换模式

生产失败模式是过时的 JWKS 缓存。用 cron 触发器和 `state::*` 缓存解决它：

```python
iii.registerTrigger(
    "cron",
    {"schedule": "0 */6 * * *", "name": "auth::jwks-refresh"},
    "auth::rotate-jwks",
)
```

每六小时，cron 触发器调用 `auth::rotate-jwks`，它获取 `<issuer>/.well-known/jwks.json` 并写入 `state::set("auth/jwks/<issuer>", {keys, fetched_at})`。验证器从 `state::get` 读取。其 `kid` 从缓存中缺失的令牌触发同步 `auth::rotate-jwks` 调用作为回退。这一次性处理两种情况：计划轮换（cron）和密钥重叠窗口（同步回退）。

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

一次两个密钥是稳定状态。授权服务器通过在停用前一个（`k_2026_03`）之前引入下一个密钥（`k_2026_04`）来轮换，因此在旧密钥下颁发的令牌在过期之前保持有效。缓存保存并集；验证器按 `kid` 选择。

### iii 原语连接（本课实际关于的部分）

五个原语组成身份验证表面：

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

# 3. JWT 验证作为可调用函数（资源服务器触发它）
iii.registerFunction("auth::validate-jwt", validate_jwt_handler)

# 4. 用于增量作用域的逐步颁发（L16 的 SEP-835）
iii.registerFunction("auth::issue-step-up", issue_step_up_handler)

# 5. Cron 驱动的 JWKS 轮换
iii.registerTrigger(
    "cron",
    {"schedule": "0 */6 * * *"},
    "auth::rotate-jwks",
)
iii.registerFunction("auth::rotate-jwks", rotate_jwks_handler)
```

MCP 服务器本身永远不会直接调用验证。它执行：

```python
result = iii.trigger("auth::validate-jwt", {"token": bearer_token, "resource": self.resource})
if not result["valid"]:
    return {"status": 401, "WWW-Authenticate": result["www_authenticate"]}
```

这种间接是 iii 的赌注。明天你将验证器交换为并行咨询两个 IdP 的扇出，或者你添加 span 发射器，或者你缓存正向验证。MCP 服务器不会改变。

### 使用受众绑定的混淆代理演练

服务器 A (`notes.example.com`) 和服务器 B (`tasks.example.com`) 都针对同一个授权服务器注册。服务器 A 被入侵。攻击者获取用户的笔记令牌并对服务器 B 重放它。

服务器 B 的验证器：

1. 解码 JWT，按 `kid` 获取 JWKS，验证签名。
2. 根据受保护资源元数据的 `authorization_servers` 检查 `iss`。（通过 — 相同的 IdP。）
3. 检查 `aud == "https://tasks.example.com"`。（失败 — 令牌的 `aud` 是 `https://notes.example.com`。）
4. 返回 401，携带 `WWW-Authenticate: Bearer error="invalid_token", error_description="audience mismatch"`。

受众声明是协议层针对此攻击的唯一防御。为了性能而跳过它是最常见的生产错误；验证器必须在每个请求上运行，而不仅仅是在会话开始时。

### 故障模式

- **过时的 JWKS。** 验证器在密钥轮换后拒绝有效令牌。修复是上面的 cron+回退模式。永远不要在没有刷新作业的情况下缓存 JWKS。
- **缺少 `aud` 声明。** 某些 IdP 默认省略 `aud`，除非令牌请求中存在 `resource`。验证器必须拒绝缺少 `aud` 的令牌，而不是将缺失视为通配符。
- **作用域升级竞争。** 同一用户的两个并发逐步流程都可能成功并产生具有不同作用域的两个访问令牌。验证器必须使用请求上呈现的令牌，而不是查找"用户当前作用域" — 这会创建 TOCTOU 窗口。
- **注册令牌盗窃。** 泄漏的 `registration_access_token` 让攻击者重写重定向 URI。静态存储这些；要求客户端在每次更新时呈现明文；在怀疑时轮换。
- **`iss` 未固定。** 接受任何 `iss` 的验证器让攻击者建立他们自己的授权服务器，为目标受众注册客户端，并颁发令牌。受保护资源元数据的 `authorization_servers` 列表是允许列表；强制执行它。

## 使用示例

`code/main.py` 使用 stdlib Python 和一个模拟 `iii_mock` 注册表演练完整生产流程，该注册表模仿 `iii.registerFunction`、`iii.registerTrigger`、`iii.trigger` 和 `state::set/get`。流程：

1. 授权服务器在 `/.well-known/oauth-authorization-server` 发布 RFC 8414 元数据。
2. MCP 客户端调用元数据端点，发现注册端点。
3. MCP 客户端发布到 `/register` (RFC 7591) 并接收 `client_id`。
4. MCP 客户端运行带有 `resource` 指示器 (RFC 8707) 的 PKCE 保护的授权代码流程 (RFC 7636)。
5. MCP 客户端使用 `Authorization: Bearer ...` 在 MCP 服务器上调用工具。
6. MCP 服务器触发 `auth::validate-jwt`，它从 `state::get` 读取 JWKS。
7. cron 触发器触发 `auth::rotate-jwks`，替换状态中的 JWKS。
8. 下一个调用针对新密钥进行验证而无需重启。
9. 针对不同的 MCP 资源的混淆代理尝试获得 401，受众不匹配。

此处的模拟 JWT 使用带有共享密钥的 HS256（因此课程仅在 stdlib 上运行）。生产使用带有上述 JWKS 模式的 RS256 或 EdDSA；否则验证逻辑是相同的。

## 实战输出

本课生成 `outputs/skill-mcp-auth-iii.md`。给定 MCP 服务器配置和 IdP 能力集，该技能发出要注册的 iii 原语、JWKS 轮换计划、作用域映射，以及当 IdP 不支持完整 RFC 配置文件时要应用的拒绝规则。

## 练习

1. 运行 `code/main.py`。追踪 9 步流程。注意 `state::get` 在 `auth::rotate-jwks` 覆盖它之前立即返回过时数据，以及下一个请求现在如何针对新密钥进行验证。

2. 将新的 IdP 添加到受保护资源元数据的 `authorization_servers` 列表。颁发由新 IdP 签名的令牌并确认验证器接受它。颁发由未列出的 IdP 签名的令牌并确认验证器拒绝并携带 `WWW-Authenticate: Bearer error="invalid_token", error_description="iss not allowed"`。

3. 将 `auth::rate-limit` 实现为 iii 函数，并在注册器运行之前从注册 HTTP 触发器内部调用它。使用保存在 `state::set("auth/ratelimit/<ip>", ...)` 中的每源 IP 令牌桶。

4. 阅读 RFC 7591 并识别课程的 `/register` 处理器未验证的两个字段。添加验证。（提示：`software_statement` 和 `redirect_uris` URI 方案。）

5. 阅读 MCP 规范 2025-11-25 授权部分。找到课程的验证器当前未发出的关于 `WWW-Authenticate` 头部的一个规范性要求。添加它。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------|---------|
| ASM | "OAuth 元数据文档" | RFC 8414 `/.well-known/oauth-authorization-server` JSON |
| DCR | "自助服务客户端注册" | RFC 7591 `POST /register` 流程 |
| JWKS | "用于 JWT 验证的公钥" | JSON Web 密钥集，从 `jwks_uri` 获取，按 `kid` 索引 |
| 资源指示器 | "受众参数" | RFC 8707 `resource` 参数将令牌固定到一个服务器 |
| `aud` 声明 | "受众" | 验证器针对规范资源 URL 进行比较的 JWT 声明 |
| 混淆代理 | "令牌重放" | 为服务器 A 颁发的令牌被呈现给服务器 B 的攻击 |
| `iss` 允许列表 | "受信任的授权服务器" | 受保护资源元数据中命名的集合 `authorization_servers` |
| 密钥轮换 | "滚动 JWKS" | 具有重叠窗口的签名密钥的定期替换 |
| 公共客户端 | "本机或浏览器客户端" | 没有 `client_secret` 的 OAuth 客户端；PKCE 补偿 |
| `MWW-Authenticate` | "401/403 响应头部" | 携带驱动客户端恢复的 `Bearer error=...` 指令 |

## 延伸阅读

- [MCP — 授权规范 (2025-11-25)](https://modelcontextprotocol.io/specification/draft/basic/authorization) — 本课实现的 MCP 身份验证配置文件
- [RFC 8414 — OAuth 2.0 授权服务器元数据](https://datatracker.ietf.org/doc/html/rfc8414) — 发现契约
- [RFC 7591 — OAuth 2.0 动态客户端注册协议](https://datatracker.ietf.org/doc/html/rfc7591) — DCR
- [RFC 7636 — 代码交换的证明密钥 (PKCE)](https://datatracker.ietf.org/doc/html/rfc7636) — 公共客户端拥有证明
- [RFC 8707 — OAuth 2.0 的资源指示器](https://datatracker.ietf.org/doc/html/rfc8707) — 受众固定
- [RFC 9728 — OAuth 2.0 受保护资源元数据](https://datatracker.ietf.org/doc/html/rfc9728) — 资源服务器发现
- [OAuth 2.1 草案](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1) — 合并的 OAuth 基底
