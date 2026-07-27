# Kubernetes 上的 GPU 自动伸缩 — Karpenter、KAI Scheduler、Gang Scheduling

> 三层而非一层。Karpenter 动态调配节点（一分钟内，比 Cluster Autoscaler 快 40%）。KAI Scheduler 处理批调度、拓扑感知和层级队列 — 它防止了 7/8 部分分配陷阱（即七个节点等待并浪费资源在一个缺失的 GPU 上）。应用级自动伸缩器（NVIDIA Dynamo Planner、llm-d Workload Variant Autoscaler）基于推理专用信号（队列深度、KV 缓存利用率）进行伸缩，而非 CPU/DCGM 占空比。经典的 HPA 陷阱在于 `DCGM_FI_DEV_GPU_UTIL` 是占空比度量：100% 可能对应 10 个请求或 100 个。vLLM 预分配 KV 缓存内存，因此内存永远不会触发缩容。本课教你如何组合这三层，并避免默认的 Karpenter `WhenEmptyOrUnderutilized` 策略在推理中途终止正在运行的 GPU 任务。

**类型：** 学习
**语言：** Python（标准库，玩具级队列深度自动伸缩模拟器）
**前置要求：** 阶段 17 · 02（推理平台经济学），阶段 17 · 04（vLLM 服务内部原理）
**时间：** 约 75 分钟

## 学习目标

- 绘制三层自动伸缩架构图（节点调配、批调度、应用级），并说出每层使用的工具。
- 解释为什么 `DCGM_FI_DEV_GPU_UTIL` 不适合作为 vLLM 的 HPA 信号，并说出两种替代信号（队列深度、KV 缓存利用率）。
- 描述批调度以及 KAI Scheduler 所防止的部分分配失败模式（7/8 GPU 空闲）。
- 说出会终止正在运行的 GPU 任务的 Karpenter 整合策略（`WhenEmptyOrUnderutilized`），并说明 2026 年的安全替代方案。

## 问题

你的团队在 Kubernetes 上部署了一个 LLM 推理服务。你设置 HPA 使用 `DCGM_FI_DEV_GPU_UTIL` 作为信号。该服务在工作时间维持在 100% 利用率。HPA 从未扩容 — 它已经认为你满载了。你手动添加一个副本；TTFT 下降。HPA 仍然不扩容。这个信号在欺骗你。

另外，你使用 Cluster Autoscaler 管理节点。一个 100 万 token 的 prompt 在凌晨 2 点到达；集群花了 3 分钟调配一个节点，请求超时。

再另外，你部署了一个需要 2 个节点共 8 张 GPU 的 70B 模型。集群有 7 个空闲 GPU 和 1 个分散在 3 个节点上。Cluster Autoscaler 为缺失的那 1 张 GPU 调配了一个节点。七个节点等待了 4 分钟白白烧钱，而 Kubernetes 才把最后一张 GPU 准备好。

三层，三种不同的失败模式。2026 年的 GPU 感知自动伸缩不是"开启 HPA"。而是组合节点调配、批调度和应用信号自动伸缩。

## 概念

### 第 1 层 — 节点调配（Karpenter）

Karpenter 监控待处理 Pod，并在约 45-60 秒内调配节点（Cluster Autoscaler 通常需要 90-120 秒来调配 GPU 节点）。它根据 `NodePool` 约束动态选择实例类型 — 如果你的 Pod 需要 8 张 H100 而集群没有匹配节点，Karpenter 会直接调配一个，而不是扩展现有节点组。

**整合陷阱**：Karpenter 的默认 `consolidationPolicy: WhenEmptyOrUnderutilized` 对 GPU 池来说很危险。它会终止正在运行的 GPU 节点，以将 Pod 迁移到更便宜的适当规格实例。对于推理工作负载，这意味着驱逐正在运行的请求并在新节点上重新加载 70B 模型。损失是数分钟的计算能力加上请求失败。

GPU 池的安全设置：

