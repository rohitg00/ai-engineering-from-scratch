# Kubernetes 上的 GPU 自动扩缩 — Karpenter、KAI Scheduler、Gang 调度

> 三层，而非一层。Karpenter 动态预配节点(不到一分钟,比 Cluster Autoscaler 快 40%)。KAI Scheduler 负责 gang 调度、拓扑感知和层级队列 — 它能避免"8 个里启动 7 个"的部分分配陷阱：七个节点因缺少一块 GPU 而空等并烧钱。应用级自动扩缩器(NVIDIA Dynamo Planner、llm-d Workload Variant Autoscaler)基于推理专用信号扩缩 — 队列深度、KV cache 利用率 — 而非 CPU/DCGMT 占空比。经典 HPA 陷阱在于 `DCGM_FI_DEV_GPU_UTIL` 是一个占空比测量：100% 可能对应 10 个请求，也可能对应 100 个。vLLM 会预分配 KV cache 内存，因此内存永远不会触发缩容。本课教你组合这三层，并避开 Karpenter 默认的 `WhenEmptyOrUnderutilized` 策略 — 该策略会在推理中途终止正在运行的 GPU 任务。

**Type:** Learn
**Languages:** Python(标准库，玩具级队列深度自动扩缩器模拟器)
**Prerequisites:** Phase 17 · 02(Inference Platform Economics)、Phase 17 · 04(Serving Engine Internals)
**Time:** 约 75 分钟

## 学习目标

- 画出三层自动扩缩(节点预配、gang 调度、应用级)的示意图，并说出每层使用的工具。
- 解释为什么 `DCGM_FI_DEV_GPU_UTIL` 是 vLLM 错误的 HPA 信号，并说出两个替代信号(队列深度、KV cache 利用率)。
- 描述 gang 调度以及 KAI Scheduler 所防止的部分分配失败模式(8 块 GPU 中 7 块空闲)。
- 说出会终止运行中 GPU 任务的 Karpenter 整合策略(`WhenEmptyOrUnderutilized`),并给出 2026 年的安全替代方案。

## 问题

你的团队在 Kubernetes 上部署了一个 LLM 推理服务。你设置了以 `DCGM_FI_DEV_GPU_UTIL` 为信号的 HPA。该服务在工作时间利用率稳定在 100%。HPA 从不扩容 — 它已经认为你满载了。你手动加了一个副本；TTFT 下降。HPA 依然不扩容。这个信号在骗你。

另一方面，你用 Cluster Autoscaler 管理节点。凌晨 2 点来了一个 100 万 token 的提示；集群花了 3 分钟预配节点，请求超时。

再另一方面，你部署了一个需要跨 2 个节点使用 8 块 GPU 的 70B 模型。集群有 7 块 GPU 空闲，但分散在 3 个节点上。Cluster Autoscaler 为缺失的那 1 块 GPU 预配了一个节点。七个节点等了 4 分钟烧钱，直到 Kubernetes 把最后一块 GPU 拉起来。

三层，三种不同的失败模式。2026 年的 GPU 感知自动扩缩不是"打开 HPA"那么简单。它是节点预配、gang 调度和应用信号扩缩的组合。

## 概念

### 第 1 层 — 节点预配(Karpenter)

Karpenter 监听 pending 状态的 pod,并在约 45-60 秒内预配节点(Cluster Autoscaler 对 GPU 节点通常需要 90-120 秒)。它根据 `NodePool` 约束动态选择实例类型 — 如果你的 pod 需要 8 块 H100 而集群中没有匹配的节点，Karpenter 会直接预配一个，而不是扩容现有组。

**整合陷阱**：Karpenter 默认的 `consolidationPolicy: WhenEmptyOrUnderutilized` 对 GPU 节点池是危险的。它会终止一个正在运行的 GPU 节点，把 pod 迁移到更便宜的、规格更合适的实例。对推理工作负载而言，这意味着驱逐正在处理的请求，并在新节点上重新加载 70B 模型。损失是数分钟容量加上请求失败。

