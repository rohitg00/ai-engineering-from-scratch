# 生产环境中的 MCP 认证：基于签发者的注册与令牌绑定

> 第 16 课构建了 OAuth 2.1 状态机。本课程针对 MCP 2026-07-28 加固其生产边界：优先使用 Client ID Metadata Documents，已弃用的动态注册仅作兼容之用，授权响应中的签发者校验，按签发者键控的客户端凭据，JWKS 刷新，以及在每个无状态请求上绑定受众的令牌。
>
> **规范说明（2026-07-28）：** 动态客户端注册（Dynamic Client Registration）已被弃用，推荐使用 Client ID Metadata Documents。DCR 仍作为一种兼容机制保留。使用它时，客户端会声明正确的 `application_type`。客户端会校验存在的 RFC 9207 `iss` 值，且绝不在不同授权服务器签发者之间复用凭据。

**类型：** Build
**语言：** Python (标准库)
**前置课程：** 阶段 13 · 16 (OAuth 2.1 状态机), 阶段 13 · 17 (网关)
**耗时：** 约 90 分钟

## 学习目标

- 通过 RFC 8414 元数据发现授权服务器并校验其契约。
- 通过 Client ID Metadata Document 注册，并将已弃用的 DCR 隔离为后备方案。
- 校验 RFC 9207 `iss`，按授权服务器签发者键控注册，并按签发者加资源键控资源绑定令牌。
- 定时缓存并刷新 JWKS 密钥，使签名校验在密钥轮换期间依然有效。
- 使用 RFC 8707 资源指示符将令牌绑定到单一 MCP 资源，并拒绝“混淆代理人”式的复用。
- 在 JWT 校验与令牌内省（introspection）之间做出选择，定义吊销时效性，并在身份依赖不可用时安全失败。
- 将授权服务器、资源服务器与客户端分离，使每个组件仅执行其自身的检查。
- 依据部署清单审计授权服务器，拒绝不安全的注册或令牌复用。

## 问题所在

第 16 课的模拟器在内存中运行 OAuth 2.1。生产环境存在三个仅内存模拟器看不到的运维缺口。

第一个缺口是注册与凭据隔离。一个真实的组织可能运行数百个 MCP 服务器和数千个 MCP 客户端。2026-07-28 修订版倾向于使用 **Client ID Metadata Document**：客户端使用一个带有其控制路径的 HTTPS URL 作为标识符，由授权服务器拉取元数据。RFC 7591 动态注册仅作为已弃用的兼容路径保留。当 DCR 无法避免时，请求会声明正确的 `application_type`。客户端将注册信息存储在授权服务器签发者之下，将访问令牌存储在 `(issuer, resource)` 对之下。签发者变更意味着需要新的注册，不同的资源意味着需要单独绑定受众的令牌。

第二个缺口是密钥轮换。JWT 校验依赖于授权服务器以 JSON Web Key Set（JWKS）形式发布的签名密钥。授权服务器按计划轮换这些密钥（通常每小时一次，在事件响应期间有时更快）。启动时只获取一次 JWKS 的 MCP 服务器在轮换窗口之前都能正常校验——之后每个请求都会失败，直到重启。生产环境将 JWKS 作为缓存值，并配合一个在旧密钥过期前覆盖缓存的刷新任务，外加缓存未命中时的后备获取，以处理带有比缓存更新的密钥签名的令牌到达的情况。

第三个缺口是受众绑定。第 16 课介绍了 RFC 8707 资源指示符。在生产环境中，该指示符成为对每个请求的强制性声明（claim）检查。MCP 服务器将 `token.aud` 与其自身的规范化资源 URL 进行比较，并在不匹配时返回 HTTP 401 拒绝。这是抵御上游 MCP 服务器（或持有本应属于一个服务器令牌的恶意客户端）在同一个信任网中向另一个服务器重放该令牌的唯一防线。

本课程将每个缺口映射到暴露面的一个具体部分。元数据文档是一个 HTTP 端点。JWKS 缓存刷新是一个定时任务加上一个键值缓存。JWT 校验是资源服务器在分发任何工具之前运行的一个例程。保持这三个角色分离，每个组件仅执行其拥有的检查：授权服务器签发并轮换密钥，资源服务器缓存并校验，客户端发现并注册。

## 范围：第 16 课之后的生产强制

