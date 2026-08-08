# Kubernetes上的GPU自动扩缩容 —— Karpenter、KAI调度器、组调度

> 三层，不是一层。Karpenter动态配置节点（不到一分钟，比集群自动扩缩容快40%）。KAI调度器处理组调度、拓扑感知和分层队列 —— 它防止7/8部分分配陷阱，即七个节点等待并在缺失一个GPU时烧钱。应用级自动扩缩容器（NVIDIA Dynamo Planner、llm-d工作负载变体自动扩缩容器）在推理特定信号上扩缩 —— 队列深度、KV缓存利用率 —— 而不是CPU/DCGM占空比。经典HPA陷阱是`DCGM_FI_DEV_GPU_UTIL`是占空比测量：100%可能是10个请求或100个。vLLM预分配KV缓存内存，所以内存从不触发缩容。本课程教你组合三层并避免默认Karpenter `WhenEmptyOrUnderutilized`策略在推理中途终止运行GPU作业。

**类型：** 学习
**语言：** Python（标准库，玩具队列深度自动扩缩容模拟器）
**前置知识：** 第17阶段 · 02（推理平台经济学），第17阶段 · 04（vLLM服务内部）
**时间：** 约75分钟

## 学习目标

- 绘制三层自动扩缩容（节点配置、组调度、应用级）并在每层命名使用的工具。
- 解释为什么`DCGM_FI_DEV_GPU_UTIL`是vLLM的错误HPA信号，并命名两个替代方案（队列深度、KV缓存利用率）。
- 描述组调度和KAI调度器防止的部分分配失败模式（7/8 GPU空闲）。
- 命名终止运行GPU作业的Karpenter整合策略（`WhenEmptyOrUnderutilized`）并陈述2026年安全替代方案。

## 问题

你的团队在Kubernetes上交付LLM服务。你用`DCGM_FI_DEV_GPU_UTIL`作为信号设置HPA。服务在工作时间固定在100%利用率。HPA从不扩容 —— 它认为你已经满了。你手动添加副本；TTFT下降。HPA仍然不扩。信号在对你撒谎。

另外，你使用集群自动扩缩容处理节点。凌晨2点一个100万token的提示到达；集群花3分钟配置节点，请求超时。

再另外，你部署一个需要跨2个节点8个GPU的70B模型。集群有7个GPU空闲，1个分散在3个节点上。集群自动扩缩容为缺失的1个GPU配置一个节点。七个节点等待4分钟烧钱，而Kubernetes启动最后一个GPU。

三层，三种不同失败模式。2026年GPU感知自动扩缩容不是"打开HPA"。它是组合节点配置、组调度和应用信号自动扩缩容。

## 概念

### 第一层 —— 节点配置（Karpenter）

Karpenter监视待处理pod并在约45-60秒内配置节点（集群自动扩缩容通常需要90-120秒处理GPU节点）。它根据`NodePool`约束动态选择实例类型 —— 如果你的pod需要8个H100且集群没有匹配节点，Karpenter直接配置一个而不是扩缩现有组。

**整合陷阱**：Karpenter的默认`consolidationPolicy: WhenEmptyOrUnderutilized`对GPU池很危险。它会终止运行GPU节点以将pod迁移到更便宜的右尺寸实例。对推理工作负载这意味着驱逐运行请求并在新节点上重新加载70B模型。损失是数分钟容量加请求失败。

GPU池的安全设置：

```yaml
disruption:
  consolidationPolicy: WhenEmpty
  consolidateAfter: 1h
```

让Karpenter在一小时后整合真正空的节点，但从不驱逐运行作业。

### 第二层 —— 组调度（KAI调度器）

KAI调度器（项目"Karp"后更名）处理默认kube-scheduler不处理的：

**组调度** —— 全有或全无调度。需要8个GPU的分布式推理pod要么全部8个一起启动，要么都不启动。没有这，你得到部分分配陷阱：8个pod中7个启动，无限等待，烧钱。

**拓扑感知** —— 知道哪些GPU共享NVLink，哪些在同一机架，哪些之间有InfiniBand。相应放置pod。DeepSeek-V3 67B张量并行工作负载必须停留在一个NVLink域上；KAI调度器尊重这一点。

**分层队列** —— 多个团队用优先级和配额竞争相同GPU池。团队A的生产紧急只有在优先级规则允许时才会被团队B的训练作业抢占。

KAI作为二级调度器与kube-scheduler一起部署；你注释工作负载以使用它。Ray和vLLM生产栈都集成。

### 第三层 —— 应用级信号

**HPA陷阱**：`DCGM_FI_DEV_GPU_UTIL`是占空比指标 —— 它测量GPU在每个采样间隔是否在工作。100%利用率可能意味着10个并发请求或100个；GPU反正很忙。在占空比上扩缩是盲目扩缩。

更糟的是，vLLM和类似引擎预分配KV缓存内存（直到`--gpu-memory-utilization`）。即使一个请求内存使用也保持在90%附近。基于内存的HPA从不缩容。

**2026年替代信号**：

