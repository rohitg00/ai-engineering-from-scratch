# LLM API 的负载测试 —— 为什么 k6 和 Locust 会"说谎"

> 传统的负载测试工具并非为流式响应、可变输出长度、token 级指标或 GPU 饱和而设计。两个陷阱让大多数团队中招。GIL 陷阱：Locust 的 token 级测量在 Python GIL 下运行分词，在高并发下与请求生成竞争；分词积压随后膨胀报告的 token 间延迟 —— 瓶颈在客户端，而非服务器。Prompt 一致性陷阱：循环中使用相同的 prompt 只测试 token 分布上的一个点；真实流量具有可变长度和多样的前缀匹配。LLMPerf 通过 `--mean-input-tokens` + `--stddev-input-tokens` 解决此问题。2026 年工具映射：LLM 专用工具（GenAI-Perf、LLMPerf、LLM-Locust、guidellm）用于 token 级精度；**k6 v2026.1.0** + **k6 Operator 1.0 GA（2025 年 9 月）** —— 支持流式感知、Kubernetes 原生分布式（通过 TestRun/PrivateLoadZone CRD），最适合 CI/CD 门槛；Vegeta 用于 Go 恒定速率饱和测试；Locust 2.43.3 只有搭配 LLM-Locust 扩展才支持流式。负载模式：稳态、斜坡、尖峰（自动扩缩容测试）、浸泡（内存泄漏）。

**类型：** 构建
**语言：** Python（标准库，简易真实 prompt 生成器 + 延迟收集器）
**前置知识：** 第 17 阶段 · 08（推理指标）、第 17 阶段 · 03（GPU 自动扩缩容）
**时间：** ~75 分钟

## 学习目标

- 解释两个反模式（GIL 陷阱、prompt 一致性陷阱），它们让通用负载测试工具在 LLM API 上"说谎"。
- 为给定目的选择工具：LLMPerf（基准测试）、k6 + 流式扩展（CI 门槛）、guidellm（大规模合成）、GenAI-Perf（NVIDIA 参考）。
- 设计四种负载模式（稳态、斜坡、尖峰、浸泡）并说明每种能发现什么故障模式。
- 使用输入 token 的均值 + 标准差构建真实的 prompt 分布，而非固定长度。

## 问题背景

你用 k6 对 LLM 端点做了 500 并发用户的负载测试。它扛住了。你上线。生产环境 200 真实用户时服务就挂了 —— P99 TTFT 爆炸，GPU 跑满。

发生了两件事。第一，k6 发送了 500 个完全相同的 prompt —— 你的请求合并和前缀缓存让它看起来像在同时处理 500 个解码，实际上只处理了一个。第二，k6 不像人眼体验那样跟踪流式响应的 token 间延迟；它看到一个 HTTP 连接，而不是 500 个 token 以不同间隔到达。

LLM 的负载测试是一门独立的学问。

## 核心概念

### GIL 陷阱（Locust）

Locust 使用 Python，在 GIL 下客户端进行分词。高并发下，分词器在请求生成后面排队。报告的 token 间延迟包含了客户端分词积压。你以为服务器慢，实际上是测试工具的问题。

修复：LLM-Locust 扩展将分词移到独立进程，或使用编译语言工具（k6、LLMPerf 使用 tokenizers.rs）。

### Prompt 一致性陷阱

所有已知的负载测试工具都允许配置一个 prompt。在 10,000 次循环测试中，每次发送完全相同的 prompt。服务器每次看到相同的前缀 —— 前缀缓存命中率接近 100%，吞吐量看起来很好。

修复：从 prompt 分布中采样。LLMPerf 使用 `--mean-input-tokens 500 --stddev-input-tokens 150` —— 多样长度、多样内容。

### 四种负载模式

1. **稳态** —— 30–60 分钟恒定 RPS。发现：基线性能退化。
2. **斜坡** —— 15 分钟内从 0 线性增加到目标 RPS。发现：容量断点、预热异常。
3. **尖峰** —— 突然 3–10x RPS 持续 2 分钟后恢复。发现：自动扩缩容延迟、队列饱和、冷启动影响。
4. **浸泡** —— 稳态持续 4–8 小时。发现：内存泄漏、连接池漂移、可观测性溢出。

### 2026 年工具映射

**LLMPerf**（Anyscale）—— Python 但 Rust 后端分词。均值/标准差 prompt。支持流式感知。性能测试的默认首选。

**NVIDIA GenAI-Perf** —— NVIDIA 的参考工具。使用 Triton 客户端；指标覆盖全面。注意其 ITL 不包含 TTFT；LLMPerf 包含。同一服务器上两个工具会产生不同的 TPOT。

