# 生产环境中的 EAGLE-3 Speculative Decoding

> Speculative decoding 将快速 draft 模型与目标模型配对。Draft 提出 K 个 token；目标在单次前向中验证；接受的 token 是免费的。在 2026 年，EAGLE-3 是生产级变体——它在目标模型的隐藏状态而非原始 token 上训练 draft head，将通用聊天上的接受率 alpha 推到 0.6-0.8 区间。正确的问题不是"draft 有多快"，而是"我的流量上的 alpha 是多少？"如果 alpha 降到约 0.55 以下，在高并发时 speculative decoding 是净负面的，因为每个被拒绝的 draft 都要花费第二次目标前向传递。本课教你先测量 alpha，然后再翻标志。

**类型：** 学习
**语言：** Python（标准库，简单的接受率模拟器）
**先修要求：** 阶段 17 · 04（vLLM 服务内部原理）、阶段 10 · 18（多 Token 预测）
**时间：** 约 60 分钟

## 学习目标

- 说出三代 speculative decoding 并解释 EAGLE-3 相对于 EAGLE-2 和经典 draft 模型改变了什么。
- 定义接受率 alpha，从 alpha 和 K（draft 长度）计算预期加速，并为你的目标并发确定盈亏平衡 alpha。
- 解释为什么 speculative decoding 在 vLLM 2026 中是选入（非默认），以及为什么在不测量 alpha 的情况下开启它是生产反模式。
- 编写测量计划：哪个基准测试、哪个提示分布、哪个并发点、哪个指标作为门控。

## 问题

Decode 是内存绑定的。在运行 Llama 3.3 70B FP8 的 H100 上，每个解码 token 读取约 140 GB/s 的权重并发出一个 token。GPU 计算在解码期间几乎空闲——瓶颈是 HBM 带宽，而不是矩阵乘法吞吐量。

Speculative decoding 利用这一差距。用廉价 draft 模型生成 K 个候选 token，然后要求目标模型在单次前向传递中验证所有 K 个。每个验证的 token 实际上是免费的（摊销到目标无论如何都要做的 K 批前向中）。

经典 draft-model 方法使用同一系列的小模型（Llama 3.2 1B 为 Llama 3.3 70B draft）。它有效，但接受率平庸——较小模型的分布与目标偏离。EAGLE、然后 EAGLE-2、然后 EAGLE-3 直接在目标模型的内部状态上训练轻量 draft head，因此 draft 的分布更紧密地跟踪目标。这就是为什么 alpha 从 draft-model 的 0.4 到 EAGLE-3 的 0.6-0.8。

陷阱：EAGLE-3 在 vLLM 2026 中是选入的。`speculative_config` 必须显式设置。没有标志，就没有加速。在不测量真实流量上的 alpha 的情况下开启它的团队经常看到尾部延迟变得更差，而不是更好。

## 概念

### Speculative decoding 实际购买什么

没有 spec decode，每 token 成本是一个目标前向。使用 draft 长度 K 和接受 alpha 的 spec decode，每个目标前向的预期 token 是 `1 + K * alpha`。加速是 `(1 + K * alpha) / (1 + epsilon)`，其中 epsilon 是 draft-plus-verify 开销。对于 K=5，alpha=0.7：`(1 + 5*0.7) / (1 + 0.1) = 4.5 / 1.1 = 4.1x`。现实世界的数字集中在 2-3x 左右，因为 alpha 在生产流量上很少那么高，而且 epsilon 在大多情况下会增长。

### 为什么 alpha 是唯一重要的指标

被拒绝的 token 不会消失——它们强制第一个被拒绝 token 的第二次目标前向。在 alpha 降到 0.4 的工作负载上，你支付 draft 开销加验证加重新滚动。在高并发（比如 256 并发）时，解码批次已经足够大，以至于"仅目标"和"带验证的目标"之间的内存带宽差距缩小。在大多数 2026 硬件上低于 alpha 0.55 时，spec decode 是净负面的。

Alpha 因工作负载而异。在 ShareGPT 风格的通用聊天上，在 ShareGPT 上训练的 EAGLE-3 达到 0.6-0.8。在域特定流量（代码、医疗、法律）上，在通用数据上训练的 draft head 降到 0.4-0.6。训练域特定的 draft head 恢复 alpha——与目标微调相比，这是一个轻量、快速的训练工作。

### EAGLE 代一览

- **经典 draft 模型**：同一系列的小模型。Alpha 0.3-0.5。基础设施简单——加载两个模型，draft 每个目标前向运行 K 次前向。
- **EAGLE-1 (2024)**：在目标隐藏状态（最后一层）上训练的单个 draft head。Alpha ~0.5-0.6。目标之上的小参数开销。
- **EAGLE-2 (2025)**：自适应 draft 长度和基于树的 draft（在一次目标传递中验证多个分支）。Alpha ~0.6-0.7。更复杂的 draft 调度器。
- **EAGLE-3 (2025-2026)**：在多个目标层（不仅仅是最后一层）上训练的 draft head，更好的对齐。通用聊天上 Alpha ~0.6-0.8。

### 2026 年生产配方

1. 纯目标模型部署。在目标并发性下测量基线 TTFT、ITL、吞吐量。
2. 通过 vLLM `speculative_config` 启用 EAGLE-3 draft。重新运行基准测试。
3. 记录接受率 alpha。vLLM V1 将其报告为 `spec_decode_metrics.accepted_tokens_per_request`。除以请求的 draft 长度以获得 alpha。
4. 如果生产流量分布上的 alpha < 0.55，禁用 spec decode 或训练域特定的 EAGLE-3 draft。
5. 在生产并发性下，重新运行。确认 P99 ITL 没有变得更差。

