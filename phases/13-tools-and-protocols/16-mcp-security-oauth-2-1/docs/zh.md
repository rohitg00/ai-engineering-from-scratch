# 16 · MCP 安全 II — OAuth 2.1、资源指示符与增量授权范围

> 远程 MCP 服务器需要的是授权（authorization），而不只是身份认证（authentication）。2025-11-25 规范与 OAuth 2.1 + PKCE + 资源指示符（resource indicators，RFC 8707）+ 受保护资源元数据（protected-resource metadata，RFC 9728）对齐。SEP-835 引入了增量授权范围同意机制，并在收到 403 WWW-Authenticate 时执行升级授权（step-up authorization）。本课将升级流程实现为一个状态机，让你看清每一跳。

**类型：** 构建（Build）
**语言：** Python（标准库，OAuth 状态机模拟器）
**前置：** 第 13 阶段 · 09（传输层）、第 13 阶段 · 15（安全 I）
**时长：** 约 75 分钟

## 学习目标

- 区分资源服务器（resource server）与授权服务器（authorization server）的职责。
- 走通受 PKCE 保护的 OAuth 2.1 授权码（authorization code）流程。
- 使用 `resource`（RFC 8707）与受保护资源元数据（RFC 9728）来防范混淆代理（confused-deputy）攻击。
- 实现升级授权：服务器返回 403 并在 WWW-Authenticate 中请求更高的授权范围；客户端重新征求用户同意并重试。

## 问题所在

早期的 MCP（2025 年之前）发布的远程服务器使用临时拼凑的 API key，甚至完全不做鉴权。2025-11-25 规范通过一套完整的 OAuth 2.1 profile 弥补了这一缺口。

三类真实需求：

- **普通远程服务器。** 用户安装了一个访问其 Notion / GitHub / Gmail 的远程 MCP 服务器。OAuth 2.1 + PKCE 正是恰当的形态。
- **授权范围升级（scope escalation）。** 一个已获授 `notes:read` 的笔记服务器，之后某个具体操作可能需要 `notes:write`。无需重走整个流程，升级（SEP-835）会按需请求这个额外的授权范围。
- **防范混淆代理。** 客户端持有一个受众（audience）限定为服务器 A 的 token。服务器 A 是恶意的，试图把该 token 出示给服务器 B。资源指示符（RFC 8707）将 token 钉死在其预期受众上。

OAuth 2.1 并不新鲜。新的是 MCP 的 profile：明确要求的流程（仅授权码 + PKCE；默认不允许隐式流程，不允许客户端凭据模式）、每次 token 请求都强制带上资源指示符，以及发布受保护资源元数据让客户端知道去哪里。

## 核心概念

### 角色

- **客户端（Client）。** MCP 客户端（Claude Desktop、Cursor 等）。
- **资源服务器（Resource server）。** MCP 服务器（笔记、GitHub、Postgres 等等）。
- **授权服务器（Authorization server）。** 签发 token。它可能与资源服务器是同一个服务，也可能是独立的身份提供方（IdP，如 Auth0、Keycloak、Cognito）。

在 MCP 的 profile 中，资源服务器与授权服务器**可以（CAN）**是同一台主机，但**应当（SHOULD）**通过 URL 加以区分。

### 授权码 + PKCE

流程：

1. 客户端生成 `code_verifier`（随机）和 `code_challenge`（SHA256）。
2. 客户端把用户重定向到 `/authorize?response_type=code&client_id=...&redirect_uri=...&scope=notes:read&code_challenge=...&resource=https://notes.example.com`。
3. 用户同意。授权服务器重定向回 `redirect_uri?code=...`。
4. 客户端向 `/token?grant_type=authorization_code&code=...&code_verifier=...&resource=...` 发起 POST。
5. 授权服务器将 verifier 的哈希与先前存储的 challenge 进行校验，并签发访问令牌（access token）。
6. 客户端使用该 token：对资源服务器的每次请求都带上 `Authorization: Bearer ...`。

PKCE 防范授权码拦截攻击。资源指示符防止 token 在别处也有效。

### 受保护资源元数据（RFC 9728）

资源服务器发布一份 `.well-known/oauth-protected-resource` 文档：

```json
{
  "resource": "https://notes.example.com",
  "authorization_servers": ["https://auth.example.com"],
  "scopes_supported": ["notes:read", "notes:write", "notes:delete"]
}
```

客户端从资源服务器发现授权服务器。这减少了配置——客户端只需要资源 URL。

### 资源指示符（RFC 8707）

token 请求中的 `resource` 参数把 token 的预期受众钉死。签发出的 token 包含 `aud: "https://notes.example.com"`。另一个收到此 token 的 MCP 服务器会检查 `aud` 并拒绝它。

### 授权范围模型

授权范围是以空格分隔的字符串。常见的 MCP 约定：

- `notes:read`、`notes:write`、`notes:delete`
- `admin:*` 表示管理能力（谨慎使用）
- `profile:read` 表示身份

授权范围的选取应遵循最小权限（least-privilege）：现在需要什么就请求什么，需要更多时再升级。

### 升级授权（SEP-835）

用户授予了 `notes:read`。之后他们要求 agent 删除一条笔记。服务器响应：

