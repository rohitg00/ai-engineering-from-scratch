# 機率與分布

> 機率是 AI 用來表達不確定性的語言。

**Type:** Learn
**Language:** Python
**Prerequisites:** Phase 1, Lessons 01-04
**Time:** ~75 minutes

## Learning Objectives｜學習目標

- 從零實作伯努利、類別、卜瓦松、均勻與常態分布（normal distribution）的機率質量函數（PMF）和機率密度函數（PDF）
- 計算期望值與變異數（variance），並用中央極限定理（Central Limit Theorem）說明為什麼高斯分布無所不在
- 用數值穩定性技巧（numerical stability trick，減去最大 logit）打造 softmax 和 log-softmax 函數
- 從 logits 計算交叉熵損失，並把它連結到負對數概似（negative log-likelihood）

## The Problem｜問題

一個分類器（classifier）輸出 `[0.03, 0.91, 0.06]`；一個語言模型（language model）從 50,000 個候選中挑選下一個詞；一個擴散模型從學到的分布中採樣以生成圖片。這些都是機率的實際應用。

模型做的每個預測都是一個機率分布（probability distribution）；每個損失函數（loss function）都在衡量預測分布離真實分布有多遠；每次訓練步驟都在調整參數，讓一個分布更像另一個。沒有機率，你讀不了任何一篇 ML 論文、除錯不了任何一個模型，也搞不懂訓練損失為什麼變成 NaN。

## The Concept｜核心概念

### 事件、樣本空間與機率

樣本空間（sample space）S 是所有可能結果的集合。事件（event）是樣本空間的子集。機率把事件映射到 0 到 1 之間的數字。

```
Coin flip:
  S = {H, T}
  P(H) = 0.5,  P(T) = 0.5

Single die roll:
  S = {1, 2, 3, 4, 5, 6}
  P(even) = P({2, 4, 6}) = 3/6 = 0.5
```

三條公理定義了全部的機率論：
1. 對任何事件 A，P(A) >= 0
2. P(S) = 1（總會發生些什麼）
3. 當 A 和 B 不能同時發生時，P(A or B) = P(A) + P(B)

其他一切（貝氏定理、期望值、分布）都從這三條規則推導出來。

### 條件機率（conditional probability）與獨立性（independence）

P(A|B) 是在 B 已經發生的條件下，A 發生的機率。

```
P(A|B) = P(A and B) / P(B)

Example: deck of cards
  P(King | Face card) = P(King and Face card) / P(Face card)
                      = (4/52) / (12/52)
                      = 4/12 = 1/3
```

當知道一個事件對另一個事件毫無資訊時，兩個事件獨立：

```
Independent:   P(A|B) = P(A)
Equivalent to: P(A and B) = P(A) * P(B)
```

丟硬幣是獨立的；抽牌不放回就不是。

### 機率質量函數 vs 機率密度函數

離散隨機變數有機率質量函數（PMF）。每個結果都有一個可以直接讀出的特定機率。

```
PMF: P(X = k)

Fair die:
  P(X = 1) = 1/6
  P(X = 2) = 1/6
  ...
  P(X = 6) = 1/6

  Sum of all probabilities = 1
```

連續隨機變數有機率密度函數（PDF）。單一點的密度不是機率——機率來自對密度在區間上的積分。

```
PDF: f(x)

P(a <= X <= b) = integral of f(x) from a to b

f(x) can be greater than 1 (density, not probability)
integral from -inf to +inf of f(x) dx = 1
```

這個區別在 ML 中很重要：分類輸出是 PMF（離散選擇），VAE 的潛在空間用的是 PDF（連續）。

### 常見分布

**伯努利（Bernoulli）：** 一次試驗、兩個結果。為二元分類（binary classification）建模。

```
P(X = 1) = p
P(X = 0) = 1 - p
Mean = p,  Variance = p(1-p)
```

**類別（categorical）：** 一次試驗、k 個結果。為多類別分類（multi-class classification）建模（softmax 輸出）。

```
P(X = i) = p_i,  where sum of p_i = 1
Example: P(cat) = 0.7,  P(dog) = 0.2,  P(bird) = 0.1
```

**均勻（uniform）：** 所有結果等可能。用於隨機初始化。

```
Discrete: P(X = k) = 1/n for k in {1, ..., n}
Continuous: f(x) = 1/(b-a) for x in [a, b]
```

**常態（高斯，Gaussian）：** 鐘形曲線。以平均數（mu）和變異數（sigma^2）參數化。

