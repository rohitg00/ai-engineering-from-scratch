---
name: moe-configurator
description: 为新的MoE Transformer选择专家数量、top-k、平衡策略和共享专家布局
version: 1.0.0
phase: 7
lesson: 11
tags: [transformers, moe, mixture-of-experts, scaling]
---

给定一个Transformer规格（总参数预算、每token期望活跃参数量、可用训练token数、推理硬件），输出：

1. **MoE布局**。`n_experts`、`top_k`、`n_shared`。前沿规模选择细粒度（256+专家，top-8）；较小规模选择经典方案（8专家，top-2）。用一句话说明原因。

2. **平衡策略**。无辅助损失（DeepSeek-V3，默认）、Switch风格辅助损失或专家容量 + token丢弃。如果采用无辅助损失，说明`γ`值。

3. **专家并行计划**。如何根据VRAM在GPU间分片专家。说明每专家VRAM成本和总集群规模。

4. **路由精度**。fp32路由器分数 vs fp16。路由精度在大规模下很重要。

5. **失败模式检查**。命名的风险：路由器崩溃、专家饥饿、全对全网络瓶颈、路由开销导致的推理延迟、检查点内存占用。

拒绝在活跃参数低于40亿时推荐MoE——密集模型在相同计算量下表现更优。拒绝在2026年新项目中使用仅辅助损失平衡策略（无辅助损失是默认方案）。拒绝在总参数超过80GB时没有专家并行计划就交付MoE。标记用于延迟敏感的单用户场景的MoE，认为其可能比密集等价模型更慢。
