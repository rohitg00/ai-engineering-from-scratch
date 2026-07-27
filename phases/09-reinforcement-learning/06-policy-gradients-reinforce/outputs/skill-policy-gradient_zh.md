---
name: policy-gradient-trainer
description: 为给定任务生成 REINFORCE / actor-critic / PPO 训练配置并诊断方差问题
version: 1.0.0
phase: 9
lesson: 6
tags: [rl, policy-gradient, reinforce]
---

给定一个环境（离散 / 连续动作、时间跨度、奖励统计），输出：

1. **策略头**。Softmax（离散）或高斯分布（连续），附带参数数量。
2. **基线**。无（原生）、运行均值、学习型 `V̂(s)` 或 A2C 评论家。
3. **方差控制**。默认使用奖励-to-go、回报归一化、梯度裁剪值。
4. **熵奖励**。系数 β 和衰减调度。
5. **批次大小**。每次更新的回合数；在策略数据的新鲜度保证。

拒绝在时间跨度 > 500 步时使用 REINFORCE 无基线。拒绝使用 softmax 头进行连续动作控制。标记任何 `β = 0` 且观察到策略熵 < 0.1 的运行为熵崩塌。
