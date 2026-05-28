# 投機的デコーディングと EAGLE-3

> Phase 7 · Lesson 16 では数学を証明した。Leviathan の棄却規則は、検証器の分布を厳密に保つ。このレッスンでは、2026 年の本番環境における投機的デコーディングを、トレーニングスタックの視点から見る。EAGLE-3 はドラフトモデルを、安価な近似ではなく、検証器自身の隠れ状態で訓練された専用の小型ネットワークへ変えた。さらに、訓練時の test ループを加え、訓練時と推論時の分布をそろえた。その結果、エンドツーエンドで 3× から 6.5× の高速化、チャットで 0.9 を超える token ごとの受理率、分布上のトレードオフなし、を実現する。2026 年の本番推論スタックはすべて、これをデフォルトで搭載している。

**種類:** Build
**言語:** Python (stdlib)
**前提条件:** Phase 7 · 16 (投機的デコーディングの数学), Phase 10 · 12 (推論最適化)
**所要時間:** 約75分

## 学習目標

- Leviathan の定理を一文で述べ、投機的ループが検証器から直接サンプリングした場合と同一分布のサンプルを生成することを証明する。
- 通常の spec-decoding (Leviathan 2023) から EAGLE、EAGLE-2、EAGLE-3 までの 2 年間の進展をたどり、各段階が取り除いた正確な制約を説明する。
- 受理率 `α` と draft-to-verifier コスト比 `c` から期待高速化率を計算し、各レジームで最適なドラフト長 `N` を選ぶ。
- 完全な投機的ループをゼロから実装する。draft、verify、residual からの reject-sample、棄却時の KV cache rollback、全受理時の bonus token 出力を含める。

## 問題

70B モデルの自己回帰デコーディングは、H100 上でもせいぜい毎秒 35 tokens 程度で動く。GPU はほとんど飽和していない。上限はメモリ帯域だ。各 token で 70B の重みを HBM から読み出し、1 ステップの演算を行い、1 個の float を生成する。計算ユニットの大半は遊んでいる。

投機的デコーディングは、この問題を実際に解けるスループット問題へ変える。安価な draft が `N` 回の小さな forward pass で `N` 個の token を提案する。検証器は prefix と `N` 個すべての draft をまとめて 1 回だけ実行する。位置 `i` における検証器の分布が、ここで厳密に定義する統計的な意味で draft と一致すれば受理する。一致しなければ棄却し、residual distribution から補正をサンプリングする。1 回の大モデル forward が、1 個ではなく最大 `N+1` 個の受理済み token を生成する。

重要な定理は Leviathan, Kalman, Matias (ICML 2023) だ。出力分布は、検証器から直接サンプリングした場合に生成されたはずの分布と同一である。近似的にではない。厳密に同一である。これこそが、投機的デコーディングを本番で採用できる理由だ。品質のトレードオフを伴わない、純粋なレイテンシ最適化である。

Phase 7 · Lesson 16 が与えたのは数学だった。このレッスンが与えるのはトレーニングスタックだ。良い draft は、安いだけの draft より 2× 以上の高速化価値を持つ。EAGLE、EAGLE-2、EAGLE-3 (Li et al., 2024-2025) は、「draft = 同じモデルファミリーの小型版」という考え方を、精密なエンジニアリングの規律へ変えた。2026 年の本番推論サーバーは EAGLE-3 をデフォルトにしている。

## コンセプト

### 不変条件: Leviathan rejection sampling

ある prefix に対する次 token の draft 分布を `p(t)`、検証器の分布を `q(t)` とする。draft token `d ~ p` をサンプリングする。確率 `min(1, q(d) / p(d))` で受理する。棄却した場合は、residual distribution `(q - p)_+ / ||(q - p)_+||_1` からサンプリングする。得られるサンプルは `q` に従って分布する。これは `p` がどれほど悪くても成り立つ。悪ければ棄却が増えるだけで、出力は正確なままだ。

この呼び出しを `N` 個、`prefix + d_1 + ... + d_N` に対する 1 回の検証器 forward pass で連結する。検証器は `q_1, q_2, ..., q_{N+1}` を同時に返す。左から右へ進む。位置 `j` で最初に棄却されたら、`residual(q_j, p_j)` からサンプリングして停止する。すべて受理されたら、`q_{N+1}` から bonus token を 1 個サンプリングする。

