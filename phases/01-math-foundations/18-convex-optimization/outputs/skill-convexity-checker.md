---
name: skill-convexity-checker
description: 最適化問題が凸かどうかを判定し、適切なソルバを選ぶ
version: 1.0.0
phase: 1
lesson: 18
tags: [optimization, convexity, solvers]
---

# 凸性チェッカー

最適化問題が凸かどうかを確認し、その結果に応じて何をすべきかを判断するための手順です。

## 判断チェックリスト

1. 目的関数は凸か。Hessian が positive semi-definite か、合成規則で確認します。
2. すべての不等式制約は `g_i(x) <= 0` の形で、各 `g_i` は凸か。
3. すべての等式制約は affine (linear) か。
4. 三つすべてが yes なら凸問題です。収束保証のある凸最適化ソルバを使います。
5. どれかが no なら非凸問題です。SGD/Adam を使い、局所解を受け入れます。

## 関数の凸性テスト

| テスト | 対象 | 方法 |
|---|---|---|
| Second derivative `>= 0` | スカラー関数 `f(x)` | `f''(x)` を計算し、全域で `>= 0` なら凸 |
| Hessian is PSD | 多変量関数 `f(x)` | `H(x)` の固有値が全域で `>= 0` なら凸 |
| Definition test | 任意の関数 | サンプルした `x, y, t` で `f(tx + (1-t)y) <= t*f(x) + (1-t)*f(y)` を確認 |
| Composition rules | 合成関数 | 下の合成規則を使う |
| Restriction to a line | 多変量 `f` | 任意の直線制限 `g(t) = f(x + tv)` が凸なら凸 |

## 凸性を保つ合成規則

| 操作 | 結果 |
|---|---|
| `f + g` (`both convex`) | 凸 |
| `c * f` (`c > 0`, `f convex`) | 凸 |
| `max(f, g)` (`both convex`) | 凸 |
| `f(Ax + b)` where `f` is convex | 凸 |
| `g(f(x))` where `g` is convex non-decreasing and `f` is convex | 凸 |
| `g(f(x))` where `g` is convex non-increasing and `f` is concave | 凸 |
| sum of convex functions | 凸 |
| pointwise supremum of convex functions | 凸 |

## ML の代表的な目的関数

| 目的関数 | 凸か | 理由 |
|---|---|---|
| MSE: `(1/n) sum(y - Xw)^2` | Yes | `w` に関して二次、Hessian は PSD |
| Logistic loss | Yes | convex functions の和 |
| Hinge loss | Yes | 凸な線形関数の最大 |
| L2 regularization | Yes | 二次関数 |
| L1 regularization | Yes | 絶対値の和。微分不能点はある |
| Ridge regression | Yes | 凸関数の和 |
| LASSO | Yes | 凸関数の和 |
| SVM (primal) | Yes | hinge + L2 |
| Cross-entropy with softmax | Yes (in logits) | log-sum-exp は凸 |
| Neural network | No | 非線形活性化により非凸 |
| k-means objective | No | 離散的な割り当てがある |
| Matrix factorization | No | `U` と `V` に双線形 |
| GAN loss | No | minimax で非凸 |

## ソルバ選択

| 問題タイプ | ソルバ | 収束保証 |
|---|---|---|
| Convex, smooth, unconstrained | Gradient descent | 大域最小へ `O(1/k)` |
| Convex, smooth, unconstrained | L-BFGS | 大域最小へ超線形 |
| Convex, smooth, unconstrained | Newton's method | 最小点近傍で二次収束 |
| Convex, smooth, constrained | Interior point method | 多項式時間 |
| Convex, non-smooth (L1) | Proximal gradient / ISTA | 大域最小へ `O(1/k)` |
| Convex, non-smooth (L1) | ADMM | 制約を柔軟に扱える |
| Convex, quadratic | Conjugate gradient | 最大 `n` ステップで厳密 |
| Non-convex, smooth | SGD / Adam | 局所最小へ収束 |
| Non-convex, smooth | SGD + restarts | 平均的に良い局所解 |

## よくある間違い

- 損失関数が凸だから問題全体も凸だと思い込むこと。最適化するパラメータに関して凸でなければなりません。
- 非凸問題に Newton's method をそのまま使うこと。Hessian に負の固有値があると鞍点や最大点へ向かうことがあります。
- L1 正則化がゼロで微分不能になることを忘れること。proximal gradient や subgradient methods を使います。
- `A^T A` を作って条件数を二乗してしまうこと。悪条件の最小二乗では QR または SVD を使います。
- 確認せずに非凸と決めつけること。線形モデル、SVM、ロジスティック回帰は凸で、強力なソルバの恩恵を受けます。

## 簡易テスト

```
1. Write out the objective: minimize f(w) subject to constraints
2. For each term in f(w):
   - Is it quadratic with PSD matrix? -> Convex
   - Is it a norm? -> Convex
   - Is it log-sum-exp? -> Convex
   - Does it involve w nonlinearly (sigmoid(w), w1*w2)? -> Likely non-convex
3. Are all constraints linear or convex inequalities?
4. If ALL terms are convex and constraints are convex/linear -> problem is convex
5. If ANY term is non-convex -> problem is non-convex
```
