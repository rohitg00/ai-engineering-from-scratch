# 05 · 生产环境中的 EAGLE-3 投机解码

> 「投机解码（speculative decoding）」将一个快速的「草稿模型（draft model）」与目标模型配对。草稿模型提出 K 个 token；目标模型在一次前向中完成验证；被接受的 token 相当于免费获得。在 2026 年，EAGLE-3 是生产级的变体——它在目标模型的隐藏状态上训练草稿头，而非在原始 token 上训练，从而把「接受率（acceptance rate）」alpha 在通用对话场景下推到 0.6–0.8 区间。真正该问的不是「草稿有多快」，而是「我的流量上的 alpha 是多少？」如果 alpha 跌到 ~0.55 以下，在高并发下投机解码就是净负收益，因为每一次被拒绝的草稿都要付出第二次目标前向的代价。本课教你先测量 alpha，再去打开开关。

**类型：** 学习
**语言：** Python（标准库，玩具级接受率模拟器）
**前置：** 阶段 17 · 04（vLLM 服务内核）、阶段 10 · 18（多 token 预测）
**时长：** 约 60 分钟

## 学习目标

- 说出投机解码的三代演进，并解释 EAGLE-3 相对 EAGLE-2 以及相对经典草稿模型改变了什么。
- 定义接受率 alpha，根据 alpha 和 K（草稿长度）计算期望加速比，并为你的目标并发量确定盈亏平衡 alpha。
- 解释为什么在 vLLM 2026 中投机解码是「按需开启（opt-in）」（非默认），以及为什么不测量 alpha 就打开它是一种生产反模式。
- 写出一份测量计划：用哪个基准、哪种 prompt 分布、哪个并发点、用哪个指标作为门槛。

## 问题所在

解码（decode）是「内存受限（memory-bound）」的。在跑 Llama 3.3 70B FP8 的 H100 上，每解码一个 token 要读取约 140 GB/s 的权重，只产出一个 token。解码期间 GPU 的算力几乎闲置——瓶颈是 HBM 带宽，不是矩阵乘的吞吐。

投机解码利用了这个落差。先用一个廉价的草稿模型生成 K 个候选 token，再让目标模型在一次前向中验证全部 K 个。每个被验证通过的 token 实际上是免费的（它被摊销进了目标模型本就要做的那次「K 个一批」的前向中）。

经典草稿模型方法使用同一系列中较小的模型（用 Llama 3.2 1B 为 Llama 3.3 70B 起草）。它能用，但接受率平庸——较小模型的分布会偏离目标。EAGLE，然后 EAGLE-2，再到 EAGLE-3，则直接在目标模型的内部状态上训练一个轻量的草稿头，于是草稿的分布更紧密地跟随目标。这就是为什么 alpha 能从草稿模型的 0.4 提升到 EAGLE-3 的 0.6–0.8。

但有个前提：EAGLE-3 在 vLLM 2026 中是按需开启的。`speculative_config` 必须显式设置。没有这个开关，就没有加速。那些没在真实流量上测量 alpha 就直接打开它的团队，往往会看到尾延迟变得更糟，而不是更好。

## 概念解析

### 投机解码究竟买到了什么

没有投机解码时，每个 token 的成本是一次目标前向。在草稿长度为 K、接受率为 alpha 的投机解码下，每次目标前向期望产出的 token 数是 `1 + K * alpha`。加速比为 `(1 + K * alpha) / (1 + epsilon)`，其中 epsilon 是草稿加验证的开销。对于 K=5、alpha=0.7：`(1 + 5*0.7) / (1 + 0.1) = 4.5 / 1.1 = 4.1x`。现实中的数字大多聚集在 2–3x，因为生产流量上的 alpha 很少有那么高，而且 epsilon 会随批量增大而上升。

### 为什么 alpha 是唯一重要的指标

