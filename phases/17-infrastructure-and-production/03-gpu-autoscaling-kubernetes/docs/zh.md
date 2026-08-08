# 03 · Kubernetes 上的 GPU 自动扩缩容——Karpenter、KAI Scheduler 与成组调度

> 是三层，而非一层。「Karpenter」动态供给节点（一分钟以内，比 Cluster Autoscaler 快 40%）。「KAI Scheduler」负责「成组调度（gang scheduling）」、拓扑感知和层级队列——它能避免「8 选 7 的部分分配陷阱」，即七个节点为了等待一块缺失的 GPU 而空转烧钱。应用层自动扩缩器（NVIDIA Dynamo Planner、llm-d Workload Variant Autoscaler）基于推理特有的信号——队列深度、KV 缓存利用率——而非 CPU/DCGM 占空比来扩缩。经典的 HPA 陷阱在于：`DCGM_FI_DEV_GPU_UTIL` 是一种「占空比（duty cycle）」测量值，100% 可能代表 10 个请求，也可能代表 100 个。vLLM 会预分配 KV 缓存内存，因此内存指标永远不会触发缩容。本课教你如何组合这三层，并避开会在推理过程中终止正在运行的 GPU 任务的 Karpenter 默认 `WhenEmptyOrUnderutilized` 策略。

**类型：** 学习
**语言：** Python（标准库，玩具级队列深度自动扩缩器模拟器）
**前置：** 第 17 阶段 · 02（推理平台经济学）、第 17 阶段 · 04（vLLM 服务内部机制）
**时长：** 约 75 分钟

## 学习目标

- 画出三层自动扩缩容架构（节点供给、成组调度、应用层），并说出每一层所用的工具。
- 解释为什么 `DCGM_FI_DEV_GPU_UTIL` 对 vLLM 而言是错误的 HPA 信号，并说出两个替代信号（队列深度、KV 缓存利用率）。
- 描述成组调度，以及 KAI Scheduler 所防范的部分分配失效模式（8 块 GPU 中有 7 块空闲）。
- 说出会终止正在运行的 GPU 任务的 Karpenter 合并策略（`WhenEmptyOrUnderutilized`），并给出 2026 年的安全替代方案。

## 问题所在

你的团队在 Kubernetes 上交付了一个 LLM 服务。你用 `DCGM_FI_DEV_GPU_UTIL` 作为信号配置了 HPA。该服务在工作时段利用率钉死在 100%。HPA 从不扩容——它已经认为你满载了。你手动加了一个副本，TTFT 下降。HPA 依然不扩容。这个信号在骗你。

另外，你用 Cluster Autoscaler 来管理节点。凌晨 2 点来了一个 100 万 token 的提示词；集群花了 3 分钟供给一个节点，请求超时了。

再另外，你部署了一个需要跨 2 个节点、共 8 块 GPU 的 70B 模型。集群里有 7 块空闲 GPU，还有 1 块分散在 3 个节点上。Cluster Autoscaler 为那 1 块缺失的 GPU 供给一个节点。七个节点在 Kubernetes 把最后一块 GPU 拉起来的 4 分钟里空等、烧钱。

三层，三种不同的失效模式。2026 年的 GPU 感知自动扩缩容不是「打开 HPA」那么简单，而是把节点供给、成组调度和应用信号扩缩容组合起来。

## 核心概念

### 第 1 层——节点供给（Karpenter）

Karpenter 监视处于 Pending 状态的 Pod，并在约 45-60 秒内供给节点（GPU 节点上 Cluster Autoscaler 通常需要 90-120 秒）。它按照 `NodePool` 约束动态挑选实例类型——如果你的 Pod 需要 8 块 H100 而集群没有匹配的节点，Karpenter 会直接供给一个，而不是去扩容某个已有的组。

**合并陷阱**：Karpenter 默认的 `consolidationPolicy: WhenEmptyOrUnderutilized` 对 GPU 资源池而言很危险。它会终止一个正在运行的 GPU 节点，以便把 Pod 迁移到更便宜、规格更贴合的实例上。对推理负载来说，这意味着驱逐正在运行的请求，并在新节点上重新加载一个 70B 模型。损失是数分钟的算力，外加请求失败。

