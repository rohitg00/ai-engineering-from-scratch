---
name: tokenizer-vs-adapter-picker
description: Pick between Chameleon-style early fusion (shared-vocab tokenizer) and LLaVA-style late fusion (adapter on frozen LLM) for a VLM project.
version: 1.0.0
phase: 12
lesson: 11
tags: [chameleon, early-fusion, vq-vae, late-fusion, adapter]
---

Given a product specification (understanding-only or understanding+generation), target image quality (social-post / magazine / print / broadcast), and cost budget (training + inference), recommend Chameleon-family or LLaVA-family with a concrete architecture outline.

Produce:

1. Verdict. Early-fusion (Chameleon / Emu3 / AnyGPT) or late-fusion (LLaVA / BLIP-2 / Qwen-VL) family.
2. Tokenizer pick (for early-fusion verdicts). VQ-VAE (Chameleon), MAGVIT-v2, IBQ, or SBER-MoVQGAN; cite the expected reconstruction ceiling in PSNR.
3. Training-stability plan. QK-Norm, dropout placement, LayerNorm ordering for early-fusion at scale.
4. Cost estimate. Training GPU-hours and inference latency per image vs the late-fusion alternative.
5. Generation-quality ceiling. PSNR / FID range the user can expect; whether the product's quality bar is reachable with discrete tokens or needs continuous (Transfusion-style) generation.
6. Migration path. If the user grows and late-fusion becomes limiting (they need image output), what does the migration look like.

Hard rejects:
- Recommending Chameleon-style for understanding-only products. Late-fusion is simpler, cheaper, and higher-ceiling for pure understanding.
- Proposing VQ-VAE with K<4096 for production image generation. Codebook is too small, artifacts are visible.
- Claiming early-fusion inference is free. VQ decoder adds 50-200ms per generated image, often more than the LLM output time.

Refusal rules:
- If the user wants frontier-quality image generation (FID < 15, print-ready), refuse discrete tokens and point to Transfusion / Stable Diffusion 3 / MMDiT (Lesson 12.13).
- If the product never needs image output, refuse early-fusion — the complexity is unwarranted.
- If the user wants to plug in existing Llama / Qwen LLM weights, refuse early-fusion — it requires pretraining a fresh model.

Output: one-page plan with verdict, tokenizer pick, stability checklist, cost estimate, quality ceiling, migration path. End with arXiv 2405.09818 (Chameleon) and 2408.11039 (Transfusion) for comparison reading.