被拒绝的 token 不会凭空消失——它们会迫使系统对第一个被拒 token 再做一次目标前向。在 alpha 跌到 0.4 的负载上，你要付出草稿开销加验证加重跑（re-roll）的代价。在高并发下（比如 256 路并发），解码批量本就已经足够大，「单独跑目标」与「目标带验证」之间的内存带宽落差被压缩了。在 2026 年的多数硬件上，alpha 低于 0.55 时投机解码就是净负收益。

alpha 随负载而变。在 ShareGPT 风格的通用对话上，用 ShareGPT 训练的 EAGLE-3 能达到 0.6–0.8。在领域特定流量（代码、医疗、法律）上，用通用数据训练的草稿头会跌到 0.4–0.6。训练一个领域特定的草稿头能把 alpha 找回来——相比目标模型的微调，这是一项轻量、快速的训练任务。

### EAGLE 各代一览

- **经典草稿模型**：同系列的小模型。alpha 0.3–0.5。基础设施简单——加载两个模型，每次目标前向草稿跑 K 次前向。
- **EAGLE-1（2024）**：在目标隐藏状态（最后一层）上训练的单个草稿头。alpha ~0.5–0.6。在目标之上只增加很小的参数开销。
- **EAGLE-2（2025）**：自适应草稿长度与基于树的草稿（在一次目标前向中验证多个分支）。alpha ~0.6–0.7。草稿调度器更复杂。
- **EAGLE-3（2025–2026）**：在多个目标层（不只是最后一层）上训练草稿头，对齐更好。通用对话上 alpha ~0.6–0.8。

### 2026 年的生产配方

1. 先原样上线目标模型。在目标并发量下测量基线 TTFT、ITL、吞吐。
2. 通过 vLLM 的 `speculative_config` 启用 EAGLE-3 草稿。重跑基准。
3. 记录接受率 alpha。vLLM V1 以 `spec_decode_metrics.accepted_tokens_per_request` 报告这个值。除以请求的草稿长度即得 alpha。
4. 如果在生产流量分布上 alpha < 0.55，则关闭投机解码，或训练一个领域特定的 EAGLE-3 草稿。
5. 在生产并发量下重跑。确认 P99 ITL 没有变差。

### 生产陷阱：P99 尾部

平均 ITL 在投机解码下会下降。但如果不调优，P99 可能变差。被拒绝的草稿会触发一个两趟序列（草稿 + 验证失败 + 重跑）。在满批量下，这两趟会串行执行。要盯 P99 ITL，而不是 P50。

### EAGLE-3 已经部署在哪里

Google 在 2025 年把投机解码部署到了 AI Overviews 中（质量不变，响应更快）。vLLM V1 以 `speculative_config` 作为有文档的接口；V1 中的 N-gram GPU 投机解码是与「分块预填充（chunked prefill）」兼容的变体。SGLang 把 EAGLE-3 作为前缀密集型负载推荐的草稿路径来支持。

### 一行公式的盈亏平衡数学

期望加速比：`S(alpha, K) = (1 + K*alpha) / (1 + verify_overhead)`。令 `S = 1` 解出 alpha：`alpha_breakeven = verify_overhead / K`。对于典型的 verify_overhead ~0.15 和 K=5：`alpha_breakeven = 0.03`。但这只是裸解码的数学。在高并发下验证开销会上升，而且解码批量本就已经在多个序列间摊销了内存读取，因此实际有效的 alpha_breakeven 会爬升到约 0.45–0.55。

### 何时不该用投机解码

- 延迟无所谓的 batch-1 离线生成。用裸目标模型即可。
- 极短输出（不到 50 个 token）。草稿开销和验证成本占主导。
- 没有领域训练草稿头的专门领域。alpha 太低。
- vLLM v0.18.0 加草稿模型投机解码加 `--enable-chunked-prefill`。这个组合无法编译。有文档记载的例外是 V1 中的 N-gram GPU 投机解码。

## 动手用

