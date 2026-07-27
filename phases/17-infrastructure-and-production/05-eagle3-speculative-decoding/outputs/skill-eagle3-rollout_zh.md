---
name: eagle3-rollout
description: 制定分阶段 EAGLE-3 推测解码上线方案，在上线前在实际流量上测量接受率 alpha。
version: 1.0.0
phase: 17
lesson: 05
tags: [speculative-decoding, eagle-3, vllm, alpha, production-rollout]
---

给定目标模型、硬件（GPU 类型和数量）、流量描述（通用聊天/代码/专用）、并发目标以及当前基准指标（TTFT、ITL、吞吐量），生成分阶段 EAGLE-3 上线方案。

输出：

1. **基准测量方案**。选择哪个基准（LLMPerf、GenAI-Perf 或生产影子模式）、哪个提示分布、哪个并发点、记录哪些指标（TTFT 均值/P99、ITL 均值/P99、吞吐量、并发数）。
2. **Draft 头选择**。通用聊天使用 ShareGPT 训练的 EAGLE-3。专用流量（代码、医疗、法律）使用领域训练的 EAGLE-3，或在上线前决定训练一个。
3. **配置**。精确的 vLLM `speculative_config` 字段（method、model、num_speculative_tokens）。注意 v0.18.0 兼容性：draft 模型推测不能与 `--enable-chunked-prefill` 结合；V1 中的 N-gram GPU 推测解码是例外情况。
4. **Alpha 门控**。在生产并发下目标 alpha >= 0.55。测量流程：影子流量 24 小时，记录 vLLM `spec_decode_metrics`，用接受的 Token 数除以请求的 draft 长度。如果 alpha 在任何 1 小时窗口内降至 0.45 以下，触发终止开关。
5. **尾部监控**。绘制 P99 ITL 差值（开启推测 - 关闭推测）。如果差值为正，说明拒绝的 draft 两遍模式正在产生影响。对此工作负载减少 K 或禁用。
6. **盈亏平衡检查**。在报告并发下，计算当前验证开销的盈亏平衡 alpha。仅当测量的 alpha 超过盈亏平衡至少 0.1 时才上线。

**硬性拒绝条件：**
- 未在生产流量上测量 alpha 就上线。拒绝并要求 24 小时影子测量。
- 声称 2-3 倍加速但未指明测量的 alpha 值。
- 为延迟不作为约束的离线批处理作业启用推测解码。
- 在 vLLM v0.18.0 上结合 draft 模型推测与 chunked prefill。硬性不兼容。

**拒绝规则：**
- 如果流量主要是极短输出（均值低于 50 Token），拒绝。Draft 开销占主导；上线纯目标模型。
- 如果硬件是消费级（RTX 4090/5090）且批处理大小保持在 8 以下，建议使用纯目标模型——验证开销的批处理分摊需要硬件无法提供的并发度。
- 如果用户希望在无测量循环的情况下自动调优 K，拒绝。K 根据测量的 alpha 加验证开销选择；没有自动调优能替代测量。

**输出**：一页分阶段上线方案，列出基线→配置→alpha 门控→尾部监控→盈亏平衡确认。最后根据诊断，指出"下一步测量什么"段落，指明领域特定 EAGLE-3 训练、降低 K 或回退到纯目标模型。
