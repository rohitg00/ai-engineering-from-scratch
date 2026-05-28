---
name: token-gen-cost-analyzer
description: Emu3-style next-token generationのtoken counts、inference latency、quality ceilingを計算し、Emu3-familyとdiffusionのどちらを選ぶか決める。
version: 1.0.0
phase: 12
lesson: 12
tags: [emu3, next-token-prediction, video-gen, diffusion, cfg]
---

generation product spec（imageまたはvideo、target resolution、quality tier、throughput requirement）を受け取り、Emu3-style next-token generationのtoken countsを計算し、inference costを見積もり、Emu3-familyとdiffusionのどちらを選ぶか決める。

出力するもの:

1. Token count。選択したtokenizer reduction（imageでは通常各dim 8x）でのimageあたりtokens。3D VQ（通常4x4x4 spatiotemporal）でのvideoあたりtokens。
2. Inference latency。Emu3-familyではtokens / throughput（tokens-per-second）、diffusionではdenoise-steps * step-time。具体的なA100 / H100 rangesを引用する。
3. Quality ceiling。Tokenizer reconstruction PSNR（IBQ-classで30-32 dB）、MJHQ-30K上のFID expectations、videoのFVD。
4. CFG configuration。taskごとのrecommended guidance weight（gamma）。standard genでは典型的に3.0、strong prompt adherenceでは5-7。
5. Pick。productがunified understanding + generationまたはany-modality flexibilityを必要とするならEmu3-family。厳しいlatencyを持つimage-gen-onlyならdiffusion（SDXL / SD3 / Flux）。

Hard rejects:
- Emu3はinferenceでdiffusionより速いと主張すること。速くない。数千image tokensのautoregressive decodeがstanding costである。
- CFG weightを指定せずにEmu3-familyを推奨すること。これなしではqualityが崩れる。
- 厳密な4K image generationにEmu3を提案すること。2048+ resolutionのtoken countはKV cacheを膨らませ、minutes単位になる。

Refusal rules:
- latency budgetがimageあたり<5sならEmu3を拒否し、SDXLまたはSD3を推奨する。
- productがimagesをemitし、それをdescribeし、third-party imagesについてreasonする必要があるならEmu3-familyを推奨する（unified lossが要点）。diffusionは別VLMなしではこれをできない。
- userがcommercial use向けのpermissive license付きopen weightsを求める場合はEmu3を拒否する。まずlicenseを確認する。一部versionはresearch-only。

Output: token counts、latency estimates、quality ceiling、CFG config、justification付きのpickを含む1ページanalysis。alternativeとしてarXiv 2409.18869 (Emu3)と2408.11039 (Transfusion)で締める。
