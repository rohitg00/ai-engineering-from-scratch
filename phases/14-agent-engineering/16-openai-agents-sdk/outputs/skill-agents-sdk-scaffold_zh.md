---
name: agents-sdk-scaffold
description: 搭建一个 OpenAI Agents SDK 应用，配备分诊代理、交接、输入/输出/工具护栏、会话存储和追踪处理器。
version: 1.0.0
phase: 14
lesson: 16
tags: [openai, agents-sdk, handoffs, guardrails, tracing, session]
---

给定一个产品领域和一个专家代理列表，搭建一个 OpenAI Agents SDK 应用。

产出：

1. 每个专家一个 `Agent`，外加一个仅具有交接功能（无领域工具）的 `triage` 代理。
2. 每个领域工具一个 `FunctionTool`，带类型化输入模式、清晰描述（告知模型何时使用）和执行沙箱。
3. 从分诊代理到每个专家的 `Handoff`。验证工具名称遵循 `transfer_to_<agent>` 约定。
4. 用于个人身份信息、策略、范围的 `InputGuardrail`。默认为并行模式，除非护栏 LLM 相对主模型较大——此时使用阻塞模式。
5. 用于长度、个人身份信息、策略的 `OutputGuardrail`。在生产环境对安全关键输出始终使用阻塞模式。
6. 在触及网络或文件系统的函数工具上设置每工具护栏。
7. `Session` 存储（默认 SQLite；生产环境用 Redis）。
8. `add_trace_processor` 将 span 连接到你的后端以及 OpenAI 的追踪 UI。

硬性拒绝：

- 拥有领域工具的分诊代理。分诊仅负责交接；混合会削弱路由器的决策。
- 修改输入/输出的护栏。护栏批准或拒绝——它们不做重写。
- 静默的交接循环。需要跳数计数器（默认最多 3 次）。

拒绝规则：

- 如果用户想要"无需护栏，快速推进"，对任何涉及付费用户或个人身份信息的产品拒绝。
- 如果产品只有 2 个专家，建议使用带有直接分类器的 `Agents` 进行路由（第 12 课）而非分诊+交接——令牌成本更低。
- 如果在生产环境禁用追踪，拒绝交付。没有追踪，多步骤失败无法调试。

输出：`agents.py`、`tools.py`、`guardrails.py`、`app.py`、`README.md`，包含分诊代理理由、护栏模式、追踪处理器和会话后端。以"下一步阅读"结尾，指向第 23 课（OTel GenAI）、第 24 课（可观测性后端）或第 17 课（Claude Agent SDK 转换）。
