# MCP 生产环境认证 —— 注册、JWKS 刷新与受众固定令牌

> 第 16 课在内存中搭建了 OAuth 2.1 状态机。到 2026 年，你交付给真实组织的每一个 MCP 服务器都将运行在生产级认证之后：支持无限客户端群体的注册机制（优先使用客户端 ID 元数据文档，动态客户端注册作为向后兼容的备用方案）、授权服务器元数据发现（RFC 8414 *或* OpenID Connect Discovery）、不会在凌晨三点破坏令牌验证的 JWKS 缓存刷新，以及拒绝跨资源重放的受众固定令牌。本课以三个角色——授权服务器、资源服务器（MCP 服务器）和客户端——建模完整的外表面，让你能够追踪从发现到已验证工具调用的每一个跳转。
>
> **规范说明（2025-11-25）：** 2025 年 11 月的 MCP 授权规范将动态客户端注册从`SHOULD`降级为`MAY`，并将**客户端 ID 元数据文档（CIMD）** 设为推荐的默认注册机制。本课按规范的优先级顺序讲授两者，代码保留 DCR 用于实操演练，因为它在单个进程中完全自包含。

**类型：** 构建
**语言：** Python（标准库）
**前置条件：** 阶段 13 · 第 16 课（OAuth 2.1 状态机），阶段 13 · 第 17 课（网关）
**时间：** 约 90 分钟

## 学习目标

- 通过 RFC 8414 元数据发现授权服务器并验证合约。
- 实现 RFC 7591 动态客户端注册，使 MCP 客户端无需管理员干预即可注册。
- 按计划缓存和刷新 JWKS 密钥，确保签名验证在密钥轮换后仍能工作。
- 使用 RFC 8707 资源指示器将令牌固定到单个 MCP 资源，并拒绝混乱代理复用。
- 清晰分离三个角色——授权服务器、资源服务器、客户端——使每个角色只执行属于自己的检查。
- 阅读 IdP 能力矩阵，当 IdP 无法满足 MCP 的认证特性集时拒绝部署。

## 问题

第 16 课的模拟器在内存中运行 OAuth 2.1。生产环境存在三个纯内存模拟器无法发现的操作缺口。

第一个缺口是**注册**。真实的组织运行着数百个 MCP 服务器和数千个 MCP 客户端。运维人员不会手动将每个 Cursor 用户注册为 OAuth 客户端。2025-11-25 规范为客户端提供了解决此问题的优先级顺序：如果你有预注册的 `client_id` 则使用它，否则使用**客户端 ID 元数据文档**（客户端用一个它控制的 HTTPS URL 标识自己，授权服务器*拉取*元数据），否则回退到 **RFC 7591 动态客户端注册**（客户端*推送* `POST /register` 并当场收到一个 `client_id`），否则提示用户。CIMD 是推荐的默认方案，因为它完全消除了每服务器注册的需要，同时保持了基于 DNS 的信任模型；DCR 保留用于向后兼容。两者都从授权服务器的元数据中发现入口点：CIMD 对应 `client_id_metadata_document_supported`，DCR 对应 `registration_endpoint`。

第二个缺口是**密钥轮换**。JWT 验证依赖于授权服务器的签名密钥，这些密钥以 JSON Web 密钥集（JWKS）的形式发布。授权服务器按计划轮换这些密钥（通常每小时一次，事故响应时可能更快）。仅在启动时获取一次 JWKS 的 MCP 服务器在轮换窗口之前都能正常验证——然后每一个请求都会失败，直到重启。生产环境将 JWKS 实现为缓存值，配合一个刷新任务在上一个密钥过期前覆写缓存，同时为缓存未命中情况提供后备获取——用于处理由比缓存更新的密钥签发的令牌到达的情况。

