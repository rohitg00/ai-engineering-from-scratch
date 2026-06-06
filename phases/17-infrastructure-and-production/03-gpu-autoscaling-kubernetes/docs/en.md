# GPU Autoscaling on Kubernetes — Karpenter, KAI Scheduler, Gang Scheduling

> Three layers, not one. Karpenter provisions nodes dynamically (under one minute, 40% faster than Cluster Autoscaler). KAI Scheduler handles gang scheduling, topology awareness, and hierarchical queues — it prevents the 7-of-8 partial allocation trap where seven nodes wait and burn on one missing GPU. Application-level autoscalers (NVIDIA Dynamo Planner, llm-d Workload Variant Autoscaler) scale on inference-specific signals — queue depth, KV cache utilization — not CPU/DCGM duty cycle. The classic HPA trap is that `DCGM_FI_DEV_GPU_UTIL` is a duty-cycle measurement: 100% could be 10 requests or 100. vLLM pre-allocates KV cache memory, so memory never triggers scale-down. This lesson teaches you to compose the three layers and avoid the default Karpenter `WhenEmptyOrUnderutilized` policy that terminates running GPU jobs mid-inference.

**Type:** Learn
**Languages:** Python (stdlib, toy queue-depth autoscaler simulator)
**Prerequisites:** Phase 17 · 02 (Inference Platform Economics), Phase 17 · 04 (vLLM Serving Internals)
**Time:** ~75 minutes

## Learning Objectives

- Diagram the three autoscaling layers (node provisioning, gang scheduling, application-level) and name the tool used at each layer.
- Explain why `DCGM_FI_DEV_GPU_UTIL` is the wrong HPA signal for vLLM and name two replacements (queue depth, KV cache utilization).
- Describe gang scheduling and the partial-allocation failure mode KAI Scheduler prevents (7 of 8 GPUs idle).
- Name the Karpenter consolidation policy (`WhenEmptyOrUnderutilized`) that terminates running GPU jobs and state the 2026 safe alternative.

## The Problem

Your team ships an LLM-serving service on Kubernetes. You set up HPA with `DCGM_FI_DEV_GPU_UTIL` as the signal. The service pins at 100% utilization during business hours. HPA never scales up — it already thinks you're full. You add a replica manually; TTFT drops. HPA still doesn't scale. The signal is lying to you.

Separately, you use Cluster Autoscaler for nodes. A 1M-token prompt arrives at 2 a.m.; the cluster spends 3 minutes provisioning a node, and the request times out.

Separately again, you deploy a 70B model requiring 8 GPUs across 2 nodes. The cluster has 7 GPUs free and 1 spread across 3 nodes. Cluster Autoscaler provisions a node for the 1 missing GPU. Seven nodes wait 4 minutes burning money while Kubernetes gets the last GPU up.

Three layers, three different failure modes. GPU-aware autoscaling in 2026 is not "turn on HPA." It's composing node provisioning, gang scheduling, and application-signal autoscaling.

## The Concept

### Layer 1 — node provisioning (Karpenter)

Karpenter watches pending pods and provisions nodes within ~45-60 seconds (Cluster Autoscaler typically takes 90-120 seconds for GPU nodes). It picks instance types dynamically per the `NodePool` constraint — if your pod needs 8 H100s and the cluster has no matching node, Karpenter provisions one directly instead of scaling an existing group.

**The consolidation trap**: Karpenter's default `consolidationPolicy: WhenEmptyOrUnderutilized` is dangerous for GPU pools. It will terminate a running GPU node to migrate pods to a cheaper right-sized instance. For inference workloads that means evicting running requests and reloading a 70B model on the new node. Loss is minutes of capacity plus request failures.

Safe setting for GPU pools:

```yaml
disruption:
  consolidationPolicy: WhenEmpty
  consolidateAfter: 1h
```

Lets Karpenter consolidate truly empty nodes after an hour but never evict a running job.

### Layer 2 — gang scheduling (KAI Scheduler)

KAI Scheduler (project "Karp" then renamed) handles what default kube-scheduler does not:

**Gang scheduling** — schedule all-or-nothing. A distributed inference pod requiring 8 GPUs either all 8 start together or none do. Without this, you get the partial-allocation trap: 7 of 8 pods start, wait indefinitely, burn money.

**Topology awareness** — know which GPUs share NVLink, which sit on the same rack, which have InfiniBand between them. Place pods accordingly. A DeepSeek-V3 67B tensor-parallel workload must stay on one NVLink domain; KAI Scheduler respects that.

**Hierarchical queues** — multiple teams compete for the same GPU pool with priority and quota. Team A's production pinch gets preempted by Team B's training job only if priority rules allow.

KAI is deployed alongside kube-scheduler as a secondary scheduler; you annotate workloads to use it. Ray and vLLM production-stack both integrate.

### Layer 3 — application-level signals

**The HPA trap**: `DCGM_FI_DEV_GPU_UTIL` is a duty-cycle metric — it measures whether the GPU was doing work at each sampling interval. 100% utilization could mean 10 concurrent requests or 100; the GPU was busy either way. Scaling on duty cycle is scaling blindly.

