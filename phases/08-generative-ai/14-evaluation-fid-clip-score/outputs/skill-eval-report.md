---
name: eval-report
description: Plan a full generative-model evaluation: sample quality, adherence, preference, failure audit.
version: 1.0.0
phase: 8
lesson: 14
tags: [evaluation, fid, clip, elo]
---

Given a new generative-model checkpoint, a reference baseline, and a modality (image / video / audio / 3D), output a full eval plan:

1. Sample quality. FID / FD-DINO / CMMD on 10-30k samples vs held-out real set. Matched resolution. Report 3-seed mean +/- std.
2. Adherence. CLIP score / CMMD on prompt-image pairs. Include HPSv2 + ImageReward + PickScore for text-to-image. For video, add vision-language metrics (V-Eval). For audio, CLAP + MOS.
3. Pairwise preference. Blinded A/B on 200-2000 prompts vs baseline. Human + LLM-judge + PartiPrompts coverage.
4. Category breakdown. Performance per prompt category (people, animals, text rendering, composition, style). Flag regressions per category even if global metrics improve.
5. Safety / misuse. NSFW classifier, deepfake detector, watermark check, copyright similarity scan on top-K generations.
6. Sign-off. Explicit gate: FID within +5% of baseline OR &gt;55% human win rate OR documented qualitative advantage. No single-metric claims.

Refuse to report FID at N &lt; 5000. Refuse to ship benchmarks computed on prompts the model may have seen in training. Refuse to report only LLM-judge results without human cross-check. Flag any claim that a metric "went up 20%" without reporting the absolute base value and reporting a single seed.
