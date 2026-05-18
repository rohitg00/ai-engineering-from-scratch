---
name: hybrid-planner
description: 构建混合规划器 —— ChatHTN 用于可证明正确的计划，AlphaEvolve 用于带有机器可检查评估器的代码搜索 —— 并为问题选择正确的规划器。
version: 1.0.0
phase: 14
lesson: 11
tags: [planning, htn, chathtn, alphaevolve, evolutionary-search]
---

给定问题类别（policy-bound workflow vs code optimization vs open-ended task），选择规划器并生成正确的脚手架。

决策：

1. 问题是否有硬前提条件 / 策略 / 调度约束？-> HTN (ChatHTN)。
2. 问题是否有确定性、机器可检查的 fitness function？-> Evolutionary (AlphaEvolve)。
3. 都不是？-> 改用 ReAct (Lesson 01) 或 ReWOO (Lesson 02)。

对于 HTN，生成：

1. `Operator` 类型，带有 `preconditions`、`effects_add`、`effects_remove`。
2. `Method` 类型，带有 `task`、`preconditions`、`subtasks`。
3. 先尝试方法，回退到 LLM 分解，并缓存成功的 LLM 分解的规划器。
4. 拒绝引用未知操作符或方法的 LLM 分解的验证步骤。

对于 Evolutionary，生成：

1. 候选程序的种子群体。
2. 返回标量 fitness 的确定性评估器。
3. 变异操作符（LLM 驱动或基于规则）。
4. 选择循环（保留 top-k、变异、重复）带有提前停止。

硬性拒绝：

- ChatHTN 中 LLM 输出直接应用而没有操作符模式验证。正确性声明失败。
- AlphaEvolve 中评估器调用 LLM judge。Fitness 必须是确定性的；LLM judge 引入循环无法恢复的随机噪声。
- 任一模式用于 open-ended tasks（"写一篇博客文章"）。没有评估器，没有前提条件 -> 使用 ReAct。

拒绝规则：

- 如果领域没有清晰的操作符模式，拒绝 ChatHTN。建议 ReWOO 或普通 ReAct。
- 如果领域没有机器可检查的 fitness，拒绝 AlphaEvolve。建议 Self-Refine (Lesson 05)。
- 如果用户想要"规划器 + LLM 做最终决定"，拒绝。符号正确性和 LLM 探索之间的分割是 load-bearing。

输出：`operators.py`、`methods.py`、`planner.py`（HTN）或 `evaluator.py`、`mutator.py`、`loop.py`（evolutionary），加上 `README.md` 及决策理由。以"what to read next"结束，指向 Lesson 25（如果 debate-style verification 适合问题）或 Lesson 02（如果任务实际上毕竟是 ReWOO 风格）。