GPU 节点池的安全配置：

```yaml
disruption:
  consolidationPolicy: WhenEmpty
  consolidateAfter: 1h
```

这允许 Karpenter 在一小时后整合真正空置的节点，但绝不驱逐正在运行的任务。

### 第 2 层 — gang 调度(KAI Scheduler)

KAI Scheduler(项目原名 "Karp",后更名)处理默认 kube-scheduler 无法处理的事情：

**Gang 调度** — 要么全部调度，要么全不调度。一个需要 8 块 GPU 的分布式推理 pod,要么 8 个一起启动，要么都不启动。没有它，你会陷入部分分配陷阱：8 个 pod 中 7 个启动，无限期等待，烧钱。

**拓扑感知** — 知道哪些 GPU 共享 NVLink,哪些在同一个机架上，哪些之间有 InfiniBand。据此放置 pod。DeepSeek-V3 67B 的张量并行工作负载必须留在同一个 NVLink 域内；KAI Scheduler 会遵守这一点。

**层级队列** — 多个团队以优先级和配额竞争同一个 GPU 资源池。只有当优先级规则允许时，团队 A 的生产紧急任务才会被团队 B 的训练任务抢占。

KAI 作为二级调度器与 kube-scheduler 并行部署；你通过注解让工作负载使用它。Ray 和 vLLM production-stack 均已集成。

### 第 3 层 — 应用级信号

**HPA 陷阱**:`DCGM_FI_DEV_GPU_UTIL` 是一个占空比指标 — 它测量 GPU 在每个采样间隔是否在做功。100% 利用率可能意味着 10 个并发请求，也可能意味着 100 个；无论哪种情况 GPU 都在忙。基于占空比扩缩就是盲目扩缩。

更糟的是，vLLM 及类似引擎会预分配 KV cache 内存(最高达 `--gpu-memory-utilization`)。即使只有一个请求，内存占用也接近 90%。基于内存的 HPA 永远不会缩容。

**2026 年的替代信号**：

- 队列深度(等待 prefill 的请求数)。
- KV cache 利用率(分配给活跃序列的块比例)。
- 每副本 P99 TTFT(你的 SLA 信号)。
- Goodput(每秒满足所有 SLO 的请求数)。

NVIDIA Dynamo Planner 和 llm-d Workload Variant Autoscaler 消费这些信号并扩缩副本。对 LLM 推理而言，它们完全取代了 HPA。

### 何时用什么

| 扩缩决策 | 工具 |
|----------------|------|
| 增加/删除节点 | Karpenter |
| 调度多 GPU 任务 | KAI Scheduler |
| 增加/删除副本 | Dynamo Planner / llm-d WVA(或基于队列深度的自定义 HPA) |
| 选择 GPU 类型 | Karpenter NodePool |
| 抢占低优先级任务 | KAI Scheduler 队列 |

### 分离式 prefill/decode 让一切更复杂

如果你运行分离式 prefill/decode(Phase 17 · 17),你会拥有两类扩缩触发条件不同的 pod:prefill pod 按队列深度扩缩，decode pod 按 KV cache 压力扩缩。llm-d 将它们暴露为独立的 `Services`,并支持按角色的 HPA。不要试图用一个 HPA 同时管理两者。

### 冷启动在这里同样重要

冷启动缓解(Phase 17 · 10)是节点预配时间变得用户可见的地方。Karpenter 的 45-60 秒预热，加上 20GB 模型加载，加上引擎初始化，意味着从零开始的请求需要 2-5 分钟。对 SLO 关键路径保留预热池(`min_workers=1`),或在应用层使用 Modal 风格的检查点。

### 你应该记住的数字