第三个缺口是**受众绑定**。第 16 课引入了 RFC 8707 资源指示器。在生产环境中，该指示器成为每个请求上的硬性声明检查。MCP 服务器将 `token.aud` 与自己的规范资源 URL 进行比较，不匹配时返回 HTTP 401。这是防止上游 MCP 服务器（或持有本应属于某台服务器的令牌的恶意客户端）在同一信任网格中针对另一台服务器重放该令牌的唯一防线。

本课将每个缺口映射到外表面的一个具体部分。元数据文档是一个 HTTP 端点。JWKS 缓存刷新是一个计划任务加键值缓存。JWT 验证是资源服务器在分派任何工具之前运行的例行程序。保持三个角色分离，每个角色只执行它拥有的检查：授权服务器签发和轮换密钥，资源服务器缓存和验证，客户端发现和注册。

## 概念

### RFC 8414 —— OAuth 授权服务器元数据

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

给定一个 MCP 资源 URL 的客户端会链式发现：RFC 9728 的 `oauth-protected-resource`（资源服务器的文档）指明发行者，然后 `oauth-authorization-server`（本 RFC）指明每个端点。客户端永远不会硬编码授权 URL。

在信任某个 IdP 用于 MCP 之前你需要验证的合约：

- `code_challenge_methods_supported` 包含 `S256`（PKCE，依据 RFC 7636）。规范明确指出：如果该字段**缺失**，则授权服务器不支持 PKCE，客户端**必须**拒绝继续。
- `grant_types_supported` 包含 `authorization_code` 且拒绝 `password` 和 `implicit`。
- 至少公布一条注册路径：`client_id_metadata_document_supported: true`（CIMD，首选）**或** `registration_endpoint`（RFC 7591 DCR，备用）。两者之一满足合约即可；你不再硬性要求 DCR。
- `response_types_supported` 必须正好是 `["code"]`（OAuth 2.1）。

如果缺少 `S256`，MCP 服务器拒绝针对此 IdP 部署——PKCE 没有降级模式。如果两条注册路径都未公布且你没有预注册的 `client_id`，你也无法注册；这是部署清单的问题，而不是代码的问题。

### RFC 9728（回顾）——受保护资源元数据

第 16 课涵盖了 RFC 9728。生产环境中的差异：该文档是客户端查找*此* MCP 服务器信任的授权服务器的唯一位置。单个 MCP 服务器可以接受来自多个 IdP 的令牌（一个供员工使用，一个供合作伙伴使用）。RFC 9728 声明该集合；RFC 8414 记录每个 IdP 支持的内容。

```json
{
  "resource": "https://notes.example.com",
  "authorization_servers": ["https://auth.example.com", "https://partners.example.com"],
  "scopes_supported": ["mcp:tools.invoke"],
  "bearer_methods_supported": ["header"],
  "resource_documentation": "https://notes.example.com/docs"
}
```

### 客户端 ID 元数据文档（推荐的默认方案）

CIMD 将注册从*推送*反转为*拉取*。客户端不是请求授权服务器生成一个 `client_id`，而是使用一个它控制的 HTTPS URL **作为**其 `client_id`。该 URL 解析为一个 JSON 元数据文档；授权服务器在 OAuth 流程中按需获取它。信任植根于 DNS：如果服务器运维人员信任 `app.example.com`，它就信任从 `https://app.example.com/client.json` 提供服务的客户端。没有注册往返，没有 `client_id` 命名空间耗尽问题，没有需要同步的每服务器状态。

客户端托管的元数据文档：

```json
{
  "client_id": "https://app.example.com/oauth/client.json",
  "client_name": "Example MCP Client",
  "client_uri": "https://app.example.com",
  "redirect_uris": ["http://127.0.0.1:7333/callback", "http://localhost:7333/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none"
}
```

文档中的 `client_id` 值**必须**等于其提供服务的 URL（授权服务器会验证这一点；不匹配将被拒绝）。授权服务器通过在其 RFC 8414 元数据中设置 `client_id_metadata_document_supported: true` 来公布支持。