**LLM-Locust**（TrueFoundry）—— 修复 GIL 陷阱的 Locust 扩展。熟悉的 Locust DSL + 流式指标。

**guidellm** —— 大规模合成基准测试。

**k6 v2026.1.0** + **k6 Operator 1.0 GA（2025 年 9 月）**：
- k6 本身（Go、编译、无 GIL）增加了流式感知指标。
- k6 Operator 使用 TestRun / PrivateLoadZone CRD 实现 Kubernetes 原生分布式测试。
- 最适合 CI/CD 门槛与 SLA 测试。

**Vegeta** —— Go，比 k6 更简单。恒定速率 HTTP 饱和测试。非 LLM 专用，但适合网关 / 速率限制测试。

**Locust 2.43.3 原生版** —— 对 LLM 有 GIL 陷阱。只有搭配 LLM-Locust 扩展才可用。

### CI 中的 SLA 门槛

在 PR 上运行 k6：

- 基线 RPS 下各 30–50 次迭代。
- 门槛：P50/P95 TTFT、5xx < 5%、TPOT 低于阈值。
- 越界时阻断构建。

### 真实的 prompt 分布

从真实流量样本构建（如果有）或从已发布分布构建（如聊天用 ShareGPT prompt、代码用 HumanEval）。将均值 + 标准差喂给 LLMPerf。绝对避免单 prompt 循环。

### 需要记住的数字

- k6 Operator 1.0 GA：2025 年 9 月。
- k6 v2026.1.0：支持流式感知指标。
- 典型 LLMPerf 运行：并发 X 下 100–1000 次请求。
- 典型 CI 门槛：每个 PR 30–50 次迭代。
- 四种模式：稳态、斜坡、尖峰、浸泡。

## 使用

`code/main.py` 模拟一次带有真实 prompt 分布的负载测试，测量有效 TPOT，并演示统一 prompt 陷阱。

## 交付

本课产出 `outputs/skill-load-test-plan.md`。给定工作负载与 SLA，选择工具并设计四种负载模式。

## 练习

1. 运行 `code/main.py`。对比统一 prompt 与真实分布 —— 差距在哪里？
2. 为 CI 门槛编写 k6 脚本：100 并发下 TTFT P95 < 800 ms，运行 5 分钟。
3. 你的浸泡测试显示内存每小时增长 50 MB。列出三种原因及用于区分它们的观测手段。
4. 尖峰测试从 10 RPS 到 100 RPS。如果已部署 Karpenter + vLLM production-stack（第 17 阶段 · 03 + 18），预期恢复时间是多少？
5. GenAI-Perf 报告 TPOT=6ms；LLMPerf 在同一服务器上报告 TPOT=11ms。解释原因。

## 关键术语

| 术语 | 业界说法 | 实际含义 |
|------|---------|---------|
| LLMPerf | "the LLM harness" | Anyscale 基准工具，支持流式感知 |
| GenAI-Perf | "NVIDIA tool" | NVIDIA 参考测试工具 |
| LLM-Locust | "Locust for LLMs" | 修复 GIL 陷阱的 Locust 扩展 |
| guidellm | "synthetic benchmark" | 大规模合成工具 |
| k6 Operator | "K8s k6" | 基于 CRD 的分布式 k6 |
| GIL trap | "Python client overhead" | 分词积压膨胀报告的延迟 |
| Prompt-uniformity trap | "single-prompt lie" | 相同 prompt 循环命中缓存，虚高吞吐量 |
| Steady-state | "constant load" | N 分钟平坦 RPS |
| Ramp | "linear up" | 持续时间内从 0 到目标 |
| Spike | "burst test" | 突然倍增后恢复 |
| Soak | "long test" | 数小时用于泄漏检测 |

## 延伸阅读

- [TianPan — Load Testing LLM Applications](https://tianpan.co/blog/2026-03-19-load-testing-llm-applications)
- [PremAI — Load Testing LLMs 2026](https://blog.premai.io/load-testing-llms-tools-metrics-realistic-traffic-simulation-2026/)
- [NVIDIA NIM — Introduction to LLM Inference Benchmarking](https://docs.nvidia.com/nim/large-language-models/1.0.0/benchmarking.html)
- [TrueFoundry — LLM-Locust](https://www.truefoundry.com/blog/llm-locust-a-tool-for-benchmarking-llm-performance)
- [LLMPerf](https://github.com/ray-project/llmperf)
- [k6 Operator](https://github.com/grafana/k6-operator)
