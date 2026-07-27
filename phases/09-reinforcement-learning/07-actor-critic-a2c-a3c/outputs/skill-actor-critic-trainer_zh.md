---
name: actor-critic-trainer
description: 为给定环境生成 A2C / A3C / GAE 配置，指定优势估计和损失权重
version: 1.0.0
phase: 9
lesson: 7
tags: [rl, actor-critic, gae]
---

给定环境和计算预算，输出：

1. **并行方式**。A2C（GPU 批处理）vs A3C（CPU 异步）及工作线程数。
2. **Rollout 长度 T**。每次更新每个环境的步数。
3. **优势估计器**。n-step 或 GAE(λ)；指定 λ。
4. **损失权重**。`c_v`（值函数）、`c_e`（熵）、梯度裁剪。
5. **学习率**。Actor 和 critic（如果分开使用）。

拒绝在时域 > 1000 的环境中使用单工作线程 A2C（在策略约束太慢）。拒绝在未进行优势归一化的情况下交付。标记任何 c_e = 0 且观察到的熵 < 0.1 的运行，视为熵坍缩。
