# Anthropic 的工作流模式：简单优于复杂

> Schluntz 和 Zhang(Anthropic,2024 年 12 月)区分了工作流(预定义路径)与代理(动态工具使用)。五种工作流模式可覆盖大多数场景。从直接 API 调用开始。只有当步骤无法预测时才引入代理。

**Type:** Learn + Build
**Languages:** Python (标准库)
**Prerequisites:** Phase 14 · 01 (Agent Loop)
**Time:** 约 60 分钟

## 学习目标

- 说出 Anthropic 的五种工作流模式：提示链、路由、并行化、编排者-工作者、评估者-优化者。
- 解释代理与工作流的区别以及各自的工程成本。
- 识别何时应选择工作流而非代理(反之亦然)。
- 在标准库上针对脚本化的 LLM 实现全部五种模式。

## 问题所在

团队会为那些只需单个函数调用就能解决的问题引入多代理框架。代价是实实在在的：框架添加的层会遮蔽提示词、隐藏控制流，并招致过早的复杂性。Schluntz 和 Zhang 2024 年 12 月的文章是被引用最多的行业反拨：从简单开始，只有当复杂性物有所值时才增加它。

## 核心概念

### 工作流 vs 代理

- **工作流。** LLM 和工具通过预定义的代码路径进行编排。图由工程师掌控。
- **代理。** LLM 动态地指挥自己的工具并自主决定步骤。图由模型掌控。

两者各有其位。工作流更便宜、更快、更易于调试。代理能解决开放性问题，但使故障模式更难推断。

### 增强型 LLM

所有五种模式的基础：一个接入三种能力的 LLM —— 搜索(检索)、工具(操作)、记忆(持久化)。任何 API 调用都可以使用这些能力。

### 五种模式

1. **提示链。** 调用 1 的输出是调用 2 的输入。适用于任务具有清晰的线性分解的场景。可在步骤之间加入可选的程序化门控。

2. **路由。** 一个分类器 LLM 选择调用哪个下游 LLM 或工具。适用于类别不同的输入需要不同处理方式的场景(一线支持 vs 退款 vs 缺陷 vs 销售)。

3. **并行化。** 并发运行 N 个 LLM 调用，聚合结果。两种形式：分段(不同分块)和投票(相同提示，N 次运行，多数表决/综合)。

4. **编排者-工作者。** 一个编排者 LLM 动态决定运行哪些工作者(也是 LLM),并综合它们的输出。类似代理循环，但编排者不会无限循环。

5. **评估者-优化者。** 一个 LLM 提出答案，另一个 LLM 进行评估。迭代直到评估者通过。这是 Self-Refine(第 05 课)的推广。

### 工作流优于代理的场景

- **可预测的任务。** 如果你能枚举出各个步骤，那就应该这样做。
- **成本受限的任务。** 工作流的步骤数量有界；代理可能失控。
- **合规受限的任务。** 审计者希望直接阅读图结构，而不是从轨迹中推断它。

### 代理优于工作流的场景

- **开放式研究。** 当下一步取决于上一步的返回结果时。
- **时长可变的任务。** 从几分钟到几小时的工作量，步骤数量未知。
- **全新领域。** 当你还不知道合适的工作流时 —— 先探索，后固化。

### 上下文工程姊妹篇

"Effective context engineering for AI agents"(Anthropic 2025)将这一相邻学科形式化：200k 窗口是预算，不是容器。该包含什么、何时压缩、何时让上下文增长。本课程在关于上下文压缩的 Phase 14 课程中详细讲解(编号调整前为本课程中 Phase 14 的课程 06)。

```figure
workflow-chain
```

## 动手构建

`code/main.py` 针对 `ScriptedLLM` 实现了全部五种工作流模式：

- `prompt_chain(input, steps)` — 顺序执行。
- `route(input, classifier, handlers)` — 分类 + 分发。
- `parallel_vote(prompt, n, aggregator)` — N 次运行，聚合。
- `orchestrator_workers(task, workers)` — 编排者选择工作者。
- `evaluator_optimizer(task, proposer, evaluator, max_iter)` — 循环直到通过。

运行它：

```
python3 code/main.py
```

每种模式都会打印其执行轨迹。每种模式的代码总行数约为 10-15 行；而框架的成本则以千行计。

## 应用实践

- 大多数任务使用直接 API 调用。
- 只有当模式确实需要持久化状态(LangGraph)、actor 模型并发(AutoGen v0.4)或角色模板化(CrewAI)时才使用框架。
- 当你想要 Claude Code 的框架形态而又不想重新构建它时，选择 Claude Agent SDK。

## 上线部署

`outputs/skill-workflow-picker.md` 为给定的任务描述选择合适的模式，包括决策理由，以及在工作流不够用时向代理重构的路径。

## 练习

1. 实现带置信度阈值的路由。低于阈值 -> 升级给人工。对于一线支持场景，阈值应设在哪里？
2. 给 `parallel_vote` 添加超时。当某个调用挂起时会发生什么？在缺少投票时你如何聚合？
3. 将 `evaluator_optimizer` 改造为老虎机算法：跨迭代保留 top-2 输出，使一个晚出现的好结果不会被晚出现的坏结果覆盖。
4. 将提示链与路由结合：一个路由器在三条链中选择其一。测量与单个大提示词替代方案相比的 token 成本。
5. 选一个你的生产特性。画出工作流图。数一数步骤数。在这里代理真的会更好吗？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| 工作流 | “预定义流程” | 由工程师掌控的 LLM 与工具调用图 |
| 代理 | “自主 AI” | 由模型掌控的图；动态工具指挥 |
| 增强型 LLM | “带工具的 LLM” | LLM + 搜索 + 工具 + 记忆；原子单元 |
| 提示链 | “顺序调用” | 调用 N 的输出是调用 N+1 的输入 |
| 路由 | “分类器分发” | 选择由哪条链/哪个模型处理输入 |
| 并行化 | “扇出” | N 个并发调用；通过分段或投票聚合 |
| 编排者-工作者 | “调度代理” | 编排者 LLM 动态选择专职 LLM |
| 评估者-优化者 | “提议者 + 评审者” | 迭代直到评估者通过；Self-Refine 的推广 |

## 延伸阅读

- [Anthropic, Building Effective Agents (Dec 2024)](https://www.anthropic.com/research/building-effective-agents) — 五种工作流模式
- [Anthropic, Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — 姊妹学科
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) — 有状态图何时物有所值
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) — 产品化的编排者-工作者模式