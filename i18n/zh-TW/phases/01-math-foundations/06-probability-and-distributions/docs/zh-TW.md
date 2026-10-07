# 機率與機率分布

> 機率是 AI 用來描述不確定性的語言。

**Type:** Learn
**Language:** Python
**Prerequisites:** Phase 1, Lessons 01-04
**Time:** ~75 minutes

## 學習目標

- 從零實作 Bernoulli、類別、Poisson、均勻和常態分布的 PMF 與 PDF
- 計算期望值與變異數，並運用中央極限定理說明常態分布為何如此常見
- 建立 softmax 與 log-softmax 函式，並使用數值穩定技巧（減去最大 logit）
- 從 logits 計算交叉熵損失，並說明它與負對數概似的關聯

## The Problem｜問題

分類器輸出 `[0.03, 0.91, 0.06]`；語言模型從 50,000 個候選詞中挑選下一個詞；擴散模型則從學得的分布中取樣來產生影像。這些都是機率的實際應用。

模型的每個預測都是一種機率分布；每個損失函式都在衡量預測分布與真實分布的差異；每次訓練都會調整參數，讓兩種分布更接近。不了解機率，就無法讀懂機器學習論文、除錯模型，也不明白訓練損失為何會變成 NaN。

## The Concept｜核心概念

### 事件、樣本空間與機率

樣本空間 S 是所有可能結果的集合。事件是樣本空間的子集合。機率會將事件對應到 0 到 1 之間的數值。

```text
擲硬幣：
  S = {H, T}
  P(H) = 0.5，P(T) = 0.5

擲一顆骰子：
  S = {1, 2, 3, 4, 5, 6}
  P(偶數) = P({2, 4, 6}) = 3/6 = 0.5
```

機率由三條公理定義：
1. 對任何事件 A，P(A) >= 0
2. P(S) = 1（必定會發生某種結果）
3. 若 A 和 B 不可能同時發生，則 P(A or B) = P(A) + P(B)

其他概念（貝氏定理、期望值、機率分布）都能從這三條規則推導出來。

### 條件機率與獨立性

P(A|B) 表示在 B 已發生的條件下，A 發生的機率。

```text
P(A|B) = P(A and B) / P(B)

Example: deck of cards
  P(King | 人頭牌) = P(King and 人頭牌) / P(人頭牌)
                      = (4/52) / (12/52)
                      = 4/12 = 1/3
```

如果知道一個事件是否發生，對另一個事件毫無幫助，這兩個事件就是獨立的：

```text
獨立：         P(A|B) = P(A)
等價於：       P(A and B) = P(A) * P(B)
```

連續擲硬幣是獨立事件；不放回抽牌則不是。

### 機率質量函式與機率密度函式

離散隨機變數使用機率質量函式（PMF），每個結果都有明確的機率，可以直接查得。

```text
PMF：P(X = k)

Fair die:
  P(X = 1) = 1/6
  P(X = 2) = 1/6
  ...
  P(X = 6) = 1/6

  Sum of all probabilities = 1
```

連續隨機變數使用機率密度函式（PDF）。某一點的密度不是機率；機率要透過對一段區間的密度積分取得。

```text
PDF：f(x)

P(a <= X <= b) = f(x) 從 a 到 b 的積分

f(x) can be greater than 1 (density, not probability)
f(x) 從 -inf 到 +inf 的積分 = 1
```

這項區別在機器學習中很重要。分類輸出是 PMF（離散選項），VAE 的潛在空間則使用 PDF（連續值）。

### 常見分布

**Bernoulli 分布：** 一次試驗、兩種結果，可用來描述二元分類。

```text
P(X = 1) = p
P(X = 0) = 1 - p
平均數 = p，變異數 = p(1-p)
```

**類別分布：** 一次試驗、k 種結果，可用來描述多類別分類（softmax 輸出）。

```text
P(X = i) = p_i，其中 p_i 的總和 = 1
例子：P(貓) = 0.7，P(狗) = 0.2，P(鳥) = 0.1
```

**均勻分布：** 所有結果發生的機率相同，常用於隨機初始化。

```text
離散：對 k ∈ {1, ..., n}，P(X = k) = 1/n
連續：對 x ∈ [a, b]，f(x) = 1/(b-a)
```

**常態分布（Gaussian）：** 呈鐘形曲線，以平均數（mu）和變異數（sigma^2）為參數。

