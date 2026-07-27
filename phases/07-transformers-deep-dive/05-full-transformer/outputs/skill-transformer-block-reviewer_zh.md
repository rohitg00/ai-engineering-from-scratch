---
name: transformer-block-reviewer
description: 对照2026年默认标准审查Transformer块实现，标记偏离之处
version: 1.0.0
phase: 7
lesson: 5
tags: [transformers, architecture, review]
---

给定一个Transformer块源码（PyTorch / JAX / numpy / 伪代码）及其预期角色（编码器 / 解码器 / 编码器-解码器），输出：

1. **接线检查**。前归一化还是后归一化。每个子层周围的残差连接。除非作者说明原因，否则标记后归一化为2026年的非默认做法。

2. **归一化**。LayerNorm vs RMSNorm。首选RMSNorm。标记Q/K/V/O投影中是否存在偏置项——大多数2026年模型已去掉它们。

3. **注意力形状**。MHA / GQA / MQA / MLA。对于解码器块：确认应用了因果掩码。对于交叉注意力：确认Q来自解码器，K/V来自编码器。

4. **前馈网络**。激活函数（ReLU / GELU / SwiGLU / GeGLU）。扩展比。SwiGLU配~2.67倍是现代默认值；4倍ReLU/GELU是经典方案。

5. **位置信号**。确认在预期位置应用了RoPE / ALiBi / 绝对位置编码（通常RoPE作用于Q、K投影）。

拒绝签署超过12层且使用后归一化但没有预热策略的块——训练会发散。拒绝没有因果掩码的解码器块。标记任何FFN扩展比低于2倍的块，认为其可能容量不足。警告任何硬编码了`d_model`而没有配置字段用于动态调整大小的块。
