---
name: modality-bridge-picker
description: token budget、quality target、training compute に基づき、VLM configuration 向けに Q-Former vs MLP projector vs Perceiver resampler を推奨する。
version: 1.0.0
phase: 12
lesson: 03
tags: [blip2, qformer, vlm, modality-bridge, architecture]
---

vision encoder の image あたり token count、LLM context budget、prompt あたり target image count、training compute budget が与えられたら、使うべき modality bridge を推奨し、parameter count と token economics で根拠を示す。

Produce:

1. Token budget audit。vision encoder からの raw tokens per image、各 bridge option 後の tokens per image、宣言された image-per-prompt count で消費される LLM context fraction を報告する。
2. Bridge comparison。Q-Former (32 tokens、~188M params)、MLP projector (all patches、~20M params)、Perceiver resampler (N-layer cross-attention 経由の K learnable queries、variable) それぞれについて、parameters、quality proxies、training cost ballpark を示す。
3. Recommendation。指定 constraints に対する single best choice と one-line justification。constraints が矛盾している場合 (high quality + tight token budget + low training compute) は flag を立てる。
4. Two-stage training trace。Q-Former を選ぶ場合、stage 1 の ITC + ITM + ITG loss と stage 2 の LM loss を outline する。各 stage の代表 dataset (COCO、LAION、Visual Genome) を挙げる。
5. Ablation checklist。bridge を固定する前に caller が走らせるべき 5 experiments (query count、two-stage vs single-stage、projector depth、freeze schedule、finetune subset)。

Hard rejects:
- token budget を無視した recommendation。4k context に 10 images を入れる場面で「Use MLP」(image あたり 576 tokens) は失敗。
- Q-Former が MLP を常に厳密に支配すると主張すること。single-image high-quality task で context が無制限なら MLP が勝つ。
- Perceiver resampler を Q-Former と同等として扱うこと。Flamingo は各 LLM layer で適用し、BLIP-2 は 1 回だけ適用する。

Refusal rules:
- caller が video を扱える bridge を求めているのに frame 数と frame rate を指定していない場合は拒否する。video bridge は single-image bridge の単なる scale ではなく specification が異なる。
- scope の LLM が vision tower と一緒に scratch から training される場合 (early-fusion、Chameleon-style) は拒否する。Lesson 12.11 がその case を扱う。
- training compute が示されていない場合は拒否し、BLIP-2 の stage 2 (~数百 A100-hours) を払えるのか、projector-only training だけなのかを尋ねる。

Output: token math、parameter counts、recommended architecture、training outline、ablation checklist を含む 1-page bridge recommendation。最後に "what to read next" paragraph を置き、cross-attention-everywhere は Lesson 12.04 (Flamingo)、MLP-only は Lesson 12.05 (LLaVA)、data-vs-architecture tradeoff は Lesson 12.07 (ablations) へ案内する。
