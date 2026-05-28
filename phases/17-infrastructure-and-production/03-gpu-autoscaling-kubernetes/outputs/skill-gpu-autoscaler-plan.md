---
name: gpu-autoscaler-plan
description: Kubernetes-based LLM serving cluster のために、three-layer GPU autoscaling plan（Karpenter + KAI Scheduler + application signals）を設計する。DCGM_FI_DEV_GPU_UTIL trap と partial-allocation failure を診断する。
version: 1.0.0
phase: 17
lesson: 03
tags: [kubernetes, gpu, autoscaling, karpenter, kai-scheduler, hpa, dynamo-planner, llm-d]
---

cluster topology（nodes、GPU types、NVLink domains）、workload shape（TP/PP config、average concurrency、burst factor）、SLO（TTFT P99、goodput）を受け取り、three-layer autoscaling plan を作成する。

作成するもの:

1. Layer 1 — Karpenter NodePool。`instance-type`、`capacity-type`（on-demand / spot / reserved）、`consolidationPolicy`（GPU pools では必ず `WhenEmpty` with `consolidateAfter: 1h`）、non-GPU workloads を除外する taints、KAI Scheduler selection 用 labels を指定する。
2. Layer 2 — KAI Scheduler policy。gang scheduling が必要かを述べる（TP/PP > 1 なら yes）。topology constraint（NVLink domain、rack、zone）を定義する。production vs training tenants の queue hierarchy と preemption rules を指定する。
3. Layer 3 — Application autoscaler。signal を選ぶ: prefill-bound workloads なら queue depth、decode-bound なら KV cache utilization、mixed なら composite goodput。`DCGM_FI_DEV_GPU_UTIL` を禁止し、その理由を説明する。
4. Disaggregated split。Phase 17 · 17 の disaggregated prefill/decode を使う場合、separate HPAs を指定する。prefill pool は queue depth signal、decode pool は KV utilization signal。
5. Warm-pool sizing。P99 TTFT constraint と observed cold-start time（node provision + model load）に基づく、SLO-critical paths の minimum ready replicas。
6. Monitoring。dashboard する metrics: per-replica queue depth、per-replica KV utilization、node provision wait time、gang-scheduling deferral count、Karpenter consolidation events。

Hard rejects:
- `DCGM_FI_DEV_GPU_UTIL` 上の HPA を推奨すること。拒否し、queue depth + KV utilization を正しい signal として挙げる。
- GPU pool で `consolidationPolicy: WhenEmptyOrUnderutilized` を残すこと。拒否し、running-job-eviction risk を引用する。
- TP/PP workload で gang scheduling を無視すること。拒否する。partial allocation は cost を燃やす anti-pattern。

Refusal rules:
- cluster に GPU type が1つ、node が1つしかない場合、Karpenter 提案を辞退する。customer はまず managed serverless（Phase 17 · 02）を必要としている。
- operator が「GPU memory で scale」したいと言う場合は拒否する。vLLM は `--gpu-memory-utilization` まで事前確保し、1 request でも memory は90%近くに留まる。
- TP-8 workload で complexity を理由に gang scheduling を断る場合、plan の認証を拒否する。8つの散らばった GPU への single-pod placement は atomically に失敗する。

Output: Karpenter YAML snippet、KAI Scheduler config snippet、HPA/custom autoscaler signal choice、warm-pool number、5つの dashboard metrics を含む1ページの plan。最後に single kill-switch を置く: P99 TTFT が breach したら last-known autoscaler state に roll back する。
