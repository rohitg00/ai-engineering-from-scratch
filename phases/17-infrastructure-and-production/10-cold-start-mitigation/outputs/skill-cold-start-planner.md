---
name: cold-start-planner
description: Pick and stack cold-start mitigations for serverless LLM deployments. Budget phases (node, image, weights, engine, first forward) and match mitigations to SLA.
version: 1.0.0
phase: 17
lesson: 10
tags: [cold-start, serverless, bottlerocket, model-streamer, gpu-snapshot, warm-pool, serverlessllm]
---

Given model size, SLA (TTFT P99), traffic shape (steady vs bursty), and budget posture, produce a cold-start mitigation plan.

Produce:

1. Cold-start budget. Break down the raw cold-start path (node provision, image pull, weights to HBM, engine init, first forward). Use 2026 nominal seconds for the stated model size.
2. Layer selection. Pick the minimum number of layers that brings total below the SLA: pre-seeded image (L1), model streamer (L2), GPU snapshot (L3), warm pool (L4), tiered loading (L5). Justify each layer against the specific phase it attacks.
3. Warm-pool sizing. State `min_workers` for the primary path. If SLA is TTFT P99 < 60s on a 70B+ model, make warm pool mandatory regardless of cost.
4. Cost estimate. Monthly GPU cost for the chosen warm-pool and the expected number of cold starts per day.
5. Tail policy. What happens to the first user on a fresh replica — do they get queued to a warm replica, or do they pay the cold-start tax? Name a specific policy (e.g., "route first request to any warm replica within 10s; fall through to cold").
6. Failure mode. What happens if a warm replica dies mid-session. Is recovery automatic (live migration), or is it a cold start on the next request?

Hard rejects:
- Proposing "just add warm pool" without computing the monthly cost.
- Claiming a mitigation without a specific phase it attacks (e.g., "use Bottlerocket" without saying it eliminates the 180s image pull).
- Ignoring the per-GPU-topology constraint on GPU snapshots — if the platform migrates SKU, snapshots are invalid.

Refusal rules:
- If SLA is TTFT P99 < 5s on a fresh 70B cold start with no warm pool, refuse — mathematically impossible at 2026 infrastructure speeds.
- If budget forbids warm pool but SLA requires sub-30s cold start, name the platform-specific fix (Modal GPU snapshots, Baseten pre-warming) and refuse to promise the SLA on a different platform without it.
- If the operator asks for scale-to-zero with bursty traffic and a 70B model, refuse to promise SLA — the math does not work without snapshots or warm pools.

Output: a one-page plan listing phases, layers, `min_workers`, monthly cost, tail policy, failure mode. End with the single metric to alert on: P99 cold-start duration over the last rolling hour.
