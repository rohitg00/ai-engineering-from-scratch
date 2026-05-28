# InternVL3: Native Multimodal Pretraining

> InternVL3以前のopen VLMは、ほぼ同じ3-step recipeに従っていました。trillions of text tokensでtrainingされたtext LLMを取り、vision encoderを後付けし、接続部分をfine-tuneする、という流れです。これは動きますがalignment debtがあります。text LLMはpretraining budgetの全量をpure textに使っており、visual tokensをnativeには理解していません。visionをpost-hocに追加すると、LLMはtext能力を忘れずにvisual inputとtext reasoningを結び直す必要があります。InternVL3（Zhu et al., 2025年4月）はpost-hoc approachを拒否します。1回のpretraining runで、step oneからtextとmultimodalをinterleaveするのです。その結果、open 78B paramsでMMMU-ProにおいてGemini 2.5 Proに並びます。このレッスンではnative pretrainingの主張と、それを採用すると何が変わるのかを読みます。

**種別:** 学習
**言語:** Python (stdlib, training-corpus mixer)
**前提条件:** Phase 12 · 05, Phase 12 · 07 (recipes)
**所要時間:** ~120分

## 学習目標

- post-hoc VLM trainingがalignment debtを蓄積する理由を、3つの測定可能な症状（catastrophic forgetting、answer drift、visual-text inconsistency）を挙げて説明できる。
- InternVL3のnative pretraining corpus mixと、text : interleaved : captionのratioが重要な理由を説明できる。
- V2PE（variable visual position encoding）をQwen2-VLのM-RoPEと比較できる。
- Visual Resolution Router (ViR)とDecoupled Vision-Language (DvD)というdeployment optimizationsを説明できる。

## 問題

Post-hoc VLM trainingはdefaultです。LLaVA、BLIP-2、Qwen-VL、Ideficsはいずれも、すでにpretrainedされたLLM（Llama、Vicuna、Qwen、Mistral）を取り、visionを追加します。training stagesは典型的に次の形です。

1. Frozen LLM + frozen vision encoder + trainable projectorを、caption pairsでtrainingしてembeddingをalignする。
2. LLMをunfreezeし、instruction data（LLaVA-Instruct、ShareGPT4V）でtrainingする。
3. 必要に応じてtask-specific fine-tune。

Alignment debtには3つの症状があります。

- Catastrophic forgetting。post-hoc VLMはtext-only skillsを忘れます。GSM8K scoreが5-10 points落ち、Hellaswag scoreも落ちます。pure-text agentsもregressします。
- Answer drift。同じvisual questionの少し違う言い回しに対して、異なるanswerが出ます。vision encoderとLLMの結合は、LLM自身のtokens同士の結合より弱いからです。
- Visual-text inconsistency。VLMは画像を正しくdescribeした後で、そのdescriptionと矛盾するquestion answerを出すことがあります。Visual tokensが、text tokensと同じようにはLLM内部のconsistency checksに参加していません。

これらの症状はよくdocumentedされています。MM1.5 Section 4はそれらを定量化しています。LLaVA-OneVisionのablationsもそれを示唆します。答えがnative pretrainingです。

## 概念

### Native multimodal pretraining

InternVL3は、step oneからnative multimodalなcorpusでfrom scratchにtrainingします。mixは次です。

- 40% text-only data（FineWeb、Proof-Pile-2など）
- 35% interleaved image-text data（OBELICS、MMC4-style）
- 20% paired image-caption data
- 5% video-text data

Vision tokens、text tokens、cross-modal interactionsはすべて、最初のgradient stepから同じlossに参加します。alignment pretrainingも、projector freezing stageも、後から回復すべきcatastrophic forgettingもありません。

base modelのtrainingはsingle stageです。instruction tuningはその後に行いますが、base modelはすでにvisual tokensをfirst-class citizenとして理解しています。

### V2PE (variable visual position encoding)

Qwen2-VLはfixed axis allocationのM-RoPEを使います。InternVL3はV2PEを導入します。position encodingがmodality type（text、image、video）ごとに変わり、learnable scalingを持ちます。実際には次のようになります。

- Text tokensは1D position（text index）を持つ。
- Image patchesは2D position（row, col）を持つ。
- Video framesは3D position（time, row, col）を持つ。

3つは同じRoPE frequency baseを共有しますが、bandごとのhidden-dim allocationはfixed splitではなくlearned parameterです。pretraining中にtemporalとspatial frequency resolutionのtrade-offを学習できます。

V2PEのablation claimは、同じcomputeでM-RoPEよりvideo benchmarkが1-2 points良いというものです。革命ではありませんが、よりきれいです。

### Visual Resolution Router (ViR)

Deployment optimizationです。すべての画像がfull-resolution encodingを必要とするわけではありません。low detailの単一object写真を1280px nativeでencodeするとtokensを無駄にします。ViRは、encoding前にquestionに答えるための最小resolutionを予測するsmall classifierです。

routingはlow-res（256 tokens）、medium（576）、high（2048+）の3 tiersです。production trafficでは60%のqueriesにlowまたはmediumで十分です。net effectは、同品質で2-3x throughputです。

### Decoupled Vision-Language deployment (DvD)

large VLMをserveするとき、vision encoderはimageごとに1回だけ動きますが、LLMはoutput tokenごとにautoregressiveに動きます。2つのcomponentはbottleneckが異なります（vision = conv + attentionのGPU memory bandwidth、LLM = KV cache）。DvDはそれらを別GPUに分け、間をstreamingします。

8B + 400M encoder modelでは、DvDはco-located構成に比べてper-node throughputをおおむね2倍にします。

### Single-stage vs multi-stage quality

