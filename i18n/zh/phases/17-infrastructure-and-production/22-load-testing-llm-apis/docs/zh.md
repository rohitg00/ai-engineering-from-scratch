# 对 LLM API 进行负载测试 —— 为什么 k6 和 Locust 会骗人

> 传统负载测试工具并非为流式响应、可变输出长度、token 级指标或 GPU 饱和而设计。有两个陷阱会坑住大多数团队。GIL 陷阱：Locust 的 token 级测量在 Python GIL 之下运行 tokenization,在高并发下会与请求生成竞争；tokenization 积压会夸大报告的 inter-token 延迟——瓶颈是你的客户端，而不是服务器。prompt 均一性陷阱：循环中使用相同 prompt 只测试 token 分布上的一个点；真实流量长度可变且前缀匹配多样。LLMPerf 通过 `--mean-input-tokens` + `--stddev-input-tokens` 解决了这个问题。2026 年的工具选型：LLM 专用工具(GenAI-Perf、LLMPerf、LLM-Locust、guidellm)用于 token 级精度；**k6 v2026.1.0** + **k6 Operator 1.0 GA(2025 年 9 月)**——感知流式、Kubernetes 原生，通过 TestRun/PrivateLoadZone CRD 实现分布式，最适合 CI/CD 门禁；Vegeta 用于 Go 恒定速率饱和测试；Locust 2.43.3 只有配合 LLM-Locust 扩展才支持流式。负载模式：稳态、爬坡、尖峰(autoscaling 测试)、浸泡(内存泄漏)。

**Type:** Build
**Languages:** Python (标准库,简化的真实 prompt 生成器 + 延迟采集器)
**Prerequisites:** Phase 17 · 08(Inference Metrics)、Phase 17 · 03(GPU Autoscaling)
**Time:** 约 75 分钟

## 学习目标

- 解释使通用负载测试工具在 LLM API 上失真的两种反模式(GIL 陷阱、prompt 均一性陷阱)。
- 针对特定用途选择工具：LLMPerf(基准运行)、k6 + 流式扩展(CI 门禁)、guidellm(大规模合成)、GenAI-Perf(NVIDIA 参考实现)。
- 设计四种负载模式(稳态、爬坡、尖峰、浸泡)并说出每种模式能捕捉的故障类型。
- 使用输入 token 的均值 + 标准差(而非固定长度)构建真实的 prompt 分布。

## 问题所在

你用 k6 以 500 个并发用户测试了你的 LLM 端点。它扛住了。你上线了。在生产环境中只有 200 个真实用户时服务就崩溃了——P99 TTFT 飙升，GPU 被打满。

发生了两件事。第一，k6 发送了 500 个完全相同的 prompt——你的请求合并和前缀缓存让你看起来在处理 500 个并发 decode,实际上只处理了一个。第二，k6 无法像人眼感知那样跟踪流式响应的 inter-token 延迟；它看到的是一条 HTTP 连接，而不是以不同间隔到达的 500 个 token。

对 LLM 进行负载测试是一门独立的学科。

## 核心概念

### GIL 陷阱(Locust)

Locust 使用 Python,并在 GIL 之下于客户端运行 tokenization。高并发下，tokenizer 排在请求生成之后。报告的 inter-token 延迟包含了客户端 tokenization 积压。你以为服务器慢；其实是测试框架的问题。

修复：LLM-Locust 扩展将 tokenization 移到独立进程，或使用编译语言框架(k6、使用 tokenizers.rs 的 LLMPerf)。

### prompt 均一性陷阱

所有已知的负载测试工具都只让你配置一个 prompt。在 10,000 次迭代的循环测试中，每次发送的都是完全相同的 prompt。服务器每次看到的都是相同前缀——前缀缓存命中率接近 100%,吞吐量看起来很棒。

修复：从 prompt 分布中采样。LLMPerf 使用 `--mean-input-tokens 500 --stddev-input-tokens 150`——长度多样、内容多样。

### 四种负载模式

1. **稳态(Steady-state)**——恒定 RPS 持续 30-60 分钟。捕捉：基线性能回归。
2. **爬坡(Ramp)**——15 分钟内将 RPS 从 0 线性增加到目标值。捕捉：容量拐点、预热异常。
3. **尖峰(Spike)**——突然 3-10 倍 RPS 持续 2 分钟后回落。捕捉：autoscaling 延迟、队列饱和、冷启动影响。
4. **浸泡(Soak)**——稳态持续 4-8 小时。捕捉：内存泄漏、连接池漂移、可观测性溢出。

### 2026 年工具选型

**LLMPerf**(Anyscale)——Python 但由 Rust 支撑的 tokenization。均值/标准差 prompt。感知流式。性能测试的最佳默认选择。

