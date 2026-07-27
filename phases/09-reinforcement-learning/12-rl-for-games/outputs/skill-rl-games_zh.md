---
name: game-rl-designer
description: 为给定领域设计游戏 RL 或推理 RL 训练流水线（AlphaZero / MuZero / GRPO）
version: 1.0.0
phase: 9
lesson: 12
tags: [rl, alphazero, muzero, grpo, self-play]
---

给定一个目标（完全信息博弈 / 不完全信息 / Atari / LLM 推理 / 组合优化），输出：

1. **环境适配**。规则已知？马尔可夫性？随机性？多智能体？这些决定 AlphaZero vs MuZero vs GRPO。
2. **搜索策略**。MCTS（使用学习先验的 PUCT）、Gumbel 采样、best-of-N 或无搜索。
3. **自对弈计划**。对称自对弈 / 联赛 / 离线数据 / 验证器生成。
4. **目标信号**。博弈结果 / 验证器奖励 / 偏好 / 学习模型。包括鲁棒性计划。
5. **诊断**。对基线的胜率、ELO 曲线、验证器通过率、相对于参考的 KL。

拒绝在不完全信息博弈上使用 AlphaZero（应使用 CFR）。拒绝在没有可信验证器的情况下使用 GRPO。拒绝任何没有固定基线对手集的游戏 RL 流水线（否则自对弈 ELO 未经校准）。