### 速度を決めるもの

`α` をドラフト済み token ごとの期待受理率とする。`c = cost(draft) / cost(verifier)` をコスト比とする。検証器 forward 1 回あたりの期待受理 token 数は次の通り。

```
E[accepted] = (1 - α^(N+1)) / (1 - α)
```

受理 token 1 個あたりの期待総 wall time は `(N * c + 1) / E[accepted]` である。これを `N` について最小化すれば sweet spot が得られる。`α = 0.8, c = 0.05` なら、最適な `N` はおよそ 5-7 で、高速化は 3.2× になる。`α = 0.95, c = 0.02` なら、最適な `N` はおよそ 8-10 で、高速化は 5× に迫る。

最大のレバーは `α` である。固定 `N = 5` で、`α = 0.6` (通常の draft) から `α = 0.9` (EAGLE-3) へ上げると、検証器 forward 1 回あたりの期待受理 token 数は 2.2 から 4.1 へ増える。同じ検証器から、ほぼ 2× のスループットが得られる。

### 2 年間の進展

**通常の speculative (Leviathan, 2023)。** Draft model は、同じファミリーで独立に訓練された小型 LLM である。接続は簡単だが、`α ≈ 0.6`、高速化は良くても 2× 程度。

**EAGLE-1 (Li et al., 2024)。** Draft は小さな transformer、典型的には 1 層か 2 層で、検証器の最終層 hidden state を入力に取り、次 token を直接予測する。Draft が検証器の特徴表現を見るため、その分布は検証器にかなり近づく。`α` は 0.7-0.8 へ上がる。

**EAGLE-2 (Li et al., 2024)。** 動的 draft tree を追加する。`N` 個の token からなる 1 本の系列を提案するのではなく、小さな候補木を提案し、検証器が 1 回の forward pass (tree attention) でそれぞれをスコアし、最も確率の高い経路をたどる。Draft length はステップごとに適応的になる。受理経路 token ごとの `α` は 0.85 を超える。

**EAGLE-3 (Li et al., 2025, NeurIPS)。** さらに 2 つ変更する。第一に、feature-prediction loss を完全に捨てる。EAGLE-1/2 は draft を検証器の hidden states に一致させるよう訓練していたが、これはデータを増やしたときの伸びを制限する。EAGLE-3 は token prediction を直接訓練する。第二に、training-time test (TTT) である。draft の訓練中に、推論時と同じように、複数ステップにわたって draft 自身の直前の予測を入力へ戻す。これにより訓練時とテスト時の分布がそろい、誤差蓄積が止まる。測定された高速化は、チャットで最大 6.5×、H100 上の SGLang で batch 64 のとき 38% のスループット改善である。

### KV cache rollback

検証は 1 回の pass で検証器の KV cache を `N` エントリ分伸ばす。位置 `j` で棄却が起きた場合、位置 `j-1` より後の cache 内容はもう正しくない。一般的な実装は 2 つある。scratch buffer に書いて受理時に commit する方法 (vLLM, TensorRT-LLM) と、物理 KV cache と論理 length を持ち、棄却時に truncate する方法だ。どちらにせよ rollback のコストは layer/head ごとの byte 数であり、forward-pass コストに比べれば無視できる。

EAGLE-2 の tree search では、検証器は木構造を尊重する non-causal mask で attention を実行する。エンジニアリングは細かいが、計算自体は custom mask を伴う標準的な flash-attention call である。

### 2026 年の draft architecture

| 戦略 | Draft 種別 | `α` | 高速化 | 訓練コスト |
|----------|-----------|-----|---------|---------------|
| Vanilla | 別個の小型 LLM | 0.55-0.70 | 1.8-2.3× | なし (既存の小型モデルを再利用) |
| Medusa | 検証器上の追加 LM heads | 0.65-0.75 | 2-3× | ~1B SFT tokens |
| EAGLE-1 | hidden states 上の 1-layer transformer | 0.70-0.80 | 2.5-3× | ~60B tokens |
| EAGLE-2 | EAGLE-1 + dynamic draft tree | 0.80-0.88 | 3-4× | ~60B tokens |
| EAGLE-3 | multi-layer feature fusion + TTT | 0.88-0.92 | 3.5-6.5× | ~60-200B tokens |
| Lookahead | draft なし (Jacobi iteration) | N/A | 1.3-1.6× | なし |

