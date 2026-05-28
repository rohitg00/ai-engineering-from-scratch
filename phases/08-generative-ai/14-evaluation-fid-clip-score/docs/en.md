# Evaluation — FID, CLIP Score, Human Preference

> 生成モデルの leaderboard では、必ず FID、CLIP score、人間選好 arena の win rate が引用されます。どの数値にも、意図的な研究者が gaming できる failure mode があります。Failure mode を知らなければ、本当の改善と gaming run を見分けられません。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 8 · 01 (Taxonomy), Phase 2 · 04 (Evaluation Metrics)
**所要時間:** 約45分

## 問題

生成モデルは *sample quality* と *conditioning adherence* で評価されます。どちらにも closed-form measure はありません。モデルは 10,000 枚の画像を render しなければならず、何かがそれらに数値を割り当てなければならず、その数値を model families、resolutions、architectures をまたいで信頼しなければなりません。2014-2026 年の試練を生き残った metric は 3 つです。

- **FID (Fréchet Inception Distance).** Inception network の feature space における、real と generated という 2 つの分布間の距離。低いほど良い。
- **CLIP score.** 生成画像の CLIP-image embedding と prompt の CLIP-text embedding の cosine similarity。高いほど良い。prompt adherence を測る。
- **Human preference.** 同じ prompt で 2 つのモデルを head-to-head にし、人間（または GPT-4-class model）が良い方を選び、Elo score に集約する。

他にも IS（inception score、ほぼ引退済み）、KID、CMMD、ImageReward、PickScore、HPSv2、MJHQ-30k を見かけます。それぞれが前の metric の failure を 1 つ補正しています。

## The Concept

![FID, CLIP, and preference: three axes, different failure modes](../assets/evaluation.svg)

### FID — sample quality

Heusel et al. (2017)。手順は次の通りです。

1. N 枚の real images と N 枚の generated images について Inception-v3 features（2048-D）を抽出する。
2. 各 pool に Gaussian を fit する。mean `μ_r, μ_g` と covariance `Σ_r, Σ_g` を計算する。
3. FID = `||μ_r - μ_g||² + Tr(Σ_r + Σ_g - 2 · (Σ_r · Σ_g)^0.5)`。

解釈: feature space 内の 2 つの multivariate Gaussians 間の Fréchet distance。低いほど分布が似ています。

Failure modes:
- **Biased on small N.** FID は feature distribution に対する mean-squared です。小さい N では covariance を過小推定し、誤って低い FID を出します。常に N ≥ 10,000 を使ってください。
- **Inception-dependent.** Inception-v3 は ImageNet で学習されています。ImageNet から遠い domains（faces、art、text images）では FID が意味を失います。domain-specific feature extractor を使ってください。
- **Gaming.** Inception prior に overfit すると、visual quality improvement なしに低い FID が出ます。CMMD（下記）で対抗します。

### CLIP score — prompt adherence

Radford et al. (2021)。生成画像 + prompt に対して:

```
clip_score = cos_sim( CLIP_image(x_gen), CLIP_text(prompt) )
```

30k 枚の生成画像で平均し、モデル間で比較可能な scalar にします。

Failure modes:
- **CLIP's own blind spots.** CLIP は compositional reasoning が弱い（"a red cube on a blue sphere" のようなものはよく失敗する）。モデルは複雑な prompts に本当に従わなくても、CLIP score で高順位になり得ます。
- **Short prompt bias.** 短い prompts は、野生のデータ内で CLIP-image matches が多くなります。長い prompts は機械的に CLIP scores が低くなります。
- **Prompt gaming.** prompt に "high quality, 4k, masterpiece" を入れると、image-text binding を改善せずに CLIP score が膨らみます。

CMMD (Jayasumana et al., 2024) はこれらの一部を修正します。Inception ではなく CLIP features を使い、Fréchet ではなく maximum-mean discrepancy を使います。微妙な品質差の検出に優れています。

### Human preference — the ground truth

prompt pool を選びます。model A と model B で生成します。ペアを人間（または強力な LLM judge）に見せます。勝敗を Elo または Bradley-Terry score に集約します。Benchmarks:

