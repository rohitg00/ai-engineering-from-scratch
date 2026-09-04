---
name: multi-region-router
description: Design a multi-region LLM routing plan with KV-cache locality, residency boundaries, DR manifest, and a quarterly failover drill.
version: 1.0.0
phase: 17
lesson: 11
tags: [multi-region, kv-cache, routing, dr, bedrock-cri, vllm-router, llm-d, gorgo]
---

Given regions in scope, residency boundaries, expected prefix-cache diversity, and TTFT SLA, produce a multi-region routing and DR plan.

Produce:

1. Router choice. Pick cache-aware router (vLLM Router, llm-d router) and describe the KV-event channel. State the prefix-hash algorithm (e.g., 512-token rolling) and tie-breaker (least queue depth).
2. Routing policy. Regional-first or global (GORGO-style) minimization of prefill + RTT? Justify with the prompt-length distribution — long prompts (>8K tokens) benefit from cross-region routing; short prompts do not.
3. Residency partitioning. Before any optimization: which requests are bound to which regions for legal reasons (GDPR, HIPAA). Forbid cross-residency routing even when TTFT improves.
4. Commercial CRI layer. Recommend whether to enable Bedrock Cross-Region Inference or GKE Multi-Cluster Gateway as the availability layer. State clearly this layer is NOT a TTFT optimization.
5. DR manifest. Three-file minimum (HF repo + engine config + deployment manifest). Verify tokenizer, quantization configs, RoPE, chat templates, LoRA adapters are included. State the storage (S3 cross-region replication, multi-region GCS).
6. Failover drill. Quarterly cadence. Who runs it, what gets measured (RTO, RPO, cache warm-up time). Target: 30-minute RTO matched to real 2024 JPMorgan drill.

Hard rejects:
- Ignoring residency for routing optimization. Refuse — GDPR violation beats TTFT gain.
- Claiming Bedrock CRI "solves" cross-region routing. Refuse — CRI is availability, not TTFT.
- Backing up weights only. Refuse — name the 32% DR failure statistic and require the three-file manifest.

Refusal rules:
- If only one region is in scope, decline the plan — single-region has different failure modes (Phase 17 · 03 covers it).
- If residency and TTFT SLA are incompatible (e.g., EU residency forcing prefill on cold prefix per request with P99 TTFT < 100 ms on 8K prompts), refuse to promise the SLA and escalate the product requirement.

Output: a one-page plan naming router, routing policy, residency partitions, CRI layer posture, DR manifest, quarterly drill owner. End with the single metric to alert on: cross-region prefix-cache hit rate dropping below a plan-specified threshold.
