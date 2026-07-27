# 推理指标 — TTFT、TPOT、ITL、Goodput、P99

> 四个指标决定了一个推理部署是否正常。TTFT 是预填充（prefill）加上队列（queue）和网络（network）的时间。TPOT（等价于 ITL）是每个 token 受内存限制的解码成本。端到端延迟等于 TTFT 加上 TPOT 乘以输出长度。吞吐量是整个集群每秒处理的 token 数。但对产品而言真正重要的是 **goodput**——同时满足所有 SLO 的请求比例。高吞吐量但 low goodput 意味着你处理的 token 永远无法按时到达用户手中。2026 年 Llama-3.1-8B-Instruct 在 TRT-LLM 上的参考数据：平均 TTFT 162 ms，平均 TPOT 7.33 ms，平均 E2E 1,093 ms。始终报告 P50、P90、P99——绝不仅仅是平均值。另外要警惕测量陷阱：GenAI-Perf 在 ITL 计算中排除了 TTFT，而 LLMPerf 包含 TTFT；两个工具对同一运行的 TPOT 给出不同结果。

**类型：** 学习
**语言：** Python（标准库，玩具分位数计算器和 goodput 报告器）
**前置知识：** 阶段 17 · 04（vLLM 服务内部原理）
**时间：** ~60 分钟

## 学习目标

- 精确定义 TTFT、TPOT、ITL、E2E、吞吐量和 goodput，并指出每个指标衡量的组件。
- 解释为什么平均值是 LLM 服务中错误的统计量，以及如何解读 P50/P90/P99。
- 构建一个多约束 SLO（例如 TTFT<500 ms 且 TPOT<15 ms 且 E2E<2 s），并据此计算 goodput。
- 指出两个对同一运行给出不同 TPOT 的基准测试工具，并解释原因。

## 问题

"我们的吞吐量是每秒 15,000 个 token。"那又怎样？如果 40% 的请求端到端延迟超过 2 秒，用户就会放弃会话。仅靠吞吐量无法告诉你产品是否正常工作。

推理有多条延迟轴，每一条的失败方式各不相同。预填充受计算限制，随提示长度扩展。解码受内存限制，随批处理大小扩展。排队延迟是运维问题。网络是物理距离问题。你需要为每个维度设置不同的指标，你需要百分位数，还需要一个能说明"用户是否得到了他们期望的结果"的单一复合指标——那就是 goodput。

## 概念

### TTFT — 首 token 延迟（time to first token）

`TTFT = queue_time + network_request + prefill_time`

当提示较长时，预填充占主导地位。在 H100 上的 Llama-3.3-70B FP8 上，32k 的提示需要约 800 ms 的纯预填充时间。队列时间是有负载时调度器的行为。网络请求是包括 TLS 在内的传输时间。TTFT 是用户在收到任何流式返回之前感知到的延迟。

### TPOT / ITL — token 间延迟（inter-token latency）

同一个量有多个名称。`TPOT`（time per output token，每输出 token 时间）、`ITL`（inter-token latency，token 间延迟）、`decode latency per token`（每 token 解码延迟）——都是同一个概念。它是第一个 token 之后连续流式 token 之间的时间。

`TPOT = (decode_forward_time + scheduler_overhead) / tokens_produced`

在同样的 Llama-3.3-70B H100 堆栈上，使用分块预填充（chunked prefill）时，TPOT 均值约 7 ms。没有分块预填充时，在相邻序列的长预填充期间，TPOT 可能飙升到 50 ms。关注 P99，而不是均值。

### E2E 延迟

`E2E = TTFT + TPOT * output_tokens + network_response`

对于长输出（>500 个 token），E2E 由 TPOT 主导。对于短输出但长提示，E2E 由 TTFT 主导。报告时应按输出长度条件化（output-length-conditioned）报告 E2E。

### 吞吐量（Throughput）

`throughput = total_output_tokens / elapsed_time`

聚合指标。告诉你整个集群的效率。不能告诉你单个请求的健康状况。

### Goodput — 你真正关心的指标

`goodput = fraction of requests meeting (TTFT <= a) AND (TPOT <= b) AND (E2E <= c)`

SLO 是一个多约束条件。一个请求只有在**所有**约束都满足时才被视为"良好"。Goodput 就是这个比例。高吞吐量但只有 60% 的 goodput 是失败。较低的吞吐量但 99% 的 goodput 才是目标。

2026 年，goodput 已被用于 MLPerf Inference v6.0 的提交以及 AI 平台提供商的内部 SLA 跟踪中。

### 为什么平均值是错误的统计量

LLM 延迟分布是右偏的。一个解码批次如果有一个长预填充的邻居，可能会以 TPOT ~7 ms 产出 500 个 token，而以 TPOT ~60 ms 产出 20 个 token。平均 TPOT 是 9 ms。P99 TPOT 是 65 ms。用户会频繁遇到 P99——这就是他们离开的原因。

始终报告三元组（P50、P90、P99）。对于用户体验，P99 是你需要优化的对象。

### 参考数据 — Llama-3.1-8B-Instruct 在 TRT-LLM 上，2026 年

