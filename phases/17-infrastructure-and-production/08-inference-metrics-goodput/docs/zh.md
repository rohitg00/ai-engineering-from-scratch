# 推理指标 — TTFT、TPOT、ITL、Goodput、P99

> 四个指标决定推理部署是否工作。TTFT 是 prefill 加队列加网络。TPOT（等效于 ITL）是每个 token 的内存绑定解码成本。端到端延迟是 TTFT 加 TPOT 乘以输出长度。吞吐量是跨集群聚合的每秒 token 数。但对产品重要的是 goodput——同时满足每个 SLO 的请求分数。低 goodput 下的高吞吐量意味着你正在处理从未及时到达用户的 token。2026 年 TRT-LLM 上 Llama-3.1-8B-Instruct 的参考数字：平均 TTFT 162 ms，平均 TPOT 7.33 ms，平均 E2E 1,093 ms。始终报告 P50、P90、P99——绝不仅仅报告平均值。并注意测量陷阱：GenAI-Perf 从 ITL 计算中排除 TTFT，LLMPerf 包含它；同一运行的两个工具在 TPOT 上不一致。

**类型：** 学习
**语言：** Python（标准库，简单的百分位数计算器和 goodput 报告器）
**先修要求：** 阶段 17 · 04（vLLM 服务内部原理）
**时间：** 约 60 分钟

## 学习目标

- 精确定义 TTFT、TPOT、ITL、E2E、吞吐量和 goodput，并说出每个指标测量的组件。
- 解释为什么平均值是 LLM 服务的错误统计数据，以及如何读取 P50/P90/P99。
- 构建 SLO 多约束（例如 TTFT<500 ms AND TPOT<15 ms AND E2E<2 s）并针对它计算 goodput。
- 说出在同一运行中对 TPOT 不一致的两个基准测试工具并解释原因。

## 问题

"我们的吞吐量是每秒 15,000 个 token。"那又怎样？如果 40% 的请求超过 2 秒端到端，用户放弃了会话。仅靠吞吐量不能告诉你产品是否工作。

推理具有多个延迟轴，每个轴以不同方式失败。Prefill 是计算绑定的，随提示长度缩放。Decode 是内存绑定的，随批次大小缩放。排队延迟是运维问题。网络是物理距离问题。你需要每个不同的指标，你需要百分位数，你需要一个说"用户是否得到了他们期望的"的单一复合指标——那就是 goodput。

## 概念

### TTFT——首个 token 的时间

`TTFT = queue_time + network_request + prefill_time`

提示长时 prefill 占主导。在 H100 上的 Llama-3.3-70B FP8 上，32k 提示需要约 800 ms 的纯 prefill。队列时间是负载下的调度器行为。网络请求是包括 TLS 的有线时间。TTFT 是用户在 anything streams back 之前看到的延迟。

### TPOT / ITL——token 间延迟

一个数量的许多名称。`TPOT`（每个输出 token 的时间）、`ITL`（token 间延迟）、`每个 token 的解码延迟`——都一样。它是第一个之后连续流式 token 之间的时间。

`TPOT = (decode_forward_time + scheduler_overhead) / tokens_produced`

在带有 chunked prefill 的相同 Llama-3.3-70B H100 栈上，TPOT 平均约 7 ms。没有 chunked prefill 时，在相邻序列的长 prefill 期间，TPOT 可能激增至 50 ms。观察 P99，而不是平均值。

### E2E 延迟

`E2E = TTFT + TPOT * output_tokens + network_response`

对于长输出（>500 个 token），E2E 由 TPOT 主导。对于带有长提示的短输出，E2E 由 TTFT 主导。报告输出长度条件的 E2E。

### 吞吐量

`throughput = total_output_tokens / elapsed_time`

聚合指标。告诉你集群效率。不告诉你单个请求的健康状况。

### Goodput——你实际关心的指标

`goodput = fraction of requests meeting (TTFT <= a) AND (TPOT <= b) AND (E2E <= c)`

SLO 是多约束。仅当每个约束都成立时，请求才是"好的"。Goodput 是份额。60% goodput 下的高吞吐量是失败。99% goodput 下的较低吞吐量是目标。

在 2026 年，goodput 是 MLPerf Inference v6.0 提交和 AI 平台提供商内部 SLA 跟踪中使用的指标。

### 为什么平均值是错误统计数据

LLM 延迟分布是右偏的。一个带有一个长 prefill 邻居的解码批次可以以 TPOT ~7 ms 传送 500 个 token，而以 TPOT ~60 ms 传送 20 个 token。平均 TPOT 是 9 ms。P99 TPOT 是 65 ms。用户经常遇到 P99——这就是他们离开的原因。

始终报告三元组（P50、P90、P99）。对于用户体验，P99 是你优化的那个。

### 参考数字——2026 年 TRT-LLM 上的 Llama-3.1-8B-Instruct

