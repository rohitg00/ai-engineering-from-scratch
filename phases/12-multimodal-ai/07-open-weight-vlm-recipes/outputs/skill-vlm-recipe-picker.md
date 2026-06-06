---
name: vlm-recipe-picker
description: Pick an open-weight VLM recipe (encoder, connector, LLM, data mix, resolution schedule) with ablation-table citations for every choice.
version: 1.0.0
phase: 12
lesson: 07
tags: [vlm, mm1, idefics2, molmo, cambrian, prismatic, ablation]
---

Given a task mix (OCR, chart, UI agent, reasoning, grounding), a compute budget (LLM params, training GPU hours, or inference latency target), and a deployment constraint (edge, cloud, on-device), emit a full open-weight VLM recipe with citations.

Produce:

1. Encoder pick. Default SigLIP 2 SO400m/14; concat with DINOv2 ViT-g/14 if grounding/segmentation is in the task mix; cite MM1 Table 3 and Cambrian-1's vision encoder match-up.
2. Connector pick. Default 2-layer MLP unless token-constrained (then Q-Former 32 queries); cite Prismatic VLMs' connector ablation showing <1 point delta.
3. LLM pick. Base on budget: Qwen2.5-7B for <10B, Llama-3.1-70B or Qwen2.5-72B for >30B. Flag MMMU plateau past 70B.
4. Data mix. Default PixMo + ShareGPT4V + Cauldron; cite Molmo's detailed-human-caption result (+2-3 MMMU over distillation at same token count).
5. Resolution schedule. Default dynamic (256-1280) with a stage-1 fixed-384 alignment pretraining; cite Idefics2 resolution ablation (+3-5 DocVQA from AnyRes) and Qwen2.5-VL dynamic M-RoPE.
6. Training stages. Stage 1 projector-only, Stage 2 full fine-tune, Stage 3 task-specific.

Hard rejects:
- Recommending CLIP ViT-L/14 as default encoder without flagging its deprecation in favor of SigLIP 2 for new projects.
- Suggesting Q-Former as a quality gain over MLP. It is a token-budget lever, not a quality lever.
- Proposing synthetic GPT-4V captions as primary training data when human-captioned alternatives exist. Cite Molmo.
- Claiming connector architecture explains variance that actually comes from token count.

Refusal rules:
- If the user wants a 1-3B VLM for reasoning-heavy tasks, refuse and recommend a larger LLM; reasoning ceilings are set by the LLM.
- If the user cannot afford detailed-human-caption data, explicitly flag the expected 2-3 MMMU ceiling and offer a best-effort distillation fallback.
- If the task mix includes 4K+ document imagery on a frozen-encoder deployment, refuse AnyRes and recommend a native-resolution M-RoPE encoder like Qwen2.5-VL.

Output: a one-page recipe card with per-axis pick, ablation citation (arXiv ID), training stage plan, and expected benchmark range. End with the three ablation papers to read next: arXiv 2403.09611 (MM1), 2405.02246 (Idefics2), 2409.17146 (Molmo).
