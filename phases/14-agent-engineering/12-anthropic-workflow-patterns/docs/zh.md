# 12 · Anthropic 的工作流模式：简单优于复杂

> Schluntz 与 Zhang（Anthropic，2024 年 12 月）将工作流（workflows，预定义路径）与智能体（agents，动态工具调用）区分开来。五种工作流模式覆盖了大多数场景。从直接的 API 调用开始，只有当步骤无法预测时才引入智能体。

**类型：** 学习 + 构建
**语言：** Python（标准库）
**前置：** 第 14 阶段 · 01（智能体循环）
**时长：** 约 60 分钟

## 学习目标

- 说出 Anthropic 的五种工作流模式：提示链（prompt chaining）、路由（routing）、并行化（parallelization）、编排者-工作者（orchestrator-workers）、评估者-优化者（evaluator-optimizer）。
- 解释智能体与工作流的区别，以及两者各自的工程成本。
- 判断何时该选择工作流而非智能体（反之亦然）。
- 用标准库针对一个脚本化的 LLM 实现全部五种模式。

## 问题所在

面对一个本该只需单次函数调用就能解决的问题，团队却动辄搬出多智能体框架。这种成本是实实在在的：框架增加的层级会遮蔽提示、隐藏控制流，并诱发过早的复杂化。Schluntz 与 Zhang 在 2024 年 12 月发表的文章是业界被引用最多的反思——从简单开始，只有当复杂度能抵偿其成本时才引入它。

## 核心概念

### 工作流 vs 智能体

- **工作流（Workflow）。** 通过预定义的代码路径来编排 LLM 与工具。图（graph）由工程师掌控。
- **智能体（Agent）。** LLM 动态地指挥自己的工具、自行采取步骤。图由模型掌控。

两者各有其用武之地。工作流更便宜、更快、更易调试。智能体能攻克开放式问题，但其失败模式更难推理。

### 增强型 LLM（augmented LLM）

这是所有五种模式的基础：一个 LLM 接入了三种能力——搜索（检索）、工具（动作）、记忆（持久化）。任何 API 调用都可以使用这些能力。

### 五种模式

1. **提示链（Prompt chaining）。** 第 1 次调用的输出作为第 2 次调用的输入。适用于任务可以被清晰地线性分解的场景。各步骤之间可选地加入程序化的检查关卡。

2. **路由（Routing）。** 由一个分类器 LLM 决定调用哪个下游 LLM 或工具。适用于类别上截然不同的输入需要不同处理的场景（一线客服 vs 退款 vs 缺陷 vs 销售）。

3. **并行化（Parallelization）。** 并发运行 N 个 LLM 调用，再聚合结果。有两种形态：分段（sectioning，处理不同的分块）与投票（voting，同一提示运行 N 次，取多数或综合）。

4. **编排者-工作者（Orchestrator-workers）。** 一个编排者 LLM 动态决定运行哪些工作者（同样是 LLM），并综合它们的输出。类似于智能体循环，但编排者不会无限循环。

5. **评估者-优化者（Evaluator-optimizer）。** 一个 LLM 提出答案，另一个 LLM 对其进行评估。反复迭代，直到评估者通过。这是自我精炼（Self-Refine，第 05 课）的泛化版本。

### 工作流胜过智能体的场景

- **可预测的任务。** 如果你能把步骤一一列举出来，那就应该这么做。
- **成本受限的任务。** 工作流的步骤数有界；智能体则可能失控膨胀。
- **合规受限的任务。** 审计人员希望直接阅读那张图，而不是从执行轨迹中去推断它。

### 智能体胜过工作流的场景

- **开放式研究。** 当下一步取决于上一步返回了什么时。
- **长度不定的任务。** 工作量从几分钟到数小时不等、步骤数未知的任务。
- **新颖领域。** 当你尚不知道正确的工作流是什么时——先探索，后固化。

### 上下文工程的配套读物