```yaml
disruption:
  consolidationPolicy: WhenEmpty
  consolidateAfter: 1h
```

允许 Karpenter 在一小时后整合真正空的节点，但绝不驱逐正在运行的任务。

### 第 2 层 — 批调度（KAI Scheduler）

KAI Scheduler（原项目名"Karp"后更名）处理默认 kube-scheduler 无法处理的事情：

**批调度（Gang scheduling）** — 全有或全无调度。需要 8 张 GPU 的分布式推理 Pod 要么全部 8 个一起启动，要么都不启动。没有这个机制，你就会遇到部分分配陷阱：7/8 的 Pod 启动，无限期等待，白白烧钱。

**拓扑感知** — 知道哪些 GPU 共享 NVLink，哪些位于同一机架，哪些之间有 InfiniBand。据此放置 Pod。DeepSeek-V3 67B 张量并行工作负载必须位于同一个 NVLink 域内；KAI Scheduler 尊重这一约束。

**层级队列** — 多个团队竞争同一个 GPU 池，带优先级和配额。团队 A 的生产环境高峰期只有在优先级规则允许时才会被团队 B 的训练任务抢占。

KAI 作为辅助调度器与 kube-scheduler 一起部署；你可以通过注解让工作负载使用它。Ray 和 vLLM 生产栈都已集成。

### 第 3 层 — 应用级信号

**HPA 陷阱**：`DCGM_FI_DEV_GPU_UTIL` 是一个占空比指标 — 它测量 GPU 在每个采样间隔是否在执行工作。100% 利用率可能对应 10 个并发请求或 100 个；GPU 无论如何都是忙的。基于占空比进行伸缩就像盲目伸缩。

更糟的是，vLLM 及类似引擎会预分配 KV 缓存内存（最高到 `--gpu-memory-utilization` 设置值）。即使只有一个请求，内存使用率也保持在 90% 附近。基于内存的 HPA 永远不会缩容。

**2026 年的替代信号**：

- 队列深度（等待 prefill 的请求数量）。
- KV 缓存利用率（已分配给活动序列的块的比例）。
- 每副本 P99 TTFT（你的 SLA 信号）。
- 有效吞吐（每秒满足所有 SLO 的请求数）。

NVIDIA Dynamo Planner 和 llm-d Workload Variant Autoscaler 使用这些信号并伸缩副本。它们完全取代了 LLM 推理场景中的 HPA。

### 何时使用什么

| 伸缩决策 | 工具 |
|-----------|------|
| 增/删节点 | Karpenter |
| 调度多 GPU 任务 | KAI Scheduler |
| 增/删副本 | Dynamo Planner / llm-d WVA（或基于队列深度的自定义 HPA） |
| 选择 GPU 类型 | Karpenter NodePool |
| 抢占低优先级 | KAI Scheduler 队列 |

### 分离式 prefill/decode 使一切更复杂

如果你运行分离式 prefill/decode（阶段 17 · 17），你会拥有两类 Pod，各有不同的伸缩触发条件：prefill Pod 根据队列深度伸缩，decode Pod 根据 KV 缓存压力伸缩。llm-d 将这些暴露为独立的 `Service`，每个角色有自己的 HPA。不要尝试用一个 HPA 同时覆盖两者。

### 冷启动在这里也很重要

冷启动缓解（阶段 17 · 10）是节点调配时间变得用户可见的地方。Karpenter 45-60 秒的预热加上 20GB 模型加载加上引擎初始化，意味着从零开始的请求需要 2-5 分钟。为 SLO 关键路径保留一个热池（`min_workers=1`），或在应用层使用 Modal 风格的检查点机制。

### 你应该记住的数字

- Karpenter 节点调配：约 45-60 秒 vs Cluster Autoscaler 约 90-120 秒（GPU 节点）。
- KAI Scheduler 防止部分分配浪费 — 7/8 陷阱。
- `DCGM_FI_DEV_GPU_UTIL` 作为 HPA 信号：不可靠；应使用队列深度或 KV 利用率。
- Karpenter `WhenEmptyOrUnderutilized`：会终止正在运行的 GPU 任务。推理场景请使用 `WhenEmpty + consolidateAfter: 1h`。

