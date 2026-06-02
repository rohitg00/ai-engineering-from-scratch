# 推理指标 —— TTFT、TPOT、ITL、Goodput、P99

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 一个推理部署到底有没有跑起来，由四个指标说了算。TTFT 等于 prefill 加排队加网络。TPOT（也就是 ITL）是受显存带宽限制的单 token decode 成本。端到端延迟（E2E）等于 TTFT 加上 TPOT 乘以输出长度。吞吐（throughput）是整个集群每秒产出的 token 数。但真正决定产品能不能用的是 goodput —— 同时满足全部 SLO 的请求占比。吞吐高、goodput 低，意味着你在加工那些根本来不及送到用户面前的 token。2026 年 Llama-3.1-8B-Instruct 在 TRT-LLM 上的参考数：平均 TTFT 162 ms，平均 TPOT 7.33 ms，平均 E2E 1,093 ms。永远要报 P50、P90、P99 —— 别只报 mean（均值）。还要小心测量陷阱：GenAI-Perf 的 ITL 计算把 TTFT 排除在外，LLMPerf 则把它算进去；同一次跑，两个工具给出的 TPOT 不一样。

**Type:** Learn
**Languages:** Python（stdlib，玩具版分位数计算器和 goodput 报告器）
**Prerequisites:** Phase 17 · 04（vLLM Serving Internals）
**Time:** ~60 minutes

## 学习目标（Learning Objectives）

- 精确定义 TTFT、TPOT、ITL、E2E、throughput 和 goodput，并指出每个指标对应的环节。
- 解释为什么 mean 是衡量 LLM serving 的错误统计量，以及怎么读 P50/P90/P99。
- 构造一个 SLO 多约束（例如 TTFT<500 ms 且 TPOT<15 ms 且 E2E<2 s）并据此算出 goodput。
- 说出两个在同一次跑里对 TPOT 给出不同结果的 benchmark 工具，并解释原因。

## 问题（The Problem）

「我们吞吐 15,000 token/s。」那又怎样？如果有 40% 的请求端到端飙过 2 秒，用户早就关掉会话走人了。光看 throughput 根本说明不了产品能不能用。

推理有多个延迟维度，每个维度的失败方式都不一样。Prefill 是 compute-bound，随 prompt 长度伸缩。Decode 是 memory-bound，随 batch 大小伸缩。排队延迟是运维问题。网络是物理距离问题。每个维度都需要单独的指标，都需要分位数，最后还需要一个综合指标来回答「用户拿到他想要的东西了吗」 —— 这就是 goodput。

## 概念（The Concept）

### TTFT —— time to first token（首 token 延迟）

`TTFT = queue_time + network_request + prefill_time`

prompt 长的时候 prefill 占主导。在 H100 上跑 Llama-3.3-70B FP8，32k prompt 光 prefill 就要 ~800 ms。queue time 是负载下调度器的行为表现。network request 是包含 TLS 的链路时间。TTFT 是用户在任何 token 流回来之前看到的延迟。

### TPOT / ITL —— 单 token 间延迟

同一个量，名字一堆：`TPOT`（time per output token，单输出 token 时间）、`ITL`（inter-token latency，token 间延迟）、`decode latency per token`（单 token decode 延迟）—— 都是一回事。指的是首个 token 之后，相邻两个流式 token 之间的间隔。

`TPOT = (decode_forward_time + scheduler_overhead) / tokens_produced`

同样在 H100 上的 Llama-3.3-70B 上，开 chunked prefill 时 TPOT 平均 ~7 ms。不开 chunked prefill 的话，邻居序列正在做长 prefill 时，TPOT 能飙到 50 ms。盯 P99，别盯 mean。

### E2E latency（端到端延迟）

`E2E = TTFT + TPOT * output_tokens + network_response`

输出长（>500 tokens）的请求，E2E 由 TPOT 主导。短输出 + 长 prompt 的请求，E2E 由 TTFT 主导。报 E2E 时要按输出长度分组。

### Throughput（吞吐）

`throughput = total_output_tokens / elapsed_time`

聚合指标。告诉你集群整体效率。但说不清单个请求的健康状况。

### Goodput —— 你真正该关心的指标

`goodput = 同时满足 (TTFT <= a) AND (TPOT <= b) AND (E2E <= c) 的请求占比`

SLO 是个多约束。一个请求只有在每条约束都成立时才算「good」。goodput 就是这个比例。吞吐高但 goodput 60% 是失败。吞吐稍低但 goodput 99% 才是目标。

2026 年，goodput 是 MLPerf Inference v6.0 提交、以及各大 AI 平台供应商内部 SLA 跟踪所用的指标。

### 为什么 mean 是错的统计量

LLM 延迟分布是右偏的。一个 decode batch 里如果混进一个长 prefill 邻居，可能有 500 个 token 的 TPOT ~7 ms，又有 20 个 token 的 TPOT ~60 ms。mean TPOT 是 9 ms，P99 TPOT 是 65 ms。用户经常踩到 P99 —— 这就是他们离开的原因。

永远要报三元组（P50, P90, P99）。优化用户体验，盯的是 P99。

### 参考数 —— Llama-3.1-8B-Instruct on TRT-LLM, 2026

