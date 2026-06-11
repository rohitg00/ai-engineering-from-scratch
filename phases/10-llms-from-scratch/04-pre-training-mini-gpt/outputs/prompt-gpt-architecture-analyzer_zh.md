---
name: prompt-gpt-architecture-analyzer
description: 分析任何 GPT 风格 transformer 模型中的架构选择
version: 1.0.0
phase: 10
lesson: 4
tags: [gpt, transformer, architecture, attention, kv-cache, scaling, pre-training]
---

# GPT 架构分析器

从技术报告、模型卡或训练日志评估 GPT 风格模型时，使用此框架分解架构并识别设计权衡。

## 分析协议

### 1. 参数分配分解

计算每个组件的精确参数数量：

- **Token 嵌入**：vocab_size x embed_dim
- **位置嵌入**：max_seq_len x embed_dim
- **每块注意力**：4 x embed_dim x embed_dim（Q、K、V、输出投影）
- **每块 FFN**：2 x embed_dim x ff_dim + embed_dim + ff_dim（两个线性层 + 偏置）
- **每块 LayerNorm**：4 x embed_dim（两个归一化层，每个包含 scale + bias）
- **最终 LayerNorm**：2 x embed_dim
- **输出头**：vocab_size x embed_dim（如果与 token 嵌入权重共享则为 0）

标记任何单个组件是否超过总参数的 40%。嵌入矩阵在小模型中占主导。注意力和 FFN 在大模型中占主导。

### 2. 注意力设计分析

评估注意力配置：

- **头维度**：embed_dim / num_heads。标准值为 64（GPT-2）或 128（Llama 3）。低于 32 限制每头的表达能力。高于 128 浪费计算且收益甚微。
- **每层头数**：更多头 = 更多样化的注意力模式，但 KV cache 占用更多内存。
- **分组查询注意力 (GQA)**：模型是否在多个 Q 头之间共享 K/V 头？Llama 3 使用 GQA，32 个 Q 头对应 8 个 KV 头。这将 KV cache 减少 4 倍。
- **上下文长度**：最大位置嵌入。RoPE 允许外推到训练长度之外。绝对位置嵌入则不行。

### 3. 内存预算

在模型最大上下文长度下进行推理：

- **权重 (FP16)**：total_params x 2 字节
- **KV Cache (FP16)**：2 x num_layers x num_kv_heads x head_dim x max_seq_len x 2 字节
- **激活**：batch_size x seq_len x embed_dim x 2 字节 x num_layers（近似值）

标记 KV cache 是否超过权重内存。这发生在长上下文模型（128K+）中，表明模型在解码期间受内存限制。

### 4. 计算特征

- **Prefill FLOPS per token**：约 2 x total_params（每个参数一次矩阵乘法，前向传播）
- **Decode FLOPS per token**：与 prefill 相同，但在单个 token 上
- **Prefill 瓶颈**：计算受限（GPU TFLOPS）
- **Decode 瓶颈**：内存受限（GPU 内存带宽）
- **算术强度**：每字节内存访问的 FLOPS。低于 100 = 内存受限。

### 5. 扩展决策

根据已知的缩放定律评估：

- **Chinchilla 最优**：对于给定计算预算 C，最优模型大小 N 和 token 数量 D 满足 N ~ D（大致相等缩放）。7B 模型需要约 140B token。
- **Llama 3 过训练**：Meta 在 15T token 上训练 Llama 3 8B（100 倍 Chinchilla 最优）。在更多数据上过度训练小模型可产生更好的每 token 推理成本。
- **宽度 vs 深度**：对于相同参数数量，更深的模型（更多层）通常比更宽的模型（更大的 embed_dim）更具样本效率。

## 危险信号

- **FFN 比例不是 4x**：标准值为 ff_dim = 4 x embed_dim。Llama 使用 SwiGLU 的 8/3 x embed_dim。偏差应有正当理由。
- **没有权重共享**：除非 vocab_size 相对于 embed_dim 非常大，否则输出头应与 token 嵌入共享权重。
- **13B 以上没有 GQA**：没有分组查询注意力的 13B 以上模型将具有过大的 KV cache。
- **长上下文没有 RoPE**：绝对位置嵌入无法外推到训练长度之外。目标为 32K+ 上下文的模型应使用旋转嵌入。
- **学习率对模型大小来说过高**：更大的模型需要更低的峰值学习率。GPT-2 Small 使用 6e-4。Llama 3 405B 使用 8e-5。

## 输出格式

1. **参数表**：按组件划分的参数数量及百分比
2. **内存预算**：最大上下文长度下的权重、KV cache 和激活内存
3. **计算特征**：A100/H100 的 prefill 和 decode 吞吐量估算
4. **设计评估**：模型做对了什么以及什么是非标准的
5. **缩放 verdict**：模型大小是否适合其训练数据
