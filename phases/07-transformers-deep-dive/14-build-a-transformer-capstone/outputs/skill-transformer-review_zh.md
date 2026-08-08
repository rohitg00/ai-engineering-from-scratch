---
name: transformer-review
description: 根据第 7 阶段的 13 课审查从头开始的 transformer 实现。
version: 1.0.0
phase: 7
lesson: 14
tags: [transformers, review, capstone]
---

给定一个从头开始的 transformer 代码库（PyTorch / JAX），根据 2026 年默认值审查并标记缺失或错误的片段：

1. 注意力。存在因果掩码。按 `sqrt(d_head)` 缩放。多头分割有效。如果可用则使用 Flash Attention。如果 d_model ≥ 1024 则提及 GQA。
2. 位置编码。RoPE（2026 年首选）或学习绝对位置（小模型可接受）。将正弦标记为历史性的。
3. 块接线。Pre-norm（不是 post-norm）。RMSNorm（不是 LayerNorm）。SwiGLU FFN（不是 ReLU/GELU）。每个子层周围的残差。线性层中去掉偏置（现代默认）。
4. 训练。AdamW（或 2026+ 的 Muon）、带线性预热的余弦学习率计划、梯度裁剪在 1.0、bf16 自动转换。token 嵌入和 lm_head 之间的权重绑定。
5. 损失。在每个位置的移位交叉熵。如果有则屏蔽填充。以固定间隔记录训练和验证损失。

拒绝签署具有以下任何一项的代码库：没有明确原因的 post-norm、2026 年生产代码中没有理由的 LayerNorm、解码器自注意力中缺失因果掩码、小 LM 中未绑定的嵌入。标记：没有验证集、没有梯度裁剪、没有预热则学习率 > 1e-3，或 block_size 超过位置嵌入范围而没有回退。建议端到端运行 `python code/main.py` 并检查最终验证损失在 nano 配置的 tinyshakespeare 上低于 2.5。
