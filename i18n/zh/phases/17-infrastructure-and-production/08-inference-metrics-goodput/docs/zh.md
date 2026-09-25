# 推理指标 — TTFT、TPOT、ITL、Goodput、P99

> 四个指标决定一个推理部署是否正常运转。TTFT 是 prefill 加排队加网络耗时。TPOT(等价于 ITL)是每个 token 的 memory-bound 解码成本。端到端延迟是 TTFT 加上 TPOT 乘以输出长度。吞吐量是整个集群聚合的每秒 token 数。但对产品真正重要的是 goodput——即同时满足所有 SLO 的请求占比。高吞吐低 goodput 意味着你正在处理那些根本无法按时送达用户的 token。2026 年 Llama-3.1-8B-Instruct 在 TRT-LLM 上的参考数值:平均 TTFT 162 ms,平均 TPOT 7.33 ms,平均 E2E 1,093 ms。务必报告 P50、P90、P99——绝不能只报平均值。还要注意测量陷阱:GenAI-Perf 在 ITL 计算中排除 TTFT,而 LLMPerf 包含它;两个工具对同一次运行的 TPOT 结果不一致。

**Type:** Learn
**Languages:** Python(标准库,玩具级百分位数计算器和 goodput 报告器)
**Prerequisites:** Phase 17 · 04(Serving Engine Internals)
**Time:** 约 60 分钟

## 学习目标

- 精确定义 TTFT、TPOT、ITL、E2E、吞吐量和 goodput,并说出每个指标度量的组成部分。
- 解释为什么平均值是 LLM 服务的错误统计量,以及如何解读 P50/P90/P99。
- 构造一个 SLO 多约束条件(例如 TTFT<500 ms AND TPOT<15 ms AND E2E<2 s),并据此计算 goodput。
- 说出两个对同一次运行的 TPOT 结果不一致的基准测试工具,并解释原因。

## 问题所在

"我们的吞吐量是每秒 15,000 个 token。"那又怎样?如果 40% 的请求端到端耗时超过 2 秒,用户就会放弃会话。仅凭吞吐量无法告诉你产品是否可用。

推理在多个维度上都有延迟,而每个维度的失效方式不同。Prefill 是 compute-bound 的,随提示长度扩展。Decode 是 memory-bound 的,随批次大小扩展。排队延迟是运维问题。网络是物理距离问题。你需要为每一项设置独立的指标,需要百分位数,还需要一个能说明"用户是否得到了他们期望的东西"的单一复合指标——那就是 goodput。

## 核心概念

### TTFT — 首 token 时间

`TTFT = queue_time + network_request + prefill_time`

当提示很长时,prefill 占主导。在 H100 上运行 FP8 的 Llama-3.3-70B,一个 32k 提示需要约 800 ms 的纯 prefill。排队时间是负载下调度器的行为表现。网络请求是线路耗时,包括 TLS。TTFT 是用户在任何内容开始流式返回之前所感知的延迟。

### TPOT / ITL — token 间延迟

同一个量的多个名称。`TPOT`(每个输出 token 的时间)、`ITL`(token 间延迟)、`decode latency per token`——都是一回事。它是第一个 token 之后,相邻流式 token 之间的时间。

`TPOT = (decode_forward_time + scheduler_overhead) / tokens_produced`

在相同的 Llama-3.3-70B H100 配置并启用 chunked prefill 的情况下,TPOT 平均约 7 ms。如果没有 chunked prefill,当相邻序列正在执行长 prefill 时,TPOT 可能飙升至 50 ms。关注 P99,而不是平均值。

### E2E 延迟

`E2E = TTFT + TPOT * output_tokens + network_response`

对于长输出(>500 token),E2E 由 TPOT 主导。对于长提示短输出,E2E 由 TTFT 主导。应报告按输出长度分组的 E2E。

### 吞吐量

`throughput = total_output_tokens / elapsed_time`

聚合指标。它告诉你集群效率。它无法告诉你单个请求的健康状况。

### Goodput — 你真正关心的指标

`goodput = fraction of requests meeting (TTFT <= a) AND (TPOT <= b) AND (E2E <= c)`

SLO 是一个多约束条件。只有当所有约束都满足时,请求才算"好"。Goodput 就是满足约束的请求占比。60% goodput 的高吞吐就是失败。99% goodput 的较低吞吐才是目标。

在 2026 年,goodput 是 MLPerf Inference v6.0 提交中使用,以及 AI 平台服务商内部 SLA 跟踪中使用的指标。

### 为什么平均值是错误的统计量

LLM 延迟分布是右偏的。一个解码批次中若存在一个长 prefill 的相邻序列,可能出现 500 个 token 的 TPOT 约 7 ms、而 20 个 token 的 TPOT 约 60 ms 的情况。平均 TPOT 是 9 ms。P99 TPOT 是 65 ms。用户会经常碰到 P99——这就是他们离开的原因。

务必报告三元组(P50、P90、P99)。对于用户体验,P99 是你要优化的指标。

### 参考数值 — Llama-3.1-8B-Instruct 在 TRT-LLM 上,2026

