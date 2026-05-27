# Kubernetes 上的 GPU 自动扩缩 — Karpenter、KAI Scheduler、Gang Scheduling

> 三层，而非一层。Karpenter 动态供应节点（一分钟内，比 Cluster Autoscaler 快 40%）。KAI Scheduler 处理 gang scheduling、拓扑感知和分层队列——它防止了 7-of-8 部分分配陷阱，即七个节点等待并消耗一个缺失的 GPU。应用级自动扩缩器（NVIDIA Dynamo Planner、llm-d Workload Variant Autoscaler）基于推理特定信号扩缩——队列深度、KV 缓存利用率——而非 CPU/DCGM 占空比。经典的 HPA 陷阱是 `DCGM_FI_DEV_GPU_UTIL` 是一个占空比测量：100% 可能是 10 个请求或 100 个。vLLM 预分配 KV 缓存内存，因此内存永远不会触发缩容。本课教你组成三层并避免默认的 Karpenter `WhenEmptyOrUnderutilized` 策略，该策略会在推理过程中终止正在运行的 GPU 作业。

**类型：** 学习
**语言：** Python（标准库，简单的队列深度自动扩缩器模拟器）
**先修要求：** 阶段 17 · 02（推理平台经济学）、阶段 17 · 04（vLLM 服务内部原理）
**时间：** 约 75 分钟

## 学习目标

- 绘制三层自动扩缩（节点供应、gang scheduling、应用级）并说出每层使用的工具。
- 解释为什么 `DCGM_FI_DEV_GPU_UTIL` 是 vLLM 的错误 HPA 信号，并说出两个替代方案（队列深度、KV 缓存利用率）。
- 描述 gang scheduling 和 KAI Scheduler 防止的部分分配失败模式（8 个 GPU 中 7 个空闲）。
- 说出终止正在运行的 GPU 作业的 Karpenter 合并策略（`WhenEmptyOrUnderutilized`），并陈述 2026 年安全的替代方案。

## 问题

你的团队在 Kubernetes 上部署 LLM 服务。你使用 `DCGM_FI_DEV_GPU_UTIL` 作为信号设置了 HPA。服务在营业时间保持在 100% 利用率。HPA 永不扩容——它已经认为你满了。你手动添加副本；TTFT 下降。HPA 仍然不扩缩。信号在对你说谎。

另外，你使用 Cluster Autoscaler 来供应节点。一个 100 万 token 的提示在凌晨 2 点到达；集群花费 3 分钟供应一个节点，请求超时。

再次另外，你部署一个需要跨 2 个节点 8 个 GPU 的 70B 模型。集群有 7 个 GPU 空闲，1 个分布在 3 个节点上。Cluster Autoscaler 为缺失的 1 个 GPU 供应一个节点。七个节点等待 4 分钟消耗金钱，而 Kubernetes 启动最后一个 GPU。

三层，三种不同的失败模式。2026 年的 GPU 感知自动扩缩不是"打开 HPA"。它是组成节点供应、gang scheduling 和应用信号自动扩缩。

## 概念

### 第 1 层——节点供应（Karpenter）

Karpenter 监视待处理 pod 并在约 45-60 秒内供应节点（Cluster Autoscaler 通常需要 90-120 秒用于 GPU 节点）。它根据 `NodePool` 约束动态选择实例类型——如果你的 pod 需要 8 个 H100 且集群没有匹配节点，Karpenter 直接供应一个，而不是扩展现有组。

**合并陷阱**：Karpenter 默认的 `consolidationPolicy: WhenEmptyOrUnderutilized` 对 GPU 池是危险的。它将终止正在运行的 GPU 节点以将 pod 迁移到更便宜的适当大小实例。对于推理工作负载，这意味着驱逐正在运行的请求并在新节点上重新加载 70B 模型。损失是几分钟的容量加上请求失败。

GPU 池的安全设置：

```yaml
disruption:
  consolidationPolicy: WhenEmpty
  consolidateAfter: 1h
```

让 Karpenter 在一小时后合并真正空的节点，但永远不要驱逐正在运行的作业。

### 第 2 层——Gang Scheduling（KAI Scheduler）

KAI Scheduler（项目"Karp"然后重命名）处理默认 kube-scheduler 不处理的事情：

**Gang scheduling**——全有或全无。需要 8 个 GPU 的分布式推理 pod 要么全部 8 个一起启动，要么都不启动。没有这个，你会得到部分分配陷阱：8 个 pod 中的 7 个启动，无限期等待，消耗金钱。

**拓扑感知**——知道哪些 GPU 共享 NVLink，哪些在同一机架上，哪些之间有 InfiniBand。相应地放置 pod。DeepSeek-V3 67B 张量并行工作负载必须停留在一个 NVLink 域上；KAI Scheduler 尊重这一点。

**分层队列**——多个团队以优先级和配额竞争同一个 GPU 池。只有优先级规则允许时，A 队的生产紧缩才会被 B 队的训练作业抢占。

KAI 作为二级调度器与 kube-scheduler 一起部署；你注释工作负载以使用它。Ray 和 vLLM production-stack 都集成。

### 第 3 层——应用级信号

**HPA 陷阱**：`DCGM_FI_DEV_GPU_UTIL` 是一个占空比指标——它测量 GPU 在每个采样间隔是否在做工作。100% 利用率可能意味着 10 个并发请求或 100 个；无论哪种方式 GPU 都很忙。在占空比上扩缩是盲目扩缩。

更糟糕的是，vLLM 和类似引擎预分配 KV 缓存内存（高达 `--gpu-memory-utilization`）。即使在一个请求时，内存使用率也保持在近 90%。基于内存的 HPA 永不缩容。

