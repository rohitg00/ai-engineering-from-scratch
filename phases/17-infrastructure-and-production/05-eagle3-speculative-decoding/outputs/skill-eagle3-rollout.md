---
name: eagle3-rollout
description: Produce a staged EAGLE-3 speculative-decoding rollout plan that measures acceptance rate alpha on real traffic before shipping.
version: 1.0.0
phase: 17
lesson: 05
tags: [speculative-decoding, eagle-3, vllm, alpha, production-rollout]
---

Given a target model, hardware (GPU type and count), traffic description (general chat / code / specialized), concurrency target, and current baseline metrics (TTFT, ITL, throughput), produce a staged EAGLE-3 rollout plan.

Produce:

1. Baseline measurement plan. Which benchmark (LLMPerf, GenAI-Perf, or production shadow), which prompt distribution, which concurrency point, which metrics to record (TTFT mean/P99, ITL mean/P99, throughput, concurrency).
2. Draft-head selection. ShareGPT-trained EAGLE-3 for general chat. Domain-trained EAGLE-3 for specialized traffic (code, medical, legal) or the decision to train one before shipping.
3. Config. Exact vLLM `speculative_config` fields (method, model, num_speculative_tokens). Note the v0.18.0 compatibility: draft-model speculation cannot combine with `--enable-chunked-prefill`; N-gram GPU spec decode in V1 is the exception.
4. Alpha gate. Target alpha >= 0.55 at production concurrency. Measurement procedure: shadow traffic for 24 hours, log vLLM `spec_decode_metrics`, divide accepted tokens by requested draft length. Kill switch if alpha drops below 0.45 in any 1-hour window.
5. Tail watch. Plot P99 ITL delta (spec on - spec off). If delta is positive, the rejected-draft two-pass pattern is biting. Reduce K or disable on this workload.
6. Break-even check. At reported concurrency, compute break-even alpha for current verify overhead. Ship only if measured alpha clears break-even by at least 0.1.

Hard rejects:
- Shipping without measuring alpha on production traffic. Refuse and require a 24-hour shadow measurement.
- Claiming 2-3x speedup without naming the measured alpha.
- Enabling speculative decoding for offline batch jobs where latency is not the constraint.
- Combining draft-model speculation with chunked prefill on vLLM v0.18.0. Hard incompatibility.

Refusal rules:
- If traffic is primarily very short outputs (under 50 tokens mean), refuse. Draft overhead dominates; ship plain target.
- If hardware is consumer (RTX 4090 / 5090) and batch size stays under 8, recommend plain target — batch-amortization of verify overhead needs concurrency the hardware cannot supply.
- If the user wants auto-tune of K without a measurement loop, refuse. K is chosen from measured alpha plus verify overhead; no auto-tune replaces measurement.

Output: a one-page staged rollout plan listing baseline → config → alpha gate → tail watch → break-even confirmation. End with a "what to measure next" paragraph naming either domain-specific EAGLE-3 training, lower K, or reverting to plain target depending on the diagnosis.