- 队列深度（等待预填充的请求数）。
- KV缓存利用率（多少比例的块分配给活跃序列）。
- 每副本P99 TTFT（你的SLA信号）。
- 良好吞吐量（每秒满足所有SLO的请求数）。

NVIDIA Dynamo Planner和llm-d工作负载变体自动扩缩容器消费这些信号并扩缩副本。它们完全替代LLM服务的HPA。

### 何时使用什么

| 扩缩决策 | 工具 |
|---------|------|
| 添加/移除节点 | Karpenter |
| 调度多GPU作业 | KAI调度器 |
| 添加/移除副本 | Dynamo Planner / llm-d WVA（或队列深度上的自定义HPA） |
| 选择GPU类型 | Karpenter NodePool |
| 抢占低优先级 | KAI调度器队列 |

### 解耦预填充/解码使一切复杂化

如果你运行解耦预填充/解码（第17阶段 · 17），你有两个具有不同扩缩触发器的pod类：预填充pod在队列深度上扩缩，解码pod在KV缓存压力上扩缩。llm-d将这些作为具有每角色HPA的单独`Services`暴露。不要试图在两者前面放单个HPA。

### 冷启动在这里也重要

冷启动缓解（第17阶段 · 10）是节点配置时间变得用户可见的地方。Karpenter的45-60秒预热加20GB模型加载加引擎初始化意味着从零开始的请求需要2-5分钟。为SLO关键路径保持热池（`min_workers=1`），或在应用层使用Modal式检查点。

### 你应该记住的数字

- Karpenter节点配置：约45-60秒 vs 集群自动扩缩容约90-120秒（GPU节点）。
- KAI调度器防止部分分配浪费 —— 7/8陷阱。
- `DCGM_FI_DEV_GPU_UTIL`作为HPA信号：损坏；使用队列深度或KV利用率。
- Karpenter `WhenEmptyOrUnderutilized`：终止运行GPU作业。对推理使用`WhenEmpty + consolidateAfter: 1h`。

## 使用它

`code/main.py`在突发GPU工作负载上模拟三层自动扩缩容。比较朴素HPA（占空比）、队列深度HPA和KAI组调度扩缩。报告未满足请求、空闲GPU分钟数和综合分数。

## 交付它

本课程产出`outputs/skill-gpu-autoscaler-plan.md`。给定集群拓扑、工作负载形状和SLO，它设计三层自动扩缩容计划。

## 练习

1. 运行`code/main.py`。在突发工作负载下，朴素占空比HPA丢弃多少队列深度HPA捕获的请求？差异来自哪里？
2. 为在H100 SXM5上服务Llama 3.3 70B FP8的集群设计Karpenter NodePool。指定`capacity-type`、`disruption.consolidationPolicy`、`consolidateAfter`和保持非GPU工作负载远离这些节点的污点。
3. 你的团队报告部署卡在Pending因为"GPU可用但pod不会调度"。诊断 —— 这是Karpenter、kube-scheduler还是KAI调度器？哪些指标确认？
4. 为解耦预填充pod选择一个扩缩信号，为解码pod选择一个不同信号。两者都证明。
5. 计算`WhenEmptyOrUnderutilized`整合陷阱在平均每天60次请求丢弃事件且P99 TTFT > 10秒的24/7生产服务上的成本。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| Karpenter | "节点配置器" | Kubernetes节点自动扩缩容；亚分钟配置 |
| 集群自动扩缩容 | "旧扩缩器" | Kubernetes节点自动扩缩容前身；更慢，基于组 |
| KAI调度器 | "GPU调度器" | 用于组 + 拓扑 + 队列的二级调度器 |
| 组调度 | "全有或全无" | 原子调度N个pod或推迟全部 |
| 拓扑感知 | "机架感知" | 基于NVLink/IB/机架放置放置pod |
| `DCGM_FI_DEV_GPU_UTIL` | "GPU利用率" | 占空比指标；不是LLM的扩缩信号 |
| 队列深度 | "等待请求" | 预填充约束扩缩的正确HPA信号 |
| KV缓存利用率 | "内存压力" | 解码约束扩缩的正确HPA信号 |
| 整合 | "Karpenter整合" | 节点终止到更便宜实例类型 |
| `WhenEmpty + 1h` | "安全整合" | 不驱逐运行GPU作业的策略 |

## 延伸阅读

- [KAI调度器GitHub](https://github.com/kai-scheduler/KAI-Scheduler) —— 设计文档和配置示例。
- [Karpenter中断控制](https://karpenter.sh/docs/concepts/disruption/) —— 整合策略语义和GPU安全默认。
- [NVIDIA —— Kubernetes上的解耦LLM推理](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/) —— Dynamo Planner扩缩信号。
- [Ray文档 —— RayClusters的KAI调度器](https://docs.ray.io/en/latest/cluster/kubernetes/k8s-ecosystem/kai-scheduler.html) —— Ray集成模式。
- [AWS EKS计算和自动扩缩容最佳实践](https://docs.aws.amazon.com/eks/latest/best-practices/aiml-compute.html) —— 托管Kubernetes特定指南。
- [llm-d GitHub](https://github.com/llm-d/llm-d) —— 工作负载变体自动扩缩容器设计。