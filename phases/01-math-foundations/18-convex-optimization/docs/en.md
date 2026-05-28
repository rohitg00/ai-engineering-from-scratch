# 凸最適化

> 凸問題には谷が一つだけあります。ニューラルネットワークには無数の谷があります。その違いを知ることが重要です。

**種類:** Build
**言語:** Python
**前提:** Phase 1, Lessons 04 (Calculus for ML), 08 (Optimization)
**時間:** 約90分

## 学習目標

- 定義、二階微分、Hessian 条件で関数が凸かどうかを判定する
- Newton's method を実装し、勾配降下法との収束速度を比較する
- Lagrange multipliers と KKT conditions で制約付き最適化を解釈する
- ニューラルネットワークの損失地形が非凸でも SGD が良い解を見つける理由を説明する

## 問題

勾配降下法、momentum、Adam はどんな曲面でも下り坂を進みます。ただし保証はありません。非凸な地形では、悪い局所最小に落ちる、鞍点に止まる、振動する、といったことが起こります。それでも深層学習で使うのは、ニューラルネットワークが非凸で、ほかに万能な選択肢がないからです。

一方、線形回帰、ロジスティック回帰、SVM、LASSO、リッジ回帰など、多くの ML 問題は凸です。凸問題では「任意の局所最小が大域最小」という強力な保証があります。再スタートも、複雑な学習率スケジュールも、運任せも不要です。

凸性を理解すると、問題が扱いやすいかどうか、Newton's method のような高速な手法を使えるか、正則化や SVM の双対性が何を意味するかが見えるようになります。

## 概念

### 凸集合と凸関数

集合 `S` は、`S` 内の任意の二点を結ぶ線分がすべて `S` 内にあるとき凸です。形式的には、任意の `x, y in S` と `t in [0, 1]` について `tx + (1-t)y in S` です。

関数 `f` は、定義域が凸集合で、任意の `x, y` と `t in [0, 1]` について次を満たすとき凸です。

```
f(tx + (1-t)y) <= t*f(x) + (1-t)*f(y)
```

幾何学的には、グラフ上の二点を結ぶ線分がグラフの上または上側にある、という意味です。

| 性質 | 凸関数 | 非凸関数 |
|---|---|---|
| 線分テスト | 任意の二点を結ぶ線が曲線の上側にある | どこかで線が曲線の下に沈む |
| 形 | 上に開いた一つの谷 | 複数の峰や谷 |
| 局所最小 | すべて大域最小 | 高さの違う局所最小があり得る |

### 凸性の判定

**二階微分テスト (1D)。** すべての `x` で `f''(x) >= 0` なら凸です。

**Hessian テスト (多変量)。** Hessian 行列 `H(x)` がすべての `x` で positive semidefinite なら凸です。

**定義によるテスト。** `f(tx + (1-t)y) <= t*f(x) + (1-t)*f(y)` を直接確認します。微分が扱いにくい関数に便利です。

凸関数では、すべての局所最小が大域最小です。したがって勾配降下法は悪い局所最小に閉じ込められません。

### ML における凸と非凸

| 問題 | 凸か | 理由 |
|---------|------|-----|
| Linear regression (MSE) | はい | 重みに関して二次関数 |
| Logistic regression | はい | log-loss が重みに関して凸 |
| SVM (hinge loss) | はい | 線形関数の最大 |
| LASSO | はい | 凸関数の和 |
| Ridge regression | はい | 二次 + 二次 |
| Neural network | いいえ | 非線形活性化で非凸になる |
| k-means clustering | いいえ | 離散的な割り当てがある |
| Matrix factorization | いいえ | 未知行列の積がある |

### Hessian と Newton's method

Hessian は二階偏微分を並べた行列です。

```
H[i][j] = d^2 f / (dx_i dx_j)
```

固有値がすべて非負なら上向きの曲率、すべて非正なら下向き、符号が混ざれば鞍点です。凸性には Hessian が全域で positive semidefinite である必要があります。

Newton's method は勾配だけでなく Hessian も使い、現在点の二次近似の最小点へ移動します。

```
Update rule:
  x_new = x - H^(-1) * gradient

Compare to gradient descent:
  x_new = x - lr * gradient
```

二次関数では一ステップで解に到達します。ただし Hessian の計算は `O(n^2)` メモリ、逆行列は `O(n^3)` なので、大規模な深層学習にはそのまま使えません。

### 制約付き最適化、Lagrange multipliers、KKT

制約なし最適化は全空間で `f(x)` を最小化します。制約付き最適化は、許容領域の中で最小化します。

等式制約 `g(x) = 0` では、Lagrangian を作ります。

```
L(x, lambda) = f(x) + lambda * g(x)
```

解では `L` の勾配がゼロになります。幾何学的には、目的関数の勾配と制約の勾配が平行になります。

不等式制約 `g_i(x) <= 0` では KKT conditions を使います。

```
1. Stationarity:    df/dx + sum(lambda_i * dg_i/dx) = 0
2. Primal feasibility:  g_i(x) <= 0  for all i
3. Dual feasibility:    lambda_i >= 0  for all i
4. Complementary slackness:  lambda_i * g_i(x) = 0  for all i
```

相補性条件は、制約が効いて境界にいるか、制約の乗数がゼロで解に影響していないかのどちらかだ、という意味です。SVM では、乗数が正のデータ点だけが support vectors になります。

### 正則化は制約付き最適化

L2 正則化は `||w||^2 <= t` という球の中で損失を最小化する問題と等価です。L1 正則化は `||w||_1 <= t` というひし形の制約に対応します。L1 の制約領域には軸に沿った角があるため、解が角に当たりやすく、一部の重みがちょうどゼロになります。これが LASSO のスパース性です。

