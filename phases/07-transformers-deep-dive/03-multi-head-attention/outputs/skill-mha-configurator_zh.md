---
name: mha-configurator
description: 为新 transformer 推荐头数、KV 头数和投影策略（MHA / MQA / GQA / MLA）。
version: 1.0.0
phase: 7
lesson: 3
tags: [transformers, attention, mha, gqa]
---

给定 transformer 规范（参数预算、隐藏大小 `d_model`、目标上下文长度、推理设备内存、训练 vs 推理优先级），输出：

1. 投影变体。其中之一：MHA、GQA、MQA、MLA。一句话说明原因，与 KV 缓存约束相关。
2. 头几何。`n_heads`、`n_kv_heads`、`d_head`。值必须满足 `d_model = n_heads * d_head` 和 `n_heads % n_kv_heads == 0`。
3. KV 缓存估计。所选变体在目标上下文长度下每 token 每层的字节数（fp16）。标记一个批次是否超过目标设备内存。
4. 初始化。Q、K、V、O 矩阵的 Xavier / Kaiming 缩放。注意是否包含偏置项（大多数 2026 模型去掉它们）。
5. 可测试性钩子。一个单一合成任务（例如，归纳头模式 `A B A ? → B`），该配置的训练双层版本应达到 ≥95%。

拒绝推荐 `d_head < 32` —— 注意力动态会崩溃。拒绝为上下文长度超过 32K 的 MHA 推荐 `n_heads > 16`，除非明确计算 KV 缓存价格并建议改用 GQA 或 MLA。拒绝为低于 1B 参数的模型建议 MLA，除非用户明确对其进行基准测试。