### 生产陷阱：P99 尾部

平均 ITL 随 spec decode 下降。如果你不调整，P99 可能会变得更差。被拒绝的 draft 触发两遍序列（draft + verify-fail + reroll）。在完整批次下，这两遍序列化。观察 P99 ITL，而不是 P50。

### EAGLE-3 已部署在哪里

Google 在 2025 年在 AI Overviews 中部署了 speculative decoding（相同质量，更快的响应）。vLLM V1 提供 `speculative_config` 作为记录的接口；V1 中的 N-gram GPU speculative decoding 是与 chunked prefill 兼容的变体。SGLang 支持 EAGLE-3 作为前缀重工作负载的推荐 draft 路径。

### 一句话中的盈亏平衡数学

预期加速：`S(alpha, K) = (1 + K*alpha) / (1 + verify_overhead)`。设置 `S = 1` 求解 alpha：`alpha_breakeven = verify_overhead / K`。对于典型的 verify_overhead ~0.15 和 K=5：`alpha_breakeven = 0.03`。但这是原始解码数学。在高并发时，verify 开销上升，解码批次已经跨序列分摊内存读取，因此有效的 alpha_breakeven 在实践中攀升到约 0.45-0.55。

### 何时不使用 speculative decoding

- 延迟不重要的 Batch-1 离线生成。使用纯目标。
- 非常短的输出（低于 50 个 token）。Draft 开销和验证成本占主导。
- 没有域训练 draft head 的专业领域。Alpha 太低。
- vLLM v0.18.0 加 draft-model spec decode 加 `--enable-chunked-prefill`。这种组合无法编译。记录的例外是 V1 中的 N-gram GPU spec decode。

## 使用它

`code/main.py` 在一系列 alpha 值和 draft 长度 K 上模拟有和没有 speculative decoding 的解码循环。它打印盈亏平衡 alpha、测量的加速和尾部行为。在多个 (alpha, K) 组合上运行它，以准确查看 speculative decoding 在何处停止付费。

## 交付它

本课生成 `outputs/skill-eagle3-rollout.md`。给定目标模型、流量分布描述和并发目标，它生成一个分阶段的 EAGLE-3 推出计划——基准测试基线、启用配置、测量 alpha、在 alpha >= 0.55 时门控、观察 P99 ITL。

## 练习

1. 运行 `code/main.py`。在 K=5 时，你需要多少 alpha 才能获得 2 倍加速？3 倍加速呢？这对 verify_overhead 有多敏感？
2. 想象生产流量分割为 70% 通用聊天、30% 代码。在 ShareGPT 上训练的 EAGLE-3 在通用聊天上达到 alpha 0.7；代码达到 alpha 0.4。混合 alpha 是多少，spec decode 是否是净正面的？
3. 阅读 vLLM `speculative_config` 文档。说出三种模式（draft model、EAGLE、N-gram）以及哪一种与 chunked prefill 兼容。
4. 你看到启用 EAGLE-3 后平均 ITL 下降 25%，但 P99 ITL 上升 15%。诊断并提出缓解措施。
5. 计算 Llama 3.3 70B 的 EAGLE-3 draft head 的内存成本。与运行 Llama 3.2 1B 作为经典 draft 相比如何？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| Speculative decoding | "draft 加验证" | 用廉价模型提出 K 个 token，在单次目标前向中验证所有 K 个 |
| Acceptance rate alpha | "spec 接受率" | 目标接受的 draft token 的分数；唯一重要的指标 |
| Draft length K | "spec k" | 每个目标前向 draft 提出的 token 数；典型 4-8 |
| Verify overhead epsilon | "spec 开销" | 与纯目标前向相比验证和重新滚动的额外成本；随批次增长 |
| EAGLE-3 | "最新 EAGLE" | 2025-2026 变体；在多个目标层上训练 draft head；通用聊天上 alpha 0.6-0.8 |
| `speculative_config` | "vLLM spec 配置" | vLLM V1 中的显式选入；无默认意味着无加速 |
| N-gram spec decode | "N-gram draft" | 在提示中使用 N-gram 查找的 GPU 端 draft；chunked-prefill 兼容 |
| Break-even alpha | "无操作 alpha" | spec decode 给出零加速时的 alpha；在生产并发性下观察这一点 |
| Rejected-draft two-pass | "重新滚动成本" | Draft 被拒绝时的两次目标前向；驱动 P99 尾部 |

## 延伸阅读

- [vLLM——Speculative Decoding 文档](https://docs.vllm.ai/en/latest/features/spec_decode/)——关于 V1 中 `speculative_config` 和 chunked-prefill 兼容性的权威来源。
- [vLLM Speculative Config API](https://docs.vllm.ai/en/latest/api/vllm/config/speculative/)——确切的字段集。
- [EAGLE 论文 (arXiv:2401.15077)](https://arxiv.org/abs/2401.15077)——原始 EAGLE draft-head 公式。
- [EAGLE-2 论文 (arXiv:2406.16858)](https://arxiv.org/abs/2406.16858)——自适应 draft 和树。
- [UC Berkeley EECS-2025-224](https://www2.eecs.berkeley.edu/Pubs/TechRpts/2025/EECS-2025-224.html)——使用 speculative decoding 的高效 LLM 系统。
- [BentoML——Speculative Decoding](https://bentoml.com/llm/inference-optimization/speculative-decoding)——生产推出检查清单。
