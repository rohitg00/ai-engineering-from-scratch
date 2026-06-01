# 22 · 对 LLM API 做负载测试——为什么 k6 和 Locust 在撒谎

> 传统负载测试工具的设计初衷并不是为了应对流式响应、可变输出长度、token 级指标或 GPU 饱和。两个陷阱坑住了大多数团队。「GIL 陷阱（GIL trap）」：Locust 的 token 级测量在 Python 全局解释器锁（GIL）下运行分词，会与高并发下的请求生成相互争抢；随之而来的分词积压会虚增上报的「token 间延迟（inter-token latency）」——此时瓶颈在你的客户端，而不在服务端。「提示词同质化陷阱（prompt-uniformity trap）」：在循环里发送完全相同的提示词，只测到了 token 分布上的某一个点；而真实流量长度可变、前缀匹配多样。LLMPerf 用 `--mean-input-tokens` + `--stddev-input-tokens` 修复了这个问题。2026 年的工具选型映射：token 级精度首选 LLM 专用工具（GenAI-Perf、LLMPerf、LLM-Locust、guidellm）；**k6 v2026.1.0** + **k6 Operator 1.0 GA（2025 年 9 月）**——感知流式、Kubernetes 原生、通过 TestRun/PrivateLoadZone CRD 实现分布式，最适合用作 CI/CD 门禁；Vegeta 用于 Go 的恒定速率饱和测试；Locust 2.43.3 仅在搭配 LLM-Locust 扩展时才支持流式。负载模式：稳态（steady-state）、爬升（ramp）、尖峰（spike，用于自动扩缩容测试）、浸泡（soak，用于检测内存泄漏）。

**类型：** 构建
**语言：** Python（标准库，玩具级真实提示词生成器 + 延迟采集器）
**前置：** 阶段 17 · 08（推理指标）、阶段 17 · 03（GPU 自动扩缩容）
**时长：** 约 75 分钟

## 学习目标

- 解释让通用负载测试工具在 LLM API 上「撒谎」的两个反模式（GIL 陷阱、提示词同质化陷阱）。
- 针对特定目的选对工具：LLMPerf（基准压测）、k6 + 流式扩展（CI 门禁）、guidellm（大规模合成压测）、GenAI-Perf（NVIDIA 参考实现）。
- 设计四种负载模式（稳态、爬升、尖峰、浸泡），并说出每种模式各自能捕捉到的故障模式。
- 用输入 token 的均值 + 标准差来构建真实的提示词分布，而不是用固定长度。

## 问题所在

你用 k6 在 500 个并发用户下测了你的 LLM 端点，它扛住了，于是你上线了。可在生产环境里，仅仅 200 个真实用户就把服务压垮了——P99 的 TTFT 爆炸，GPU 被打满。

发生了两件事。第一，k6 发送的是 500 个完全相同的提示词——你的「请求合并（request coalescing）」和「前缀缓存（prefix caching）」让它看起来像是在处理 500 路并发解码，而实际上只在处理一路。第二，k6 并不会按人眼实际体验的方式去追踪流式响应的 token 间延迟；它看到的是一条 HTTP 连接，而不是以不同间隔陆续到达的 500 个 token。

对 LLM 做负载测试，本身就是一门独立的学问。

## 核心概念

### GIL 陷阱（Locust）

Locust 使用 Python，并在 GIL 下于客户端运行分词。在高并发下，分词器会排在请求生成之后排队。上报的 token 间延迟里夹带了客户端的分词积压。你以为是服务端慢，其实是测试框架慢。

修复方案：LLM-Locust 扩展把分词移到独立进程中，或者改用编译型语言的压测框架（k6、使用 tokenizers.rs 的 LLMPerf）。

### 提示词同质化陷阱

所有已知的负载测试工具都允许你配置一个提示词。在一个跑 10,000 次迭代的循环测试里，每次发送的都是同一个一模一样的提示词。服务端每次看到的都是相同前缀——前缀缓存命中率逼近 100%，吞吐看起来好极了。

修复方案：从提示词分布中采样。LLMPerf 使用 `--mean-input-tokens 500 --stddev-input-tokens 150`——长度多样、内容多样。

### 四种负载模式

1. **稳态（Steady-state）**——以恒定 RPS 持续 30-60 分钟。捕捉：基线性能回退。
2. **爬升（Ramp）**——在 15 分钟内将 RPS 从 0 线性增长到目标值。捕捉：容量临界点、预热阶段的异常。
3. **尖峰（Spike）**——突然将 RPS 拉到 3-10 倍，持续 2 分钟后回落。捕捉：自动扩缩容延迟、队列饱和、冷启动影响。
4. **浸泡（Soak）**——以稳态持续 4-8 小时。捕捉：内存泄漏、连接池漂移、可观测性数据溢出。

### 2026 年工具选型映射

**LLMPerf**（Anyscale）——基于 Python，但分词由 Rust 支撑。支持均值/标准差提示词。感知流式。性能压测的最佳默认选择。

