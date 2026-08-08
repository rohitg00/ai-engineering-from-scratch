---
name: mc-evaluator
description: 通过蒙特卡洛 rollout 评估策略并生成收敛报告，如果可用则与 DP 比较。
version: 1.0.0
phase: 9
lesson: 3
tags: [rl, monte-carlo, evaluation]
---

给定环境（分幕式，具有 reset+step API）和策略，输出：

1. 方法。首次访问 vs 每次访问 MC。原因。
2. 幕预算。目标数量、方差诊断、预期标准误差。
3. 探索计划。ε 计划（如果需要）或探索性起始。
4. 金标准比较。如果是表格则 DP 最优 V*；否则来自 Q-learning / PPO 基线的界限。
5. 终止检查。最大步数上限、超时、处理非终止轨迹。

拒绝在没有有限范围上限的非分幕式任务上运行 MC。拒绝报告表格任务每状态少于 100 幕的 V^π 估计。标记任何具有零方差动作的策略作为探索风险。
