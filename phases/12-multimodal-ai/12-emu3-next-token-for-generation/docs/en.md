# Emu3: Image and Video GenerationのためのNext-Token Prediction

> BAAIのEmu3（Wang et al., 2024年9月）は、diffusion対autoregressiveの議論を終わらせるはずだった2024年の結果です。single Llama-style decoder-only transformerを、text + VQ image tokens + 3D VQ video tokensのunified vocabulary上で、next-token-prediction objectiveだけでtrainingすると、image generationでSDXLを上回り、perceptionでLLaVA-1.6を上回ります。CLIP lossなし。diffusion scheduleなし。qualityのためにinferenceでclassifier-free guidanceは使いますが、中核のtraining objectiveはteacher forcing付きnext-token predictionです。Natureに掲載されました。このレッスンではEmu3 thesis、つまりより良いtokenizerとscaleがあれば十分だという主張を読み、diffusion approachと対比します。

**種別:** 学習
**言語:** Python (stdlib, 3D video tokenizer math + autoregressive sampler skeleton)
**前提条件:** Phase 12 · 11 (Chameleon)
**所要時間:** ~120分

## 学習目標

- image qualityにはdiffusionが必要だという長年の前提にもかかわらず、Emu3のsingle-loss next-token objectiveが機能する理由を説明できる。
- 3D video tokenizerを説明できる。spatiotemporal VQ codebookがどのようなものか、patchがtimeをまたぐ理由を説明できる。
- Emu3とStable Diffusion XLを、training compute、inference cost、quality ceilingで比較できる。
- 同じEmu3 modelが担う3つのrole、Emu3-Gen（image gen）、Emu3-Chat（perception）、Emu3-Stage2（video gen）を挙げられる。

## 問題

2024年までのconventional wisdomは、image generationにはdiffusionが必要だというものでした。その主張は、discrete image tokensはdetailをreconstructするには情報を失いすぎ、autoregressive samplingは数千tokensにわたってerrorを蓄積する、というものです。Stable Diffusion、DALL-E 3、Imagen、Midjourneyはいずれも何らかのdiffusionを使います。Chameleon（Lesson 12.11）は小規模ではこれを部分的に反証しましたが、qualityでSDXLには並びませんでした。

Emu3はこの主張に正面から挑みました。claimは、より良いvisual tokenizer + 十分なscale + next-token loss = diffusionを上回るimage generationであり、それをperceptionも行う同じmodelで達成する、というものです。

公開時、この賭けはcontroversialでした。2年後、open-source unified-generation family（Emu3、Show-o、Janus-Pro、Transfusion）はresearchのdefault pathになり、production frontier modelsも何らかのvariantを使っているように見えます。

## 概念

### Emu3 tokenizer

鍵になるingredientはvisual tokenizerです。Emu3は8x8 resolution-reduction per tokenでcustom IBQ-class tokenizer（Inverse Bottleneck Quantizer、SBER-MoVQGAN family）をtrainingします。512x512 imageは64x64 = 4096 tokensになり、codebook sizeは32768です。

これはChameleonの512x512あたり1024 tokens、K=8192より大きいですが、tokenあたりは安いです（より小さなcodebook lookup、よりsimpleなcodec）。重要なmetricはreconstruction PSNR 30.5 dBで、Stable Diffusionのcontinuous latent spaceの32 dBと競争的です。

videoでは、3D VQ tokenizerがspatiotemporal patch（4x4x4 pixels）を1つのintegerにencodeします。8 FPSの4s clipは32 framesです。256x256で4x spatial、4x temporal reductionなら、token countは(256/4) * (256/4) * (32/4) = 64 * 64 * 8 = 32,768 tokensです。

Tokenizer qualityがceilingです。Emu3のcontributionの一部は「非常に良いtokenizerをtrainingした」ことです。

### Single-loss training

Emu3は1つのobjectiveを使います。text tokens、2D image tokens、3D video tokensにまたがるshared vocabulary上のnext-token predictionです。training中にはmodalityごとの寄与をbalanceするためにweightsへmodality-specific factorsを掛けますが、loss function自体は同じです。

training mixは次です。
- Image gen: `<text caption> <image> image_tokens </image>`
- Image perception: `<image> image_tokens </image> <question> text_tokens`
- Video gen: `<text caption> <video> video_tokens </video>`
- Video perception: analogous。
- Text only: standard NTP。

modelはdata distributionから、いつimage tokensをemitし、いつtext tokensをemitするかを学びます。`<image>` tagの後にmodelがimage tokensをpredictすることでgenerationが現れます。

### Classifier-free guidanceとtemperature

Autoregressive image generationは、inferenceでclassifier-free guidance（CFG）を使うと大きく改善します。Emu3も使います。full captionで1回、empty captionで1回生成し、logitsをguidance weight（典型的に3.0-7.0）でmixします。diffusionで使われる同じCFG trickを、autoregressive settingへ借りています。

Temperatureも重要です。高すぎるとartifacts、低すぎるとmode collapseになります。Emu3のrecommended temperatureは、perceptionでは1.0、image generationでは0.8です。

### Three roles, one model

Emu3は機能上3つの異なるAPIとして提供されますが、underlying weight setは1つです。

- Emu3-Gen。Image generation。Input text、output image tokens。
- Emu3-Chat。VQAとcaptioning。Input image（tokens）、output text。
- Emu3-Stage2。Video generationとvideo VQA。Input textまたはvideo、output textまたはvideo。