`code/main.py` 在一系列 alpha 值和草稿长度 K 上模拟了带与不带投机解码的解码循环。它会打印盈亏平衡 alpha、实测加速比和尾部行为。在若干组 (alpha, K) 组合上运行它，能精确看到投机解码在哪里开始不再划算。

## 交付它

本课产出 `outputs/skill-eagle3-rollout.md`。给定一个目标模型、一段流量分布描述和一个并发目标，它会产出一份分阶段的 EAGLE-3 上线计划——基准基线、启用配置、测量 alpha、以 alpha >= 0.55 作为门槛、盯 P99 ITL。

## 练习

1. 运行 `code/main.py`。在 K=5 时，要达到 2x 加速你需要多大的 alpha？3x 加速呢？这对 verify_overhead 有多敏感？
2. 设想生产流量按 70% 通用对话、30% 代码切分。用 ShareGPT 训练的 EAGLE-3 在通用对话上达到 alpha 0.7；代码上达到 alpha 0.4。混合 alpha 是多少，投机解码是否净正收益？
3. 阅读 vLLM 的 `speculative_config` 文档。说出三种模式（草稿模型、EAGLE、N-gram），以及哪一种与分块预填充兼容。
4. 你看到启用 EAGLE-3 后平均 ITL 下降了 25%，但 P99 ITL 上升了 15%。诊断原因并提出一个缓解方案。
5. 计算 Llama 3.3 70B 的 EAGLE-3 草稿头的内存成本。它与把 Llama 3.2 1B 作为经典草稿来跑相比如何？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| 投机解码（Speculative decoding） | "draft plus verify" | 用廉价模型提出 K 个 token，在一次目标前向中验证全部 K 个 |
| 接受率 alpha（Acceptance rate alpha） | "spec accept rate" | 目标模型接受的草稿 token 占比；唯一重要的指标 |
| 草稿长度 K（Draft length K） | "spec k" | 草稿每次目标前向提出多少个 token；典型为 4–8 |
| 验证开销 epsilon（Verify overhead epsilon） | "spec overhead" | 相比裸目标前向，验证与重跑的额外成本；随批量增长 |
| EAGLE-3 | "latest EAGLE" | 2025–2026 变体；在多个目标层上训练草稿头；通用对话上 alpha 0.6–0.8 |
| `speculative_config` | "vLLM spec config" | vLLM V1 中的显式按需开启项；没有默认值意味着没有加速 |
| N-gram 投机解码（N-gram spec decode） | "N-gram draft" | 在 prompt 中用 N-gram 查找的 GPU 侧草稿；与分块预填充兼容 |
| 盈亏平衡 alpha（Break-even alpha） | "no-op alpha" | 投机解码加速为零时的 alpha；在生产并发量下盯紧它 |
| 被拒草稿两趟（Rejected-draft two-pass） | "reroll cost" | 草稿被拒时的两次目标前向；驱动 P99 尾部 |

## 延伸阅读

- [vLLM — 投机解码文档](https://docs.vllm.ai/en/latest/features/spec_decode/) —— 关于 `speculative_config` 以及 V1 中分块预填充兼容性的权威来源。
- [vLLM Speculative Config API](https://docs.vllm.ai/en/latest/api/vllm/config/speculative/) —— 确切的字段集合。
- [EAGLE 论文（arXiv:2401.15077）](https://arxiv.org/abs/2401.15077) —— 最初的 EAGLE 草稿头表述。
- [EAGLE-2 论文（arXiv:2406.16858）](https://arxiv.org/abs/2406.16858) —— 自适应草稿与树。
- [UC Berkeley EECS-2025-224](https://www2.eecs.berkeley.edu/Pubs/TechRpts/2025/EECS-2025-224.html) —— 带投机解码的高效 LLM 系统。
- [BentoML — 投机解码](https://bentoml.com/llm/inference-optimization/speculative-decoding) —— 生产上线检查清单。
