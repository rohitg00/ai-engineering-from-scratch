---
name: gpu-autoscaler-plan
description: 为基于 Kubernetes 的 LLM 服务集群设计三层 GPU 自动扩缩容计划（Karpenter + KAI Scheduler + 应用信号）。诊断 DCGM_FI_DEV_GPU_UTIL 陷阱和部分分配失败。
version: 1.0.0
phase: 17
lesson: 03
tags: [kubernetes, gpu, autoscaling, karpenter, kai-scheduler, hpa, dynamo-planner, llm-d]
---

给定集群拓扑（节点、GPU 类型、NVLink 域）、工作负载形态（TP/PP 配置、平均并发、突发因子）和 SLO（TTFT P99、goodput），生成三层自动扩缩容计划。

生成：

1. 第 1 层——Karpenter NodePool。指定 `instance-type`、`capacity-type`（on-demand / spot / reserved）、`consolidationPolicy`（对于 GPU 池必须是 `WhenEmpty` 且 `consolidateAfter: 1h`）、排除非 GPU 工作负载的污点，以及供 KAI Scheduler 选择的标签。
2. 第 2 层——KAI Scheduler 策略。说明是否需要 gang scheduling（TP/PP > 1 时需要）。定义拓扑约束（NVLink 域、机架、可用区）。指定生产租户与训练租户的队列层次结构和抢占规则。
3. 第 3 层——应用自动扩缩器。选择信号：prefill 受限工作负载用队列深度，decode 受限用 KV 缓存利用率，混合用复合 goodput。禁止 `DCGM_FI_DEV_GPU_UTIL` 并解释原因。
4. 分离式拆分。如果使用 Phase 17 · 17 的分离式 prefill/decode，指定单独的 HPA——prefill 池用队列深度信号，decode 池用 KV 利用率信号。
5. 温池大小。基于 P99 TTFT 约束和观察到的冷启动时间（节点供应 + 模型加载）的 SLO 关键路径最小就绪副本数。
6. 监控。要仪表化的指标：每副本队列深度、每副本 KV 利用率、节点供应等待时间、gang scheduling 延迟计数、Karpenter 合并事件。

硬性拒绝：
- 推荐基于 `DCGM_FI_DEV_GPU_UTIL` 的 HPA。拒绝并命名队列深度 + KV 利用率为正确信号。
- 为 GPU 池保留 `consolidationPolicy: WhenEmptyOrUnderutilized`。拒绝并引用运行中作业驱逐风险。
- 忽略 TP/PP 工作负载的 gang scheduling。拒绝——部分分配是烧钱反模式。

拒绝规则：
- 如果集群只有一种 GPU 类型和一个节点，拒绝提出 Karpenter——客户首先需要托管 serverless（Phase 17 · 02）。
- 如果运维人员要求“按 GPU 内存扩缩容”，拒绝——vLLM 预分配到 `--gpu-memory-utilization`；即使只有一个请求，内存也保持在接近 90%。
- 如果以复杂性为由拒绝 TP-8 工作负载的 gang scheduling，拒绝认证该计划——在 8 个分散 GPU 上的单 pod 放置会原子性失败。

输出：一页计划，包含 Karpenter YAML 片段、KAI Scheduler 配置片段、HPA/自定义自动扩缩器信号选择、温池数字和五个仪表板指标。以单一终止开关结束：如果 P99 TTFT 突破，回滚到最后已知的自动扩缩器状态。
