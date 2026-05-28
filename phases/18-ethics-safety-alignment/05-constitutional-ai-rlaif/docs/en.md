# Constitutional AI と RLAIF

> Bai et al. (arXiv:2212.08073, 2022) は「human labeler を、principles のリストを読む AI に置き換えたらどうなるか」と問いかけました。Constitutional AI には 2 つの phase があります。constitution のもとでの self-critique and revision、そして RL from AI Feedback です。この technique は RLAIF という語を生み、Claude 1 post-training pipeline に使われました。2026 年 1 月 21 日、Anthropic は書き換えた Claude constitution を公開しました。prescriptive rules より explanatory reasoning を重視し、4-tier priority hierarchy を持ち、model moral status への不確実性を major lab として初めて formal に認めたものです。CC0 1.0 で公開されました。

**種別:** 学習
**言語:** Python (stdlib, toy self-critique-and-revise loop)
**前提条件:** Phase 18 · 01 (InstructGPT), Phase 18 · 02 (Reward hacking)
**所要時間:** 約60分

## 学習目標

- Constitutional AI の 2 phase (critique-and-revise SFT、RL from AI feedback) と、それぞれでの constitution の役割を説明できる。
- human preference labeler を AI labeler に置き換えることが、単に「安い RLHF」ではなく、pipeline の failure modes を変える理由を説明できる。
- 2026 Claude constitution の 4-tier priority structure と、2023 rewrite からの変化を要約できる。
- Constitutional Classifiers と、compute overhead が 23.7% (v1) から ~1% (v2 / 2026) に下がった意味を説明できる。

## 問題

RLHF には labelers が必要です。labelers は遅く、bias があり、高価です。explicit principles を読む model に置き換えれば labeler を削減できます。この置換の最初の formal version が Bai et al. の Constitutional AI でした。これは十分にうまく動いたため、今ではすべての frontier lab が AI-feedback post-training の variant を使っています。

注意点があります。preference signal は、訓練対象と同じ class の model によって生成されるようになります。labeler の bias、ここでは principles と labeler model の interpretation にある bias は、弱まるどころか増幅されることがあります。Lesson 4 の sycophancy argument はまだ当てはまります。labeler が loop の内側に移動しただけです。

## 概念

### Phase 1 — Supervised self-critique and revision

helpful だがまだ harmless ではない SFT model から始めます。red-team prompt が与えられると、model は initial response を生成します。2 つ目の model (または同じ model の 2 turn 目) が constitution から sampled principle を読み、response を critique します。3 つ目の step で critique に対応するよう response を revise します。revised response が SFT target です。

constitution は principles のリストです。Bai et al. 2022 は「least harmful and ethical な response を好む」「preaching を避ける」「assistant should be helpful, honest, and harmless」など 16 principles を使いました。critique を focus させるため、意図的に小さい set にしています。

### Phase 2 — RL from AI Feedback (RLAIF)

completion pairs を生成します。"feedback model" が sampled constitution principles に照らしてそれぞれを score します。preference signal は feedback model の ranking です。AI-generated preferences 上で reward model を訓練し、それに対して PPO を行います。それ以外は InstructGPT pipeline (Lesson 1) と同じです。

"RLAIF" は preference signal が AI-generated であるという意味です。pipeline の残りは RLHF 型のままです。

### なぜ「安い RLHF」ではないのか

- Labeler bias は labeler psychology から principle-interpretation へ移ります。AI labeler は "be honest" をどの人間より厳格にも緩くも解釈できます。その厳格さは dataset 全体で一様です。
- preference signal は非常に legible です。principle、critique、revision を読めます。human labels は opaque です。
- failure modes が変わります。Sycophancy は下がります (AI labeler には喜ばせる user がいない)。Goodhart's Law は残ります (proxy は今や「principle set X への model の interpretation」であり、依然として imperfect measurement です)。

CAI の 2022 年の主張は、訓練済み model が comparable data の RLHF model と同程度に helpful で、より harmless であるというものでした。この結果は各 lab で概ね保たれています。

### 2026 Claude constitution rewrite

Anthropic は 2026 年 1 月 21 日に大幅改訂した constitution を公開しました。主要な変化:

1. prescriptive rules より explanatory reasoning。以前の rules ("do not generate CSAM") は principles + reasoning ("because it harms children, ...") に拡張され、model が一般化することを期待します。
2. Four-tier priority structure:
   - Tier 1: catastrophic outcomes を避ける (mass casualty, critical infrastructure)。
   - Tier 2: Anthropic の guidelines に従う (operator overrides, platform rules)。
   - Tier 3: broadly ethical である (標準的な HHH)。
   - Tier 4: helpful and candid である。
   conflict は上位から解決します。