GPU 资源池的安全设置：

```yaml
disruption:
  consolidationPolicy: WhenEmpty
  consolidateAfter: 1h
```

它允许 Karpenter 在一小时后合并真正为空的节点，但绝不会驱逐正在运行的任务。

### 第 2 层——成组调度（KAI Scheduler）

KAI Scheduler（项目最初名为 "Karp"，后改名）处理默认 kube-scheduler 不处理的事情：

**成组调度**——全有或全无地调度。一个需要 8 块 GPU 的分布式推理 Pod，要么 8 块一起启动，要么一块都不启动。没有它，你就会遇到部分分配陷阱：8 个 Pod 中启动了 7 个，无限期等待，烧钱。

**拓扑感知**——知道哪些 GPU 共享 NVLink、哪些位于同一机架、哪些之间有 InfiniBand。据此放置 Pod。一个 DeepSeek-V3 67B 的张量并行负载必须留在同一个 NVLink 域内；KAI Scheduler 会尊重这一点。

**层级队列**——多个团队按优先级与配额竞争同一个 GPU 资源池。只有当优先级规则允许时，B 团队的训练任务才能抢占 A 团队的生产高峰负载。

KAI 作为辅助调度器与 kube-scheduler 并行部署；你通过注解（annotate）让负载使用它。Ray 和 vLLM production-stack 都已集成。

### 第 3 层——应用层信号

**HPA 陷阱**：`DCGM_FI_DEV_GPU_UTIL` 是一个占空比指标——它测量的是在每个采样间隔内 GPU 是否在干活。100% 利用率可能意味着 10 个并发请求，也可能是 100 个；不管哪种，GPU 都很忙。基于占空比扩缩就是盲目扩缩。

更糟的是，vLLM 及类似引擎会预分配 KV 缓存内存（最高到 `--gpu-memory-utilization`）。即使只有一个请求，内存占用也维持在 90% 上下。基于内存的 HPA 永远不会缩容。

**2026 年的替代信号**：

- 队列深度（等待 prefill 的请求数量）。
- KV 缓存利用率（有多少比例的块被分配给了活跃序列）。
- 单副本 P99 TTFT（你的 SLA 信号）。
- Goodput（每秒满足全部 SLO 的请求数）。

NVIDIA Dynamo Planner 和 llm-d Workload Variant Autoscaler 消费这些信号并扩缩副本。在 LLM 服务场景下，它们完全取代了 HPA。

### 何时用什么

| 扩缩决策 | 工具 |
|----------------|------|
| 增减节点 | Karpenter |
| 调度多 GPU 任务 | KAI Scheduler |
| 增减副本 | Dynamo Planner / llm-d WVA（或基于队列深度的自定义 HPA） |
| 选择 GPU 类型 | Karpenter NodePool |
| 抢占低优先级任务 | KAI Scheduler 队列 |

### 分离式 prefill/decode 让一切更复杂

如果你运行分离式 prefill/decode（第 17 阶段 · 17），你就有了两类 Pod，各自有不同的扩缩触发条件：prefill Pod 按队列深度扩缩，decode Pod 按 KV 缓存压力扩缩。llm-d 把它们暴露为独立的 `Services`，并为每个角色配备各自的 HPA。不要试图在两者前面套一个统一的 HPA。

### 冷启动在这里同样重要

冷启动缓解（第 17 阶段 · 10）正是节点供给时间对用户变得可见的地方。Karpenter 的 45-60 秒预热，加上 20GB 模型加载，再加上引擎初始化，意味着一个从零开始的请求要耗时 2-5 分钟。为 SLO 关键路径保留一个热池（`min_workers=1`），或在应用层使用 Modal 式的检查点（checkpointing）。

### 你应该记住的数字

