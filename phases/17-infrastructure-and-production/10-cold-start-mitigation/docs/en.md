# Cold Start Mitigation for Serverless LLMs

> A 20 GB model image takes 5-10 minutes (7B) to 20+ minutes (70B) to go from cold to serving. In a true serverless world, that is not a warm-up — it is an outage. Mitigations operate at five layers: pre-seeded node images (Bottlerocket on AWS, dual-volume arch), model streaming (NVIDIA Run:ai Model Streamer, native in vLLM), GPU memory snapshots (Modal checkpoints, up to 10x faster restart), warm pools (`min_workers=1`), tiered loading (ServerlessLLM's NVMe→DRAM→HBM pipeline, 10-200x latency reduction), and live migration that moves input tokens (KB) rather than KV cache (GB). Modal publishes 2-4s cold starts as a floor; Baseten 5-10s default, sub-second with pre-warming. This lesson teaches you to measure, budget, and stack the five layers.

**Type:** Learn
**Languages:** Python (stdlib, toy cold-start path simulator)
**Prerequisites:** Phase 17 · 02 (Inference Platform Economics), Phase 17 · 03 (GPU Autoscaling)
**Time:** ~60 minutes

## Learning Objectives

- Enumerate the five layers of cold-start mitigation and name one tool or pattern at each layer.
- Compute total cold-start time as a sum of (node provision) + (weights download) + (weights load into HBM) + (engine init) for a 70B model.
- Explain why live migration transfers input tokens (KB) not KV cache (GB) and what the penalty is (recomputation).
- Name the warm-pool trade-off (pay for idle GPU or accept cold-start tail) and the SLA threshold at which `min_workers > 0` becomes mandatory.

## The Problem

Your serverless LLM endpoint scales to zero overnight. At 8 a.m. traffic spikes. The first request waits while:

1. Karpenter provisions a GPU node: 45-60s.
2. The container pulls a 30 GB image with weights: 120-300s.
3. The engine loads weights into HBM: 45-120s depending on model size and storage speed.
4. vLLM or TRT-LLM initializes CUDA graphs, KV cache pool, tokenizer: 10-30s.

Total: 220-510s (roughly 3-8 minutes) before one token comes back. Your SLA is 2s. You ship a warm-pool (`min_workers=1`) and the problem seems to vanish — but now you pay for one idle GPU 24x7. If your service has 5 products each with one warm replica, that's 5 × 24 × 30 = 3,600 GPU-hours/month whether or not a single user called.

Cold-start mitigation is how to keep the serverless economics while approximating the latency of always-on.

## The Concept

### Layer 1 — pre-seeded node images (Bottlerocket)

On AWS, Bottlerocket's dual-volume architecture separates OS from data. Snapshot the data volume with your container image pre-pulled; reference the snapshot ID in your `EC2NodeClass`. New nodes boot with weights already on local NVMe — steps 2 and part of 3 vanish. Works with Karpenter natively. Typical savings: 2-4 minutes per cold start for large models.

Equivalent on GCP: custom VM images with pre-baked container layers. On Azure: managed disk snapshots with the same pattern.

### Layer 2 — model streaming (Run:ai Model Streamer)

Instead of loading the full file before answering the first request, stream weights into GPU memory layer-by-layer and start processing as soon as the first transformer block is resident. The NVIDIA Run:ai Model Streamer ships native in vLLM 2026. Works with S3, GCS, and local NVMe. Cuts weight-load time roughly in half for large models by overlapping I/O with compute setup.

### Layer 3 — GPU memory snapshots (Modal)

Modal takes a checkpoint of the GPU state (weights, CUDA graphs, KV cache region) after first load. Subsequent restarts deserialize directly into HBM — 10x faster than re-initializing. This is the closest thing to "boot a warm GPU in 2 seconds." Trade-off: snapshots are per-GPU-topology, so if Karpenter migrates you to a different SKU, you re-checkpoint.

### Layer 4 — warm pools (min_workers=1)

Simplest mitigation: keep one replica always ready. Cost is one GPU's hourly rate 24x7. The arithmetic is brutal on small models (you pay $0.85-$1.50/hr to avoid a 30s cold start) and kind to large ones (pay $4/hr to avoid a 5-minute cold start). The SLA threshold where warm pools become mandatory: typically TTFT P99 < 60s on a 70B+ model.

### Layer 5 — tiered loading (ServerlessLLM)

ServerlessLLM treats storage as a hierarchy: NVMe (fast but big), DRAM (medium but tiered), HBM (tiny but instant). Weights are pre-loaded to DRAM; load-on-demand into HBM. Paper reports 10-200x latency reduction on cold loads versus naive disk-to-HBM. Production adoption is early but integrations with vLLM exist.

### Layer 6 — live migration (bonus pattern)

When a node becomes unavailable (spot eviction, node drain), traditional pattern is cold-start another replica and drain request queue. Live migration moves the input tokens (kilobytes) to a destination that has the model loaded and recomputes KV cache on the destination. Recomputation is cheaper than transferring GB of KV cache over the network. Applicable to disaggregated deployments.

### The warm-pool math

For a service with P99 TTFT SLA of 2s, the question is not "warm pool yes/no" but "how many warm replicas, and which paths get them."

- High-value interactive paths (live chat, voice agent): `min_workers=1-2`.
- Background batch paths (nightly classification): scale-to-zero accepted, 5-10 minute cold start tolerable.
- Premium tier: `min_workers` per tenant with dedicated capacity.

### Measure before optimizing

Cold-start anatomy for a 70B model on a fresh node (illustrative):

| Phase | Time | Mitigation |
|-------|------|-----------|
| Node provision | 50s | Bottlerocket + pre-seeded image, warm pool |
| Image pull | 180s | Pre-seeded data volume (eliminate) |
| Weights to HBM | 75s | Model streamer (halve); GPU snapshot (eliminate) |
| Engine init | 20s | Persistent CUDA graph cache |
| First forward | 3s | Min inherent latency |
| **Total cold** | **328s** | |
| **Total with mitigations** | **~15s** | 22x reduction |

### Numbers you should remember

- Modal cold start: 2-4s (with GPU snapshots).
- Baseten default cold start: 5-10s; sub-second with pre-warming.
- Raw 70B cold start: 3-8 minutes.
- Run:ai Model Streamer: ~2x weight-load speedup.
- ServerlessLLM tiered loading: 10-200x latency reduction (paper numbers).

## Use It

`code/main.py` models a cold-start path with and without each mitigation. Reports total cold-start time, warm-pool cost, and the break-even request rate above which warm pool pays for itself.

## Ship It

This lesson produces `outputs/skill-cold-start-planner.md`. Given SLA, model size, and traffic shape, picks which mitigations to stack.

## Exercises

1. Run `code/main.py`. Compute the break-even request rate above which a warm replica is cheaper than paying the cold-start tax via extra request drops at SLO.
2. You deploy a 13B model with P99 TTFT SLA of 3s. Pick the minimum mitigation stack (fewest layers) that achieves it.
3. Bottlerocket pre-seeding eliminates image pull but weights still load from snapshot to HBM. Compute wall-clock for a 70B model if the snapshot-backed NVMe reads at 7 GB/s.
4. Your serverless provider offers GPU snapshots (Modal) and your team refuses because "snapshots leak PII." Argue both sides — what is the realistic risk, and what is the mitigation (ephemeral snapshots, encryption, namespace isolation)?
5. Design a tiered warm-pool policy: how many warm replicas for paid users, trial users, and batch workloads? Show the math.

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Cold start | "the big pause" | Time from request to first token on a fresh replica |
| Warm pool | "always-on minimum" | `min_workers >= 1` to keep at least one replica ready |
| Pre-seeded image | "baked AMI" | Node image with container weights pre-resident |
| Bottlerocket | "AWS node OS" | AWS container-optimized OS with dual-volume snapshot support |
| Model streamer | "streaming load" | Overlap weights I/O with compute setup |
| GPU snapshot | "checkpoint to HBM" | Serialize post-load GPU state; deserialize on restart |
| Tiered loading | "NVMe + DRAM + HBM" | Hierarchy of storage tiers; load on demand |
| Live migration | "move tokens" | Transfer input (KB), recompute KV on destination |
| `min_workers` | "warm replicas" | Serverless minimum keep-alive count |
| Scale-to-zero | "full serverless" | No cost when idle; accept full cold-start tax |

## Further Reading

- [Modal — Cold start performance](https://modal.com/docs/guide/cold-start) — Modal's published benchmarks and checkpoint architecture.
- [AWS Bottlerocket](https://github.com/bottlerocket-os/bottlerocket) — pre-seeded data volume snapshot pattern.
- [NVIDIA Run:ai Model Streamer](https://github.com/run-ai/runai-model-streamer) — overlap weights load with compute setup.
- [Baseten — Cold-start mitigation](https://www.baseten.co/blog/cold-start-mitigation/) — pre-warming playbook.
- [ServerlessLLM paper (USENIX OSDI'24)](https://www.usenix.org/conference/osdi24/presentation/fu) — tiered loading design.
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/) — live migration for disaggregated deployments.
