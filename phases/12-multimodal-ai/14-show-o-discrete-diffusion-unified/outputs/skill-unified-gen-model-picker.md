---
name: unified-gen-model-picker
description: Understanding と generation の両方を open weights で必要とする product のために、Show-o / Transfusion / Emu3 / Janus-Pro family のどれを使うか選ぶ。
version: 1.0.0
phase: 12
lesson: 14
tags: [show-o, masked-diffusion, unified, t2i, inpainting]
---

Open-weights constraint と latency budget のもとで unified understanding + generation (VQA, captioning, T2I, optional inpainting) が必要な product が与えられたら、model family を選び、reference configuration を出力する。

作成するもの:

1. Family verdict。Show-o (masked discrete diffusion)、Transfusion / MMDiT (continuous diffusion)、Emu3 / Chameleon (autoregressive discrete)、または Janus-Pro (decoupled encoders)。
2. Inference-step budget。Show-o は16 steps、Transfusion は20、Emu3 は1024+。ユーザーの latency budget に基づいて選択を正当化する。
3. Inpainting support。Show-o は無料。Transfusion は mask channel を追加。Emu3 は separate fine-tune が必要。これをユーザーに明示する。
4. Tokenizer pick。Discrete families には IBQ / MAGVIT-v2 / SBER を推奨。Continuous には SD3 の VAE を推奨。
5. Training stability。Two-loss (Transfusion) は weight tuning が必要。Show-o の single loss はよりclean。
6. Growth 時の migration path。Quality が limit になったら Show-o から Transfusion へ移行する。

禁止事項:
- Inference latency が imageあたり <10s のときに Emu3 / Chameleon を提案すること。~1024 tokens 上の autoregressive は遅すぎる。
- Show-o が frontier image quality で Transfusion に匹敵すると主張すること。匹敵しない。Tokenizer が ceiling になる。
- VQA が必要な product に Stable Diffusion を推奨すること。SD は images について reasoning できない。

拒否ルール:
- ユーザーが <2s per image generation を望む場合は Show-o を拒否し、understanding 用の separate VLM + Stable Diffusion を推奨する。Multi-model complexity を受け入れる。
- ユーザーが open weights で "best-in-class quality" を望む場合は Show-o / Emu3 を拒否し、Transfusion-family (MMDiT) または JanusFlow を推奨する。
- ユーザーが tokenizer に commit できない場合 (licensing や quality ceiling を恐れる場合) は discrete-only families を拒否し、Transfusion を推奨する。

出力: family verdict、step budget、inpainting support、tokenizer recommendation、stability plan、migration path を含む one-page pick。arXiv 2408.12528 (Show-o)、2408.11039 (Transfusion)、2501.17811 (Janus-Pro) で締める。