[第 16 课：使用 OAuth 2.1 的 MCP 安全](../../16-mcp-security-oauth-2-1/docs/en.md) 负责授权码状态机、PKCE、受保护资源发现、资源指示符和范围决策。本课程不定义第二个 OAuth 流程。它从这些契约存在之后开始，探讨已部署的资源服务器如何在密钥轮换、不透明令牌（opaque-token）校验、吊销、依赖失败、推广和事件响应期间持续强制执行这些契约。

生产边界更窄且更偏向运维：

- JWT 路径在每个请求上校验固定的签发者、算法、签名密钥、受众、时间声明和范围，同时安全地刷新 JWKS。
- 不透明令牌路径调用签发者经过身份验证的内省端点，并校验返回的激活状态、受众或资源、过期时间、主题（subject）和范围。
- 吊销策略定义凭据必须多快失效，以及哪个缓存可以延迟这一事实。
- 失败策略决定当发现、JWKS、内省或吊销基础设施不可用时会发生什么。
- 证据记录哪些签发者元数据、密钥集或内省响应、令牌声明、策略版本和拒绝原因导致了结果，而不存储令牌。

这种区分保持了课程的可组合性。第 16 课证明了流程。第 18 课证明令牌到达真实 MCP 请求路径后依然可信，或被拒绝。

## 核心概念

### RFC 8414 — OAuth 授权服务器元数据

`/.well-known/oauth-authorization-server` 处的文档描述了客户端所需的一切：

```json
{
  "issuer": "https://auth.example.com",
  "authorization_endpoint": "https://auth.example.com/authorize",
  "token_endpoint": "https://auth.example.com/token",
  "jwks_uri": "https://auth.example.com/.well-known/jwks.json",
  "client_id_metadata_document_supported": true,
  "registration_endpoint": "https://auth.example.com/register",
  "authorization_response_iss_parameter_supported": true,
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "scopes_supported": ["mcp:tools.read", "mcp:tools.invoke"],
  "token_endpoint_auth_methods_supported": ["none", "private_key_jwt"]
}
```

给定 MCP 资源 URL 的客户端会链式发现：RFC 9728 的 `oauth-protected-resource`（资源服务器的文档）指出签发者，然后 `oauth-authorization-server`（本 RFC）指出所有端点。客户端绝不硬编码授权 URL。

对于带路径的资源标识符，请在该路径之前插入 well-known 片段。例如，`https://mcp.example.com/team/server` 解析为 `https://mcp.example.com/.well-known/oauth-protected-resource/team/server` 处的受保护资源元数据。在资源路径之后附加 `/.well-known/...` 是错误的。

在信任用于 MCP 的 IdP 之前你要校验的契约：

- `code_challenge_methods_supported` 包含 `S256`（按 RFC 7636 的 PKCE）。规范明确指出：如果该字段**缺失**，授权服务器不支持 PKCE，客户端**必须（MUST）**拒绝继续。
- `grant_types_supported` 包含 `authorization_code` 并拒绝 `password` 和 `implicit`。
- 至少有一个注册路径可用：`client_id_metadata_document_supported: true`（CIMD，首选）、预注册客户端，或 `registration_endpoint`（已弃用的 RFC 7591 兼容）。
- 若 `authorization_response_iss_parameter_supported` 为 true，客户端要求返回的 RFC 9207 `iss`，并将其与重定向之前记录的签发者进行精确比较。
- 对于 OAuth 2.1，`response_types_supported` 恰好是 `["code"]`。

如果 `S256` 缺失，MCP 服务器拒绝针对此 IdP 部署——PKCE 没有降级模式。如果**两个**注册路径均未公告，且你没有预注册的 `client_id`，你也无法注册；是部署清单错了，而不是代码错了。

### RFC 9728（回顾）— 受保护资源元数据

第 16 课已涵盖 RFC 9728。生产环境中的变化：该文档是客户端查找*此* MCP 服务器所信任的授权服务器的唯一位置。单个 MCP 服务器可以接受来自多个 IdP 的令牌（一个面向员工，一个面向合作伙伴）。RFC 9728 声明该集合；RFC 8414 说明每个 IdP 支持什么。

```json
{
  "resource": "https://notes.example.com",
  "authorization_servers": ["https://auth.example.com", "https://partners.example.com"],
  "scopes_supported": ["mcp:tools.invoke"],
  "bearer_methods_supported": ["header"],
  "resource_documentation": "https://notes.example.com/docs"
}
```

### Client ID Metadata Documents（推荐的默认方式）

