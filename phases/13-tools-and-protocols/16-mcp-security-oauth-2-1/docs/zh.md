# MCP 安全 II —— OAuth 2.1、资源指示器、增量范围

> 远程 MCP 服务器需要授权，而不仅仅是身份验证。2025-11-25 规范与 OAuth 2.1 + PKCE + 资源指示器（RFC 8707）+ 受保护资源元数据（RFC 9728）对齐。SEP-835 通过 403 WWW-Authenticate 上的逐步授权来添加增量范围同意。本节将逐步授权流程实现为一个状态机，以便你观察每一个跳转。

**类型：** 构建
**语言：** Python（标准库，OAuth 状态机模拟器）
**前置条件：** 阶段 13 · 09（传输层），阶段 13 · 15（安全 I）
**时长：** 约 75 分钟

## 学习目标

- 区分资源服务器与授权服务器的职责。
- 走通受 PKCE 保护的 OAuth 2.1 授权码流程。
- 使用 `resource`（RFC 8707）和受保护资源元数据（RFC 9728）来防止混淆代理攻击。
- 实现逐步授权：服务器返回 403 及 `WWW-Authenticate`，要求更高范围；客户端重新提示用户同意并重试。

## 问题所在

早期的 MCP（2025 年之前）为远程服务器提供的做法是临时性的 API 密钥甚至没有认证。2025-11-25 规范通过完整的 OAuth 2.1 配置填补了这一缺口。

三个真实需求：

- **普通远程服务器。** 用户安装一个远程 MCP 服务器来访问他们的 Notion / GitHub / Gmail。采用 PKCE 的 OAuth 2.1 是合适的形式。
- **范围升级。** 一个被授予 `notes:read` 范围的笔记服务器，后续某个操作可能需要 `notes:write`。无需重做整个流程，逐步授权（SEP-835）仅请求额外的范围。
- **混淆代理防护。** 客户端持有一个受众限定为服务器 A 的令牌。服务器 A 是恶意的，试图将令牌呈现给服务器 B。资源指示器（RFC 8707）将令牌绑定到其预期的受众。

OAuth 2.1 并非新事物。新的是 MCP 的配置：特定的必需流程（仅授权码 + PKCE；没有隐式流程，默认没有客户端凭证），每个令牌请求中必须包含资源指示器，以及发布受保护资源元数据以便客户端知道去向何方。

## 概念

### 角色

- **客户端。** MCP 客户端（Claude Desktop、Cursor 等）。
- **资源服务器。** MCP 服务器（笔记、GitHub、Postgres 等）。
- **授权服务器。** 颁发令牌。可以是与资源服务器相同的服务，也可以是独立的身份提供商（Auth0、Keycloak、Cognito）。

在 MCP 的配置中，资源服务器和授权服务器**可以**是同一主机，但**应该**通过 URL 加以区分。

### 授权码 + PKCE

流程如下：

1. 客户端生成 `code_verifier`（随机字符串）和 `code_challenge`（SHA256）。
2. 客户端将用户重定向至 `/authorize?response_type=code&client_id=...&redirect_uri=...&scope=notes:read&code_challenge=...&resource=https://notes.example.com`。
3. 用户同意。授权服务器重定向至 `redirect_uri?code=...`。
4. 客户端 POST 至 `/token?grant_type=authorization_code&code=...&code_verifier=...&resource=...`。
5. 授权服务器验证验证器的哈希值是否与存储的挑战值匹配，并颁发访问令牌。
6. 客户端使用令牌：在对资源服务器的每个请求中携带 `Authorization: Bearer ...`。

PKCE 可防止授权码拦截攻击。资源指示器可防止令牌在其他地方有效。

### 受保护资源元数据（RFC 9728）

资源服务器发布 `.well-known/oauth-protected-resource` 文档：

```json
{
  "resource": "https://notes.example.com",
  "authorization_servers": ["https://auth.example.com"],
  "scopes_supported": ["notes:read", "notes:write", "notes:delete"]
}
```

客户端从资源服务器发现授权服务器。这减少了配置量——客户端只需要资源 URL。

### 资源指示器（RFC 8707）

令牌请求中的 `resource` 参数将令牌的预期受众固定下来。颁发的令牌包含 `aud: "https://notes.example.com"`。另一个 MCP 服务器收到此令牌时会检查 `aud` 并拒绝它。

### 范围模型

范围是空格分隔的字符串。常见的 MCP 约定：

- `notes:read`、`notes:write`、`notes:delete`
- `admin:*` 用于管理能力（谨慎使用）
- `profile:read` 用于身份信息

范围选择应遵循最小权限原则：只请求当前所需，需要更多时再逐步提升。

### 逐步授权（SEP-835）

用户授予 `notes:read`。之后他们要求智能体删除一条笔记。服务器响应：

```
HTTP/1.1 403 Forbidden
WWW-Authenticate: Bearer error="insufficient_scope",
    scope="notes:delete", resource="https://notes.example.com"
```

