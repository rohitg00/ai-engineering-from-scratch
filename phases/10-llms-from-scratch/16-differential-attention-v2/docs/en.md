# 差分アテンション (V2)

> Softmax attention は、一致しない token すべてに少量の確率を広げる。100k tokens では、そのノイズが積み上がって信号を覆い隠す。Differential Transformer (Ye et al., ICLR 2025) は、2 つの softmax の差として attention を計算し、共有された noise floor を差し引くことでこれを修正する。DIFF V2 (Microsoft, January 2026) は本番スタック向けの書き直しだ。decode latency は baseline Transformer と同等で、custom kernel は不要、FlashAttention と互換である。このレッスンでは、V1 から V2 までをエンドツーエンドで扱い、差分操作の動く toy 実装を stdlib Python で実行できるようにする。

**種類:** Build
**言語:** Python (stdlib)
**前提条件:** Phase 7 · 02 (self-attention), Phase 7 · 15 (attention variants), Phase 10 · 14 (architecture walkthrough)
**所要時間:** 約60分

## 学習目標

- softmax attention に noise floor がある理由と、それが context length とともに増える理由を正確に述べる。
- differential attention の式を導出し、subtraction が signal を保ちながら共有 noise component を打ち消す理由を説明する。
- V1 から V2 への差分をたどる。何が速くなり、何が単純になり、何が安定し、それぞれが本番 pre-training に必要だった理由を説明する。
- pure Python で differential attention をゼロから実装し、synthetic signal-plus-noise query 上で noise-cancellation property を経験的に検証する。

## 問題

標準的な softmax attention には、scale すると運用上の頭痛に変わる数学的性質がある。query `q` に対して、attention weights は `softmax(qK^T / sqrt(d))` である。Softmax は厳密なゼロを生成できない。つまり、一致しない token すべてに正の mass が与えられる。その残差 mass がノイズであり、context length に比例して大きくなる。128k tokens では、一致しない各 token が確率の 0.001% しか得ないとしても、127,999 個を合わせると全体の約 12% に寄与する。モデルは、context とともに成長する noise floor を回避する経路を学ばなければならない。

経験的には、これは attention-head interference として現れる。long-context RAG での hallucinated citations、100k-token retrieval tasks での lost-in-the-middle failures、32k を超えた needle-in-haystack benchmarks での微妙な accuracy degradation である。Differential Transformer paper (arXiv:2410.05258, ICLR 2025) はこの差を測定した。DIFF Transformers は、同サイズの baselines より低い perplexity、高い long-context accuracy、少ない hallucinations を達成した。

DIFF V1 には、frontier pre-training pipelines から締め出される 3 つの問題があった。decode step ごとに value cache を 2 回 load する必要があり、FlashAttention compatibility を壊す custom CUDA kernels が必要で、per-head RMSNorm が 70B 超 scale の長時間 training を不安定化させた。DIFF V2 (Microsoft unilm blog, January 20, 2026) はこの 3 つすべてを修正した。このレッスンでは両 version をたどり、difference operator を作り、toy query 上で noise cancellation を benchmark する。

## コンセプト

### softmax の noise floor

query `q` と keys `K = [k_1, ..., k_N]` に対して、attention weights は次の通り。

```
w_i = exp(q . k_i / sqrt(d)) / sum_j exp(q . k_j / sqrt(d))
```

どの `w_i` もゼロにはならない。`k_i` が `q` と完全に無関係でも、score `q . k_i` は 0 ではない。分散 `||q||^2 / d` を持ってゼロ付近で揺らぐ。softmax normalization の後も、無関係な各 token は weighted sum に `O(1/N)` だけ寄与する。無関係 token 全体の寄与は `O((N-1)/N) = O(1)` であり、小さい量ではない。

モデルが本当に欲しいのは hard top-k のようなものだ。一致する token に高い重みを置き、それ以外はほぼゼロにする。Softmax はそれを直接行うには滑らかすぎる。

