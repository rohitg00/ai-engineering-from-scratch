# 生产环境中的 EAGLE-3 投机解码（EAGLE-3 Speculative Decoding in Production）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 投机解码（speculative decoding）把一个轻量 draft 模型和 target 模型搭在一起：draft 提议 K 个 token，target 用一次前向传播一次性验证；被接受的 token 相当于白送。到了 2026 年，EAGLE-3 是生产级首选——它的 draft head 不再训练在原始 token 上，而是直接训练在 target 模型的隐状态上，把接受率（acceptance rate）alpha 推到了通用聊天场景的 0.6–0.8 区间。该问的不是「draft 跑得多快」，而是「我这条流量上的 alpha 是多少？」。一旦 alpha 跌到 ~0.55 以下，在高并发下投机解码反而是负收益的——每一次被拒的 draft 都要再付一次 target 前向传播。这节课要教你的是：先量 alpha，再翻开关。

**Type:** Learn
**Languages:** Python (stdlib, toy acceptance-rate simulator)
**Prerequisites:** Phase 17 · 04 (vLLM Serving Internals), Phase 10 · 18 (Multi-Token Prediction)
**Time:** ~60 minutes

## 学习目标（Learning Objectives）

- 说出投机解码的三代演进，讲清楚 EAGLE-3 相对 EAGLE-2、相对经典 draft model 改了什么。
- 定义接受率 alpha，根据 alpha 与 K（draft 长度）算出期望的加速比，并算出你目标并发下的盈亏平衡（break-even）alpha。
- 解释为什么 vLLM 2026 里投机解码是 opt-in（不是默认），以及为什么不测 alpha 就直接打开是生产级反模式。
- 写一份测量计划：跑哪个 benchmark、用什么 prompt 分布、在哪个并发点、卡哪个指标。

## 问题（Problem）

decode 阶段是 memory-bound 的。在 H100 上跑 Llama 3.3 70B FP8，每解一个 token 大约要从 HBM 读 ~140 GB/s 的权重，输出一个 token。decode 时 GPU 的算力其实几乎闲着——瓶颈是 HBM 带宽，不是 matmul 吞吐。

投机解码就是在啃这个空隙。先用一个便宜的 draft 模型生成 K 个候选 token，再让 target 模型用一次前向传播把这 K 个全部验证完。每个被验证的 token 实际上是白送的（被摊到 target 反正要做的那次「K 长度的批前向」里）。

经典的 draft-model 路线是用同家族的小模型来做 draft（比如让 Llama 3.2 1B 给 Llama 3.3 70B 当 draft）。能跑，但接受率一般——小模型的分布跟 target 偏得比较开。EAGLE 系列、再到 EAGLE-2、EAGLE-3，则是把一个轻量 draft head 直接训练在 target 模型的内部状态上，因此 draft 的分布跟 target 贴得更近。这就是为什么 alpha 能从 draft-model 时代的 0.4 一路抬到 EAGLE-3 的 0.6–0.8。

但有个坑：在 vLLM 2026 里，EAGLE-3 是 opt-in 的。`speculative_config` 必须显式设置。不开 flag，就没有加速。很多团队没在自家真实流量上量 alpha 就直接打开，结果尾延迟反而恶化。

## 概念（Concept）

### 投机解码到底买到了什么（What speculative decoding actually buys）

不开投机解码时，每个 token 的成本是一次 target 前向。开了之后，draft 长度为 K、接受率为 alpha 时，每次 target 前向产出的期望 token 数是 `1 + K * alpha`。加速比是 `(1 + K * alpha) / (1 + epsilon)`，其中 epsilon 是 draft 加 verify 的额外开销。K=5、alpha=0.7 时：`(1 + 5*0.7) / (1 + 0.1) = 4.5 / 1.1 = 4.1x`。但真实场景下数字一般落在 2–3x，因为生产流量上 alpha 很少那么高，而且高 batch 下 epsilon 会涨。

### 为什么 alpha 是唯一重要的指标（Why alpha is the only metric that matters）

