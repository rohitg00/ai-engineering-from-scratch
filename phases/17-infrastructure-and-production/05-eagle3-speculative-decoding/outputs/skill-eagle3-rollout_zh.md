---
name: eagle3-rollout
description: 制定分阶段 EAGLE-3 推测解码上线计划，在发布前于真实流量上测量接受率 alpha。
version: 1.0.0
phase: 17
lesson: 05
tags: [speculative-decoding, eagle-3, vllm, alpha, production-rollout]
---

给定目标模型、硬件（GPU 类型和数量）、流量描述（通用聊天/代码/专业）、并发目标，以及当前基线指标（TTFT、ITL、吞吐量），生成分阶段 EAGLE-3 上线计划。

生成：

1. 基线测量计划。哪个基准（LLMPerf、GenAI-Perf 或生产影子）、哪个提示分布、哪个并发点、要记录的哪些指标（TTFT mean/P99、ITL mean/P99、吞吐量、并发）。
2. Draft-head 选择。通用聊天用 ShareGPT 训练的 EAGLE-3。专业流量（代码、医疗、法律）用领域训练的 EAGLE-3，或决定在发布前训练一个。
3. 配置。精确的 vLLM `speculative_config` 字段（method、model、num_speculative_tokens）。注意 v0.18.0 兼容性：draft-model 推测不能与 `--enable-chunked-prefill` 结合；V1 中的 N-gram GPU 推测解码是例外。
4. Alpha 门。生产并发下目标 alpha >= 0.55。测量程序：影子流量 24 小时，记录 vLLM `spec_decode_metrics`，用接受的 token 除以请求的 draft 长度。如果 alpha 在任何 1 小时窗口内低于 0.45，触发终止开关。
5. 尾部观察。绘制 P99 ITL delta（spec on - spec off）。如果 delta 为正，被拒绝的 draft 两遍模式在影响。降低 K 或在此工作负载上禁用。
6. 盈亏平衡检查。在报告的并发下，计算当前验证开销的盈亏平衡 alpha。仅在测量 alpha 超过盈亏平衡至少 0.1 时发布。

硬性拒绝：
- 未在生产流量上测量 alpha 就发布。拒绝并要求 24 小时影子测量。
- 未命名测量 alpha 就声称 2-3 倍加速。
- 为离线批处理作业启用推测解码，其中延迟不是约束。
- 在 vLLM v0.18.0 上结合 draft-model 推测与 chunked prefill。硬不兼容。

拒绝规则：
- 如果流量主要是非常短的输出（平均低于 50 token），拒绝。Draft 开销占主导；发布 plain target。
- 如果硬件是消费级（RTX 4090 / 5090）且批次大小保持在 8 以下，推荐 plain target——验证开销的批次摊销需要硬件无法提供的并发。
- 如果用户想要没有测量循环的 K 自动调优，拒绝。K 是从测量的 alpha 加验证开销中选择的；没有自动调优能替代测量。

输出：一页分阶段上线计划，列出基线 → 配置 → alpha 门 → 尾部观察 → 盈亏平衡确认。以“接下来测量什么”段落结束，根据诊断命名 domain-specific EAGLE-3 训练、lower K 或回退到 plain target。
