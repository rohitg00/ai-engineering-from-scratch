---
name: td-agent
description: 为表格或小型特征 RL 任务在 Q-learning、SARSA、Expected SARSA 之间选择。
version: 1.0.0
phase: 9
lesson: 4
tags: [rl, td-learning, q-learning, sarsa]
---

给定表格或小型特征环境，输出：

1. 算法。Q-learning / SARSA / Expected SARSA / n 步变体。一句话说明原因，与 on-policy vs off-policy 和方差相关。
2. 超参数。α、γ、ε、衰减计划。
3. 初始化。Q_0 值（乐观 vs 零）和论证。
4. 收敛诊断。目标学习曲线、如果可能 DP 的 `|Q - Q*|` 检查。
5. 部署注意事项。推理时探索将如何表现？是否需要 SARSA 的保守性？

拒绝将表格 TD 应用于状态空间 > 10⁶。拒绝交付没有最大偏差警告的 Q-learning 智能体。标记任何在整个过程中保持 ε = 1.0 训练的智能体（没有利用阶段）。