**NVIDIA GenAI-Perf**——NVIDIA 的参考实现。使用 Triton 客户端；指标覆盖全面。注意它的 ITL 不含 TTFT，而 LLMPerf 的 ITL 包含 TTFT。对同一台服务器，这两个工具会得出不同的 TPOT。

**LLM-Locust**（TrueFoundry）——修复了 GIL 陷阱的 Locust 扩展。沿用熟悉的 Locust DSL + 流式指标。

**guidellm**——大规模合成基准压测。

**k6 v2026.1.0** + **k6 Operator 1.0 GA（2025 年 9 月）**：
- k6 本体（Go，编译型，无 GIL）新增了感知流式的指标。
- k6 Operator 使用 TestRun / PrivateLoadZone CRD 实现 Kubernetes 原生的分布式测试。
- 最适合用作 CI/CD 门禁与 SLA 测试。

**Vegeta**——Go 编写，比 k6 更简单。恒定速率的 HTTP 饱和测试。不感知 LLM，但适合做网关 / 限流测试。

**Locust 2.43.3 原版**——对 LLM 存在 GIL 陷阱。只有搭配 LLM-Locust 扩展才能用。

### CI 中的 SLA 门禁

在 PR 上运行 k6：

- 在基线 RPS 下各跑 30-50 次迭代。
- 门禁条件：P50/P95 的 TTFT、5xx 错误率 < 5%、TPOT 低于阈值。
- 一旦触发任一阈值就让构建失败。

### 真实的提示词分布

从真实流量样本（如果有的话）或从公开的分布中构建（例如聊天场景用 ShareGPT 提示词，代码场景用 HumanEval）。把均值 + 标准差喂给 LLMPerf。无论如何都要避免「循环里只用一个提示词」。

### 你应该记住的数字

- k6 Operator 1.0 GA：2025 年 9 月。
- k6 v2026.1.0：感知流式的指标。
- 典型的 LLMPerf 压测：在并发度 X 下跑 100-1000 个请求。
- 典型的 CI 门禁：每个 PR 跑 30-50 次迭代。
- 四种模式：稳态、爬升、尖峰、浸泡。

## 动手用

`code/main.py` 模拟一次带真实提示词分布的负载测试，测量有效 TPOT，并演示同质化提示词陷阱。

## 交付物

本课会产出 `outputs/skill-load-test-plan.md`。给定工作负载与 SLA，选定工具并设计这四种负载模式。

## 练习

1. 运行 `code/main.py`。对比同质化分布与真实分布——差距出在哪里？
2. 为 CI 门禁写出 k6 脚本：在 100 并发下 TTFT P95 < 800 ms，运行 5 分钟。
3. 你的浸泡测试显示内存每小时增长 50 MB。说出三种可能成因，以及用于在它们之间做出区分的埋点工具。
4. 把尖峰测试从 10 RPS 拉到 100 RPS。如果已经部署了 Karpenter + vLLM production-stack（阶段 17 · 03 + 18），预期的恢复时间是多少？
5. GenAI-Perf 报告 TPOT=6ms，LLMPerf 在同一台服务器上报告 TPOT=11ms。请解释原因。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|----------------|------------------------|
| LLMPerf | “LLM 压测框架” | Anyscale 的基准测试工具，感知流式 |
| GenAI-Perf | “NVIDIA 的工具” | NVIDIA 的参考压测框架 |
| LLM-Locust | “给 LLM 用的 Locust” | 修复了 GIL 陷阱的 Locust 扩展 |
| guidellm | “合成基准测试” | 大规模合成压测工具 |
| k6 Operator | “K8s 版 k6” | 基于 CRD 的分布式 k6 |
| GIL 陷阱 | “Python 客户端开销” | 分词积压虚增了上报的延迟 |
| 提示词同质化陷阱 | “单一提示词谎言” | 循环用同一提示词命中缓存，虚增吞吐 |
| 稳态 | “恒定负载” | 持续 N 分钟的平稳 RPS |
| 爬升 | “线性上升” | 在一段时长内从 0 升到目标值 |
| 尖峰 | “突发测试” | 突然倍增后回落 |
| 浸泡 | “长时测试” | 持续数小时以检测泄漏 |

## 延伸阅读

- [TianPan — Load Testing LLM Applications](https://tianpan.co/blog/2026-03-19-load-testing-llm-applications)
- [PremAI — Load Testing LLMs 2026](https://blog.premai.io/load-testing-llms-tools-metrics-realistic-traffic-simulation-2026/)
- [NVIDIA NIM — Introduction to LLM Inference Benchmarking](https://docs.nvidia.com/nim/large-language-models/1.0.0/benchmarking.html)
- [TrueFoundry — LLM-Locust](https://www.truefoundry.com/blog/llm-locust-a-tool-for-benchmarking-llm-performance)
- [LLMPerf](https://github.com/ray-project/llmperf)
- [k6 Operator](https://github.com/grafana/k6-operator)