```
f(x) = (1 / sqrt(2*pi*sigma^2)) * exp(-(x - mu)^2 / (2*sigma^2))

Standard normal: mu = 0, sigma = 1
  68% of data within 1 sigma
  95% within 2 sigma
  99.7% within 3 sigma
```

**卜瓦松（Poisson）：** 固定區間內罕見事件的次數。為事件率建模。

```
P(X = k) = (lambda^k * e^(-lambda)) / k!
Mean = lambda,  Variance = lambda
```

### 期望值與變異數

期望值是依機率加權的平均結果。

```
Discrete:   E[X] = sum of x_i * P(X = x_i)
Continuous: E[X] = integral of x * f(x) dx
```

變異數衡量圍繞平均數的分散程度。

```
Var(X) = E[(X - E[X])^2] = E[X^2] - (E[X])^2
Standard deviation = sqrt(Var(X))
```

在 ML 中，期望值以損失函數的形式出現（對資料分布的平均損失）。變異數告訴你模型的穩定性——梯度變異數高，代表訓練雜訊較大。

### 聯合分布（joint distribution）與邊際分布（marginal distribution）

聯合分布 P(X, Y) 一起描述兩個隨機變數。

聯合 PMF 範例（X = 天氣，Y = 帶傘）：

| | Y=0（沒帶傘） | Y=1（帶傘） | 邊際 P(X) |
|---|---|---|---|
| X=0（晴） | 0.40 | 0.10 | P(X=0) = 0.50 |
| X=1（雨） | 0.05 | 0.45 | P(X=1) = 0.50 |
| **邊際 P(Y)** | P(Y=0) = 0.45 | P(Y=1) = 0.55 | 1.00 |

邊際分布把另一個變數加總掉（sum out）：

```
P(X = x) = sum over all y of P(X = x, Y = y)
```

上表中的列總和與欄總和就是邊際。

### 為什麼常態分布無所不在

中央極限定理：許多獨立隨機變數的和（或平均）會收斂到常態分布——不管原本的分布長什麼樣。

```
Roll 1 die:  uniform distribution (flat)
Average of 2 dice:  triangular (peaked)
Average of 30 dice: nearly perfect bell curve

This works for ANY starting distribution.
```

這就是為什麼：
- 測量誤差近似常態（許多小的獨立來源相加）
- 神經網路的權重初始化使用常態分布
- SGD 中的梯度雜訊近似常態（許多樣本梯度相加）
- 常態分布是給定平均數與變異數下的最大熵分布

### 對數機率

原始機率會造成數值問題。把很多小機率乘在一起，很快就下溢位（underflow）成零。

```
P(sentence) = P(word1) * P(word2) * ... * P(word_n)
            = 0.01 * 0.003 * 0.02 * ...
            -> 0.0 (underflow after ~30 terms)
```

對數機率解決這個問題：乘法變成加法。

```
log P(sentence) = log P(word1) + log P(word2) + ... + log P(word_n)
                = -4.6 + -5.8 + -3.9 + ...
                -> finite number (no underflow)
```

規則：
- log(a * b) = log(a) + log(b)
- 對數機率永遠 <= 0（因為 0 < P <= 1）
- 越負代表機率越低
- 交叉熵損失就是正確類別的負對數機率

### Softmax 作為機率分布

神經網路輸出的是原始分數（logits）。softmax 把它們轉換成合法的機率分布。

```
softmax(z_i) = exp(z_i) / sum(exp(z_j) for all j)

Properties:
  - All outputs are in (0, 1)
  - All outputs sum to 1
  - Preserves relative ordering of inputs
  - exp() amplifies differences between logits
```

softmax 技巧：取指數前先減去最大的 logit，防止溢位（overflow）。

```
z = [100, 101, 102]
exp(102) = overflow

z_shifted = z - max(z) = [-2, -1, 0]
exp(0) = 1  (safe)

Same result, no overflow.
```

log-softmax 把 softmax 和 log 合在一起，保住數值穩定。PyTorch 內部就用它來算交叉熵損失。

### 取樣

取樣（sampling）是從分布中抽取隨機值。在 ML 中：
- dropout 隨機取樣要清零哪些神經元
- 資料增強取樣隨機變換
- 語言模型從預測分布中取樣下一個 token
- 擴散模型取樣雜訊再逐步去噪

從任意分布取樣需要反函數取樣（inverse transform sampling）、拒絕取樣（rejection sampling）或重參數化技巧（reparameterization trick，VAE 使用）之類的技術。

```figure
gaussian-pdf
```

## Build It｜動手實作

### 步驟 1：機率基礎

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

### 步驟 2：從零寫 PMF 和 PDF

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

