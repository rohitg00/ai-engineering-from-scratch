# Anthropic 的工作流模式：简单优于复杂

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Schluntz 与 Zhang（Anthropic，2024 年 12 月）把 workflow（预定义路径）和 agent（动态 tool use）划分开。五种 workflow 模式覆盖了大多数场景。先从直接调用 API 开始，只有当步骤无法预先确定时才引入 agent。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 01 (Agent Loop)
**Time:** ~60 minutes

## 学习目标（Learning Objectives）

- 说出 Anthropic 的五种 workflow 模式：prompt chaining、routing、parallelization、orchestrator-workers、evaluator-optimizer。
- 解释 agent 与 workflow 的区别，以及各自的工程成本。
- 判断何时该选 workflow 而不是 agent（反之亦然）。
- 用标准库（stdlib）针对一个脚本化的 LLM 实现全部五种模式。

## 问题（The Problem）

很多团队碰到本可以一次函数调用搞定的问题，却伸手去抓多 agent 框架。代价是真切的：框架堆出一层层抽象，prompt 被遮蔽、控制流被隐藏，并诱发过早的复杂度。Schluntz 和 Zhang 在 2024 年 12 月那篇博文，是业界引用最多的反向声音：从简单开始，只有当复杂度对得起它的成本时再加进来。

## 概念（The Concept）

### Workflow vs agent（Workflows vs agents）

- **Workflow。** 通过预定义的代码路径来编排 LLM 和工具。图由工程师拥有。
- **Agent。** LLM 动态地指挥自己的工具、自己决定接下来走哪一步。图由模型拥有。

两者各有用武之地。Workflow 更便宜、更快、更易调试；agent 能解决开放式问题，但失败模式更难推理。

### 增强版 LLM（The augmented LLM）

五种模式共同的基础：一个 LLM 串上三种能力——search（检索）、tools（动作）、memory（持久化）。任何一次 API 调用都可以使用它们。

### 五种模式（The five patterns）

1. **Prompt chaining。** 第 1 次调用的输出是第 2 次调用的输入。当任务能被干净地线性分解时使用。步骤之间可以选择性地加程序化的关卡（gate）。

2. **Routing。** 一个分类器 LLM 决定要触发哪个下游 LLM 或工具。当不同类别的输入需要走不同处理路径时使用（tier-1 支持 vs 退款 vs bug vs 销售）。

3. **Parallelization。** 并发跑 N 次 LLM 调用，再聚合结果。两种形态：sectioning（不同片段）和 voting（同一 prompt 跑 N 次，多数表决或综合合成）。

4. **Orchestrator-workers。** 一个 orchestrator LLM 动态决定调哪些 worker（同样是 LLM），并整合它们的输出。形态接近 agent loop，但 orchestrator 不会无限循环下去。

5. **Evaluator-optimizer。** 一个 LLM 提出答案，另一个 LLM 评估它。迭代直到评估器通过。这是 Self-Refine（第 05 课）的泛化版本。

### Workflow 胜过 agent 的场景（Where workflows beat agents）

- **可预测的任务。** 如果你能一一列出步骤，那就该列出来。
- **预算受限的任务。** Workflow 的步数是有界的；agent 可能失控发散。
- **合规受限的任务。** 审计员想要直接读到这张图，而不是从轨迹里反推。

### Agent 胜过 workflow 的场景（Where agents beat workflows）

- **开放式研究。** 当下一步取决于上一步返回了什么。
- **长度可变的任务。** 工作量从几分钟到数小时不等、步数未知。
- **新领域。** 你还不知道正确的 workflow 是什么——先探索，后固化。

### 上下文工程的姊妹篇（The context-engineering companion）

《Effective context engineering for AI agents》（Anthropic 2025）把相邻的这门工程学规范化了：200k 的 context window 是预算，不是容器。该放什么进来、什么时候 compaction（压缩）、什么时候放任 context 增长。这门课在 Phase 14 上下文压缩那节里有详细展开（在重新编号之前，是 Phase 14 早些时候的 lesson 06）。

## 动手实现（Build It）

`code/main.py` 针对一个 `ScriptedLLM` 实现了全部五种 workflow 模式：

- `prompt_chain(input, steps)` — 顺序串联。
- `route(input, classifier, handlers)` — 分类 + 派发。
- `parallel_vote(prompt, n, aggregator)` — 跑 N 次再聚合。
- `orchestrator_workers(task, workers)` — orchestrator 决定调哪些 worker。
- `evaluator_optimizer(task, proposer, evaluator, max_iter)` — 循环直到通过。

跑起来：

```
python3 code/main.py
```

每种模式都会打印自己的 trace。每个模式的代码量大约 10–15 行；引入一个框架的代价是按千行计的。

## 用起来（Use It）

- 大多数任务直接调 API。
- 只有当模式真的需要持久状态（LangGraph）、actor 模型的并发（AutoGen v0.4），或角色模板（CrewAI）时，才上框架。
- 当你想要 Claude Code harness 那种形态、又不想从零搭一个时，伸手去拿 Claude Agent SDK。

## 上线部署（Ship It）

`outputs/skill-workflow-picker.md` 会针对给定任务的描述挑出合适的模式，并附上决策依据，以及当 workflow 撑不住时改写成 agent 的演进路径。

## 练习（Exercises）

1. 给 routing 加上置信度阈值。低于阈值 -> 升级给人类。对一个 tier-1 支持场景来说，阈值应该落在哪里？
2. 给 `parallel_vote` 加超时。当某次调用挂住时会发生什么？投票缺失时你怎么聚合？
3. 把 `evaluator_optimizer` 改造成一个 bandit：跨迭代保留最好的两份输出，这样靠后出现的好结果不会被之后出现的差结果覆盖掉。
4. 把 prompt chaining 和 routing 组合起来：让 router 从三条 chain 里挑一条。和一次大 prompt 的方案相比，量一下 token 成本。
5. 挑一个你生产环境里的功能，画出它的 workflow 图，数一下步数。这里换成 agent 真的会更好吗？

## 关键术语（Key Terms）

| 术语 | 大家口头怎么讲 | 实际含义 |
|------|----------------|------------------------|
| Workflow | 「预定义流程」 | 工程师拥有的、由 LLM 与工具调用组成的图 |
| Agent | 「自主 AI」 | 模型拥有的图；动态指挥工具 |
| Augmented LLM | 「带工具的 LLM」 | LLM + 检索 + 工具 + 记忆；最小原子单位 |
| Prompt chaining | 「顺序调用」 | 第 N 次调用的输出是第 N+1 次的输入 |
| Routing | 「分类派发」 | 选择由哪条 chain / 哪个模型来处理输入 |
| Parallelization | 「fan out」 | N 个并发调用；按 sectioning 或投票聚合 |
| Orchestrator-workers | 「派单 agent」 | orchestrator LLM 动态挑选专家 LLM |
| Evaluator-optimizer | 「提议者 + 评判者」 | 迭代到评估器通过为止；Self-Refine 的泛化 |

## 延伸阅读（Further Reading）

- [Anthropic, Building Effective Agents (Dec 2024)](https://www.anthropic.com/research/building-effective-agents) — 五种 workflow 模式
- [Anthropic, Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — 姊妹篇
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) — 何时有状态的图才对得起它的成本
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) — orchestrator-workers 模式的产品化