### differential idea

各 head の Q projection と K projection を 2 つに分ける。Q = (Q_1, Q_2)、K = (K_1, K_2) とする。2 つの attention maps を計算する。

```
A_1 = softmax(Q_1 K_1^T / sqrt(d))
A_2 = softmax(Q_2 K_2^T / sqrt(d))
```

出力は次の通り。

```
DiffAttn = (A_1 - lambda * A_2) V
```

subtraction は、2 つの map が共有する noise distribution を打ち消す。両方の map が 127k 個の無関係 token にほぼ一様な重みを置くなら、ランダム初期化ではそうなるが、それらは相殺される。signal、つまり実際に関連する少数の token に尖った重みは、両方の map に同じ大きさで現れる場合にしか消えない。モデルが訓練されれば、そうはならない。

`lambda` は head ごとの learnable scalar で、`lambda = exp(lambda_q1 dot lambda_k1) - exp(lambda_q2 dot lambda_k2) + lambda_init` として parameterize される。負にもなり得る。`lambda_init` は 0.8 のような小さな正の値がデフォルトである。

### headed noise-canceling と合う理由

同じ声を録音する 2 本のノイズ交じりの microphone を考える。どちらも話者の声と相関した background noise を拾う。一方からもう一方を引くと、共有ノイズが落ちる。声は、2 つの信号の phase や amplitude が完全に相殺されない程度に異なるため残る。head ごとの `lambda` は、まさにこの balance を学習する。

### V1 vs V2: 差分

V1 は baseline Transformer と parameter count を同じに保った。head ごとに 2 つの query を得るため、head dimension を半分にした。これは head の表現力を削り、さらに痛いことに、head ごとの value cache も半分にした。Decode は step ごとに value cache を 2 回 load しなければならなかった (softmax branch ごとに 1 回)。結果として、parameter count は同等でも decode は baseline より遅くなった。

V2 は query heads の数を 2 倍にし、KV heads は同じままにする (up-projection から parameters を借りる)。head dimension は baseline と同じままだ。subtraction の後、追加 dimension は baseline Transformer の O_W projection に合わせて下へ project される。同時に 3 つのことが起きる。

1. Decode speed が baseline と一致する (KV cache は 1 回だけ load される)。
2. FlashAttention が変更なしで動く (custom kernel 不要)。
3. decode 時の arithmetic intensity が上がる (HBM から load される byte あたりの compute が増える)。

V2 は、V1 が subtraction を安定化するために使っていた per-head RMSNorm も取り除く。70B-class pre-training scales では、この RMSNorm が training 後半を不安定にした。V2 はこれを、追加 module なしで training を安定に保つ、より単純な initialization scheme で置き換える。

### いつ使うべきか

| ワークロード | 効果 |
|----------|---------|
| Long-context RAG (64k+) | attention maps がきれいになり、hallucinated citations が減る |
| Needle-in-haystack benchmarks | 32k を超えると substantial accuracy lift |
| Multi-document QA | cross-document interference が減る |
| Code completion at 8k | 効果は marginal で、architecture change に見合わない |
| Short chat (< 4k) | baseline とほぼ区別できない |

価値は context length とともに増える。4k tokens では noise floor は十分小さく、standard attention で問題ない。128k ではそれが害になる。

### 2026 年の他の knob との組み合わせ

| 機能 | DIFF V2 と互換? |
|---------|------------------------|
| GQA | はい (V2 は KV heads ではなく Q heads を増やす) |
| MLA (DeepSeek) | 原理的にははい、ただし両者を組み合わせた published paper はない |
| MoE | はい (attention は MLP block から独立している) |
| RoPE | はい (変更なし) |
| YaRN / long-context scaling | はい (まさに DIFF が最も効く場所) |
| FlashAttention | V2 でははい (V1 ではいいえ) |
| Speculative decoding | はい (attention change は spec-decode loop から見えない) |

## 作ってみる

