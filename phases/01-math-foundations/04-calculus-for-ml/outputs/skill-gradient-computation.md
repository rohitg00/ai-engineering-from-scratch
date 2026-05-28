---
name: skill-gradient-computation
description: よく使う機械学習の損失関数の勾配を計算し、適切な微分方法を選ぶ
version: 1.0.0
phase: 1
lesson: 4
tags: [calculus, gradients, backpropagation]
---

# 機械学習のための勾配計算

ニューラルネットワークで使われる損失関数、活性化関数、層の演算について勾配を計算するための実用リファレンスです。

## 判断チェックリスト

1. 関数は単純なプリミティブ（power、exp、log、trig）の合成ですか。解析的微分と連鎖律を使います。
2. 関数はカスタム演算またはブラックボックス演算ですか。数値微分を使います: h = 1e-7 として `(f(x+h) - f(x-h)) / (2h)`。
3. 関数は PyTorch/JAX のテンソル演算で構成されていますか。autograd に任せます。数値チェックで検証します。
4. スカラー損失の重み行列に対する勾配が必要ですか。計算グラフを通して、ノードごとに連鎖律を適用します。
5. 微分不能な演算（argmax、rounding、sampling）がありますか。straight-through estimator または reparameterization trick を使います。

## 各手法を使う場面

| 手法 | 使う場面 | コスト |
|---|---|---|
| 解析的（手で導出） | 単純な関数、autograd 出力の検証 | 実行時はほぼ無料 |
| 数値的（有限差分） | デバッグ、勾配チェック、ブラックボックス関数 | n 個のパラメータに対して 2n 回の順伝播 |
| 自動微分 | 任意の微分可能な計算グラフ（デフォルト） | 1回の逆伝播 |
| 記号微分（SymPy、Mathematica） | 論文用の閉形式勾配の導出 | コンパイル時のみ |

## クイックリファレンス: よく使う導関数

| 関数 | f(x) | f'(x) | 機械学習での文脈 |
|---|---|---|---|
| MSE loss | (1/n) sum(y_hat - y)^2 | (2/n)(y_hat - y) | 回帰 |
| Cross-entropy（binary） | -(y log(p) + (1-y) log(1-p)) | p - y（sigmoid 後） | 二値分類 |
| Cross-entropy（multi） | -log(p_true_class) | p - one_hot(y)（softmax 後） | 多クラス分類 |
| Sigmoid | 1 / (1 + e^(-x)) | sigma(x) * (1 - sigma(x)) | 出力ゲート、二値出力 |
| Tanh | (e^x - e^(-x)) / (e^x + e^(-x)) | 1 - tanh(x)^2 | 隠れ層の活性化（従来型） |
| ReLU | max(0, x) | x > 0 なら 1、x < 0 なら 0 | 標準的な隠れ層の活性化 |
| Leaky ReLU | max(0.01x, x) | x > 0 なら 1、x < 0 なら 0.01 | dead neuron の回避 |
| GELU | x * Phi(x) | Phi(x) + x * phi(x) | Transformer |
| Softmax_i | e^(x_i) / sum(e^(x_j)) | i=j なら s_i(1 - s_i)、i!=j なら -s_i*s_j | 出力層（ヤコビアン） |
| Log-softmax | x_i - log(sum(e^(x_j))) | i 番目の要素では 1 - softmax(x_i) | 数値的に安定な CE |
| Linear layer | y = Wx + b | dL/dW = dL/dy * x^T, dL/db = dL/dy | すべての層 |
| L2 regularization | lambda * sum(w^2) | 2 * lambda * w | weight decay |
| L1 regularization | lambda * sum(\|w\|) | lambda * sign(w) | 疎性 |

## よくある間違い

- バッチ平均された損失（MSE、cross-entropy）で 1/n 係数を忘れる。勾配はバッチサイズでスケールされます。
- softmax の勾配を、実際にはヤコビ行列なのにベクトルとして計算する。cross-entropy + softmax を組み合わせると、勾配は (p - y) に簡約され、完全なヤコビアンを避けられます。
- 連鎖律を間違った順序で適用する。損失から逆向きに作業します: dL/dW = dL/dy * dy/dW。
- 数値微分で大きすぎる h（h = 0.1）または小さすぎる h（h = 1e-15）を使う。float64 では h = 1e-7 を使います。
- ReLU はちょうど x = 0 で勾配が未定義であることを忘れる。実務では 0 または 0.5 に設定します。

## 勾配チェックの手順

```
For each parameter w:
  numeric_grad = (loss(w + h) - loss(w - h)) / (2h)
  auto_grad = backward pass value
  relative_error = |numeric - auto| / max(|numeric|, |auto|, 1e-8)
  assert relative_error < 1e-5
```

相対誤差が 1e-3 を超えるなら何かが間違っています。1e-5 から 1e-3 の間なら調査してください。
