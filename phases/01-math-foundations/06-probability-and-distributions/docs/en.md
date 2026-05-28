# 確率と分布

> 確率は、AI が不確実性を表現するための言語です。

**種別:** 学習
**言語:** Python
**前提条件:** フェーズ1、レッスン01-04
**所要時間:** 約75分

## 学習目標

- Bernoulli、categorical、Poisson、uniform、normal 分布の PMF と PDF をスクラッチで実装する
- 期待値と分散を計算し、中心極限定理を使って Gaussian がなぜ多く現れるかを説明する
- 数値安定化のテクニック（最大 logit を引く）を使って softmax と log-softmax 関数を作る
- logits から cross-entropy loss を計算し、それを負の対数尤度と結び付ける

## 問題

分類器は `[0.03, 0.91, 0.06]` を出力します。言語モデルは50,000個の候補から次の単語を選びます。拡散モデルは、学習した分布からサンプリングして画像を生成します。これらはすべて、確率が実際に使われている例です。

モデルが行うすべての予測は確率分布です。すべての損失関数は、予測分布が真の分布からどれだけ離れているかを測ります。すべての学習ステップは、一方の分布をもう一方に近づけるようにパラメータを調整します。確率が分からなければ、機械学習の論文を読むことも、モデルをデバッグすることも、学習損失が NaN になる理由を理解することもできません。

## 概念

### 事象、標本空間、確率

標本空間 S は、起こり得るすべての結果の集合です。事象は標本空間の部分集合です。確率は、事象を 0 から 1 の数値へ対応付けます。

```
Coin flip:
  S = {H, T}
  P(H) = 0.5,  P(T) = 0.5

Single die roll:
  S = {1, 2, 3, 4, 5, 6}
  P(even) = P({2, 4, 6}) = 3/6 = 0.5
```

確率は3つの公理で定義されます。
1. 任意の事象 A について P(A) >= 0
2. P(S) = 1（何かは必ず起こる）
3. A と B が同時に起こらないとき、P(A or B) = P(A) + P(B)

それ以外のすべて（ベイズの定理、期待値、分布）は、この3つの規則から導かれます。

### 条件付き確率と独立性

P(A|B) は、B が起きたという条件のもとで A が起きる確率です。

```
P(A|B) = P(A and B) / P(B)

Example: deck of cards
  P(King | Face card) = P(King and Face card) / P(Face card)
                      = (4/52) / (12/52)
                      = 4/12 = 1/3
```

一方を知ってももう一方について何も分からないとき、2つの事象は独立です。

```
Independent:   P(A|B) = P(A)
Equivalent to: P(A and B) = P(A) * P(B)
```

コイントスは独立です。山札から戻さずにカードを引く場合は独立ではありません。

### 確率質量関数と確率密度関数

離散確率変数には確率質量関数（PMF）があります。各結果には、直接読み取れる具体的な確率があります。

```
PMF: P(X = k)

Fair die:
  P(X = 1) = 1/6
  P(X = 2) = 1/6
  ...
  P(X = 6) = 1/6

  Sum of all probabilities = 1
```

連続確率変数には確率密度関数（PDF）があります。1点での密度は確率ではありません。確率は、区間上で密度を積分することで得られます。

```
PDF: f(x)

P(a <= X <= b) = integral of f(x) from a to b

f(x) can be greater than 1 (density, not probability)
integral from -inf to +inf of f(x) dx = 1
```

この区別は機械学習で重要です。分類の出力は PMF（離散的な選択）です。VAE の潜在空間は PDF（連続）を使います。

### よく使う分布

**Bernoulli:** 1回の試行、2つの結果。二値分類をモデル化します。

```
P(X = 1) = p
P(X = 0) = 1 - p
Mean = p,  Variance = p(1-p)
```

**Categorical:** 1回の試行、k 個の結果。多クラス分類（softmax 出力）をモデル化します。

```
P(X = i) = p_i,  where sum of p_i = 1
Example: P(cat) = 0.7,  P(dog) = 0.2,  P(bird) = 0.1
```

**Uniform:** すべての結果が等確率。ランダム初期化に使われます。

```
Discrete: P(X = k) = 1/n for k in {1, ..., n}
Continuous: f(x) = 1/(b-a) for x in [a, b]
```

**Normal（Gaussian）:** 釣鐘曲線。平均（mu）と分散（sigma^2）でパラメータ化されます。

