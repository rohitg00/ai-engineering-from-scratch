# EAGLE-3 生产环境投机解码

> 投机解码将一个快速的草稿模型与目标模型配对使用。草稿提出 K 个 token；目标模型在一次前向中验证它们；被接受的 token 是免费的。在 2026 年，EAGLE-3 是生产级变体——它在目标模型的隐藏状态上训练草稿头，而不是在原始 token 上，在通用对话中将接受率 alpha 推高到 0.6-0.8 区间。正确的问题不是“草稿有多快”，而是“在我的流量上 alpha 是多少？”如果 alpha 降到约 0.55 以下，在高并发下投机解码是净负收益，因为每个被拒绝的草稿都要付出第二次目标前向的代价。本课教你先测量 alpha，再切换开关。

**Type:** Learn
**Languages:** Python（标准库，玩具级接受率模拟器）
**Prerequisites:** Phase 17 · 04（推理引擎内部机制）、Phase 10 · 18（多 Token 预测）
**Time:** ~60 分钟

## 学习目标

- 说出投机解码的三个发展阶段，并解释 EAGLE-3 相对 EAGLE-2 以及相对经典草稿模型的改动。
- 定义接受率 alpha，根据 alpha 和 K（草稿长度）计算期望加速比，并找出针对你目标并发水平的盈亏平衡 alpha。
- 解释为什么在 vLLM 2026 中投机解码是可选开启（而非默认开启），以及为什么在不测量 alpha 的情况下开启它是一种生产反模式。
- 编写一个测量计划：用哪个基准、哪种 prompt 分布、哪个并发点、以哪个指标作为门控。

## 问题

解码是内存受限的。在 H100 上运行 Llama 3.3 70B FP8 时，每解码一个 token 需要以约 140 GB/s 的速度读取权重并输出一个 token。解码期间 GPU 计算几乎空闲——瓶颈是 HBM 带宽，而非矩阵乘吞吐。

投机解码正是利用了这个间隙。用一个廉价的草稿模型生成 K 个候选 token，然后让目标模型在一次前向中验证全部 K 个。每个被验证的 token 实际上是免费的（分摊到目标模型本来就必须做的一次 batch-of-K 前向中）。

经典草稿模型方法使用同一家族中更小的模型（用 Llama 3.2 1B 为 Llama 3.3 70B 起草）。它可行，但接受率平庸——小模型的分布与目标分布有偏差。EAGLE，接着 EAGLE-2，再到 EAGLE-3，直接在目标模型的内部状态上训练一个轻量草稿头，因此草稿分布与目标分布贴合得紧密得多。这就是 alpha 从草稿模型的 0.4 提升到 EAGLE-3 的 0.6-0.8 的原因。

问题在于：EAGLE-3 在 vLLM 2026 中是可选开启的。必须显式设置 `speculative_config`。不开开关就没有加速。那些在未于真实流量上测量 alpha 的情况下就打开它的团队，往往会看到尾部延迟变差而非变好。

## 概念

### 投机解码真正带来什么

没有投机解码时，每个 token 的成本是一次目标前向。有投机解码时，草稿长度为 K、接受率为 alpha，每次目标前向的期望 token 数为 `1 + K * alpha`。加速比为 `(1 + K * alpha) / (1 + epsilon)`，其中 epsilon 是草稿加验证的开销。对于 K=5，alpha=0.7：`(1 + 5*0.7) / (1 + 0.1) = 4.5 / 1.1 = 4.1x`。实际数字集中在 2-3 倍左右，因为在生产流量上 alpha 很少那么高，而且 epsilon 在高 batch size 下会增大。

### 为什么 alpha 是唯一重要的指标

被拒绝的 token 不会消失——它们会为第一个被拒绝的 token 触发第二次目标前向。在一个 alpha 降到 0.4 的工作负载上，你要同时付出草稿开销、验证开销和重新生成开销。在高并发下（比如 256 并发），解码 batch 已经足够大，以至于“仅目标模型”与“目标模型加验证”之间的内存带宽差距缩小了。在 2026 年的大多数硬件上，alpha 低于 0.55 时，投机解码是净负收益。

Alpha 随工作负载而变。在 ShareGPT 风格的通用对话上，在 ShareGPT 上训练的 EAGLE-3 可达 0.6-0.8。在领域特定流量（代码、医疗、法律）上，用通用数据训练的草稿头会降到 0.4-0.6。训练一个领域特定的草稿头可以恢复 alpha——与目标模型微调相比，这是一个轻量、快速的训练任务。

### EAGLE 各代概览

- **经典草稿模型**：同一家族的小模型。Alpha 0.3-0.5。基础设施简单——加载两个模型，每目标前向对应 K 次草稿前向。
- **EAGLE-1 (2024)**：在目标隐藏状态（最后一层）上训练的单一草稿头。Alpha ~0.5-0.6。目标模型之上仅有很小的参数开销。
- **EAGLE-2 (2025)**：自适应草稿长度和基于树的草稿（一次目标前向验证多个分支）。Alpha ~0.6-0.7。草稿调度器更复杂。
- **EAGLE-3 (2025-2026)**：草稿头在多个目标层上训练（不只是最后一层），对齐更好。通用对话上 Alpha ~0.6-0.8。

### 2026 年生产配方

1. 先上线纯目标模型。在目标并发下测量基线 TTFT、ITL、吞吐。
2. 通过 vLLM `speculative_config` 启用 EAGLE-3 草稿。重跑基准。
3. 记录接受率 alpha。vLLM V1 以 `spec_decode_metrics.accepted_tokens_per_request` 报告该值。除以请求的草稿长度得到 alpha。
4. 如果在生产流量分布上 alpha < 0.55，禁用投机解码或训练领域特定的 EAGLE-3 草稿。
5. 在生产并发下重跑。确认 P99 ITL 没有变差。