**2026 年替代信号**：

- 队列深度（等待 prefill 的请求数）。
- KV 缓存利用率（分配给活动序列的块的比例）。
- 每副本 P99 TTFT（你的 SLA 信号）。
- Goodput（每秒满足所有 SLO 的请求）。

NVIDIA Dynamo Planner 和 llm-d Workload Variant Autoscaler 使用这些信号并扩缩副本。它们完全取代 LLM 服务的 HPA。

### 何时使用什么

| 扩缩决策 | 工具 |
|---------------|------|
| 添加/移除节点 | Karpenter |
| 调度多 GPU 作业 | KAI Scheduler |
| 添加/移除副本 | Dynamo Planner / llm-d WVA（或基于队列深度的自定义 HPA） |
| 选择 GPU 类型 | Karpenter NodePool |
| 抢占低优先级 | KAI Scheduler 队列 |

### 分离式 prefill/decode 使一切复杂化

如果你运行分离式 prefill/decode（阶段 17 · 17），你有两个具有不同扩缩触发器的 pod 类：prefill pod 基于队列深度扩缩，decode pod 基于 KV 缓存压力扩缩。llm-d 将这些作为具有每角色 HPA 的独立 `Services` 公开。不要试图在两者前面放置单个 HPA。

### 冷启动在这里也很重要

冷启动缓解（阶段 17 · 10）是节点供应时间变得用户可见的地方。Karpenter 的 45-60 秒预热加上 20GB 模型加载加上引擎初始化意味着从零开始的请求需要 2-5 分钟。为 SLO 关键路径保持热池（`min_workers=1`），或在应用层使用 Modal 风格的 checkpointing。

### 你应该记住的数字

- Karpenter 节点供应：约 45-60 秒 vs Cluster Autoscaler 约 90-120 秒（GPU 节点）。
- KAI Scheduler 防止部分分配浪费——8 个中 7 个陷阱。
- `DCGM_FI_DEV_GPU_UTIL` 作为 HPA 信号：损坏；使用队列深度或 KV 利用率。
- Karpenter `WhenEmptyOrUnderutilized`：终止正在运行的 GPU 作业。对推理使用 `WhenEmpty + consolidateAfter: 1h`。

## 使用它

`code/main.py`在突发 GPU 工作负载上模拟三层自动扩缩器。比较朴素 HPA（占空比）、队列深度 HPA 和 KAI-gang-scheduled 扩缩。报告未满足请求、空闲 GPU 分钟和综合分数。

## 交付它

本课生成 `outputs/skill-gpu-autoscaler-plan.md`。给定集群拓扑、工作负载形状和 SLO，它设计三层自动扩缩计划。

## 练习

1. 运行 `code/main.py`。在突发工作负载下，朴素占空比 HPA 丢弃多少队列深度 HPA 捕获的请求？差异来自哪里？
2. 为在 H100 SXM5 上服务 Llama 3.3 70B FP8 的集群设计 Karpenter NodePool。指定 `capacity-type`、`disruption.consolidationPolicy`、`consolidateAfter` 和将非 GPU 工作负载保留在这些节点之外的污点。
3. 你的团队报告部署卡在 Pending 状态，因为"GPU 可用但 pod 不会调度。"诊断——这是 Karpenter、kube-scheduler 还是 KAI Scheduler？哪些指标确认？
4. 为分离式 prefill pod 选择一个信号，为 decode pod 选择一个不同的信号。证明两者。
5. 计算 `WhenEmptyOrUnderutilized` 合并陷阱在 24x7 生产服务上的成本，该服务平均每天在 P99 TTFT > 10 秒时有 60 个请求丢弃事件。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| Karpenter | "节点供应器" | Kubernetes 节点自动扩缩器；亚分钟供应 |
| Cluster Autoscaler | "旧扩缩器" | Kubernetes 节点自动扩缩器前身；较慢，基于组 |
| KAI Scheduler | "GPU 调度器" | 用于 gang + 拓扑 + 队列的二级调度器 |
| Gang scheduling | "全有或全无" | 原子地调度 N 个 pod，否则全部推迟 |
| Topology awareness | "机架感知" | 基于 NVLink/IB/机架放置放置 pod |
| `DCGM_FI_DEV_GPU_UTIL` | "GPU 利用率" | 占空比指标；不是 LLM 的扩缩信号 |
| Queue depth | "等待请求" | prefill 绑定扩缩的正确 HPA 信号 |
| KV cache utilization | "内存压力" | decode 绑定扩缩的正确 HPA 信号 |
| Consolidation | "Karpenter 合并" | 终止节点以使用更便宜的实例类型 |
| `WhenEmpty + 1h` | "安全合并" | 不驱逐正在运行的 GPU 作业的策略 |

## 延伸阅读

- [KAI Scheduler GitHub](https://github.com/kai-scheduler/KAI-Scheduler)——设计文档和配置示例。
- [Karpenter 中断控制](https://karpenter.sh/docs/concepts/disruption/)——合并策略语义和 GPU 安全默认值。
- [NVIDIA——Kubernetes 上的分离式 LLM 推理](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/)——Dynamo Planner 扩缩信号。
- [Ray 文档——用于 RayClusters 的 KAI Scheduler](https://docs.ray.io/en/latest/cluster/kubernetes/k8s-ecosystem/kai-scheduler.html)——Ray 集成模式。
- [AWS EKS 计算和自动扩缩最佳实践](https://docs.aws.amazon.com/eks/latest/best-practices/aiml-compute.html)——托管 Kubernetes 特定指导。
- [llm-d GitHub](https://github.com/llm-d/llm-d)——Workload Variant Autoscaler 设计。
