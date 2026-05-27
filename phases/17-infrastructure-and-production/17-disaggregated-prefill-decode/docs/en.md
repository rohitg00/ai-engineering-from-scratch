# Disaggregated Prefill/Decode — NVIDIA Dynamo and llm-d

> Prefill is compute-bound; decode is memory-bound. Running both on the same GPU wastes one resource. Disaggregation splits them onto separate pools and transfers KV cache between them over NIXL (RDMA/InfiniBand or TCP fallback). NVIDIA Dynamo (GTC 2025 announce, 1.0 GA) sits above vLLM/SGLang/TRT-LLM — its Planner Profiler + SLA Planner auto-rate-match prefill:decode ratios to meet SLOs. NVIDIA publishes throughput gains in this ballpark — developer.nvidia.com (2025-06) shows a ~6x improvement for DeepSeek-R1 MoE on GB200 NVL72 + Dynamo in the medium-latency regime, and the Dynamo product page (developer.nvidia.com, undated) advertises up to 50x MoE throughput on GB300 NVL72 + Dynamo vs Hopper. The "30x" figure is a community aggregate across full-stack Blackwell + Dynamo + DeepSeek-R1 reports; we have not found a single primary source stating exactly 30x, so treat it as a directional claim. llm-d (Red Hat + AWS) is Kubernetes-native: prefill / decode / router as independent Services with per-role HPA. llm-d 0.5 adds hierarchical KV offloading, cache-aware LoRA routing, UCCL networking, scale-to-zero. Economics: internal rollup of multiple customer disclosures suggests 30–40% savings on $2M-class inference spend (i.e., $600-800K/year) when switching from colocated serving to disaggregated with Dynamo at constant SLA; the specific $2M→$600-800K figure is an internal composite, not a single published case study — use it as an order-of-magnitude anchor, not a reference citation. Short prompts (<512 tokens, short output) don't justify the transfer cost.

**Type:** Learn
**Languages:** Python (stdlib, toy disaggregated-vs-colocated simulator)
**Prerequisites:** Phase 17 · 04 (vLLM Serving Internals), Phase 17 · 08 (Inference Metrics)
**Time:** ~75 minutes

## Learning Objectives

- Explain why prefill and decode have different optimal GPU allocations and quantify the waste under colocation.
- Diagram the disaggregated architecture: prefill pool, decode pool, KV transfer via NIXL, router.
- Name the condition when disaggregation does NOT pay off (short prompts, short outputs).
- Distinguish NVIDIA Dynamo (stack-above) from llm-d (Kubernetes-native) and match each to an operational context.

## The Problem

You run Llama 3.3 70B on 8 H100s. Under mixed workload (long prompts + short outputs), GPUs idle during decode because most of the compute was spent on prefill. Under different workload (short prompts + long outputs), the opposite happens. Colocated prefill + decode means you over-provision both.

Budget impact: 20-40% of GPU time is wasted on the wrong resource. You are buying H100 compute to run memory-bound decode, or buying H100 HBM bandwidth to run compute-bound prefill. Both are expensive waste.

Disaggregation splits prefill and decode onto separate pools sized for each's bottleneck. KV cache transfers from prefill pool to decode pool via high-bandwidth interconnect.

## The Concept

### Why the bottlenecks differ

**Prefill** — run the transformer over the full input prompt in one forward. Matrix multiplications dominate; compute-bound. H100 FP8 gives ~2000 TFLOPS of useful throughput. Batch efficiency is good — one forward processes many tokens.

**Decode** — generate one token at a time, reading the full weights each iteration. Memory-bandwidth-bound. HBM3 gives ~3 TB/s. Batch efficiency is good only at high concurrency — the weights read amortizes across the batch.

Colocating them: you buy GPUs optimized for both. H100 is good at both but costs the same either way. At scale, you want prefill pool on H100 / compute-heavy; decode pool on H200 / memory-heavy, or with aggressive quantization.

### The architecture

```
            ┌──────────────┐
  Request → │    Router    │ ───────────────────────┐
            └──────┬───────┘                        │
                   │                                │
                   ▼ (prompt only)                  │
            ┌──────────────┐    KV cache    ┌───────▼──────┐
            │ Prefill pool │ ─── NIXL ────► │ Decode pool  │
            │  (compute)   │                │  (memory)    │
            └──────────────┘                └──────┬───────┘
                                                   │ tokens
                                                   ▼
                                                 Client
```

NIXL is NVIDIA's inter-node transport. Uses RDMA/InfiniBand when available, TCP fallback otherwise. Transfer latency is real — typically 20-80 ms for KV cache of a 4K-token prompt on 70B FP8. This is why short prompts don't justify disaggregation: the transfer tax exceeds the savings.

### Dynamo vs llm-d

**NVIDIA Dynamo** (GTC 2025 announce, 1.0 GA):
- Sits above vLLM, SGLang, TRT-LLM as an orchestrator.
- Planner Profiler measures workload, SLA Planner auto-configures prefill:decode ratios.
- Rust core, Python extensibility.
- Throughput gains: NVIDIA reports 6x for DeepSeek-R1 MoE on GB200 NVL72 + Dynamo in the medium-latency regime (developer.nvidia.com, 2025-06); community reports of "up to 30x" on full Blackwell + Dynamo + DeepSeek-R1 stacks lack a single primary source and should be treated as directional.
- GB300 NVL72 + Dynamo: up to 50x MoE throughput vs Hopper per the Dynamo product page (developer.nvidia.com, undated).

