# Anthropic 的工作流模式：简单优于复杂

> Schluntz 和 Zhang（Anthropic，2024 年 12 月）区分了工作流（预定义路径）与 Agent（动态工具使用）。五种工作流模式涵盖大多数情况。从直接 API 调用开始。仅当步骤无法预测时添加 Agent。

**类型：** 学习与构建
**语言：** Python（标准库）
**前置要求：** 阶段 14 · 01（Agent 循环）
**时长：** 约 60 分钟

## 学习目标

- 说出 Anthropic 的五种工作流模式：提示链（prompt chaining）、路由（routing）、并行化（parallelization）、编排器-工作器（orchestrator-workers）、评估器-优化器（evaluator-optimizer）。
- 解释 Agent 与工作流的区别以及各自的成本。
- 识别何时选择工作流而非 Agent（反之亦然）。
- 针对脚本化 LLM 在标准库中实现所有五种模式。

## 问题背景

团队为想要单个函数调用的问题求助多 Agent 框架。成本是真实的：框架添加了掩盖提示、隐藏控制流并引入过早复杂性的层。Schluntz 和 Zhang 2024 年 12 月的帖子是被引用最多的行业反击：从简单开始，仅当它值得成本时才添加复杂性。

## 核心概念

### 工作流 vs Agent

- **工作流（Workflow）。** 通过预定义代码路径编排的 LLM 和工具。工程师拥有图。
- **Agent。** LLM 动态引导自己的工具并采取自己的步骤。模型拥有图。

两者都有各自的位置。工作流更便宜、更快、更容易调试。Agent 解锁开放式问题，但使失败模式更难推理。

### 增强的 LLM

所有五种模式的基础：一个内置了三种能力的 LLM——搜索（检索）、工具（行动）、记忆（持久化）。任何 API 调用都可以使用这些。

### 五种模式

1. **提示链（Prompt chaining）。** 调用 1 的输出是调用 2 的输入。当任务具有干净的线性分解时使用。步骤之间有可选的程序化门控。

2. **路由（Routing）。** 分类器 LLM 选择要调用的下游 LLM 或工具。当不同类别的输入需要不同处理（1 级支持 vs 退款 vs 错误 vs 销售）时使用。

3. **并行化（Parallelization）。** 并发运行 N 个 LLM 调用，聚合结果。两种形态：分块（不同块）和投票（相同提示，N 次运行，多数/综合）。

4. **编排器-工作器（Orchestrator-workers）。** 编排器 LLM 动态决定运行哪些工作器（也是 LLM）并综合它们的输出。类似于 Agent 循环，但编排器不会无限循环。

5. **评估器-优化器（Evaluator-optimizer）。** 一个 LLM 提出答案，另一个 LLM 评估它。迭代直到评估器通过。这是 Self-Refine（第 05 课）的泛化。

### 工作流优于 Agent 的情况

- **可预测任务。** 如果你能枚举步骤，你就应该。
- **成本限制任务。** 工作流有有界的步骤计数；Agent 可能螺旋上升。
- **合规限制任务。** 审计员想读取图，而不是从轨迹推断它。

### Agent 优于工作流的情况

- **开放式研究。** 当下一步取决于上一步返回什么时。
- **可变长度任务。** 工作时间从几分钟到几小时，步骤数未知。
- **新领域。** 当你还不知道正确的工作流时——先探索，后编纂。

### 上下文工程伴侣

"Effective context engineering for AI agents"（Anthropic 2025）形式化了相邻学科：200k 窗口是预算，不是容器。包含什么，何时压缩，何时让上下文增长。在本课程重新编号之前的阶段 14 早期第 06 课中详细介绍了。

## 构建它

`code/main.py` 针对 `ScriptedLLM` 实现所有五种工作流模式：

- `prompt_chain(input, steps)`——顺序的。
- `route(input, classifier, handlers)`——分类 + 分派。
- `parallel_vote(prompt, n, aggregator)`——N 次运行，聚合。
- `orchestrator_workers(task, workers)`——编排器选择工作器。
- `evaluator_optimizer(task, proposer, evaluator, max_iter)`——循环直到通过。

运行它：

```
python3 code/main.py
```

每种模式都打印其轨迹。每种模式的代码总行数约为 10-15；框架的成本以千计。

## 使用它

- 对大多数任务使用直接 API 调用。
- 仅当模式真正需要持久状态时（LangGraph）、参与者模型并发（AutoGen v0.4）或角色模板化（CrewAI）才使用框架。
- 当你想要 Claude Code 框架形态而不重建它时，求助 Claude Agent SDK。

## 部署它

`outputs/skill-workflow-picker.md` 为给定任务描述选择正确的模式，包括决策理由以及如果工作流不足的 Agent 重构路径。

## 练习

1. 使用置信度阈值实现路由。低于阈值 -> 上报到人工。对于 1 级支持用例，阈值落在哪里？
2. 向 `parallel_vote` 添加超时。当一个调用挂起时会发生什么？你如何用缺失的投票进行聚合？
3. 将 `evaluator_optimizer` 变成一个强盗（bandit）：跨迭代保留 top-2 输出，以便晚期好结果不会被晚期坏结果覆盖。
4. 将提示链与路由结合：路由器选择三个链之一。测量 token 成本与单个大提示替代方案。
5. 选择你的一个生产功能。绘制工作流图。计算步骤。这里 Agent 实际上会更好吗？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------|---------|
| Workflow | "预定义流" | 工程师拥有的 LLM 和工具调用图 |
| Agent | "自主 AI" | 模型拥有的图；动态工具引导 |
| Augmented LLM | "带工具的 LLM" | LLM + 搜索 + 工具 + 记忆；原子单位 |
| Prompt chaining | "顺序调用" | 调用 N 的输出是调用 N+1 的输入 |
| Routing | "分类器分派" | 选择哪个链/模型处理输入 |
| Parallelization | "扇出" | N 个并发调用；按分块或投票聚合 |
| Orchestrator-workers | "调度器 Agent" | 编排器 LLM 动态选择专家 LLM |
| Evaluator-optimizer | "提议者 + 判断者" | 迭代直到评估器通过；Self-Refine 泛化 |

## 延伸阅读

- [Anthropic, Building Effective Agents (2024 年 12 月)](https://www.anthropic.com/research/building-effective-agents)——五种工作流模式
- [Anthropic, Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)——伴侣学科
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview)——何时状态图值得其成本
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/)——编排器-工作器模式，产品化
