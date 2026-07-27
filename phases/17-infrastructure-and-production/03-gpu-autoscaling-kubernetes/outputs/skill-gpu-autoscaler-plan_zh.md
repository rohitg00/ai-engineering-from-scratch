---
name: gpu-autoscaler-plan
description: 为基于 Kubernetes 的 LLM 服务集群设计三层 GPU 自动扩缩容方案（Karpenter + KAI Scheduler + 应用信号）。诊断 DCGM_FI_DEV_GPU_UTIL 陷阱和部分分配失败。
version: 1.0.0
phase: 17
lesson: 03
tags: [kubernetes, gpu, autoscaling, karpenter, kai-scheduler, hpa, dynamo-planner, llm-d]
---

给定集群拓扑（节点、GPU 类型、NVLink 域）、工作负载形态（TP/PP 配置、平均并发数、突发系数）和 SLO（TTFT P99、goodput），生成三层自动扩缩容方案。

输出：

1. **第 1 层 — Karpenter NodePool**。指定 `instance-type`、`capacity-type`（按需 / Spot / 预留）、`consolidationPolicy`（GPU 池必须为 `WhenEmpty` 且 `consolidateAfter: 1h`）、排除非 GPU 工作负载的污点以及供 KAI Scheduler 选择的标签。
2. **第 2 层 — KAI Scheduler 策略**。说明是否需要 gang 调度（TP/PP > 1 时需要）。定义拓扑约束（NVLink 域、机架、可用区）。指定队列层次结构和生产与训练租户的抢占规则。
3. **第 3 层 — 应用自动扩缩容**。选择信号：预填充密集型工作负载用队列深度、解码密集型用 KV 缓存利用率、混合型用复合 goodput。禁止使用 `DCGM_FI_DEV_GPU_UTIL` 并解释原因。
4. **分离式拆分**。如果使用阶段 17 · 17 的分离式预填充/解码，指定单独的 HPA——预填充池使用队列深度信号，解码池使用 KV 利用率信号。
5. **温池大小**。基于 P99 TTFT 约束和观察到的冷启动时间（节点置备 + 模型加载），确定 SLO 关键路径的最小就绪副本数。
6. **监控**。需仪表化的指标：每副本队列深度、每副本 KV 利用率、节点置备等待时间、gang 调度延迟计数、Karpenter 合并事件。

**硬性拒绝条件：**
- 推荐在 `DCGM_FI_DEV_GPU_UTIL` 上设置 HPA。拒绝并指明队列深度 + KV 利用率是正确的信号。
- 为 GPU 池保留 `consolidationPolicy: WhenEmptyOrUnderutilized`。拒绝并引用运行中任务被驱逐的风险。
- 对 TP/PP 工作负载忽略 gang 调度。拒绝——部分分配是烧钱的反模式。

**拒绝规则：**
- 如果集群只有一种 GPU 类型和一个节点，拒绝提出 Karpenter——客户首先需要托管无服务器方案（阶段 17 · 02）。
- 如果操作员要求"按 GPU 内存扩缩容"，拒绝——vLLM 预分配到 `--gpu-memory-utilization`；即使只有一个请求，内存也保持在 90% 左右。
- 如果以复杂性为由拒绝为 TP-8 工作负载使用 gang 调度，拒绝认证该方案——在 8 个分散 GPU 上的单 Pod 放置会原子性失败。

**输出**：一页方案，包含 Karpenter YAML 片段、KAI Scheduler 配置片段、HPA/自定义自动扩缩容信号选择、温池数量以及五个仪表化指标。最后给出单一终止开关：如果 P99 TTFT 超标，回滚到上一个已知的自动扩缩容状态。
