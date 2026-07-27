# LLM API 负载测试——为什么 k6 和 Locust 会骗你

> 传统的负载测试工具并非为流式响应、可变输出长度、Token 级别指标或 GPU 饱和而设计。两个陷阱会坑掉大多数团队。**GIL 陷阱**：Locust 的 Token 级别测量在 Python GIL 下运行 token 化操作，在高并发下与请求生成竞争资源；token 化积压会人为抬高报文的 Token 间延迟——瓶颈在客户端，而非服务端。**提示词单一性陷阱**：循环中使用相同的提示词只测试 Token 分布上的一个点；真实流量具有可变长度和多样的前缀匹配。LLMPerf 通过 `--mean-input-tokens` + `--stddev-input-tokens` 解决了这个问题。2026 年的工具映射：LLM 专用工具（GenAI-Perf、LLMPerf、LLM-Locust、guidellm）用于 Token 级别精度；**k6 v2026.1.0** + **k6 Operator 1.0 GA（2025 年 9 月）**——支持流感知、通过 TestRun/PrivateLoadZone CRD 实现 Kubernetes 原生分布式测试，最适合 CI/CD 门禁；Vegeta 用于 Go 恒定速率饱和测试；Locust 2.43.3 仅配合 LLM-Locust 扩展支持流式测试。负载模式：稳态、斜坡、突发（自动扩缩容测试）、长时（内存泄漏测试）。

**类型：** 构建
**语言：** Python（标准库，简易逼真提示词生成器 + 延迟收集器）
**前置条件：** 阶段 17 · 08（推理指标），阶段 17 · 03（GPU 自动扩缩容）
**时间：** ~75 分钟

## 学习目标

- 解释使通用负载测试工具对 LLM API 产生误导的两个反模式（GIL 陷阱、提示词单一性陷阱）。
- 根据用途选择合适的工具：LLMPerf（基准测试）、k6 + 流式扩展（CI 门禁）、guidellm（大规模合成测试）、GenAI-Perf（NVIDIA 参考工具）。
- 设计四种负载模式（稳态、斜坡、突发、长时）并说明每种模式能捕获何种故障。
- 使用输入 Token 的均值 + 标准差而非固定长度构建逼真的提示词分布。

## 问题

你用 k6 测试了你的 LLM 端点，500 个并发用户。系统撑住了。你发布了。但在生产中，实际只有 200 个用户时服务就崩溃了——P99 TTFT 飙升，GPU 打满。

发生了两件事。首先，k6 发送了 500 个完全相同的提示词——你的请求合并和前缀缓存使你看起来在处理 500 个并发解码，实际你只处理了一个。其次，k6 不会像人眼感受到的那样追踪流式响应上的 Token 间延迟；它看到的是一个 HTTP 连接，而不是 500 个以不同间隔到达的 Token。

LLM 的负载测试是一门独立的学科。

## 概念

### GIL 陷阱（Locust）

Locust 使用 Python，在 GIL 下进行客户端侧 token 化。在高并发下，token 化器会在请求生成之后排队。报告的 Token 间延迟包含了客户端侧的 token 化积压。你以为服务端慢，其实是测试工具本身的问题。

**修复：** LLM-Locust 扩展将 token 化移至独立进程，或使用编译语言编写的测试工具（k6、使用 tokenizers.rs 的 LLMPerf）。

### 提示词单一性陷阱

所有常见的负载测试工具都允许配置一个提示词。在 10,000 次迭代的循环测试中，每次发送的提示词完全相同。服务端每次都看到相同的前缀——前缀缓存命中率接近 100%，吞吐量看起来很棒。

**修复：** 从提示词分布中采样。LLMPerf 使用 `--mean-input-tokens 500 --stddev-input-tokens 150`——多样化的长度，多样化的内容。

### 四种负载模式

1. **稳态（Steady-state）**——恒定 RPS 持续 30-60 分钟。捕获：基准性能回归。
2. **斜坡（Ramp）**——RPS 从 0 线性增加到目标值，持续 15 分钟。捕获：容量拐点、预热异常。
3. **突发（Spike）**——RPS 突然提升 3-10 倍持续 2 分钟，然后恢复。捕获：自动扩缩容延迟、队列饱和、冷启动影响。
4. **长时（Soak）**——稳态持续 4-8 小时。捕获：内存泄漏、连接池漂移、可观测性溢出。

### 2026 年工具映射

**LLMPerf**（Anyscale）——Python 但基于 Rust 的 token 化。支持均值/标准差提示词。流感知。性能测试的最佳默认选择。

