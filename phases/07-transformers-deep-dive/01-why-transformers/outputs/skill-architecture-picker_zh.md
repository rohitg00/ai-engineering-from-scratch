---
name: sequence-architecture-picker
description: 给定序列长度、吞吐量和训练预算，选择序列架构（RNN、transformer、SSM、混合）。
version: 1.0.0
phase: 7
lesson: 1
tags: [transformers, architecture, rnn, ssm]
---

给定一个序列问题（最大长度、批次形状、训练 token 预算、推理延迟目标、设备类别），输出：

1. 主要架构。其中之一：transformer、状态空间模型（Mamba/RWKV）、混合 SSM+注意力、RNN。一句话说明原因，与主要约束相关。
2. 上下文长度策略。如果是 transformer：全注意力截断、滑动窗口大小、RoPE 缩放因子。如果是 SSM：扫描块大小。如果是 RNN：隐藏层宽度。
3. 训练 FLOP 概况。来自架构 + 上下文的每 token 近似 FLOP；注意规范是否符合计算预算。
4. 推理内存概况。transformer 的 KV 缓存、SSM 的状态大小、RNN 的每 token 内存。标记目标设备是否能容纳单批次大小为 1。
5. 风险说明。该选择在规范规模下已知的一个特定故障模式（例如，在 24GB GPU 上没有 Flash Attention 的情况下，transformer 在 64K 上下文时 OOM）。

拒绝为任何超过 1B token 的训练运行推荐纯 RNN，除非明确说明梯度流和并行性惩罚。拒绝为 >64K 上下文推荐全注意力 transformer，除非说明 `O(N^2)` 内存成本。拒绝为生产环境推荐全新架构（发表 <12 个月），除非有命名的回退方案。
