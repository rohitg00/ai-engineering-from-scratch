# 推理指标 —— TTFT、TPOT、ITL、Goodput、P99

> 四个指标决定推理部署是否正常工作。TTFT是预填充加队列加网络。TPOT（等效ITL）是每token的内存约束解码成本。端到端延迟是TTFT加TPOT乘以输出长度。吞吐量是跨集群聚合的每秒token数。但对产品重要的是goodput —— 同时满足每个SLO的请求比例。低goodput下的高吞吐量意味着你正在处理从未及时到达用户的token。2026年TRT-LLM上Llama-3.1-8B-Instruct的参考数字：平均TTFT 162毫秒，平均TPOT 7.33毫秒，平均E2E 1,093毫秒。始终报告P50、P90、P99 —— 从不只报告平均值。并注意测量陷阱：GenAI-Perf从ITL计算中排除TTFT，LLMPerf包含它；两个工具对同一运行 disagree on TPOT。

**类型：** 学习
**语言：** Python（标准库，玩具百分位计算器和goodput报告器）
**前置知识：** 第17阶段 · 04（vLLM服务内部）
**时间：** 约60分钟

## 学习目标

- 精确定义TTFT、TPOT、ITL、E2E、吞吐量和goodput，并命名每个测量的组件。
- 解释为什么平均值是LLM服务的错误统计量，以及如何阅读P50/P90/P99。
- 构建SLO多约束（例如TTFT<500毫秒 AND TPOT<15毫秒 AND E2E<2秒）并针对它计算goodput。
- 命名两个对同一运行 disagree on TPOT的基准工具并解释为什么。

## 问题

"我们的吞吐量是每秒15,000 token。"那又怎样？如果40%的请求超过2秒端到端，用户放弃了会话。单独的吞吐量不告诉你产品是否正常工作。

推理有多个延迟轴，每个轴不同地失败。预填充是计算约束的，随提示长度扩展。解码是内存约束的，随批次大小扩展。队列延迟是运营问题。网络是物理距离问题。你需要每个的不同指标，你需要百分位，你需要一个单一复合指标说"用户是否得到了他们期望的" —— 那就是goodput。

## 概念

### TTFT —— 首token时间

`TTFT = queue_time + network_request + prefill_time`

提示长时预填充主导。在H100上的Llama-3.3-70B FP8，32k提示需要约800毫秒纯预填充。队列时间是负载下的调度器行为。网络请求是包括TLS的线路时间。TTFT是用户在任何内容流回之前看到的延迟。

### TPOT / ITL —— token间延迟

一个数量的多个名称。`TPOT`（每输出token时间）、`ITL`（token间延迟）、`每token解码延迟` —— 全部相同。它是首token之后连续流token之间的时间。

`TPOT = (decode_forward_time + scheduler_overhead) / tokens_produced`

在相同Llama-3.3-70B H100栈上使用分块预填充，TPOT平均约7毫秒。没有分块预填充，在相邻序列的长预填充期间，TPOT可能飙升到50毫秒。观察P99，不是平均值。

### E2E延迟

`E2E = TTFT + TPOT * output_tokens + network_response`

对于长输出（>500 token），E2E由TPOT主导。对于短输出加长提示，E2E由TTFT主导。报告按输出长度条件的E2E。

### 吞吐量

`throughput = total_output_tokens / elapsed_time`

聚合指标。告诉你集群效率。不告诉你单个请求健康。

### Goodput —— 你实际关心的指标

`goodput = 满足(TTFT <= a) AND (TPOT <= b) AND (E2E <= c)的请求比例`

SLO是多约束的。请求只有每个约束都满足时才是"好的"。Goodput是份额。60% goodput下的高吞吐量是失败。99% goodput下的较低吞吐量是目标。

2026年，goodput是MLPerf Inference v6.0提交和AI平台提供商内部SLA跟踪中使用的指标。

### 为什么平均值是错误的统计量

LLM延迟分布是右偏的。一个具有一个长预填充邻居的解码批次可以发送500个TPOT约7毫秒的token和20个TPOT约60毫秒的token。平均TPOT是9毫秒。P99 TPOT是65毫秒。用户定期命中P99 —— 这就是他们离开的原因。

始终报告三元组（P50、P90、P99）。对于用户体验，P99是你优化的。

### 参考数字 —— TRT-LLM上的Llama-3.1-8B-Instruct，2026年