规范对两个安全问题的态度直言不讳：

- **SSRF（服务端请求伪造）。** 授权服务器会获取攻击者提供的 URL。它必须防御服务端请求伪造（不允许获取内部/管理端点）。
- **localhost 冒用。** CIMD 本身无法阻止本地攻击者声称拥有合法客户端的元数据 URL 并绑定任何 `localhost` 重定向。授权服务器**必须**在授权同意期间清晰显示重定向 URI 主机名，并且**应该**对仅限 `localhost` 的重定向发出警告。

由于 CIMD 不需要服务器端状态，因此无需像 DCR 那样搭建注册中心。客户端端是只读的：从静态 HTTPS 端点提供你的元数据文档，让授权服务器去拉取它。

### RFC 7591 —— 动态客户端注册（备用/向后兼容）

DCR 现在是 `MAY` 级别，保留用于向后兼容 2025-11-25 之前的部署以及尚不支持 CIMD 的 IdP。如果没有它（也没有 CIMD 或预注册），每个 MCP 客户端（Cursor、Claude Desktop、自定义代理）都需要与 IdP 管理员进行带外交换。使用 DCR 时，客户端发送：

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

服务器响应 `client_id` 和一个用于后续更新的 `registration_access_token`：

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

`token_endpoint_auth_method: none` 是运行在用户设备上的 MCP 客户端的正确默认值。它们只获得一个 `client_id`——没有可泄露的 `client_secret`。PKCE 提供了公共客户端所需的持有证明。

三个生产环境陷阱：

- 注册端点必须按源 IP 进行速率限制。没有这一点，恶意行为者可以脚本化数百万个虚假注册，耗尽 `client_id` 命名空间。在注册中心处理请求之前，先进行速率限制检查。
- 一些企业 IdP 要求 `software_statement`（一个为客户端担保的签名 JWT）。本课的模拟件跳过了它；生产环境中需要接入验证步骤，拒绝来自非 localhost 重定向 URI 的未签名注册。
- `registration_access_token` 必须以哈希值而非明文形式存储。该令牌被盗意味着攻击者可以重写客户端的重定向 URI。

### RFC 8707（回顾）——资源指示器

第 16 课确立了基本形式。生产环境的规则：每个令牌请求都包含 `resource=<规范-mcp-url>`，并且 MCP 服务器在每次调用时验证 `token.aud` 是否与自己的资源 URL 匹配。规范 URI 是服务器*最具特异性*的标识符：它使用小写协议和主机，不含片段，且按惯例不加尾部斜杠。路径组件**不会**被规则剥离——当需要标识单个 MCP 服务器时，规范保留路径。`https://mcp.example.com`、`https://mcp.example.com/mcp`、`https://mcp.example.com:8443` 和 `https://mcp.example.com/server/mcp` 都是有效的规范 URI。为每个服务器选择一个，并将 `aud` 精确固定到该 URI。（本课的模拟件为简洁起见使用了裸主机受众，如 `https://notes.example.com`；在同一个源下共存多个 MCP 服务器的部署通过路径来区分它们。）

### RFC 7636（回顾）——PKCE

PKCE 在 OAuth 2.1 中是强制性的。本课的授权码流程始终携带 `code_challenge` 和 `code_verifier`。服务器拒绝任何没有验证器或验证器哈希值与存储的 challenge 不匹配的令牌请求。

### MCP 规范 2025-11-25 认证特性集

MCP 规范（2025-11-25）精确规定了 MCP 服务器的授权层必须做什么：

