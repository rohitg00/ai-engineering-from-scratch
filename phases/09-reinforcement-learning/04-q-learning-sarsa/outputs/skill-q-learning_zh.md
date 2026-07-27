---
name: td-agent
description: 为表格型或小特征 RL 任务选择 Q-learning、SARSA 或 Expected SARSA
version: 1.0.0
phase: 9
lesson: 4
tags: [rl, td-learning, q-learning, sarsa]
---

给定一个表格型或小特征环境，输出：

1. **算法**。Q-learning / SARSA / Expected SARSA / n 步变体。用一句话说明原因与在策略 vs 离策略和方差有关。
2. **超参数**。α、γ、ε、衰减调度。
3. **初始化**。Q_0 值（乐观 vs 零）及理由。
4. **收敛诊断**。目标学习曲线，如可能则检查 `|Q - Q*|`。
5. **部署注意事项**。推理时探索行为如何？是否需要 SARSA 的保守性？

拒绝将表格型 TD 应用于状态空间 > 10⁶ 的情况。拒绝在未说明最大偏差注意事项的情况下发布 Q-learning agent。标记任何在完整训练过程中 ε 保持为 1.0（无利用阶段）的 agent。
