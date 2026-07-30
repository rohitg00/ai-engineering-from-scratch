# 機率與分布

> 機率是 AI 用來表達不確定性的語言。

**類型：** 學習
**程式語言：** Python
**先修單元：** 階段 1 · 單元 01-04
**時間：** 約 75 分鐘

## 學習目標

- 從零實作伯努利、類別、卜瓦松、均勻與常態分布的 PMF 與 PDF
- 計算期望值與變異數，並用中央極限定理說明為什麼高斯分布無處不在
- 打造 softmax 與 log-softmax 函式，並加上數值穩定的技巧（減掉最大的 logit）
- 從 logits 算出交叉熵損失，並把它接回負對數概似

## 問題所在

一個分類器輸出 `[0.03, 0.91, 0.06]`。一個語言模型從 50,000 個候選詞裡挑出下一個字。一個擴散模型透過從學到的分布中取樣來生成圖片。這些全都是機率在運作。

模型做出的每一個預測都是一個機率分布。每一個損失函式都在衡量預測的分布離真實分布有多遠。每一個訓練步驟都在調整參數，讓一個分布更像另一個分布。少了機率，你讀不懂任何一篇 ML 論文，除不了任何一個模型的錯，也搞不清楚為什麼你的訓練損失變成 NaN。

## 核心概念

### 事件、樣本空間與機率

樣本空間 S 是所有可能結果的集合。事件是樣本空間的一個子集合。機率把事件映射到 0 與 1 之間的數字。

```
Coin flip:
  S = {H, T}
  P(H) = 0.5,  P(T) = 0.5

Single die roll:
  S = {1, 2, 3, 4, 5, 6}
  P(even) = P({2, 4, 6}) = 3/6 = 0.5
```

三條公理就定義了整個機率論：
1. 對任何事件 A，P(A) >= 0
2. P(S) = 1（總會發生某件事）
3. 當 A 與 B 不可能同時發生時，P(A or B) = P(A) + P(B)

其餘的一切（貝氏定理、期望值、各種分布）都是從這三條規則推出來的。

### 條件機率與獨立

P(A|B) 是「已知 B 發生」的情況下 A 的機率。

```
P(A|B) = P(A and B) / P(B)

Example: deck of cards
  P(King | Face card) = P(King and Face card) / P(Face card)
                      = (4/52) / (12/52)
                      = 4/12 = 1/3
```

當知道其中一個事件對另一個事件毫無幫助時，這兩個事件就是獨立的：

```
Independent:   P(A|B) = P(A)
Equivalent to: P(A and B) = P(A) * P(B)
```

丟硬幣是獨立的。不放回地抽牌不是。

### 機率質量函數 vs 機率密度函數

離散隨機變數有機率質量函數（PMF）。每個結果都有一個明確的機率，可以直接讀出來。

```
PMF: P(X = k)

Fair die:
  P(X = 1) = 1/6
  P(X = 2) = 1/6
  ...
  P(X = 6) = 1/6

  Sum of all probabilities = 1
```

連續隨機變數有機率密度函數（PDF）。單一點上的密度不是機率。機率要把密度在一段區間上積分才得到。

```
PDF: f(x)

P(a <= X <= b) = integral of f(x) from a to b

f(x) can be greater than 1 (density, not probability)
integral from -inf to +inf of f(x) dx = 1
```

這個區別在 ML 裡很重要。分類的輸出是 PMF（離散的選擇）。VAE 的潛在空間用的是 PDF（連續的）。

### 常見的分布

**伯努利：** 一次試驗，兩種結果。用來描述二元分類。

```
P(X = 1) = p
P(X = 0) = 1 - p
Mean = p,  Variance = p(1-p)
```

**類別（categorical）：** 一次試驗，k 種結果。用來描述多類別分類（softmax 的輸出）。

```
P(X = i) = p_i,  where sum of p_i = 1
Example: P(cat) = 0.7,  P(dog) = 0.2,  P(bird) = 0.1
```

**均勻：** 所有結果的可能性都相同。用於隨機初始化。

```
Discrete: P(X = k) = 1/n for k in {1, ..., n}
Continuous: f(x) = 1/(b-a) for x in [a, b]
```

**常態（高斯）：** 鐘形曲線。由平均值 (mu) 與變異數 (sigma^2) 決定。

