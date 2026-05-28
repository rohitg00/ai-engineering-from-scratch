# Open-Weight VLM Recipes: 実際に効くもの

> 2024-2026年の open-weight VLM literature は ablation table の森である。Apple の MM1 は image encoder、connector、data mix の13通りの組み合わせを調べた。Allen AI の Molmo は、詳細な human captions が GPT-4V distillation に勝つことを示した。Cambrian-1 は 20 以上の encoder を比較した。Idefics2 は5軸の design space を定式化した。Prismatic VLMs は controlled benchmark で 27 個の training recipes を比較した。その大量の noise の中で、論文をまたいで成り立つ小さな結果群がある。image encoder は connector architecture より重要で、data mixture はそのどちらより重要で、詳細な human captions は distilled synthetic data に勝つ。この lesson は、それらの table をあなたの代わりに読む。

**種別:** 学習 + lab
**言語:** Python (stdlib、ablation table parser + recipe picker)
**前提条件:** Phase 12 · 05 (LLaVA baseline)
**所要時間:** 約180分

## 学習目標

- VLM design space の5軸、image encoder、connector、LLM、data mix、resolution schedule を挙げる。
- MM1 / Idefics2 / Cambrian-1 の ablation table を読み、どの knob がどの benchmark を動かすかを予測する。
- compute budget と task mix から、新しい VLM の recipe (encoder、connector、data、resolution) を選ぶ。
- 同じ token count で詳細な human captions が GPT-4V distillation に勝つ理由を説明する。

## 問題

open-weight VLM は数百存在する。「良い」と「state-of-the-art」の差の大半は architecture ではない。data、resolution schedule、encoder choice である。model が期待より弱いときに、どの knob を最初に回すべきかを知っていれば、500万 GPU-hour の失敗を避けられる。

2023年の wave (LLaVA-1.5、InstructBLIP、MiniGPT-4) は caption-pair pretraining + LLaVA-Instruct-150k で動いていた。良い baseline だが、MMMU はおよそ 35% で頭打ちだった。

2024年の wave (MM1、Idefics2、Molmo、Cambrian-1、Prismatic VLMs) は網羅的な ablation を走らせた。結果は意外で実用的だった。

## コンセプト

### 5軸の design space

Idefics2 (Laurençon et al., 2024) は軸に名前を付けた。

1. Image encoder。CLIP ViT-L/14、SigLIP SO400m/14、DINOv2 ViT-g/14、InternViT-6B。encoder は patch size、resolution、pretraining objective が異なる。
2. Connector。MLP (2-4 layers)、Q-Former (32 queries + cross-attn)、Perceiver Resampler (64 queries)、C-Abstractor (convolutional + bilinear pooling)。
3. Language model。Llama-3 8B / 70B、Mistral 7B、Phi-3、Gemma-2、Qwen2.5。LLM size は parameter cost の支配項である。
4. Training data。Caption pairs (CC3M、LAION)、interleaved (OBELICS、MMC4)、instruction (LLaVA-Instruct、ShareGPT4V、PixMo、Cauldron)。
5. Resolution schedule。Fixed 224/336/448、AnyRes、native dynamic。training 中に ramp するか、constant にするか。

すべての production VLM は各軸で選択をしている。MMMU score の variance の多くは軸 1、4、5 で説明できる。どの connector を選んだかではない。

### Axis 1: encoder > connector

MM1 Section 3.2 はこう示した。CLIP ViT-L/14 から SigLIP SO400m/14 に swap すると MMMU が 3+ points 上がる。connector を MLP から Perceiver Resampler に変えても 1 point 未満しか上がらない。Idefics2 も再現した。SigLIP > CLIP、同じ token count では Q-Former ≈ MLP ≈ Perceiver である。

Cambrian-1 の "Cambrian Vision Encoders Match-Up" (Tong et al., 2024) は、vision-centric benchmark (CV-Bench) で 20 以上の encoder を走らせた。leaderboard 上位は DINOv2 と SigLIP の混合で、CLIP は中位、ImageBind と ViT-MAE は下位である。CLIP ViT-L から DINOv2 ViT-g/14 への差は CV-Bench で約 5-7 points ある。

