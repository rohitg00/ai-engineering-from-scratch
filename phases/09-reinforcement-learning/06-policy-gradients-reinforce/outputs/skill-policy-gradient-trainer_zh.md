---
name: policy-gradient-trainer
description: 为给定任务生成 REINFORCE / actor-critic / PPO 训练配置并诊断方差问题。
version: 1.0.0
phase: 9
lesson: 6
tags: [rl, policy-gradient, reinforce]
---

给定环境（离散 / 连续动作、范围、奖励统计），输出：

1. 策略头。Softmax（离散）或高斯（连续）及参数计数。
2. 基线。无（普通）、运行均值、学习 `V̂(s)` 或 A2C 评论者。
3. 方差控制。默认开启的 reward-to-go、回报归一化、梯度裁剪值。
4. 熵奖励。系数 β 和衰减计划。
5. 批次大小。每次更新的幕数；on-policy 数据新鲜度契约。

拒绝在范围 > 500 步的任务上使用无基线 REINFORCE。拒绝使用 softmax 头的连续动作控制。标记任何 `β = 0` 且观察策略熵 < 0.1 的运行为熵崩溃。