CIMD 将注册从*推送*反转为*拉取*。客户端不再要求授权服务器铸造 `client_id`，而是使用一个它控制的 HTTPS URL **作为**其 `client_id`。该 URL 解析为一个 JSON 元数据文档；授权服务器在 OAuth 流程期间按需获取它。信任根植于 DNS：如果服务器操作者信任 `app.example.com`，它就信任从 `https://app.example.com/client.json` 服务的客户端。没有注册往返，没有需要耗尽的 `client_id` 命名空间，没有需要同步的每服务器状态。

客户端托管的元数据文档：

```json
{
  "client_id": "https://app.example.com/oauth/client.json",
  "client_name": "Example MCP Client",
  "client_uri": "https://app.example.com",
  "application_type": "native",
  "redirect_uris": ["http://127.0.0.1:7333/callback", "http://localhost:7333/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none"
}
```

文档中的 `client_id` 值**必须（MUST）**等于它所服务的 URL（由授权服务器校验；不匹配将被拒绝）。授权服务器在其 RFC 8414 元数据中通过 `client_id_metadata_document_supported: true` 公告支持。

对于当前的 CIMD 契约，`client_id`、`client_name` 和一个非空的 `redirect_uris` 数组是必需的。客户端标识符是一个带路径的绝对 HTTPS URL。`application_type` 可以包含，但它不是强制性的 CIMD 字段。不要将 `application_type` 的 DCR 要求复制到首选的 CIMD 路径中。

规范直言不讳地指出的两个安全事实：

- **SSRF。** 授权服务器获取攻击者提供的 URL。它必须防御服务器端请求伪造（不向内部/管理端点发起获取请求）。
- **localhost 伪装。** CIMD 本身无法阻止本地攻击者声称合法客户端的元数据 URL 并绑定任意 `localhost` 重定向。授权服务器**必须（MUST）**在同意期间明确显示重定向 URI 的主机名，并且**应该（SHOULD）**针对仅 `localhost` 的重定向发出警告。

由于 CIMD 不需要服务器端状态，因此无需像 DCR 要求的那样搭建注册机构。客户端侧是只读的：从静态 HTTPS 端点服务你的元数据文档，让授权服务器拉取它。

如果授权服务器操作者已预配置了客户端标识符，请在尝试自动注册之前使用该按签发者作用域的注册。否则首选 CIMD。仅在签发者既不能使用预注册也不能使用 CIMD 时，才使用已弃用的 DCR。

### RFC 7591：已弃用的兼容注册

DCR 在 2026-07-28 修订版中已被弃用。仅将其保留用于不能使用 CIMD 且预注册不切实际的授权服务器。兼容客户端发送：

```json
POST /register
Content-Type: application/json

{
  "application_type": "native",
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

服务器以 `client_id` 和用于后续更新的 `registration_access_token` 响应：

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

`application_type` 并非装饰性的。回环桌面客户端声明 `native`；服务器托管的客户端声明 `web` 并使用 HTTPS 重定向 URI。`token_endpoint_auth_method: none` 是公共原生客户端的正确默认值。它只获得一个 `client_id`，由 PKCE 提供占有证明。

三个生产陷阱：

- 注册端点必须按源 IP 进行速率限制。否则，恶意行为者可以脚本化数百万个虚假注册并耗尽 `client_id` 命名空间。在注册机构处理请求之前运行速率限制检查。
- `software_statement`（为客户端担保的签名 JWT）被一些企业 IdP 要求。本课的模拟实现跳过了它；生产环境接入一个校验步骤，拒绝除 localhost 重定向 URI 以外的任何未签名注册。
- `registration_access_token` 必须以哈希形式存储，而非明文。窃取此令牌意味着攻击者可以重写客户端的重定向 URI。

### RFC 8707（回顾）— 资源指示符

第 16 课确立了形态。生产规则：每个令牌请求都包含 `resource=<canonical-mcp-url>`，且 MCP 服务器在每次调用时校验 `token.aud` 与其自身的资源 URL 匹配。规范化 URI 是服务器*最具体*的标识符：它使用小写的方案（scheme）和主机（host），无片段（fragment），并且按照惯例没有尾随斜杠。路径组件**不**按规则剥离——当需要识别单个 MCP 服务器时，规范保留它。`https://mcp.example.com`、`https://mcp.example.com/mcp`、`https://mcp.example.com:8443` 和 `https://mcp.example.com/server/mcp` 都是有效的规范化 URI。每个服务器选择一个，并将 `aud` 精确固定到它。（本课的模拟实现为了简洁使用像 `https://notes.example.com` 这样的裸主机受众；在同一源下共同托管多个 MCP 服务器的部署通过路径区分它们。）

