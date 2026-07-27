---
name: sequence-architecture-picker
description: 根据序列长度、吞吐量和训练预算，选择序列架构（RNN、Transformer、SSM、混合架构）
version: 1.0.0
phase: 7
lesson: 1
tags: [transformers, architecture, rnn, ssm]
---

给定一个序列问题（最大长度、批次形状、训练token预算、推理延迟目标、设备类型），输出：

1. **主要架构**。选择以下之一：Transformer、状态空间模型（Mamba/RWKV）、混合SSM+注意力、RNN。用一句话说明受哪个主导约束驱动。

2. **上下文长度策略**。如果是Transformer：完整注意力截止点、滑动窗口大小、RoPE缩放因子。如果是SSM：扫描块大小。如果是RNN：隐藏层宽度。

3. **训练FLOP概况**。根据架构和上下文估算每token的近似FLOP数；说明该规格是否在计算预算范围内。

4. **推理内存概况**。Transformer的KV缓存、SSM的状态大小、RNN的每token内存。标记目标设备是否能容纳单批次大小为1的推理。

5. **风险提示**。说明该选择在给定规模的规格下已知的一个特定失败模式（例如，在没有Flash Attention的24GB GPU上，Transformer在64K上下文时OOM）。

拒绝在训练量超过10亿token时推荐纯RNN，除非明确说明梯度流和并行性惩罚。拒绝在上下文超过64K时推荐完整注意力Transformer，除非说明`O(N^2)`内存成本。拒绝在生产环境中推荐发布不足12个月的全新架构，除非有命名的回退方案。