```figure
autoscaling
```

## 使用它

`code/main.py` 模拟了一个三层自动伸缩器在突发 GPU 工作负载下的表现。比较了朴素 HPA（占空比）、队列深度 HPA 和 KAI 批调度伸缩。报告未满足请求数、空闲 GPU 分钟数和综合评分。

## 交付

本课产出 `outputs/skill-gpu-autoscaler-plan.md`。根据集群拓扑、工作负载特征和 SLO，设计一个三层自动伸缩方案。

## 练习

1. 运行 `code/main.py`。在突发工作负载下，朴素占空比 HPA 比队列深度 HPA 多丢弃了多少请求？差异从何而来？
2. 为运行 Llama 3.3 70B FP8（H100 SXM5）的集群设计一个 Karpenter NodePool。指定 `capacity-type`、`disruption.consolidationPolicy`、`consolidateAfter`，以及一个防止非 GPU 工作负载进入这些节点的污点。
3. 你的团队报告部署一直处于 Pending 状态，原因是"GPU 可用但 Pod 无法调度"。请诊断 — 这是 Karpenter、kube-scheduler 还是 KAI Scheduler 的问题？哪些指标可以确认？
4. 为分离式 prefill Pod 选择一个自动伸缩信号，为 decode Pod 选择另一个不同的信号。请论证两者的选择。
5. 计算 `WhenEmptyOrUnderutilized` 整合陷阱在一个 7x24 小时生产服务上的成本，该服务平均每天发生 60 次请求丢弃事件，P99 TTFT > 10 秒。

## 关键术语

| 术语 | 人们说的意思 | 实际含义 |
|------|-------------|---------|
| Karpenter | "节点调配器" | Kubernetes 节点自动伸缩器；亚分钟级调配 |
| Cluster Autoscaler | "旧的伸缩器" | Kubernetes 节点自动伸缩器前身；较慢，基于节点组 |
| KAI Scheduler | "GPU 调度器" | 用于批调度 + 拓扑 + 队列的辅助调度器 |
| Gang scheduling | "全有或全无" | 原子化调度 N 个 Pod，否则全部推迟 |
| 拓扑感知 | "机架感知" | 基于 NVLink/IB/机架位置放置 Pod |
| `DCGM_FI_DEV_GPU_UTIL` | "GPU 利用率" | 占空比指标；不是 LLM 的伸缩信号 |
| 队列深度 | "等待中的请求" | 适用于 prefill 型伸缩的正确 HPA 信号 |
| KV 缓存利用率 | "内存压力" | 适用于 decode 型伸缩的正确 HPA 信号 |
| 整合 | "Karpenter 整合" | 将节点终止以切换到更便宜的实例类型 |
| `WhenEmpty + 1h` | "安全整合" | 不会驱逐正在运行的 GPU 任务的策略 |

## 延伸阅读

- [KAI Scheduler GitHub](https://github.com/kai-scheduler/KAI-Scheduler) — 设计文档和配置示例。
- [Karpenter 中断控制](https://karpenter.sh/docs/concepts/disruption/) — 整合策略语义和 GPU 安全默认值。
- [NVIDIA — Kubernetes 上的分离式 LLM 推理](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/) — Dynamo Planner 伸缩信号。
- [Ray 文档 — KAI Scheduler for RayClusters](https://docs.ray.io/en/latest/cluster/kubernetes/k8s-ecosystem/kai-scheduler.html) — Ray 集成模式。
- [AWS EKS 计算与自动伸缩最佳实践](https://docs.aws.amazon.com/eks/latest/best-practices/aiml-compute.html) — 托管 Kubernetes 专用指南。
- [llm-d GitHub](https://github.com/llm-d/llm-d) — Workload Variant Autoscaler 设计。
