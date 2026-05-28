# ChameleonとEarly-Fusion Token-Only Multimodal Models

> ここまで見てきたVLMは、imageとtextを分離して扱っていました。Visual tokensはvision encoderから出て、projectorを通り、LLM内でtextと出会います。vision vocabularyとtext vocabularyは重なりません。Chameleon（Meta, 2024年5月）は「重なったらどうなるか」を問いかけました。画像をshared vocabulary由来のdiscrete tokens sequenceへ変換するVQ-VAEをtrainingする。すると、すべてのmultimodal documentは1つのsequenceになります。text tokensとimage tokensがinterleaveされ、lossはsingle autoregressive lossです。副作用として、modelはmixed-modality outputs、つまり1回のinference callでtext tokensとimage tokensが交互に現れる出力を生成できます。このレッスンではearly-fusion thesisを読み、toy versionをend to endで作ります。

**種別:** 構築
**言語:** Python (stdlib, VQ-VAE tokenizer + interleaved decoder)
**前提条件:** Phase 12 · 05, Phase 8 (Generative AI)
**所要時間:** ~180分

## 学習目標

- shared vocabulary + single lossがmodelのできることをどう変えるか説明できる。
- VQ-VAEがimageをtransformerのnext-token objectiveと互換なdiscrete sequenceへtokenizeする仕組みを説明できる。
- Chameleonのtraining-stability tricksであるQK-Norm、dropout placement、LayerNorm orderingを挙げられる。
- ChameleonとBLIP-2のQ-Former approachを比較し、どちらを選ぶべきかを説明できる。

## 問題

Adapter-based VLMs（LLaVA、BLIP-2、Qwen-VL）は、textとimageを別物として扱います。text tokenは`embed(text_token)`を通り、imageは`visual_encoder(image) -> projector -> ... pseudo_tokens`を通ります。modelには2つのinput pathがあり、途中でmergeします。

この結果が3つあります。

1. LLMはimageをconsumeできるだけで、emitできません。outputはtextのみです。
2. Mixed-modality documents（articleのようにparagraphsとimagesが交互に出るもの）は扱いづらく、model外でmultimodal inputをparseするか、generationをchainする必要があります。
3. Distributional mismatch。Visual tokensとtext tokensはhidden spaceの異なる領域にあり、微妙なalignment issuesを生みます。

Chameleonはこの前提を拒否します。imageはshared vocabulary由来のdiscrete tokens sequenceにすぎない、という立場です。interleaved documentsでmodelをtrainingし、one loss、one autoregressive decoderにすれば、mixed-modality generationが自然に可能になります。

## 概念

### image tokenizerとしてのVQ-VAE

tokenizerはvector-quantized variational autoencoderです。architectureは次の通りです。

- Encoder: imageをspatial feature map、例えばdim 256の32x32 featuresへmapするCNN + ViT。
- Codebook: 学習されるK vectorsのvocabulary（Chameleonは8192）で、dimも256。
- Quantization: 各spatial featureについてL2 distanceで最も近いcodebook entryを探す。continuous featureをinteger indexで置き換える。
- Decoder: quantized featuresをpixelsへ戻すCNN。

TrainingはVAE reconstruction loss + commitment loss + codebook lossです。codebook indicesがimage用のdiscrete alphabetになります。

Chameleonでは、1枚の画像が8192語彙から引かれる32*32 = 1024 tokensになります。これをtext tokens（LLMのBPE vocabulary、例えば32000）とconcatenateします。最終vocabularyは40192です。transformerはone sequence、one lossだけを見ます。

### shared vocabulary

Chameleonのvocabularyはtext tokens、image tokens、modality separatorsを統合します。各tokenはsingle IDを持ちます。input embedding layerはすべてのIDをD-dim hidden vectorへmapします。output projectionはhiddenをvocab logitsへ戻します。Softmaxはmodalityに関係なく次tokenを選びます。

Separatorは重要です。`<image>`と`</image>` tagsがimage-token sequenceを囲みます。generation時にmodelが`<image>`をemitしたら、downstream softwareは次の1024 tokensがpixel renderingのためにdecoderへ送るVQ indicesだと分かります。

### Mixed-modality generation

Inferenceはshared vocabulary上のnext-token predictionです。prompt例: "Draw a cat and describe it." Chameleonは次のようにemitします。

```
<image> 4821 1029 2891 ... (1024 image tokens) </image>
The cat is orange, sitting on a windowsill...
```

modelはorderを自律的に選びます。image then text、text then image、またはinterleaveのどれもあり得ます。同じdecoder、同じlossです。

generationがtext-onlyであるadapter VLMsと比べてください。Chameleonはmodel output modalityの問いを開き直します。

### Training stability — QK-Norm、dropout、LayerNorm ordering

Early-fusion trainingはscaleすると不安定です。Chameleon paperは3つのtricksをdocumentしています。

- QK-Norm。attention内でdot productの前にqueryとkey projectionへLayerNormを適用します。depthでlogit magnitudeが爆発するのを防ぎます。2024年以降の複数のlarge modelsで使われます。
- Dropout placement。attentionとMLPの後だけでなく、すべてのresidual-add後にdropoutを置きます。image tokens由来のgradientsが支配的になり得るため、より強いregularizationが必要です。
- LayerNorm ordering。residual branchにPre-LN（standard）を使い、last blockのskip connectionに追加LNを入れます。final-layer gradient flowを安定化します。

これらがないと、34B-param Chameleon trainingは複数checkpointでdivergeしました。これらを入れるとconvergeします。training recipeはarchitectureと同じくらい重要なcontributionです。

