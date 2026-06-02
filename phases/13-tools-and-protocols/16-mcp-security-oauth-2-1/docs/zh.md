# MCP 安全 II — OAuth 2.1、Resource Indicators、增量 Scopes

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 远端 MCP server 需要的是授权（authorization），不只是认证（authentication）。2025-11-25 spec 与 OAuth 2.1 + PKCE + resource indicators（RFC 8707）+ protected-resource metadata（RFC 9728）对齐。SEP-835 又加了增量 scope 同意（incremental scope consent），通过 403 WWW-Authenticate 触发 step-up authorization（升级授权）。本课把 step-up 流程实现成一个状态机，让你看清每一跳。

**Type:** Build
**Languages:** Python（stdlib，OAuth 状态机模拟器）
**Prerequisites:** Phase 13 · 09（transports）、Phase 13 · 15（security I）
**Time:** ~75 分钟

## 学习目标（Learning Objectives）

- 区分 resource server 与 authorization server 的职责。
- 走通带 PKCE 保护的 OAuth 2.1 authorization code flow。
- 用 `resource`（RFC 8707）和 protected-resource metadata（RFC 9728）防止 confused-deputy（混淆代理）攻击。
- 实现 step-up authorization：server 用 403 + WWW-Authenticate 索取更高 scope；client 重新征求用户同意并重试。

## 问题（The Problem）

早期 MCP（2025 之前）的远端 server 要么用临时 API key，要么干脆没有认证。2025-11-25 spec 用一份完整的 OAuth 2.1 profile 把这道口子补上。

三类真实需求：

- **常规远端 server。** 用户装一个能访问其 Notion / GitHub / Gmail 的远端 MCP server。OAuth 2.1 + PKCE 是合适的形态。
- **Scope 升级。** 一个被授予 `notes:read` 的 notes server，到了某个动作时可能需要 `notes:write`。step-up（SEP-835）只索取增量 scope，而不是把整套流程重做一遍。
- **混淆代理（confused deputy）防护。** Client 持有一枚 audience 绑定到 Server A 的 token。Server A 心怀不轨，把这枚 token 拿去 Server B 试探。Resource indicators（RFC 8707）把 token 钉死在它原本的 audience 上。

OAuth 2.1 不是新东西。新的是 MCP 的 profile：明确强制的流程（只允许 authorization code + PKCE；默认禁用 implicit、禁用 client credentials）、每个 token 请求都强制带上 resource indicators、并且要求 server 公开 protected-resource metadata 让 client 知道往哪儿去。

## 概念（The Concept）

### 角色（Roles）

- **Client。** MCP client（Claude Desktop、Cursor 之类）。
- **Resource server。** MCP server（notes、GitHub、Postgres，随便什么）。
- **Authorization server。** 颁发 token。可以和 resource server 是同一个服务，也可以是独立 IdP（Auth0、Keycloak、Cognito）。

在 MCP 的 profile 里，resource server 和 authorization server 可以同主机（CAN），但应当（SHOULD）通过不同 URL 加以区分。

### Authorization code + PKCE

流程：

1. Client 生成 `code_verifier`（随机）和 `code_challenge`（SHA256）。
2. Client 把用户重定向到 `/authorize?response_type=code&client_id=...&redirect_uri=...&scope=notes:read&code_challenge=...&resource=https://notes.example.com`。
3. 用户同意。Authorization server 重定向到 `redirect_uri?code=...`。
4. Client POST 到 `/token?grant_type=authorization_code&code=...&code_verifier=...&resource=...`。
5. Authorization server 用 verifier 的哈希对照存好的 challenge 校验，签发 access token。
6. Client 拿这枚 token，每次请求 resource server 都带 `Authorization: Bearer ...`。

PKCE 防的是 authorization-code 拦截攻击。Resource indicators 让 token 在别处失效。

### Protected-resource metadata（RFC 9728）

Resource server 公开一份 `.well-known/oauth-protected-resource` 文档：

```json
{
  "resource": "https://notes.example.com",
  "authorization_servers": ["https://auth.example.com"],
  "scopes_supported": ["notes:read", "notes:write", "notes:delete"]
}
```

Client 从 resource server 那里发现 authorization server。配置量被压到极小——client 只需要知道 resource URL。

### Resource indicators（RFC 8707）

Token 请求里的 `resource` 参数把 token 想要面向的 audience 钉死。签发出来的 token 里带 `aud: "https://notes.example.com"`。别的 MCP server 收到这枚 token，会检查 `aud` 然后拒绝。

### Scope 模型

Scope 是空格分隔的字符串。MCP 常见约定：

- `notes:read`、`notes:write`、`notes:delete`
- `admin:*`（admin 能力，慎用）
- `profile:read`（身份）

Scope 选择应当遵循最小权限：现在用得着的就申请，需要更多再 step-up。

### Step-up authorization（SEP-835）

用户授予了 `notes:read`，之后要求 agent 删一条笔记。Server 回应：

```
HTTP/1.1 403 Forbidden
WWW-Authenticate: Bearer error="insufficient_scope",
    scope="notes:delete", resource="https://notes.example.com"
```