- 实现 RFC 9728 受保护资源元数据，并通过 401 响应的 `WWW-Authenticate: Bearer resource_metadata="..."` 头部**或** well-known URI `/.well-known/oauth-protected-resource` 提供其位置（SEP-985 使头部变为可选，以 well-known 作为备用）。元数据的 `authorization_servers` 字段**必须**至少命名一个服务器。
- **每个**请求仅通过 `Authorization: Bearer ...` 接受令牌——绝不在查询字符串中，也绝不仅仅在会话开始时验证。
- 每个请求验证 `aud`、`iss`、`exp` 和所需的作用域。服务器**必须**验证该令牌是专门为其签发的（受众）；缺失或不匹配的 `aud` 将被拒绝，绝不视为通配符。
- 在 401/403 时，返回携带 `error=...` 的 `WWW-Authenticate: Bearer`，以及 `resource_metadata="<PRM-URL>"` 参数（元数据文档的 URL，*不是*裸资源）和 `scope="..."`（针对 `insufficient_scope` 的 403）。注意：参数是 `resource_metadata`，一个发现指针——challenge 中没有 `resource` 参数。
- 授权服务器发现接受 **RFC 8414 OAuth 元数据**或 **OpenID Connect Discovery 1.0** 两者之一；客户端必须按优先级顺序尝试两个 well-known 后缀。
- 客户端（而非服务器）防御**混叠攻击**：它在重定向前记录预期的 `issuer`，并在兑换授权码之前验证 `iss` 授权响应参数（RFC 9207）。仅靠 PKCE 无法阻止混叠攻击，因为客户端会将其 `code_verifier` 交给它被引导到的任何令牌端点。

OAuth 2.1 草案是基底；RFC 8414/7591/8707/9728/9207 + RFC 7636 + CIMD 是外表面；MCP 规范是特性集。

### IdP 能力矩阵

并非每个 IdP 都支持完整的 MCP 特性集。下表记录了截至 2025-11-25 规范的事实性能力声明。它是一个*部署门控*，而非建议。

CIMD 在 2025-11-25 规范中发布，底层的 OAuth 草案直到 2025 年 10 月才被采纳，因此供应商支持仍在到来——请将下表中的 "CIMD" 理解为"当前状态，请在你的租户中验证"，而非永久性声明。

| IdP 类别 | AS 元数据 (8414/OIDC) | CIMD | RFC 7591 DCR | RFC 8707 resource | RFC 7636 S256 PKCE | 说明 |
|---|---|---|---|---|---|---|
| 自托管 (Keycloak) | 是 | 新兴 | 是 | 是（自 24.x 起） | 是 | 本课 MCP 特性集的参考 IdP；完整的端到端 DCR 路径，CIMD 正在跟进新规范。 |
| 企业 SSO (Microsoft Entra ID) | 是 | 新兴 | 是（高级层） | 是 | 是 | DCR 可用性因租户层而异；部署前在目标租户中验证。 |
| 公共 SaaS (Auth0 / Okta) | 是 | 新兴 | 是（有限制） | 视情况而定 | 是 | 如果 IdP 不暴露 `resource` 参数，则在其上层构建你自己的 MCP 感知授权服务器。 |
| 自定义/自研 | 视情况而定 | 视情况而定 | 视情况而定 | 视情况而定 | 视情况而定 | 如果你自己构建，请交付完整特性集并优先使用 CIMD。跳过 PKCE 或受众绑定会破坏 MCP 认证合约。 |

部署清单的拒绝规则：如果所选 IdP 未在其 `code_challenge_methods_supported` 中列出 `S256`，MCP 服务器拒绝启动——PKCE 没有降级模式。注册是一个较软的门控：你需要*一条*可工作的路径（预注册的 `client_id`、`client_id_metadata_document_supported: true` 或 `registration_endpoint`）。DCR 的缺失本身不再是拒绝触发条件，因为 CIMD 或预注册可以覆盖它。

### JWKS 刷新模式（AS 负责轮换，资源服务器负责刷新）

将两个动词分开理解，因为混淆它们是真实的生产环境错误：