```text
f(x) = (1 / sqrt(2*pi*sigma^2)) * exp(-(x - mu)^2 / (2*sigma^2))

Standard normal: mu = 0, sigma = 1
  68% of data within 1 sigma
  95% within 2 sigma
  99.7% within 3 sigma
```

**Poisson 分布：** 計算固定區間內罕見事件的發生次數，可用來描述事件發生率。

```text
P(X = k) = (lambda^k * e^(-lambda)) / k!
平均數 = lambda，變異數 = lambda
```

### 期望值與變異數

期望值是依機率加權的結果平均值。

```text
離散：E[X] = x_i * P(X = x_i) 的總和
連續：E[X] = x * f(x) 的積分
```

變異數衡量結果分散在平均值周圍的程度。

```text
Var(X) = E[(X - E[X])^2] = E[X^2] - (E[X])^2
標準差 = sqrt(Var(X))
```

在機器學習中，期望值會以損失函式的形式出現（資料分布上的平均損失）。變異數則能反映模型穩定性。梯度變異數過高，代表訓練過程有較多雜訊。

### 聯合分布與邊際分布

聯合分布 P(X, Y) 用來描述兩個隨機變數的共同分布。

聯合 PMF 範例（X = 天氣，Y = 是否帶傘）：

| | Y=0（沒帶傘） | Y=1（帶傘） | 邊際分布 P(X) |
|---|---|---|---|
| X=0（晴天） | 0.40 | 0.10 | P(X=0) = 0.50 |
| X=1（下雨） | 0.05 | 0.45 | P(X=1) = 0.50 |
| **邊際分布 P(Y)** | P(Y=0) = 0.45 | P(Y=1) = 0.55 | 1.00 |

邊際分布會對另一個變數的所有可能值加總：

```text
P(X = x) = 對所有 y 加總 P(X = x, Y = y)
```

上表的列總和與欄總和就是邊際分布。

### 為什麼常態分布無所不在

中央極限定理指出：無論原始分布為何，許多獨立隨機變數的總和（或平均值）都會趨近常態分布。

```text
擲 1 顆骰子：均勻分布（平坦）
2 顆骰子的平均值：三角形分布（有峰值）
30 顆骰子的平均值：幾乎呈現完美鐘形曲線

任何起始分布都適用。
```

因此：
- 測量誤差近似常態分布（來自許多微小且獨立的來源）
- 神經網路的權重會使用常態分布初始化
- SGD 的梯度雜訊近似常態分布（許多樣本梯度的總和）
- 在平均數和變異數固定時，常態分布是熵最大的分布

### 對數機率

直接使用機率會造成數值問題。許多很小的機率相乘，很快就會因下溢而變成零。

```text
P(sentence) = P(word1) * P(word2) * ... * P(word_n)
            = 0.01 * 0.003 * 0.02 * ...
            -> 0.0（約 30 項後下溢）
```

對數機率能解決這個問題，因為乘法會變成加法。

```text
log P(sentence) = log P(word1) + log P(word2) + ... + log P(word_n)
                = -4.6 + -5.8 + -3.9 + ...
                -> 有限數值（不會下溢）
```

規則：
- log(a * b) = log(a) + log(b)
- 對數機率永遠 <= 0（因為 0 < P <= 1）
- 數值越負，代表機率越低
- 交叉熵損失是正確類別的負對數機率

### 將 Softmax 視為機率分布

神經網路會輸出原始分數（logits），Softmax 會將這些分數轉換為有效的機率分布。

```text
softmax(z_i) = exp(z_i) / 對所有 j 加總 exp(z_j)

Properties:
  - All outputs are in (0, 1)
  - All outputs sum to 1
  - Preserves relative ordering of inputs
  - exp() amplifies differences between logits
```

Softmax 技巧：在取指數之前先減去最大的 logit，以避免溢位。

```text
z = [100, 101, 102]
exp(102) = 溢位

z_shifted = z - max(z) = [-2, -1, 0]
exp(0) = 1（安全）

結果相同，也不會溢位。
```

Log-softmax 結合 softmax 與對數運算，以提升數值穩定性。PyTorch 內部會用它計算交叉熵損失。

### 取樣