```
f(x) = (1 / sqrt(2*pi*sigma^2)) * exp(-(x - mu)^2 / (2*sigma^2))

Standard normal: mu = 0, sigma = 1
  68% of data within 1 sigma
  95% within 2 sigma
  99.7% within 3 sigma
```

**Poisson:** 固定された区間におけるまれな事象の回数。事象の発生率をモデル化します。

```
P(X = k) = (lambda^k * e^(-lambda)) / k!
Mean = lambda,  Variance = lambda
```

### 期待値と分散

期待値は、結果を確率で重み付けした平均です。

```
Discrete:   E[X] = sum of x_i * P(X = x_i)
Continuous: E[X] = integral of x * f(x) dx
```

分散は、平均の周りの広がりを測ります。

```
Var(X) = E[(X - E[X])^2] = E[X^2] - (E[X])^2
Standard deviation = sqrt(Var(X))
```

機械学習では、期待値は損失関数（データ分布上の平均損失）として現れます。分散はモデルの安定性を教えてくれます。勾配の分散が大きいと、学習はノイズの多いものになります。

### 同時分布と周辺分布

同時分布 P(X, Y) は、2つの確率変数をまとめて記述します。

同時 PMF の例（X = 天気、Y = 傘）:

| | Y=0（傘なし） | Y=1（傘あり） | 周辺 P(X) |
|---|---|---|---|
| X=0（晴れ） | 0.40 | 0.10 | P(X=0) = 0.50 |
| X=1（雨） | 0.05 | 0.45 | P(X=1) = 0.50 |
| **周辺 P(Y)** | P(Y=0) = 0.45 | P(Y=1) = 0.55 | 1.00 |

周辺分布は、もう一方の変数を足し合わせて消去します。

```
P(X = x) = sum over all y of P(X = x, Y = y)
```

上の表の行合計と列合計が周辺分布です。

### 正規分布が至るところに現れる理由

中心極限定理: 多くの独立な確率変数の和（または平均）は、元の分布に関係なく正規分布へ近づきます。

```
Roll 1 die:  uniform distribution (flat)
Average of 2 dice:  triangular (peaked)
Average of 30 dice: nearly perfect bell curve

This works for ANY starting distribution.
```

これが次の理由です。
- 測定誤差はおおよそ正規分布になる（多くの小さな独立要因の合計）
- ニューラルネットワークの重み初期化には正規分布が使われる
- SGD の勾配ノイズはおおよそ正規分布になる（多くのサンプル勾配の和）
- 正規分布は、与えられた平均と分散に対する最大エントロピー分布である

### 対数確率

生の確率は数値問題を引き起こします。多くの小さな確率を掛け合わせると、すぐにゼロへアンダーフローします。

```
P(sentence) = P(word1) * P(word2) * ... * P(word_n)
            = 0.01 * 0.003 * 0.02 * ...
            -> 0.0 (underflow after ~30 terms)
```

対数確率はこれを解決します。掛け算は足し算になります。

```
log P(sentence) = log P(word1) + log P(word2) + ... + log P(word_n)
                = -4.6 + -5.8 + -3.9 + ...
                -> finite number (no underflow)
```

規則:
- log(a * b) = log(a) + log(b)
- 対数確率は常に <= 0（0 < P <= 1 だから）
- より負に大きいほど起こりにくい
- Cross-entropy loss は正解クラスの負の対数確率である

### 確率分布としての Softmax

ニューラルネットワークは生のスコア（logits）を出力します。Softmax はそれを有効な確率分布へ変換します。

```
softmax(z_i) = exp(z_i) / sum(exp(z_j) for all j)

Properties:
  - All outputs are in (0, 1)
  - All outputs sum to 1
  - Preserves relative ordering of inputs
  - exp() amplifies differences between logits
```

softmax のトリック: 指数化する前に最大 logit を引くと、オーバーフローを防げます。

```
z = [100, 101, 102]
exp(102) = overflow

z_shifted = z - max(z) = [-2, -1, 0]
exp(0) = 1  (safe)

Same result, no overflow.
```

Log-softmax は softmax と log を組み合わせ、数値安定性を高めます。PyTorch は cross-entropy loss の内部でこれを使っています。

### サンプリング

