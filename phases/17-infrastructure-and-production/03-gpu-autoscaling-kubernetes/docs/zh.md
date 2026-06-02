# Kubernetes 上的 GPU 自动伸缩 —— Karpenter、KAI Scheduler、Gang Scheduling

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 三层，不是一层。Karpenter 动态供给节点（一分钟以内，比 Cluster Autoscaler 快 40%）。KAI Scheduler 处理 gang scheduling（成组调度）、topology awareness（拓扑感知）以及层级队列——它能避开「8 个 GPU 凑不齐 7 个白等」的部分分配陷阱：7 个节点干等、烧钱，就因为缺 1 个 GPU。应用层的自动伸缩器（NVIDIA Dynamo Planner、llm-d Workload Variant Autoscaler）按推理特有的信号伸缩——队列深度、KV cache 利用率——而不是 CPU/DCGM duty cycle（占空比）。经典的 HPA 陷阱是：`DCGM_FI_DEV_GPU_UTIL` 是占空比指标，100% 可能对应 10 个请求，也可能对应 100 个。vLLM 会预分配 KV cache 显存，所以显存永远不会触发缩容。这一课教你把三层组合起来，并避开 Karpenter 默认的 `WhenEmptyOrUnderutilized` 策略——它会在推理跑到一半时直接干掉 GPU 节点。

**Type:** Learn
**Languages:** Python（标准库，玩具级 queue-depth autoscaler 模拟器）
**Prerequisites:** Phase 17 · 02（Inference Platform Economics）、Phase 17 · 04（vLLM Serving Internals）
**Time:** ~75 分钟

## 学习目标（Learning Objectives）

- 画出三层自动伸缩（节点供给、gang scheduling、应用层）的示意图，并说出每层用什么工具。
- 解释为什么 `DCGM_FI_DEV_GPU_UTIL` 不是 vLLM 适用的 HPA 信号，并给出两个替代信号（队列深度、KV cache 利用率）。
- 描述 gang scheduling，以及 KAI Scheduler 防止的那种部分分配失败模式（8 个 GPU 里 7 个空转）。
- 说出会终止运行中 GPU 任务的 Karpenter 整合策略名称（`WhenEmptyOrUnderutilized`），并给出 2026 年的安全替代方案。

## 问题（The Problem）

你的团队在 Kubernetes 上部署了一个 LLM 服务。你用 `DCGM_FI_DEV_GPU_UTIL` 当 HPA 信号。工作时间内服务利用率被钉死在 100%。HPA 永远不扩容——它觉得你已经跑满了。你手动加一个副本，TTFT 立刻下降。HPA 还是不扩。这个信号在骗你。

另外一边，你用 Cluster Autoscaler 管节点。凌晨 2 点来了一个 100 万 token 的 prompt，集群花了 3 分钟才把节点供给好，请求超时。

再换一个场景，你部署一个需要 2 个节点共 8 个 GPU 的 70B 模型。集群里有 7 个 GPU 空着，剩下 1 个分散在 3 个节点上。Cluster Autoscaler 又为那 1 个缺的 GPU 供给了一台节点。其余 7 个节点空等 4 分钟、烧着钱，等 Kubernetes 把最后一个 GPU 拉起来。

三层，三种不同的失败模式。2026 年的 GPU 感知自动伸缩可不是「打开 HPA」那么简单——它是把节点供给、gang scheduling、应用信号伸缩组合起来。

## 概念（The Concept）

### 第 1 层 —— 节点供给（Karpenter）

Karpenter 监听 pending 状态的 pod，在 ~45-60 秒内供给节点（Cluster Autoscaler 对 GPU 节点通常要 90-120 秒）。它根据 `NodePool` 约束动态选机型——如果你的 pod 需要 8 张 H100、集群里没有匹配节点，Karpenter 会直接供给一台，而不是去扩已有的节点组。