### 双対性と SVM

制約付き最適化には primal と dual があります。凸問題では、条件が満たされると primal と dual の最適値が一致します。SVM は dual で解くとデータ点同士の内積だけに依存する形になり、`x_i^T x_j` を `K(x_i, x_j)` に置き換えることで kernel trick が使えます。

### 非凸な深層学習が動く理由

ニューラルネットワークの損失は非凸ですが、高次元では悪い局所最小より鞍点のほうが圧倒的に多くなります。SGD のノイズは鞍点から抜ける助けになります。さらに過剰パラメータ化されたネットワークでは損失地形が滑らかで、低い谷がつながりやすくなります。SGD の確率的ノイズは鋭い最小より平坦な最小を選びやすく、汎化にも寄与します。

## 実装

### Step 1: Convexity checker

```python
import random
import math

def check_convexity(f, dim, bounds=(-5, 5), samples=1000):
    violations = 0
    for _ in range(samples):
        x = [random.uniform(*bounds) for _ in range(dim)]
        y = [random.uniform(*bounds) for _ in range(dim)]
        t = random.uniform(0, 1)
        mid = [t * xi + (1 - t) * yi for xi, yi in zip(x, y)]
        lhs = f(mid)
        rhs = t * f(x) + (1 - t) * f(y)
        if lhs > rhs + 1e-10:
            violations += 1
    return violations == 0, violations
```

### Step 2: Newton's method for 2D

```python
def newtons_method(f, grad_f, hessian_f, x0, steps=50, tol=1e-12):
    x = list(x0)
    history = [x[:]]
    for _ in range(steps):
        g = grad_f(x)
        H = hessian_f(x)
        det = H[0][0] * H[1][1] - H[0][1] * H[1][0]
        if abs(det) < 1e-15:
            break
        H_inv = [
            [H[1][1] / det, -H[0][1] / det],
            [-H[1][0] / det, H[0][0] / det],
        ]
        dx = [
            H_inv[0][0] * g[0] + H_inv[0][1] * g[1],
            H_inv[1][0] * g[0] + H_inv[1][1] * g[1],
        ]
        x = [x[0] - dx[0], x[1] - dx[1]]
        history.append(x[:])
        if sum(gi ** 2 for gi in g) < tol:
            break
    return history
```

### Step 3: Lagrange multiplier solver

```python
def lagrange_solve(f_grad, g_val, g_grad, x0, lr=0.01,
                   lr_lambda=0.01, steps=5000):
    x = list(x0)
    lam = 0.0
    history = []
    for _ in range(steps):
        fg = f_grad(x)
        gv = g_val(x)
        gg = g_grad(x)
        x = [
            xi - lr * (fgi + lam * ggi)
            for xi, fgi, ggi in zip(x, fg, gg)
        ]
        lam = lam + lr_lambda * gv
        history.append((x[:], lam, gv))
    return history
```

## Use It

凸問題では `liblinear`、CVXPY、`scipy.optimize.minimize(method='L-BFGS-B')` などの専用ソルバを使います。非凸問題では SGD や Adam を使い、初期値やノイズに依存することを受け入れます。大域最小を探すことより、汎化する良い解を安定して見つけることが重要です。

## 演習

1. `x^4`, `sin(x)`, `x^2 + y^2`, `x*y`, `max(x, 0)` を凸性チェッカーで調べ、結果を説明してください。
2. `50*x^2 + y^2` で Newton's method と勾配降下法の収束ステップ数を比較してください。
3. `x + 2y = 4` の制約下で `(x-3)^2 + (y-3)^2` を最小化し、勾配が制約勾配と平行になることを確認してください。
4. L1 制約 `|x| + |y| <= 1` で最小化し、解にゼロ座標が現れることを示してください。
5. Rosenbrock 関数の Hessian 固有値を点 `(1,1)` と `(-1,1)` で比較してください。

## 重要用語

| 用語 | 意味 |
|------|------|
| 凸集合 | 集合内の任意の二点を結ぶ線分が集合内に残る集合 |
| 凸関数 | グラフ上の二点を結ぶ線がグラフの上側にある関数 |
| 局所最小 | 近くの点より低い点。凸関数では大域最小でもある |
| Hessian matrix | 二階偏微分の行列。曲率情報を持つ |
| Positive semidefinite | 固有値がすべて非負の行列 |
| Newton's method | 逆 Hessian を使う二階最適化法 |
| Lagrange multiplier | 制約付き問題を扱うために導入する変数 |
| KKT conditions | 不等式制約つき最適化の必要条件 |
| Duality | 制約付き問題に対応する双対問題の関係 |
| Saddle point | 勾配はゼロだが方向によって最小にも最大にも見える点 |

## 参考資料

- [Boyd & Vandenberghe: Convex Optimization](https://web.stanford.edu/~boyd/cvxbook/) - 凸最適化の標準教科書
- [Bottou, Curtis, Nocedal: Optimization Methods for Large-Scale Machine Learning (2018)](https://arxiv.org/abs/1606.04838) - 大規模 ML と最適化理論の橋渡し
- [Choromanska et al.: The Loss Surfaces of Multilayer Networks (2015)](https://arxiv.org/abs/1412.0233) - ニューラルネットワーク損失地形の分析
- [Nocedal & Wright: Numerical Optimization](https://link.springer.com/book/10.1007/978-0-387-40065-5) - Newton's method、L-BFGS、制約付き最適化の総合参考書
