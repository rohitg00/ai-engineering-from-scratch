# Differential Privacy for LLMs

> DP-SGD は依然として standard である。noise を注入した gradient update が形式的な (epsilon, delta) guarantee を与える。compute、memory、utility の overhead は大きい。parameter-efficient な DP fine-tuning (LoRA + DP-SGD) が 2025年の一般的な構成である (ACM 2025)。緊張関係にある2つの evidence がある。canary-based membership inference (Duan et al., 2024) は language model に対して限定的な成功しか報告しない。一方、training-data extraction (Carlini et al., 2021; Nasr et al., 2025) はかなりの verbatim memorization を回収する。Resolution (arXiv:2503.06808, 2025年3月): 差は「何を測っているか」にある。挿入された canaries と「最も extractable な」data は違う。新しい canary design により、shadow model なしの loss-based MIA と、real data で realistic DP guarantees を持つ LLM に対する初の nontrivial DP audit が可能になった。Alternatives: PMixED (arXiv:2403.15638) — next-token distributions の mixture of experts による inference time の private prediction。DP synthetic data generation (Google Research 2024)。Emerging attack: Differential Privacy Reversal via LLM Feedback — confidence-score leakage。

**種別:** 構築
**言語:** Python (stdlib, DP-SGD noise-injection and ε-δ accountant demonstration)
**前提条件:** Phase 01 · 09 (information theory), Phase 10 · 01 (large-model training)
**所要時間:** 約60分

## Learning Objectives

- (epsilon, delta)-differential privacy を定義し、DP-SGD の recipe を述べる。
- 2024-2025年の tension、つまり canary MIA と training-data extraction が異なる picture を与える理由を説明する。
- PMixED と、inference-time private prediction が DP training の alternative になる理由を説明する。
- Differential Privacy Reversal via LLM Feedback attack を説明する。

## 問題

LLM は記憶する。Carlini et al. 2021 は、production language model が training text を要求に応じて verbatim に再現することを示した。DP は形式的な defense である。任意の単一 training example に対して output が provably insensitive になるように training する。2024-2025年の evidence は、DP-SGD が必要である一方、deployed ε values が threat model と一致していない可能性を示している。

## The Concept

### (ε, δ)-differential privacy