サンプリングとは、分布からランダムな値を引くことです。機械学習では次のように使われます。
- Dropout は、ゼロにするニューロンをランダムにサンプリングする
- データ拡張は、ランダムな変換をサンプリングする
- 言語モデルは、予測分布から次のトークンをサンプリングする
- 拡散モデルはノイズをサンプリングし、段階的にノイズを除去する

任意の分布からサンプリングするには、逆変換サンプリング、棄却サンプリング、または reparameterization trick（VAE で使われる）などの手法が必要です。

## 作ってみる

### Step 1: 確率の基礎

```python
import math
import random

def factorial(n):
    result = 1
    for i in range(2, n + 1):
        result *= i
    return result

def combinations(n, k):
    return factorial(n) // (factorial(k) * factorial(n - k))

def conditional_probability(p_a_and_b, p_b):
    return p_a_and_b / p_b

p_king_given_face = conditional_probability(4/52, 12/52)
print(f"P(King | Face card) = {p_king_given_face:.4f}")
```

### Step 2: PMF と PDF をスクラッチで作る

```python
def bernoulli_pmf(k, p):
    return p if k == 1 else (1 - p)

def categorical_pmf(k, probs):
    return probs[k]

def poisson_pmf(k, lam):
    return (lam ** k) * math.exp(-lam) / factorial(k)

def uniform_pdf(x, a, b):
    if a <= x <= b:
        return 1.0 / (b - a)
    return 0.0

def normal_pdf(x, mu, sigma):
    coeff = 1.0 / (sigma * math.sqrt(2 * math.pi))
    exponent = -0.5 * ((x - mu) / sigma) ** 2
    return coeff * math.exp(exponent)
```

### Step 3: 期待値と分散

```python
def expected_value(values, probabilities):
    return sum(v * p for v, p in zip(values, probabilities))

def variance(values, probabilities):
    mu = expected_value(values, probabilities)
    return sum(p * (v - mu) ** 2 for v, p in zip(values, probabilities))

die_values = [1, 2, 3, 4, 5, 6]
die_probs = [1/6] * 6
mu = expected_value(die_values, die_probs)
var = variance(die_values, die_probs)
print(f"Die: E[X] = {mu:.4f}, Var(X) = {var:.4f}, SD = {var**0.5:.4f}")
```

### Step 4: 分布からのサンプリング

```python
def sample_bernoulli(p, n=1):
    return [1 if random.random() < p else 0 for _ in range(n)]

def sample_categorical(probs, n=1):
    cumulative = []
    total = 0
    for p in probs:
        total += p
        cumulative.append(total)
    samples = []
    for _ in range(n):
        r = random.random()
        for i, c in enumerate(cumulative):
            if r <= c:
                samples.append(i)
                break
    return samples

def sample_normal_box_muller(mu, sigma, n=1):
    samples = []
    for _ in range(n):
        u1 = random.random()
        u2 = random.random()
        z = math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)
        samples.append(mu + sigma * z)
    return samples
```

### Step 5: Softmax と対数確率

```python
def softmax(logits):
    max_logit = max(logits)
    shifted = [z - max_logit for z in logits]
    exps = [math.exp(z) for z in shifted]
    total = sum(exps)
    return [e / total for e in exps]

def log_softmax(logits):
    max_logit = max(logits)
    shifted = [z - max_logit for z in logits]
    log_sum_exp = max_logit + math.log(sum(math.exp(z) for z in shifted))
    return [z - log_sum_exp for z in logits]

def cross_entropy_loss(logits, target_index):
    log_probs = log_softmax(logits)
    return -log_probs[target_index]
```

### Step 6: 中心極限定理のデモ

```python
def demonstrate_clt(dist_fn, n_samples, n_averages):
    averages = []
    for _ in range(n_averages):
        samples = [dist_fn() for _ in range(n_samples)]
        averages.append(sum(samples) / len(samples))
    return averages
```

### Step 7: 可視化

```python
import matplotlib.pyplot as plt

xs = [mu + sigma * (i - 500) / 100 for i in range(1001)]
ys = [normal_pdf(x, mu, sigma) for x, mu, sigma in ...]
plt.plot(xs, ys)
```

すべての可視化を含む完全な実装は `code/probability.py` にあります。

## 使ってみる

NumPy と SciPy を使うと、上の内容はすべてワンライナーになります。