- **轮换（Rotate）** 是*授权服务器*做的事情：生成新的签名密钥，在 JWKS 中发布，稍后淘汰旧密钥。资源服务器不参与此事，也无法执行——它不持有 IdP 的私钥。
- **刷新（Refresh）** 是*资源服务器*做的事情：重新 `GET` 已发布的 JWKS 到其缓存中。这是资源服务器唯一执行的 JWKS 操作。

生产环境的故障模式是缓存过期。通过一个计划刷新任务加一个键值缓存来解决。资源服务器运行一个任务（cron、定时器，或你的运行时提供的任何机制），按固定间隔获取 `<发行者>/.well-known/jwks.json` 并覆写 `cache[issuer] = {keys, fetched_at}`。验证器从该缓存读取。令牌的 `kid` 在缓存中缺失时，触发**一次**同步刷新作为后备，然后重新检查。这同时处理了两种情况：计划刷新，以及由全新密钥签发的令牌在下次计划刷新之前到达的密钥重叠窗口。

后备**必须是重新获取，绝不能是轮换**。如果你将缓存未命中路径连接到轮换并签发新密钥，两件事会出问题：(1) 签发一个新密钥会产生一个*仍然*不匹配令牌的 `kid`，因此查找仍然失败；(2) 使用随机 `kid` 值喷洒令牌的攻击者会强制无限制地创建密钥——这是自找的拒绝服务攻击。重新获取是幂等的，因此伪造的 `kid` 最多浪费一次获取。

缓存的形状：

```json
{
  "https://auth.example.com": {
    "keys": [
      {"kid": "k_2026_03", "kty": "RSA", "n": "...", "e": "AQAB", "alg": "RS256", "use": "sig"},
      {"kid": "k_2026_04", "kty": "RSA", "n": "...", "e": "AQAB", "alg": "RS256", "use": "sig"}
    ],
    "fetched_at": 1772668800
  }
}
```

同时存在两个密钥是稳态。授权服务器通过在前一个密钥（`k_2026_03`）退役之前引入下一个密钥（`k_2026_04`）来进行轮换，这样在旧密钥下签发的令牌在过期前仍然有效。缓存持有并集；验证器按 `kid` 选择。

### 验证例程

MCP 服务器在分派任何工具之前运行验证。`code/main.py` 使用的形式：

```python
result = server.validate(bearer_token, required_scope="mcp:tools.invoke")
if not result["valid"]:
    return {"status": result["status"], "WWW-Authenticate": result["www_authenticate"]}
```

`validate` 解码 JWT，从 JWKS 缓存中解析签名密钥（缓存未命中时刷新一次），验证签名，然后根据允许列表检查 `iss`，根据此服务器的规范资源检查 `aud`，检查 `exp` 和所需作用域——在第一次失败时返回一个 `WWW-Authenticate` challenge。将其保持为资源服务器上的单个例程意味着每个入口点（每个工具调用、每个传输）都经过相同的检查；不存在不经验证就到达工具的路径。

### 受众重放演练（访问令牌权限限制）

服务器 A（`notes.example.com`）和服务器 B（`tasks.example.com`）都在同一个授权服务器上注册。服务器 A 被攻破。攻击者获取用户的笔记令牌并针对服务器 B 进行重放。

服务器 B 的验证器：

1. 解码 JWT，按 `kid` 获取 JWKS，验证签名。
2. 根据其受保护资源元数据的 `authorization_servers` 检查 `iss`。（通过——同一个 IdP。）
3. 检查 `aud == "https://tasks.example.com"`。（失败——令牌的 `aud` 是 `https://notes.example.com`。）
4. 返回 401，附带 `WWW-Authenticate: Bearer error="invalid_token", error_description="audience mismatch", resource_metadata="https://tasks.example.com/.well-known/oauth-protected-resource"`。

受众声明是在协议层面防止此攻击的唯一防线。为性能而跳过它是生产环境中最常见的错误；验证器必须在每个请求上运行，而不仅仅在会话开始。规范将此称为**访问令牌权限限制**：MCP 服务器`必须`拒绝任何不在其受众中命名该服务器的令牌。

