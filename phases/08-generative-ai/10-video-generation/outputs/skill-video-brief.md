---
name: video-brief
description: 動画 brief を、2026 年の動画生成器向けの model + prompt + shot plan に変換する。
version: 1.0.0
phase: 8
lesson: 10
tags: [video, diffusion, sora, veo, kling]
---

動画 brief (duration, aspect ratio, style, subject, camera plan, audio needs, fidelity bar, budget) を受け取り、次を出力する。

1. Model + hosting。Sora、Veo 3、Kling 2.1、Runway Gen-3、Pika 2.0、CogVideoX、HunyuanVideo、WAN 2.2、または Mochi-1。duration / quality / license に結びついた理由を 1 文で述べる。
2. Prompt scaffolding。(a) camera language (establishing, tracking, dolly, crane, handheld)、(b) subject + action、(c) lighting + style、(d) negative prompt または style toggles。Sora は 50-150 tokens、Runway は 20-60 tokens を目安にする。
3. Shot plan。Single-clip か stitched multi-shot か、keyframe または first-frame anchors、shot ごとの I2V vs T2V。
4. Seed + reproducibility。shot ごとの seed、version pin、tooling repo。
5. QA checklist。flicker、identity consistency、physics violations、watermark compliance を frame-by-frame で確認する。
6. Audio。Veo 3 では native、それ以外では bolt-on (ElevenLabs、Suno、または licensed stems + lip-sync pass)。

free tier で 1080p の連続動作が 10 秒を超えると約束しない。Pika / Kling / Runway は 10 秒上限で、より長い実行は stitched になる。release なしに実在人物の likeness を生成しない。2026 年に real-time 4K generation を示唆する brief は警告する。現在の最良でも hosted endpoint 上で 1080p の 6 秒クリップ生成に約 30 秒かかる。
