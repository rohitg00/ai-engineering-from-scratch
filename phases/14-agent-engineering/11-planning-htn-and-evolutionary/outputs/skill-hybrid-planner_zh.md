---
name: hybrid-planner
description: 构建一个混合规划器——ChatHTN 用于可证明正确的规划，AlphaEvolve 用于带可机器检查评估器的代码搜索——并为问题选择正确的方案。
version: 1.0.0
phase: 14
lesson: 11
tags: [planning, htn, chathtn, alphaevolve, evolutionary-search]
---

给定一个问题类别（策略约束工作流 vs 代码优化 vs 开放式任务），选择一个规划器并生成正确的框架。

决策：

1. 问题是否有严格的前置条件/策略/调度约束？→ HTN（ChatHTN）。
2. 问题是否有确定性、可机器检查的适应度函数？→ 进化式（AlphaEvolve）。
3. 都不是？→ 转而使用 ReAct（第 01 课）或 ReWOO（第 02 课）。

对于 HTN，产出：

1. `Operator` 类型，包含 `preconditions`、`effects_add`、`effects_remove`。
2. `Method` 类型，包含 `task`、`preconditions`、`subtasks`。
3. 一个规划器，先尝试方法，回退到 LLM 分解，并缓存成功的 LLM 分解。
4. 一个验证步骤，拒绝引用未知操作符或方法的 LLM 分解。

对于进化式，产出：

1. 候选程序的初始种群。
2. 一个返回标量适应度值的确定性评估器。
3. 一个变异算子（LLM 驱动或基于规则）。
4. 一个带早停机制的选择循环（保留 top-k、变异、重复）。

硬性拒绝：

- ChatHTN 中 LLM 输出未经操作符模式验证直接应用。正确性声明将失效。
- AlphaEvolve 中评估器调用 LLM 判断器。适应度必须是确定性的；LLM 判断器引入随机噪声，循环无法恢复。
- 任一模式用于开放式任务（"写一篇博客文章"）。没有评估器，没有前置条件→使用 ReAct。

拒绝规则：

- 如果领域没有清晰的操作符模式，拒绝 ChatHTN。建议使用 ReWOO 或纯 ReAct。
- 如果领域没有可机器检查的适应度，拒绝 AlphaEvolve。建议使用 Self-Refine（第 05 课）。
- 如果用户想要"规划器 + LLM 做最终决策"，拒绝。符号正确性与 LLM 探索之间的分工是承重的。

输出：`operators.py`、`methods.py`、`planner.py`（HTN）或 `evaluator.py`、`mutator.py`、`loop.py`（进化式），外加 `README.md` 包含决策理由。以"下一步阅读"结尾，如果辩论式验证适合问题则指向第 25 课，或者如果任务实际上是 ReWOO 风格的则指向第 02 课。
