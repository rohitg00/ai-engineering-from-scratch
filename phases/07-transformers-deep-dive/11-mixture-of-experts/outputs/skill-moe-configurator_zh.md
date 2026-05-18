---
name: moe-configurator
description: 为新的 MoE transformer 选择专家数量、top-k、平衡策略和共享专家布局。
version: 1.0.0
phase: 7
lesson: 11
tags: [transformers, moe, mixture-of-experts, scaling]
---

给定 transformer 规范（总参数预算、每 token 期望的活跃参数、可用训练 token、推理硬件），输出：

1. MoE 布局。`n_experts`、`top_k`、`n_shared`。前沿规模选择细粒度（256+ 专家，top-8）；较小规模选择经典（8 专家，top-2）。一句话说明原因。
2. 平衡策略。无辅助损失（DeepSeek-V3，默认）、Switch 风格辅助损失，或专家容量 + token 丢弃。如果是无辅助损失，命名 `γ` 值。
3. 专家并行计划。给定 VRAM，如何在 GPU 上分片专家。说明每专家 VRAM 成本和总集群大小。
4. 路由精度。fp32 路由器分数 vs fp16。路由器精度在大规模时很重要。
5. 故障模式检查。命名风险：路由器崩溃、专家饥饿、all-to-all 网络瓶颈、路由开销导致的推理延迟、检查点内存占用。

拒绝为活跃参数低于 4B 的推荐 MoE——在匹配计算下密集模型获胜。拒绝为 2026 年的新项目推荐仅辅助损失平衡（无辅助损失是默认）。拒绝在没有专家并行计划的情况下交付 MoE，如果总参数超过 80 GB。标记 MoE 用于延迟关键的单用户路径可能比密集等效物更慢。
