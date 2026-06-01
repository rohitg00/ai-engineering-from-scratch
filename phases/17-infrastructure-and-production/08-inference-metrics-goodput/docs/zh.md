# 08 · 推理指标 —— TTFT、TPOT、ITL、有效吞吐与 P99

> 有四个指标决定一套推理部署是否正常工作。「首字延迟（TTFT, time to first token）」等于预填充（prefill）加排队加网络。「单字延迟（TPOT, time per output token）」（等价于「字间延迟（ITL, inter-token latency）」）是受内存带宽约束的每字解码（decode）成本。「端到端（E2E, end-to-end）」延迟等于 TTFT 加上 TPOT 乘以输出长度。「吞吐（throughput）」是整个集群聚合的每秒字数。但真正关乎产品的那一个指标是「有效吞吐（goodput）」—— 同时满足每一项 SLO 的请求所占的比例。高吞吐但低有效吞吐，意味着你正在处理那些永远无法及时送达用户的字。2026 年 Llama-3.1-8B-Instruct 在 TRT-LLM 上的参考数值：平均 TTFT 162 ms，平均 TPOT 7.33 ms，平均 E2E 1,093 ms。永远要报告 P50、P90、P99 —— 绝不能只报平均值。还要当心测量陷阱：GenAI-Perf 在计算 ITL 时排除 TTFT，LLMPerf 则包含它；同一次运行，两个工具给出的 TPOT 互不一致。

**类型：** 学习
**语言：** Python（标准库，玩具级分位数计算器与有效吞吐报告器）
**前置：** 阶段 17 · 04（vLLM Serving Internals）
**时长：** 约 60 分钟

## 学习目标

- 精确定义 TTFT、TPOT、ITL、E2E、吞吐与有效吞吐，并指出每一个指标各自衡量的是哪个组成部分。
- 解释为什么平均值是 LLM 服务中错误的统计量，以及如何解读 P50/P90/P99。
- 构造一个 SLO 多重约束（例如 TTFT<500 ms 且 TPOT<15 ms 且 E2E<2 s），并据此计算有效吞吐。
- 说出两个对同一次运行的 TPOT 给出不一致结果的基准测试工具，并解释原因。

## 问题所在

「我们的吞吐是每秒 15,000 字。」那又如何？如果 40% 的请求端到端超过了 2 秒，用户就放弃了会话。单看吞吐并不能告诉你产品是否真的可用。

推理有多个延迟维度，每一个的失效方式都不同。预填充受算力约束，随提示词长度增长。解码受内存带宽约束，随批量大小（batch size）增长。排队延迟是运维层面的问题。网络是物理距离的问题。你需要为每一项建立独立的指标，需要分位数，还需要一个单一的复合指标来回答「用户拿到的是否如其所期」—— 那就是有效吞吐。

## 概念解析

### TTFT —— 首字延迟

`TTFT = queue_time + network_request + prefill_time`

当提示词很长时，预填充占主导。在 H100 上运行 Llama-3.3-70B FP8，一个 32k 的提示词光纯预填充就要约 800 ms。排队时间是调度器在负载下的行为表现。网络请求是包含 TLS 在内的链路时间。TTFT 是用户在任何内容开始流式返回之前所感受到的延迟。

### TPOT / ITL —— 字间延迟

同一个量有许多叫法。`TPOT`（每输出字时间）、`ITL`（字间延迟）、`每字解码延迟` —— 全都是一回事。它是首字之后，连续流式返回的字与字之间的时间。

`TPOT = (decode_forward_time + scheduler_overhead) / tokens_produced`

在同一套带分块预填充（chunked prefill）的 Llama-3.3-70B H100 栈上，TPOT 平均约 7 ms。如果没有分块预填充，当相邻序列正在进行一次长预填充时，TPOT 可能飙升到 50 ms。要盯 P99，而不是平均值。

### E2E 延迟

`E2E = TTFT + TPOT * output_tokens + network_response`

对于长输出（>500 字），E2E 由 TPOT 主导。对于带长提示词的短输出，E2E 由 TTFT 主导。要报告按输出长度分条件的 E2E。

### 吞吐

`throughput = total_output_tokens / elapsed_time`

聚合指标。它告诉你集群的效率，但不会告诉你单个请求的健康状况。

### 有效吞吐 —— 你真正在意的那个指标

`goodput = fraction of requests meeting (TTFT <= a) AND (TPOT <= b) AND (E2E <= c)`

SLO 是一个多重约束。只有当每一项约束都成立时，一个请求才算「好」的。有效吞吐就是这部分的占比。99% 高吞吐却只有 60% 有效吞吐，是失败。较低的吞吐但 99% 的有效吞吐，才是目标。

2026 年，有效吞吐是 MLPerf Inference v6.0 提交结果中所用的指标，也是各 AI 平台服务商内部 SLA 跟踪所用的指标。

### 为什么平均值是错误的统计量

LLM 延迟分布是右偏的。一个带有一个长预填充邻居的解码批次，可能以约 7 ms 的 TPOT 送出 500 个字，又以约 60 ms 的 TPOT 送出 20 个字。平均 TPOT 是 9 ms，P99 TPOT 是 65 ms。用户会经常撞上 P99 —— 这就是他们离开的原因。

永远要报告三元组（P50, P90, P99）。就用户体验而言，P99 才是你要优化的那一个。

