# Scaling Laws

> 2020 年の Kaplan 論文はこう述べました。モデルが大きいほど loss は下がる。2022 年の Hoffmann 論文はこう述べました。それは学習不足だった。計算量は parameters と tokens という 2 つのバケットに入り、その分配は自明ではありません。

**種別:** 学習
**言語:** Python
**前提条件:** Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**所要時間:** 約45分

## 課題

学習計算量として `C` FLOPs があり、最良のモデルを得たいとき、調整するノブは 2 つあります。

1. **Parameters (N) をいくつにするか。** モデルが大きいほど容量は大きくなります。
2. **Training tokens (D) をいくつにするか。** データが多いほど容量をよりよく使えます。

FLOPs はおおよそ `6 × N × D` でスケールします。`N` を上げて `D` を下げることも、`D` を上げて `N` を下げることもできます。どちらがよいのでしょうか。

2022 年以前の答えは「`N` を強く押し上げる」でした。GPT-3 (2020) は 175B parameters を ~300B tokens で学習しました。これは parameter あたり約 1.7 tokens の比率です。Kaplan scaling laws はこれを裏づけていました。

Hoffmann et al. (2022) は Chinchilla と呼ばれる小さなモデル群を学習し、異なる結果を見つけました。最適な比率は **parameter あたり約 20 tokens** に近い、というものです。GPT-3 は 10× 学習不足でした。Chinchilla (70B params, 1.4T tokens) は、推論コストが 2.5× 低いにもかかわらず、すべての benchmark で GPT-3 (175B, 300B tokens) を上回りました。

2026 年は Chinchilla の世界です。ただし重要なひねりが 1 つあります。Llama 3 8B は 15 trillion tokens で学習され、parameter あたり 1,875 tokens という比率でした。Chinchilla-optimal を 94 倍超えています。大規模に使われるモデルでは training cost より inference cost の方が重要なので、小さくデプロイしやすい footprint のために Chinchilla を超えて over-training することが 2026 年の標準です。

## コンセプト

![Chinchilla curves: loss vs compute at various N/D ratios](../assets/scaling-laws.svg)

### Hoffmann law

Chinchilla 論文では、loss は次の式に従います。

```
L(N, D) = A / N^α + B / D^β + E
```

- `N` = parameters (non-embedding)。
- `D` = training tokens。
- `α ≈ 0.34`, `β ≈ 0.28` (おおむね対称)。
- `E ≈ 1.69` は irreducible loss ceiling。
- `A ≈ 406`, `B ≈ 411`。

スケールさせると、2 つの項が互いにトレードオフします。固定 compute (`C = 6ND`) で `N` に関する微分を取り、解きます。

```
N_opt ≈ 0.6 × (C/6)^0.5
D_opt ≈ 0.6 × (C/6)^0.5
D_opt / N_opt ≈ 20
```

Compute-optimal は parameter あたり 20 tokens です。

### それでも over-training する理由

Chinchilla-optimal は training FLOP あたりの training loss を最小化します。しかし training cost は一度だけ支払い、inference cost はずっと支払い続けます。

月に 1 trillion tokens を処理する chatbot では、総コストの支配要因は inference です。Llama の方針は、小さく長く学習することです。15T tokens で学習した 8B は、深く inference-optimized されています。

- Consumer GPUs に収まります。
- Latency は 70B Chinchilla-optimal の一部です。
- ほとんどのタスクでは品質が十分に近いです。

DeepMind の 2024 年論文 ("Over-training is the new optimal") はこれを形式化しました。inference-dominated workloads では、serving volume に応じて適切な比率は parameter あたり 100–500 tokens に近くなります。

### Emergence と smoothness

主張: ある能力 (arithmetic, multi-step reasoning, chain-of-thought following) は、ある scale で突然「emerge」する。

Schaeffer et al. (2023) は、これは測定上の artifact だと論じました。emergent metrics は不連続な scoring (exact match, threshold 付き accuracy) を使うため、背後の logits にある滑らかな改善を隠してしまいます。連続的な metrics (cross-entropy) では滑らかな曲線が見えます。

2026 年の consensus は、continuous loss による予測は信頼できる、というものです。benchmark の jump は scorer artifacts であることが多いです。budget は continuous metrics に対して計画してください。

### 2026 年の全体像

Scaling laws は今も有効ですが、次の変化があります。

| Factor | 何が変わったか |
|--------|-------------|
| Data quality | 「良い」tokens (Phi-style) を curate すると、effective compute が 2× 超ずれる |
| MoE | Total params が active FLOPs から切り離される。scaling laws は per-active-FLOP |
| Post-training | 一部の能力 (instruction following, code) は pretraining より SFT+RLHF で大きく動く |
| Multimodality | Image + text tokens が一緒にスケールする。modality ごとに別曲線 |
| Synthetic data | モデルが training data を生成する。effective compute が複利的に増え得る |

Muon optimizer (Kimi Moonlight, 2024) は、matched data で AdamW に対して ~2× の effective-compute gain を示しました。2026 年の training runs には Muon をデフォルトで使うものもあります。scaling law の絶対定数は変えますが、形は変えません。

## 作ってみる