### tokenizerのreconstruction ceiling

VQ-VAEはlossyです。8192 codebook entries、512x512 imageあたり1024 tokensでは、reconstruction PSNRはおよそ26-28 dBで頭打ちです。recognizable image genには十分ですが、continuous-space diffusion（Stable Diffusion 3は32+ dB）より目に見えて劣ります。

tokenizerがbottleneckです。より良いtokenizer（MAGVIT-v2、IBQ、SBER-MoVQGAN）はceilingを引き上げます。Emu3（Lesson 12.12）は、より良いtokenizerだけでSDXL-quality generationを達成します。

### Chameleon vs BLIP-2 / LLaVA

Chameleon（early fusion、shared vocab）:
- One loss、one decoder。
- mixed-modality outputを生成できる。
- Tokenizerがquality ceilingになる。
- 高コスト: generated imageごとにinference path上でVQ-VAE decoderが必要。

BLIP-2 / LLaVA（late fusion、separate towers）:
- Vision in、text outのみ。
- pretrained LLMを再利用できる。
- understandingにはtokenizer bottleneckがない。
- 安い: single forward pass。

taskに応じて選びます。image generationが必要ならChameleon family。understandingだけでよいならadapter-VLMの方がsimpleで、より多くのpretrained computeを再利用できます。

### FuyuとAnyGPT

Fuyu（Adept, 2023）は関連approachです。separate vision encoderを完全に省略し、raw image patchesをtokenのようにLLMのinput projectionへ渡します。tokenizerはありません。Chameleonよりsimpleですが、shared-vocab output generationは失います。

AnyGPT（Zhan et al., 2024）はChameleonをtext、image、speech、musicの4 modalitiesへ拡張します。各modalityで同じVQ-VAE trickを使い、shared transformerを使います。Any-to-any generationです。Lesson 12.16でさらに扱います。

## 使ってみる

`code/main.py`はtoy end-to-end early-fusion modelを作ります。

- 8x8 patchesをcodebook indices（K=16）へmapするtiny VQ-VAE-style quantizer。
- (text ids 0..31) + (image ids 32..47) + (separators 48, 49)からなるshared vocabulary。
- synthetic captions + image-token sequencesでtrainingされたtoy autoregressive decoder（bigram table）。
- promptを受け取り、text + image tokensを交互にemitするsampling loop。

codeは意図的にtransformerをtiny（bigrams）に保っているため、signal flowをend to endで追跡できます。

## 仕上げ

このレッスンは`outputs/skill-tokenizer-vs-adapter-picker.md`を作ります。product spec（understand only vs understand + generate、required image quality、cost budget）を受け取り、Chameleon-family（early fusion）とLLaVA-family（late fusion）のどちらを選ぶべきかをquantitative rules of thumbで正当化します。

## 演習

1. ChameleonはK=8192 codebook entriesと、512x512 imageあたり1024 tokensを使います。24-bit RGB imageとのcompression ratioを見積もってください。これはlossyですか。どの程度lossyですか。

2. 同じVQ-VAE densityで4K image（3840x2160）は何image tokensになりますか。Chameleon-style modelは1回のinference callで4K imageを生成できますか。最初に壊れるのはcontext、tokenizer quality、KV cacheのどれですか。

3. pure PythonでQK-Normを実装してください。64-dim queryとkeyについて、LayerNorm前後のdot productを示してください。depthでmagnitude controlが重要なのはなぜですか。

4. training stabilityに関するChameleon Section 2.3を読んでください。QK-Normなしの34Bでpaperが観測した正確なfailure modeを説明してください。"norm explosion"のsignatureは何でしたか。

5. text-only promptを受けてmixed-modality responseをemitするようtoy decoderを拡張してください。training-data distributionが60% text-first / 40% image-firstのとき、modelがimage-first vs text-firstを選ぶ頻度を測定してください。

## 重要語句

| Term | よく言われること | 実際の意味 |
|------|-----------------|------------------------|
| Early fusion | "Unified tokens" | imagesをstep oneからtransformer vocabularyを共有するdiscrete tokensへ変換すること |
| VQ-VAE | "Image tokenizer" | imagesをtransformerがpredictできるinteger indicesへmapするCNN + ViT + codebook |
| Shared vocabulary | "One dictionary" | text + image + modality separatorsを覆う単一token ID space |
| QK-Norm | "Attention stabilizer" | dot product前にqueryとkeyへLayerNormを適用し、norm blowupを防ぐ手法 |
| Mixed-modality generation | "Text + image output" | 1 passでinterleaved text and image tokensを自律生成するinference |
| Codebook size | "K entries" | VQ-VAEがquantizeできるdiscrete vectorsの数。compressionとfidelityをtradeする |
| Tokenizer ceiling | "Reconstruction limit" | VQ tokensをdecodeして到達できるbest PSNR。modelのimage quality上限を決める |

## 参考文献

- [Chameleon Team — Chameleon: Mixed-Modal Early-Fusion Foundation Models (arXiv:2405.09818)](https://arxiv.org/abs/2405.09818)
- [Aghajanyan et al. — CM3 (arXiv:2201.07520)](https://arxiv.org/abs/2201.07520)
- [Yu et al. — CM3Leon (arXiv:2309.02591)](https://arxiv.org/abs/2309.02591)
- [Zhan et al. — AnyGPT (arXiv:2402.12226)](https://arxiv.org/abs/2402.12226)
- [Adept — Fuyu-8B blog (adept.ai)](https://www.adept.ai/blog/fuyu-8b)
