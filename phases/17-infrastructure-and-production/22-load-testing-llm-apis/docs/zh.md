# LLM API 负载测试 — 为什么 k6 和 Locust 说谎

> 传统的负载测试工具不是为流式响应、可变输出长度、token 级指标或 GPU 饱和设计的。两个陷阱困扰大多数团队。GIL 陷阱：Locust 的 token 级测量在 Python GIL 下运行 tokenization，在高并发下与请求生成竞争；tokenization 积压然后夸大报告的 token 间延迟——你的客户端是瓶颈，而不是服务器。提示均匀性陷阱：循环中的相同提示测试 token 分布上的一个点；真实流量具有可变长度和多样化的前缀匹配。LLMPerf 通过 `--mean-input-tokens` + `--stddev-input-tokens` 修复了这个问题。2026 年的工具映射：LLM 专用（GenAI-Perf、LLMPerf、LLM-Locust、guidellm）用于 token 级准确性；**k6 v2026.1.0** + **k6 Operator 1.0 GA（2025 年 9 月）**——流式感知、通过 TestRun/PrivateLoadZone CRD 实现 Kubernetes 原生分布式，最适合 CI/CD 门控；Vegeta 用于 Go 恒定速率饱和；Locust 2.43.3 仅通过 LLM-Locust 扩展实现流式。负载模式：稳态、斜坡、峰值（自动扩展测试）、浸泡（内存泄漏）。

**类型：** 构建
**语言：** Python（标准库，简单的逼真提示生成器 + 延迟收集器）
**先决条件：** 阶段 17 · 08（推理指标）、阶段 17 · 03（GPU 自动扩展）
**时间：** 约 75 分钟

## 学习目标

- 解释使通用负载测试工具对 LLM API 说谎的两个反模式（GIL 陷阱、提示均匀性陷阱）。
- 为给定目的选择工具：LLMPerf（基准运行）、k6 + 流式扩展（CI 门控）、guidellm（大规模合成）、GenAI-Perf（NVIDIA 参考）。
- 设计四种负载模式（稳态、斜坡、峰值、浸泡）并说出每种捕获的故障模式。
- 使用输入 token 的均值 + 标准差而不是固定长度来构建逼真的提示分布。

## 问题

你在 500 个并发用户下对 LLM 端点进行了 k6 测试。它承受住了。你发布了。在生产中，200 个实际用户导致服务崩溃——P99 TTFT 爆炸，GPU 固定。

发生了两件事。首先，k6 发送了 500 个相同的提示——你的请求合并和前缀缓存让它看起来像是在处理 500 个并发 decode，而实际上你只处理了一个。其次，k6 不以眼睛体验的方式跟踪流式响应上的 token 间延迟；它看到一个 HTTP 连接，而不是以不同间隔到达的 500 个 token。

LLM 的负载测试是其自身的学科。

## 概念

### GIL 陷阱（Locust）

Locust 使用 Python 并在 GIL 下在客户端运行 tokenization。在高并发下，tokenizer 在请求生成后面排队。报告的 token 间延迟包括客户端 tokenization 积压。你认为是服务器慢；实际上是测试工具。

修复：LLM-Locust 扩展将 tokenization 移动到单独的进程，或使用编译语言工具包（k6、使用 tokenizer.rs 的 LLMPerf）。

### 提示均匀性陷阱

所有已知的负载测试工具都允许你配置一个提示。在 10,000 次迭代的循环测试中，每次都发送完全相同的提示。服务器每次都看到相同的前缀——前缀缓存命中率接近 100%，吞吐量看起来很棒。

修复：从提示分布中采样。LLMPerf 使用 `--mean-input-tokens 500 --stddev-input-tokens 150`——多样的长度，多样的内容。

### 四种负载模式

1. **稳态**——30-60 分钟的恒定 RPS。捕获：基线性能回归。
2. **斜坡**——在 15 分钟内从 0 线性增加到目标 RPS。捕获：容量断点、预热异常。
3. **峰值**——突然增加 3-10 倍 RPS，持续 2 分钟，然后返回。捕获：自动扩展延迟、队列饱和、冷启动影响。
4. **浸泡**——4-8 小时的稳态。捕获：内存泄漏、连接池漂移、可观测性溢出。

### 2026 年工具映射

**LLMPerf**（Anyscale）——Python 但 Rust 支持的 tokenization。均值/标准差提示。流式感知。性能运行的最佳默认设置。