### RFC 7636（回顾）— PKCE

PKCE 在 OAuth 2.1 中是强制性的。本课的授权码流程始终携带 `code_challenge` 和 `code_verifier`。服务器拒绝任何没有验证器（verifier）或验证器与存储的挑战（challenge）哈希不匹配的令牌请求。

### MCP 2026-07-28 授权配置

当前的 MCP 修订版保留了 OAuth 资源服务器边界，同时使 MCP 传输无状态。没有可以缓存身份决策的协议会话。因此，授权层独立校验每个请求：

- 实现 RFC 9728 受保护资源元数据，并通过 401 上的 `WWW-Authenticate: Bearer resource_metadata="..."` 头**或** well-known URI `/.well-known/oauth-protected-resource` 提供其位置（SEP-985 使该头变为可选，并提供 well-known 后备）。元数据的 `authorization_servers` 字段**必须（MUST）**至少命名一台服务器。
- 仅通过**每个**请求上的 `Authorization: Bearer ...` 接受令牌——绝不在查询字符串中，绝不仅在校验会话开始时。
- 按请求校验 `aud`、`iss`、`exp` 和所需范围。服务器**必须（MUST）**校验令牌是专门为它签发的（受众）；缺失或不匹配的 `aud` 会被拒绝，绝不被视为通配符。
- 在 401/403 上，返回携带 `error=...` 的 `WWW-Authenticate: Bearer`、`resource_metadata="<PRM-URL>"` 参数（元数据文档的 URL，*而非*裸资源），以及 `insufficient_scope`（403）上的 `scope="..."`。注意：该参数是 `resource_metadata`，一个发现指针——挑战中没有 `resource` 参数。
- 授权服务器发现接受 RFC 8414 OAuth 元数据**或** OpenID Connect Discovery 1.0；客户端必须按优先级顺序尝试两个 well-known 后缀。
- 客户端（而非服务器）防御**混合攻击（mix-up attacks）**：它在重定向之前记录预期的 `issuer`，并在兑换（redeem）代码之前校验实际授权响应中返回的 `iss` 值（RFC 9207）。仅凭 PKCE 无法阻止混合攻击，因为客户端将其 `code_verifier` 交给它被引导到的任何令牌端点。
- 客户端凭据属于一个授权服务器签发者。如果发现解析为不同的签发者，客户端重新注册，而不是出示旧的 `client_id`、注册令牌或访问令牌。
- CIMD 是首选的注册机制。DCR 已弃用；兼容的 DCR 请求仍声明正确的 `application_type`。

OAuth 2.1 草案是底层；RFC 8414/7591/8707/9728/9207 + RFC 7636 + CIMD 是表面；MCP 规范是配置。

### 部署能力清单

供应商功能表很快就会过时。改为检查你实际将部署的授权服务器返回的元数据。闸门是机械的：

| 检查项 | 所需决策 |
|---|---|
| 发现的签发者 | 策略期望的精确 HTTPS 签发者 |
| PKCE | 已公告 `S256`；否则停止 |
| 注册 | 首选 CIMD，接受预注册，DCR 仅作为已弃用的兼容 |
| 授权响应 | 当存在或已公告时校验 RFC 9207 `iss` |
| 资源绑定 | 令牌请求携带 `resource`；资源服务器要求匹配的 `aud` |
| 凭据存储 | 按签发者键控客户端 ID 和注册凭据；按签发者加资源键控访问令牌 |
| DCR 兼容 | 声明 `native` 或 `web`；拒绝不符合所声明应用程序类型的重定向 URI |

不要从产品名称或价格层级推断支持。将发现的文档捕获到部署证据中，并在缺少必填字段时失败关闭（fail closed）。

### JWKS 刷新模式（在 AS 轮换，在资源服务器刷新）

保持两个动词分离，因为将它们混淆是一个真实的生产缺陷：

- **轮换**是*授权服务器*所做的事：铸造新的签名密钥，将其发布到 JWKS，稍后停用旧密钥。资源服务器在其中没有任何作用，也无法做到——它不持有 IdP 的私钥。
- **刷新**是*资源服务器*所做的事：将已发布的 JWKS 重新`GET`到其缓存中。这是资源服务器曾经执行的唯一 JWKS 动作。