Worse, vLLM and similar engines pre-allocate KV cache memory (up to `--gpu-memory-utilization`). Memory usage stays near 90% even at one request. Memory-based HPA never scales down.

**2026 replacement signals**:

- Queue depth (number of requests waiting for prefill).
- KV cache utilization (what fraction of blocks are allocated to active sequences).
- Per-replica P99 TTFT (your SLA signal).
- Goodput (requests meeting all SLOs per second).

NVIDIA Dynamo Planner and llm-d Workload Variant Autoscaler consume these signals and scale replicas. They replace HPA entirely for LLM serving.

### When to use what

| Scale decision | Tool |
|----------------|------|
| Add/remove nodes | Karpenter |
| Schedule multi-GPU jobs | KAI Scheduler |
| Add/remove replicas | Dynamo Planner / llm-d WVA (or custom HPA on queue depth) |
| Choose GPU type | Karpenter NodePool |
| Preempt low-priority | KAI Scheduler queues |

### Disaggregated prefill/decode complicates everything

If you run disaggregated prefill/decode (Phase 17 · 17), you have two pod classes with different scaling triggers: prefill pods scale on queue depth, decode pods scale on KV cache pressure. llm-d exposes these as separate `Services` with per-role HPA. Do not try to put a single HPA in front of both.

### Cold start matters here too

Cold-start mitigation (Phase 17 · 10) is where node provisioning time becomes user-visible. Karpenter's 45-60 second warm-up plus a 20GB model load plus engine init means a from-zero request takes 2-5 minutes. Keep a warm pool (`min_workers=1`) for SLO-critical paths, or use Modal-style checkpointing at application layer.

### Numbers you should remember

- Karpenter node provisioning: ~45-60s vs Cluster Autoscaler ~90-120s (GPU nodes).
- KAI Scheduler prevents partial-allocation waste — 7-of-8 trap.
- `DCGM_FI_DEV_GPU_UTIL` as HPA signal: broken; use queue depth or KV utilization.
- Karpenter `WhenEmptyOrUnderutilized`: terminates running GPU jobs. Use `WhenEmpty + consolidateAfter: 1h` for inference.

## Use It

`code/main.py` simulates a three-layer autoscaler on a bursty GPU workload. Compares naive HPA (duty cycle), queue-depth HPA, and KAI-gang-scheduled scaling. Reports unmet requests, idle-GPU minutes, and a composite score.

## Ship It

This lesson produces `outputs/skill-gpu-autoscaler-plan.md`. Given cluster topology, workload shape, and SLO, it designs a three-layer autoscaling plan.

## Exercises

1. Run `code/main.py`. Under a bursty workload, how many requests does naive duty-cycle HPA drop that queue-depth HPA catches? Where does the difference come from?
2. Design a Karpenter NodePool for a cluster serving Llama 3.3 70B FP8 on H100 SXM5. Specify `capacity-type`, `disruption.consolidationPolicy`, `consolidateAfter`, and a taint that keeps non-GPU workloads off these nodes.
3. Your team reports that deployments are stuck in Pending because "GPUs available but pod won't schedule." Diagnose — is this Karpenter, kube-scheduler, or KAI Scheduler? Which metrics confirm?
4. Pick a signal to autoscale disaggregated prefill pods and a different signal for decode pods. Justify both.
5. Compute the cost of the `WhenEmptyOrUnderutilized` consolidation trap on a 24x7 production service that averages 60 request-dropping events/day at P99 TTFT > 10s.

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Karpenter | "the node provisioner" | Kubernetes node autoscaler; sub-minute provisioning |
| Cluster Autoscaler | "the old scaler" | Kubernetes node autoscaler predecessor; slower, group-based |
| KAI Scheduler | "the GPU scheduler" | Secondary scheduler for gang + topology + queues |
| Gang scheduling | "all or nothing" | Schedule N pods atomically or defer all of them |
| Topology awareness | "rack-aware" | Place pods based on NVLink/IB/rack placement |
| `DCGM_FI_DEV_GPU_UTIL` | "GPU utilization" | Duty-cycle metric; NOT a scaling signal for LLMs |
| Queue depth | "waiting requests" | Correct HPA signal for prefill-bound scaling |
| KV cache utilization | "memory pressure" | Correct HPA signal for decode-bound scaling |
| Consolidation | "Karpenter consolidation" | Node termination to cheaper instance type |
| `WhenEmpty + 1h` | "safe consolidation" | Policy that doesn't evict running GPU jobs |

## Further Reading

- [KAI Scheduler GitHub](https://github.com/kai-scheduler/KAI-Scheduler) — design docs and configuration examples.
- [Karpenter Disruption Controls](https://karpenter.sh/docs/concepts/disruption/) — consolidation policy semantics and GPU-safe defaults.
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/) — Dynamo Planner scaling signals.
- [Ray docs — KAI Scheduler for RayClusters](https://docs.ray.io/en/latest/cluster/kubernetes/k8s-ecosystem/kai-scheduler.html) — Ray integration pattern.
- [AWS EKS Compute and Autoscaling Best Practices](https://docs.aws.amazon.com/eks/latest/best-practices/aiml-compute.html) — managed-Kubernetes-specific guidance.
- [llm-d GitHub](https://github.com/llm-d/llm-d) — Workload Variant Autoscaler design.