- **PartiPrompts (Google)**: 1,600 個の多様な prompts、12 categories。
- **HPSv2**: 107k human annotations、自動 proxy として広く利用。
- **ImageReward**: 137k prompt-image preference pairs、MIT-licensed。
- **PickScore**: Pick-a-Pic 2.6M preferences で学習。
- **Chatbot-Arena-style image arenas**: https://imagearena.ai/ など。

Failure modes:
- **Judge variance.** 非専門家の好みは専門家と異なります。両方を使ってください。
- **Prompt distribution.** Cherry-picked prompts は一方の family に有利です。必ず文書化してください。
- **LLM-judge reward hacking.** GPT-4-judge は、きれいだが間違った outputs にだまされます。人間評価と突き合わせてください。

## Use together

Production eval report には次を含めるべきです。

1. held-out real distribution に対する 10-30k samples の FID（sample quality）。
2. 同じ samples とその prompts に対する CLIP score / CMMD（adherence）。
3. 以前のモデルに対する blinded arena の win rate（overall preference）。
4. Failure mode analysis: 50 個のランダム sample outputs を、既知の issues（hand anatomy、text rendering、一貫した object count）について flag する。

単一 metric は嘘です。3 つの裏付け合う metrics + qualitative review ではじめて claim になります。

## 実装

`code/main.py` は synthetic "feature vectors" 上で FID、CLIP-score-like、Elo aggregation を実装します（Inception features の stand-ins として 4-D vectors を使います）。確認するもの:

- 小さい N と大きい N での FID computation、つまり bias。
- feature pools 間の cosine similarity としての "CLIP score"。
- synthetic preference stream からの Elo update rule。

### Step 1: FID in four lines

```python
def fid(real_features, gen_features):
    mu_r, cov_r = mean_and_cov(real_features)
    mu_g, cov_g = mean_and_cov(gen_features)
    mean_diff = sum((a - b) ** 2 for a, b in zip(mu_r, mu_g))
    trace_term = trace(cov_r) + trace(cov_g) - 2 * sqrt_cov_product(cov_r, cov_g)
    return mean_diff + trace_term
```

### Step 2: CLIP-style cosine-similarity

```python
def clip_like(image_feat, text_feat):
    dot = sum(a * b for a, b in zip(image_feat, text_feat))
    norm = math.sqrt(dot_self(image_feat) * dot_self(text_feat))
    return dot / max(norm, 1e-8)
```

### Step 3: Elo aggregation

```python
def elo_update(r_a, r_b, winner, k=32):
    expected_a = 1 / (1 + 10 ** ((r_b - r_a) / 400))
    actual_a = 1.0 if winner == "a" else 0.0
    r_a_new = r_a + k * (actual_a - expected_a)
    r_b_new = r_b - k * (actual_a - expected_a)
    return r_a_new, r_b_new
```

## Pitfalls

- **FID at N=1000.** N=10k 未満では heuristic は信頼できません。low-N FID を報告する論文は gaming しています。
- **Comparing FID across resolutions.** Inception の 299×299 resize は feature distribution を変えます。matched resolution でのみ比較してください。
- **Reporting one seed.** 最低 3 seeds で実行してください。std を報告します。
- **CLIP score inflation via negative prompts.** 一部の pipelines は prompt に over-fitting して CLIP を押し上げます。visual saturation を確認してください。
- **Elo bias from prompt overlap.** 両方のモデルが training 中に benchmark prompt を見ていた場合、Elo は無意味です。held-out prompt sets を使ってください。
- **Human eval paid-crowd skew.** Prolific、MTurk annotators は若年層 / tech-friendly に偏ります。採用した art/design experts と混ぜてください。

## Use It

2026 年の production eval protocol:

| Pillar | Minimum | Recommended |
|--------|---------|-------------|
| Sample quality | held-out real に対する 10k FID | + 5k CMMD + category ごとの subset FID |
| Prompt adherence | 30k の CLIP score | + HPSv2 + ImageReward + VQA-style question answering |
| Preference | baseline に対する 200 blinded pairs | + 2000 paired human + LLM-judge + Chatbot Arena |
| Failure analysis | 50 hand-flagged | 500 hand-flagged + automated safety classifier |

