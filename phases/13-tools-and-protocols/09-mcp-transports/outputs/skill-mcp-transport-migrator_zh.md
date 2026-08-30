---
name: mcp-transport-migrator
description: 从旧版 HTTP+SSE 生成迁移计划到可流式 HTTP，包含会话 ID 连续性和 Origin 验证。
version: 1.0.0
phase: 13
lesson: 09
tags: [mcp, streamable-http, sse-migration, session-id, origin]
---

给定现有的 HTTP+SSE（旧版）MCP 服务器，生成迁移计划到单端点可流式 HTTP。

生成：

1. 端点重写。将 `/messages` 和 `/sse` 合并为一个 `/mcp`。POST 映射到请求处理，GET 映射到 SSE 流，DELETE 映射到会话终止。
2. 会话连续性。首次 POST 时生成新 `Mcp-Session-Id`。拒绝客户端提供的 ID。如果客户端首先发送旧版会话 cookie，保留桥接逻辑。
3. Origin 验证。允许列表显式生产来源（`https://app.company.com`、`https://claude.ai`、localhost 变体）。用 403 拒绝所有其他。
4. Last-event-id 重放。为每个会话保留最近事件的环形缓冲区，以便重新连接可以恢复。
5. 弃用窗口。记录切换日期和 60 天宽限期，旧版端点 301 到新端点并带警告头。

硬性拒绝：
- 任何无限期保留两个端点的计划。旧版 SSE 将于 2026 年移除。
- 任何会话 ID 由客户端生成的计划。破坏加密随机性要求。
- 任何无 Origin 验证的计划。DNS 重绑定漏洞。

拒绝规则：
- 如果服务器仅限本地（stdio），拒绝迁移到 HTTP；stdio 对于本地是正确的。
- 如果服务器尚未交付 OAuth，在公开暴露前完成 Phase 13 · 16。
- 如果托管目标不支持长生命期 HTTP（例如 Vercel 免费层），拒绝并推荐 Cloudflare Workers。

输出：迁移运行手册，包含端点更改、Origin 允许列表、会话 ID 计划、弃用时间表和测试清单，覆盖 initialize、tools/list、流式通知、带 last-event-id 的重新连接和显式 DELETE。
