---
name: patch-geometry-reader
description: ViT config を読み、downstream VLM 計画向けに patch-token、parameter、VRAM analysis を生成する。
version: 1.0.0
phase: 12
lesson: 01
tags: [vit, patch-tokens, dinov2, siglip, vlm-backbone]
---

vision backbone config (patch size、resolution、hidden dim、depth、heads、optional registers) が与えられたら、この encoder が何 token を出力するか、実行にどれだけ VRAM が必要か、downstream VLM または dense-prediction task に適した選択かを示す geometry analysis を生成する。

Produce:

1. Patch grid と sequence length。Grid shape (H/P, W/P)。CLS、register、pooling token を含む sequence length。宣言されている場合は multi-resolution support (NaFlex、AnyRes) を強調する。
2. Parameter breakdown。Patch embed、position embed、transformer blocks (attention + MLP)、final LN、exact count と human-readable count (例: 86.4M) の totals。
3. forward あたり FLOPs。Attention (block あたり 4 N D^2 + 2 N^2 D) と MLP (block あたり 16 N D^2) を depth 全体で合計する。high resolution で問題になる quadratic-in-N cost に flag を立てる。
4. VRAM estimate。1 image の single forward inference に必要な activation memory と、encoder が downstream LLM に入る場合の KV-equivalent cache。
5. Pooling recommendation。宣言された downstream task に基づき、CLS、mean patch、register-based、skip-pooling-for-VLM のいずれかを推奨する。

Hard rejects:
- patch token を input と pixel-identical として扱う analysis。projection は learned linear map であり、patch は pixel ではなく abstract vector。
- CLS が常に正しい pooling だと主張すること。modern dense-feature path と VLM path は CLS を完全に skip する。
- 2D-RoPE と learned positional embedding を、NaFlex-style native-resolution flexibility に触れずに交換可能として扱うこと。

Refusal rules:
- provided config の patch size が image size を割り切らない場合は拒否する。padding scheme が宣言されていなければ、これは NaFlex-compatible config ではない。
- caller が proprietary model (Gemini、Claude、GPT-5) の exact pretrained weight count を求めた場合は拒否する。公開されていないため。
- target deployment VRAM が ViT-g/14-class model に対して 4GB 未満の場合は拒否し、SigLIP SO400m/14 またはより小さい backbone を推奨する。

Output: token count、parameter breakdown、FLOPs estimate、VRAM budget、recommended pooling strategy を含む 1-page geometry analysis。最後に "what to read next" paragraph を置き、NaFlex details は SigLIP 2 paper (arXiv:2502.14786)、dense features は DINOv2 paper、patch-n'-pack implementation は Lesson 12.06 を案内する。
