---
name: vllm-scheduler-reader
description: Diagnose a vLLM serving config by reading the scheduler-level knobs and identifying which of PagedAttention, continuous batching, and chunked prefill is the bottleneck.
version: 1.0.0
phase: 17
lesson: 04
tags: [vllm, paged-attention, continuous-batching, chunked-prefill, serving, scheduler]
---

Given a vLLM serving config (model, dtype, hardware, `--gpu-memory-utilization`, `--max-num-batched-tokens`, `--enable-chunked-prefill`, `--speculative-model` or `--speculative-config`, max concurrency, and an observed metric set of TTFT mean/P99, ITL mean/P99, throughput tok/s), produce a scheduler-level diagnosis.

Produce:

1. Config read. For each flag, name the scheduler behavior it controls and the 2026 default. Flag any flag set to a non-default value and call out why.
2. Bottleneck identification. Classify the bottleneck as one of: PagedAttention under-provisioned (KV block starvation), continuous-batching stall (WAITING queue growth), chunked-prefill mis-sized (TTFT tail spike), decode compute-bound (ITL floor), or HBM-bound (cannot fit batch). Justify with the reported metrics.
3. Knob recommendations. Specific, ordered actions — which flag to flip, which value to try, and which metric to watch. Do not suggest "try more GPUs" without first exhausting scheduler-level tuning.
4. Compatibility check. For vLLM v0.18.0 specifically: flag the `--enable-chunked-prefill` + `--speculative-model` combination as a hard incompatibility. Recommend N-gram GPU speculative decoding in V1 as the documented exception if both are desired.
5. What to read next. Point to one of the vLLM v0.18.0 release notes, the PagedAttention paper, or the Aleksa Gordic V1 scheduler walkthrough depending on what the diagnosis surfaced.

Hard rejects:
- Diagnosing without the four core metrics (TTFT, ITL, throughput, concurrency). Refuse and ask for the metric set.
- Recommending `--enable-chunked-prefill` without checking the speculative-decoding config.
- Treating `DCGM_FI_DEV_GPU_UTIL` as a scaling signal. vLLM pre-allocates KV; duty-cycle numbers are misleading.

Refusal rules:
- If the reported throughput is under 100 tok/s on an H100, the bottleneck is likely not vLLM — check for tokenizer on client side, Python GIL, or request-level serialization.
- If `--gpu-memory-utilization` is set below 0.7, refuse to tune further — the operator chose to leave HBM on the table and the fix is to raise the ceiling before flipping scheduler flags.
- If the operator asks for a speculative-decoding + chunked-prefill recipe on draft-model speculation, refuse and name the v0.18.0 incompatibility. Point to EAGLE-3 in Phase 17 · 05 instead.

Output: a one-page scheduler diagnosis listing flags, bottleneck, ordered recommendations, compatibility notes, and a next-read pointer. End with a "what to measure next" paragraph naming one of P99 ITL, block allocation rate, or WAITING queue depth, depending on the bottleneck identified.
