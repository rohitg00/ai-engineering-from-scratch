---
name: training-budget-estimator
description: compute budget と deployment constraints に基づき、新しい transformer training run の (N, D, hours, GPU count) を見積もる。
version: 1.0.0
phase: 7
lesson: 13
tags: [scaling-laws, training, chinchilla]
---

training objective (target loss / target MMLU / target downstream metric)、compute budget (dollars または FLOPs)、inference volume (tokens/month)、constraints (target device, memory, latency) が与えられたら、次を出力します。

1. Compute regime。Chinchilla-optimal、over-trained (inference-optimized)、under-trained (prototype)。inference volume に結びつく一文の理由。
2. N と D。具体的な値。`D/N` ratio を出力します。over-trained の場合は Chinchilla-optimal に対する loss penalty を記します。
3. Training wall-clock。仮定した training throughput (dense は MFU ≈ 40%、MoE は ~30%) に基づく hours × GPU-count。precision (bf16 / fp8) と optimizer (AdamW / Muon) を budget に含めます。
4. Data sources。名前付き corpora または synthetic budget。必要な `D` が利用可能な高品質 tokens を超える場合は flag します。
5. Risk note。具体的な failure mode を 1 つ: data contamination、scale での optimizer instability、context-length tokenizer mismatch、evaluation suite saturation。

高い inference volume で serving する予定の dense model >8B を Chinchilla-optimal 未満で学習する計画は拒否してください。inference cost が複利的に効くためです。held-out evaluation suite が定義されていない target loss 設定は拒否してください。architecture search に budget の >1% を使い、data curation ではない計画は flag してください。returns は小さいことが知られています。full budget を投入する前に、仮定を検証するため budget の 1% の scale run を要求してください。
