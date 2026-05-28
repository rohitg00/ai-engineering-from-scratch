# Attention Mechanism — ブレイクスルー

> decoderは圧縮された要約を目を細めて見るのをやめ、source全体を見るようになる。この後のすべては、attentionとengineeringです。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 5 · 09 (Sequence-to-Sequence Models)
**所要時間:** 約45分

## 問題

レッスン09は、測定可能な失敗で終わりました。おもちゃのcopy taskで学習したGRU encoder-decoderは、長さ5では89%のaccuracyだったのに、長さ80ではほぼ偶然レベルまで落ちます。理由は学習のバグではなく、構造です。encoderが得た情報はすべて1つの固定サイズ隠れ状態に収まらなければならず、decoderはそれ以外を一切見られません。

Bahdanau、Cho、Bengioは2014年に、3行で表せる修正を発表しました。decoderに最後のencoder状態だけを渡すのではなく、すべてのencoder状態を保持します。各decoderステップでencoder状態の重み付き平均を計算し、その重みで「decoderはいまencoder位置`i`をどれくらい見る必要があるか」を表します。この重み付き平均がcontextであり、decoderステップごとに変化します。

考え方はこれだけです。transformerはこれを拡張しました。self-attentionはそれを単一の系列に適用しました。multi-head attentionはそれを並列に走らせました。しかし2014年版の時点でボトルネックはすでに壊れており、一度それを理解すれば、transformerへの移行は概念というよりengineeringです。

## コンセプト

![Bahdanau attention: decoder queries all encoder states](../assets/attention.svg)

decoderの各ステップ`t`で行うことは次の通りです。

1. 直前のdecoder隠れ状態`s_{t-1}`を**query**として使う。
2. それを各encoder隠れ状態`h_1, ..., h_T`と照合してスコアを付ける。encoder位置ごとに1つのスカラーです。
3. スコアにsoftmaxをかけ、合計が1になるattention weights `α_{t,1}, ..., α_{t,T}`を得る。
4. Context vector `c_t = Σ α_{t,i} * h_i`。encoder状態の重み付き平均です。
5. decoderは`c_t`と直前の出力トークンを受け取り、次のトークンを生成する。

要点は重み付き平均です。decoderが"Je"を"I"に翻訳する必要があるとき、"Je"上のencoder状態に高い重みを置き、ほかは低くします。"not"が必要なときは、"pas"に高い重みを置きます。context vectorは各ステップで形を変えます。

## Shapes（誰もがつまずくところ）

attention実装が最初に壊れるのは、ほぼここです。ゆっくり読んでください。

| Thing | Shape | Notes |
|-------|-------|-------|
| Encoder hidden states `H` | `(T_enc, d_h)` | BiLSTMなら`d_h = 2 * d_hidden` |
| Decoder hidden state `s_{t-1}` | `(d_s,)` | 1つのベクトル |
| Attention score `e_{t,i}` | scalar | encoder位置ごとに1つ |
| Attention weight `α_{t,i}` | scalar | すべての`i`に対してsoftmaxした後 |
| Context vector `c_t` | `(d_h,)` | encoder stateと同じshape |

**Bahdanau（additive）score。** `e_{t,i} = v_α^T * tanh(W_a * s_{t-1} + U_a * h_i)`。

- `s_{t-1}`のshapeは`(d_s,)`、`h_i`のshapeは`(d_h,)`です。
- `W_a`のshapeは`(d_attn, d_s)`です。`U_a`のshapeは`(d_attn, d_h)`です。
- tanhの内側で両者を足したもののshapeは`(d_attn,)`です。
- `v_α`のshapeは`(d_attn,)`です。`v_α`とのinner productによりスカラーへ畳み込まれます。**これが`v_α`の役割です。** 魔法ではありません。attention-dim vectorをscalar scoreへ変換するprojectionです。

**Luong（multiplicative）score。** 3つのvariantがあります。

- `dot`: `e_{t,i} = s_t^T * h_i`。`d_s == d_h`が必要です。厳しい制約です。encoderがbidirectionalなら避けてください。
- `general`: `e_{t,i} = s_t^T * W * h_i`。`W`のshapeは`(d_s, d_h)`です。次元が等しいという制約を取り除きます。
- `concat`: 実質的にはBahdanau形式です。最初の2つの方が安いので、あまり使われません。