**整合陷阱**：Karpenter 默认的 `consolidationPolicy: WhenEmptyOrUnderutilized` 对 GPU 池非常危险。它会终止一台正在跑的 GPU 节点，把 pod 迁移到更便宜、更合身的实例上。对推理工作负载，这意味着驱逐进行中的请求、并在新节点上重新加载一个 70B 模型。代价是好几分钟的容量损失外加请求失败。

GPU 池的安全配置：

```yaml
disruption:
  consolidationPolicy: WhenEmpty
  consolidateAfter: 1h
```

让 Karpenter 在节点真的空了一小时后才整合，但永远不驱逐还在运行的任务。

### 第 2 层 —— gang scheduling（KAI Scheduler）

KAI Scheduler（项目原名 "Karp"，后来改名）处理默认 kube-scheduler 不做的事：

**Gang scheduling**——要么全调度，要么一个都不调度。一个需要 8 个 GPU 的分布式推理 pod，要么 8 个一起起，要么一个都别起。没有这个机制，你就会撞上部分分配陷阱：8 个 pod 起了 7 个，剩下 1 个永远在等，钱却一直在烧。

**Topology awareness（拓扑感知）**——知道哪几张 GPU 共享 NVLink、哪几张在同一个机架、哪几张之间有 InfiniBand。据此放置 pod。一个 DeepSeek-V3 67B 的 tensor-parallel 工作负载必须留在同一个 NVLink 域内；KAI Scheduler 会照办。

**层级队列（Hierarchical queues）**——多个团队按优先级和配额竞争同一个 GPU 池。A 团队的生产高峰只有在优先级规则允许时，才会被 B 团队的训练任务抢占。

KAI 与 kube-scheduler 并行部署，作为 secondary scheduler；你给工作负载打注解让它们走 KAI。Ray 和 vLLM production-stack 都已经集成。

### 第 3 层 —— 应用层信号

**HPA 陷阱**：`DCGM_FI_DEV_GPU_UTIL` 是 duty-cycle（占空比）指标——它衡量在每个采样间隔里 GPU 是否在干活。100% 利用率可能是 10 个并发请求，也可能是 100 个；GPU 都算在忙。按占空比伸缩等于盲目伸缩。

更糟的是，vLLM 这类引擎会预分配 KV cache 显存（最大到 `--gpu-memory-utilization`）。哪怕只有一个请求，显存占用也稳在 90% 上下。基于显存的 HPA 永远不会缩容。

**2026 年的替代信号**：

- 队列深度（等待 prefill 的请求数）。
- KV cache 利用率（多少比例的 block 被分配给活跃序列）。
- 单副本 P99 TTFT（你的 SLA 信号）。
- Goodput（每秒满足所有 SLO 的请求数）。

NVIDIA Dynamo Planner 和 llm-d Workload Variant Autoscaler 消费这些信号并伸缩副本。在 LLM serving 场景，它们彻底取代 HPA。

### 什么时候用什么

| 伸缩决策 | 工具 |
|----------------|------|
| 增删节点 | Karpenter |
| 调度多 GPU 任务 | KAI Scheduler |
| 增删副本 | Dynamo Planner / llm-d WVA（或基于队列深度的自定义 HPA） |
| 选择 GPU 型号 | Karpenter NodePool |
| 抢占低优任务 | KAI Scheduler 队列 |

### 解耦 prefill/decode 让一切更复杂

如果你跑解耦式的 prefill/decode（Phase 17 · 17），就会有两类 pod、各自有不同的伸缩触发器：prefill pod 按队列深度伸缩，decode pod 按 KV cache 压力伸缩。llm-d 把它们暴露成各自独立的 `Services`，每个角色自己的 HPA。别想着用一个 HPA 罩住两边。

### 冷启动在这里同样重要

冷启动缓解（Phase 17 · 10）正是节点供给时间会被用户感知到的地方。Karpenter 45-60 秒的预热，再加上 20GB 模型加载，再加上引擎初始化，从零起步的请求要等 2-5 分钟。给 SLO 关键路径保留一个 warm pool（`min_workers=1`），或者在应用层用 Modal 风格的 checkpoint。

### 你应该记住的数字