生产故障模式是缓存过时。使用定时刷新任务加上键值缓存来解决它。资源服务器运行一个任务（cron、定时器，或你的运行时提供的任何东西），以固定间隔获取 `<issuer>/.well-known/jwks.json` 并覆盖 `cache[issuer] = {keys, fetched_at}`。校验器从该缓存读取。如果其 `kid` 在缓存中缺失，令牌会触发**一次**同步刷新作为后备，然后重新检查。这同时处理两种情况：定时刷新，以及在下一个定时刷新之前，由全新密钥签名的令牌到达的密钥重叠窗口。

后备**必须是重新获取，绝不轮换**。如果将缓存未命中路径连接到轮换并铸造，两件事会损坏：(1) 铸造一个新密钥产生的 `kid` *仍然*不匹配该令牌，所以查找仍然失败；(2) 一个喷射带有随机 `kid` 值的令牌的攻击者可以强制无限制的一系列密钥创建——这是自找的 DoS。重新获取是幂等的，因此一个伪造的 `kid` 至多浪费一次获取。

缓存形状：

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

同时持有两个密钥是稳定状态。授权服务器通过在停用上一个（`k_2026_03`）之前引入下一个（`k_2026_04`）来轮换，因此在旧密钥下签发的令牌在过期前保持有效。缓存持有并集；校验器按 `kid` 选择。

### 校验例程

MCP 服务器在分发任何工具之前运行校验。`code/main.py` 使用的形态：

```python
result = server.validate(bearer_token, required_scope="mcp:tools.invoke")
if not result["valid"]:
    return {"status": result["status"], "WWW-Authenticate": result["www_authenticate"]}
```

`validate` 解码 JWT，从 JWKS 缓存中解析签名密钥（在未命中时刷新一次），校验签名，然后对照允许列表检查 `iss`，对照本服务器的规范化资源检查 `aud`、`exp` 和所需范围——在首次失败时返回 `WWW-Authenticate` 挑战。将其保留为资源服务器上的单个例程意味着每个入口点（每次工具调用，每种传输）都经过相同的检查；没有路径在未先校验的情况下到达工具。

### 不透明令牌使用内省，而非猜测

并非每个访问令牌都是 JWT。如果签发者记录为不透明令牌，资源服务器无法将其解码为可信声明。它通过经过身份验证的后端通道将令牌发送给签发者的 RFC 7662 内省端点，并要求 `active: true`、预期的签发者上下文、精确的 MCP 受众或资源、未过期的时间声明以及具体工具所需的范围。

按签发者、单向令牌摘要和 MCP 资源缓存内省结果。绝不要将明文令牌用作日志或缓存标签。正向缓存条目的时间限制为令牌过期时间、签发者缓存指导和部署的吊销时效性目标中的最早者。负向缓存保持足够短，以便新签发的令牌不会保持虚假的未激活状态。针对一个资源的结果不能授权另一个资源，即使不透明令牌字符串完全相同。

不要从攻击者控制的令牌内容中选择校验模式。将 JWT 与内省行为固定到经过校验的签发者元数据和部署配置。在 JWT 路径上，固定接受的算法和受信任的 `jwks_uri`；绝不要遵循仅由令牌头选择的密钥 URL 或算法。

### 吊销是一个时效性契约

RFC 7009 允许客户端要求授权服务器吊销令牌。该请求不会抹去已经缓存在每个资源服务器上的副本。定义最大可接受的吊销延迟，并使每个缓存遵守它。

不透明令牌部署可以通过在每次高风险调用上进行内省或使用短的正向缓存来实现更紧的吊销。自包含 JWT 部署通常将短访问令牌生命周期与刷新令牌吊销相结合，对于签发者范围的事件采用密钥停用，并为紧急本地拒绝使用可选的主题、会话或令牌 ID 拒绝列表。除非资源服务器拥有当前的外部吊销证据，否则签名 JWT 在过期前在密码学上保持有效。

登出、账户禁用、同意撤回和事件响应是不同的触发器，但必须收敛到一个可衡量的陈述：在至多声明的吊销窗口后，每个副本都拒绝该凭据。通过负载均衡器测试该陈述，而不仅针对一个热进程。

### 依赖失败需要预先声明的决策

绝不要在异常处理器中临时制定可用性策略。

| 失败 | 安全的生产行为 |
|---|---|
| 定时 JWKS 刷新失败，已知的 `kid` 仍在仍有效的限定缓存中 | 仅在声明的“错误时过时（stale-on-error）”窗口内继续，并发出降级健康证据 |
| 令牌有未知的 `kid`，且允许的一次刷新失败 | 拒绝；绝不接受无法校验的签名 |
| 内省不可用 | 对受保护调用失败关闭；不要将网络故障转换为 `active: true` |
| 受保护资源或签发者元数据意外更改 | 停止新注册和令牌获取；在限定的事件策略下仅保留明确固定、未过期的配置 |
| 吊销端点不可用 | 将登出或吊销报告为未完成，在可能的情况下本地保留该凭据为不可用，且不要声称全局吊销已成功 |
| 时钟源或声明类型无效 | 拒绝而不是扩大偏斜（skew）直至令牌通过 |

