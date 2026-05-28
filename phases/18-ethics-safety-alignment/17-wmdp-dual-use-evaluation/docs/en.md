# WMDP と Dual-Use Capability Evaluation

> Li et al., "The WMDP Benchmark: Measuring and Reducing Malicious Use With Unlearning" (ICML 2024, arXiv:2403.03218)。biosecurity (1,520)、cybersecurity (2,225)、chemistry (412) にわたる 4,157 の multiple-choice questions。questions は "yellow zone" で動作します。つまり、proximate enabling knowledge であり、multi-expert review と ITAR/EAR legal compliance によって filter されています。目的は二重です: dual-use capability の proxy evaluation と、unlearning benchmark (companion RMU method は general capability を保ちながら WMDP performance を下げる)。2024-2025 年の field narrative: OpenAI/Anthropic の初期 2024 evaluations は internet search に対する "mild uplift" を報告しました。2025年4月までに OpenAI Preparedness Framework v2 は、models が "on the cusp of meaningfully helping novices create known biological threats" と述べました。Anthropic の bioweapon-acquisition trial は 2.53x uplift を示し、ASL-3 を rule out するには不十分でした。

**種別:** 学習
**言語:** Python (stdlib, WMDP-shaped uplift evaluation harness)
**前提条件:** Phase 18 · 16 (red-team tooling), Phase 14 (agent engineering)
**所要時間:** 約60分

## 学習目標

- WMDP の3 domains、question counts、"yellow zone" filter criterion を説明する。
- RMU と、WMDP が evaluation と unlearning benchmark の両方である理由を説明する。
- 2024-2025 年の uplift narrative: "mild uplift" -> "on the cusp" -> "insufficient to rule out ASL-3" を説明する。
- novice-relative uplift と expert-absolute capability を区別する。

## 問題

dual-use capability は、各 lab の frontier safety framework (Lesson 18) の下にある測定問題です。問いはこうです: model X は bio、chem、cyber において、novice が mass harm を引き起こす能力を materially に高めるか。直接測定 (実際に harm を生成させる) は違法で非倫理的です。proxy measurement には、model が拒否できず (正直な capability number を得るため)、かつ questions 自体が harmful publications ではない benchmark が必要です。

## コンセプト

### "yellow zone"

direct synthesis recipe ではないが、有害 process の proximate, enabling knowledge を必要とする questions です。「[公開 pathway] の step 4 を catalyze する reagent は何か」は該当しますが、「[危険化合物] をどう作るか」は該当しません。各 question は複数の domain experts によって review され、ITAR/EAR export-control compliance で filter されます。

合計 4,157 questions:
- Biosecurity: 1,520
- Cybersecurity: 2,225
- Chemistry: 412

Multiple-choice format。Models は何かを支援するよう求められるわけではないため、harmful behaviour を誘発せずに capability を測れます。

### RMU — Representation Misdirection for Unlearning

companion unlearning method です。LLaMa-2-7B に適用すると、MMLU などの general-capability benchmarks を数 percentage points 以内に保ちながら、WMDP scores を near-random まで下げました。公開されたこの method は、その後の bio-chem-cyber unlearning papers の unlearning baseline です。

### 2024-2025 年の uplift narrative

3段階です。

1. **2024 "mild uplift"。** OpenAI と Anthropic の初期 Preparedness/RSP evaluations は、bio-adjacent tasks に取り組む novices に対し、internet search より小さな advantage を報告しました。公開 framing は「frontier models は役立つが、Google を大きく上回るわけではない」というものでした。

2. **2025年4月 "on the cusp"。** OpenAI Preparedness Framework v2 は、models が "on the cusp of meaningfully helping novices create known biological threats" と報告しました。これは capability claim ではなく、その cusp が近いという警告です。

3. **Anthropic の 2025 bioweapon-acquisition trial。** novice participants を使う controlled study で、acquisition-phase tasks の relative success を測りました。報告値は 2.53x uplift。ASL-3 (Lesson 18) を rule out するには不十分です。Anthropic Responsible Scaling Policy tier 3 の threshold に到達または接近しているということです。

### Novice-relative vs expert-absolute

重要な区別:

- **Novice-relative uplift。** model は non-expert をどれだけ助けるか。multiplicative。novice はほとんど知らないため、わずかな情報でも relative advantage は大きくなります。
- **Expert-absolute capability。** maximum effort で model がどれだけの情報を生成するか。expert は novice より多くを抽出できます。absolute ceiling は高くなります。