**NVIDIA GenAI-Perf**——NVIDIA 的参考。使用 Triton 客户端；全面的指标覆盖。注意其 ITL 排除 TTFT；LLMPerf 的包括它。两个工具对同一个服务器产生不同的 TPOT。

**LLM-Locust**（TrueFoundry）——修复 GIL 陷阱的 Locust 扩展。熟悉的 Locust DSL + 流式指标。

**guidellm**——大规模合成基准测试。

**k6 v2026.1.0** + **k6 Operator 1.0 GA（2025 年 9 月）**：
- k6 本身（Go、编译、无 GIL）添加了流式感知指标。
- k6 Operator 使用 TestRun / PrivateLoadZone CRD 进行 Kubernetes 原生分布式测试。
- 最适合 CI/CD 门控和 SLA 测试。

**Vegeta**——Go，比 k6 简单。恒定速率 HTTP 饱和。不感知 LLM，但适合网关/速率限制测试。

**Locust 2.43.3 stock**——对 LLM 有 GIL 陷阱。仅通过 LLM-Locust 扩展。

### CI 中的 SLA 门控

在 PR 上运行 k6，使用：

- 每个在基线 RPS 下 30-50 次迭代。
- 门控：P50/P95 TTFT、5xx < 5%、TPOT 低于阈值。
- 违反时中断构建。

### 逼真提示分布

从真实流量样本（如果有）或已发布的分布（例如，用于聊天的 ShareGPT 提示，用于代码的 HumanEval）构建。将均值 + 标准差提供给 LLMPerf。不惜一切代价避免单提示循环。

### 你应该记住的数字

- k6 Operator 1.0 GA：2025 年 9 月。
- k6 v2026.1.0：流式感知指标。
- 典型的 LLMPerf 运行：并发 X 下的 100-1000 个请求。
- 典型的 CI 门控：每个 PR 30-50 次迭代。
- 四种模式：稳态、斜坡、峰值、浸泡。

## 使用它

`code/main.py` 模拟具有逼真提示分布的负载测试，测量有效 TPOT，并演示均匀提示陷阱。

## 部署它

本课生成 `outputs/skill-load-test-plan.md`。根据工作负载和 SLA，选择工具并设计四种负载模式。

## 练习

1. 运行 `code/main.py`。比较均匀与逼真分布——差距在哪里？
2. 为 CI 门控编写 k6 脚本：在 100 个并发下 TTFT P95 < 800 毫秒，运行时间 5 分钟。
3. 你的浸泡测试显示内存每小时增长 50 MB。说出三个原因以及用于在其中进行选择的检测工具。
4. 从 10 RPS 到 100 RPS 的峰值测试。如果 Karpenter + vLLM production-stack 就位（阶段 17 · 03 + 18），预期恢复时间是多少？
5. GenAI-Perf 报告 TPOT=6ms；在同一服务器上 LLMPerf 报告 TPOT=11ms。解释。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------------|------------------------|
| LLMPerf | "LLM 工具包" | Anyscale 基准测试工具，流式感知 |
| GenAI-Perf | "NVIDIA 工具" | NVIDIA 参考工具包 |
| LLM-Locust | "用于 LLM 的 Locust" | 修复 GIL 陷阱的 Locust 扩展 |
| guidellm | "合成基准" | 大规模合成工具 |
| k6 Operator | "K8s k6" | 基于 CRD 的分布式 k6 |
| GIL trap | "Python 客户端开销" | Tokenization 积压夸大报告的延迟 |
| Prompt-uniformity trap | "单提示谎言" | 使用相同提示的循环命中缓存，夸大吞吐量 |
| Steady-state | "恒定负载" | N 分钟的平坦 RPS |
| Ramp | "线性上升" | 在持续时间内从 0 到目标 |
| Spike | "突发测试" | 突然倍增然后恢复 |
| Soak | "长时间测试" | 用于泄漏检测的小时数 |

## 延伸阅读

- [TianPan — 负载测试 LLM 应用](https://tianpan.co/blog/2026-03-19-load-testing-llm-applications)
- [PremAI — 2026 年负载测试 LLM](https://blog.premai.io/load-testing-llms-tools-metrics-realistic-traffic-simulation-2026/)
- [NVIDIA NIM — LLM 推理基准测试简介](https://docs.nvidia.com/nim/large-language-models/1.0.0/benchmarking.html)
- [TrueFoundry — LLM-Locust](https://www.truefoundry.com/blog/llm-locust-a-tool-for-benchmarking-llm-performance)
- [LLMPerf](https://github.com/ray-project/llmperf)
- [k6 Operator](https://github.com/grafana/k6-operator)