randomized algorithm M は、1つの example だけが異なる任意の2つの dataset と任意の event S について次を満たすなら (ε, δ)-DP である:
P(M(D) in S) <= e^ε * P(M(D') in S) + δ。

解釈: output distribution が十分近いため (ε で parametrized)、任意の1人の contribution は、δ の確率を除いて信頼して推測できない。

### DP-SGD

Abadi et al. 2016。標準 recipe:
1. mini-batch を sample する。
2. per-example gradients を計算する。
3. 各 per-example gradient を threshold C で clip する。
4. clipped gradients を合計し、std σ * C の Gaussian noise を加える。
5. noisy sum で parameters を update する。

Privacy cost は accountant (Moments Accountant, Rényi DP accountant) で追跡する。LLM literature で報告される ε values は、threat model、data sensitivity、utility target により大きく異なる。普遍的に「安全」な default ε はない。一部の LLM training setting では ε ≈ 1–10 程度の published examples があるが、これは例示であり推奨 default ではない。一般に低い ε はより多くの noise を必要とし、utility loss を増やし得る。

### LoRA + DP-SGD

frontier model 全体に DP-SGD を適用するのは prohibitive である。LoRA (Hu et al. 2022) は gradient update を小さな adapter に限定し、per-example gradient storage を減らす。LoRA + DP-SGD は 2025年の一般的な構成である。DP guarantees は adapter に適用され、base model は固定される。

### The 2024-2025 tension

2つの evidence の流れ:

- **Canary MIA (Duan et al. 2024).** training data に unique canaries を挿入し、membership-inference attacker がそれらを識別できるか測る。language model では限定的な成功を報告する。MIA は難しいことを示唆する。
- **Training-data extraction (Carlini 2021, Nasr et al. 2025).** model に prefix を与え、training から verbatim text を回収できるか測る。かなりの memorization を報告する。関連する意味では MIA が容易であることを示唆する。

2025年3月の resolution (arXiv:2503.06808): この2つは異なるものを測っている。MIA は挿入された canaries について「example e は D に含まれるか」を問う。Extraction は「D から何を回収できるか」を問う。privacy に重要なのは「最も extractable な」example であり、canaries は extractable になるよう最適化されていないため、これを過小報告する。

新しい canary design。shadow model なしの loss-based MIA。real data と realistic DP guarantees を持つ LLM に対する初の nontrivial DP audit。

### Alternatives to DP training

- **PMixED (arXiv:2403.15638).** inference time の private prediction。next-token distributions に対する mixture of experts。各 expert は training data の shard を見る。aggregation に DP のための noise を加える。DP training 自体を回避する。
- **DP synthetic data generation (Google Research 2024).** DP-SGD で LoRA fine-tune し、synthetic data を sample し、その synthetic data で downstream classifier を train する。

どちらも、異なる threat model を受け入れる代わりに full DP training の utility cost を回避する。

### Differential Privacy Reversal via LLM Feedback

2025年に emerging な attack。DP-trained model の confidence scores を oracle として使い、個人を re-identify する。outputs が直接 leak しなくても、confidence distributions は leak し得る。

Defense: confidences を公開しない、または公開前に truncate / quantize する。これは (ε, δ)-DP training に加えて必要になる要件である。

### Where this fits in Phase 18

Lessons 20-21 は bias/fairness。Lesson 22 は privacy。Lesson 23 は watermarking による provenance。Lesson 27 は regulatory data-provenance layer を扱う。

## Use It

`code/main.py` は toy binary-classification dataset で DP-SGD を simulate する。noise multiplier σ と clipping norm C を sweep し、(ε, δ) budget と accuracy cost を追跡できる。"canary attack" は unique training example を挿入し、DP 前後で log-loss test がそれを検出できるか測る。

## Ship It

この lesson では `outputs/skill-dp-audit.md` を作る。language model deployment に対する DP claim が与えられたとき、(ε, δ) values、使った accountant、MIA evaluation protocol、confidence-exposure vectors が評価済みかを監査する。

## Exercises

1. `code/main.py` を実行する。σ in {0.5, 1.0, 2.0} を sweep し、(ε, δ)-accuracy trade-off を報告する。utility が崩れる点を特定する。

2. canary insertion と log-loss test を実装する。σ = 1.0 の DP-SGD 前後で detection rate を測る。

3. Nasr et al. 2025 の training-data extraction を読む。moderate ε でも extraction success が崩れないのはなぜか。これは evaluation としての MIA について何を示唆するか。

4. inference time だけで動作する PMixED (arXiv:2403.15638) deployment を設計する。PMixED が扱い、DP-SGD が扱わない threat model は何か。

5. DP Reversal via LLM Feedback attack を sketch する。confidence-score leakage を制限する countermeasure を設計し、その deployment cost を見積もる。

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| DP | 「(ε, δ)-differential privacy」 | 近傍 dataset の変更に対して output distribution が近いという形式的 privacy |
| DP-SGD | 「noise-injected SGD」 | Gradient clipping + Gaussian noise addition。標準的な DP training |
| LoRA + DP-SGD | 「efficient private fine-tune」 | low-rank adapter に対する DP-SGD。2025年の標準構成 |
| MIA | 「membership inference」 | ある example が training data に含まれたかを判定する attack |
| Canary | 「inserted watermark example」 | DP leakage を測るために使う unique training example |
| PMixED | 「private inference mixture」 | next-token distributions の mixture-of-experts による inference-time DP |
| DP Reversal | 「confidence leakage attack」 | model confidence を re-identification の oracle として使う attack |

## 参考文献

- [Abadi et al. — DP-SGD (arXiv:1607.00133)](https://arxiv.org/abs/1607.00133) — 標準的な DP training algorithm
- [Carlini et al. — Extracting Training Data (arXiv:2012.07805)](https://arxiv.org/abs/2012.07805) — canonical extraction paper
- [Duan et al. — Canary MIA on LLMs (arXiv:2402.07841, 2024)](https://arxiv.org/abs/2402.07841) — limited-success MIA
- [Kowalczyk et al. — Auditing DP for LLMs (arXiv:2503.06808, March 2025)](https://arxiv.org/abs/2503.06808) — tension の resolution
- [PMixED (arXiv:2403.15638)](https://arxiv.org/abs/2403.15638) — inference-time private prediction
