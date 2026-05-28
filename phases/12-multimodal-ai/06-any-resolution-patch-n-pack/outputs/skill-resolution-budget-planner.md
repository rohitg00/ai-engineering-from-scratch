---
name: resolution-budget-planner
description: mixed-aspect-ratio VLM workload 向けに square-resize、AnyRes、M-RoPE、NaFlex から選び、task ごとの token budget plan を出力する。
version: 1.0.0
phase: 12
lesson: 06
tags: [vlm, patch-n-pack, naflex, anyres, m-rope, token-budget]
---

workload、すなわち VLM が扱う画像の説明 (OCR documents、charts、UI screenshots、natural photos、video frames) と request ごとの total token budget が与えられたら、image class ごとに resolution strategy を選び、実行可能な configuration を作成する。

作成するもの:

1. image class ごとの strategy。宣言された class (OCR、chart、UI、photo、video-frame) それぞれについて {square-resize, AnyRes, M-RoPE, NaFlex} から1つを選ぶ。task の resolution sensitivity を引用し、1文で正当化する。
2. image ごとの token budget。min_pixels、max_pixels (Qwen2.5-VL style)、選んだ strategy での expected sequence length を含める。単一 image が LLM context の 40% を超える場合は flag する。
3. Batch packing plan。request を batch する場合は、`cu_seqlens` (FlashAttn varlen)、dense block-diagonal mask、または unbatched single-image inference のどれを使うかを指定する。batch の aspect ratio が 2x を超えてばらつく場合、varlen の FLOP savings を記載する。
4. Encoder recommendation。mixed workload には SigLIP 2 NaFlex、agent UI には Qwen2.5-VL native、frozen-encoder deployment には CLIP-336 + AnyRes、photo-only path には raw ViT @ 224。
5. Failure-mode alarms。選んだ config での tokens-per-image、30 tok/s prefill における latency cost、context-fill percentage、typical OCR benchmark で square-resize と比べた expected accuracy delta。

Hard rejects:

- OCR または chart task に square-resize を推奨しながら、どの benchmark number を失うかを示さないこと。
- LLM context が許す token 数を超える strategy を提案すること。必ず宣言された context window に対して budget を組む。
- AnyRes を universal answer として扱うこと。multiplicative tile overhead により、1枚の画像の encoding が終わる前に LLM context を超えることがある。

Refusal rules:

- user の宣言した token budget が image あたり 256 tokens 未満なら、photo-only semantic task 以外では拒否する。その budget ではどれだけ pooling しても OCR accuracy は戻らない。
- user が dense-prediction output (segmentation、depth) を望んでいるのに encoder に ViT register tokens がない場合は拒否し、registers enabled の DINOv2 / SigLIP 2 を指す。
- user の LLM context が 8k 未満で workload に documents または screenshots が含まれる場合は拒否し、より大きい context または OCR-first pipeline を推奨する。

Output: per-class strategy table、batch-packing plan、encoder recommendation、alarm list を含む1ページの budget plan。最後に follow-up 用 arXiv paper を付ける。NaViT は 2307.06304、SigLIP 2 / NaFlex は 2502.14786、Qwen2.5-VL は 2502.13923。
