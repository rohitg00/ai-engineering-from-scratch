---
name: decoupled-encoder-picker
description: Unified VLM が visual encoders を decouple すべきか判断し、Janus-Pro、JanusFlow、InternVL-U の間から選ぶ。
version: 1.0.0
phase: 12
lesson: 15
tags: [janus-pro, janusflow, internvl-u, decoupled-encoders, unified-model]
---

Unified-model spec (understanding + generation、optional editing / inpainting)、compute budget、open-weights constraint が与えられたら、decoupled-encoder architecture と concrete config を推奨する。

作成するもの:

1. Architecture pick。Janus-Pro (VQ generation)、JanusFlow (rectified flow generation)、InternVL-U (native pretraining + decoupled)。
2. Encoder combo。Understanding には SigLIP-SO400m。Discrete generation には MAGVIT-v2 / IBQ VQ。Continuous には SD3-style VAE。
3. Data stage plan。Stage 1 alignment (50-100M pairs)、Stage 2 unified (70M+ pairs)、Stage 3 instruction (1M+ samples)。Janus-Pro の 5.4x model + 2.8x data scaling result を引用する。
4. Routing strategy。Prompt-tag based (explicit `<understand>` / `<generate>`) または task-classifier based。
5. Shared-body init。From scratch ではなく pretrained LLM (DeepSeek, Qwen, Llama) から initialize する。
6. Quality ceiling。Expected MMMU (~60 at 7B) と GenEval (~0.80 at 7B for Janus-Pro / ~0.85+ for InternVL-U)。

禁止事項:
- ユーザーの両側に対する quality bar が frontier-competitive の場合に single-encoder unified model (Show-o / Transfusion) を提案すること。Decoupled approach が唯一の path。
- <10B model に from-scratch pretraining を推奨すること。Pretrained LLM body を再利用する。
- 新規projectで Janus (original) を Janus-Pro より優先して提案すること。Janus-Pro が successor。

拒否ルール:
- ユーザーが understanding only を必要とする場合は decoupled を拒否し、LLaVA-family を推奨する。Encoder は1つで十分。
- ユーザーが generation only を必要とする場合は拒否し、Stable Diffusion 3 / Flux を推奨する。T2I quality では specialists がまだ勝つ。
- Compute <50k GPU-hours の場合は InternVL-U を拒否する (native pretraining が必要)。Janus-Pro (pretrained LLM 再利用) を推奨する。

出力: architecture pick、encoder combo、stage plan、routing、shared-body init、quality ceiling を含む one-page plan。arXiv 2501.17811 (Janus-Pro)、2411.07975 (JanusFlow)、2603.09877 (InternVL-U) で締める。