> **术语说明。** 规范保留了术语*混乱代理（confused deputy）*用于一个相关但不同的问题：MCP 服务器作为 OAuth **代理**指向第三方 API，使用静态客户端 ID，在未获得每客户端用户同意的情况下转发令牌。受众绑定修复了上述重放问题；混乱代理的修复方法是每客户端同意**加上**绝不将入站令牌传递给上游 API（MCP 服务器`必须`获取自己的独立上游令牌）。

### 混叠攻击（服务器无法提供的客户端侧防御）

客户端在其生命周期中与许多授权服务器通信。恶意的 AS 可能试图让客户端在攻击者的令牌端点兑换诚实 AS 的授权码。受众绑定对此无济于事——攻击发生在任何令牌存在之前。防御存在于客户端中（RFC 9207）：

1. 在重定向前，客户端根据已验证的 AS 元数据记录预期的 `issuer`。
2. 在收到授权响应时，客户端在将授权码发送到任何地方之前，将返回的 `iss` 参数与该记录的发行者进行比较（简单字符串比较，不进行标准化）。
3. 不匹配（或者当 AS 公布了 `authorization_response_iss_parameter_supported` 但 `iss` 缺失）→ 拒绝，并且甚至不显示 `error` 字段。

仅靠 PKCE 无法阻止混叠攻击，因为客户端会将其 `code_verifier` 交给它被引导到的任何令牌端点。这就是为什么规范在每个请求中与 PKCE 验证器和 `state` 一起记录发行者的原因。

### 故障模式

- **JWKS 过期。** AS 轮换密钥后，验证器拒绝有效令牌。修复方法是上面提到的 cron 刷新 + 缓存未命中重新获取模式。绝不要缓存 JWKS 而不带刷新任务。
- **将轮换用作后备。** 将缓存未命中路径连接到轮换并签发新密钥而不是重新获取，是一个真实的 bug：它永远不会产生缺失的 `kid`，并且它将攻击者控制的 `kid` 值转变为一个密钥创建型 DoS。后备必须是幂等的 `refresh-jwks`。
- **缺少 `aud` 声明。** 一些 IdP 默认省略 `aud`，除非令牌请求中存在 `resource`。验证器必须拒绝缺少 `aud` 的令牌，而不是将缺失视为通配符。
- **因缺少 `iss` 检查导致的混叠。** 客户端如果不验证 RFC 9207 的 `iss` 授权响应参数是否与重定向前记录的发行者匹配，就可能被引导至在攻击者的令牌端点兑换诚实 AS 的授权码。这是客户端侧的失败；资源服务器无法弥补。
- **作用域升级竞态。** 同一个用户的两个并发 step-up 流程可能都成功，产生两个不同作用域的访问令牌。验证器必须使用请求中呈现的令牌，而不是查找"用户的当前作用域"——这会创建一个 TOCTOU（检查时间/使用时间）窗口。
- **注册令牌泄露。** 泄露的 `registration_access_token` 使攻击者能够重写重定向 URI。对这些令牌应进行哈希存储；要求客户端在每次更新时提交明文；怀疑泄露时立即轮换。
- **`iss` 未固定。** 接受任何 `iss` 的验证器让攻击者可以搭建自己的授权服务器，为目标受众注册客户端，并签发令牌。受保护资源元数据的 `authorization_servers` 列表就是允许列表；强制执行它。

## 使用它

`code/main.py` 使用标准库 Python 和三个角色——`AuthorizationServer`、`ResourceServer` 和 `Client`——走通完整的生产流程。流程如下：

