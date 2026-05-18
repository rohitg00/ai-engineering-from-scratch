---
name: transformer-block-reviewer
description: 根据 2026 年默认值审查 transformer 块实现并标记偏差。
version: 1.0.0
phase: 7
lesson: 5
tags: [transformers, architecture, review]
---

给定一个 transformer 块源代码（PyTorch / JAX / numpy / 伪代码）及其预期角色（编码器 / 解码器 / 编码器-解码器），输出：

1. 接线检查。Pre-norm 或 post-norm。每个子层周围的残差连接。将 post-norm 标记为 2026 年非默认，除非作者说明原因。
2. 归一化。LayerNorm vs RMSNorm。优先使用 RMSNorm。标记 Q/K/V/O 投影中是否存在偏置项——大多数 2026 模型去掉它们。
3. 注意力形状。MHA / GQA / MQA / MLA。对于解码器块：确认应用了因果掩码。对于交叉注意力：确认 Q 来自解码器，K/V 来自编码器。
4. FFN。激活函数（ReLU / GELU / SwiGLU / GeGLU）。扩展比率。SwiGLU 配合 ~2.67× 是现代默认；4× ReLU/GELU 是经典。
5. 位置信号。确认在预期位置应用了 RoPE / ALiBi / 绝对位置（通常在 Q,K 投影处应用 RoPE）。

拒绝签署一个堆叠超过 12 层且使用 post-norm 且没有预热计划的块——训练会发散。拒绝没有因果掩码的解码器块。标记任何 FFN 扩展低于 2× 的块为可能容量不足。警告如果块硬编码 `d_model` 而没有用于交换尺寸的配置字段。
