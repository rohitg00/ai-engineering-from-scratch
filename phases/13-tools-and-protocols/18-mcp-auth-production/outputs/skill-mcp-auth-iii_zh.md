---
name: mcp-auth-iii-wiring
description: 将生产 MCP 授权（RFC 8414、7591、8707、7636 PKCE、9728）连接到 iii 原语 — registerTrigger 用于 HTTP/cron，registerFunction 用于验证，state::* 用于 JWKS 缓存。
version: 1.0.0
phase: 13
lesson: 18
tags: [mcp, oauth, dcr, jwks, iii, rfc8414, rfc7591, rfc8707, rfc7636, rfc9728]
---

给定 MCP 服务器配置和 IdP 能力集，发出构成生产授权表面的 iii 原语和拒绝规则。

输入：

- `mcp_resource_url` — 规范资源 URL（无路径），用作 `aud` 和受保护资源元数据 `resource` 值。
- `idp_metadata_url` — IdP 的 `/.well-known/oauth-authorization-server` URL。
- `idp_capabilities` — `code_challenge_methods_supported`、`grant_types_supported`、`registration_endpoint`、`response_types_supported` 的观察值。
- `tools` — 带有每个所需范围的 MCP 工具列表。

生成：

1. **拒绝门。** 如果四个条件中任何一个失败，拒绝连接并停止：
   - `S256` 缺失于 `code_challenge_methods_supported`。
   - `authorization_code` 缺失于 `grant_types_supported`。
   - `registration_endpoint` 不存在（无 RFC 7591 DCR）。
   - `response_types_supported` 不是恰好 `["code"]`。

2. **受保护资源元数据文档**（RFC 9728），供 MCP 服务器在 `/.well-known/oauth-protected-resource` 发布。包含 `resource`、`authorization_servers`（发行者允许列表）、`scopes_supported`、`bearer_methods_supported: ["header"]`。

3. **iii 触发器注册。** 逐字发出每个调用：
   - `iii.registerTrigger("http", {"path": "/.well-known/oauth-protected-resource", "method": "GET"}, "auth::serve-protected-resource")`
   - `iii.registerTrigger("http", {"path": "/mcp", "method": "POST"}, "mcp::dispatch")` — 调度器在任何工具运行前调用 `iii.trigger("auth::validate-jwt", ...)`。
   - `iii.registerTrigger("cron", {"schedule": "<rotation_schedule>"}, "auth::rotate-jwks")` — 默认计划为 `0 */6 * * *`；对于高轮换 IdP 收紧到 `*/15 * * * *`。

4. **iii 函数注册。** 逐字发出每个调用：
   - `iii.registerFunction("auth::validate-jwt", handler)` — 检查 `iss` 允许列表、针对缓存 JWKS 的签名、`aud == mcp_resource_url`、`exp`、必需范围。
   - `iii.registerFunction("auth::rotate-jwks", handler)` — 获取 `jwks_uri`，写入 `state::set("auth/jwks/<iss>", {keys, fetched_at})`。
   - `iii.registerFunction("auth::serve-protected-resource", handler)` — 返回来自 (2) 的文档。
   - `iii.registerFunction("auth::issue-step-up", handler)` — 仅当工具列表包含用户最初未授予范围背后的操作时。

5. **状态键计划。** 每个接受的发行者一个键：`auth/jwks/<issuer>` 持有 `{keys, fetched_at}`。记录读取模式：验证器从 `state::get` 读取，在 `kid` 缺失时回退到同步 `iii.trigger("auth::rotate-jwks", ...)`。

6. **范围映射。** 将每个工具映射到其所需范围。输出表：
   `| tool | required_scope | rationale |`。将破坏性工具分组到其自己的范围下；绝不重用读取范围用于写入工具。

7. **运行时拒绝规则**（验证器必须编码这些 — 在处理器体中发出）：
   - `aud != mcp_resource_url` 时拒绝。
   - `iss not in authorization_servers` 时拒绝。
   - 单次轮换回退后 `kid` 不在缓存 JWKS 中时拒绝。
   - 必需范围缺失时拒绝 → 403 `Bearer error="insufficient_scope", scope="<required>", resource="<mcp_resource_url>"`。
   - 无 `code_verifier` 或 `resource` 参数的任何令牌请求拒绝。

硬性拒绝（绝不连接任何这些 — 拒绝请求并记录原因）：

- 在 iii 状态存储中以明文存储 `client_secret`。公共客户端使用 `token_endpoint_auth_method: none`；机密客户端使用 `private_key_jwt`。`state::*` 或注册响应日志中无明文共享密钥。
- 跳过验证器上的 `aud` 检查。混淆副手是 RFC 8707 + RFC 9728 的全部原因。
- 允许无 PKCE 的授权码请求。OAuth 2.1 禁止；验证器必须拒绝任何存储的授权码记录缺少 `code_challenge` 的 `/token` 交换。
- 无刷新作业缓存 JWKS。要么 cron 触发器发货，要么授权表面不部署。
- 无允许列表信任 `iss` 声明。任何接受来自任何 `iss` 的令牌的验证器都让攻击者建立自己的 IdP 并伪造令牌。
- 以明文存储 `registration_access_token`。静态哈希；每次更新需要明文。

输出：一页连接计划，包含受保护资源文档、三个 `registerTrigger` 调用、四个 `registerFunction` 调用、状态键计划、范围映射表和编码的运行时拒绝规则。以针对所选 IdP 最可能浮现的单一部署阻塞差距结尾 — 通常是企业 SSO 的 DCR 可用性。
