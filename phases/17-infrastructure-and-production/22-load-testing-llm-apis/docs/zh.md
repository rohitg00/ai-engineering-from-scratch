# 给 LLM API 做压测——为什么 k6 和 Locust 在骗你（Load Testing LLM APIs — Why k6 and Locust Lie）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 传统压测工具压根不是为流式响应、变长输出、token 级指标或 GPU 饱和度设计的。绝大多数团队会踩两个坑。**GIL trap**（GIL 陷阱）：Locust 把 token 级测量的 tokenization 跑在 Python GIL 下，高并发时它要和请求生成抢 GIL，tokenization 队列堆积进而把上报的 inter-token latency（token 间延迟）撑大——瓶颈在你客户端，不在服务器。**prompt-uniformity trap**（prompt 同质化陷阱）：循环里发同一条 prompt，等于只测了 token 分布上的一个点；真实流量是变长的、prefix 也各不相同。LLMPerf 的解法是 `--mean-input-tokens` + `--stddev-input-tokens`。2026 年的工具版图：LLM 专用类（GenAI-Perf、LLMPerf、LLM-Locust、guidellm）做 token 级精确测量；**k6 v2026.1.0** + **k6 Operator 1.0 GA（2025 年 9 月）**——支持流式指标、通过 TestRun / PrivateLoadZone CRD 做 Kubernetes 原生的分布式压测，最适合 CI/CD 卡口；Vegeta 用 Go 做恒定速率饱和压测；Locust 2.43.3 只有配上 LLM-Locust 扩展才能压流式接口。负载模式：steady-state（稳态）、ramp（爬坡）、spike（尖刺，测自动扩缩容）、soak（长跑，找内存泄漏）。

**Type:** Build
**Languages:** Python（标准库，玩具版的真实 prompt 生成器 + 延迟采集器）
**Prerequisites:** Phase 17 · 08（Inference Metrics）、Phase 17 · 03（GPU Autoscaling）
**Time:** ~75 分钟

## 学习目标（Learning Objectives）

- 讲清楚两个反模式（GIL trap、prompt-uniformity trap）为什么会让通用压测工具在 LLM API 上撒谎。
- 按目的选工具：LLMPerf（基准跑分）、k6 + 流式扩展（CI 卡口）、guidellm（大规模合成压测）、GenAI-Perf（NVIDIA 官方参考）。
- 设计四种负载模式（steady、ramp、spike、soak），并说出每种能抓到的故障形态。
- 用 input token 的均值 + 标准差去构造真实 prompt 分布，而不是定长 prompt。

## 问题（The Problem）

你用 k6 把 LLM 端点压到了 500 并发用户，扛住了，于是上线。生产环境实际只有 200 用户却挂了——P99 TTFT 炸穿、GPU 钉死。

发生了两件事。第一，k6 发的是 500 条一模一样的 prompt——你的请求合并和 prefix cache 让它看起来像在处理 500 个并发解码，实际上只在处理一个。第二，k6 在流式响应上根本没按用户体感的方式追踪 inter-token latency；它看到的是一条 HTTP 连接，而不是 500 个 token 在以不同间隔到达。

给 LLM 做压测，本身就是一门独立学科。

## 概念（The Concept）

### GIL 陷阱（The GIL trap，Locust）

Locust 是 Python 写的，tokenization 在客户端的 GIL 下跑。高并发时 tokenizer 排到请求生成后面，上报的 inter-token latency 里掺了客户端 tokenization 积压的时间。你以为服务器慢，其实是测试夹具慢。

修法：LLM-Locust 扩展把 tokenization 挪到独立进程；或者直接用编译型语言写的夹具（k6、用 tokenizers.rs 的 LLMPerf）。

### Prompt 同质化陷阱（The prompt-uniformity trap）

目前已知的所有压测工具都只让你配一条 prompt。一个 10,000 次迭代的 loop 测试里，每次都发完全相同的 prompt。服务器看到的 prefix 永远一样——prefix cache 命中率逼近 100%，吞吐看起来漂亮极了。

修法：从一个 prompt 分布里采样。LLMPerf 的写法是 `--mean-input-tokens 500 --stddev-input-tokens 150`——长度多样、内容多样。

### 四种负载模式（Four load patterns）

1. **Steady-state（稳态）**——恒定 RPS 跑 30-60 分钟。能抓到：基线性能回归。
2. **Ramp（爬坡）**——15 分钟内把 RPS 从 0 线性拉到目标。能抓到：容量拐点、warm-up 异常。
3. **Spike（尖刺）**——突然把 RPS 拉高 3-10 倍，2 分钟后回落。能抓到：自动扩缩容延迟、队列饱和、冷启动影响。
4. **Soak（长跑）**——稳态跑 4-8 小时。能抓到：内存泄漏、连接池漂移、可观测性溢出。

### 2026 年工具版图（2026 tool mapping）

**LLMPerf**（Anyscale）——Python 写但 tokenization 由 Rust 撑着。支持 mean/stddev prompt。流式感知。性能跑分的最佳默认选项。