```
f(x) = (1 / sqrt(2*pi*sigma^2)) * exp(-(x - mu)^2 / (2*sigma^2))

Standard normal: mu = 0, sigma = 1
  68% of data within 1 sigma
  95% within 2 sigma
  99.7% within 3 sigma
```

**卜瓦松：** 固定區間內罕見事件的次數。用來描述事件發生率。

```
P(X = k) = (lambda^k * e^(-lambda)) / k!
Mean = lambda,  Variance = lambda
```

### 期望值與變異數

期望值就是結果的加權平均。

```
Discrete:   E[X] = sum of x_i * P(X = x_i)
Continuous: E[X] = integral of x * f(x) dx
```

變異數衡量資料在平均值周圍的散布程度。

```
Var(X) = E[(X - E[X])^2] = E[X^2] - (E[X])^2
Standard deviation = sqrt(Var(X))
```

在 ML 裡，期望值以損失函式的形式出現（在資料分布上的平均損失）。變異數則告訴你模型有多穩定。梯度的變異數很大，意味著訓練過程充滿雜訊。

### 聯合分布與邊際分布

聯合分布 P(X, Y) 同時描述兩個隨機變數。

聯合 PMF 的例子（X = 天氣，Y = 雨傘）：

| | Y=0（沒帶傘） | Y=1（帶傘） | 邊際 P(X) |
|---|---|---|---|
| X=0（晴天） | 0.40 | 0.10 | P(X=0) = 0.50 |
| X=1（下雨） | 0.05 | 0.45 | P(X=1) = 0.50 |
| **邊際 P(Y)** | P(Y=0) = 0.45 | P(Y=1) = 0.55 | 1.00 |

邊際分布把另一個變數加總掉：

```
P(X = x) = sum over all y of P(X = x, Y = y)
```

上表的列總和與欄總和就是邊際分布。

### 為什麼常態分布無處不在

中央極限定理：許多獨立隨機變數的總和（或平均）會收斂到常態分布，跟原本的分布是什麼無關。

```
Roll 1 die:  uniform distribution (flat)
Average of 2 dice:  triangular (peaked)
Average of 30 dice: nearly perfect bell curve

This works for ANY starting distribution.
```

這也解釋了為什麼：
- 測量誤差近似常態（來自許多微小且獨立的來源）
- 神經網路的權重初始化採用常態分布
- SGD 的梯度雜訊近似常態（許多樣本梯度的總和）
- 在給定平均值與變異數下，常態分布是最大熵的分布

### 對數機率

原始機率會造成數值問題。把很多個很小的機率乘在一起，很快就會下溢到零。

```
P(sentence) = P(word1) * P(word2) * ... * P(word_n)
            = 0.01 * 0.003 * 0.02 * ...
            -> 0.0 (underflow after ~30 terms)
```

對數機率解決了這個問題。乘法變成加法。

```
log P(sentence) = log P(word1) + log P(word2) + ... + log P(word_n)
                = -4.6 + -5.8 + -3.9 + ...
                -> finite number (no underflow)
```

規則：
- log(a * b) = log(a) + log(b)
- 對數機率永遠 <= 0（因為 0 < P <= 1）
- 越負，代表越不可能
- 交叉熵損失就是正確類別的負對數機率

### softmax 就是一個機率分布

神經網路輸出的是原始分數（logits）。softmax 把它們轉成一個合法的機率分布。

```
softmax(z_i) = exp(z_i) / sum(exp(z_j) for all j)

Properties:
  - All outputs are in (0, 1)
  - All outputs sum to 1
  - Preserves relative ordering of inputs
  - exp() amplifies differences between logits
```

softmax 的小技巧：取指數之前先減掉最大的 logit，避免溢位。

```
z = [100, 101, 102]
exp(102) = overflow

z_shifted = z - max(z) = [-2, -1, 0]
exp(0) = 1  (safe)

Same result, no overflow.
```

log-softmax 把 softmax 與 log 結合起來，以確保數值穩定。PyTorch 在內部就是用它來算交叉熵損失的。

### 取樣

取樣就是從一個分布中抽出隨機值。在 ML 裡：
- Dropout 隨機取樣要把哪些神經元歸零
- 資料增強會取樣隨機的轉換
- 語言模型從預測出的分布中取樣下一個詞元
- 擴散模型先取樣雜訊，再逐步去噪