- 平均 TTFT：162 ms
- 平均 TPOT：7.33 ms
- 平均 E2E：1,093 ms
- P99 TPOT：取决于 chunked-prefill 配置，10-25 ms 不等。

这些是 NVIDIA 公开发布的参考点。换模型尺寸（70B 大概 3-5 倍）、换硬件（H100 vs B200 ~3x）、换负载，数都会变。

### 测量陷阱

2026 年最常用的两个 benchmark 工具，对同一次跑给出的 TPOT 不一致：

- **NVIDIA GenAI-Perf**：ITL 计算里 **不包含** TTFT，从第 2 个 token 开始算。
- **LLMPerf**：**包含** TTFT，从第 1 个 token 开始算。

一个 TTFT 500 ms、100 个输出 token 共耗时 700 ms decode 的请求，GenAI-Perf 报 `ITL = 700/99 = 7.07 ms`，LLMPerf 报 `ITL = 1200/100 = 12.00 ms`。换工具就换数。

永远要写清楚用的哪个工具。永远要把定义公开出来。

### 怎么构造 SLO

2026 年面向消费者的 70B 聊天模型，一个合理的 SLO：

- TTFT P99 <= 800 ms。
- TPOT P99 <= 25 ms。
- 输出 <300 token 的 E2E P99 <= 3 s。
- goodput 目标 >= 99%。

企业级 SLO 会把 TTFT 收紧（200-400 ms）、把 E2E 放宽。关键不是数本身，而是：写下来，三个都测，把 goodput 作为单一综合指标来跟踪。

### 怎么测

- 跑真实流量，或者拟真合成流量（LLMPerf 配 `--mean-input-tokens 800 --stddev-input-tokens 300 --mean-output-tokens 150`）。
- benchmark 跑到峰值并发的 2 倍。
- 跑 30-50 次迭代，对合并后的样本取分位数。
- 发布时附上工具名、工具版本、模型、硬件、并发、prompt 分布。

## 用起来（Use It）

`code/main.py` 是一个玩具版 goodput 计算器。生成一个合成延迟分布，套上 SLO，算出 goodput。同时也演示了 GenAI-Perf 和 LLMPerf 在同一条 trace 上 TPOT 的差异。

## 上线部署（Ship It）

这一课产出 `outputs/skill-slo-goodput-gate.md`。给定 workload 和 SLO，它会产出一份 CI/CD 就绪的 benchmark recipe（配方），让上线决策由 goodput 而不是 throughput 来把关。

## 练习（Exercises）

1. 跑一下 `code/main.py`。生成一个尾部尖峰 1% 的分布。把 P99 TPOT 从 30 ms 收紧到 15 ms，goodput 怎么变？
2. 某厂商报价「Llama 3.3 70B H100 上 15,000 tok/s」。在相信之前要问哪三个问题？
3. 为什么 chunked prefill 能保护 P99 TPOT，却保护不了 mean TPOT？
4. 给一个语音助手（首 token 是听见的，不是读到的）构造一份消费者 SLO。哪个指标对用户最可见？
5. 读 LLMPerf 的 README 和 GenAI-Perf 的文档，再找出三个两个工具会给出不同结果的指标。

## 关键术语（Key Terms）

| 术语 | 大家嘴上怎么说 | 实际是什么意思 |
|------|----------------|----------------|
| TTFT | 「time to first token」 | queue + network + prefill；prompt 长时由 prefill 主导 |
| TPOT | 「time per output token」 | 首 token 之后每个 token 的 memory-bound decode 成本 |
| ITL | 「inter-token latency」 | 多数工具里和 TPOT 是一回事（但不是全部 —— 看 GenAI-Perf） |
| E2E | 「end to end」 | TTFT + TPOT * output_len；再加上响应侧网络 |
| Throughput | 「tok/s」 | 集群效率；没有延迟分位数就是无意义的 |
| Goodput | 「SLO 达标率」 | 同时满足全部 SLO 约束的请求占比 |
| P99 | 「尾部」 | 百分之一概率的最坏延迟；用户体验指标 |
| SLO multi-constraint | 「联合约束」 | 三条延迟约束的 AND；任一条违反请求即失败 |
| GenAI-Perf vs LLMPerf | 「工具陷阱」 | 两个工具对 ITL 是否包含 TTFT 给出不同答案 |

## 延伸阅读（Further Reading）

- [NVIDIA NIM — LLM Benchmarking Metrics](https://docs.nvidia.com/nim/benchmarking/llm/latest/metrics.html) —— TTFT、ITL、TPOT 的权威定义。
- [Anyscale — LLM Serving Benchmarking Metrics](https://docs.anyscale.com/llm/serving/benchmarking/metrics) —— 另一套定义和测量配方。
- [BentoML — LLM Inference Metrics](https://bentoml.com/llm/inference-optimization/llm-inference-metrics) —— 真实部署上的实战测量。
- [LLMPerf](https://github.com/ray-project/llmperf) —— 基于 Ray 的开源 benchmark。
- [GenAI-Perf](https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/client/src/c++/perf_analyzer/genai-perf/README.html) —— NVIDIA 的 benchmark 工具。
- [MLPerf Inference](https://mlcommons.org/benchmarks/inference-datacenter/) —— 业界公认、基于 goodput 的 benchmark。