**NVIDIA GenAI-Perf**——NVIDIA 官方参考。基于 Triton client，指标覆盖全。注意它的 ITL 不含 TTFT；LLMPerf 的 ITL 是含 TTFT 的。两个工具在同一个服务器上算出的 TPOT 会不一样。

**LLM-Locust**（TrueFoundry）——Locust 扩展，修掉了 GIL trap。熟悉的 Locust DSL + 流式指标。

**guidellm**——大规模合成基准测试。

**k6 v2026.1.0** + **k6 Operator 1.0 GA（2025 年 9 月）**：
- k6 本身（Go 写的、编译型、没有 GIL）加入了流式感知指标。
- k6 Operator 用 TestRun / PrivateLoadZone CRD 做 Kubernetes 原生的分布式压测。
- 最适合 CI/CD 卡口和 SLA 测试。

**Vegeta**——Go 写的，比 k6 简单。恒定速率的 HTTP 饱和压测。不感知 LLM，但适合压网关 / 限流。

**Locust 2.43.3 原版**——压 LLM 时有 GIL trap。只在配 LLM-Locust 扩展时能用。

### CI 里的 SLA 卡口（SLA gate in CI）

每个 PR 跑一次 k6，配置：

- 在基线 RPS 下每条跑 30-50 次迭代。
- 卡口：P50/P95 TTFT、5xx < 5%、TPOT 在阈值以内。
- 越线就 break 构建。

### 真实 prompt 分布（Realistic prompt distribution）

从真实流量样本（如果你有）或公开分布（比如聊天用 ShareGPT prompts、代码用 HumanEval）里构造。把 mean + stddev 喂给 LLMPerf。**绝对不要**用单条 prompt 循环这一招。

### 该背的几个数（Numbers you should remember）

- k6 Operator 1.0 GA：2025 年 9 月。
- k6 v2026.1.0：流式感知指标。
- 典型 LLMPerf 跑分：并发 X 下 100-1000 个请求。
- 典型 CI 卡口：每 PR 30-50 次迭代。
- 四种模式：steady、ramp、spike、soak。

## 用起来（Use It）

`code/main.py` 模拟一次带真实 prompt 分布的压测，测量有效 TPOT，并演示 prompt 同质化陷阱。

## 上线部署（Ship It）

本课产出 `outputs/skill-load-test-plan.md`。给定 workload 和 SLA，挑工具并设计四种负载模式。

## 练习（Exercises）

1. 跑一下 `code/main.py`。比较 uniform 与真实分布两种情况——差距在哪？
2. 写一个用作 CI 卡口的 k6 脚本：100 并发下 TTFT P95 < 800 ms，跑 5 分钟。
3. 你的 soak 测试显示内存以每小时 50 MB 增长。说出三个可能原因，以及用什么仪表来区分它们。
4. Spike 测试从 10 RPS 拉到 100 RPS。如果 Karpenter + vLLM production-stack 都到位（Phase 17 · 03 + 18），预期恢复时间是多少？
5. 同一个服务器上，GenAI-Perf 报 TPOT=6ms，LLMPerf 报 TPOT=11ms。解释一下。

## 关键术语（Key Terms）

| Term | 大家嘴上怎么说 | 它实际是什么 |
|------|----------------|------------------------|
| LLMPerf | "那个 LLM 夹具" | Anyscale 出的基准工具，流式感知 |
| GenAI-Perf | "NVIDIA 的工具" | NVIDIA 官方参考夹具 |
| LLM-Locust | "LLM 版的 Locust" | 修了 GIL trap 的 Locust 扩展 |
| guidellm | "合成基准" | 大规模合成压测工具 |
| k6 Operator | "K8s 上的 k6" | 基于 CRD 的分布式 k6 |
| GIL trap | "Python 客户端开销" | tokenization 积压把上报延迟撑大 |
| Prompt-uniformity trap | "单条 prompt 谎言" | 循环用同一条 prompt 命中缓存，把吞吐撑大 |
| Steady-state | "恒定负载" | RPS 在 N 分钟里持平 |
| Ramp | "线性爬坡" | 在给定时长内从 0 拉到目标 |
| Spike | "突发测试" | 突然倍数拉高，再回落 |
| Soak | "长跑测试" | 跑数小时找泄漏 |

## 延伸阅读（Further Reading）

- [TianPan — Load Testing LLM Applications](https://tianpan.co/blog/2026-03-19-load-testing-llm-applications)
- [PremAI — Load Testing LLMs 2026](https://blog.premai.io/load-testing-llms-tools-metrics-realistic-traffic-simulation-2026/)
- [NVIDIA NIM — Introduction to LLM Inference Benchmarking](https://docs.nvidia.com/nim/large-language-models/1.0.0/benchmarking.html)
- [TrueFoundry — LLM-Locust](https://www.truefoundry.com/blog/llm-locust-a-tool-for-benchmarking-llm-performance)
- [LLMPerf](https://github.com/ray-project/llmperf)
- [k6 Operator](https://github.com/grafana/k6-operator)
