# Self-Attention をゼロから作る

> Attention は、すべての単語が「自分にとって誰が重要か？」と問い、その答えを学習する lookup table です。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 3 (Deep Learning Core), Phase 5 Lesson 10 (Sequence-to-Sequence)
**所要時間:** 約 90 分

## 学習目標

- NumPy だけを使って、query/key/value projection と softmax による重み付き和を含む scaled dot-product self-attention をゼロから実装する
- head を分割し、並列 attention を計算して結果を連結する multi-head attention 層を作る
- attention 行列がトークン間の関係をどう捉えるかを追跡し、sqrt(d_k) によるスケーリングが softmax の飽和を防ぐ理由を説明する
- causal masking を適用し、双方向 attention を自己回帰（decoder-style）attention に変換する

## 問題

RNN は系列を 1 トークンずつ処理します。トークン 50 に到達する頃には、トークン 1 の情報は 50 回の圧縮ステップを通っています。長距離依存は固定サイズの隠れ状態に押しつぶされます。これは、どれだけ LSTM のゲートを使っても完全には解けないボトルネックです。

2014 年の Bahdanau attention 論文は解決策を示しました。デコーダがすべてのエンコーダ位置を振り返り、現在のステップにどれが重要かを決められるようにする、というものです。ただし、それはまだ RNN に後付けされた仕組みでした。2017 年の "Attention Is All You Need" 論文は、さらに鋭い問いを立てました。attention が*唯一の*仕組みだったらどうなるか。再帰なし。畳み込みなし。ただ attention だけ。

Self-attention は、系列内のすべての位置が 1 回の並列ステップで他のすべての位置に attention できるようにします。これが Transformer を高速で、スケーラブルで、支配的なものにしています。

## コンセプト

### データベース検索のアナロジー

attention を soft なデータベース検索として考えます。

```
Traditional database:
  Query: "capital of France"  -->  exact match  -->  "Paris"

Attention:
  Query: "capital of France"  -->  similarity to ALL keys  -->  weighted blend of ALL values
```

すべてのトークンは 3 つのベクトルを生成します。
- **Query (Q)**: 「自分は何を探しているか？」
- **Key (K)**: 「自分は何を含んでいるか？」
- **Value (V)**: 「選ばれたら、どんな情報を提供するか？」

query とすべての key の内積が attention score を作ります。高いスコアは「この key は自分の query に合っている」という意味です。そのスコアで value に重みを付けます。出力は value の重み付き和です。

### Q, K, V の計算

各トークン embedding は、学習される 3 つの重み行列を通して射影されます。

```
Input embeddings (sequence of n tokens, each d-dimensional):

  X = [x1, x2, x3, ..., xn]       shape: (n, d)

Three weight matrices:

  Wq  shape: (d, dk)
  Wk  shape: (d, dk)
  Wv  shape: (d, dv)

Projections:

  Q = X @ Wq    shape: (n, dk)      each token's query
  K = X @ Wk    shape: (n, dk)      each token's key
  V = X @ Wv    shape: (n, dv)      each token's value
```

Visually, for one token:

```
             Wq
  x_i ------[*]------> q_i    "What am I looking for?"
       |
       |     Wk
       +----[*]------> k_i    "What do I contain?"
       |
       |     Wv
       +----[*]------> v_i    "What do I offer?"
```

### Attention 行列

すべてのトークンについて Q, K, V が得られると、attention score は行列になります。

```
Scores = Q @ K^T    shape: (n, n)

              k1    k2    k3    k4    k5
        +-----+-----+-----+-----+-----+
   q1   | 2.1 | 0.3 | 0.1 | 0.8 | 0.2 |   <- how much q1 attends to each key
        +-----+-----+-----+-----+-----+
   q2   | 0.4 | 1.9 | 0.7 | 0.1 | 0.3 |
        +-----+-----+-----+-----+-----+
   q3   | 0.2 | 0.6 | 2.3 | 0.5 | 0.1 |
        +-----+-----+-----+-----+-----+
   q4   | 0.9 | 0.1 | 0.4 | 1.7 | 0.6 |
        +-----+-----+-----+-----+-----+
   q5   | 0.1 | 0.3 | 0.2 | 0.5 | 2.0 |
        +-----+-----+-----+-----+-----+

Each row: one token's attention over the entire sequence
```