取樣是從分布中抽取隨機值。在機器學習中：
- Dropout 會隨機抽選要歸零的神經元
- 資料擴增會隨機抽取轉換方式
- 語言模型會從預測分布中抽取下一個詞元
- 擴散模型會抽取雜訊，再逐步去除雜訊

要從任意分布取樣，會用到反函數取樣、拒絕取樣或重參數化技巧（用於 VAE）等方法。

```figure
gaussian-pdf
```

## Build It｜動手打造

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

### 步驟 5：Softmax 與對數機率

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

### 步驟 6：示範中央極限定理

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

完整實作和所有視覺化內容都在 `code/probability.py`。

## Use It｜開始使用

使用 NumPy 和 SciPy，上述操作都能以一行程式完成：

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

你已從零實作這些功能，現在也了解函式庫呼叫背後的運作方式。

## Exercises｜練習

1. 為指數分布實作反函數取樣。抽取 10,000 個值，並將直方圖與真實 PDF 比較以驗證結果。

2. 為兩顆灌鉛骰子建立聯合分布表，計算邊際分布，並確認兩顆骰子是否獨立。

3. 某個 5 類別分類器輸出 logits `[2.0, 0.5, -1.0, 3.0, 0.1]`，正確類別的索引為 3。請計算交叉熵損失，再用 PyTorch 的 `nn.CrossEntropyLoss` 驗證。

4. 撰寫一個函式，輸入對數機率清單，並回傳最可能的序列、總對數機率，以及等價的原始機率。使用 50 個詞、每個詞機率皆為 0.01 的句子測試。

## Key Terms｜重要詞彙

| 詞彙 | 一般說法 | 實際意義 |
|------|----------------|----------------------|
| 樣本空間 |「所有可能性」| 實驗中所有可能結果所組成的集合 S。 |
| PMF |「機率函式」| 為每個離散結果提供確切機率的函式，所有機率加總為 1。 |
| PDF |「機率曲線」| 連續變數的密度函式。對一段區間積分即可取得機率。 |
| 條件機率 |「已知某事發生時的機率」| P(A\|B) = P(A and B) / P(B)，是貝氏思維和貝氏定理的基礎。 |
| 獨立性 |「彼此不影響」| P(A and B) = P(A) * P(B)。知道一個事件是否發生，對另一個事件毫無幫助。 |
| 期望值 |「平均值」| 所有結果依機率加權後的總和。損失函式就是一種期望值。 |
| 變異數 |「分散程度」| 與平均值差的平方之期望值。變異數高代表估計雜訊多、不穩定。 |
| 常態分布 |「鐘形曲線」| f(x) = (1/sqrt(2*pi*sigma^2)) * exp(-(x-mu)^2/(2*sigma^2))。由於中央極限定理而普遍出現。 |
| 中央極限定理 |「平均值會趨近常態分布」| 無論原始分布為何，許多獨立樣本的平均值都會趨近常態分布。 |
| 聯合分布 |「兩個變數一起看」| P(X, Y) 描述 X 和 Y 各種結果組合的機率。 |
| 邊際分布 |「把另一個變數加總掉」| P(X) = sum_y P(X, Y)，可從聯合分布還原單一變數的分布。 |
| 對數機率 |「機率的對數」| log P(x)。能將乘積轉為總和，避免長序列發生數值下溢。 |
| Softmax |「將分數轉成機率」| softmax(z_i) = exp(z_i) / sum(exp(z_j))，將實數 logits 映射成有效機率分布。 |
| 交叉熵 |「損失函式」| -sum(p_true * log(p_predicted))，衡量兩個分布的差異；數值越低越好。 |
| Logits |「模型原始輸出」| Softmax 轉換前尚未正規化的分數，名稱源自 logistic 函式。 |
| 取樣 |「抽取隨機值」| 根據機率分布產生數值，是模型生成輸出的方式。 |

## 延伸閱讀

- [3Blue1Brown：中央極限定理到底是什麼？](https://www.youtube.com/watch?v=zeJD6dqJ5lo) — 以視覺方式說明平均值為何會趨近常態分布
- [Stanford CS229 機率複習](https://cs229.stanford.edu/section/cs229-prob.pdf) — 涵蓋本課程內容及延伸主題的精簡參考資料
- [Log-Sum-Exp 技巧](https://gregorygundersen.com/blog/2020/02/09/log-sum-exp/) — 說明數值穩定性的重要性及實作方式
