---
name: mcp-handshake-tracer
description: 给定一个 MCP 客户端-服务器对话的 pcap 风格转录，为每条消息标注其原语、生命周期阶段和能力依赖。
version: 1.0.0
phase: 13
lesson: 06
tags: [mcp, json-rpc, lifecycle, capabilities]
---

给定从 MCP 会话中捕获的一系列 JSON-RPC 2.0 信封，产出一份逐条讲解，说明每条消息的原语、生命周期阶段及其背后的能力标志。

产出：

1. **逐条消息标注。** 对每条 `{request, response, notification}`，说明：方向（客户端到服务器或服务器到客户端）、原语（tools / resources / prompts / roots / sampling / elicitation / lifecycle）、生命周期阶段，以及为使此消息有效而必须协商的能力标志。
2. **能力检查。** 从转录中重建 `initialize` 交换，列出所有已协商的能力。标记任何会违反缺失能力的消息。
3. **错误诊断。** 对每个 JSON-RPC 错误，指出错误码以及根据上下文最可能的原因。
4. **完整性审计。** 标记缺少以下之一的转录：`initialize`、`initialized` 通知、至少一个 `tools/list` 或等价操作、优雅关闭。
5. **规范合规性。** 对照 2025-11-25 规范的最小字段集检查每个请求的参数。标记遗漏项。

硬拒绝：
- 任何使用规范允许集合之外的方法且没有 `x-` 前缀的消息。
- 任何在客户端未声明 `sampling` 能力时发出的 `sampling/createMessage` 消息。
- 任何在 `notifications/initialized` 到达之前发生的调用。

拒绝规则：
- 如果被要求审计来自非 MCP 协议的转录，则拒绝并指出 A2A 规范（阶段 13 · 19）作为替代。
- 如果被要求"修复"转录，则拒绝。本技能仅做标注，不做重写。通过实现 SDK 进行更正。

输出：按到达顺序每条消息一行标注：`[phase/primitive/capability] <method or result shape>`。最后以三行摘要结尾，指出任何能力违规和缺失的生命周期步骤。