```python
import numpy as np
from scipy import stats

normal = stats.norm(loc=0, scale=1)
samples = normal.rvs(size=10000)
print(f"Mean: {np.mean(samples):.4f}, Std: {np.std(samples):.4f}")
print(f"P(X < 1.96) = {normal.cdf(1.96):.4f}")

logits = np.array([2.0, 1.0, 0.1])
from scipy.special import softmax, log_softmax
probs = softmax(logits)
log_probs = log_softmax(logits)
print(f"Softmax: {probs}")
print(f"Log-softmax: {log_probs}")
```

あなたはこれらをスクラッチで作りました。これで、ライブラリ呼び出しの中で何が起きているかが分かります。

## 演習

1. 指数分布の逆変換サンプリングを実装してください。10,000 個の値をサンプリングし、ヒストグラムを真の PDF と比較して検証してください。

2. 偏りのある2つのサイコロについて同時分布表を作ってください。周辺分布を計算し、2つのサイコロが独立かどうかを確認してください。

3. 正解クラスが index 3 のとき、logits `[2.0, 0.5, -1.0, 3.0, 0.1]` を出力する5クラス分類器の cross-entropy loss を計算してください。その後、PyTorch の `nn.CrossEntropyLoss` で答えを検証してください。

4. 対数確率のリストを受け取り、最もありそうな系列、合計対数確率、対応する生の確率を返す関数を書いてください。各単語の確率が 0.01 の50語文でテストしてください。

## 重要用語

| 用語 | よく言われる説明 | 実際の意味 |
|------|----------------|----------------------|
| 標本空間 | 「すべての可能性」 | 実験で起こり得るすべての結果からなる集合 S |
| PMF | 「確率関数」 | 各離散結果の正確な確率を与える関数。合計は 1 になる |
| PDF | 「確率曲線」 | 連続変数の密度関数。区間上で積分すると確率が得られる |
| 条件付き確率 | 「何かが与えられたときの確率」 | P(A\|B) = P(A and B) / P(B)。ベイズ的な考え方とベイズの定理の基礎 |
| 独立性 | 「互いに影響しない」 | P(A and B) = P(A) * P(B)。一方の事象を知っても、もう一方について何も分からない |
| 期待値 | 「平均」 | すべての結果を確率で重み付けして足したもの。損失関数は期待値である |
| 分散 | 「どれだけ広がっているか」 | 平均からの二乗偏差の期待値。高い分散は、ノイズが多く不安定な推定を意味する |
| 正規分布 | 「釣鐘曲線」 | f(x) = (1/sqrt(2*pi*sigma^2)) * exp(-(x-mu)^2/(2*sigma^2))。中心極限定理により至るところに現れる |
| 中心極限定理 | 「平均は正規分布になる」 | 多くの独立サンプルの平均は、元の分布に関係なく正規分布へ近づく |
| 同時分布 | 「2つの変数を一緒に見る」 | P(X, Y) は、X と Y のすべての組み合わせの確率を記述する |
| 周辺分布 | 「もう一方の変数を足し消す」 | P(X) = sum_y P(X, Y)。同時分布から1つの変数の分布を取り戻す |
| 対数確率 | 「確率の log」 | log P(x)。積を和に変え、長い系列での数値アンダーフローを防ぐ |
| Softmax | 「スコアを確率に変える」 | softmax(z_i) = exp(z_i) / sum(exp(z_j))。実数値 logits を有効な確率分布へ写す |
| Cross-entropy | 「損失関数」 | -sum(p_true * log(p_predicted))。2つの分布がどれだけ異なるかを測る。低いほどよい |
| Logits | 「モデルの生出力」 | softmax 前の未正規化スコア。logistic 関数に由来する名前 |
| サンプリング | 「ランダムな値を引く」 | 確率分布に従って値を生成すること。モデルが出力を生成する方法 |

## 参考資料

- [3Blue1Brown: But what is the Central Limit Theorem?](https://www.youtube.com/watch?v=zeJD6dqJ5lo) - 平均が正規分布になる理由を視覚的に示す証明
- [Stanford CS229 Probability Review](https://cs229.stanford.edu/section/cs229-prob.pdf) - ここで扱った内容とその先を簡潔にまとめたリファレンス
- [The Log-Sum-Exp Trick](https://gregorygundersen.com/blog/2020/02/09/log-sum-exp/) - 数値安定性が重要な理由と、その実現方法
