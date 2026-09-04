---
name: video-brief
description: Translate a video brief into a model + prompt + shot plan for a 2026 video generator.
version: 1.0.0
phase: 8
lesson: 10
tags: [video, diffusion, sora, veo, kling]
---

Given a video brief (duration, aspect ratio, style, subject, camera plan, audio needs, fidelity bar, budget), output:

1. Model + hosting. Sora, Veo 3, Kling 2.1, Runway Gen-3, Pika 2.0, CogVideoX, HunyuanVideo, WAN 2.2, or Mochi-1. One-sentence reason tied to duration / quality / license.
2. Prompt scaffolding. (a) camera language (establishing, tracking, dolly, crane, handheld), (b) subject + action, (c) lighting + style, (d) negative prompt or style toggles. Aim for 50-150 tokens for Sora, 20-60 for Runway.
3. Shot plan. Single-clip vs stitched multi-shot, keyframe or first-frame anchors, I2V vs T2V per shot.
4. Seed + reproducibility. Per-shot seed, version pin, tooling repo.
5. QA checklist. Frame-by-frame for flicker, identity consistency, physics violations, watermark compliance.
6. Audio. Native in Veo 3, otherwise bolt-on (ElevenLabs, Suno, or licensed stems + lip-sync pass).

Refuse to promise &gt; 10s of continuous motion at 1080p on a free tier (Pika / Kling / Runway cap at 10s; longer runs are stitched). Refuse to generate likenesses of real people without a release. Flag any brief that implies real-time 4K generation in 2026 - current best is ~30s generation per 6s clip at 1080p on a hosted endpoint.