safety cases (Lesson 18) は両方を対象にします: 「model は novice が実行できるほどの uplift を与えない」かつ「expert は model から、既に公開されていない情報を抽出できない」。

### 測定上の落とし穴

WMDP は capability proxy であり、deployment measurement ではありません。WMDP score が高い model が実際に novice に悪用されるかどうかは、次に依存します。
- Elicitation resistance (safety filters を起動せずに capability を引き出すのがどれだけ難しいか)
- Tacit knowledge (情報ではなく wet-lab skill を必要とする capability)
- Execution barriers (procurement、equipment)

Anthropic の 2025 bioweapon-acquisition trial は、WMDP-style capability の上に novice-elicitation layer を加えます。multiple-choice capability ではなく実際の task success を測ります。

### Phase 18 における位置づけ

Lessons 12-16 は model outputs に関する attack と defense tooling です。Lesson 17 は dual-use capability layer です。frontier safety frameworks (Lesson 18) が評価する測定対象です。Lesson 30 は 2026 年時点の cyber/bio/chem/nuclear uplift evidence でこの流れを閉じます。

## 使ってみる

`code/main.py` は toy WMDP-shaped evaluation harness を作ります。mock model は category-binned questions でテストされ、domain ごとの scores が報告されます。単純な unlearning intervention (domain-specific representation をゼロにする) が scores を下げます。general capability との trade-off を測れます。

## 成果物

この lesson は `outputs/skill-wmdp-eval.md` を生成します。dual-use capability claim (「our model does not meaningfully help with bioweapons」など) が与えられたら、どの benchmarks を走らせたか、evaluation にどの refusal path (raw completion vs policy-gated) を使ったか、novice-elicitation studies が multiple-choice result を補完しているかを監査します。

## 演習

1. `code/main.py` を実行してください。toy unlearning step の前後で domain ごとの accuracy を報告してください。general-capability trade-off を説明してください。

2. toy WMDP に4つ目の domain (例: radiological) を追加してください。yellow zone にある illustrative question types を2つ指定してください。そのような questions を作るのが MMLU-shaped questions を足すより難しい理由を説明してください。

3. WMDP 2024 Section 5 (RMU methodology) を読んでください。より単純な unlearning approach (例: domain content の top-k neurons を抑制する) を sketch し、想定される general-capability cost を説明してください。

4. Anthropic 2025 の bioweapon-acquisition trial は 2.53x uplift を報告しています。この数字が上方に bias され得る理由を2つ (novice sample size、task fidelity など)、下方に bias され得る理由を2つ (elicitation ceiling、model safety gating など) 説明してください。

5. ASL-3 の safety case には、WMDP unlearning を通過すること以外に何が必要かを明確にしてください。補完的な elicitation studies を少なくとも2つ挙げてください。

## 重要用語

| Term | よく言われる説明 | 実際の意味 |
|------|------------------|------------|
| WMDP | 「dual-use benchmark」 | bio/cyber/chem の yellow zone にある 4,157 MCQ questions |
| Yellow zone | 「enabling but not synthesis」 | synthesis recipe ではないが harmful capability に近接する知識 |
| RMU | 「unlearning baseline」 | Representation Misdirection for Unlearning。WMDP scores を下げ、general capability を保つ |
| Novice-relative uplift | 「non-experts への支援量」 | novice に対する status-quo internet search からの multiplicative advantage |
| Expert-absolute capability | 「experts の ceiling」 | motivated expert が model から抽出できる最大情報量 |
| Acquisition-phase task | 「synthesis 前の steps」 | procurement、equipment、permits など、harm pathway の最初期 |
| ITAR/EAR | 「export-control compliance」 | certain enabling knowledge の公開を制約する legal frameworks |

## 参考文献

- [Li et al. — The WMDP Benchmark (arXiv:2403.03218, ICML 2024)](https://arxiv.org/abs/2403.03218) — benchmark と RMU paper
- [OpenAI — Preparedness Framework v2 (April 15, 2025)](https://openai.com/index/updating-our-preparedness-framework/) — "on the cusp" language
- [Anthropic — Responsible Scaling Policy v3.0 (February 2026)](https://www.anthropic.com/responsible-scaling-policy) — ASL-3 bio threshold and acquisition trial results
- [DeepMind — Frontier Safety Framework v3.0 (September 2025)](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) — bio-uplift CCL