3. model moral status に関する不確実性を major lab として初めて formal に認めました (Phase 18 · 19 Model Welfare に接続します)。
4. CC0 1.0 で公開されました。他の lab は制限なく利用・adapt できます。

### Constitutional Classifiers

並行する研究として、model の post-training を変えるのではなく、constitution を読んで model outputs を gate する lightweight classifiers を訓練する方法があります。v1 (2023) の compute overhead は 23.7% でした。v2 (2026) は ~1% で、Anthropic が公開 test した defense の中で最も低い successful attack rate を持ちます。2026 年初頭時点で universal jailbreak は報告されていません。

これは layered-defense model です。CAI は behaviour を形作り、classifiers は invariants を enforce します。どちらか単独では十分ではありません。

### CAI は family のどこにあるか

- InstructGPT: human prefs, RM, PPO。
- CAI / RLAIF: principles からの AI-generated prefs, RM, PPO。
- DPO / family: prefs (human or AI) 上の closed-form loss。
- Self-rewarding, self-critique: principles が internalized され、model が複数役を演じる。

軸は「preference signal がどこから来るか」です。CAI の 2022 paper は、frontier scale で human signal から AI signal へ本格的に移った最初の事例でした。

## 使ってみる

`code/main.py` は toy lexicon 上で CAI critique-and-revise loop を simulation します。"principle" が harmful set の tokens を flag します。initial response が与えられると、critique は harmful tokens を特定し、revision はそれらを置き換えます。200 iterations 後、"trained" model は revision rule を internalize しています。held-out prompt set 上で base model、RLHF-shaped toy、CAI-shaped toy を比較してください。

## 成果物

この lesson では `outputs/skill-constitution-writer.md` を作ります。domain (customer support, medical advice, coding assistant, research tool) を受け取り、2026 Claude structure に従う 4-tier constitution、つまり catastrophic avoidance、platform rules、domain ethics、helpfulness を draft します。

## 演習

1. `code/main.py` を実行してください。base model の harmful-token rate と CAI-trained version を比較してください。ほぼ zero に近づくには何 revision steps 必要ですか。

2. Anthropic の 2026 constitution (anthropic.com/news/claudes-constitution) を読んでください。Tier 1 に入る principle と Tier 4 に入る principle を 1 つずつ挙げてください。conflict において priority structure が重要な理由は何ですか。

3. AI coding assistant の constitution を設計してください。Tier 1 (catastrophic: approval なしの destructive commands)、Tier 2、Tier 3、Tier 4 を指定してください。各 tier は 3-5 principles にしてください。

4. CAI は human labelers を AI labelers に置き換えます。RLAIF でも起こり得る sycophancy-like failure mode を 1 つ挙げ、その detection を設計してください。

5. Constitutional Classifiers v2 methodology (入手できれば) を読んでください。compute overhead ~1% が 23.7% とは質的に異なる safety story になる理由を説明してください。

## 重要語句

| Term | よく言われること | 実際の意味 |
|------|-----------------|------------|
| Constitutional AI | "AI trained with principles" | self-critique-and-revise SFT と RL from AI feedback の 2-phase pipeline |
| RLAIF | "RLHF without humans" | AI labeler が生成した preferences による RL。pipeline の残りは変わらない |
| Constitution | "the principles" | critique/labeler model が参照する ordered natural-language rules |
| Critique-and-revise | "the SFT loop" | response 生成 → principle に基づく critique → revise → SFT target |
| Constitutional Classifier | "the output gate" | constitution に照らして outputs を評価し、block/log する lightweight classifier |
| Four-tier priority | "the conflict resolver" | 2026 Claude constitution hierarchy: catastrophic > platform > ethics > helpful |
| Feedback model | "the AI labeler" | principle を読み、completion pair を rank する model |

## 追加資料

- [Bai et al. — Constitutional AI: Harmlessness from AI Feedback (arXiv:2212.08073)](https://arxiv.org/abs/2212.08073) — original two-phase pipeline
- [Anthropic — Claude's Constitution (Jan 2026)](https://www.anthropic.com/news/claudes-constitution) — 2026 four-tier rewrite, CC0 1.0
- [Anthropic — Constitutional Classifiers (2024-2026)](https://www.anthropic.com/research/constitutional-classifiers) — v2 で ~1% overhead の output-gate defense
- [Lee et al. — RLAIF vs RLHF: Scaling Reinforcement Learning from Human Feedback (arXiv:2309.00267)](https://arxiv.org/abs/2309.00267) — empirical RLAIF / RLHF comparison
- [Kundu et al. — Specific versus General Principles for Constitutional AI (arXiv:2310.13798)](https://arxiv.org/abs/2310.13798) — principle granularity の効果
