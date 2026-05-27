# MCP 安全 II — OAuth 2.1、资源指示器、增量作用域

> 远程 MCP 服务器需要授权，而不仅仅是身份验证。2025-11-25 规范与 OAuth 2.1 + PKCE + 资源指示器 (RFC 8707) + 受保护资源元数据 (RFC 9728) 保持一致。SEP-835 在 403 WWW-Authenticate 上添加了增量作用域同意和逐步授权。本课将逐步授权流程实现为状态机，以便你可以看到每一次跳转。

**类型：** 构建
**语言：** Python (stdlib, OAuth 状态机模拟器)
**前置条件：** 阶段 13 · 09 (传输层), 阶段 13 · 15 (安全 I)
**时间：** ~75 分钟

## 学习目标

- 区分资源服务器和授权服务器的职责。
- 演练 PKCE 保护的 OAuth 2.1 授权代码流程。
- 使用 `resource` (RFC 8707) 和受保护资源元数据 (RFC 9728) 来防止混淆 deputy 攻击。
- 实现逐步授权：服务器响应 403 并带有 WWW-Authenticate，请求更高作用域；客户端重新提示用户同意并重试。

## 问题背景

早期的 MCP（2025 年之前）发布带有临时 API 密钥甚至没有身份验证的远程服务器。2025-11-25 规范通过完整的 OAuth 2.1 配置文件弥补了这一差距。

三个现实需求：

- **普通远程服务器。** 用户安装访问其 Notion / GitHub / Gmail 的远程 MCP 服务器。使用 PKCE 的 OAuth 2.1 是正确的形态。
- **作用域升级。** 被授予 `notes:read` 的笔记服务器可能稍后需要 `notes:write` 以执行特定操作。逐步授权（SEP-835）不是重做整个流程，而是请求额外的作用域。
- **防止混淆的 deputy。** 客户端持有为服务器 A 受众限定范围的令牌。服务器 A 是恶意的并尝试向服务器 B 出示该令牌。资源指示器 (RFC 8707) 将令牌固定到其预期受众。

OAuth 2.1 并不新鲜。新鲜的是 MCP 的配置文件：特定的必需流程（仅授权代码 + PKCE；没有隐式，默认没有客户端凭据），每个令牌请求强制资源指示器，以及发布的受保护资源元数据，以便客户端知道去哪里。

## 概念详解

### 角色

- **客户端。** MCP 客户端（Claude Desktop、Cursor 等）。
- **资源服务器。** MCP 服务器（笔记、GitHub、Postgres，whatever）。
- **授权服务器。** 颁发令牌。可以与资源服务器是同一服务，也可以是单独的 IdP（Auth0、Keycloak、Cognito）。

在 MCP 的配置文件中，资源和授权服务器可以是同一主机，但应该通过 URL 区分。

### 授权代码 + PKCE

流程：

1. 客户端生成 `code_verifier`（随机）和 `code_challenge`（SHA256）。
2. 客户端将用户重定向到 `/authorize?response_type=code&client_id=...&redirect_uri=...&scope=notes:read&code_challenge=...&resource=https://notes.example.com`。
3. 用户同意。授权服务器重定向到 `redirect_uri?code=...`。
4. 客户端 POST 到 `/token?grant_type=authorization_code&code=...&code_verifier=...&resource=...`。
5. 授权服务器根据存储的 challenge 验证 verifier 的哈希并颁发访问令牌。
6. 客户端使用令牌：在每个对资源服务器的请求上使用 `Authorization: Bearer ...`。

PKCE 防止授权代码拦截攻击。资源指示器防止令牌在其他地方有效。

### 受保护资源元数据 (RFC 9728)

资源服务器发布 `.well-known/oauth-protected-resource` 文档：

```json
{
  "resource": "https://notes.example.com",
  "authorization_servers": ["https://auth.example.com"],
  "scopes_supported": ["notes:read", "notes:write", "notes:delete"]
}
```

客户端从资源服务器发现授权服务器。减少配置 — 客户端只需要资源 URL。

### 资源指示器 (RFC 8707)

令牌请求中的 `resource` 参数固定令牌的预期受众。颁发的令牌包含 `aud: "https://notes.example.com"`。接收此令牌的另一个 MCP 服务器检查 `aud` 并拒绝它。

### 作用域模型

作用域是以空格分隔的字符串。常见的 MCP 约定：

- `notes:read`、`notes:write`、`notes:delete`
- 用于管理员能力的 `admin:*`（谨慎使用）
- 用于身份的 `profile:read`

作用域选择应该是最小权限：请求你现在需要的，当你需要更多时逐步升级。

### 逐步授权 (SEP-835)

用户授予 `notes:read`。他们稍后要求智能体删除笔记。服务器响应：

```
HTTP/1.1 403 Forbidden
WWW-Authenticate: Bearer error="insufficient_scope",
    scope="notes:delete", resource="https://notes.example.com"
```