2026年の open VLM の default encoder は、semantic + dense features 用の SigLIP 2 SO400m/14 であり、segmentation/grounding が必要なら DINOv2 ViT-g/14 features と連結することがある (Cambrian の "Spatial Vision Aggregator" はこれを行う)。

### Axis 2: connector design はほぼ横並び

MM1、Idefics2、Prismatic、MM-Interleaved はすべて同じ結論に到達した。固定 visual-token count では、connector architecture はほとんど効かない。同じ token budget なら、mean-pooled patches 上の 2-layer MLP は 32-query Q-Former の 1 point 以内に収まる。

効くのは token count である。より多い visual tokens は、より多い LLM compute と引き換えに性能を上げる。ただし一定点を過ぎると diminishing returns になる。画像あたり 64 tokens は OCR には少なすぎる。576-1024 tokens はほとんどの open VLM の sweet spot である。2048+ が効くのは documents と charts くらいである。

Q-Former vs MLP は quality ではなく cost の問題である。Q-Former は image resolution に関係なく tokens を 32-64 に制限する。MLP はすべての patch tokens を出す。high-res input では Q-Former が LLM context を節約する。low-res では差は noise である。

### Axis 3: LLM size が ceiling を決める

LLM を 7B から 13B に倍増すると、どの VLM paper でも MMMU が確実に 2-4 points 上がる。70B ではほとんどの benchmark が飽和する。VLM の multimodal reasoning ceiling は LLM の text reasoning ceiling である。visual encoder は input を渡せるだけで、代わりに reasoning はできない。

だから Qwen2.5-VL-72B と Claude Opus 4.7 は MMMU-Pro と ScreenSpot-Pro で圧倒的に強い。language brain が巨大だからである。7B VLM は、巧妙な connector design では 70B VLM の代わりにならない。

### Axis 4: data — 詳細な human captions は distillation に勝つ

Molmo + PixMo (Deitke et al., 2024) は、全員が読むべき2024年の結果である。Allen AI は human annotators に画像を 1-3 分の dense speech-to-text で説明させ、712K 件の densely-captioned images を得た。training data に GPT-4V distillation は一切ない。

Molmo-72B は 11/11 benchmarks で Llama-3.2-90B-Vision を上回った。delta は architecture ではない。caption quality である。詳細な human captions は、短い web captions より画像あたり 5-10 倍多い情報を含み、GPT-4V distillation が hallucinate するところでも factual に grounded である。

ShareGPT4V (Chen et al., 2023) と Cauldron (Idefics2) は mixed human + GPT-4V captions で同じ playbook を採用した。trend は明確である。2026年 frontier では、caption density > caption quantity > distillation convenience である。

### Axis 5: resolution と schedule

Idefics2 の ablations: 384 -> 448 は 1-2 points 上げる。448 -> 980 に image splitting (AnyRes) を加えると、OCR benchmarks でさらに 3-5 上がる。flat resolution training は中程度の accuracy で plateau する。resolution ramping (224 から始め、448 または native で終える) はより速く学習し、最後も高くなる。

Cambrian-1 は resolution vs tokens の trade-off を調べた。fixed compute では、低解像度でより多い tokens を持つか、高解像度でより少ない tokens を持つかを選べる。OCR では高解像度が勝つ。general scene understanding では low-res-more-tokens が勝つ。

2026年 production recipe: Stage 1 は fixed 384 で学習し、OCR-heavy task では Stage 2 を最大 1280 までの dynamic resolution で行う。

### Prismatic の controlled comparison

Prismatic VLMs (Karamcheti et al., 2024) は全軸を control した論文である。同じ 13B LLM、同じ instruction data、同じ evaluation を使い、1回に1軸だけを変える。結果:

- per-image visual-token count が variance の約60%を説明する。
- encoder choice が約20%を説明する。
- connector architecture は約5%を説明する。
- その他すべて (data mix、scheduler、LR) が残りの約15%である。

これは粗い decomposition だが、文献上「最初に何を ablate すべきか」への最もきれいな答えである。

### 2026年向け picker

証拠から見ると、2026年に新規 project で使う default open-VLM recipe は次の通りである。