**NVIDIA GenAI-Perf**——NVIDIA 的参考工具。使用 Triton 客户端；指标覆盖全面。注意其 ITL 不包含 TTFT；LLMPerf 的包含。两台工具对同一服务器可能报告不同的 TPOT。

**LLM-Locust**（TrueFoundry）——修复 GIL 陷阱的 Locust 扩展。熟悉的 Locust DSL + 流式指标。

**guidellm**——大规模合成基准测试工具。

**k6 v2026.1.0** + **k6 Operator 1.0 GA（2025 年 9 月）**：
- k6 本身（Go，编译型，无 GIL）新增了流感知指标。
- k6 Operator 使用 TestRun / PrivateLoadZone CRD 实现 Kubernetes 原生分布式测试。
- 最适合 CI/CD 门禁和 SLA 测试。

**Vegeta**——Go 语言，比 k6 更简单。恒定速率 HTTP 饱和。不感知 LLM，但适合网关/限速测试。

**Locust 2.43.3 原生**——对 LLM 存在 GIL 陷阱。仅配合 LLM-Locust 扩展使用。

### CI 中的 SLA 门禁

在 PR 上运行 k6：

- 在基准 RPS 下执行 30-50 次迭代。
- 门禁条件：P50/P95 TTFT，5xx < 5%，TPOT 低于阈值。
- 超出即中断构建。

### 逼真的提示词分布

从真实流量样本（如果有）或已发布的分布（例如聊天用 ShareGPT 提示词、代码用 HumanEval）构建。将均值 + 标准差输入 LLMPerf。无论如何都要避免单一提示词循环。

### 你应该记住的数字

- k6 Operator 1.0 GA：2025 年 9 月。
- k6 v2026.1.0：流感知指标。
- 典型 LLMPerf 运行：在并发度 X 下执行 100-1000 次请求。
- 典型 CI 门禁：每个 PR 执行 30-50 次迭代。
- 四种模式：稳态、斜坡、突发、长时。

## 使用

`code/main.py` 模拟了具有逼真提示词分布的负载测试，测量有效的 TPOT，并演示了单一提示词陷阱。

## 交付

本课产出 `outputs/skill-load-test-plan.md`。根据工作负载和 SLA 选择工具，并设计四种负载模式。

## 练习

1. 运行 `code/main.py`。比较单一分布与逼真分布——差距在哪里？
2. 编写 CI 门禁的 k6 脚本：TTFT P95 < 800 ms，100 并发，运行时间 5 分钟。
3. 你的长时测试显示内存以 50 MB/小时增长。列举三种原因以及区分它们的检测手段。
4. 突发测试从 10 RPS 升至 100 RPS。如果已部署 Karpenter + vLLM 生产栈（阶段 17 · 03 + 18），预期的恢复时间是多少？
5. 在同一服务器上，GenAI-Perf 报告 TPOT=6ms，LLMPerf 报告 TPOT=11ms。解释原因。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|---------|---------|
| LLMPerf | "LLM 测试工具" | Anyscale 基准测试工具，流感知 |
| GenAI-Perf | "NVIDIA 工具" | NVIDIA 参考工具 |
| LLM-Locust | "用于 LLM 的 Locust" | 修复 GIL 陷阱的 Locust 扩展 |
| guidellm | "合成基准测试" | 大规模合成测试工具 |
| k6 Operator | "K8s k6" | 基于 CRD 的分布式 k6 |
| GIL 陷阱 | "Python 客户端开销" | Token 化积压虚增报告延迟 |
| 提示词单一性陷阱 | "单一提示词的谎言" | 相同提示词循环命中缓存，虚增吞吐量 |
| 稳态 | "恒定负载" | 固定 RPS 持续 N 分钟 |
| 斜坡 | "线性上升" | 从 0 到目标值随时间线性增长 |
| 突发 | "突发测试" | 突然倍增后恢复 |
| 长时 | "长时间测试" | 数小时运行以检测泄漏 |

## 延伸阅读

- [TianPan — 负载测试 LLM 应用](https://tianpan.co/blog/2026-03-19-load-testing-llm-applications)
- [PremAI — 2026 年 LLM 负载测试](https://blog.premai.io/load-testing-llms-tools-metrics-realistic-traffic-simulation-2026/)
- [NVIDIA NIM — LLM 推理基准测试简介](https://docs.nvidia.com/nim/large-language-models/1.0.0/benchmarking.html)
- [TrueFoundry — LLM-Locust](https://www.truefoundry.com/blog/llm-locust-a-tool-for-benchmarking-llm-performance)
- [LLMPerf](https://github.com/ray-project/llmperf)
- [k6 Operator](https://github.com/grafana/k6-operator)