被拒的 token 不会凭空消失——它会强制对第一个被拒 token 再跑一次 target 前向。当某条 workload 上 alpha 掉到 0.4，你就要同时付 draft 开销、verify 开销、外加重跑（re-roll）的开销。在高并发下（比如 256 并发），decode batch 本身已经够大，「单 target」和「target 加 verify」之间在内存带宽上的差距被压窄。在大多数 2026 硬件上，alpha 一旦低于 0.55，投机解码就变成净负收益。

alpha 是随 workload 变化的。在 ShareGPT 类的通用聊天上，用 ShareGPT 训过的 EAGLE-3 能打到 0.6–0.8。但在领域特化流量上（代码、医学、法律），用通用数据训出来的 draft head 会掉到 0.4–0.6。训一个领域特化的 draft head 就能把 alpha 救回来——相比 target 微调（fine-tune），这是个量级很轻、跑得很快的训练任务。

### 一眼看懂 EAGLE 各代（EAGLE generations at a glance）

- **经典 draft 模型（Classic draft model）**：同家族的小模型。alpha 0.3–0.5。基础设施简单——加载两个模型，draft 每次给 target 跑 K 次前向。
- **EAGLE-1（2024）**：训练在 target 隐状态（最后一层）上的单个 draft head。alpha ~0.5–0.6。在 target 之上只多出很小的参数开销。
- **EAGLE-2（2025）**：自适应 draft 长度 + 树形 draft（一次 target 前向里验证多条分支）。alpha ~0.6–0.7。draft 调度器更复杂。
- **EAGLE-3（2025–2026）**：draft head 训练在 target 的多层（不止最后一层）上，对齐更好。通用聊天场景 alpha ~0.6–0.8。

### 2026 生产配方（The 2026 production recipe）

1. 先把 target 模型素跑上线。在目标并发下测出基线 TTFT、ITL、吞吐。
2. 通过 vLLM 的 `speculative_config` 启用 EAGLE-3 draft。重跑同一组 benchmark。
3. 记录接受率 alpha。vLLM V1 把这个值报为 `spec_decode_metrics.accepted_tokens_per_request`，除以你请求的 draft 长度就是 alpha。
4. 如果在生产流量分布上 alpha < 0.55，要么关掉投机解码，要么训一个领域特化的 EAGLE-3 draft。
5. 在生产并发下再跑一遍。确认 P99 ITL 没有变差。

### 生产坑：P99 尾延迟（The production pitfall: P99 tail）

平均 ITL 会因为投机解码下降。但 P99 如果不调反而可能变差。被拒的 draft 会触发一个两段式序列（draft + verify 失败 + 重跑）。满 batch 下，这两段会串行执行。要盯 P99 ITL，不要只盯 P50。

### EAGLE-3 已经在哪些地方部署（Where EAGLE-3 is already deployed）

Google 在 2025 年把投机解码部署进了 AI Overviews（同样质量、更快响应）。vLLM V1 把 `speculative_config` 作为对外文档化的接口；V1 里的 N-gram GPU 投机解码是和 chunked prefill 兼容的那一种。SGLang 把 EAGLE-3 列为 prefix-heavy workload 推荐的 draft 路径。

### 一行盈亏平衡数学（Break-even math in one line）

期望加速比：`S(alpha, K) = (1 + K*alpha) / (1 + verify_overhead)`。令 `S = 1` 解出 alpha：`alpha_breakeven = verify_overhead / K`。典型 verify_overhead ~0.15、K=5 时：`alpha_breakeven = 0.03`。但这只是裸 decode 数学。高并发下 verify overhead 会涨，而且 decode batch 本身已经把内存读取在序列间摊薄了，所以实际有效的 alpha_breakeven 会爬到 ~0.45–0.55。

### 什么时候不要用投机解码（When not to use speculative decoding）

- 不在乎延迟的 batch-1 离线生成。直接素跑 target。
- 输出非常短（少于 50 个 token）。draft 开销和 verify 成本会盖过收益。
- 没有领域特化 draft head 的特化领域。alpha 太低。
- vLLM v0.18.0 + draft-model 投机解码 + `--enable-chunked-prefill`。这套组合编不过去。文档里特别注明的例外是 V1 的 N-gram GPU 投机解码。