- Encoder: native resolution + NaFlex の SigLIP 2 SO400m/14。segmentation/grounding が必要なら dense features 用に DINOv2 ViT-g/14 と連結する。
- Connector: patch tokens 上の 2-layer MLP。token-constrained でない限り Q-Former は不要。
- LLM: Qwen2.5 / Llama-3.1 / Gemma 2。cost なら 7B、quality なら 70B。target latency で選ぶ。
- Data: PixMo + ShareGPT4V + Cauldron に task-specific instruction data を足す。
- Resolution: dynamic (long side min 256、max 1280)。
- Schedule: Stage 1 alignment (projector-only)、Stage 2 full fine-tune、Stage 3 task-specific fine-tune。

これらの default はすべて、この lesson の最後に挙げた論文の measured ablation に根拠がある。

## 使ってみる

`code/main.py` は ablation table parser と recipe picker である。MM1 と Idefics2 の ablation table (condensed) を encode し、次の問い合わせを可能にする。

- 「budget X と task Y があるとき、どの recipe が勝つか」
- 「7B Llama で SigLIP を CLIP に swap すると、期待される MMMU delta はいくつか」
- 「80% confidence の答えを得るには、最初にどの axis を ablate すべきか」

出力は、期待 benchmark delta と "ablate first" recommendation 付きの ranked recipe list である。

## 仕上げ

この lesson は `outputs/skill-vlm-recipe-picker.md` を生成する。target task mix、compute budget、latency target を受け取り、各選択の根拠となる ablation citation 付きで full recipe (encoder、connector、LLM、data mix、resolution schedule) を出力する。新しい VLM project のたびに Idefics2 の ablation table を再発明するのを防ぐ。

## 演習

1. MM1 Section 3.2 を読め。固定 2B LLM、50M images の budget では、どの encoder が勝つか。13B LLM なら答えは反転するか。なぜか。

2. Cambrian-1 は、DINOv2 + SigLIP の連結が vision-centric benchmark では単体より優れるが、MMMU では signal を追加しないと示した。どの benchmark が伸び、どれが flat のままかを予測せよ。

3. target は 2B LLM 上の mobile UI agent である。encoder、connector、resolution、data mix を選べ。それぞれを specific ablation table で正当化せよ。

4. Molmo は 4B と 72B の model を出荷している。4B は closed 7B VLMs と競争力があり、72B は 11/11 benchmarks で Llama-3.2-90B-Vision を上回る。これは LLM-size plateau hypothesis について何を示すか。

5. 7B VLM で data-mix quality と encoder quality を切り分ける ablation table を設計せよ。minimum training runs はいくつ必要か。4つの axis settings を提案せよ。

## 重要語句

| Term | よく言われる表現 | 実際の意味 |
|------|-----------------|------------|
| Ablation | "Turning one knob" | それ以外を固定し、design-space axis を1つだけ変えた複数 run の training |
| Connector | "Bridge" / "projector" | vision encoder output を LLM token space に写像する trainable module (MLP、Q-Former、Perceiver) |
| Detailed human caption | "Dense caption" | web alt text より豊かな、人手で書かれた multi-sentence description (通常 80-300 tokens) |
| Distillation | "GPT-4V captions" | より強い proprietary VLM で生成した training data。便利だが inherited hallucination を起こしやすい |
| AnyRes / dynamic res | "High-res path" | tiling または M-RoPE で encoder native resolution より大きい画像を入力する strategy |
| Resolution ramp | "Curriculum" | 低解像度から始めて解像度を上げ、alignment learning を速める training schedule |
| Vision-centric bench | "CV-Bench / BLINK" | language-heavy reasoning ではなく fine-grained visual perception に負荷をかける evaluation |
| PixMo | "Molmo's data" | Allen AI の 712K densely-captioned image dataset。human speech を dense captions に transcript したもの |

## 参考文献

- [McKinzie et al. — MM1 (arXiv:2403.09611)](https://arxiv.org/abs/2403.09611)
- [Laurençon et al. — Idefics2 / What matters building VLMs (arXiv:2405.02246)](https://arxiv.org/abs/2405.02246)
- [Deitke et al. — Molmo and PixMo (arXiv:2409.17146)](https://arxiv.org/abs/2409.17146)
- [Tong et al. — Cambrian-1 (arXiv:2406.16860)](https://arxiv.org/abs/2406.16860)
- [Karamcheti et al. — Prismatic VLMs (arXiv:2402.07865)](https://arxiv.org/abs/2402.07865)
