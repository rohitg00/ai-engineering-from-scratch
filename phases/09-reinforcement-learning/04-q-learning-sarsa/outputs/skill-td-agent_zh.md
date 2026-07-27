---
name: td-agent
description: 在 Q-learning、SARSA、Expected SARSA 之间为表格型或小特征 RL 任务进行选择
version: 1.0.0
phase: 9
lesson: 4
tags: [rl, td-learning, q-learning, sarsa]
---

给定一个表格型或小特征环境，输出：

1. **算法**。Q-learning / SARSA / Expected SARSA / n-step 变体。结合在策略 vs 离策略和方差给出一句话理由。
2. **超参数**。α、γ、ε、衰减调度。
3. **初始化**。Q_0 值（乐观 vs 零）及理由。
4. **收敛诊断**。目标学习曲线，如果 DP 可行则检查 `|Q - Q*|`。
5. **部署注意事项**。推理时探索行为如何？是否需要 SARSA 的保守性？

拒绝将表格型 TD 应用于状态空间 > 10⁶ 的情况。拒绝在未说明最大偏差注意事项的情况下交付 Q-learning 智能体。标记任何在整个训练过程中 ε 保持为 1.0 的智能体（无利用阶段）。
