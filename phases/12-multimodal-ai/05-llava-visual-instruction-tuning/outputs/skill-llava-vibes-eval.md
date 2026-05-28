---
name: llava-vibes-eval
description: LLaVA-family VLM に対して 10-prompt の vibes-eval を実行し、人間が読める scorecard を作成する。
version: 1.0.0
phase: 12
lesson: 05
tags: [llava, vlm, vibes-eval, instruction-tuning]
---

LLaVA-family VLM (LLaVA-1.5、LLaVA-NeXT、LLaVA-OneVision、または community fork) と test image set が与えられたら、captioning、VQA、reasoning、refusal、format compliance を含む 10-prompt smoke test を実行する。projector と LLM が正しく接続されていることを確認する scorecard を作成する。

作成するもの:

1. 期待挙動の説明付き 10 個の prompts:
   - Captioning 3件 (short、detailed、creative)。
   - VQA 3件 (counting、color、object の有無)。
   - Reasoning 2件 (2つの領域の比較、cause-and-effect)。
   - Refusal 2件 (private individual、PII-identifying)。
2. prompt ごとの score。pass / partial / fail と1行の理由。
3. 全体の pattern diagnosis。captioning は通るが VQA が落ちるなら stage-2 data mix を疑う。detailed captioning に hallucination が出るなら ShareGPT4V-style data の不足を疑う。refusal が落ちるなら safety-data gap として flag する。
4. Resolution check。OCR が必要な prompt を 336x336 base と AnyRes の両方で実行し、差分を記録する。low-res failure は想定内。high-res failure は AnyRes の misconfiguration を意味する。
5. Suggested follow-up。特定 category が失敗した場合に caller が実行できる training-data 追加を3つ提示する。

Hard rejects:

- vibes suite も実行せずに benchmark number だけで VLM を採点すること。benchmark は gaming できるが、vibes は実 deployment readiness を明かす。
- hallucination と stylistic verbosity を混同すること。単に詳しく書いただけではなく、どの object を invented したかを明示する。
- final answer だけを見て reasoning prompt を pass とすること。reasoning chain も確認する。

Refusal rules:

- caller が API access なしに proprietary VLM (Gemini、Claude、GPT-5V) の vibes-eval を求める場合は拒否する。test には実際の inference が必要である。
- target use case が medical diagnosis または legal advice の場合は拒否する。vibes-eval は certification ではなく、high-stakes domain に使ってはならない。
- 画像が提供されない場合は拒否する。この test は定義上 image-grounded である。

Output: 10行の scorecard (prompt、image、expected、actual、pass/partial/fail)、全体の pattern diagnosis、3項目の follow-up list。最後に「次に読むもの」として、resolution 関連の失敗には Lesson 12.06 (AnyRes)、data-mixture tuning には Lesson 12.07 (ablations) を指す paragraph を付ける。