### 步驟 3：期望值與變異數

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

### 步驟 4：從分布取樣

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

### 步驟 5：softmax 與對數機率

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

### 步驟 6：中央極限定理演示

```python
def demonstrate_clt(dist_fn, n_samples, n_averages):
    averages = []
    for _ in range(n_averages):
        samples = [dist_fn() for _ in range(n_samples)]
        averages.append(sum(samples) / len(samples))
    return averages
```

### 步驟 7：視覺化

```python
import matplotlib.pyplot as plt

xs = [mu + sigma * (i - 500) / 100 for i in range(1001)]
ys = [normal_pdf(x, mu, sigma) for x, mu, sigma in ...]
plt.plot(xs, ys)
```

完整實作含所有視覺化在 `code/probability.py` 中。

## Use It｜實際應用

有了 NumPy 和 SciPy，以上每件事都只要一行：

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

這些你都從零打造過了。現在你知道函式庫呼叫背後在做什麼。

## Exercises｜練習

1. 為指數分布實作反函數取樣。用 10,000 個取樣值畫直方圖，並和真實 PDF 比對來驗證。

2. 為兩顆灌鉛骰子建一張聯合分布表。計算邊際分布，並檢查兩顆骰子是否獨立。

3. 一個 5 類別分類器輸出 logits `[2.0, 0.5, -1.0, 3.0, 0.1]`，正確類別是索引 3，計算它的交叉熵損失。然後用 PyTorch 的 `nn.CrossEntropyLoss` 驗證你的答案。

4. 寫一個函式：輸入一串對數機率，回傳最可能的序列、總對數機率，以及等值的原始機率。用一個 50 個詞、每個詞機率 0.01 的句子測試它。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|----------------------|
| 樣本空間（sample space） | 「所有的可能性」 | 一次實驗中每個可能結果的集合 S |
| PMF | 「機率函數」 | 給出每個離散結果確切機率的函數，總和為 1 |
| PDF | 「機率曲線」 | 連續變數的密度函數。對它在區間上積分才能得到機率 |
| 條件機率（conditional probability） | 「給定某事下的機率」 | P(A\|B) = P(A and B) / P(B)。貝氏思考與貝氏定理的基礎 |
| 獨立（independence） | 「互不影響」 | P(A and B) = P(A) * P(B)。知道一個事件對另一個毫無資訊 |
| 期望值（expected value） | 「平均」 | 所有結果依機率加權的總和。損失函數就是一種期望值 |
| 變異數（variance） | 「分散程度」 | 與平均數的期望平方偏差。高變異數 = 估計吵雜且不穩定 |
| 常態分布（normal distribution） | 「鐘形曲線」 | f(x) = (1/sqrt(2*pi*sigma^2)) * exp(-(x-mu)^2/(2*sigma^2))。因中央極限定理而無所不在 |
| 中央極限定理（Central Limit Theorem） | 「平均會變常態」 | 許多獨立樣本的平均會收斂到常態分布，不管來源分布是什麼 |
| 聯合分布（joint distribution） | 「兩個變數一起看」 | P(X, Y) 描述 X 和 Y 每種結果組合的機率 |
| 邊際分布（marginal distribution） | 「把另一個變數加總掉」 | P(X) = sum_y P(X, Y)。從聯合分布還原單一變數的分布 |
| 對數機率（log probability） | 「機率取 log」 | log P(x)。把乘積變成加總，防止長序列的數值下溢位 |
| Softmax | 「把分數變機率」 | softmax(z_i) = exp(z_i) / sum(exp(z_j))。把實數 logits 映射到合法機率分布 |
| 交叉熵（cross-entropy） | 「那個損失函數」 | -sum(p_true * log(p_predicted))。衡量兩個分布差多少，越低越好 |
| Logits | 「模型原始輸出」 | softmax 之前未正規化的分數。名稱來自 logistic 函數 |
| 取樣（sampling） | 「抽隨機值」 | 依機率分布產生數值。模型生成輸出的方式 |

## Further Reading｜延伸閱讀

- [3Blue1Brown: But what is the Central Limit Theorem?](https://www.youtube.com/watch?v=zeJD6dqJ5lo) - 為什麼平均會變常態的視覺化證明
- [Stanford CS229 Probability Review](https://cs229.stanford.edu/section/cs229-prob.pdf) - 涵蓋這裡所有內容及更多的精簡參考
- [The Log-Sum-Exp Trick](https://gregorygundersen.com/blog/2020/02/09/log-sum-exp/) - 為什麼數值穩定重要、以及如何達成
