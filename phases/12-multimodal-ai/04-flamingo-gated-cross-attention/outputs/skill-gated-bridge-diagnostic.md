---
name: gated-bridge-diagnostic
description: open VLM config 内の Flamingo-lineage design element を識別し、freezing / gating issue を診断する。
version: 1.0.0
phase: 12
lesson: 04
tags: [flamingo, idefics, openflamingo, gated-cross-attention, interleaved-inputs]
---

open VLM checkpoint とその config (layer structure、cross-attention schedule、gate parametrization、training recipe) が与えられたら、どの Flamingo-lineage element を使っているかを識別し、mis-set gating の common symptom を診断する。

Produce:

1. Lineage checklist。(Perceiver resampler Y/N、gated cross-attn frequency M、tanh vs sigmoid gate、alpha init value、LLM freeze depth) の presence を flag する。
2. Interleaved-input support。model が期待する prompt format を parse し、multi-image、video、few-shot in-context prompting support の有無を確認する。
3. Visual token budget。per-image cost を計算する: K latents x N cross-attn insertion points。同じ image count の BLIP-2-style single-input bridge と比較する。
4. Gate diagnosis。training-loss curve または benchmark degradation が与えられたら、gate が速く開きすぎた (text capability を失う)、遅すぎた (visual input を使えない)、miscalibrated (visual token が augment ではなく競合している) のどれかを提案する。
5. Fix recipe。concrete parameter fix: text が degraded したなら alpha を 0 に近く initialize、gate parameter の learning rate を上げる、または最初の N steps は gate を freeze する。

Hard rejects:
- resampler と gate schedule を確認せずに、open VLM を何でも「a Flamingo」と扱うこと。Idefics2 は resampler を捨てているため、qualifier なしに Flamingo-lineage と label するのは誤り。
- zero init が training 後も常に生き残ると仮定すること。一部の open reproduction は small non-zero init を使い、initial stability と faster convergence を trade する。
- gated cross-attention がすべての task で single BLIP-2 bridge より厳密に優れていると主張すること。small LLM の single-image VQA では extra cross-attn layer は pure cost。

Refusal rules:
- checkpoint の training recipe が公開されていない場合は拒否し、gate diagnosis には gate schedule を知る必要があると説明する。
- caller が Gemini または Claude (proprietary) との比較を求めた場合は拒否する。gating mechanism が公開されていないため。
- scope の VLM が early-fusion model (Chameleon、Emu3) の場合は拒否する。gating は adapter-style VLM にのみ適用される。

Output: lineage checklist、interleaved-input capability matrix、token budget、gate diagnosis、concrete fix recipe を含む 1-page diagnostic。最後に "what to read next" paragraph を置き、alternative projector approach は Lesson 12.05 (LLaVA)、early-fusion escape hatch は Lesson 12.11 (Chameleon) へ案内する。
