# Multi-Region LLM Serving and KV Cache Locality

> Round-robin load balancing is actively harmful for cached LLM inference. A request that does not land on the node holding its prefix pays full prefill cost — roughly 800 ms at P50 on a long prompt versus ~80 ms with a cache hit. In 2026 the production pattern is a cache-aware router (vLLM Router in Rust, llm-d router) that consumes KV-cache events and routes on prefix-hash match. Recent research (GORGO) makes cross-region network latency an explicit term in the routing objective. Commercial "cross-region inference" offerings (Bedrock cross-region inference, GKE multi-cluster gateways) treat inference as opaque — they handle availability, not TTFT. JPMorgan and Mayo Clinic ran us-east-1 failover in Nov 2024 at ~22 minutes. The DR reality: 32% of LLM DR failures are because teams backed up weights but forgot tokenizer files or quantization configs.

**Type:** Learn
**Languages:** Python (stdlib, toy prefix-cache-aware router simulator)
**Prerequisites:** Phase 17 · 04 (vLLM Serving), Phase 17 · 06 (SGLang RadixAttention)
**Time:** ~60 minutes

## Learning Objectives

- Explain why round-robin load balancing breaks cached inference and quantify the TTFT penalty.
- Diagram a cache-aware router: inputs (KV-cache events), algorithm (prefix-hash match), tie-breaker (GPU utilization).
- Name the 32% DR failure driver for LLMs (missing tokenizer files / quantization configs) and state a three-file DR checklist.
- Distinguish commercial cross-region offerings (Bedrock CRI, GKE Multi-Cluster Gateway) from KV-aware routing.

## The Problem

Your service runs in us-east-1, us-west-2, and eu-west-1. You put an ALB in front with round-robin. Prefix cache hit rate in production drops to 8%. TTFT P50 triples. Your vLLM logs show every request is paying full prefill cost.

Round-robin is optimal for stateless services. LLM inference is stateful by design — the KV cache encodes everything the model has seen. Routing blind is routing into the wrong cache.

Separately, your team has a DR plan. You back up model weights to S3 cross-region. A regional outage hits; you attempt failover; the replica refuses to start. You forgot tokenizer.json, the quantization config, and the RoPE scaling config were in a separate bucket you didn't sync.

Multi-region LLM serving is a cache problem, a routing problem, and a DR-hygiene problem — not a load-balancer problem.

## The Concept

### Cache-aware routing

Request arrives with a prompt. Router hashes the prefix (say, first 512 tokens); it asks each replica "do you have this prefix cached?". Replicas publish KV-cache events on a pub/sub channel as they allocate and evict blocks. Router picks the replica with the match, falls through to GPU-util-based tie-breaker if no one does.

**vLLM Router** (Rust, 2026 production-stack): subscribes to `kv.cache.block_added` events, maintains a prefix-hash → replica index, routes with O(1) lookup. Falls through to least-queue-depth when no match.

**llm-d router**: same pattern, Kubernetes-native. Publishes events via the ControlPlane API.

**SGLang RadixAttention** (Phase 17 · 06) is the intra-replica equivalent. Cross-replica routing is strictly upstream.

### Numbers

TTFT P50 on a 2K-token prompt, Llama 3.3 70B FP8, H100:
- Cache hit (same replica, prefix resident): ~80 ms.
- Cache miss (cold prefill): ~800 ms.

10x gap. If your router hits 60-80% of prefix cache across replicas, you approximate single-replica performance at N-replica capacity. If it hits 10%, you approximate naive scaling.

### Cross-region has a new constraint — network latency

Inter-region RTT:
- us-east-1 ↔ us-west-2: ~65 ms.
- us-east-1 ↔ eu-west-1: ~75 ms.
- us-east-1 ↔ ap-southeast-1: ~220 ms.

If routing takes a request from us-east-1 to a hot prefix in ap-southeast-1, the saved prefill (800 → 80 ms) is dwarfed by 440 ms round-trip. GORGO (2026 research) makes this explicit — minimize `prefill_time + network_latency` jointly, not prefill alone. Often the answer is to keep routing regional except on massive multi-MB prefixes where prefill dominates.

### Commercial "cross-region inference" does not help here

