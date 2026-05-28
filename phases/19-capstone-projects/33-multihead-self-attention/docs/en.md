# Multi-Head Self-Attention

> 1つの線形射影から Q/K/V を作り、H 個の head を並列に走らせ、causal mask で未来を隠します。

**種別:** Build
**言語:** Python
**前提条件:** Phase 04 lessons, Phase 07 transformer lessons, このフェーズの Lessons 30-32
**所要時間:** 約90分

## 学習目標
- Query/Key/Value を1つの linear layer でまとめて射影し、H 個の head に分割する。
- scaled dot-product attention を正しい正規化と dtype で計算する。
- 未来位置への attention を防ぐ causal mask を適用する。
- head ごとの attention weights を確認する。
- 小さな toy task で attention block に勾配が流れることを確認する。

## 形の契約
入力と出力はどちらも `(B, T, D)` です。内部では Q/K/V を `(B, H, T, d_head)` に変形します。`d_head = D // H` なので `D % H == 0` が必要です。

```mermaid
flowchart LR
    A[(B,T,D)] --> B[Linear D -> 3D]
    B --> C[Q,K,V に分割]
    C --> D[(B,H,T,d_head)]
    D --> E[Q @ K.T / sqrt(d_head)]
    E --> F[causal mask]
    F --> G[softmax]
    G --> H[weights @ V]
    H --> I[(B,T,D)]
```

## QKV と head
3つの `Linear(D, D)` は、重みを縦に積んだ1つの `Linear(D, 3D)` と数学的に同じです。1回の matmul で済むため accelerator に向いています。分割後は head 次元を batch の隣へ移し、PyTorch が `B * H` 個の attention を並列処理できる形にします。

## scaling と mask
score は softmax の前に `sqrt(d_head)` で割ります。これをしないと `d_head` が大きいほど dot product が大きくなり、softmax が飽和して勾配が小さくなります。

causal LM は未来 token を読めません。score 行列の対角より上を `-inf` に置き換えると、softmax 後にその重みが0になります。mask は buffer として登録し、forward では左上の `(T,T)` だけを使います。

## 実装
`MultiHeadSelfAttention` は QKV projection、出力 projection、causal mask を持ちます。`return_weights=True` で `(B,H,T,T)` の attention weights も返します。デモは copy task を数 epoch 学習し、loss と head の heatmap を表示します。