1. 授权服务器在 `/.well-known/oauth-authorization-server` 发布 RFC 8414 元数据。
2. MCP 客户端调用元数据端点并检查其注册选项（CIMD 的 `client_id_metadata_document_supported`，DCR 的 `registration_endpoint`）以及 `S256` PKCE 支持。
3. 演练走 DCR 回退路径：客户端向 `/register` 发送请求（RFC 7591）并收到一个 `client_id`。（CIMD 客户端则会展示自己的 HTTPS `client_id` URL 并跳过此步骤。）
4. MCP 客户端运行 PKCE 保护的授权码流程（RFC 7636），附带 `resource` 指示器（RFC 8707）。
5. MCP 客户端使用 `Authorization: Bearer ...` 调用 MCP 服务器上的工具。
6. MCP 服务器运行 `validate`，从 JWKS 缓存中解析签名密钥。
7. IdP 轮换一个密钥；计划刷新任务重新将 JWKS 拉取到缓存中。
8. 下一次调用使用刷新后的密钥进行验证，无需重启，且之前的令牌在重叠窗口内仍然有效。
9. 针对不同 MCP 资源的受众重放尝试会得到 401，附带 `audience mismatch` 和一个 `resource_metadata` 指针。

此处的 JWT 使用 HS256 和共享密钥（以便本课仅使用标准库即可运行）。生产环境使用 RS256 或 EdDSA 配合上述 JWKS 模式；验证逻辑在其他方面相同。由于 IdP 和资源服务器位于同一个进程中，`refresh_jwks` 直接读取授权服务器的密钥列表；通过网络传输时，它是向 `jwks_uri` 发送的 HTTP `GET` 请求。

## 交付

本课产生 `outputs/skill-mcp-auth.md`。给定一个 MCP 服务器配置和一组 IdP 能力，该技能输出要搭建的认证外表面——受保护资源元数据、要使用的注册路径（CIMD、预注册或 DCR 回退）、JWKS 刷新计划、作用域映射，以及在 IdP 不支持完整 RFC 特性集时要应用的拒绝规则。

## 练习

1. 运行 `code/main.py`。追踪流程。注意 IdP 如何在步骤 6 中轮换一个密钥，计划任务 `refresh_jwks` 如何重新拉取已发布的密钥集，以及旧令牌（重叠窗口内）和新令牌如何无需重启即可通过验证。

2. 向受保护资源元数据的 `authorization_servers` 列表添加一个新的 IdP。签发一个由新 IdP 签名的令牌，确认验证器接受它。签发一个由未列出的 IdP 签名的令牌，确认验证器拒绝并返回 `WWW-Authenticate: Bearer error="invalid_token", error_description="iss not allowed"`。

3. 向 `register_client` 添加一个速率限制检查，在注册中心接受请求之前运行。使用一个基于源 IP 的令牌桶，存放在一个以 IP 为键的小型字典中。

4. 阅读 RFC 7591，找出本课 `/register` 处理器未验证的两个字段。添加验证。（提示：`software_statement` 和 `redirect_uris` 的 URI 协议。）

5. 添加一个客户端 ID 元数据文档路径。提供一个 `client.json`，其 `client_id` 等于其自身的 URL，并让授权服务器获取和验证它（如果 `client_id` ≠ URL 则拒绝）。确认 CIMD 客户端无需调用 `register_client` 即可注册。

6. 证明 DoS 修复。向验证器发送一个带有随机 `kid` 的令牌，确认 `refresh_jwks` 最多运行一次且授权服务器的密钥数量没有增长。然后故意将后备改为轮换并签发新密钥，观察密钥数量随每个伪造令牌增长——之后恢复为重新获取。

7. 从混叠攻击一节中实现客户端侧的 RFC 9207 `iss` 检查：在授权请求前记录预期的发行者，然后拒绝 `iss` 不匹配的授权响应。

## 关键术语