```
HTTP/1.1 403 Forbidden
WWW-Authenticate: Bearer error="insufficient_scope",
    scope="notes:delete", resource="https://notes.example.com"
```

客户端看到 insufficient_scope 错误，弹出同意对话框向用户请求这个额外的授权范围，为它执行一次小型 OAuth 流程，然后用新 token 重试请求。

### token 受众校验

每次请求：服务器检查 `token.aud == self.resource_url`。不匹配即返回 401。这阻止了 token 被跨服务器复用。

### 短时效 token 与轮换

访问令牌**应当（SHOULD）**是短时效的（默认 1 小时）。刷新令牌（refresh token）在每次刷新时轮换。客户端在后台处理静默刷新。

### 禁止 token 透传

采样（sampling）服务器（第 13 阶段 · 11）**绝不能（MUST NOT）**把客户端的 token 透传给其他服务。采样请求就是边界。

### 防范混淆代理

token 绑定到 `aud`。客户端绑定到 `client_id`。每次请求都同时针对两者校验。规范明确禁止了在 MCP 之前的远程工具生态中常见的旧式「token 透传」模式。

### 客户端 ID 发现

每个 MCP 客户端在一个固定 URL 上发布其元数据。授权服务器可以拉取该客户端的元数据文档，发现其重定向 URI 和联系信息。这免去了手动注册客户端的步骤。

### 网关与 OAuth

第 13 阶段 · 17 展示企业网关如何处理 OAuth：网关持有上游服务器的凭据，发给客户端的 token 由网关签发，上游 token 永不离开网关。这翻转了信任模型——用户只需向网关认证一次；网关负责处理对 N 个服务器的授权。

## 动手用起来

`code/main.py` 把完整的 OAuth 2.1 升级流程模拟成一个状态机。它实现了：

- PKCE 的 code-verifier / challenge 生成。
- 带资源指示符的授权码流程。
- 受保护资源元数据端点。
- 带受众校验的 token 验证。
- 在 `insufficient_scope` 时执行升级。

本课没有 HTTP 服务器；状态机在内存中运行，便于你追踪每一跳。第 13 阶段 · 17 的网关课会把它接到真实的传输层上。

## 交付物

本课产出 `outputs/skill-oauth-scope-planner.md`。给定一个带工具的远程 MCP 服务器，该 skill 会设计授权范围集合、钉死规则与升级策略。

## 练习

1. 运行 `code/main.py`。追踪双授权范围的升级流程。留意哪些跳在升级时会重复。

2. 添加刷新令牌轮换：每次刷新都签发一个新的刷新令牌并使旧的失效。模拟一个被盗的刷新令牌在轮换后被使用，并确认它会失败。

3. 用标准库 http.server 把受保护资源元数据端点实现为真实的 HTTP 响应。仿照第 09 课的 /mcp 端点。

4. 为一个 GitHub MCP 服务器设计授权范围层级：读取仓库、写入 PR、批准 PR、合并 PR、管理。在每一级之间使用升级。

5. 阅读 RFC 8707 与 RFC 9728。找出 9728 中 MCP 与 RFC 示例用法不同的那一个字段。（提示：它与 `scopes_supported` 有关。）

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| OAuth 2.1 | 「现代 OAuth」 | 整合后的 RFC，强制 PKCE 并禁止隐式流程 |
| PKCE | 「持有证明」 | code verifier + challenge，挫败授权码拦截 |
| 资源指示符 | 「token 受众」 | RFC 8707 的 `resource` 参数，将 token 钉到某一台服务器 |
| 受保护资源元数据 | 「发现文档」 | RFC 9728 的 `.well-known/oauth-protected-resource` |
| 升级授权 | 「增量同意」 | SEP-835 的按需新增授权范围的流程 |
| `insufficient_scope` | 「带 WWW-Authenticate 的 403」 | 服务器要求为更大授权范围重新同意的信号 |
| 混淆代理 | 「token 跨服务复用」 | 受信任的持有者不当转发 token 的攻击 |
| 短时效 token | 「访问令牌 TTL」 | 快速过期的 Bearer；由刷新令牌续期 |
| 授权范围层级 | 「最小权限栈」 | 分级的授权范围集合，各级之间用升级衔接 |
| 客户端 ID 元数据 | 「客户端发现文档」 | 客户端发布自身 OAuth 元数据的 URL |

## 延伸阅读

- [MCP — Authorization spec](https://modelcontextprotocol.io/specification/draft/basic/authorization) — MCP OAuth profile 的权威规范
- [den.dev — MCP November authorization spec](https://den.dev/blog/mcp-november-authorization-spec/) — 对 2025-11-25 变更的逐项讲解
- [RFC 8707 — Resource indicators for OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc8707) — 受众钉死的 RFC
- [RFC 9728 — OAuth 2.0 protected resource metadata](https://datatracker.ietf.org/doc/html/rfc9728) — 发现文档的 RFC
- [Aembit — MCP OAuth 2.1, PKCE and the future of AI authorization](https://aembit.io/blog/mcp-oauth-2-1-pkce-and-the-future-of-ai-authorization/) — 实用的升级流程讲解