InternVL3の主要benchmark claimは、78B paramsでGemini 2.5 ProのMMMU-Proに並ぶことです。38BではGPT-4oに並び、8Bではopen-8B leaderboardをリードします。すべてsingle-stage pretrain + instruction-tune recipeによるものです。

alignment-debt hypothesisは測定できます。InternVL3-8Bは、vision-benchmark gainあたりのtext-benchmark loss（MMLU、GSM8K）がQwen2.5-VL-7Bより少ないです。trainingが2つではなく1つのpieceだったため、modelはよりgeneralistです。

### InternVL3.5とInternVL-U

InternVL3.5（2025年8月）はrecipeをscaleします。同じnative-pretrain approachで、dataとparamsを増やします。MMMU improvementはincrementalです。

InternVL-U（2026）はunified generationを追加します。同じbackboneの上にMMDiT headsを置き、image outputを生成します。"U"は"Understanding + generation"を意味し、Transfusion-style unified models（Lesson 12.13）を追っています。同じnative-pretrain backboneがunderstandingとgenerationの両headsを支えます。

### Native pretrainingのtrade-off

Native pretrainingは無料ではありません。

- Compute。新しいVLMをfrom scratchでtrainingするcostは、text LLMをtrainingするのと同じです。millions of GPU-hoursが必要です。Post-hoc adaptationは既存LLM weightsを再利用し、大半のcostを節約します。
- Data。大規模interleaved image-text corporaは希少です。OBELICSは141M documents、MMC4は571Mです。text単体なら15T tokens規模があります。multimodal pretraining dataの希少性はhard constraintです。
- Base-LLM reuse。Native pretrainingは、後から新しいLLMを差し替える選択肢を捨てます。Post-hocならadapterだけをretrainingしてLlama-3.1をLlama-4にswapできます。

InternVL3の賭けは、alignment debtの方がreuse lossより悪いというものです。benchmarksはその主張を支えます。一方でproduce costは、将来のlabsが安価に複製することを妨げます。Post-hoc VLMsは大半のprojectsにとって安いままなので、今後も残ります。

## 使ってみる

`code/main.py`はtraining-corpus mixerとViR router simulatorです。次を行います。

- target corpus mix（%text、%interleaved、%caption、%video）を受け取り、modalityごとのexpected stepsを計算する。
- query batch（distribution: 50% low-detail、30% medium、20% high-detail）でViR routingをsimulateし、average token countをreportする。
- encoder vs LLM FLOPsに基づいてDvD throughput estimateをreportする。
- params、compute、data、expected alignment-debt symptomsについて、post-hocとnative pretrainingをside-by-sideで表示する。

## 仕上げ

このレッスンは`outputs/skill-native-vs-posthoc-auditor.md`を作ります。提案されたVLM training planを受け取り、nativeにするかpost-hocにするかをauditし、alignment-debt riskをflagし、corpus mixを推奨します。新しいopen-VLM projectの規模を見積もり、training strategyを選ぶときに使ってください。

## 演習

1. InternVL3-8B（native pretrain）とLLaVA-OneVision-7B（post-hoc）のcompute deltaを見積もってください。GPU-hoursのratioはおおよそどのくらいですか。gapは何で説明できますか。

2. InternVL3は40% text / 35% interleaved / 20% caption / 5% videoを報告しています。target taskがvideo-heavyなら新しいratioを提案し、それでもbase modelにかなりのtextとcaption dataが必要な理由を説明してください。

3. forgettingに関するMM1.5 Section 4を読んでください。post-hoc trainingで最大のregressionが出た正確なbenchmark名を挙げてください。regressionはどれくらいのcostでしたか。

4. ViRはtrafficの60%をlow-resolution encodingにrouteします。どんなqueryをmisrouteしますか（high-resが必要なのにlow-resへ送る）。router-failure modesを3つ提案してください。

5. DvDはvisionとLLMを別GPUに分割します。どんなtraffic patternでは、DvDがthroughputを上げるどころか悪化させますか。

## 重要語句

| Term | よく言われること | 実際の意味 |
|------|-----------------|------------------------|
| Native multimodal pretraining | "From scratch together" | Text + image + video tokensがstep 1からlossに参加し、後付けではないこと |
| Alignment debt | "Post-hoc penalty" | frozen LLMにvisionを後付けすることで生じる、text skillsとanswer consistencyの測定可能なregression |
| V2PE | "Variable visual pos encoding" | modalityごとにlearnableなposition encoding allocation。InternVL3のM-RoPE後継 |
| ViR | "Resolution router" | encoding前にqueryごとの最小resolutionを選ぶsmall classifier。inference tokensを節約する |
| DvD | "Decoupled deployment" | vision encoderを一方のGPU、LLMを別GPUに置き、stream handoffする構成。large VLMのthroughputを上げる |
| InternVL-U | "Unified understanding + generation" | native-pretrain backboneにimage-generation headsを追加する2026年のfollow-up |
| Interleaved corpus | "OBELICS / MMC4" | textとimagesが自然な読順で混在したdocuments。native pretrainingのraw material |

## 参考文献

- [Chen et al. — InternVL 1 (arXiv:2312.14238)](https://arxiv.org/abs/2312.14238)
- [Zhu et al. — InternVL3 (arXiv:2504.10479)](https://arxiv.org/abs/2504.10479)
- [InternVL3.5 (arXiv:2508.18265)](https://arxiv.org/abs/2508.18265)
- [InternVL-U (arXiv:2603.09877)](https://arxiv.org/abs/2603.09877)
- [Zhang et al. — MM1.5 (arXiv:2409.20566)](https://arxiv.org/abs/2409.20566)