### なぜスケールするのか

内積は次元 dk とともに大きくなります。dk = 64 の場合、内積は数十の範囲になり、softmax が勾配の消える領域に押し込まれることがあります。対策は sqrt(dk) で割ることです。

```
Scaled scores = (Q @ K^T) / sqrt(dk)
```

これにより、softmax が有用な勾配を生む範囲に値を保てます。

### Softmax はスコアを重みに変える

Softmax は生のスコアを、各行ごとの確率分布に変換します。

```
Raw scores for q1:   [2.1, 0.3, 0.1, 0.8, 0.2]
                            |
                         softmax
                            |
Attention weights:   [0.52, 0.09, 0.07, 0.14, 0.08]   (sums to ~1.0)
```

これで各トークンは、他の各トークンへどれくらい attention するかを表す重み集合を持ちます。

### Value の重み付き和

各トークンの最終出力は、すべての value ベクトルの重み付き和です。

```
output_i = sum( attention_weight[i][j] * v_j  for all j )

For token 1:
  output_1 = 0.52 * v1 + 0.09 * v2 + 0.07 * v3 + 0.14 * v4 + 0.08 * v5
```

### 全体の流れ

```
                    +-------+
  X (input)  ----->|  @ Wq  |-----> Q
                    +-------+
                    +-------+
  X (input)  ----->|  @ Wk  |-----> K
                    +-------+                     +----------+
                    +-------+                     |          |
  X (input)  ----->|  @ Wv  |-----> V ---------->| weighted |----> output
                    +-------+          ^          |   sum    |
                                       |          +----------+
                              +--------+--------+
                              |    softmax      |
                              +---------+-------+
                                        ^
                              +---------+-------+
                              | Q @ K^T / sqrt  |
                              +-----------------+
```

1 行で表す式:

```
Attention(Q, K, V) = softmax( Q @ K^T / sqrt(dk) ) @ V
```

## 作ってみる

### Step 1: Softmax をゼロから実装する

Softmax は生の logits を確率に変換します。数値安定性のために最大値を引きます。

```python
import numpy as np

def softmax(x):
    shifted = x - np.max(x, axis=-1, keepdims=True)
    exp_x = np.exp(shifted)
    return exp_x / np.sum(exp_x, axis=-1, keepdims=True)

logits = np.array([2.0, 1.0, 0.1])
print(f"logits:  {logits}")
print(f"softmax: {softmax(logits)}")
print(f"sum:     {softmax(logits).sum():.4f}")
```

### Step 2: Scaled dot-product attention

中核となる関数です。Q, K, V 行列を受け取り、attention 出力と重み行列を返します。

```python
def scaled_dot_product_attention(Q, K, V):
    dk = Q.shape[-1]
    scores = Q @ K.T / np.sqrt(dk)
    weights = softmax(scores)
    output = weights @ V
    return output, weights
```

### Step 3: 学習される projection を持つ Self-attention クラス

Xavier 風のスケーリングで初期化された Wq, Wk, Wv 重み行列を持つ、完全な self-attention モジュールです。

```python
class SelfAttention:
    def __init__(self, d_model, dk, dv, seed=42):
        rng = np.random.default_rng(seed)
        scale = np.sqrt(2.0 / (d_model + dk))
        self.Wq = rng.normal(0, scale, (d_model, dk))
        self.Wk = rng.normal(0, scale, (d_model, dk))
        scale_v = np.sqrt(2.0 / (d_model + dv))
        self.Wv = rng.normal(0, scale_v, (d_model, dv))
        self.dk = dk

    def forward(self, X):
        Q = X @ self.Wq
        K = X @ self.Wk
        V = X @ self.Wv
        output, weights = scaled_dot_product_attention(Q, K, V)
        return output, weights
```

### Step 4: 文で動かす

文に対する仮の embedding を作り、attention weight を観察します。

```python
sentence = ["The", "cat", "sat", "on", "the", "mat"]
n_tokens = len(sentence)
d_model = 8
dk = 4
dv = 4

rng = np.random.default_rng(42)
X = rng.normal(0, 1, (n_tokens, d_model))

attn = SelfAttention(d_model, dk, dv, seed=42)
output, weights = attn.forward(X)

print("Attention weights (each row: where that token looks):\n")
print(f"{'':>6}", end="")
for token in sentence:
    print(f"{token:>6}", end="")
print()

for i, token in enumerate(sentence):
    print(f"{token:>6}", end="")
    for j in range(n_tokens):
        w = weights[i][j]
        print(f"{w:6.3f}", end="")
    print()
```