- Karpenter 节点供给：~45-60s，对比 Cluster Autoscaler ~90-120s（GPU 节点）。
- KAI Scheduler 防止部分分配浪费——8 个里凑不齐 7 个的陷阱。
- `DCGM_FI_DEV_GPU_UTIL` 当 HPA 信号：废的；用队列深度或 KV 利用率。
- Karpenter `WhenEmptyOrUnderutilized`：会终止运行中的 GPU 任务。推理场景请用 `WhenEmpty + consolidateAfter: 1h`。

## 用起来（Use It）

`code/main.py` 在一个突发型 GPU 工作负载上模拟三层自动伸缩。对比朴素 HPA（占空比）、queue-depth HPA、KAI gang 调度伸缩三种方案。报告未满足请求数、GPU 闲置分钟数和综合得分。

## 上线部署（Ship It）

本课产出 `outputs/skill-gpu-autoscaler-plan.md`。给定集群拓扑、工作负载形态和 SLO，它会给你设计一个三层自动伸缩方案。

## 练习（Exercises）

1. 跑 `code/main.py`。在突发型工作负载下，朴素的占空比 HPA 比 queue-depth HPA 多丢多少请求？差距来自哪里？
2. 为一个在 H100 SXM5 上运行 Llama 3.3 70B FP8 的集群设计一个 Karpenter NodePool。指定 `capacity-type`、`disruption.consolidationPolicy`、`consolidateAfter`，以及一个让非 GPU 工作负载远离这些节点的 taint。
3. 团队反馈部署卡在 Pending，原因是「GPU 有空但 pod 排不上」。诊断一下——这是 Karpenter、kube-scheduler 还是 KAI Scheduler 的问题？看哪些指标可以验证？
4. 给解耦 prefill pod 选一个伸缩信号，给 decode pod 选另一个不同的信号。为两个选择各自给出理由。
5. 算一下：一个 24x7 生产服务，平均每天有 60 次掉请求事件、对应 P99 TTFT > 10s，`WhenEmptyOrUnderutilized` 整合陷阱的成本是多少。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际是什么 |
|------|----------------|------------------------|
| Karpenter | "节点供给器" | Kubernetes 节点自动伸缩器；亚分钟级供给 |
| Cluster Autoscaler | "老一代伸缩器" | Kubernetes 节点自动伸缩器的前辈；更慢，基于节点组 |
| KAI Scheduler | "GPU 调度器" | 处理 gang + 拓扑 + 队列的 secondary scheduler |
| Gang scheduling | "全有或全无" | 原子地调度 N 个 pod，否则全部延后 |
| Topology awareness | "机架感知" | 基于 NVLink/IB/机架位置放置 pod |
| `DCGM_FI_DEV_GPU_UTIL` | "GPU 利用率" | 占空比指标；不是 LLM 的伸缩信号 |
| Queue depth | "等待请求数" | prefill 受限场景下正确的 HPA 信号 |
| KV cache utilization | "显存压力" | decode 受限场景下正确的 HPA 信号 |
| Consolidation | "Karpenter 整合" | 终止节点以换更便宜的实例类型 |
| `WhenEmpty + 1h` | "安全整合" | 不会驱逐运行中 GPU 任务的策略 |

## 延伸阅读（Further Reading）

- [KAI Scheduler GitHub](https://github.com/kai-scheduler/KAI-Scheduler) —— 设计文档与配置示例。
- [Karpenter Disruption Controls](https://karpenter.sh/docs/concepts/disruption/) —— 整合策略语义与 GPU 安全默认值。
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/) —— Dynamo Planner 伸缩信号。
- [Ray docs — KAI Scheduler for RayClusters](https://docs.ray.io/en/latest/cluster/kubernetes/k8s-ecosystem/kai-scheduler.html) —— Ray 集成模式。
- [AWS EKS Compute and Autoscaling Best Practices](https://docs.aws.amazon.com/eks/latest/best-practices/aiml-compute.html) —— 托管 Kubernetes 专属指引。
- [llm-d GitHub](https://github.com/llm-d/llm-d) —— Workload Variant Autoscaler 设计。
