# Transformer Block from Scratch

> 現代の decoder LLM の基本単位は、LayerNorm、multi-head causal attention、residual、MLP、residual です。このレッスンでは pre-LN と post-LN を並べて実装します。

**種別:** Build
**言語:** Python
**前提条件:** Phase 19 lessons 30-33
**所要時間:** 約90分

## 学習目標
- LayerNorm、multi-head causal attention、residual connection、position-wise MLP から transformer block を作る。
- pre-LN と post-LN の違いを実装し、深い stack での勾配の流れを比較する。
- causal mask により token `i` が `j > i` を読めないことを確認する。
- Lesson 35 の GPT assembly で再利用できる block を作る。

## 問題設定
transformer は同じ block を何度も積みます。block を1つ間違えると、その間違いが12層分繰り返されます。典型的な失敗は、未来に attention してしまうこと、または LayerNorm の位置が深さ方向の勾配を弱めることです。

## pre-LN と post-LN
pre-LN は sublayer の前、residual branch の中に LayerNorm を置きます。residual stream 自体は正規化されないため、勾配が embedding まで届きやすく、warmup なしでも安定しやすい構成です。

post-LN は residual add の後に LayerNorm を置きます。これは 2017 年の original Transformer の構成ですが、深くすると residual 経路の勾配が LayerNorm を通るため、一般に warmup が必要になります。

## MLP と residual
position-wise MLP は各 token に同じ2層ネットワークを独立に適用します。hidden 幅は通常 `4 * d_model`、activation は GELU です。token 間の情報混合は attention だけが担います。

residual connection は、各 block が表現全体を置き換えるのではなく加算的な更新を学べるようにし、深い stack で勾配の経路も保ちます。

## 実装
`LayerNorm`、`MultiHeadAttention`、`FeedForward`、`TransformerBlock`、`BlockStack` を実装します。デモは pre-LN と post-LN の stack に同じ入力を通し、出力 shape と embedding gradient norm を比較します。テストは shape、causal mask、pre/post の違い、勾配が非ゼロであることを確認します。