4 pillars すべてが 1 つの report にあるなら claim です。どれか 1 つだけなら marketing です。

## Ship It

`outputs/skill-eval-report.md` を保存してください。この skill は new model checkpoint + baseline を受け取り、sample sizes、metrics、failure-mode probes、sign-off criteria を含む full eval plan を出力します。

## Exercises

1. **Easy.** `code/main.py` を実行してください。同じ synthetic distributions で N=100 と N=1000 の FID を比較します。bias magnitude を報告してください。
2. **Medium.** synthetic CLIP-style features から CMMD を実装してください（formula は Jayasumana et al., 2024 を参照）。品質差に対する sensitivity を FID と比較します。
3. **Hard.** HPSv2 setup を再現してください。Pick-a-Pic の subset から 1000 個の image-prompt pairs を取り、preferences で小さな CLIP-based scorer を fine-tune し、held-out set との agreement を測ります。

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| FID | "Fréchet Inception Distance" | real vs gen Inception features に Gaussian を fit した Fréchet distance。 |
| CLIP score | "Text-image similarity" | CLIP image embeddings と text embeddings の cosine similarity。 |
| CMMD | "FID's replacement" | CLIP-feature MMD。bias が少なく Gaussian assumption がない。 |
| IS | "Inception score" | Exp KL(p(y|x) || p(y))。現代モデルでは相関が弱く、引退済み。 |
| HPSv2 / ImageReward / PickScore | "Learned preference proxies" | Human preferences で学習された小型モデル。automatic judges として使われる。 |
| Elo | "Chess rating" | Pairwise wins の Bradley-Terry aggregation。 |
| PartiPrompts | "The benchmark prompt set" | 12 categories にまたがる 1,600 個の Google-curated prompts。 |
| FD-DINO | "Self-sup replacement" | DINOv2 features を使う FD。out-of-ImageNet domains でより良い。 |

## Production note: evaluation is an inference workload too

10k samples で FID を実行するとは、10k 枚の画像を生成するということです。単一 L4 上で 1024² の 50-step SDXL base なら、single-request inference で約 11 時間です。Evaluation budgets は現実の制約であり、これはまさに offline-inference scenario（throughput を最大化し、TTFT を無視する）です。

- **Batch hard, forget latency.** Offline eval = memory に収まる最大サイズでの static batching。80GB H100 上で `num_images_per_prompt=8` を指定した `pipe(...).images` は、single-request より wall-clock で 4-6× 速くなります。
- **Cache the real features.** real reference set に対する Inception（FID）または CLIP（CLIP-score、CMMD）の feature extraction は *一度だけ* 実行し、`.npz` として保存します。eval ごとに再計算しないでください。

CI / regression gates では、PR ごとに 500-sample subset で FID + CLIP score を実行します（約 30 分）。full 10k FID + HPSv2 + Elo は nightly で実行します。

## 参考文献

- [Heusel et al. (2017). GANs Trained by a Two Time-Scale Update Rule Converge to a Local Nash Equilibrium (FID)](https://arxiv.org/abs/1706.08500) — FID paper.
- [Jayasumana et al. (2024). Rethinking FID: Towards a Better Evaluation Metric for Image Generation (CMMD)](https://arxiv.org/abs/2401.09603) — CMMD.
- [Radford et al. (2021). Learning Transferable Visual Models from Natural Language Supervision (CLIP)](https://arxiv.org/abs/2103.00020) — CLIP.
- [Wu et al. (2023). HPSv2: A Comprehensive Human Preference Score](https://arxiv.org/abs/2306.09341) — HPSv2.
- [Xu et al. (2023). ImageReward: Learning and Evaluating Human Preferences for Text-to-Image Generation](https://arxiv.org/abs/2304.05977) — ImageReward.
- [Yu et al. (2023). Scaling Autoregressive Models for Content-Rich Text-to-Image Generation (Parti + PartiPrompts)](https://arxiv.org/abs/2206.10789) — PartiPrompts.
- [Stein et al. (2023). Exposing flaws of generative model evaluation metrics](https://arxiv.org/abs/2306.04675) — failure-mode survey.
