# Anthropic 的工作流模式：简单优于复杂

> Schluntz 和 Zhang（Anthropic，2024年12月）区分工作流（预定义路径）和 agent（动态工具使用）。五种工作流模式覆盖大多数情况。从直接 API 调用开始。仅在步骤无法预测时才添加 agent。

**类型：** 学习 + 构建
**语言：** Python（标准库）
**前置条件：** 第 14 阶段 · 01（Agent Loop）
**时间：** ~60 分钟

## 学习目标

- 说出 Anthropic 的五种工作流模式：提示链、路由、并行化、编排器-工作者、评估器-优化器。
- 解释 agent 与工作流的区别，以及各自的工程成本。
- 识别何时选择工作流而非 agent（反之亦然）。
- 用标准库针对脚本化 LLM 实现所有五种模式。

## 问题

团队为多 agent 框架可以解决的问题使用多 agent 框架。成本是真实的：框架增加了隐藏提示词、隐藏控制流并邀请过早复杂性的层。Schluntz 和 Zhang 2024 年 12 月的文章是被引用最多的行业反驳：从简单开始，仅在复杂性值得其成本时才添加。

## 概念

### 工作流 vs Agent

- **工作流。** 通过预定义代码路径编排的 LLM 和工具。工程师拥有图。
- **Agent。** LLM 动态指导自己的工具并采取自己的步骤。模型拥有图。

两者都有各自的位置。工作流更便宜、更快、更容易调试。Agent 解锁开放式问题，但使失败模式更难推理。

### 增强型 LLM

所有五种模式的基础：一个 LLM 连接三种能力——搜索（检索）、工具（动作）、记忆（持久化）。任何 API 调用都可以使用这些。

### 五种模式

1. **提示链。** 调用 1 的输出是调用 2 的输入。当任务有干净的线性分解时使用。步骤之间可选程序化门。

2. **路由。** 分类器 LLM 选择调用哪个下游 LLM 或工具。当分类不同的输入需要不同处理时使用（一级支持 vs 退款 vs bug vs 销售）。

3. **并行化。** 并发运行 N 个 LLM 调用，聚合结果。两种形式：分段（不同块）和投票（相同提示词，N 次运行，多数/综合）。

4. **编排器-工作者。** 编排器 LLM 动态决定运行哪些工作者（也是 LLM）并综合它们的输出。类似于 agent 循环，但编排器不会无限循环。

5. **评估器-优化器。** 一个 LLM 提议答案，另一个 LLM 评估。迭代直到评估器通过。这是 Self-Refine（第 05 课）的泛化。

### 工作流优于 agent 的地方

- **可预测任务。** 如果你能枚举步骤，你应该这样做。
- **成本约束任务。** 工作流有有界步骤数；agent 可能螺旋。
- **合规约束任务。** 审计员想读图，而不是从轨迹推断它。

### Agent 优于工作流的地方

- **开放式研究。** 当下一步取决于上一步返回什么。
- **变长任务。** 几分钟到几小时的工作，步骤数未知。
- **新颖领域。** 当你还不知道正确的工作流——先探索，后固化。

### 上下文工程伴侣

"AI agent 的有效上下文工程"（Anthropic 2025）将相邻学科形式化：200k 窗口是预算，不是容器。包含什么、何时压缩、何时让上下文增长。在本课程第 14 阶段早期第 06 课中详细覆盖（重新编号前）。

## 构建

`code/main.py` 针对 `ScriptedLLM` 实现所有五种工作流模式：

- `prompt_chain(input, steps)` —— 顺序。
- `route(input, classifier, handlers)` —— 分类 + 分派。
- `parallel_vote(prompt, n, aggregator)` —— N 次运行，聚合。
- `orchestrator_workers(task, workers)` —— 编排器选择工作者。
- `evaluator_optimizer(task, proposer, evaluator, max_iter)` —— 循环直到通过。

运行：

```
python3 code/main.py
```

每种模式打印其跟踪。每种模式的代码行数约 10-15；框架的成本以千计。

## 使用

- 大多数任务使用直接 API 调用。
- 仅当模式真正需要持久状态（LangGraph）、actor 模型并发（AutoGen v0.4）或角色模板（CrewAI）时才使用框架。
- 当你想要 Claude Code 工具形状而不重建它时，使用 Claude Agent SDK。

## 交付

`outputs/skill-workflow-picker.md` 为给定任务描述选择正确的模式，包括决策理由和如果工作流不足时重构为 agent 的路径。

## 练习

1. 用置信度阈值实现路由。低于阈值 -> 升级到人工。一级支持用例的阈值在哪里？
2. 为 `parallel_vote` 添加超时。一个调用挂起时会发生什么？如何用缺失投票聚合？
3. 将 `evaluator_optimizer` 变成 bandit：跨迭代保留 top-2 输出，这样后期好结果不会被后期坏结果覆盖。
4. 组合提示链与路由：路由器选择三个链之一。测量 token 成本 vs 单个大提示词替代。
5. 选择你的一个生产功能。绘制工作流图。数步骤。Agent 在这里真的会做得更好吗？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| Workflow | "预定义流" | 工程师拥有的 LLM 和工具调用图 |
| Agent | "自主 AI" | 模型拥有的图；动态工具指导 |
| Augmented LLM | "带工具的 LLM" | LLM + 搜索 + 工具 + 记忆；原子单元 |
| Prompt chaining | "顺序调用" | 调用 N 的输出是调用 N+1 的输入 |
| Routing | "分类器分派" | 选择哪个链/模型处理输入 |
| Parallelization | "扇出" | N 个并发调用；按分段或投票聚合 |
| Orchestrator-workers | "调度器 agent" | 编排器 LLM 动态选择专家 LLM |
| Evaluator-optimizer | "提议者 + 裁判" | 迭代直到评估器通过；Self-Refine 泛化 |

## 延伸阅读

- [Anthropic, Building Effective Agents (Dec 2024)](https://www.anthropic.com/research/building-effective-agents) —— 五种工作流模式
- [Anthropic, Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) —— 相邻学科
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) —— 有状态图何时值得其成本
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) —— 编排器-工作者模式，产品化