`code/main.py` を参照してください。Chinchilla loss equation を実装し、複数の compute budgets それぞれで compute-optimal な `(N, D)` を解きます。

### Step 1: Chinchilla loss

```python
def chinchilla_loss(N, D, A=406.4, B=410.7, alpha=0.34, beta=0.28, E=1.69):
    return A / N ** alpha + B / D ** beta + E
```

固定 `C = 6ND` で `(N, D)` 上の contour として `L` を plot します。最小値を見つけます。

### Step 2: compute-optimal frontier

`1e17` から `1e25` FLOPs までの compute budgets について、`6ND = C` の制約下で loss を最小化する `(N, D)` を見つけます。比率が `D/N ≈ 20` になることを確認します。

### Step 3: over-training cost

10× 小さいモデル (optimal `N` の 1/10、optimal `D` の 10×) を学習するために支払う extra loss を計算します。その代わりに得る inference FLOP savings (`N` に比例) を報告します。

### Step 4: compare to real models

GPT-3, Chinchilla, Llama 3 8B, DeepSeek-V3 (active params) の既知の `(N, D)` pairs を入れ、predicted loss と reported loss を比較します。

## 使ってみる

自分で frontier model を学習する可能性は高くないでしょう。それでも scaling laws は次を教えてくれます。

1. **Fine-tune に十分なデータがあるか。** task-specific data が base model の parameter あたり 20 tokens を下回るなら、ある loss floor で saturation することを想定します。
2. **より大きな base model を選ぶべきか。** budget のほとんどを inference に使うなら、小さく長く学習されたモデルを選びます。
3. **どこで returns が diminishing するか。** Chinchilla-optimal の 1000× を超えると、log-loss の変化は noise になります。

**2026 年の research trajectory:**

- **Data-constrained regime.** Web には高品質 tokens が有限しかありません (filtering 後の英語で ~5–10 trillion)。Frontier pretraining はこの ceiling に近づいています。Synthetic data, multilingual, multimodal, RLHF-scaled fine-tuning が次の lever です。
- **Compute-multiplier tricks.** Muon optimizer, MoE, better data curation は、それぞれ漸近形ではなく絶対定数をずらします。
- **Scaling laws for RL.** 未解決問題です。初期の証拠は RL samples に power-law があることを示唆しますが、exponents は pretraining と大きく異なります。

## 仕上げる

`outputs/skill-training-budget-estimator.md` を参照してください。この skill は、compute budget, deployment constraints, target loss から新しい training run の `(N, D, hours, GPU)` を選びます。

## 演習

1. **Easy.** `code/main.py` を実行してください。compute budgets `1e20`, `1e22`, `1e24` について Chinchilla-optimal な `(N, D)` を出力します。real model table と比較してください。
2. **Medium.** Hoffmann loss-as-function-of-compute curve を実装してください。compute-optimal frontier について loss vs `log10(C)` を plot します。cross-entropy を次に 0.1 下げるために `>10^28` FLOPs が必要になると law が予測する時点を特定してください。
3. **Hard.** 同じ dataset で学習した 5 つの tiny models (100K から 10M params) に自分の scaling law を fit してください。`α` と `E` を推定します。あなたの exponents は公開値とどの程度一致しますか。

## 重要用語

| Term | よく言われること | 実際の意味 |
|------|-----------------|-----------------------|
| Parameters (N) | 「Model size」 | Non-embedding weight count。capacity を決めます。 |
| Tokens (D) | 「Training data」 | 見た training tokens の数。parameters がどれだけよく使われるかを決めます。 |
| Compute (C) | 「FLOPs spent」 | 標準 transformer ではおおよそ `6 × N × D`。 |
| Chinchilla-optimal | 「D/N ≈ 20」 | pretraining の FLOP あたり loss を最小化する比率。 |
| Over-training | 「Past Chinchilla」 | inference FLOPs を節約するために extra training FLOPs を使うこと。D/N >> 20。 |
| Irreducible loss | 「The floor」 | scaling law の `E` 項。データ自体の entropy。 |
| Emergent capability | 「Sudden jumps at scale」 | scorer artifact であることが多い。continuous loss は滑らか。 |
| Effective compute | 「Training-efficiency multiplier」 | より良い data / optimizer / architecture が、1 FLOP の到達距離を何倍にもします。 |

## 参考資料

- [Kaplan et al. (2020). Scaling Laws for Neural Language Models](https://arxiv.org/abs/2001.08361) — 最初の scaling law 論文。undertrained。
- [Hoffmann et al. (2022). Training Compute-Optimal Large Language Models](https://arxiv.org/abs/2203.15556) — Chinchilla。
- [Schaeffer et al. (2023). Are Emergent Abilities of Large Language Models a Mirage?](https://arxiv.org/abs/2304.15004) — 測定 artifact としての emergence。
- [Sardana, Frankle (2024). Beyond Chinchilla-Optimal: Accounting for Inference in Language Model Scaling Laws](https://arxiv.org/abs/2401.00448) — Llama の over-training がその workload に適している理由。
- [Jordan et al. (2024). Muon: An optimizer for hidden layers in neural networks](https://kellerjordan.github.io/posts/muon/) — 2× compute multiplier。
