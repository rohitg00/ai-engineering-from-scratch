---
name: transformer-review
description: 对照第 7 阶段的 13 节课，审查从头实现的 Transformer
version: 1.0.0
phase: 7
lesson: 14
tags: [transformers, review, capstone]
---

给定一个从头实现的 Transformer 代码库（PyTorch / JAX），对照 2026 年默认实践进行审查，标记缺失或不正确的部分：

1. **注意力机制**。存在因果掩码。按 `sqrt(d_head)` 缩放。多头拆分正常工作。如果可用则使用 Flash Attention。如果 d_model ≥ 1024，提及 GQA。
2. **位置编码**。RoPE（2026 年首选）或学习绝对位置编码（小模型可接受）。将正弦编码标记为历史做法。
3. **模块布线**。前归一化（非后归一化）。RMSNorm（非 LayerNorm）。SwiGLU FFN（非 ReLU/GELU）。每个子层周围都有残差连接。线性层中去除偏置（现代默认）。
4. **训练**。AdamW（或 2026+ 的 Muon），余弦学习率调度 + 线性预热，梯度裁剪 1.0，bf16 自动混合精度。token 嵌入和 lm_head 之间的权重绑定。
5. **损失**。每个位置移位一位的交叉熵。如果有填充则掩码掉。按固定间隔记录训练和验证损失。

拒绝签署任何存在以下问题的代码库：无明确原因的后归一化、2026 年生产代码中无正当理由的 LayerNorm、解码器自注意力中缺少因果掩码、小语言模型中未绑定的嵌入。标记：无验证集、无梯度裁剪、学习率 > 1e-3 且无预热、block_size 超过位置嵌入范围且无回退方案。建议端到端运行 `python code/main.py`，并检查在 nano 配置下 tinyshakespeare 上的最终验证损失是否低于 2.5。