2026 年の本番では、vLLM と SGLang は利用可能なら EAGLE-3 を、そうでなければ EAGLE-2 をデフォルトにする。TensorRT-LLM は Meta と NVIDIA の公開モデル向けに最速の Medusa path を持つ。llama.cpp は CPU デプロイ向けに通常の draft を同梱している。

## 作ってみる

`code/main.py` を参照。このファイルは完全な Leviathan speculative loop を実装しており、draft-of-N、verifier parallel pass、位置ごとの rejection、residual sampling、bonus token、KV rollback、そして出力分布が `q` からの直接サンプリングと一致することの経験的検証まで、すべての部品を含んでいる。

### Step 1: 棄却規則

```python
def accept(q_prob, p_prob, u):
    if p_prob <= 0:
        return True
    return u < min(1.0, q_prob / p_prob)
```

### Step 2: residual distribution

```python
def residual(q, p):
    raw = [max(0.0, qi - pi) for qi, pi in zip(q, p)]
    s = sum(raw)
    if s == 0:
        return list(q)
    return [r / s for r in raw]
```

### Step 3: 完全な speculative step

`spec_step` 関数は `p` から `N` 個の token を draft し、それらすべてを 1 回の並列な `q` 評価で検証する。各ドラフト token に rejection rule を適用し、最初の棄却で residual から補正をサンプリングする。すべて受理された場合は、`q_{N+1}` から bonus token を出力する。

### Step 4: KV rollback bookkeeping

シミュレータは worker ごとに論理 `kv_length` を追跡する。`k` 個の draft が受理されると `kv_length += k` になる。位置 `j` で棄却された場合、cache はすでに `j` より先まで書かれているが、論理 length は `prefix_length + j + 1` に設定される。これは補正 token の 1 つ後である。後続の読み取りは論理 length までに truncate される。

### Step 5: Leviathan check

50,000 回の speculative step を実行する。受理された token の経験分布を数える。`q` から直接 50,000 回サンプリングした結果と比較する。chi-square statistic は critical value を十分下回るはずだ。定理は実践上も通る。

### Step 6: speedup vs. α

異なる amplitude で `p` を `q` からずらし、draft quality を sweep する。`α` を測定し、検証器 call 1 回あたりの期待 token 数を `α` と `N` の関数としてプロットする。コードは、EAGLE-3 クラスの draft quality (`α ≈ 0.9`) が、検証器 call 1 回あたり 4-5 tokens を解放する様子を示す表を出力する。

## 使ってみる

EAGLE-3 を使う本番レベルの `vllm serve`:

```bash
vllm serve meta-llama/Llama-3.3-70B-Instruct \
  --speculative-config '{
    "model": "yuhuili/EAGLE3-LLaMA3.3-Instruct-70B",
    "num_speculative_tokens": 5,
    "method": "eagle3"
  }'
```

H100 上、batch 64 での EAGLE-3 付き SGLang は、EAGLE-3 paper によれば、batch-64 の通常デコーディングよりおよそ 1.38× 高いスループットを出す。

投機的デコーディングを使うべき場合:

- p50 レイテンシが peak throughput より重要な、対話型チャット workload。
- コード生成と structured output (JSON, SQL)。target distribution が非常に予測しやすいため `α` は 0.9 を超える。
- 長文生成 (数千 tokens)。償却された高速化が効き続ける。

使うべきでない場合:

- 非常に小さいモデル (< 3B)。draft は検証器よりそれほど安くない。
- 小さな batch-1 CPU デプロイ。draft model のメモリ overhead に見合わない可能性がある。
- `α` が崩れる、非常に高温度の creative sampling。

## 出荷する

このレッスンは `outputs/skill-eagle3-tuner.md` を生成する。推論 workload (model、batch size、target latency、task profile) が与えられると、投機的デコーディング戦略と tuning parameters (draft family、`N`、tree depth、temperature-aware switching) を推薦する。

## 演習

1. `code/main.py` を実行する。50,000 samples における Leviathan distribution check の chi-square statistic が、95% critical value を下回り続けることを確認する。

2. `α` を 0.9、`c` を 0.04 に固定して、`N` を 1 から 10 まで sweep する。検証器 call 1 回あたりの期待 token 数と、token あたりの実 wall time をプロットする。wall time を最小化する `N` を見つける。曲線の形を説明する。