**名前を付けておく価値のあるBahdanau / Luongの落とし穴。** Bahdanauは`s_{t-1}`（現在の単語を生成する*前*のdecoder state）を使います。Luongは`s_t`（生成した*後*のstate）を使います。これを混同すると、非常にデバッグしにくい微妙に間違った勾配が生まれます。どちらか一方の論文を選び、その規約に従ってください。

## 作ってみる

### Step 1: additive（Bahdanau）attention

```python
import numpy as np


def additive_attention(decoder_state, encoder_states, W_a, U_a, v_a):
    projected_dec = W_a @ decoder_state
    projected_enc = encoder_states @ U_a.T
    combined = np.tanh(projected_enc + projected_dec)
    scores = combined @ v_a
    weights = softmax(scores)
    context = weights @ encoder_states
    return context, weights


def softmax(x):
    x = x - np.max(x)
    e = np.exp(x)
    return e / e.sum()
```

上の表と照らしてshapeを確認してください。`encoder_states`のshapeは`(T_enc, d_h)`です。`projected_enc`のshapeは`(T_enc, d_attn)`です。`projected_dec`のshapeは`(d_attn,)`で、broadcastされます。`combined`のshapeは`(T_enc, d_attn)`です。`scores`のshapeは`(T_enc,)`です。`weights`のshapeは`(T_enc,)`です。`context`のshapeは`(d_h,)`です。これで出せます。

### Step 2: Luong dotとgeneral

```python
def dot_attention(decoder_state, encoder_states):
    scores = encoder_states @ decoder_state
    weights = softmax(scores)
    return weights @ encoder_states, weights


def general_attention(decoder_state, encoder_states, W):
    projected = W.T @ decoder_state
    scores = encoder_states @ projected
    weights = softmax(scores)
    return weights @ encoder_states, weights
```

それぞれ3行です。これがLuongの論文が受け入れられた理由です。ほとんどのタスクで同等のaccuracyを、はるかに少ないコードで得られます。

### Step 3: 数値例で確認する

3つのencoder状態（だいたい"cat"、"sat"、"mat"）と、1つ目に最もよくalignするdecoder stateがあるとします。attention distributionは位置0に集中します。decoder stateを最後のencoder状態に近づけると、attentionは位置2へ移動します。context vectorはそれに追随します。

```python
H = np.array([
    [1.0, 0.0, 0.2],
    [0.5, 0.5, 0.1],
    [0.1, 0.9, 0.3],
])

s_close_to_cat = np.array([0.9, 0.1, 0.2])
ctx, w = dot_attention(s_close_to_cat, H)
print("weights:", w.round(3))
```

```
weights: [0.464 0.305 0.231]
```

最初の行が勝ちます。次にdecoder stateを3つ目のencoder状態に近づけ、重みが移動する様子を見てください。それだけです。attentionは明示的なalignmentです。

### Step 4: これがtransformerへの橋になる理由

上の言葉をQ/K/Vに翻訳すると、次のようになります。

- **Query** = decoder state `s_{t-1}`
- **Key** = encoder states（スコアを付ける対象）
- **Value** = encoder states（重み付けして足し合わせる対象）

classical attentionでは、keysとvaluesは同じものです。self-attentionはそれらを分離します。系列をそれ自身に問い合わせることができ、KとVには別々のlearned projectionを使えます。multi-head attentionは、それを異なるlearned projectionで並列に実行します。transformerはこのstage全体を何度もstackし、RNNを捨てます。

数学は同じです。shapeも同じです。Bahdanau attentionからscaled dot-product attentionへの教育的な飛躍は、ほとんど記法の違いです。

## 使ってみる

PyTorchとTensorFlowにはattentionが直接用意されています。

```python
import torch
import torch.nn as nn

mha = nn.MultiheadAttention(embed_dim=128, num_heads=8, batch_first=True)
query = torch.randn(2, 5, 128)
key = torch.randn(2, 10, 128)
value = torch.randn(2, 10, 128)

output, weights = mha(query, key, value)
print(output.shape, weights.shape)
```

```
torch.Size([2, 5, 128]) torch.Size([2, 5, 10])
```

これはtransformer attention layerです。5位置のquery batch、10位置のkey/value batch、それぞれ128次元、8 headsです。`output`は新しいcontext-augmented queriesです。`weights`は可視化できる5x10のalignment matrixです。

