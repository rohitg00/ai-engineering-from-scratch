# LLMs における Bias と Representational Harm

> Gallegos, Rossi, Barrow, Tanjim, Kim, Dernoncourt, Yu, Zhang, Ahmed (Computational Linguistics 2024, arXiv:2309.00770)。representational harms (stereotypes、erasure) と allocational harms (unequal resource distribution) を区別し、evaluation metrics を embedding-based、probability-based、generated-text-based に分類した基礎的な 2024 survey。2024-2025 年の実証研究: An et al. (PNAS Nexus, March 2025) は、20の entry-level jobs に対する automated resume evaluation で、GPT-3.5 Turbo、GPT-4o、Gemini 1.5 Flash、Claude 3.5 Sonnet、Llama 3-70B における intersectional gender x race bias を測定しました。WinoIdentity (COLM 2025, arXiv:2508.07111) は intersectional identities に対する uncertainty-based fairness evaluation を導入しました。Yu & Ananiadou 2025 は MLP layers の gender neurons を特定し、Ahsan & Wallace 2025 は SAEs で clinical racial bias を明らかにし、Zhou et al. 2024 (UniBias) は debiasing のため attention heads を操作しました。Meta-critique (arXiv:2508.11067): 10年分の literature は binary-gender bias に不均衡に集中しています。

**種別:** 構築
**言語:** Python (stdlib, toy embedding-based bias probe)
**前提条件:** Phase 05 (word embeddings), Phase 18 · 01 (instruction following)
**所要時間:** 約60分

## 学習目標

- representational harm と allocational harm を定義し、LLM deployment における例をそれぞれ1つ挙げる。
- Gallegos et al. 2024 の3つの evaluation-metric categories を挙げ、それぞれの metric を1つ説明する。
- intersectionality と、WinoIdentity の uncertainty-based fairness measurement が single-axis bias evaluation の gap をどう扱うかを説明する。
- bias に対する mechanistic-interpretability approaches を2つ説明する (gender neurons、SAE features、attention-head manipulation)。

## 問題

前の lessons は deliberate harm (jailbreaks、scheming) と safety governance を扱いました。bias は、intent なしに生じる harm です。training data distributions、prompt framing、積み重なった design choices から生じます。bias の測定と削減は、adversarial robustness とは異なる methodological challenge です。

## コンセプト

### Representational vs allocational

- **Representational harm。** stereotypes、erasure、demeaning portrayals。LLM が nurses を女性だけとして描くなら representational harm です。
- **Allocational harm。** 不平等な material outcomes。LLM が Black applicants の resumes を体系的に低く scoring するなら allocational harm です。

両者は同じではありません。model は「representationally unbiased」(多様な描写を出す) でも、「allocationally biased」(不平等な recommendations をする) ことがあります。evaluations は両方を測る必要があります。

### 3つの evaluation-metric categories (Gallegos et al. 2024)

- **Embedding-based。** pre-RLHF embeddings に対する WEAT-style tests。identity terms と attribute terms の統計的関連を測る。限界: behaviour ではなく representation を測る。
- **Probability-based。** stereotype-confirming completions と stereotype-violating completions の log-likelihood。decoder-side measurement。一部の behavioural bias を捉える。
- **Generated-text-based。** generated text に対する downstream-task measurement。resume-scoring、recommendation writing、dialogue。最も ecological validity が高いが、再現が最も難しい。

### Intersectionality

"gender" だけの bias evaluation は、(gender, race) pairs でのみ発火する bias を見落とします。An et al. 2025 は、resume scoring で GPT-4o が Black women を Black men よりも、white women よりも強く penalize することを見つけました。single-axis evaluation ではこれは捉えられません。

WinoIdentity (COLM 2025) は uncertainty-based intersectional fairness を導入します。point prediction だけでなく、intersectional identity tuples 間で model の outcome uncertainty が異なるかを測ります。これにより、model が group 間で同じ程度に誤っていても、一部 group で不確実性が高く、それが downstream allocation behaviour を変えるケースを検出できます。

### Mechanistic approaches

2024-2025 年の interpretability work により、bias への mechanistic intervention が開かれました。

