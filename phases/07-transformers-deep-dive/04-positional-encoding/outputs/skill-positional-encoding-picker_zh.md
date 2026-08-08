---
name: positional-encoding-picker
description: 给定上下文长度和训练预算，选择位置编码（RoPE、ALiBi、正弦）+ 缩放策略。
version: 1.0.0
phase: 7
lesson: 4
tags: [transformers, positional-encoding, rope, alibi]
---

给定 transformer 规范（推理时的目标上下文长度、训练时的上下文长度、外推需求、微调 token 预算），输出：

1. 基础编码。其中之一：RoPE、ALiBi、正弦、学习-绝对。一句话说明原因。
2. 超参数。如果是 RoPE：`base` 值、偶数分割的 `d_head` 要求。如果是 ALiBi：斜率公式。如果是正弦：`max_len`。
3. 扩展策略。如果目标 > 训练：NTK 感知缩放因子、YaRN 配置、LongRoPE 规范或位置插值比率。说明微调 token 预算。
4. 测试计划。最大上下文下的 NIAH（大海捞针）通过率目标，困惑度在训练长度基线的 X 范围内。
5. 回退方案。如果长上下文评估失败该怎么办：使用更大的 `base` 重新训练、切换到 ALiBi，或限制部署的上下文长度。

拒绝为 2026 年的新模型推荐正弦或学习-绝对编码——它们不外推，每个现代堆栈都假设 RoPE 或 ALiBi。拒绝在没有微调阶段的情况下将 RoPE 缩放超过训练长度的 8 倍。拒绝在没有对完整部署长度进行 NIAH 运行的情况下交付长上下文配置。
