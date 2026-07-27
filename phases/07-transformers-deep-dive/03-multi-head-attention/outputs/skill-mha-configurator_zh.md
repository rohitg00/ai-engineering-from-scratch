---
name: mha-configurator
description: 为新的Transformer推荐头数、KV头数和投影策略（MHA / MQA / GQA / MLA）
version: 1.0.0
phase: 7
lesson: 3
tags: [transformers, attention, mha, gqa]
---

给定一个Transformer规格（参数预算、隐藏层大小`d_model`、目标上下文长度、推理设备内存、训练vs推理优先级），输出：

1. **投影变体**。选择以下之一：MHA、GQA、MQA、MLA。用一句话说明与KV缓存约束相关的原因。

2. **头几何**。`n_heads`、`n_kv_heads`、`d_head`。值必须满足 `d_model = n_heads * d_head` 且 `n_heads % n_kv_heads == 0`。

3. **KV缓存估算**。在目标上下文长度下，所选变体的每层每token字节数（fp16）。标记一个批次是否超出目标设备内存。

4. **初始化**。Q、K、V、O矩阵的Xavier/Kaiming缩放。说明是否包含偏置项（大多数2026年的模型已去掉它们）。

5. **可测试性钩子**。一个单一的合成任务（例如归纳头模式`A B A ? → B`），该配置的两层训练版本应能达到≥95%的准确率。

拒绝推荐`d_head < 32`——注意力动态会崩溃。拒绝在上下文长度超过32K时推荐`n_heads > 16`的MHA，除非明确计算KV缓存成本并建议改用GQA或MLA。拒绝为低于10亿参数的模型推荐MLA，除非用户明确要进行基准测试。
