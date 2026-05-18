---
name: rlhf-architect
description: 为语言模型设计 RLHF / DPO / GRPO 对齐流水线，包括 RM、KL 和数据策略。
version: 1.0.0
phase: 9
lesson: 9
tags: [rl, rlhf, alignment, llm]
---

给定基础 LM、目标行为（对齐 / 推理 / 拒绝 / 代理）和偏好或验证器预算，输出：

1. 阶段。SFT？RM？DPO？GRPO？带论证。
2. 偏好或验证器来源。人类、AI 反馈、基于规则、单元测试通过或奖励蒸馏。
3. KL 策略。固定 β、自适应 β 或 DPO（隐式 KL）。
4. 诊断。平均 KL、奖励稳定性、过度优化保护（保留人类评估）。
5. 安全门。红队集、拒绝率、安全 RM 与有用性 RM 分开。

拒绝在没有 KL 监控的情况下交付 RLHF-PPO。拒绝使用小于目标策略的 RM。拒绝仅长度奖励。标记任何没有保留盲法人类评估集的流水线为缺乏过度优化保护。