客户端发现 `insufficient_scope` 错误，向用户展示一个同意对话框以获取额外范围，执行一个小型 OAuth 流程来获取该范围，然后使用新令牌重试请求。

### 令牌受众验证

每个请求：服务器检查 `token.aud == self.resource_url`。不匹配则返回 401。这阻止了跨服务器的令牌重用。

### 短生命周期令牌与轮换

访问令牌应为短生命周期（默认 1 小时）。刷新令牌在每次刷新时轮换。客户端在后台静默刷新。

### 禁止令牌透传

采样服务器（阶段 13 · 11）**不得**将客户端的令牌透传给其他服务。采样请求即是边界。

### 混淆代理防护

令牌绑定到 `aud`。客户端绑定到 `client_id`。每个请求都针对两者进行验证。该规范明确禁止了旧的"传递令牌"模式，这种模式在 MCP 之前的远程工具生态系统中很常见。

### 客户端 ID 发现

每个 MCP 客户端在固定 URL 发布其元数据。授权服务器可以获取客户端的元数据文档以发现重定向 URI 和联系信息。这消除了手动客户端注册。

### 网关与 OAuth

阶段 13 · 17 展示了企业网关如何处理 OAuth：网关持有上游服务器的凭证，发给客户端的令牌由网关颁发，上游令牌从不离开网关。这翻转了信任模型——用户只需在网关处认证一次；网关处理 N 个服务器的授权。

## 使用它

`code/main.py` 将完整的 OAuth 2.1 逐步授权流程模拟为一个状态机。它实现了：

- PKCE 验证器 / 挑战值生成。
- 带资源指示器的授权码流程。
- 受保护资源元数据端点。
- 带受众检查的令牌验证。
- 遇到 `insufficient_scope` 时的逐步授权。

本节没有 HTTP 服务器；状态机在内存中运行，以便你可以跟踪每个跳转。阶段 13 · 17 的网关课时将其接入实际的传输层。

## 产出

本节生成 `outputs/skill-oauth-scope-planner.md`。给定一个包含工具的远程 MCP 服务器，该技能将设计范围集、绑定规则和逐步授权策略。

## 练习

1. 运行 `code/main.py`。跟踪两个范围的逐步授权流程。注意在逐步授权时哪些跳转会重复。

2. 添加刷新令牌轮换：每次刷新时颁发一个新的刷新令牌并使旧的失效。模拟一个被盗的刷新令牌在轮换后被使用，并确认它失败。

3. 使用标准库 http.server 将受保护资源元数据端点实现为真实的 HTTP 响应。镜像第 09 课的 `/mcp` 端点。

4. 为 GitHub MCP 服务器设计一个范围层级：读取仓库、编写 PR、审批 PR、合并 PR、管理。在每一级别之间使用逐步授权。

5. 阅读 RFC 8707 和 RFC 9728。找出 9728 中 MCP 使用方式与 RFC 示例不同的一个字段。（提示：涉及 `scopes_supported`。）

## 关键术语

| 术语 | 通俗说法 | 实际含义 |
|------|---------|---------|
| OAuth 2.1 | "现代 OAuth" | 整合的 RFC，强制要求 PKCE 并禁止隐式流程 |
| PKCE | "持有证明" | 验证器 + 挑战值，抵御授权码拦截 |
| 资源指示器 | "令牌受众" | RFC 8707 `resource` 参数，将令牌绑定到单一服务器 |
| 受保护资源元数据 | "发现文档" | RFC 9728 `.well-known/oauth-protected-resource` |
| 逐步授权 | "增量同意" | SEP-835 按需添加范围的流程 |
| `insufficient_scope` | "403 with WWW-Authenticate" | 服务器信号，要求重新同意以获取更大范围 |
| 混淆代理 | "跨服务令牌重用" | 可信持有者不当转发令牌的攻击 |
| 短生命周期令牌 | "访问令牌 TTL" | 快速过期的持有者令牌；由刷新令牌续期 |
| 范围层级 | "最小权限栈" | 分级范围集，级别之间通过逐步授权切换 |
| 客户端 ID 元数据 | "客户端发现文档" | 客户端发布自身 OAuth 元数据的 URL |

## 延伸阅读

- [MCP —— 授权规范](https://modelcontextprotocol.io/specification/draft/basic/authorization) —— 规范的 MCP OAuth 配置
- [den.dev —— MCP 11 月授权规范](https://den.dev/blog/mcp-november-authorization-spec/) —— 2025-11-25 变更详解
- [RFC 8707 —— OAuth 2.0 的资源指示器](https://datatracker.ietf.org/doc/html/rfc8707) —— 受众绑定的 RFC
- [RFC 9728 —— OAuth 2.0 受保护资源元数据](https://datatracker.ietf.org/doc/html/rfc9728) —— 发现文档的 RFC
- [Aembit —— MCP OAuth 2.1、PKCE 与 AI 授权的未来](https://aembit.io/blog/mcp-oauth-2-1-pkce-and-the-future-of-ai-authorization/) —— 逐步授权流程实践详解