### 生产陷阱：P99 尾部

开启投机解码后平均 ITL 会下降。如果不做调优，P99 可能变差。被拒绝的草稿会触发一个两次前向的序列（草稿 + 验证失败 + 重新生成）。在满 batch 下，这两次前向会串行执行。盯住 P99 ITL，而不是 P50。

### EAGLE-3 已部署的场景

Google 于 2025 年在 AI Overviews 中部署了投机解码（质量相同，响应更快）。vLLM V1 以 `speculative_config` 作为文档化接口；V1 中的 N-gram GPU 投机解码是与 chunked prefill 兼容的变体。SGLang 支持 EAGLE-3，作为前缀密集型工作负载的推荐草稿路径。

### 一行盈亏平衡数学

期望加速比：`S(alpha, K) = (1 + K*alpha) / (1 + verify_overhead)`。令 `S = 1` 可解出 alpha：`alpha_breakeven = verify_overhead / K`。对于典型的 verify_overhead ~0.15 和 K=5：`alpha_breakeven = 0.03`。但这是纯解码的数学。在高并发下，验证开销上升，且解码 batch 已经在多条序列间分摊了内存读取，因此实际的有效 alpha_breakeven 攀升到约 0.45-0.55。

### 何时不该使用投机解码

- 延迟无关紧要的 batch-1 离线生成。使用纯目标模型。
- 非常短的输出（少于 50 token）。草稿开销和验证成本占主导。
- 没有领域训练草稿头的专业领域。Alpha 太低。
- vLLM v0.18.0 加草稿模型投机解码加 `--enable-chunked-prefill`。这个组合无法编译。文档记载的例外是 V1 中的 N-gram GPU 投机解码。

```figure
mx-speculative-tree
```

## 动手实践

`code/main.py` 在一系列 alpha 值和草稿长度 K 上模拟有和无投机解码的解码循环。它打印盈亏平衡 alpha、实测加速比和尾部行为。在若干 (alpha, K) 组合上运行它，以精确查看投机解码在何处不再划算。

## 上线部署

本课产出 `outputs/skill-eagle3-rollout.md`。给定一个目标模型、流量分布描述和并发目标，它生成一个分阶段的 EAGLE-3 灰度计划——基准测试基线、启用配置、测量 alpha、以 alpha >= 0.55 作门控、监控 P99 ITL。

## 练习

1. 运行 `code/main.py`。在 K=5 时，要达到 2 倍加速需要多少 alpha？3 倍呢？它对 verify_overhead 有多敏感？
2. 假设生产流量 70% 是通用对话，30% 是代码。通用对话在 ShareGPT 训练的 EAGLE-3 上达到 alpha 0.7；代码达到 alpha 0.4。混合 alpha 是多少？投机解码是否净收益为正？
3. 阅读 vLLM `speculative_config` 文档。说出三种模式（草稿模型、EAGLE、N-gram）以及哪一种与 chunked prefill 兼容。
4. 你发现启用 EAGLE-3 后平均 ITL 下降 25%，但 P99 ITL 上升了 15%。诊断原因并提出缓解方案。
5. 计算 Llama 3.3 70B 的 EAGLE-3 草稿头的内存成本。与将 Llama 3.2 1B 作为经典草稿模型运行相比如何？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| 投机解码 | "draft plus verify" | 用廉价模型提出 K 个 token，在一次目标前向中验证全部 K 个 |
| 接受率 alpha | "spec accept rate" | 草稿 token 被目标模型接受的比例；唯一重要的指标 |
| 草稿长度 K | "spec k" | 每次目标前向草稿提出的 token 数；通常 4-8 |
| 验证开销 epsilon | "spec overhead" | 相比纯目标前向，验证并重新生成的额外成本；随 batch 增长 |
| EAGLE-3 | "latest EAGLE" | 2025-2026 变体；在多个目标层上训练草稿头；通用对话上 alpha 0.6-0.8 |
| `speculative_config` | "vLLM spec config" | vLLM V1 中显式的可选开启项；不设置默认值意味着没有加速 |
| N-gram 投机解码 | "N-gram draft" | 在 GPU 端使用 prompt 中 N-gram 查找的草稿；与 chunked-prefill 兼容 |
| 盈亏平衡 alpha | "no-op alpha" | 投机解码加速比为零时的 alpha；要在生产并发下关注此值 |
| 草稿被拒绝的两次前向 | "reroll cost" | 草稿被拒时发生两次目标前向；推高 P99 尾部 |

## 延伸阅读

- [vLLM — Speculative Decoding docs](https://docs.vllm.ai/en/latest/features/spec_decode/) — 关于 `speculative_config` 以及 V1 中 chunked-prefill 兼容性的权威来源。
- [vLLM Speculative Config API](https://docs.vllm.ai/en/latest/api/vllm/config/speculative/) — 精确的字段集合。
- [EAGLE 论文 (arXiv:2401.15077)](https://arxiv.org/abs/2401.15077) — 原始 EAGLE 草稿头方案。
- [EAGLE-2 论文 (arXiv:2406.16858)](https://arxiv.org/abs/2406.16858) — 自适应草稿与树结构。
- [UC Berkeley EECS-2025-224](https://www2.eecs.berkeley.edu/Pubs/TechRpts/2025/EECS-2025-224.html) — 带投机解码的高效 LLM 系统。
- [BentoML — Speculative Decoding](https://bentoml.com/llm/inference-optimization/speculative-decoding) — 生产灰度清单。