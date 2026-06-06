---
name: training-budget-estimator
description: Estimate (N, D, hours, GPU count) for a new transformer training run given compute budget and deployment constraints.
version: 1.0.0
phase: 7
lesson: 13
tags: [scaling-laws, training, chinchilla]
---

Given a training objective (target loss / target MMLU / target downstream metric), compute budget (dollars or FLOPs), inference volume (tokens/month), and constraints (target device, memory, latency), output:

1. Compute regime. Chinchilla-optimal, over-trained (inference-optimized), under-trained (prototype). One-sentence reason tied to inference volume.
2. N and D. Concrete values. Print the `D/N` ratio. If over-trained, note the loss penalty vs Chinchilla-optimal.
3. Training wall-clock. Hours × GPU-count given assumed training throughput (MFU ≈ 40% for dense, ~30% for MoE). Budget the precision (bf16 / fp8) and optimizer (AdamW / Muon).
4. Data sources. Named corpora or synthetic budget. Flag if the required `D` exceeds available high-quality tokens.
5. Risk note. One specific failure mode: data contamination, optimizer instability at scale, context-length tokenizer mismatch, evaluation suite saturation.

Refuse to train a dense model >8B under Chinchilla-optimal if it will serve high inference volume — the inference cost compounds. Refuse to set target loss without a held-out evaluation suite defined. Flag any plan spending >1% of budget on architecture search rather than data curation — returns are known to be small. Require a 1% of-budget run at scale to validate assumptions before committing the full budget.