将故障与无效凭据分开分类。依赖中断是带有健康和重试策略的操作错误。错误的签名、签发者、受众、过期或范围是授权拒绝。两者都不会到达工具处理器，且都不应将令牌内容泄漏到审计证据中。

### 受众重放演练（访问令牌权限限制）

服务器 A（`notes.example.com`）和服务器 B（`tasks.example.com`）都在同一个授权服务器上注册。服务器 A 被攻破。攻击者获取用户的笔记令牌并将其重放到服务器 B。

服务器 B 的校验器：

1. 解码 JWT，按 `kid` 获取 JWKS，校验签名。
2. 对照其受保护资源元数据的 `authorization_servers` 检查 `iss`。（通过——同一个 IdP。）
3. 检查 `aud == "https://tasks.example.com"`。（失败——令牌的 `aud` 是 `https://notes.example.com`。）
4. 返回带有 `WWW-Authenticate: Bearer error="invalid_token", error_description="audience mismatch", resource_metadata="https://tasks.example.com/.well-known/oauth-protected-resource"` 的 401。

受众声明是在协议层抵御此攻击的唯一防线。为了性能而跳过它是最常见的生产错误；校验器必须在每个请求上运行，而不仅在校验会话开始时。规范将此称为**访问令牌权限限制**：MCP 服务器 `MUST` 拒绝任何未在受众中命名它的令牌。

> **命名说明。** 规范保留术语*混淆代理人（confused deputy）*用于一个相关但不同的问题：一个作为 OAuth **代理**连接到第三方 API 的 MCP 服务器，使用静态客户端 ID，在没有获得每客户端用户同意的情况下转发令牌。受众绑定修复了上述重放；混淆代理人的修复是每客户端同意**加上**绝不能将入站令牌传递给上游 API（MCP 服务器 `MUST` 获取其自己单独的上游令牌）。

### 混合攻击（服务器无法提供的客户端侧防御）

一个客户端在其生命周期内与许多授权服务器通信。恶意 AS 可以尝试让客户端在攻击者的令牌端点兑换诚实 AS 的授权码。受众绑定在这里无济于事——攻击发生在任何令牌存在之前。防御存在于客户端（RFC 9207）：

1. 在重定向之前，客户端从经过校验的 AS 元数据中记录预期的 `issuer`。
2. 在授权响应上，客户端在将代码发送到任何地方之前，将返回的 `iss` 参数与该记录的签发者进行比较（简单字符串比较，无规范化）。
3. 不匹配（或当 AS 已公告 `authorization_response_iss_parameter_supported` 时 `iss` 缺失）→ 拒绝，甚至不要显示 `error` 字段。

仅凭 PKCE 无法阻止混合攻击，因为客户端将其 `code_verifier` 交给它被引导到的任何令牌端点。这就是为什么规范按请求将签发者与 PKCE 验证器和 `state` 一起记录。

### 失败模式

- **过时的 JWKS。** AS 轮换密钥后，校验器拒绝有效令牌。修复方法是上述的定时刷新 + 缓存未命中重新获取模式。绝不要在没有刷新任务的情况下缓存 JWKS。
- **轮换作为后备。** 将缓存未命中路径连接到轮换并铸造而非重新获取是一个真实的缺陷：它永远不会产生缺失的 `kid`，并且它将攻击者控制的 `kid` 值变成密钥创建 DoS。后备必须是幂等的 `refresh-jwks`。
- **缺失 `aud` 声明。** 一些 IdP 默认省略 `aud`，除非 `resource` 存在于令牌请求中。校验器必须拒绝缺失 `aud` 的令牌，而不是将缺失视为通配符。
- **通过缺失 `iss` 检查的混合攻击。** 一个未将 RFC 9207 `iss` 授权响应参数与其在重定向之前记录的签发者进行校验的客户端，可能被引导在攻击者的令牌端点兑换诚实 AS 的代码。这是客户端侧失败；资源服务器无法补偿。
- **范围升级竞争。** 同一用户的两个并发步进流程都可以成功并产生两个具有不同范围的访问令牌。校验器必须使用请求中出示的令牌，而不是查找“用户的当前范围”——那会造成一个 TOCTOU 窗口。
- **注册令牌窃取。** 泄漏的 `registration_access_token` 允许攻击者重写重定向 URI。在静态存储时进行哈希；要求客户端在每次更新时出示明文；有嫌疑时轮换。
- **`iss` 未固定。** 接受任意 `iss` 的校验器允许攻击者搭建自己的授权服务器，为目标受众注册客户端，并签发令牌。受保护资源元数据的 `authorization_servers` 列表是允许列表；强制执行它。
- **凭据或令牌缓存冲突。** 仅按资源键控注册的客户端可以向另一个授权服务器出示一个授权服务器的身份。仅按签发者键控访问令牌的客户端可能在错误的受众重放令牌。按经过校验的签发者键控注册，按 `(issuer, resource)` 键控访问令牌，并在签发者更改时重新注册。