- Karpenter 节点预配：约 45-60 秒，而 Cluster Autoscaler 约 90-120 秒(GPU 节点)。
- KAI Scheduler 防止部分分配浪费 — 8 个里卡 7 个的陷阱。
- `DCGM_FI_DEV_GPU_UTIL` 作为 HPA 信号：不可用；应使用队列深度或 KV 利用率。
- Karpenter 的 `WhenEmptyOrUnderutilized`:会终止运行中的 GPU 任务。推理场景请使用 `WhenEmpty + consolidateAfter: 1h`。

```figure
autoscaling
```

## 动手用

`code/main.py` 在突发的 GPU 工作负载上模拟三层自动扩缩器。对比朴素 HPA(占空比)、队列深度 HPA 和 KAI gang 调度扩缩。报告未满足的请求数、GPU 空闲分钟数，以及一个综合评分。

## 上线

本课产出 `outputs/skill-gpu-autoscaler-plan.md`。给定集群拓扑、工作负载形态和 SLO,它会设计一个三层自动扩缩方案。

## 练习

1. 运行 `code/main.py`。在突发工作负载下，朴素的占空比 HPA 会丢掉多少队列深度 HPA 能接住的请求？差异来自哪里？
2. 为一个在 H100 SXM5 上服务 Llama 3.3 70B FP8 的集群设计 Karpenter NodePool。指定 `capacity-type`、`disruption.consolidationPolicy`、`consolidateAfter`,以及一条防止非 GPU 工作负载落到这些节点上的 taint。
3. 你的团队报告部署一直卡在 Pending,原因是"GPU 有空闲但 pod 调度不上"。诊断一下 — 这是 Karpenter、kube-scheduler 还是 KAI Scheduler 的问题？哪些指标可以确认？
4. 为分离式 prefill pod 选择一个自动扩缩信号，为 decode pod 选择另一个不同的信号。分别说明理由。
5. 计算一个全天候生产服务中 `WhenEmptyOrUnderutilized` 整合陷阱的成本：平均每天 60 次丢请求事件，P99 TTFT > 10 秒。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| Karpenter | "节点预配器" | Kubernetes 节点自动扩缩器；一分钟内完成预配 |
| Cluster Autoscaler | "老牌扩缩器" | Kubernetes 节点自动扩缩器前身；更慢、基于节点组 |
| KAI Scheduler | "GPU 调度器" | 提供 gang + 拓扑 + 队列的二级调度器 |
| Gang 调度 | "要么全有要么全无" | 原子性地调度 N 个 pod,或全部推迟 |
| 拓扑感知 | "机架感知" | 基于 NVLink/IB/机架位置放置 pod |
| `DCGM_FI_DEV_GPU_UTIL` | "GPU 利用率" | 占空比指标；不是 LLM 的扩缩信号 |
| 队列深度 | "等待中的请求" | prefill 瓶颈扩缩的正确 HPA 信号 |
| KV cache 利用率 | "内存压力" | decode 瓶颈扩缩的正确 HPA 信号 |
| 整合(Consolidation) | "Karpenter 整合" | 终止节点并迁移到更便宜的实例类型 |
| `WhenEmpty + 1h` | "安全整合" | 不驱逐运行中 GPU 任务的策略 |

## 延伸阅读

- [KAI Scheduler GitHub](https://github.com/kai-scheduler/KAI-Scheduler) — 设计文档和配置示例。
- [Karpenter Disruption Controls](https://karpenter.sh/docs/concepts/disruption/) — 整合策略语义与 GPU 安全默认值。
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/) — Dynamo Planner 的扩缩信号。
- [Ray docs — KAI Scheduler for RayClusters](https://docs.ray.io/en/latest/cluster/kubernetes/k8s-ecosystem/kai-scheduler.html) — Ray 集成模式。
- [AWS EKS Compute and Autoscaling Best Practices](https://docs.aws.amazon.com/eks/latest/best-practices/aiml-compute.html) — 针对托管 Kubernetes 的指南。
- [llm-d GitHub](https://github.com/llm-d/llm-d) — Workload Variant Autoscaler 设计。