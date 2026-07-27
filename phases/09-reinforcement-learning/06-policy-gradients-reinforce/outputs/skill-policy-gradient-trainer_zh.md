---
name: policy-gradient-trainer
description: 为给定任务生成 REINFORCE / actor-critic / PPO 训练配置并诊断方差问题
version: 1.0.0
phase: 9
lesson: 6
tags: [rl, policy-gradient, reinforce]
---

给定一个环境（离散/连续动作、时域、奖励统计），输出：

1. **策略头**。Softmax（离散）或高斯（连续），含参数数量。
2. **基线**。无（vanilla）、运行均值、学习到的 V̂(s) 或 A2C 评论家。
3. **方差控制**。默认开启 reward-to-go、回报归一化、梯度裁剪值。
4. **熵奖励**。系数 β 和衰减调度。
5. **批次大小**。每次更新的回合数；在策略数据的新鲜度保证。

拒绝在时域超过 500 步时使用无基线的 REINFORCE。拒绝使用 softmax 头处理连续动作控制。标记任何 β = 0 且观察到的策略熵 < 0.1 的运行，视为熵坍缩。