```figure
t3-jwks-rotate
```

## 使用它

`code/main.py` 使用标准库 Python 和三个角色：`AuthorizationServer`、`ResourceServer` 和 `Client`，演练完整的生产流程。流程如下：

从仓库根目录，运行：

```bash
cd phases/13-tools-and-protocols/18-mcp-auth-production
python3 code/main.py
python3 -m unittest discover -s code/tests -v
```

第一个命令打印基于签发者的注册和令牌校验记录。第二个命令报告十八个通过的检查。两个命令都不会打开网络监听器或写入凭据。

1. 授权服务器在 `/.well-known/oauth-authorization-server` 发布 RFC 8414 元数据。
2. MCP 客户端调用元数据端点，并检查其注册选项（CIMD 的 `client_id_metadata_document_supported`，DCR 的 `registration_endpoint`）和 `S256` PKCE 支持。
3. 客户端检查是否存在按签发者作用域的预注册，否则使用其 HTTPS Client ID Metadata Document 进行注册。已弃用的 DCR 仍作为一种可单独测试的兼容方法保留。
4. 客户端记录经过校验的签发者，创建一个 S256 挑战，接收一次性授权码加上 `iss`，校验返回的签发者，并使用原始验证器和 RFC 8707 `resource` 指示符兑换该代码。
5. MCP 客户端使用 `Authorization: Bearer ...` 在 MCP 服务器上调用工具。
6. MCP 服务器运行 `validate`，从 JWKS 缓存中解析签名密钥。
7. IdP 轮换一个密钥；定时刷新将 JWKS 重新拉入缓存。
8. 下一次调用对照刷新后的密钥进行校验而无需重启，且先前的令牌在重叠窗口期间仍然有效。
9. 针对另一个 MCP 资源的受众重放尝试会得到 401，附带 `audience mismatch` 和一个 `resource_metadata` 指针。

这里的 JWT 使用带共享密钥的 HS256（因此本课仅依赖标准库）。生产环境使用 RS256 或 EdDSA 配合上述 JWKS 模式；校验逻辑在其他方面完全相同。由于 IdP 和资源服务器位于同一进程中，`refresh_jwks` 直接读取授权服务器的密钥列表；通过网络传输时，它是对 `jwks_uri` 的 HTTP `GET`。

## 交付它

本课程产生 `outputs/skill-mcp-auth.md`。给定一个 MCP 服务器配置和一组 IdP 能力，该技能会输出需要搭建的认证暴露面——受保护资源元数据、要使用的注册路径（CIMD、预注册或 DCR 后备）、JWKS 刷新计划、范围映射，以及当 IdP 不支持完整 RFC 配置时要应用的拒绝规则。

## 练习

1. 运行 `code/main.py`。追踪流程。注意 IdP 如何在第 6 步轮换密钥，定时的 `refresh_jwks` 如何重新拉取已发布的集合，以及旧令牌（重叠窗口）和新令牌如何都在不重启的情况下通过校验。

2. 向受保护资源元数据的 `authorization_servers` 列表添加一个新的 IdP。签发一个由新 IdP 签名的令牌，并确认校验器接受它。签发一个由未列出 IdP 签名的令牌，并确认校验器以 `WWW-Authenticate: Bearer error="invalid_token", error_description="iss not allowed"` 拒绝。

3. 向 `register_client` 添加一个速率限制检查，在注册机构接受请求之前运行。使用按源 IP 的令牌桶，保存在一个按 IP 键控的小字典中。

4. 阅读 RFC 7591，找出本课的 `/register` 处理器未校验的两个字段。添加校验。（提示：`software_statement` 和 `redirect_uris` URI 方案。）