- 平均 TTFT：162 ms
- 平均 TPOT：7.33 ms
- 平均 E2E：1,093 ms
- P99 TPOT：根据 chunked-prefill 配置变化 10-25 ms。

这些是已发布的 NVIDIA 参考点。它们随模型大小（70B 会显示 3-5 倍）、硬件（H100 vs B200 ~3 倍）和负载而变化。

### 测量陷阱

两个最常用 2026 基准测试工具在同一运行中对 TPOT 不一致：

- **NVIDIA GenAI-Perf**：从 ITL 计算中排除 TTFT。ITL 从 token 2 开始。
- **LLMPerf**：包含 TTFT。ITL 从 token 1 开始。

对于 TTFT 500 ms 和 100 个输出 token 在 700 ms 总解码时间内的请求，GenAI-Perf 报告 `ITL = 700/99 = 7.07 ms`，LLMPerf 报告 `ITL = 1200/100 = 12.00 ms`。工具选择改变数字。

始终说明哪个工具。始终发布定义。

### 构建 SLO

2026 年 70B 聊天模型的合理面向消费者的 SLO：

- TTFT P99 <= 800 ms。
- TPOT P99 <= 25 ms。
- <300 token 输出的 E2E P99 <= 3 s。
- Goodput 目标 >= 99%。

企业 SLO 收紧 TTFT（200-400 ms）并放宽 E2E。重点是写下它们，测量所有三个，并跟踪 goodput 作为单一复合指标。

### 如何测量

- 运行真实流量或现实的合成（带有 `--mean-input-tokens 800 --stddev-input-tokens 300 --mean-output-tokens 150` 的 LLMPerf）。
- 基准测试运行的目标 2 倍峰值并发。
- 运行 30-50 次迭代，取组合样本的百分位数。
- 发布时附上工具名称、工具版本、模型、硬件、并发、提示分布。

## 使用它

`code/main.py` 是一个简单的 goodput 计算器。生成合成延迟分布，应用 SLO，并计算 goodput。还显示了同一跟踪上的 GenAI-Perf vs LLMPerf TPOT 差异。

## 交付它

本课生成 `outputs/skill-slo-goodput-gate.md`。给定工作负载和 SLO，它生成一个 CI/CD 就绪的基准测试配方，在 goodput 而不是吞吐量上 gate deploys。

## 练习

1. 运行 `code/main.py`。生成具有 1% 尾部尖峰的分布。当你将 P99 TPOT 从 30 ms 收紧到 15 ms 时，goodput 如何变化？
2. 供应商引用"Llama 3.3 70B H100 上 15,000 tok/s"。在信任之前说出三个要问的问题。
3. 为什么 chunked prefill 保护 P99 TPOT 而不是平均 TPOT？
4. 为语音助手构建消费者 SLO（首个 token 是被听到，而不是被读取）。哪个指标对用户最可见？
5. 阅读 LLMPerf README 和 GenAI-Perf 文档。确定工具不一致的其他三个指标。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| TTFT | "首个 token 的时间" | 队列 + 网络 + prefill；在长提示时由 prefill 主导 |
| TPOT | "每个输出 token 的时间" | 第一个之后每个 token 的内存绑定解码成本 |
| ITL | "token 间延迟" | 大多数工具中与 TPOT 相同（不是全部——参见 GenAI-Perf） |
| E2E | "端到端" | TTFT + TPOT * output_len；加上响应侧网络 |
| Throughput | "tok/s" | 集群效率；没有延迟百分位数就没用 |
| Goodput | "满足 SLO 的速率" | 同时满足每个 SLO 约束的请求分数 |
| P99 | "尾部" | 100 个中最差情况的延迟；用户体验指标 |
| SLO multi-constraint | "联合" | 所有三个延迟界限的 AND；如果任何一个被违反，请求失败 |
| GenAI-Perf vs LLMPerf | "工具陷阱" | 工具对 ITL 是否包含 TTFT 不一致 |

## 延伸阅读

- [NVIDIA NIM——LLM 基准测试指标](https://docs.nvidia.com/nim/benchmarking/llm/latest/metrics.html)——TTFT、ITL、TPOT 的规范定义。
- [Anyscale——LLM 服务基准测试指标](https://docs.anyscale.com/llm/serving/benchmarking/metrics)——替代定义和测量配方。
- [BentoML——LLM 推理指标](https://bentoml.com/llm/inference-optimization/llm-inference-metrics)——真实部署上的应用测量。
- [LLMPerf](https://github.com/ray-project/llmperf)——基于 Ray 的开源基准测试。
- [GenAI-Perf](https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/client/src/c++/perf_analyzer/genai-perf/README.html)——NVIDIA 的基准测试工具。
- [MLPerf Inference](https://mlcommons.org/benchmarks/inference-datacenter/)——行业接受的基于 goodput 的基准测试。