**NVIDIA GenAI-Perf**——NVIDIA 的参考实现。使用 Triton client;指标覆盖全面。注意其 ITL 不包含 TTFT;LLMPerf 的包含它。两个工具在同一服务器上会给出不同的 TPOT。

**LLM-Locust**(TrueFoundry)——修复 GIL 陷阱的 Locust 扩展。熟悉的 Locust DSL + 流式指标。

**guidellm**——大规模合成基准测试。

**k6 v2026.1.0** + **k6 Operator 1.0 GA(2025 年 9 月)**:
- k6 本身(Go、编译型、无 GIL)增加了感知流式的指标。
- k6 Operator 使用 TestRun / PrivateLoadZone CRD 实现 Kubernetes 原生分布式测试。
- 最适合 CI/CD 门禁和 SLA 测试。

**Vegeta**——Go 编写，比 k6 简单。恒定速率 HTTP 饱和测试。不感知 LLM,但适合网关/限流测试。

**Locust 2.43.3 原生版**——对 LLM 存在 GIL 陷阱。只有配合 LLM-Locust 扩展才可用。

### CI 中的 SLA 门禁

在 PR 上运行 k6,配置如下：

- 基线 RPS 下各运行 30-50 次迭代。
- 门禁:P50/P95 TTFT、5xx < 5%、TPOT 低于阈值。
- 违反则中断构建。

### 真实的 prompt 分布

从真实流量样本(如果有)或已发布的分布构建(例如聊天用 ShareGPT prompt,代码用 HumanEval)。将均值 + 标准差输入 LLMPerf。绝对避免单 prompt 循环。

### 你应该记住的数字

- k6 Operator 1.0 GA:2025 年 9 月。
- k6 v2026.1.0:感知流式的指标。
- 典型 LLMPerf 运行：并发 X 下 100-1000 个请求。
- 典型 CI 门禁：每个 PR 30-50 次迭代。
- 四种模式：稳态、爬坡、尖峰、浸泡。

```figure
load-pattern-waves
```

## 动手实践

`code/main.py` 用真实 prompt 分布模拟负载测试，测量有效 TPOT,并演示均一 prompt 陷阱。

## 上线交付

本课产出 `outputs/skill-load-test-plan.md`。根据工作负载和 SLA,选择工具并设计四种负载模式。

## 练习

1. 运行 `code/main.py`。比较均一分布与真实分布——差距在哪里？
2. 为 CI 门禁编写 k6 脚本：100 并发下 TTFT P95 < 800 ms,运行 5 分钟。
3. 你的浸泡测试显示内存每小时增长 50 MB。说出三种可能原因以及区分它们的监控手段。
4. 从 10 RPS 尖峰到 100 RPS。如果已部署 Karpenter + vLLM production-stack(Phase 17 · 03 + 18),预期的恢复时间是多少？
5. GenAI-Perf 报告 TPOT=6ms;LLMPerf 在同一服务器上报告 TPOT=11ms。解释原因。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|------------------------|
| LLMPerf | "那个 LLM 框架" | Anyscale 基准测试工具,感知流式 |
| GenAI-Perf | "NVIDIA 的工具" | NVIDIA 参考测试框架 |
| LLM-Locust | "LLM 版 Locust" | 修复 GIL 陷阱的 Locust 扩展 |
| guidellm | "合成基准测试" | 大规模合成测试工具 |
| k6 Operator | "K8s 版 k6" | 基于 CRD 的分布式 k6 |
| GIL 陷阱 | "Python 客户端开销" | Tokenization 积压夸大报告的延迟 |
| prompt 均一性陷阱 | "单 prompt 骗局" | 相同 prompt 循环命中缓存,夸大吞吐量 |
| 稳态 | "恒定负载" | 恒定 RPS 持续 N 分钟 |
| 爬坡 | "线性上升" | 在时长内从 0 到目标值 |
| 尖峰 | "突发测试" | 突然的倍数增长然后回落 |
| 浸泡 | "长时间测试" | 数小时用于泄漏检测 |

## 延伸阅读

- [TianPan — Load Testing LLM Applications](https://tianpan.co/blog/2026-03-19-load-testing-llm-applications)
- [PremAI — Load Testing LLMs 2026](https://blog.premai.io/load-testing-llms-tools-metrics-realistic-traffic-simulation-2026/)
- [NVIDIA NIM — Introduction to LLM Inference Benchmarking](https://docs.nvidia.com/nim/large-language-models/1.0.0/benchmarking.html)
- [TrueFoundry — LLM-Locust](https://www.truefoundry.com/blog/llm-locust-a-tool-for-benchmarking-llm-performance)
- [LLMPerf](https://github.com/ray-project/llmperf)
- [k6 Operator](https://github.com/grafana/k6-operator)