task-specific headsはありません。異なるprompt templatesがあるだけです。同じcheckpointです。

### Benchmarks

Emu3 paper（2024年9月）より:

- Image generation: MJHQ-30K FIDでSDXLを上回る（5.4 vs 5.6）、GenEval overallはほぼ同等（0.54 vs 0.55、statistical tie）、Deep-Eval compositeも同等。
- Image perception: VQAv2でLLaVA-1.6を上回る（75.1 vs 72.4）、MMMUではおおむね同等。
- Video generation: 4-second-clip qualityで、Sora-eraのpublicly benchmarked modelsと競争的なFVD。

数値は常に勝っているわけではありません。Emu3はあちらで1 point得て、こちらで1 point失います。それでも「next-token prediction is all you need」というclaimはmodality横断でdefensibleです。

### Compute cost

Emu3は7B-parameter modelを約300 billion multimodal tokensでtrainingしました。GPU-hoursはLlama-2-7B pretrainingにおおむね相当します（A100-class siliconで2k-4k GPU-years）。Stable Diffusion 3のようなdiffusion modelsも似たbudgetでtrainingされますが、別のtext encodersとより複雑なpipelinesが必要です。

inferenceでは、Emu3はimageあたりSDXLより遅いです。4096 image tokensを30 tok/sでdecodeすると、512x512 imageあたり約2分です。SDXLの2-5秒と比べて重いです。Speculative decodingとKV-cache optimizationは差を縮めますが、閉じません。Autoregressive image genはcompute-heavyであり、これがstanding trade-offです。

### なぜ重要か

Emu3の深いcontributionはconceptualです。next-token predictionがimage generationでdiffusionに並ぶところまでscaleするなら、unified-model path（one loss、one backbone、any modality）は実現可能です。future modelsは別のtext encoder、別のdiffusion scheduler、別のVAEを必要としません。one transformer、modalityごとにone tokenizer、そしてscaleです。

Show-o、Janus-Pro、InternVL-Uはすべて、このthesisの上に構築するか、それに挑戦しています。Chinese labs（BAAI、DeepSeek）は2025年を通じ、US labsよりこの方向へ積極的にpublishしています。

## 使ってみる

`code/main.py`は2つのtoy piecesを作ります。

- 2D vs 3D VQ tokenizer count calculator: (resolution, patch, clip_length, FPS)から、image vs videoのtoken countsを計算する。
- temperature付きclassifier-free guidanceを使うautoregressive image-token sampler。

CFG implementationはEmu3のrecipeに合わせています。conditional logitsとunconditional logitsをguidance weightでmixします。

## 仕上げ

このレッスンは`outputs/skill-token-gen-cost-analyzer.md`を作ります。generation product spec（imageまたはvideo、target resolution、quality tier、latency budget）を受け取り、token countsとinference costを計算し、Emu3-familyとdiffusionのどちらを選ぶか決めます。

## 演習

1. Emu3は8x8 reductionで512x512 imageあたり4096 tokensを生成します。1024x1024と2048x2048ではどうなりますか。inference latencyには何が起きますか。

2. video tokenizerに関するEmu3 Section 3.3を読んでください。3D VQ patch shapeを説明し、それが8x8x1ではなく4x4x4である理由を説明してください。

3. Classifier-free guidance weight 5.0 vs 3.0では、visual effectはどう変わりますか。`code/main.py`のmathを追ってください。

4. 300B tokensでのEmu3-7Bのtraining FLOPsを計算し、Stable Diffusion 3と比較してください。training costが高かったのはどちらですか。

5. Emu3はFIDでSDXLを上回りますが、specialized VLMsとのVQAv2比較では勝ち切りません。unified-loss approachがbenchmarkごとにspecialistsと異なる強みを示す理由を説明してください。

## 重要語句

| Term | よく言われること | 実際の意味 |
|------|-----------------|------------------------|
| Next-token prediction | "NTP" | token[0..i]からtoken[i+1]をpredictするstandard autoregressive loss。tokenizeすれば全modalityで使える |
| IBQ tokenizer | "Inverse bottleneck quantizer" | Chameleonより大きなcodebooks（32768+）と高いreconstructionを持つVQ-VAEの一種 |
| 3D VQ | "Spatiotemporal quantizer" | (time, row, col)でindexされるcodebook。1 tokenが4x4x4 pixel cubeを覆う |
| Classifier-free guidance | "CFG" | conditional logitsとunconditional logitsをweight gammaでmixする手法。inferenceでimage qualityを上げる |
| Unified vocabulary | "Shared tokens" | text + image + videoが同じinteger spaceから引かれ、modelが次に来るmodalityをpredictする |
| MJHQ-30K | "Image gen benchmark" | 30k promptsを持つMidjourney-quality benchmark。Emu3はここでFIDを報告する |

## 参考文献

- [Wang et al. — Emu3: Next-Token Prediction is All You Need (arXiv:2409.18869)](https://arxiv.org/abs/2409.18869)
- [Sun et al. — Emu: Generative Pretraining in Multimodality (arXiv:2307.05222)](https://arxiv.org/abs/2307.05222)
- [Liu et al. — LWM (arXiv:2402.08268)](https://arxiv.org/abs/2402.08268)
- [Yu et al. — MAGVIT-v2 (arXiv:2310.05737)](https://arxiv.org/abs/2310.05737)
- [Tian et al. — VAR (arXiv:2404.02905)](https://arxiv.org/abs/2404.02905)
