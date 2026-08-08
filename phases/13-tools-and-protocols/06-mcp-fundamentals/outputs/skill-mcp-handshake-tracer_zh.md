---
name: mcp-handshake-tracer
description: 给定 MCP 客户端-服务器对话的 pcap 风格记录，为每条消息注释其原语、生命周期阶段和能力依赖。
version: 1.0.0
phase: 13
lesson: 06
tags: [mcp, json-rpc, lifecycle, capabilities]
---

给定从 MCP 会话捕获的 JSON-RPC 2.0 信封序列，生成遍历，命名每条消息的原语、生命周期阶段和底层能力标志。

生成：

1. 每条消息注释。对于每个 `{request, response, notification}`，说明：方向（客户端到服务器或服务器到客户端）、原语（tools / resources / prompts / roots / sampling / elicitation / lifecycle）、生命周期阶段以及此消息有效必须协商的能力标志。
2. 能力检查。从记录重建 `initialize` 交换并列出所有协商的能力。标记任何违反缺失能力的消息。
3. 错误诊断。对于每个 JSON-RPC 错误，命名代码及给定周围上下文的最可能原因。
4. 完整性审计。标记缺少以下之一的记录：`initialize`、`initialized` 通知、至少一个 `tools/list` 或等效项、优雅关闭。
5. 规范合规性。根据 2025-11-25 规范的最小字段集检查每个请求的参数。标记遗漏。

硬性拒绝：
- 任何在规范允许集外使用无 `x-` 前缀的方法的消息。
- 客户端未声明 `sampling` 能力时的任何 `sampling/createMessage` 消息。
- `notifications/initialized` 到达之前的任何调用。

拒绝规则：
- 如果被要求审计非 MCP 协议的记录，拒绝并指向 A2A 规范（Phase 13 · 19）作为替代。
- 如果被要求"修复"记录，拒绝。此技能注释；不重写。通过实现 SDK 路由更正。

输出：到达顺序的每条消息一行注释：`[phase/primitive/capability] <method or result shape>`。以三行摘要结尾，命名任何能力违规和任何缺失生命周期步骤。
