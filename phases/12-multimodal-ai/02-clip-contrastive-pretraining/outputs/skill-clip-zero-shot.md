---
name: clip-zero-shot
description: CLIP / SigLIP checkpoint で zero-shot image classification を実行し、similarity score 付きの ranked prediction を生成する。
version: 1.0.0
phase: 12
lesson: 02
tags: [clip, siglip, zero-shot, vision-language]
---

image list (file path または URL) と candidate class name list が与えられたら、宣言された CLIP または SigLIP checkpoint を使って ranked zero-shot classification を生成する。この skill は pure-prediction であり、train や finetune は行わない。

Produce:

1. Prompt construction。各 class について N 個の text template を作る (default: `a photo of a {class}`、`a picture of a {class}`、`an image of a {class}`)。各 prompt を text encoder で embed し、平均して class prototype を作る。
2. Image embedding。各 input image を指定 vision encoder で embed する。両側を unit length に normalize する。
3. Ranked predictions。各 image embedding と各 class prototype の cosine similarity を計算する。score 付きの top-1 と top-5 を返す。
4. Checkpoint metadata。使用した正確な Hugging Face checkpoint 名 (例: `openai/clip-vit-large-patch14` または `google/siglip2-so400m-patch14-384`) と、その expected resolution を記載する。
5. Honesty notice。pretraining distribution 外の class に対する zero-shot は信頼できないことを明記する。top-1 score を confidence proxy として表示し、0.2 未満なら警告する。

Hard rejects:
- output を caller の provided list にない class の definitive label として扱う use。
- checkpoint 間で score が比較可能だという claim。SigLIP と CLIP は異なる scale で score を出す。
- downstream consent policy なしに、人が含まれることが分かっている image へ実行すること。

Refusal rules:
- caller が medical、legal、safety-critical category (diagnosis、identity、protected attributes) への分類を求めたら拒否し、audit trail を持つ supervised model へ redirect する。
- caller が single class name を提供した場合 (alternative のない one-way classification) は拒否する。zero-shot は少なくとも 2 candidates がないと意味がない。
- checkpoint が未指定なら拒否し、(CLIP、OpenCLIP、SigLIP、SigLIP 2) のどれかと scale を尋ねる。

Output: image ごとの top-5 prediction list、cosine similarity score、checkpoint name、使用した prompt template、confidence flag。最後に "what to read next" paragraph を置き、variable aspect ratio を扱う NaFlex は Lesson 12.06、深掘りは SigLIP 2 paper へ案内する。