## 用起来（Use It）

`code/main.py` 模拟一个 decode 循环，覆盖一组 alpha 取值和 draft 长度 K，比较开 / 不开投机解码的差异。它会打出盈亏平衡 alpha、实测加速比和尾部行为。在多组 (alpha, K) 上跑跑，你就能看到投机解码究竟在哪里开始不再划算。

## 上线部署（Ship It）

这节课产出 `outputs/skill-eagle3-rollout.md`。给定一个 target 模型、流量分布描述和并发目标，它会产出一份分阶段的 EAGLE-3 上线计划——基线 benchmark、启用配置、测量 alpha、卡 alpha >= 0.55、盯 P99 ITL。

## 练习（Exercises）

1. 跑一下 `code/main.py`。当 K=5 时，要 2x 加速需要多大的 alpha？要 3x 加速呢？这个值对 verify_overhead 有多敏感？
2. 假设生产流量是 70% 通用聊天 + 30% 代码。通用聊天上用 ShareGPT 训出的 EAGLE-3 能打到 alpha 0.7，代码部分只能到 alpha 0.4。混合 alpha 是多少，投机解码整体是不是净正？
3. 读一下 vLLM 的 `speculative_config` 文档。说出三种模式（draft model、EAGLE、N-gram），以及哪一种和 chunked prefill 兼容。
4. 你启用 EAGLE-3 后看到平均 ITL 降了 25%，但 P99 ITL 涨了 15%。诊断原因并给出缓解方案。
5. 算一下 Llama 3.3 70B 上 EAGLE-3 draft head 的内存开销。和把 Llama 3.2 1B 当作经典 draft 跑相比，哪个更省？

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Speculative decoding | "draft plus verify" | 用便宜模型提议 K 个 token，让 target 用一次前向把 K 个一起验证 |
| Acceptance rate alpha | "spec accept rate" | draft token 被 target 接受的比例；唯一重要的指标 |
| Draft length K | "spec k" | draft 每次 target 前向之前提议多少 token；典型 4–8 |
| Verify overhead epsilon | "spec overhead" | 相对一次素跑 target 前向，多出的 verify 与重跑成本；随 batch 上升 |
| EAGLE-3 | "latest EAGLE" | 2025–2026 版本；draft head 训练在 target 多层上；通用聊天 alpha 0.6–0.8 |
| `speculative_config` | "vLLM spec config" | vLLM V1 里显式 opt-in 的入口；不设就没加速 |
| N-gram spec decode | "N-gram draft" | 在 GPU 端用 prompt 中的 N-gram 查找做 draft；和 chunked prefill 兼容 |
| Break-even alpha | "no-op alpha" | 投机解码加速比为零时的 alpha；要在生产并发下盯它 |
| Rejected-draft two-pass | "reroll cost" | draft 被拒时要跑两次 target 前向；P99 尾延迟的元凶 |

## 延伸阅读（Further Reading）

- [vLLM — Speculative Decoding docs](https://docs.vllm.ai/en/latest/features/spec_decode/) — `speculative_config` 与 V1 chunked-prefill 兼容性的权威文档。
- [vLLM Speculative Config API](https://docs.vllm.ai/en/latest/api/vllm/config/speculative/) — 完整字段定义。
- [EAGLE paper (arXiv:2401.15077)](https://arxiv.org/abs/2401.15077) — 最初提出 EAGLE draft-head 的论文。
- [EAGLE-2 paper (arXiv:2406.16858)](https://arxiv.org/abs/2406.16858) — 自适应 draft 与树形 draft。
- [UC Berkeley EECS-2025-224](https://www2.eecs.berkeley.edu/Pubs/TechRpts/2025/EECS-2025-224.html) — 带投机解码的高效 LLM 系统。
- [BentoML — Speculative Decoding](https://bentoml.com/llm/inference-optimization/speculative-decoding) — 生产上线 checklist。