客户端看到 insufficient_scope 错误，用额外作用域的同意对话框提示用户，为其执行迷你 OAuth 流程，使用新令牌重试请求。

### 令牌受众验证

每个请求：服务器检查 `token.aud == self.resource_url`。不匹配 = 401。这阻止了跨服务器令牌重用。

### 短寿命令牌和轮换

访问令牌应该短寿命（默认 1 小时）。刷新令牌在每次刷新时轮换。客户端在后台处理静默刷新。

### 无令牌传递

采样服务器（阶段 13 · 11）不得将对其他服务的客户端令牌传递过去。采样请求是边界。

### 防止混淆的 deputy

令牌绑定到 `aud`。客户端绑定到 `client_id`。根据两者验证每个请求。规范明确禁止在 MCP 之前的远程工具生态系统中常见的旧"传递令牌"模式。

### 客户端 ID 发现

每个 MCP 客户端在固定 URL 发布其元数据。授权服务器可以获取客户端的元数据文档以发现重定向 URI 和联系信息。这消除了手动客户端注册。

### 网关和 OAuth

阶段 13 · 17 展示了企业网关如何处理 OAuth：网关持有上游服务器的凭据，向客户端颁发的令牌是网关颁发的，上游令牌永远不会离开网关。这翻转了信任模型 — 用户使用网关进行一次身份验证；网关处理 N 个服务器授权。

## 使用示例

`code/main.py` 将完整的 OAuth 2.1 逐步授权流程模拟为状态机。它实现了：

- PKCE 代码验证器 / challenge 生成。
- 带资源指示器的授权代码流程。
- 受保护资源元数据端点。
- 带受众检查的令牌验证。
- 在 `insufficient_scope` 上逐步升级。

本课中没有 HTTP 服务器；状态机在内存中运行，以便你可以追踪每一次跳转。阶段 13 · 17 的网关课程将其连接到实际传输层。

## 实战输出

本课生成 `outputs/skill-oauth-scope-planner.md`。给定一个带工具的远程 MCP 服务器，该技能设计作用域集、固定规则和逐步升级策略。

## 练习

1. 运行 `code/main.py`。追踪双作用域逐步升级流程。注意在逐步升级时哪些跳转重复。

2. 添加刷新令牌轮换：每次刷新都颁发新的刷新令牌并使旧的失效。模拟轮换后使用被盗刷新令牌并确认它失败。

3. 使用 stdlib http.server 将受保护资源元数据端点实现为真实的 HTTP 响应。镜像第 09 课中的 /mcp 端点。

4. 为 GitHub MCP 服务器设计作用域层次结构：读取仓库、写入 PR、批准 PR、合并 PR、管理员。在每个级别之间使用逐步升级。

5. 阅读 RFC 8707 和 RFC 9728。识别 9728 中 MCP 与 RFC 示例不同地使用的一个字段。（提示：涉及 `scopes_supported`。）

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------|---------|
| OAuth 2.1 | "现代 OAuth" | 强制 PKCE 并禁止隐式流程的合并 RFC |
| PKCE | "拥有的证明" | 代码验证器 + challenge 击败授权代码拦截 |
| 资源指示器 | "令牌受众" | RFC 8707 `resource` 参数将令牌固定到一个服务器 |
| 受保护资源元数据 | "发现文档" | RFC 9728 `.well-known/oauth-protected-resource` |
| 逐步授权 | "增量同意" | SEP-835 按需添加作用域的流程 |
| `insufficient_scope` | "带 WWW-Authenticate 的 403" | 服务器信号重新同意以获取更大作用域 |
| 混淆的 deputy | "跨服务令牌重用" | 受信任持有者不适当地转发令牌的攻击 |
| 短寿命令牌 | "访问令牌 TTL" | 快速过期的 Bearer；刷新令牌续期 |
| 作用域层次结构 | "最小权限堆栈" | 带有级别间逐步升级的分级作用域集 |
| 客户端 ID 元数据 | "客户端发现文档" | 客户端发布其自己的 OAuth 元数据的 URL |

## 延伸阅读

- [MCP — 授权规范](https://modelcontextprotocol.io/specification/draft/basic/authorization) — 权威 MCP OAuth 配置文件
- [den.dev — MCP 11 月授权规范](https://den.dev/blog/mcp-november-authorization-spec/) — 2025-11-25 更改的演练
- [RFC 8707 — OAuth 2.0 的资源指示器](https://datatracker.ietf.org/doc/html/rfc8707) — 受众固定 RFC
- [RFC 9728 — OAuth 2.0 受保护资源元数据](https://datatracker.ietf.org/doc/html/rfc9728) — 发现文档 RFC
- [Aembit — MCP OAuth 2.1、PKCE 和 AI 授权的未来](https://aembit.io/blog/mcp-oauth-2-1-pkce-and-the-future-of-ai-authorization/) — 实用逐步授权流程演练
