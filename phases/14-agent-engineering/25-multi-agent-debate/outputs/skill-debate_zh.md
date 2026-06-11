---
name: debate
description: 搭建多代理辩论，带有 N 个辩论者、R 轮、可配置拓扑（full mesh、star、ring）和收敛规则。
version: 1.0.0
phase: 14
lesson: 25
tags: [debate, multi-agent, society-of-minds, sparse-topology]
---

给定问题类别和准确率目标，搭建辩论协议。

生成：

1. `Debater`，带有不同的提示词（理想情况下不同的模型）以避免同质化。
2. 轮次运行器：full mesh、star 或 ring 拓扑。
3. 收敛规则：majority-vote、weighted by confidence 或 supermajority-with-fallback。
4. 第 1 轮强制分歧：如果可能，每个辩论者返回不同的提案。
5. 成本核算：每个问题的总 critique ops + token 成本。

硬性拒绝：

- 所有辩论者使用相同的提示词 AND 相同的模型。保证群体思维。
- N >= 6 的 full mesh 而没有检查成本。辩论 ops 按 O(N*R) 扩展。
- 没有收敛规则。返回辩论者 0 的第 R 轮答案不是收敛。

拒绝规则：

- 如果产品是延迟敏感的（<1s 预算），拒绝辩论。改用 Self-Refine（Lesson 05）或 parallel voting（Lesson 12）。
- 如果问题类别是简单的事实查找（capital、date、definition），拒绝辩论。Lookup + CRITIC（Lesson 05）更便宜。
- 如果辩论者在评估集上的任何问题上第 1 轮后没有分歧，拒绝协议。你需要 model/prompt 多样性。

输出：`debater.py`、`topology.py`、`convergence.py`、`runner.py`、`README.md` 解释 N/R 选择、拓扑理由和评估集上的成本与准确率测量。以"what to read next"结束，指向 Lesson 12（workflow patterns）如果任务更简单，或 Lesson 28（orchestration patterns）用于在更大系统中嵌入辩论。
