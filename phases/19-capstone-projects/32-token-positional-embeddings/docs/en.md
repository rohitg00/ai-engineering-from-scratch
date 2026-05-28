# Token Embedding と Positional Embedding

> id は整数ですが、モデルが扱うのはベクトルです。token embedding と positional embedding の2つの lookup table が、その橋渡しをします。

**種別:** Build
**言語:** Python
**前提条件:** Phase 04 lessons, Phase 07 transformer lessons, このフェーズの Lessons 30-31
**所要時間:** 約90分

## 学習目標
- vocabulary id を dense vector に写す token embedding を作る。
- 位置 id で引く learned positional embedding を作る。
- パラメータを持たない sinusoidal positional embedding を作る。
- token と position のベクトルを足し合わせて transformer への入力を作る。
- learned と sinusoidal の違いを、長さ外挿とパラメータ数の観点で比較する。

## 全体像
入力は `(B, T)` の token ids、出力は `(B, T, D)` のベクトル列です。token embedding は `nn.Embedding(V, D)` で、id ごとに行を引きます。token id だけでは順序が分からないため、位置情報を別のベクトルとして加えます。

learned positional embedding は `(max_context_length, D)` の学習可能な表です。sinusoidal positional embedding は sin/cos の式で作る固定表で、学習パラメータを持ちません。この実装では両方とも構築時の `max_context_length` を超える入力を拒否します。

```mermaid
flowchart LR
    A[(B,T) ids] --> B[token embedding]
    A --> C[position 0..T-1]
    C --> D[positional embedding]
    B --> E[elementwise sum]
    D --> E
    E --> F[(B,T,D)]
```

## 足し合わせる理由
token と position は concat ではなく sum します。これにより feature 次元 `D` がネットワーク全体で一定に保たれ、各層が feature ごとに token の意味と位置のどちらを重視するか学習できます。

## sinusoidal の性質
位置 `p` と feature `i` から次を計算します。

```python
angle = p / (10000 ** (2 * (i // 2) / D))
emb[p, 2k] = sin(angle)
emb[p, 2k + 1] = cos(angle)
```

同じ波長の sin/cos をペアにすると、`p+k` のベクトルは `p` のベクトルの線形変換として表せます。attention が相対位置を学びやすくなる理由です。

## 実装
`TokenEmbedding`、`LearnedPositionalEmbedding`、`SinusoidalPositionalEmbedding`、`EmbeddingComposer` を実装します。デモは shape、パラメータ数、隣接位置の cosine similarity を表示します。テストは shape、broadcast、パラメータ数、sinusoidal 式を固定しています。
