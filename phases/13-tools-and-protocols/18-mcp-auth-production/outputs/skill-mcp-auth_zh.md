---
name: mcp-auth-wiring
description: 搭建生产级 MCP 授权（RFC 8414、CIMD、7591、8707、7636 PKCE、9728、9207）——受保护资源元数据、注册、JWKS 刷新和每请求令牌验证。
version: 1.1.0
phase: 13
lesson: 18
tags: [mcp, oauth, cimd, dcr, jwks, rfc8414, rfc7591, rfc8707, rfc7636, rfc9728, rfc9207]
---

给定一个 MCP 服务器配置和一个 IdP 能力集，输出构成生产级 MCP 授权层的认证表面和拒绝规则。

输入：

- `mcp_resource_url` — 规范资源 URL（最具体的标识符；仅在用于区分同主机服务器时保留路径），用作 `aud` 和受保护资源元数据的 `resource` 值。
- `idp_metadata_url` — IdP 的 `/.well-known/oauth-authorization-server`（或 OpenID Connect Discovery）URL。
- `idp_capabilities` — 观测到的 `code_challenge_methods_supported`、`grant_types_supported`、`client_id_metadata_document_supported`（CIMD）、`registration_endpoint`（DCR）、`response_types_supported`、`authorization_response_iss_parameter_supported`（RFC 9207）的值。
- `tools` — MCP 工具列表及其所需的作用域。

产出：

1. **拒绝门。** 如果任何硬条件失败，拒绝进行连接并停止：
   - `code_challenge_methods_supported` 中缺少 `S256`（PKCE 没有降级模式）。
   - `grant_types_supported` 中缺少 `authorization_code`。
   - `response_types_supported` 不是精确的 `["code"]`。
   - 没有注册路径：预注册的 `client_id`、`client_id_metadata_document_supported: true`（CIMD）或 `registration_endpoint`（DCR）均不可用。任一即可——仅 DCR 缺失不再是拒绝理由（2025-11-25 将 DCR 降级为 `MAY`；CIMD 是首选默认）。

2. **受保护资源元数据文档**（RFC 9728），供 MCP 服务器在 `/.well-known/oauth-protected-resource` 发布。包含 `resource`、`authorization_servers`（发行者白名单）、`scopes_supported`、`bearer_methods_supported: ["header"]`。

3. **HTTP 端点。**
   - `GET /.well-known/oauth-protected-resource` — 返回 (2) 中的文档。
   - `POST /mcp`（MCP 传输）— 在任何工具分发前运行令牌验证。
   - （仅 DCR 路径）`POST /register` — 注册器，前置速率限制检查。

4. **后台任务和例程。**
   - 一个计划任务，将 `jwks_uri` 重新获取到缓存 `{keys, fetched_at}`。幂等；永不生成密钥。AS 轮换密钥；资源服务器仅刷新。默认 `0 */6 * * *`；对于高轮换频率的 IdP 收紧到 `*/15 * * * *`。
   - 一个 `validate` 例程 — 检查 `iss` 白名单、对照缓存 JWKS 的签名、`aud == mcp_resource_url`、`exp`、所需作用域。
   - 一个逐步升级签发路径 — 仅当工具列表包含用户初始未授予的作用域所保护的操作时。

5. **缓存计划。** 每个接受的发行者一个条目，以 `issuer` 为键，包含 `{keys, fetched_at}`。记录读取模式：验证器读取缓存，在 `kid` 未命中时回退到单次同步刷新（重新获取，非轮换——重新获取是幂等的且不能被转化为密钥创建 DoS 攻击）。

6. **作用域映射。** 将每个工具映射到其所需的作用域。输出一个表格：
   `| tool | required_scope | rationale |`。将破坏性工具归入其自身的作用域；切勿为写工具复用读取作用域。

7. **运行时拒绝规则**（验证器必须编码这些规则）：
   - 当 `aud != mcp_resource_url` 时拒绝 → 401 `Bearer error="invalid_token", error_description="audience mismatch", resource_metadata="<prm_url>"`。
   - 当 `iss not in authorization_servers` 时拒绝。
   - 当在单次重新获取回退后 `kid` 仍不在缓存的 JWKS 中时拒绝。
   - 当缺少所需作用域时拒绝 → 403 `Bearer error="insufficient_scope", scope="<required>", resource_metadata="<prm_url>"`。
   - 拒绝任何没有 `code_verifier` 或 `resource` 参数的令牌请求。

硬拒绝（绝不连接以下任何项——拒绝请求并说明原因）：

- 以明文存储 `client_secret`。公共客户端使用 `token_endpoint_auth_method: none`；机密客户端使用 `private_key_jwt`。无明文共享密钥存储在静态或注册响应日志中。
- 在验证器上跳过 `aud` 检查。受众绑定（访问令牌权限限制）是 RFC 8707 + RFC 9728 的全部意义所在。
- 将 JWKS 缓存未命中回退设置为轮换并生成密钥而非重新获取。它永远不会产生缺失的 `kid`，并且允许攻击者控制的 `kid` 值强制创建无限制的密钥。回退必须是幂等的刷新。
- 允许没有 PKCE 的授权码请求。OAuth 2.1 禁止此做法；验证器必须拒绝任何其存储的授权码记录缺少 `code_challenge` 的 `/token` 交换。
- 在无刷新任务的情况下缓存 JWKS。要么有计划刷新，要么不部署认证表面。
- 在没有白名单的情况下信任 `iss` 声明。任何接受来自任意 `iss` 的令牌的验证器都允许攻击者搭建自己的 IdP 并伪造令牌。
- 将入站 MCP 令牌转发到上游 API（令牌透传）。如果 MCP 服务器调用上游 API，它必须获取自己的独立令牌；透传会造成混乱代理问题。
- 以明文存储 `registration_access_token`。静态加密；每次更新时需要明文。

输出：一页计划，包含受保护资源文档、所选注册路径（CIMD / 预注册 / DCR）、HTTP 端点、JWKS 刷新任务、缓存计划、作用域映射表以及编码的运行时拒绝规则。最后以针对所选 IdP 最可能出现的单一部署阻塞差距结尾——通常是 CIMD 是否受支持，对于企业 SSO 则回退到 DCR 可用性。