3. EAGLE-2 tree search をシミュレートするようコードを変更する。各 step で、draft は形状 `[2, 2, 2]` の tree (8 本の候補 path) を提案する。検証器は 1 回だけ実行され、最も確率の高い受理 path が勝つ。leaf ごとの `α` と、検証器 call 1 回あたりの総 token 数を計算する。同等の compute における linear-chain spec-decoding と比較する。

4. 2 つの同時 sequence に対する batched KV rollback simulator を実装する。Sequence A はすべての draft が受理される。Sequence B は位置 2 で棄却される。正しい `kv_length` が sequence ごとに更新され、作業が無駄にならないことを示す。

5. EAGLE-3 paper の Section 4 (Training-Time Test) を読む。TTT なしの素朴な draft training がなぜ exposure bias に苦しむのか、そして training 中に draft 自身の予測を入力することがなぜそれを修正するのかを、2 文で説明する。これを seq2seq の scheduled-sampling literature に結び付ける。

## 重要用語

| 用語 | よくある言い方 | 実際の意味 |
|------|----------------|----------------------|
| Leviathan rule | 「min(1, q を p で割る)」 | 確率 `min(1, q(d)/p(d))` による Bernoulli accept/reject。棄却時に residual からサンプリングすると、検証器分布を厳密に保つ |
| Residual distribution | 「`q - p` の正の部分を正規化」 | `(q - p)_+` を 0 で clamp して再正規化したもの。棄却時にサンプリングすべき正しい分布 |
| Acceptance rate α | 「draft が正しい頻度」 | rejection rule の下での token ごとの期待 Bernoulli-success probability。すべての speedup math を支配する |
| EAGLE-1 | 「hidden state を使う draft」 | 検証器の最終層 hidden state を条件とする小型 transformer draft (Li et al., 2024) |
| EAGLE-2 | 「動的 draft tree」 | EAGLE-1 に候補 continuation の tree を加え、1 回の verifier pass で tree attention によりスコアする |
| EAGLE-3 | 「training-time test」 | feature-prediction loss を捨て、training 中に draft 自身の出力を draft へ戻しながら direct token prediction を訓練する |
| Training-time test (TTT) | 「exposure bias の修正」 | training 中に draft を autoregressive に動かし、train と test の入力分布を一致させる。scheduled sampling の直接の類似物 |
| KV rollback | 「棄却された draft を取り消す」 | 棄却後に検証器の KV cache を accepted-prefix length へ戻す bookkeeping |
| Bonus token | 「無料で得られる 1 個」 | `N` 個すべての draft が受理されたとき、追加の verifier cost なしで `q_{N+1}` から 1 個余分にサンプリングする token |
| Tree attention | 「多数の候補を一度に検証する」 | draft tree の topology を尊重する non-causal mask 付き attention。tree 内の全 node に対する `q_i` を 1 回の forward pass で計算する |

## 参考文献

- [Leviathan, Kalman, Matias — Fast Inference from Transformers via Speculative Decoding (arXiv:2211.17192, ICML 2023)](https://arxiv.org/abs/2211.17192) — 基礎となる論文と等価性定理
- [Chen et al. — Accelerating Large Language Model Decoding with Speculative Sampling (arXiv:2302.01318)](https://arxiv.org/abs/2302.01318) — 独立に同時期に導入された手法で、証明が明快
- [Li et al. — EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty (arXiv:2401.15077)](https://arxiv.org/abs/2401.15077) — EAGLE-1、hidden-state-conditioned draft
- [Li et al. — EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees (arXiv:2406.16858)](https://arxiv.org/abs/2406.16858) — dynamic tree search
- [Li et al. — EAGLE-3: Scaling up Inference Acceleration via Training-Time Test (arXiv:2503.01840, NeurIPS 2025)](https://arxiv.org/abs/2503.01840) — 2026 年の本番デフォルト
- [Cai et al. — Medusa: Multiple Decoding Heads (arXiv:2401.10774)](https://arxiv.org/abs/2401.10774) — draft-free な代替アプローチ
- [vLLM Speculative Decoding documentation](https://docs.vllm.ai/en/latest/features/spec_decode.html) — すべての戦略が接続された標準的な本番リファレンス