- 平均 TTFT：162 ms
- 平均 TPOT：7.33 ms
- 平均 E2E：1,093 ms
- P99 TPOT：根据分块预填充配置不同，在 10-25 ms 之间变化

这些是已发布的 NVIDIA 参考数据。它们会因模型规模（70B 会高出 3-5 倍）、硬件（H100 与 B200 约差 3 倍）和负载而改变。

### 测量陷阱

2026 年最常用的两个基准测试工具对同一运行的 TPOT 给出不同结果：

- **NVIDIA GenAI-Perf**：在 ITL 计算中排除 TTFT。ITL 从第 2 个 token 开始计算。
- **LLMPerf**：包含 TTFT。ITL 从第 1 个 token 开始计算。

对于一个 TTFT 为 500 ms、100 个输出 token 在总共 700 ms 内完成解码的请求，GenAI-Perf 报告 `ITL = 700/99 = 7.07 ms`，LLMPerf 报告 `ITL = 1200/100 = 12.00 ms`。工具的选择会改变数据。

始终说明使用的是哪个工具。始终公开你的定义。

### 构建 SLO

2026 年面向消费者的 70B 聊天模型的一个合理 SLO：

- TTFT P99 <= 800 ms。
- TPOT P99 <= 25 ms。
- E2E P99 <= 3 s（输出 <300 个 token 时）。
- Goodput 目标 >= 99%。

企业级 SLO 会收紧 TTFT（200-400 ms）并放宽 E2E。关键在于把它们写下来，测量全部三个指标，并将 goodput 作为一个单一复合指标进行跟踪。

### 如何测量

- 运行真实流量或贴近实际的合成流量（LLMPerf 配合 `--mean-input-tokens 800 --stddev-input-tokens 300 --mean-output-tokens 150`）。
- 基准测试运行时目标并发量设为峰值的 2 倍。
- 运行 30-50 轮迭代，取合并样本的百分位数。
- 发布时包含工具名称、工具版本、模型、硬件、并发量和提示分布。

```figure
throughput-latency
```

## 使用它

`code/main.py` 是一个玩具级的 goodput 计算器。生成一个合成延迟分布，应用 SLO，计算 goodput。还会展示同一追踪上 GenAI-Perf 与 LLMPerf 的 TPOT 差异。

## 交付它

本课程产出 `outputs/skill-slo-goodput-gate.md`。给定一个工作负载和 SLO，它会生成一份 CI/CD 就绪的基准测试方案，根据 goodput 而非吞吐量来把关部署。

## 练习

1. 运行 `code/main.py`。生成一个包含 1% 尾部尖峰（tail spike）的分布。当你将 P99 TPOT 从 30 ms 收紧到 15 ms 时，goodput 如何变化？
2. 某供应商报价"在 Llama 3.3 70B H100 上每秒 15,000 个 token"。在相信这个数据之前，请列举三个需要提出的问题。
3. 为什么分块预填充能保护 P99 TPOT，但不能保护平均 TPOT？
4. 为语音助手构建一个面向消费者的 SLO（首 token 是**听到**的，而不是读到的）。哪个指标对用户最可见？
5. 阅读 LLMPerf 的 README 和 GenAI-Perf 的文档。找出这两个工具还存在哪些其他指标差异。

## 关键术语

| 术语 | 人们说的意思 | 实际含义 |
|------|-------------|----------|
| TTFT | "首 token 延迟" | 队列 + 网络 + 预填充；长提示时由预填充主导 |
| TPOT | "每输出 token 时间" | 第一个 token 之后，受内存限制的每 token 解码成本 |
| ITL | "token 间延迟" | 在大多数工具中与 TPOT 相同（并非全部——请参见 GenAI-Perf） |
| E2E | "端到端" | TTFT + TPOT * output_len；再加上响应端网络 |
| 吞吐量 | "tok/s" | 集群效率；没有延迟百分位数则毫无意义 |
| Goodput | "SLO 达标率" | 同时满足所有 SLO 约束的请求比例 |
| P99 | "尾部" | 1-in-100 的最坏情况延迟；用户体验指标 |
| SLO 多约束 | "联合条件" | 三个延迟阈值的 AND 条件；任意一个被违反则请求失败 |
| GenAI-Perf vs LLMPerf | "工具陷阱" | 两者对 ITL 是否包含 TTFT 有分歧 |

## 延伸阅读

- [NVIDIA NIM — LLM Benchmarking Metrics](https://docs.nvidia.com/nim/benchmarking/llm/latest/metrics.html) — TTFT、ITL、TPOT 的权威定义。
- [Anyscale — LLM Serving Benchmarking Metrics](https://docs.anyscale.com/llm/serving/benchmarking/metrics) — 替代定义和测量方法。
- [BentoML — LLM Inference Metrics](https://bentoml.com/llm/inference-optimization/llm-inference-metrics) — 在实际部署中的应用测量。
- [LLMPerf](https://github.com/ray-project/llmperf) — 基于 Ray 的开源基准测试工具。
- [GenAI-Perf](https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/client/src/c++/perf_analyzer/genai-perf/README.html) — NVIDIA 的基准测试工具。
- [MLPerf Inference](https://mlcommons.org/benchmarks/inference-datacenter/) — 业界公认的基于 goodput 的基准测试。