`code/main.py` は pure Python で differential attention を実装する。既知の signal-plus-noise 構造を持つ toy query により、noise-cancellation ratio を直接測定できる。

### Step 1: standard softmax attention

Stdlib matrix ops: list of lists、manual matmul、max を引く numerical-stability 付き softmax。

```python
def softmax(row):
    m = max(row)
    exps = [math.exp(x - m) for x in row]
    s = sum(exps)
    return [e / s for e in exps]
```

### Step 2: Q, K を 2 つの半分に分ける

V1 style: head dimension を半分にする。V2 style: head dimension を保ち、heads の数を 2 倍にする。toy implementation は教育上の明確さのため V1 を使う。数学は同一で、bookkeeping だけが異なる。

### Step 3: 2 つの softmax branches + subtraction

```python
A1 = [softmax([dot(q1, k) / scale for k in K1]) for q1 in Q1]
A2 = [softmax([dot(q2, k) / scale for k in K2]) for q2 in Q2]
diff_weights = [[a1 - lam * a2 for a1, a2 in zip(r1, r2)] for r1, r2 in zip(A1, A2)]
out = [[sum(w * v[j] for w, v in zip(row, V)) for j in range(d_v)] for row in diff_weights]
```

注意: output weights は負になり得る。それでよい。value cache は signed contributions を扱える。後続の V projection が符号を吸収する。

### Step 4: noise cancellation measurement

長さ 1024 の synthetic sequence を作る。signal token を既知の位置に置き、残りを noise で埋める。(a) standard softmax attention の signal position への weight と、(b) differential attention の weight を計算する。それぞれの signal-to-noise ratio を測定する。DIFF attention は、2 つの branch がどれほど異なるよう訓練されているかに応じて、3x-10x 高い signal-to-noise ratio を安定して出す。

### Step 5: V1 vs V2 parameter accounting

config (hidden=4096, heads=32, d_head=128) が与えられたら、次を出力する。

- Baseline Transformer: Q、K、V はそれぞれ size `hidden * hidden`、MLP は 4 * hidden。
- DIFF V1: Q、K はそれぞれ size `hidden * hidden`、V size `hidden * hidden` (変更なし)、head dim は内部で半分。per-head `lambda` parameters を追加する (O(heads * d_head))。
- DIFF V2: Q size `2 * hidden * hidden`、K size `hidden * hidden`、V size `hidden * hidden`。追加 dim は O_W の前に project back down される。同じ `lambda` parameters を追加する。

toy は V2 の追加 parameter cost (attention block あたり、およそ `hidden * hidden` の追加) を測定して出力する。

## 使ってみる

2026 年 4 月時点で、DIFF V2 はまだすべての本番推論サーバーに搭載されているわけではないが、vLLM と SGLang で integration が進行中である。一方で、この pattern は次の場所に現れている。

- Microsoft internal long-context production models。
- 256k-plus context を目標とする複数の open model training runs における research replications。
- DIFF attention と sliding-window attention を alternate layers で組み合わせる hybrid architectures。

2026 年にこれを使うべき場合:

- 64k-plus effective context を目標に新しいモデルをゼロから training する。最初から differential attention を追加する。後から再訓練するのは高価である。
- lost-in-the-middle failures が eval の支配的な失敗である long-context model を fine-tuning する。Q projections への LoRA で DIFF structure を近似できる。

使うべきでない場合:

- 安定した long-context performance を持つ pre-trained dense model を serving している。既存 weights では retraining cost が回収されることはまれである。
- context が常に 16k 未満である。noise floor は無視できる。

## 出荷する

このレッスンは `outputs/skill-diff-attention-integrator.md` を生成する。model architecture、target context length、hallucination profile、training budget が与えられると、新しい pre-training run または LoRA fine-tune に differential attention を追加する integration plan を生成する。

## 演習

1. `code/main.py` を実行する。synthetic query 上で、differential attention に報告される signal-to-noise ratio が standard softmax attention より高いことを検証する。noise amplitude を変え、standard attention が使えなくなる crossover point を示す。