- 平均 TTFT:162 ms
- 平均 TPOT:7.33 ms
- 平均 E2E:1,093 ms
- P99 TPOT:视 chunked-prefill 配置而定,在 10-25 ms 之间变化。

这些是 NVIDIA 公布的参考数据点。它们会随模型规模(70B 会高出 3-5 倍)、硬件(H100 与 B200 相差约 3 倍)和负载而变化。

### 测量陷阱

2026 年最常用的两个基准测试工具对同一次运行的 TPOT 结果不一致:

- **NVIDIA GenAI-Perf**:在 ITL 计算中排除 TTFT。ITL 从第 2 个 token 开始。
- **LLMPerf**:包含 TTFT。ITL 从第 1 个 token 开始。

对于一个 TTFT 为 500 ms、总解码 700 ms 产生 100 个输出 token 的请求,GenAI-Perf 报告 `ITL = 700/99 = 7.07 ms`,LLMPerf 报告 `ITL = 1200/100 = 12.00 ms`。工具的选择会改变数值。

务必注明所用工具。务必公布定义。

### 构造 SLO

2026 年面向消费者的 70B 聊天模型的合理 SLO:

- TTFT P99 <= 800 ms。
- TPOT P99 <= 25 ms。
- E2E P99 <= 3 s(针对 <300 token 的输出)。
- Goodput 目标 >= 99%。

企业级 SLO 会收紧 TTFT(200-400 ms)并放宽 E2E。关键在于把它们写下来、度量这三项,并将 goodput 作为单一复合指标进行跟踪。

### 如何测量

- 运行真实流量或逼真的合成流量(使用 `--mean-input-tokens 800 --stddev-input-tokens 300 --mean-output-tokens 150` 的 LLMPerf)。
- 基准测试运行的目标并发为峰值的 2 倍。
- 运行 30-50 次迭代,对合并样本取百分位数。
- 发布时注明工具名称、工具版本、模型、硬件、并发数和提示分布。

```figure
throughput-latency
```

## 动手使用

`code/main.py` 是一个玩具级 goodput 计算器。生成一个合成的延迟分布,应用一个 SLO,并计算 goodput。它还展示了相同轨迹上 GenAI-Perf 与 LLMPerf 的 TPOT 差异。

## 上线交付

本课产出 `outputs/skill-slo-goodput-gate.md`。给定一个工作负载和 SLO,它会生成一份可直接用于 CI/CD 的基准测试方案,以 goodput 而非吞吐量作为部署门禁。

## 练习

1. 运行 `code/main.py`。生成一个带有 1% 尾部尖峰的分布。当你把 P99 TPOT 从 30 ms 收紧到 15 ms 时,goodput 如何变化?
2. 一个厂商宣称"在 Llama 3.3 70B H100 上达到 15,000 tok/s"。在信任它之前,列出三个应该提出的问题。
3. 为什么 chunked prefill 能保护 P99 TPOT,却不能保护平均 TPOT?
4. 为一个语音助手(第一个 token 是被听到的,而不是被读到的)构造一个消费者 SLO。哪个指标对用户最直观?
5. 阅读 LLMPerf 的 README 和 GenAI-Perf 的文档。找出这两个工具在其他三个指标上的分歧。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|------------------------|------------------|
| TTFT | "首 token 时间" | 排队 + 网络 + prefill;长提示时由 prefill 主导 |
| TPOT | "每个输出 token 的时间" | 首个 token 之后每个 token 的 memory-bound 解码成本 |
| ITL | "token 间延迟" | 在大多数工具中与 TPOT 相同(并非全部——见 GenAI-Perf) |
| E2E | "端到端" | TTFT + TPOT * output_len;再加上响应侧网络耗时 |
| 吞吐量 | "tok/s" | 集群效率;没有延迟百分位数就没有意义 |
| Goodput | "SLO 达标率" | 同时满足所有 SLO 约束的请求占比 |
| P99 | "尾部" | 百分之一的最坏情况延迟;用户体验指标 |
| SLO 多约束 | "联合条件" | 三项延迟上限的 AND;任何一项被违反即请求失败 |
| GenAI-Perf 与 LLMPerf | "工具陷阱" | 两个工具在 ITL 是否包含 TTFT 上不一致 |

## 延伸阅读

- [NVIDIA NIM — LLM Benchmarking Metrics](https://docs.nvidia.com/nim/benchmarking/llm/latest/metrics.html) — TTFT、ITL、TPOT 的权威定义。
- [Anyscale — LLM Serving Benchmarking Metrics](https://docs.anyscale.com/llm/serving/benchmarking/metrics) — 替代定义与测量方案。
- [BentoML — LLM Inference Metrics](https://bentoml.com/llm/inference-optimization/llm-inference-metrics) — 真实部署上的实际测量。
- [LLMPerf](https://github.com/ray-project/llmperf) — 基于 Ray 的开源基准测试。
- [GenAI-Perf](https://github.com/triton-inference-server/perf_analyzer/blob/main/genai-perf/README.md) — NVIDIA 的基准测试工具。
- [MLPerf Inference](https://mlcommons.org/benchmarks/inference-datacenter/) — 业界公认的基于 goodput 的基准测试。