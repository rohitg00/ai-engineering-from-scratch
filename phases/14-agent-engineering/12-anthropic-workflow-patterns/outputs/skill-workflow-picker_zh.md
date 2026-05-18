---
name: workflow-picker
description: 为给定任务选择正确的模式（prompt chain、router、parallel、orchestrator-workers、evaluator-optimizer 或 full agent）并生成最小实现。
version: 1.0.0
phase: 14
lesson: 12
tags: [anthropic, workflows, agents, patterns, minimal]
---

给定任务描述，选择适合的最小模式并生成最小的正确实现。

决策树：

1. 你能枚举步骤吗？-> **prompt chain** 或 **routing**。
2. 输出是否需要跨独立运行的聚合？-> **parallelization**（sectioning 或 voting）。
3. 你需要一个成员随任务变化的专业池吗？-> **orchestrator-workers**。
4. 你需要迭代精炼直到 judge 通过吗？-> **evaluator-optimizer**（Self-Refine 形状）。
5. 以上都不是，或者步骤数取决于中间结果？-> **agent loop** (Lesson 01)。

生成：

- 对于 workflows：组合 LLM + 工具调用的纯函数。没有框架。
- 对于 agents：Lesson 01 的 ReAct 循环加上任务所需的任何工具注册表。
- 一个 `README.md`，包含决策理由、步骤数、预期 token 成本和可观察的成功标准。

硬性拒绝：

- 当任务是 3 步 prompt chain 时伸手去拿框架（LangGraph、AutoGen、CrewAI）。过度工程隐藏了实际问题。
- 将 3-worker orchestrator-worker 描述为"multi-agent"。Workers 不是 agents；它们是 LLM 调用。使用"orchestrator-workers"以清晰。
- 没有停止条件的 Evaluator-optimizer。没有 `max_iter` 和"fail-pass-through"回退，循环可以无限旋转。

拒绝规则：

- 如果用户在任务实际上是 router 时要求"multi-agent"，拒绝并重命名。Multi-agent 标签携带运营成本（coordination、debugging、evals），routing 不需要。
- 如果用户想要 open-ended research task 的 workflows，拒绝并建议带有轮次预算的 agent。Workflows 用于可预测的轨迹。
- 如果用户想要 2 步任务的 agent，拒绝并建议 prompt chaining。Agents 增加延迟和失败模式；仅在需要时使用它们。

输出：模式选择 + 最小代码 + README。以"what to read next"结束，指向 Lesson 13（LangGraph）如果 durable state 重要，Lesson 16（OpenAI Agents SDK）用于 handoffs 和 guardrails，或 Lesson 01 如果你毕竟选择了 agent。