### Classical attentionがまだ重要な場面

- 教育目的。single-head、single-layer、RNNベースの版では、すべての概念が見える形になります。
- transformerが収まらないon-device sequence tasks。
- 2014-2017年の論文を読むとき。Bahdanauの規約を知らないと読み間違えます。
- MTにおけるfine-grained alignment analysis。raw attention weightsはtransformerモデルでも解釈ツールであり、それを読むには何であるかを知る必要があります。

### attention-weight-as-explanationの罠

attention weightsは解釈しやすそうに見えます。位置方向に合計1になる重みで、plotでき、高い値は「ここを見た」ことを意味するように見えます。reviewerはこれが好きです。

しかし見た目ほど解釈可能ではありません。Jain and Wallace（2019）は、いくつかのタスクでは、attention distributionを並べ替えたり任意の別分布に置き換えたりしても、モデル予測が変わらないことを示しました。ablationやcounterfactual checkなしに、attention weightsを推論の証拠として報告してはいけません。

## Ship It

`outputs/prompt-attention-shapes.md`として保存します。

```markdown
---
name: attention-shapes
description: attention実装のshape bugをデバッグする。
phase: 5
lesson: 10
---

壊れたattention実装が与えられたら、shape mismatchを特定してください。出力:

1. shapeが間違っているmatrix。tensor名を挙げる。
2. あるべきshape。`(d_s, d_h, d_attn, T_enc, T_dec, batch_size)`から導く。
3. 1行の修正。transpose、reshape、またはproject。
4. regressionを検出するtest。典型的には、`output.shape == (batch, T_dec, d_h)`、`weights.shape == (batch, T_dec, T_enc)`、`weights.sum(dim=-1) close to 1`をassertする。

silent broadcastに頼る修正は勧めないでください。broadcastで隠れたbugは、後になってsilent accuracy degradationとして表面化します。これはattention bugとして最悪の種類です。

Bahdanauの混乱については、decoder入力は`s_{t-1}`（pre-step state）だと主張してください。Luongでは`s_t`（post-step state）です。dot-productでは、queryとkeyのdimension mismatchが最もよくある初回エラーだと明示してください。
```

## 演習

1. **Easy。** encoder内のpadding tokensがattention weight 0になるように、`softmax` maskingを実装してください。可変長系列を含むbatchでテストします。
2. **Medium。** Luong `general`形式にmulti-head attentionを追加してください。`d_h`を`n_heads`個のgroupに分け、headごとにattentionを実行して、連結します。single-headの場合が以前の実装と一致することを確認してください。
3. **Hard。** レッスン09のおもちゃのcopy taskで、Bahdanau attention付きGRU encoder-decoderを学習してください。accuracy vs sequence lengthをplotします。no-attention baselineと比較してください。長さが伸びるほど差が広がるはずで、attentionがボトルネックを解消することを確認できます。

## 重要用語

| Term | よく言われる説明 | 実際の意味 |
|------|-----------------|------------|
| Attention | 何かを見ること | value sequenceの重み付き平均。重みはquery-key similarityから計算される。 |
| Query, Key, Value | QKV | 3つのprojection。Qは問い、Kは照合対象、Vは返すもの。 |
| Additive attention | Bahdanau | Feed-forward score: `v^T tanh(W q + U k)`。 |
| Multiplicative attention | Luong dot / general | scoreは`q^T k`または`q^T W k`。安く、ほとんどのタスクで同等のaccuracy。 |
| Alignment matrix | きれいな図 | `(T_dec, T_enc)` gridとしてのattention weights。モデルがどこにattendしたかを見るために読む。 |

## 参考資料

- [Bahdanau, Cho, Bengio (2014). Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473) — 元論文。
- [Luong, Pham, Manning (2015). Effective Approaches to Attention-based Neural Machine Translation](https://arxiv.org/abs/1508.04025) — 3つのscore variantsとその比較。
- [Jain and Wallace (2019). Attention is not Explanation](https://arxiv.org/abs/1902.10186) — interpretability上の注意点。
- [Dive into Deep Learning — Bahdanau Attention](https://d2l.ai/chapter_attention-mechanisms-and-transformers/bahdanau-attention.html) — PyTorchで動かせるwalkthrough。
