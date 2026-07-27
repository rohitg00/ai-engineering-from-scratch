---
name: mcp-transport-migrator
description: 产出一份从传统 HTTP+SSE 到可流式 HTTP 的迁移计划，包含会话 ID 连续性和 Origin 验证。
version: 1.0.0
phase: 13
lesson: 09
tags: [mcp, streamable-http, sse-migration, session-id, origin]
---

给定一个现有的 HTTP+SSE（传统）MCP 服务器，产出一份迁移到单端点可流式 HTTP 的计划。

产出：

1. **端点重写。** 将 `/messages` 和 `/sse` 合并为一个 `/mcp`。将 POST 映射到请求处理、GET 映射到 SSE 流、DELETE 映射到会话终止。
2. **会话连续性。** 在首次 POST 时生成新的 `Mcp-Session-Id`。拒绝客户端提供的 ID。如果客户端首先发送传统会话 cookie，则保留桥接逻辑。
3. **Origin 验证。** 白名单显式的生产环境源（`https://app.company.com`、`https://claude.ai`、localhost 变体）。对其他所有来源以 403 拒绝。
4. **最后事件 ID 重放。** 每个会话保留一个最近事件的环形缓冲区，以便重新连接时恢复。
5. **弃用窗口。** 记录切换日期以及 60 天的宽限期，期间传统端点通过 301 重定向到新端点并附带警告头。

硬拒绝：
- 任何无限期保持两个端点都存活的计划。传统 SSE 将在 2026 年被移除。
- 任何会话 ID 由客户端生成的计划。违反了加密随机性要求。
- 任何没有 Origin 验证的计划。存在 DNS 重绑定漏洞。

拒绝规则：
- 如果服务器仅限本地（stdio），拒绝迁移到 HTTP；stdio 适用于本地场景。
- 如果服务器尚未提供 OAuth，先完成阶段 13 · 16 再公开暴露。
- 如果托管目标不支持长连接 HTTP（例如 Vercel 免费版），拒绝并推荐 Cloudflare Workers。

输出：一份迁移手册，包含端点变更、Origin 白名单、会话 ID 计划、弃用时间表以及一份测试清单（覆盖 initialize、tools/list、流式通知、带最后事件 ID 的重新连接和显式 DELETE）。
