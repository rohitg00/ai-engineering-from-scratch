---
name: transformer-review
description: 对照 13 个第 7 阶段课程审查从头实现的 Transformer
version: 1.0.0
phase: 7
lesson: 14
tags: [transformers, review, capstone]
---

给定一个从头实现的 Transformer 代码库（PyTorch / JAX），对照 2026 年默认标准审查并标记缺失或不正确的部分：

1. **注意力**。因果掩码存在。按 `sqrt(d_head)` 缩放。多头拆分正确。如果可用则使用 Flash Attention。如果 d_model ≥ 1024 则提及 GQA。
2. **位置编码**。RoPE（2026 年首选）或学习型绝对位置编码（小型模型可接受）。标记正弦化为历史方案。
3. **块接线**。前置归一化（非后置归一化）。RMSNorm（非 LayerNorm）。SwiGLU FFN（非 ReLU/GELU）。每个子层周围有残差连接。线性层中舍弃偏置（现代默认）。
4. **训练**。AdamW（或 2026+ 的 Muon）、余弦学习率调度 + 线性预热、梯度裁剪为 1.0、bf16 自动混合精度。token 嵌入与 lm_head 之间的权重绑定。
5. **损失**。每个位置的移位一位交叉熵。如果有填充则进行掩码。以固定间隔记录训练和验证损失。

拒绝签署任何存在以下问题的代码库：无明确原因的后置归一化、2026 年生产代码中无正当理由的 LayerNorm、解码器自注意力中缺失因果掩码、小型 LM 中未绑定嵌入。标记：无验证集、无梯度裁剪、学习率 > 1e-3 且无预热、或 block_size 超出位置嵌入范围且无回退方案。建议端到端运行 `python code/main.py` 并检查最终验证损失在 nano 配置下对 tinyshakespeare 数据集是否低于 2.5。