Client 看到 insufficient_scope 错误，弹一个针对增量 scope 的同意对话框，跑一次迷你 OAuth flow，再用新 token 重试请求。

### Token audience 校验

每次请求：server 检查 `token.aud == self.resource_url`。不一致就 401。这堵住了跨 server token 复用。

### 短寿命 token 与轮换（Short-lived tokens and rotation）

Access token 应当（SHOULD）短寿命（默认 1 小时）。Refresh token 每次刷新都轮换。Client 在后台静默 refresh。

### 不要 token 透传（No token passthrough）

Sampling server（Phase 13 · 11）绝对不能（MUST NOT）把 client 的 token 透传给其他服务。Sampling 请求就是边界。

### 混淆代理防护（Confused deputy prevention）

Token 绑 `aud`。Client 绑 `client_id`。每次请求都两边都校验。spec 明确禁掉了 MCP 之前那种远端工具生态里很普遍的"token 直接透传"模式。

### Client ID 发现

每个 MCP client 在固定 URL 发布自己的 metadata。Authorization server 可以拉取 client 的 metadata 文档，发现它的 redirect URI 和联系信息。这样就不用手工注册 client 了。

### Gateway 与 OAuth

Phase 13 · 17 演示企业 gateway 如何处理 OAuth：gateway 持有面向上游 server 的凭证，发给 client 的 token 由 gateway 自己签，上游 token 永远不出 gateway。这翻转了信任模型——用户只对 gateway 认证一次；gateway 处理 N 个 server 的授权。

## 用起来（Use It）

`code/main.py` 把整套 OAuth 2.1 step-up flow 模拟成一个状态机。它实现了：

- PKCE code-verifier / challenge 生成。
- 带 resource indicator 的 authorization code flow。
- Protected-resource metadata 端点。
- 带 audience 校验的 token 校验。
- `insufficient_scope` 上的 step-up。

本课没有真实的 HTTP server；状态机在内存里跑，让你能逐跳追踪每一步。Phase 13 · 17 的 gateway 课会把它接到真正的 transport 上。

## 上线部署（Ship It）

本课产出 `outputs/skill-oauth-scope-planner.md`。给一个带工具集的远端 MCP server，这个 skill 帮你设计 scope 集合、pinning 规则和 step-up 策略。

## 练习（Exercises）

1. 跑 `code/main.py`。追一遍两段式 scope step-up 流程。注意 step-up 时哪些 hop 是重复的。

2. 加上 refresh token 轮换：每次刷新都签发新的 refresh token、并把旧的作废。模拟一枚被偷的 refresh token 在轮换之后被用，确认它失败。

3. 用 stdlib `http.server` 把 protected-resource metadata 端点实现成真实的 HTTP 响应。对齐 Lesson 09 里的 /mcp 端点。

4. 给一个 GitHub MCP server 设计 scope 层级：read repo、write PR、approve PR、merge PR、admin。每两级之间用 step-up。

5. 读 RFC 8707 和 RFC 9728。找出 9728 里 MCP 用法和 RFC 示例不一样的那一个字段。（提示：和 `scopes_supported` 有关。）

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际含义 |
|------|----------------|------------------------|
| OAuth 2.1 | "现代 OAuth" | 强制 PKCE、禁用 implicit flow 的整合 RFC |
| PKCE | "持有性证明（proof-of-possession）" | Code verifier + challenge，挫败 authorization-code 拦截 |
| Resource indicator | "Token audience" | RFC 8707 的 `resource` 参数，把 token 钉到一个 server |
| Protected-resource metadata | "Discovery 文档" | RFC 9728 的 `.well-known/oauth-protected-resource` |
| Step-up authorization | "增量 consent" | SEP-835 的按需追加 scope 流程 |
| `insufficient_scope` | "带 WWW-Authenticate 的 403" | Server 让你为更大的 scope 重新征同意的信号 |
| Confused deputy | "跨服务 token 复用" | 受信任的持有方不当转发 token 的攻击 |
| Short-lived token | "Access token TTL" | 很快过期的 bearer；用 refresh token 续 |
| Scope 层级（Scope hierarchy） | "最小权限栈" | 分级 scope 集合，层与层之间用 step-up |
| Client ID metadata | "Client 发现文档" | Client 用来发布自己 OAuth metadata 的 URL |

## 延伸阅读（Further Reading）

- [MCP — Authorization spec](https://modelcontextprotocol.io/specification/draft/basic/authorization) — MCP OAuth profile 的官方定义
- [den.dev — MCP November authorization spec](https://den.dev/blog/mcp-november-authorization-spec/) — 2025-11-25 变更的逐点解读
- [RFC 8707 — Resource indicators for OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc8707) — audience-pinning 的 RFC
- [RFC 9728 — OAuth 2.0 protected resource metadata](https://datatracker.ietf.org/doc/html/rfc9728) — discovery-document 的 RFC
- [Aembit — MCP OAuth 2.1, PKCE and the future of AI authorization](https://aembit.io/blog/mcp-oauth-2-1-pkce-and-the-future-of-ai-authorization/) — 实战向的 step-up flow 走查
