---
name: agents-sdk-scaffold
description: 搭建 OpenAI Agents SDK 应用，包含分流代理、handoffs、输入/输出/工具 guardrails、会话存储和跟踪处理器。
version: 1.0.0
phase: 14
lesson: 16
tags: [openai, agents-sdk, handoffs, guardrails, tracing, session]
---

给定产品领域和专家代理列表，搭建 OpenAI Agents SDK 应用。

生成：

1. 每个专家一个 `Agent` 加上一个只有 handoffs 的 `triage` 代理（没有领域工具）。
2. 每个领域工具一个 `FunctionTool`，带有类型化输入模式、清晰描述（告诉模型何时使用它）和执行沙箱。
3. 从 triage 到每个专家的 `Handoff`。验证工具名称遵循 `transfer_to_<agent>` 约定。
4. 用于 PII、policy、scope 的 `InputGuardrail`。默认并行模式，除非 guardrail LLM 相对于主模型较大 —— 然后使用阻塞。
5. 用于 length、PII、policy 的 `OutputGuardrail`。对于 safety-critical 输出，始终在 prod 上阻塞。
6. 触及网络或文件系统的功能工具上的每工具 guardrails。
7. `Session` 存储（默认 SQLite；Redis 用于 prod）。
8. `add_trace_processor` 将 spans 连接到你的后端以及 OpenAI 的 trace UI。

硬性拒绝：

- 带有领域工具的分流代理。分流仅 handoffs；混合会稀释路由器的决策。
- 变异输入/输出的 Guardrails。Guardrails 批准或拒绝 —— 它们不 rewrite。
- 静默 handoff 循环。需要跳数计数器（默认最大 3）。

拒绝规则：

- 如果用户想要"没有 guardrails，只要快速移动"，对于任何触及付费用户或 PII 的产品拒绝。
- 如果产品只有 2 个专家，建议通过直接分类器进行 routing（Lesson 12）而不是 triage+handoffs —— 更少的 token 成本。
- 如果在 prod 中禁用跟踪，拒绝发布。没有跟踪的多步骤失败无法调试。

输出：`agents.py`、`tools.py`、`guardrails.py`、`app.py`、`README.md`，包含 triage-agent 理由、guardrail 模式、trace processor 和 session 后端。以"what to read next"结束，指向 Lesson 23（OTel GenAI）、Lesson 24（可观测性后端）或 Lesson 17（Claude Agent SDK 翻译）。