2. 7B-class model (hidden=4096, heads=32, d_head=128, 32 layers) について、baseline から DIFF V1 への parameter-count delta と、baseline から DIFF V2 への delta を計算する。どの component が parameters を増やし、どれが同じままかを示す。

3. DIFF V1 paper (arXiv:2410.05258) の Section 3 と、DIFF V2 Hugging Face blog の Section 2 を読む。V1 の per-head RMSNorm がなぜ必要だったのか、そして V2 が training divergence を起こさずにそれを取り除けた理由を、2 文で説明する。

4. ablation を実装する。`lambda = 0` (純粋な first softmax) と `lambda = 1` (完全な subtraction) で differential attention を計算する。synthetic query 上で、sweep 全体にわたって signal-to-noise がどう変わるかを測定する。signal-to-noise を最大化する `lambda` を特定する。

5. toy を GQA + DIFF V2 へ拡張する。8 KV heads と 32 Q heads を選ぶ。同じ (8, 32) configuration の baseline GQA model と KV cache size が一致することを示す。

## 重要用語

| 用語 | よくある言い方 | 実際の意味 |
|------|----------------|----------------------|
| Differential attention | 「2 つの softmax を互いに引く」 | Q、K を 2 つの半分に分け、2 つの softmax maps を計算し、second を lambda で scale して first から引き、その後 V を掛ける |
| Noise floor | 「softmax のゼロでない tail」 | softmax が無関係な各 token に置く O(1/N) weight。long context 全体では O(1) に合計される |
| lambda | 「subtraction scale」 | `exp(lq1.lk1) - exp(lq2.lk2) + lambda_init` として parameterize される head ごとの learnable scalar。負にもなり得る |
| DIFF V1 | 「ICLR 2025 版」 | original Differential Transformer。parameter count を保つため head dim を半分にし、custom kernel が必要で、decode が遅い |
| DIFF V2 | 「2026 年 1 月の修正版」 | KV heads を保ったまま Q heads を 2 倍にする。baseline decode speed と一致し、FlashAttention と動く |
| Per-head RMSNorm | 「V1 の安定化器」 | V1 が差分の後に適用した追加 norm。V2 は late-training instability を防ぐために取り除いた |
| Signal-to-noise ratio | 「attention がどれだけ無駄になっているか」 | true signal position への weight と、無関係位置への average weight の比 |
| Lost in the middle | 「long-context failure mode」 | 長い context の中央にある documents で retrieval accuracy が落ちる経験的現象。DIFF attention はこれを減らす |
| Arithmetic intensity | 「load した byte あたりの FLOPs」 | V2 が decode 時に、KV load あたりの queries を 2 倍にすることで増やした比率。memory-bound decode で重要 |

## 参考文献

- [Ye et al. — Differential Transformer (arXiv:2410.05258, ICLR 2025)](https://arxiv.org/abs/2410.05258) — noise-cancellation theory と long-context ablations を示す original paper
- [Microsoft unilm — Differential Transformer V2 (Hugging Face blog, January 2026)](https://huggingface.co/blog/microsoft/diff-attn-v2) — baseline decode と一致し FlashAttention-compatible な production-stack rewrite
- [Understanding Differential Transformer Unchains Pretrained Self-Attentions (arXiv:2505.16333)](https://arxiv.org/abs/2505.16333) — subtraction が pretrained attention structure を復元する理由の theoretical analysis
- [Shared DIFF Transformer (arXiv:2501.17900)](https://arxiv.org/html/2501.17900) — parameter-sharing variant
- [Vaswani et al. — Attention Is All You Need (arXiv:1706.03762)](https://arxiv.org/abs/1706.03762) — DIFF が subtract する baseline Transformer
- [Liu et al. — Lost in the Middle (arXiv:2307.03172)](https://arxiv.org/abs/2307.03172) — DIFF attention が対象にする long-context benchmark