要從任意分布取樣，需要用到反轉換取樣、拒絕取樣，或重參數化技巧（VAE 用的那個）等方法。

```figure
gaussian-pdf
```

## 動手實作

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

### 步驟 2：從零實作 PMF 與 PDF

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

### 步驟 4：從分布中取樣

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

### 步驟 6：中央極限定理示範

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

完整實作與所有視覺化都在 `code/probability.py` 裡。

## 框架應用

有了 NumPy 與 SciPy，上面所有東西都只是一行程式碼：

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

這些你都從零打造過了。現在你知道那些函式庫的呼叫到底在做什麼。

## 練習

1. 為指數分布實作反轉換取樣。取樣 10,000 個值，把直方圖跟真正的 PDF 比對來驗證。

2. 為兩顆灌鉛的骰子建一張聯合分布表。算出邊際分布，並檢查這兩顆骰子是否獨立。

3. 有一個 5 類別的分類器輸出 logits `[2.0, 0.5, -1.0, 3.0, 0.1]`，而正確類別是索引 3，請算出它的交叉熵損失。然後用 PyTorch 的 `nn.CrossEntropyLoss` 驗證你的答案。

4. 寫一個函式，接收一串對數機率，回傳最可能的序列、總對數機率，以及對應的原始機率。用一個 50 個詞的句子測試，其中每個詞的機率都是 0.01。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|----------------|----------------------|
| 樣本空間 | 「所有的可能性」 | 集合 S，包含一次實驗所有可能的結果 |
| PMF | 「那個機率函式」 | 一個給出每個離散結果確切機率的函式，總和為 1 |
| PDF | 「那條機率曲線」 | 連續變數的密度函式。在一段區間上積分才得到機率 |
| 條件機率 | 「已知某件事的機率」 | P(A\|B) = P(A and B) / P(B)。貝氏思考與貝氏定理的基礎 |
| 獨立 | 「它們互不影響」 | P(A and B) = P(A) * P(B)。知道其中一個事件對另一個毫無幫助 |
| 期望值 | 「平均值」 | 所有結果以機率加權後的總和。損失函式就是一個期望值 |
| 變異數 | 「散得有多開」 | 偏離平均值的期望平方距離。變異數大 = 估計充滿雜訊、不穩定 |
| 常態分布 | 「鐘形曲線」 | f(x) = (1/sqrt(2*pi*sigma^2)) * exp(-(x-mu)^2/(2*sigma^2))。因為 CLT 而無處不在 |
| 中央極限定理 | 「平均之後就變常態」 | 大量獨立樣本的平均值會收斂到常態分布，跟來源分布無關 |
| 聯合分布 | 「兩個變數一起看」 | P(X, Y) 描述 X 與 Y 每一種結果組合的機率 |
| 邊際分布 | 「把另一個變數加總掉」 | P(X) = sum_y P(X, Y)。從聯合分布還原出單一變數的分布 |
| 對數機率 | 「機率取對數」 | log P(x)。把乘法變成加法，避免長序列的數值下溢 |
| Softmax | 「把分數變成機率」 | softmax(z_i) = exp(z_i) / sum(exp(z_j))。把實數 logits 映射成一個合法的機率分布 |
| 交叉熵 | 「那個損失函式」 | -sum(p_true * log(p_predicted))。衡量兩個分布差多少。越低越好 |
| Logits | 「模型的原始輸出」 | 進 softmax 之前未正規化的分數。名字來自 logistic 函式 |
| 取樣 | 「抽隨機值」 | 依照某個機率分布產生數值。模型就是這樣生成輸出的 |

## 延伸閱讀

- [3Blue1Brown: But what is the Central Limit Theorem?](https://www.youtube.com/watch?v=zeJD6dqJ5lo) —— 為什麼平均之後會變常態的視覺化證明
- [Stanford CS229 Probability Review](https://cs229.stanford.edu/section/cs229-prob.pdf) —— 簡潔的參考資料，涵蓋這裡的全部內容以及更多
- [The Log-Sum-Exp Trick](https://gregorygundersen.com/blog/2020/02/09/log-sum-exp/) —— 為什麼數值穩定性重要，以及怎麼做到