| 术语 | 口语表达 | 实际含义 |
|------|----------|----------|
| ASM | "OAuth 元数据文档" | RFC 8414 `/.well-known/oauth-authorization-server` JSON |
| CIMD | "客户端元数据 URL" | 客户端 ID 元数据文档——用作 `client_id` 的 HTTPS URL；AS 拉取 JSON。自 2025-11-25 起为推荐的默认方案 |
| DCR | "自助客户端注册" | RFC 7591 `POST /register` 流程；在 2025-11-25 中降级为 `MAY` 备用方案 |
| JWKS | "用于 JWT 验证的公钥" | JSON Web 密钥集，从 `jwks_uri` 获取，按 `kid` 索引 |
| 轮换 vs 刷新 | "更新密钥" | *轮换* = AS 生成/退役签名密钥；*刷新* = 资源服务器重新获取已发布的密钥集。资源服务器只做刷新 |
| 资源指示器 | "受众参数" | RFC 8707 `resource` 参数，将令牌固定到一台服务器 |
| `aud` 声明 | "受众" | JWT 声明，验证器将其与规范资源 URL 进行比较 |
| 受众重放 | "令牌重放" | 为服务器 A 签发的令牌被提交给服务器 B；通过受众验证防御（规范：访问令牌权限限制） |
| 混乱代理 | "代理令牌滥用" | 具有静态客户端 ID 的 MCP 代理在未获得每客户端同意的情况下转发令牌；与受众重放不同 |
| 混叠攻击 | "错误的令牌端点" | 客户端被引导至在攻击者的端点兑换诚实 AS 的授权码；通过客户端侧 RFC 9207 `iss` 防御 |
| `iss` 允许列表 | "受信任的授权服务器" | 受保护资源元数据的 `authorization_servers` 中命名的集合 |
| `resource_metadata` | "在哪里找到 PRM 文档" | `WWW-Authenticate` 参数，在 401/403 时命名 RFC 9728 元数据 URL |
| 公共客户端 | "原生或浏览器客户端" | 没有 `client_secret` 的 OAuth 客户端；PKCE 弥补 |
| `WWW-Authenticate` | "401/403 响应头部" | 携带 `Bearer error=...` 指令，驱动客户端恢复 |

## 延伸阅读

- [MCP — 授权规范 (2025-11-25)](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization) — 本课实现的 MCP 认证特性集
- [MCP 博客 — MCP 一周年：2025 年 11 月规范发布](https://blog.modelcontextprotocol.io/posts/2025-11-25-first-mcp-anniversary/) — 2025-11-25 中变更的内容（CIMD、XAA、DCR 降级）
- [Aaron Parecki — 2025 年 11 月 MCP 授权规范中的客户端注册](https://aaronparecki.com/2025/11/25/1/mcp-authorization-spec-update) — CIMD 优于 DCR 的理由
- [OAuth 客户端 ID 元数据文档 (draft-ietf-oauth-client-id-metadata-document-00)](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-client-id-metadata-document-00) — CIMD
- [RFC 8414 — OAuth 2.0 授权服务器元数据](https://datatracker.ietf.org/doc/html/rfc8414) — 发现合约
- [RFC 7591 — OAuth 2.0 动态客户端注册协议](https://datatracker.ietf.org/doc/html/rfc7591) — DCR（备用路径）
- [RFC 7636 — 代码交换证明密钥 (PKCE)](https://datatracker.ietf.org/doc/html/rfc7636) — 公共客户端持有证明
- [RFC 8707 — OAuth 2.0 资源指示器](https://datatracker.ietf.org/doc/html/rfc8707) — 受众固定
- [RFC 9728 — OAuth 2.0 受保护资源元数据](https://datatracker.ietf.org/doc/html/rfc9728) — 资源服务器发现
- [RFC 9207 — OAuth 2.0 授权服务器发行者标识](https://datatracker.ietf.org/doc/html/rfc9207) — 防御混叠攻击的 `iss` 参数
- [OAuth 2.1 草案](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1) — 整合后的 OAuth 基底