- 平均TTFT：162毫秒
- 平均TPOT：7.33毫秒
- 平均E2E：1,093毫秒
- P99 TPOT：取决于分块预填充配置，变化10-25毫秒。

这些是发布的NVIDIA参考点。它们随模型大小（70B会显示3-5倍）、硬件（H100 vs B200约3倍）和负载变化。

### 测量陷阱

两个最常用的2026基准工具对同一运行 disagree on TPOT：

- **NVIDIA GenAI-Perf**：从ITL计算中排除TTFT。ITL从token 2开始。
- **LLMPerf**：包含TTFT。ITL从token 1开始。

对于TTFT 500毫秒和100个输出token在700毫秒总解码中的请求，GenAI-Perf报告`ITL = 700/99 = 7.07毫秒`，LLMPerf报告`ITL = 1200/100 = 12.00毫秒`。工具选择改变数字。

始终陈述哪个工具。始终发布定义。

### 构建SLO

2026年70B聊天模型的合理消费者面向SLO：

- TTFT P99 <= 800毫秒。
- TPOT P99 <= 25毫秒。
- E2E P99 <= 3秒，对于<300-token输出。
- Goodput目标 >= 99%。

企业SLO收紧TTFT（200-400毫秒）并放宽E2E。关键是写下它们，测量所有三个，并跟踪goodput作为单一复合指标。

### 如何测量

- 运行真实流量或现实合成（LLMPerf带`--mean-input-tokens 800 --stddev-input-tokens 300 --mean-output-tokens 150`）。
- 基准测试运行目标2倍峰值并发。
- 运行30-50次迭代，取组合样本的百分位。
- 发布时带工具名称、工具版本、模型、硬件、并发、提示分布。

## 使用它

`code/main.py`是玩具goodput计算器。生成合成延迟分布，应用SLO，计算goodput。还显示同一跟踪上GenAI-Perf vs LLMPerf的TPOT差异。

## 交付它

本课程产出`outputs/skill-slo-goodput-gate.md`。给定工作负载和SLO，它产生CI/CD就绪的基准测试配方，在goodput而不是吞吐量上门控部署。

## 练习

1. 运行`code/main.py`。生成具有1%尾部尖峰的分布。当你将P99 TPOT从30毫秒收紧到15毫秒时，goodput如何变化？
2. 供应商报价"H100上Llama 3.3 70B每秒15,000 tok"。在信任它之前问三个问题。
3. 为什么分块预填充保护P99 TPOT但不保护平均TPOT？
4. 为语音助手构建消费者SLO（首token是被听到，不是被阅读）。哪个指标最用户可见？
5. 阅读LLMPerf README和GenAI-Perf文档。识别两个工具 disagree的三个其他指标。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| TTFT | "首token时间" | 队列 + 网络 + 预填充；长提示时由预填充主导 |
| TPOT | "每输出token时间" | 首token之后内存约束的每token解码成本 |
| ITL | "token间延迟" | 大多数工具中与TPOT相同（不是所有 —— 参见GenAI-Perf） |
| E2E | "端到端" | TTFT + TPOT * output_len；顶部响应侧网络 |
| 吞吐量 | "tok/s" | 集群效率；没有延迟百分位无用 |
| Goodput | "满足SLO的比率" | 同时满足每个SLO约束的请求比例 |
| P99 | "尾部" | 1/100最坏情况延迟；用户体验指标 |
| SLO多约束 | "联合" | 所有三个延迟边界的AND；如果任何一个违反，请求失败 |
| GenAI-Perf vs LLMPerf | "工具陷阱" | 工具 disagree on ITL是否包含TTFT |

## 延伸阅读

- [NVIDIA NIM —— LLM基准测试指标](https://docs.nvidia.com/nim/benchmarking/llm/latest/metrics.html) —— TTFT、ITL、TPOT的规范定义。
- [Anyscale —— LLM服务基准测试指标](https://docs.anyscale.com/llm/serving/benchmarking/metrics) —— 替代定义和测量配方。
- [BentoML —— LLM推理指标](https://bentoml.com/llm/inference-optimization/llm-inference-metrics) —— 真实部署上的应用测量。
- [LLMPerf](https://github.com/ray-project/llmperf) —— 基于Ray的开源基准测试。
- [GenAI-Perf](https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/client/src/c++/perf_analyzer/genai-perf/README.html) —— NVIDIA的基准测试工具。
- [MLPerf Inference](https://mlcommons.org/benchmarks/inference-datacenter/) —— 行业接受的基于goodput的基准测试。