### 参考数值 —— Llama-3.1-8B-Instruct 在 TRT-LLM 上，2026 年

- 平均 TTFT：162 ms
- 平均 TPOT：7.33 ms
- 平均 E2E：1,093 ms
- P99 TPOT：随分块预填充配置不同，在 10-25 ms 之间变化。

这些是 NVIDIA 公布的参考点。它们会随模型规模（70B 会显示 3-5 倍）、硬件（H100 对比 B200 约 3 倍）和负载而变化。

### 测量陷阱

2026 年两个最常用的基准测试工具，对同一次运行的 TPOT 给出不一致的结果：

- **NVIDIA GenAI-Perf**：在 ITL 计算中排除 TTFT。ITL 从第 2 个字开始算。
- **LLMPerf**：包含 TTFT。ITL 从第 1 个字开始算。

对于一个 TTFT 为 500 ms、在总解码时间 700 ms 内产生 100 个输出字的请求，GenAI-Perf 报告 `ITL = 700/99 = 7.07 ms`，LLMPerf 报告 `ITL = 1200/100 = 12.00 ms`。工具的选择会改变这个数字。

永远要写明用的是哪个工具。永远要公布定义。

### 构造一个 SLO

2026 年面向消费者的 70B 对话模型，一个合理的 SLO：

- TTFT P99 <= 800 ms。
- TPOT P99 <= 25 ms。
- 对于 <300 字的输出，E2E P99 <= 3 s。
- 有效吞吐目标 >= 99%。

企业级 SLO 会收紧 TTFT（200-400 ms）并放宽 E2E。关键在于把它们写下来，对全部三项进行测量，并把有效吞吐作为单一复合指标来跟踪。

### 如何测量

- 跑真实流量，或贴近真实的合成流量（LLMPerf 配 `--mean-input-tokens 800 --stddev-input-tokens 300 --mean-output-tokens 150`）。
- 基准测试运行时，把目标定在峰值并发的 2 倍。
- 跑 30-50 轮迭代，对合并样本取分位数。
- 公布时附上工具名、工具版本、模型、硬件、并发数、提示词分布。

## 上手实践

`code/main.py` 是一个玩具级有效吞吐计算器。生成一个合成延迟分布，套用一个 SLO，计算有效吞吐。它还会在同一条轨迹上展示 GenAI-Perf 与 LLMPerf 在 TPOT 上的差异。

## 交付产出

本课产出 `outputs/skill-slo-goodput-gate.md`。给定一个工作负载和一个 SLO，它会生成一份可直接用于 CI/CD 的基准测试方案，让部署的门控基于有效吞吐而非吞吐。

## 练习

1. 运行 `code/main.py`。生成一个带 1% 长尾尖峰的分布。当你把 P99 TPOT 从 30 ms 收紧到 15 ms 时，有效吞吐如何变化？
2. 某供应商报价「Llama 3.3 70B H100 上每秒 15,000 字」。在相信它之前，说出三个该问的问题。
3. 为什么分块预填充保护的是 P99 TPOT 而非平均 TPOT？
4. 为一个语音助手构造一个面向消费者的 SLO（首字是被听到的，而非被读到的）。哪个指标对用户最可见？
5. 阅读 LLMPerf 的 README 和 GenAI-Perf 的文档。找出另外三个这两个工具会给出不一致结果的指标。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|----------------|------------------------|
| TTFT | 「首字延迟」 | 排队 + 网络 + 预填充；长提示词下由预填充主导 |
| TPOT | 「每输出字时间」 | 首字之后每字的、受内存带宽约束的解码成本 |
| ITL | 「字间延迟」 | 在大多数工具中等同于 TPOT（并非全部 —— 见 GenAI-Perf） |
| E2E | 「端到端」 | TTFT + TPOT * output_len；此外还叠加响应侧网络 |
| Throughput | 「字/秒」 | 集群效率；没有延迟分位数就毫无用处 |
| Goodput | 「SLO 达成率」 | 同时满足每一项 SLO 约束的请求所占比例 |
| P99 | 「长尾」 | 百分之一的最坏情况延迟；用户体验指标 |
| SLO 多重约束 | 「联合约束」 | 三项延迟上界的「与」；任一项被违反，请求即失败 |
| GenAI-Perf 对比 LLMPerf | 「工具陷阱」 | 两个工具在 ITL 是否包含 TTFT 上意见不一 |

## 延伸阅读

- [NVIDIA NIM —— LLM Benchmarking Metrics](https://docs.nvidia.com/nim/benchmarking/llm/latest/metrics.html) —— TTFT、ITL、TPOT 的权威定义。
- [Anyscale —— LLM Serving Benchmarking Metrics](https://docs.anyscale.com/llm/serving/benchmarking/metrics) —— 另一套定义与测量方案。
- [BentoML —— LLM Inference Metrics](https://bentoml.com/llm/inference-optimization/llm-inference-metrics) —— 真实部署上的应用测量。
- [LLMPerf](https://github.com/ray-project/llmperf) —— 基于 Ray 的开源基准测试工具。
- [GenAI-Perf](https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/client/src/c++/perf_analyzer/genai-perf/README.html) —— NVIDIA 的基准测试工具。
- [MLPerf Inference](https://mlcommons.org/benchmarks/inference-datacenter/) —— 业界公认的、基于有效吞吐的基准测试。