5. 添加第二个授权服务器。确认客户端存储单独的按签发者键控的注册，并拒绝复用第一个签发者的令牌或 `client_id`。

6. 证明 DoS 修复。向校验器发送一个带有随机 `kid` 的令牌，并确认 `refresh_jwks` 至多运行一次，且授权服务器的密钥数量不增长。然后故意将后备重新连接为轮换并铸造，观察密钥数量随每个伪造令牌攀升——之后恢复为重新获取。

7. 用 `native` 和 `web` 两种客户端测试已弃用的 DCR。确认带有 HTTP 重定向 URI 的 Web 客户端和没有精确回环重定向的原生客户端均被拒绝。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| ASM | “OAuth 元数据文档” | RFC 8414 `/.well-known/oauth-authorization-server` JSON |
| CIMD | “客户端元数据 URL” | Client ID Metadata Document：用作 `client_id` 的 HTTPS URL；由 AS 拉取 JSON。MCP 2026-07-28 中的首选注册 |
| DCR | “自助客户端注册” | RFC 7591 `POST /register`；对当前 MCP 已弃用，仅为兼容而保留 |
| JWKS | “用于 JWT 校验的公钥” | JSON Web Key Set，从 `jwks_uri` 获取，按 `kid` 索引 |
| 轮换 vs 刷新 | “更新密钥” | *轮换* = AS 铸造/停用签名密钥；*刷新* = 资源服务器重新获取已发布的集合。资源服务器只执行刷新 |
| 资源指示符 | “受众参数” | RFC 8707 `resource` 参数，将令牌固定到一台服务器 |
| `aud` 声明 | “受众” | 校验器对照规范化资源 URL 进行比较的 JWT 声明 |
| 受众重放 | “令牌重放” | 为服务器 A 签发的令牌被出示给服务器 B；由受众校验防御（规范：访问令牌权限限制） |
| 混淆代理人 | “代理令牌滥用” | 具有静态客户端 ID 的 MCP 代理在没有每客户端同意的情况下转发令牌；与受众重放不同 |
| 混合攻击 | “错误的令牌端点” | 客户端被引导在攻击者的端点兑换诚实 AS 的代码；通过 RFC 9207 `iss` 在客户端侧防御 |
| `iss` 允许列表 | “受信任的授权服务器” | 受保护资源元数据的 `authorization_servers` 中命名的集合 |
| `resource_metadata` | “在哪里找到 PRM 文档” | 在 401/403 上命名 RFC 9728 元数据 URL 的 `WWW-Authenticate` 参数 |
| 公共客户端 | “原生或浏览器客户端” | 没有 `client_secret` 的 OAuth 客户端；PKCE 作为补偿 |
| `WWW-Authenticate` | “401/403 响应头” | 携带驱动客户端恢复的 `Bearer error=...` 指令 |

## 延伸阅读

- [MCP 授权规范 (2026-07-28)](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization) - 当前的 MCP 授权配置
- [MCP 2026-07-28 变更日志](https://modelcontextprotocol.io/specification/2026-07-28/changelog) - CIMD、签发者校验、DCR 弃用以及按签发者键控凭据的更改
- [OAuth Client ID Metadata Document (draft-ietf-oauth-client-id-metadata-document-00)](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-client-id-metadata-document-00) — CIMD
- [RFC 8414 — OAuth 2.0 授权服务器元数据](https://datatracker.ietf.org/doc/html/rfc8414) — 发现契约
- [RFC 7591 — OAuth 2.0 动态客户端注册协议](https://datatracker.ietf.org/doc/html/rfc7591) — DCR（后备路径）
- [RFC 7636 — 代码交换证明密钥 (PKCE)](https://datatracker.ietf.org/doc/html/rfc7636) — 公共客户端占有证明
- [RFC 8707 — OAuth 2.0 的资源指示符](https://datatracker.ietf.org/doc/html/rfc8707) — 受众固定
- [RFC 9728 — OAuth 2.0 受保护资源元数据](https://datatracker.ietf.org/doc/html/rfc9728) — 资源服务器发现
- [RFC 9207 — OAuth 2.0 授权服务器签发者识别](https://datatracker.ietf.org/doc/html/rfc9207) — 防御混合攻击的 `iss` 参数
- [RFC 7662: OAuth 2.0 令牌内省](https://datatracker.ietf.org/doc/html/rfc7662)
- [RFC 7009: OAuth 2.0 令牌吊销](https://datatracker.ietf.org/doc/html/rfc7009)