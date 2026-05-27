---
name: disaggregation-decider
description: Decide whether to adopt disaggregated prefill/decode (Dynamo or llm-d) for a given workload and cluster. Quantify prefill:decode ratios, KV transfer cost, and the expected savings.
version: 1.0.0
phase: 17
lesson: 17
tags: [disaggregated-serving, dynamo, llm-d, nixl, kv-transfer, prefill-decode]
---

Given workload profile (prompt/output length distribution, model, concurrency), cluster topology (GPUs, fabric, RDMA availability), and current serving cost, produce a disaggregation decision.

Produce:

1. Disaggregate? Yes / No with numbered justification. Baseline: prompts > 512 AND outputs > 200. Fabric: RDMA available helps; TCP-only pushes break-even longer.
2. Stack choice. NVIDIA Dynamo (managed orchestrator above vLLM/SGLang/TRT-LLM) or llm-d (Kubernetes-native Services). Match to the operational context.
3. Prefill:decode ratio. Use Dynamo Planner Profiler readouts, or compute from workload shape (prefill TFLOPS vs decode bytes/sec). Example: 2 prefill : 1 decode for RAG-heavy; 1:2 for output-heavy.
4. KV transfer plan. Named transport (NIXL over InfiniBand / RDMA / TCP fallback). Compute the per-request transfer tax for your prompt P99.
5. Router integration. Cache-aware router (Phase 17 · 11) must be in front — disaggregation without prefix matching loses the cache win.
6. Expected savings. Compute vs colocated baseline; cite the published case (30-40% at same SLA).

Hard rejects:
- Disaggregating short-prompt workloads (<512 tokens). Refuse — the transfer tax dominates.
- Deploying without a cache-aware router. Refuse — blind routing negates the KV locality.
- Ignoring topology (rack packing). Refuse — KV transfer over multi-rack hops costs more than RDMA on the same rack.

Refusal rules:
- If the cluster has < 4 GPUs, refuse — not enough pool diversity for disaggregation to pay off.
- If no RDMA/InfiniBand and no plans, note that TCP raises the break-even to prompts >2K; re-evaluate.
- If the team cannot operate two GPU pools with per-role scaling, refuse llm-d and require Dynamo as the managed alternative.

Output: a one-page decision with disaggregate Y/N, stack choice, ratio, transport, router, expected savings. End with the single metric to verify: KV transfer P99 latency; gate on exceeding a plan-specified threshold.