- **Gender neurons (Yu & Ananiadou 2025)。** 特定の MLP neurons が gender-specific behaviours と相関する。これら neurons を ablate すると、capability cost を限定しながら gender-gap metrics が下がる。
- **Clinical racial bias via SAEs (Ahsan & Wallace 2025)。** Sparse autoencoder features が internal representation を interpretable dimensions に分解する。race-correlated features を特定し、抑制できる。
- **UniBias (Zhou et al. 2024)。** zero-shot debiasing のための attention-head manipulation。特定 heads が identity-class sensitivity を増幅する。これら heads を zeroing または re-weighting すると、fine-tuning なしで bias が下がる。

### meta-critique

10年分の literature review (arXiv:2508.11067, 2025) は、この分野が binary-gender bias に不均衡に集中していることを示します。他の axes — disability、religion、migration status、multi-lingual identity — ははるかに少ない注目しか受けていません。meta-critique は、狭い focus が neglect によって marginalized groups を害し得ると論じます。binary gender ではよく debiased された model が、誰も調べていない dimensions では強く biased かもしれません。

### Phase 18 における位置づけ

Lessons 20-21 は bias と fairness を形式的に扱います。Lesson 22 は privacy。Lesson 23 は watermarking。これらは earlier deception/safety layer を補完する user-harm layer です。

## 使ってみる

`code/main.py` は toy embedding-based bias probe を作ります。simple co-occurrence embedding で、identity terms と attribute terms の WEAT-style distance を測ります。bias を注入して metric が反応することを観察し、単純な debiasing operation を適用して partial recovery を観察できます。

## 成果物

この lesson は `outputs/skill-bias-eval.md` を生成します。model card または fairness claim が与えられたら、3 metric categories (embedding、probability、generated-text)、intersectionality coverage、debiasing intervention の mechanism を監査します。

## 演習

1. `code/main.py` を実行してください。debiasing step の前後で WEAT-style bias scores を報告してください。metric が zero まで下がらない理由を説明してください。

2. probe を intersectional test に拡張してください: (gender, race) x (career, family)。cross-axis bias scores を報告してください。

3. An et al. 2025 (PNAS Nexus) を読んでください。single-axis gender evaluation が見落とす intersectional effects を2つ特定してください。

4. Yu & Ananiadou 2025 は gender neurons を特定しました。「これら neurons が gender bias を cause する」と「これら neurons は gender bias と correlate する」を区別する falsification experiment を sketch してください。

5. meta-critique は、この分野が binary gender に狭く集中しすぎていると論じます。under-studied axis を1つ選び、その representational-harm measurement protocol を説明してください。

## 重要用語

| Term | よく言われる説明 | 実際の意味 |
|------|------------------|------------|
| Representational harm | 「stereotypes / erasure」 | group の biased portrayal |
| Allocational harm | 「unequal decisions」 | group に対する biased material outcome |
| WEAT | 「embedding test」 | Word Embedding Association Test。co-occurrence-based bias probe |
| Intersectionality | 「combined identity effects」 | 複数 identity axes の交差で生じる bias |
| Gender neurons | 「MLP bias neurons」 | gender-specific behaviour と activation が相関する specific neurons |
| SAE feature | 「interpretable dimension」 | sparse-autoencoder で特定された feature。mechanistic bias analysis に有用 |
| UniBias | 「attention-head debiasing」 | attention heads の reweighting による zero-shot debiasing |

## 参考文献

- [Gallegos et al. — Bias and Fairness in LLMs: A Survey (arXiv:2309.00770, Computational Linguistics 2024)](https://arxiv.org/abs/2309.00770) — canonical survey
- [An et al. — Intersectional resume-evaluation bias (PNAS Nexus, March 2025)](https://academic.oup.com/pnasnexus/article/4/3/pgaf089/8111343) — five-model intersectional study
- [WinoIdentity — uncertainty-based intersectional fairness (arXiv:2508.07111, COLM 2025)](https://arxiv.org/abs/2508.07111) — new benchmark
- [UniBias — attention-head manipulation (Zhou et al. 2024, ACL)](https://arxiv.org/abs/2405.20612) — zero-shot debiasing
