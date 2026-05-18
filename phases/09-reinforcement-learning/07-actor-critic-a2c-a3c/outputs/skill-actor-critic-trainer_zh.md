---
name: actor-critic-trainer
description: 为给定环境生成 A2C / A3C / GAE 配置，指定优势估计和损失权重。
version: 1.0.0
phase: 9
lesson: 7
tags: [rl, actor-critic, gae]
---

给定环境和计算预算，输出：

1. 并行性。A2C（GPU 批处理）vs A3C（CPU 异步）和工作线程数。
2. Rollout 长度 T。每次更新每环境的步数。
3. 优势估计器。n 步或 GAE(λ)；指定 λ。
4. 损失权重。`c_v`（值）、`c_e`（熵）、梯度裁剪。
5. 学习率。演员和评论者（如果使用则分开）。

拒绝在范围 > 1000 的环境上使用单工作线程 A2C（太 on-policy、太慢）。拒绝没有优势归一化就交付。标记任何 `c_e = 0` 且观察熵 < 0.1 的运行为熵崩溃。