**llm-d** (Red Hat + AWS, Kubernetes-native):
- Prefill / decode / router as independent Kubernetes Services.
- Per-role HPA with queue depth (prefill) / KV utilization (decode) signals.
- `topologyConstraint packDomain: rack` packs prefill+decode cliques on the same rack for high-bandwidth KV transfer.
- llm-d 0.5 (2026): hierarchical KV offloading, cache-aware LoRA routing, UCCL networking, scale-to-zero.

Use Dynamo if you want a managed stack-above orchestrator. Use llm-d if you want Kubernetes-native primitives and are committed to the CNCF ecosystem.

### Economics

Internal composite (not a single published case study — order-of-magnitude anchor):

- $2M/year inference spend on colocated serving.
- Switched to disaggregated with Dynamo.
- Same request volume, same P99 latency SLA.
- Reported savings: $600K–$800K/year (30–40% reduction).
- No new hardware.

We synthesize this figure from multiple customer disclosures rather than a single citable case study; closest published data point is Baseten's 2x faster TTFT / 61% higher throughput with Dynamo KV routing (baseten.co, 2025-10), and VAST + CoreWeave's projection of 60–130% more tokens/$ at 40–60% KV hit rate (vastdata.com, 2025-12). The savings come from right-sizing each pool; prefill-heavy workloads (RAG with 8K+ prefixes) benefit more than balanced ones.

### When NOT to disaggregate

- Prompts < 512 tokens and outputs < 200 tokens: transfer tax dominates gain.
- Small cluster (< 4 GPUs): not enough pool diversity.
- Team cannot operate two GPU pools with per-role scaling: Dynamo helps but not trivially.
- No RDMA fabric: TCP transfer tax is heavier.

### The router integrates with Phase 17 · 11

Disaggregated routers are KV-cache-aware (Phase 17 · 11). A request lands on the decode pool holding its prefix — if no match, it flows prefill → decode. Hit rate and disaggregation compound — the cache-aware router determines whether a new prefill is even needed.

### MoE on Blackwell is where the real numbers are

GB300 NVL72 + Dynamo shows 50x MoE throughput over Hopper baselines. MoE expert routing is compute-heavy on prefill but memory-heavy on decode (expert caches), so disaggregation is a double win. 2026 frontier model serving is MoE-dominant (DeepSeek-V3, future GPT-5 variants).

### Numbers you should remember

Benchmark numbers drift — NVIDIA and the inference stack post updated results every quarter. Re-check before quoting.

- DeepSeek-R1 on GB200 NVL72 + Dynamo: ~6x throughput vs baseline in the medium-latency regime (developer.nvidia.com, 2025-06); community "up to 30x" claims on full Blackwell + Dynamo stacks are directional aggregates without a single primary source.
- GB300 NVL72 + Dynamo: up to 50x MoE throughput vs Hopper (developer.nvidia.com, undated).
- Savings anchor (internal composite, not a single case study): $600-800K/year off a $2M annual spend at constant SLA.
- Disaggregation threshold: prompts >512 tokens + outputs >200 tokens.
- KV transfer via NIXL: 20-80 ms for 4K-prompt KV on 70B FP8.

## Use It

`code/main.py` simulates colocated vs disaggregated serving. Reports throughput, cost per request, and the prompt-length crossover.

## Ship It

This lesson produces `outputs/skill-disaggregation-decider.md`. Given workload and cluster, decides whether to disaggregate.

## Exercises

1. Run `code/main.py`. At what prompt length does disaggregation beat colocation?
2. Design the prefill pool and decode pool for a RAG service with P99 prefix length 8K, output 300.
3. Dynamo vs llm-d: pick one for a pure-Kubernetes shop with no Python runtime preference.
4. Compute KV transfer cost: 4K prefill on 70B FP8 = ~500 MB KV. At RDMA 100 GB/s, transfer = 5 ms. At TCP 10 GB/s = 50 ms. Which matters for your SLA?
5. MoE expert routing changes KV access patterns. How does disaggregation behave with MoE that activates different experts per token?

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Disaggregated serving | "split prefill/decode" | Separate GPU pools for each phase |
| NIXL | "NVIDIA transport" | Dynamo's inter-node KV transfer (RDMA/TCP) |
| NVIDIA Dynamo | "the orchestrator" | Stack-above coordinator for vLLM/SGLang/TRT-LLM |
| llm-d | "Kubernetes native" | Red Hat + AWS K8s disaggregated stack |
| Planner Profiler | "Dynamo auto-config" | Measures workload, configures pool ratios |
| SLA Planner | "Dynamo policy" | Auto-rate-matches prefill:decode to meet SLOs |
| `packDomain: rack` | "llm-d topology" | Pack prefill+decode on same rack for fast KV |
| UCCL | "unified collective" | llm-d 0.5 networking layer for scale-to-zero |
| MoE expert routing | "expert per token" | DeepSeek-V3 pattern; disaggregation helps |

## Further Reading

- [NVIDIA — Introducing Dynamo](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/)
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/)
- [TensorRT-LLM Disaggregated Serving blog](https://nvidia.github.io/TensorRT-LLM/blogs/tech_blog/blog5_Disaggregated_Serving_in_TensorRT-LLM.html)
- [llm-d GitHub](https://github.com/llm-d/llm-d)
- [llm-d 0.5 release notes](https://github.com/llm-d/llm-d/releases)