《面向 AI 智能体的有效上下文工程》（"Effective context engineering for AI agents"，Anthropic 2025）把这门相邻学科正式化了：20 万 token 的窗口是一份预算，而非一个容器。包含什么、何时压缩、何时让上下文增长。这部分在第 14 阶段关于上下文压缩的课程中有详细讲解（在本课程重新编号之前，即第 14 阶段较早的第 06 课）。

## 动手构建

`code/main.py` 针对一个 `ScriptedLLM` 实现了全部五种工作流模式：

- `prompt_chain(input, steps)` —— 顺序执行。
- `route(input, classifier, handlers)` —— 分类 + 分派。
- `parallel_vote(prompt, n, aggregator)` —— 运行 N 次，聚合。
- `orchestrator_workers(task, workers)` —— 编排者挑选工作者。
- `evaluator_optimizer(task, proposer, evaluator, max_iter)` —— 循环直至通过。

运行它：

```
python3 code/main.py
```

每种模式都会打印各自的执行轨迹。每种模式的代码量约为 10-15 行；而一个框架的成本则以数千行计。

## 实战运用

- 大多数任务用直接的 API 调用即可。
- 仅当模式确实需要持久化状态（LangGraph）、actor 模型并发（AutoGen v0.4）或角色模板化（CrewAI）时，才动用框架。
- 当你想要 Claude Code 那种运行架构、又不想从头重建时，可以使用 Claude Agent SDK。

## 交付成果

`outputs/skill-workflow-picker.md` 会为给定的任务描述挑选出正确的模式，其中包括决策依据，以及当工作流力不从心时改造为智能体的重构路径。

## 练习

1. 实现带置信度阈值的路由。低于阈值则升级转交人工。对于一线客服这个用例，阈值应该落在哪里？
2. 给 `parallel_vote` 加上超时。当某个调用卡住时会发生什么？在缺少部分投票的情况下，你如何聚合？
3. 把 `evaluator_optimizer` 改造成一个老虎机（bandit）：在各次迭代中保留排名前 2 的输出，这样一个后来出现的好结果就不会被一个后来出现的坏结果覆盖掉。
4. 把提示链与路由结合起来：由一个路由器从三条链中挑选一条。对比它与单个大提示方案的 token 成本。
5. 挑选你生产环境中的一项功能，画出它的工作流图，数一数步骤数。在这里换成智能体真的会更好吗？

## 关键术语

| 术语 | 人们口头怎么说 | 它实际意味着什么 |
|------|----------------|------------------|
| Workflow（工作流） | "预定义的流程" | 由工程师掌控的、LLM 与工具调用构成的图 |
| Agent（智能体） | "自主 AI" | 由模型掌控的图；动态指挥工具 |
| Augmented LLM（增强型 LLM） | "带工具的 LLM" | LLM + 搜索 + 工具 + 记忆；最小原子单元 |
| Prompt chaining（提示链） | "顺序调用" | 第 N 次调用的输出是第 N+1 次调用的输入 |
| Routing（路由） | "分类器分派" | 决定由哪条链/哪个模型来处理该输入 |
| Parallelization（并行化） | "扇出（fan out）" | N 个并发调用；按分段或投票方式聚合 |
| Orchestrator-workers（编排者-工作者） | "调度型智能体" | 编排者 LLM 动态挑选专才 LLM |
| Evaluator-optimizer（评估者-优化者） | "提出者 + 裁判" | 反复迭代直至评估者通过；自我精炼的泛化 |

## 延伸阅读

- [Anthropic，《构建有效的智能体》（Building Effective Agents，2024 年 12 月）](https://www.anthropic.com/research/building-effective-agents) —— 五种工作流模式
- [Anthropic，《面向 AI 智能体的有效上下文工程》（Effective context engineering for AI agents）](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) —— 配套学科
- [LangGraph 概览](https://docs.langchain.com/oss/python/langgraph/overview) —— 何时有状态的图才值得其成本
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) —— 编排者-工作者模式的产品化实现