- Karpenter 节点供给：约 45-60 秒，对比 Cluster Autoscaler 约 90-120 秒（GPU 节点）。
- KAI Scheduler 避免部分分配浪费——8 选 7 陷阱。
- `DCGM_FI_DEV_GPU_UTIL` 作为 HPA 信号：是坏的；改用队列深度或 KV 利用率。
- Karpenter `WhenEmptyOrUnderutilized`：会终止正在运行的 GPU 任务。推理场景请用 `WhenEmpty + consolidateAfter: 1h`。

## 动手用

`code/main.py` 在一个突发性 GPU 负载上模拟一个三层自动扩缩器。它对比朴素 HPA（占空比）、队列深度 HPA 和 KAI 成组调度扩缩。报告未满足的请求数、空闲 GPU 分钟数，以及一个综合评分。

## 交付它

本课产出 `outputs/skill-gpu-autoscaler-plan.md`。给定集群拓扑、负载形态和 SLO，它会设计出一套三层自动扩缩容方案。

## 练习

1. 运行 `code/main.py`。在突发负载下，朴素占空比 HPA 会丢弃多少个被队列深度 HPA 接住的请求？这一差异从何而来？
2. 为一个在 H100 SXM5 上服务 Llama 3.3 70B FP8 的集群设计一个 Karpenter NodePool。指定 `capacity-type`、`disruption.consolidationPolicy`、`consolidateAfter`，以及一个让非 GPU 负载远离这些节点的 taint。
3. 你的团队报告说部署卡在 Pending，因为「有可用 GPU 但 Pod 不调度」。诊断一下——这是 Karpenter、kube-scheduler 还是 KAI Scheduler 的问题？哪些指标可以确认？
4. 为分离式 prefill Pod 挑一个扩缩信号，再为 decode Pod 挑一个不同的信号。为两者给出理由。
5. 计算 `WhenEmptyOrUnderutilized` 合并陷阱在一个 7×24 生产服务上的成本，该服务平均每天发生 60 次在 P99 TTFT > 10 秒时丢弃请求的事件。

## 关键术语

| 术语 | 人们口中的说法 | 实际含义 |
|------|----------------|------------------------|
| Karpenter | 「节点供给器」 | Kubernetes 节点自动扩缩器；亚分钟级供给 |
| Cluster Autoscaler | 「老式扩缩器」 | Kubernetes 节点自动扩缩器的前身；更慢，基于组 |
| KAI Scheduler | 「GPU 调度器」 | 用于成组 + 拓扑 + 队列的辅助调度器 |
| Gang scheduling（成组调度） | 「全有或全无」 | 原子化地调度 N 个 Pod，否则全部推迟 |
| Topology awareness（拓扑感知） | 「机架感知」 | 基于 NVLink/IB/机架位置放置 Pod |
| `DCGM_FI_DEV_GPU_UTIL` | 「GPU 利用率」 | 占空比指标；对 LLM 而言不是扩缩信号 |
| Queue depth（队列深度） | 「等待中的请求」 | 适用于 prefill 受限扩缩的正确 HPA 信号 |
| KV cache utilization（KV 缓存利用率） | 「内存压力」 | 适用于 decode 受限扩缩的正确 HPA 信号 |
| Consolidation（合并） | 「Karpenter 合并」 | 为换用更便宜实例类型而终止节点 |
| `WhenEmpty + 1h` | 「安全合并」 | 不会驱逐正在运行的 GPU 任务的策略 |

## 延伸阅读

- [KAI Scheduler GitHub](https://github.com/kai-scheduler/KAI-Scheduler) —— 设计文档与配置示例。
- [Karpenter Disruption Controls](https://karpenter.sh/docs/concepts/disruption/) —— 合并策略语义与 GPU 安全默认值。
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/) —— Dynamo Planner 扩缩信号。
- [Ray docs — KAI Scheduler for RayClusters](https://docs.ray.io/en/latest/cluster/kubernetes/k8s-ecosystem/kai-scheduler.html) —— Ray 集成模式。
- [AWS EKS Compute and Autoscaling Best Practices](https://docs.aws.amazon.com/eks/latest/best-practices/aiml-compute.html) —— 托管 Kubernetes 特定指南。
- [llm-d GitHub](https://github.com/llm-d/llm-d) —— Workload Variant Autoscaler 设计。
