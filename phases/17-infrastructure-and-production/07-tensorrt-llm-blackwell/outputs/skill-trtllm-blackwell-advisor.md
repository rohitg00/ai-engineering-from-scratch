---
name: trtllm-blackwell-advisor
description: Decide whether Blackwell + TensorRT-LLM + Dynamo is worth the NVIDIA-lock for a given workload and budget.
version: 1.0.0
phase: 17
lesson: 07
tags: [tensorrt-llm, blackwell, b200, gb200, nvfp4, fp8, dynamo]
---

Given a workload (model size, active params, annual token volume, quality sensitivity — reasoning-heavy or routine), current infra (H100/H200/B200 GPUs, serving engine), and budget, produce a Blackwell + TRT-LLM migration advisory.

Produce:

1. Current baseline. Compute current $/M tokens and annual spend from reported volume and per-GPU-hour pricing. Flag if baseline is already on Blackwell + TRT-LLM.
2. Target stack. Recommend exact precision mix (weights: NVFP4 or FP8; KV cache: FP8; activations: NVFP4; accumulator: FP32). For reasoning-heavy workloads, recommend FP8 weights first, NVFP4 only after per-block calibration validated on the eval set.
3. Expected savings. From the 2026 cost shape: H100 + vLLM ~$0.09/M → B200 + TRT-LLM ~$0.02/M → GB200 NVL72 + Dynamo ~$0.012/M. Project annual savings for the workload's token volume.
4. Migration cost. Engineering time (10-30 engineer-weeks for first migration). Quality-validation pass. GPU CapEx or rental commitment.
5. Break-even horizon. Months of production needed to amortize migration. If > 18 months, flag as marginal.
6. Lock-in risk. TRT-LLM is NVIDIA-only. Name two exit strategies (dual-stack with vLLM on H100 for iteration tier; keep weights exportable to GGUF/HF for portability to non-NVIDIA).

Hard rejects:
- Recommending NVFP4 weights on reasoning-heavy models without an eval-set validation step.
- Claiming the 7x gap without naming the token volume the math assumes.
- Ignoring quality validation for FP4 weight conversion. Always run.

Refusal rules:
- If annual inference spend < $500K, refuse migration. The engineering cost does not amortize. Stay on vLLM + Hopper.
- If the team has any AMD/Intel GPUs in serving, refuse TRT-LLM for the multi-vendor tier. Recommend vLLM on mixed hardware.
- If model quality on task is already marginal, refuse aggressive quantization. Stay FP8 or BF16.

Output: a one-page Blackwell advisory listing current baseline, target stack, expected savings, migration cost, break-even horizon, and lock-in exit plan. End with a "what to read next" paragraph naming the MLPerf v6.0 blog, the TRT-LLM overview, or the Dynamo announcement depending on the primary gap.