### Step 5: ASCII ヒートマップで attention を可視化する

attention weight を文字に対応させ、簡単に可視化します。

```python
def ascii_heatmap(weights, tokens, chars=" ░▒▓█"):
    n = len(tokens)
    print(f"\n{'':>6}", end="")
    for t in tokens:
        print(f"{t:>6}", end="")
    print()

    for i in range(n):
        print(f"{tokens[i]:>6}", end="")
        for j in range(n):
            level = int(weights[i][j] * (len(chars) - 1) / weights.max())
            level = min(level, len(chars) - 1)
            print(f"{'  ' + chars[level] + '   '}", end="")
        print()

ascii_heatmap(weights, sentence)
```

## 使いどころ

PyTorch の `nn.MultiheadAttention` は、ここで作ったものに multi-head 分割と出力 projection を加えた処理をそのまま行います。

```python
import torch
import torch.nn as nn

d_model = 8
n_heads = 2
seq_len = 6

mha = nn.MultiheadAttention(embed_dim=d_model, num_heads=n_heads, batch_first=True)

X_torch = torch.randn(1, seq_len, d_model)

output, attn_weights = mha(X_torch, X_torch, X_torch)

print(f"Input shape:            {X_torch.shape}")
print(f"Output shape:           {output.shape}")
print(f"Attention weight shape: {attn_weights.shape}")
print(f"\nAttn weights (averaged over heads):")
print(attn_weights[0].detach().numpy().round(3))
```

重要な違いは、multi-head attention が複数の attention 関数を並列に実行することです。それぞれが dk = d_model / n_heads サイズの独自の Q, K, V projection を持ち、最後に結果を連結します。これにより、モデルは複数の関係タイプへ同時に attention できます。

## 仕上げる

このレッスンで作るもの:
- `outputs/prompt-attention-explainer.md` - データベース検索のアナロジーで attention を説明するためのプロンプト

## 演習

1. `scaled_dot_product_attention` を変更し、softmax の前に特定の位置を負の無限大に設定する任意の mask 行列を受け取れるようにしてください（これが causal/decoder masking の仕組みです）。
2. multi-head attention をゼロから実装してください。Q, K, V を `n_heads` 個のチャンクに分け、それぞれで attention を実行し、連結して、最後の重み行列 Wo を通して projection します。
3. 同じ長さの異なる 2 つの文を取り、同じ SelfAttention インスタンスに入力して attention pattern を比較してください。何が変わり、何が変わらないでしょうか。

## 重要用語

| 用語 | よくある言い方 | 実際の意味 |
|------|----------------|----------------------|
| Query (Q) | 「質問ベクトル」 | このトークンがどんな情報を探しているかを表す、入力の学習済み projection |
| Key (K) | 「ラベルベクトル」 | このトークンがどんな情報を含むかを表し、query と照合される学習済み projection |
| Value (V) | 「内容ベクトル」 | attention score に基づいて集約される実際の情報を運ぶ学習済み projection |
| Scaled dot-product attention | 「attention の式」 | softmax(QK^T / sqrt(dk)) @ V。スケーリングにより高次元での softmax 飽和を防ぐ |
| Self-attention | 「トークンが自分自身と他を見る」 | Q, K, V がすべて同じ系列から来る attention。すべての位置が他のすべての位置に attention できる |
| Attention weights | 「どれだけ注目するか」 | scaled dot product に softmax をかけて得られる、位置上の確率分布 |
| Multi-head attention | 「並列 attention」 | 異なる projection を持つ複数の attention 関数を実行し、結果を連結して豊かな表現を得ること |

## 参考文献

- [Attention Is All You Need (Vaswani et al., 2017)](https://arxiv.org/abs/1706.03762) - 元祖 Transformer 論文
- [The Illustrated Transformer (Jay Alammar)](https://jalammar.github.io/illustrated-transformer/) - アーキテクチャ全体を視覚的に追う最高の解説
- [The Annotated Transformer (Harvard NLP)](https://nlp.seas.harvard.edu/annotated-transformer/) - 1 行ずつ説明された PyTorch 実装