AWS Bedrock cross-region inference automatically routes requests to other regions during capacity pressure. It optimizes availability, not TTFT, and treats inference as opaque. GKE Multi-Cluster Gateway is the same — service-level failover, no awareness of KV cache.

You still need an app-layer cache-aware router even when using these. They handle the "us-east-1 is on fire" case. Cache-aware routing handles the TTFT case.

### DR hygiene — the 32% missing-files problem

Widely cited 2026 stat: 32% of LLM DR failures happen because teams backed up weights but forgot:

- `tokenizer.json` or `tokenizer.model`
- Quantization configs (`quantize_config.json`, AWQ scales, GPTQ zero-points)
- Model-specific configs (RoPE scaling, attention masks, chat templates)
- Engine config (`vllm_config.yaml`, sampling defaults, LoRA adapter manifests)

The fix is a three-file minimum DR manifest:

1. All files under the HF model repo (weights + configs + tokenizer).
2. Engine-specific serving config.
3. Deployment manifest (K8s YAML, Dockerfile, dependency lock).

Plus: run a DR drill quarterly. The JPMorgan us-east-1 drill hit 22 minutes recovery in Nov 2024 only because the playbook was rehearsed.

### Data residency is orthogonal

EU customer PHI cannot leave EU. If your cache-aware router sends a Paris-originated request to us-east-1 for a prefix match, you have violated GDPR regardless of TTFT gain. Partition routers by residency boundary before optimizing for cache.

### Numbers you should remember

- Cache hit vs miss TTFT gap: ~10x (80 ms vs 800 ms on 2K prompt).
- Inter-region RTT US-EU: ~75 ms.
- DR failure: 32% miss tokenizer/quant configs.
- JPMorgan us-east-1 failover Nov 2024: 22 minutes (30-min SLA).

## Use It

`code/main.py` simulates three routing strategies (round-robin, cache-aware regional, cache-aware global) on a multi-region workload. Reports cache hit rate, TTFT P50/P99, and cross-region bill.

## Ship It

This lesson produces `outputs/skill-multi-region-router.md`. Given regions, residency constraints, and SLA, designs a routing plan.

## Exercises

1. Run `code/main.py`. At what prompt length does cross-region routing beat local-only routing, given 75 ms RTT?
2. Your cache hit rate drops from 70% to 12%. Diagnose three possible causes and the observables that would confirm each.
3. Design a DR manifest for a 70B AWQ-quantized model served in vLLM with 5 LoRA adapters. List every file and config.
4. Argue whether Bedrock cross-region inference is "enough" for a fintech with strict TTFT SLOs. Cite specific behaviors.
5. A Paris-origin request matches a prefix in us-east-1. Do you route it? Write the policy.

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Cache-aware routing | "smart LB" | Route on prefix-hash match to KV-cache-holding replica |
| KV-cache events | "cache pub-sub" | Replicas publish block add/evict; router indexes |
| Prefix hash | "cache key" | Hash of first N tokens used as router lookup |
| GORGO | "cross-region routing research" | arXiv 2602.11688; network latency as explicit term |
| Cross-region inference | "Bedrock CRI" | AWS product; availability failover, not TTFT awareness |
| DR manifest | "the backup list" | Every file needed to restore — not just weights |
| Data residency | "GDPR boundary" | Legal constraint on which region sees user data |
| RTT | "round-trip time" | Network latency; 75 ms US-EU, 220 ms US-APAC |
| LLM-aware LB | "cache-hit LB" | Cache-aware router as a product category |

## Further Reading

- [BentoML — Multi-cloud and cross-region inference](https://bentoml.com/llm/infrastructure-and-operations/multi-cloud-and-cross-region-inference)
- [arXiv — GORGO (2602.11688)](https://arxiv.org/html/2602.11688v1) — cross-region KV-cache reuse with network latency term.
- [TianPan — Multi-Region LLM Serving Cache Locality](https://tianpan.co/blog/2026-04-17-multi-region-llm-serving-data-residency-routing)
- [AWS Bedrock Cross-Region Inference](https://docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference.html) — availability failover documentation.
- [vLLM Production Stack Router](https://github.com/vllm-project/production-stack) — cache-aware router source.
