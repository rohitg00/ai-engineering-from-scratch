# 機器學習的統計學

> 統計是你判斷模型到底真的有效、還是只是運氣好的方法。

**類型：** 實作
**程式語言：** Python
**先修單元：** 階段 1 · 06（機率與分布）、07（貝氏定理）
**時間：** 約 120 分鐘

## 學習目標

- 從零計算描述統計、Pearson／Spearman 相關以及共變異數矩陣
- 執行假設檢定（t 檢定、卡方檢定），並正確解讀 p 值與信賴區間
- 用自助法（bootstrap）重抽樣為任何指標建出信賴區間，不需要任何分布假設
- 用效應量的度量區分統計顯著性與實務顯著性

## 問題所在

你訓練了兩個模型。模型 A 在測試集上拿到 0.87，模型 B 拿到 0.89。你部署了模型 B。三週後，線上的指標比原本更差。發生了什麼事？

模型 B 其實並沒有贏過模型 A。那 0.02 的差距只是雜訊。你的測試集太小，或是變異數太大，或兩者都有。你把隨機性包裝成改進，然後就上線了。

這種事天天在發生。Kaggle 排行榜的大洗牌、重現不出來的論文、只靠幾百個樣本就宣布贏家的 A/B 測試。根本原因永遠是同一個：有人跳過了統計。

統計給你把訊號從雜訊裡分出來的工具。它告訴你什麼時候一個差異是真的、你該有多少信心，以及在你能相信一個結果之前需要多少資料。每一條 ML 流水線、每一次模型比較、每一個實驗都需要統計。沒有它，你只是在猜。

## 核心概念

### 描述統計：摘要你的資料

在你動手建模之前，你得先知道自己的資料長什麼樣子。描述統計把一整份資料集壓縮成幾個能刻畫它形狀的數字。

**集中趨勢的度量**回答「中間在哪裡？」

```
Mean:   sum of all values / count
        mu = (1/n) * sum(x_i)

Median: middle value when sorted
        Robust to outliers. If you have [1, 2, 3, 4, 1000], the mean is 202
        but the median is 3.

Mode:   most frequent value
        Useful for categorical data. For continuous data, rarely informative.
```

平均數是平衡點，中位數是正中間的分界。當兩者分道揚鑣時，你的分布就是偏斜的。所得分布的 mean >> median（億萬富翁造成的右偏）。訓練過程中的損失分布常常 mean << median（簡單樣本造成的左偏）。

**離散程度的度量**回答「資料散得有多開？」

```
Variance:   average squared deviation from the mean
            sigma^2 = (1/n) * sum((x_i - mu)^2)

Standard deviation:  square root of variance
                     sigma = sqrt(sigma^2)
                     Same units as the data, so more interpretable.

Range:      max - min
            Sensitive to outliers. Almost never useful alone.

IQR:        Q3 - Q1 (interquartile range)
            The range of the middle 50% of the data.
            Robust to outliers. Used for box plots and outlier detection.
```

**百分位數**把排序後的資料切成 100 等分。第 25 百分位數（Q1）代表有 25% 的值落在這個點以下。第 50 百分位數就是中位數。第 75 百分位數是 Q3。

```
For latency monitoring:
  P50 = median latency        (typical user experience)
  P95 = 95th percentile       (bad but not worst case)
  P99 = 99th percentile       (tail latency, often 10x the median)
```

在 ML 裡，你會為了推論延遲、預測信心的分布，以及理解誤差分布而在意百分位數。一個平均誤差很低、但 P99 誤差糟糕的模型，在安全關鍵的應用上可能完全不能用。

**樣本統計 vs 母體統計。** 從樣本計算變異數時，要除以 (n-1) 而不是 n。這叫貝塞爾校正。它補償的是「你的樣本平均數並不是真正的母體平均數」這件事。分母用 n，你會系統性地低估真正的變異數；用 (n-1)，這個估計就是無偏的。

```
Population variance: sigma^2 = (1/N) * sum((x_i - mu)^2)
Sample variance:     s^2     = (1/(n-1)) * sum((x_i - x_bar)^2)
```

實務上：n 很大時（幾千個樣本），差別微乎其微；n 很小時（幾十個樣本），就有影響了。

### 相關：變數如何一起變動

相關衡量兩個變數之間線性關係的強度與方向。

**Pearson 相關係數**衡量線性關聯：

```
r = sum((x_i - x_bar)(y_i - y_bar)) / (n * s_x * s_y)

r = +1:  perfect positive linear relationship
r = -1:  perfect negative linear relationship
r =  0:  no linear relationship (but there might be a nonlinear one!)

Range: [-1, 1]
```

Pearson 假設關係是線性的，而且兩個變數都大致呈常態分布。它對離群值很敏感——單一個極端點就能把 r 從 0.1 拉到 0.9。

**Spearman 等級相關**衡量單調關聯：

```
1. Replace each value with its rank (1, 2, 3, ...)
2. Compute Pearson correlation on the ranks

Spearman catches any monotonic relationship, not just linear.
If y = x^3, Pearson gives r < 1 but Spearman gives rho = 1.
```

**各自該用在什麼時候：**

```
Pearson:    Both variables are continuous and roughly normal.
            You care about the linear relationship specifically.
            No extreme outliers.

Spearman:   Ordinal data (rankings, ratings).
            Data is not normally distributed.
            You suspect a monotonic but not linear relationship.
            Outliers are present.
```

**黃金守則：** 相關不代表因果。冰淇淋銷量與溺水死亡人數會相關，是因為兩者在夏天都上升。你模型的準確率與參數量會相關，但加參數並不會自動讓準確率變好（參見：過度擬合）。

### 共變異數矩陣

兩個變數之間的共變異數衡量它們一起變動的程度：

```
Cov(X, Y) = (1/n) * sum((x_i - x_bar)(y_i - y_bar))

Cov(X, Y) > 0:  X and Y tend to increase together
Cov(X, Y) < 0:  when X increases, Y tends to decrease
Cov(X, Y) = 0:  no linear co-movement
```

對 d 個特徵來說，共變異數矩陣 C 是一個 d x d 的矩陣，其中 C[i][j] = Cov(feature_i, feature_j)。對角線上的 C[i][i] 就是每個特徵的變異數。

```
C = | Var(x1)      Cov(x1,x2)  Cov(x1,x3) |
    | Cov(x2,x1)  Var(x2)      Cov(x2,x3) |
    | Cov(x3,x1)  Cov(x3,x2)  Var(x3)     |

Properties:
  - Symmetric: C[i][j] = C[j][i]
  - Positive semi-definite: all eigenvalues >= 0
  - Diagonal = variances
  - Off-diagonal = covariances
```

**與 PCA 的關聯。** PCA 就是對共變異數矩陣做特徵分解。特徵向量是主成分（變異數最大的方向），特徵值告訴你每個成分捕捉了多少變異數。這正是單元 10 講過的內容，但現在你看得出為什麼共變異數矩陣才是該被分解的那個東西：它編碼了資料裡所有成對的線性關係。

**與相關的關聯。** 相關矩陣就是標準化變數（每個都除以自己的標準差）的共變異數矩陣。相關把共變異數正規化，讓所有值都落在 [-1, 1] 之間。

### 假設檢定

假設檢定是一套在不確定性下做決定的框架。你先提出一個主張，收集資料，然後判斷資料是否與這個主張相容。

**基本設定：**

```
Null hypothesis (H0):        the default assumption, usually "no effect"
Alternative hypothesis (H1): what you are trying to show

Example:
  H0: Model A and Model B have the same accuracy
  H1: Model B has higher accuracy than Model A
```

**p 值**是「假設 H0 為真」的前提下，看到跟你觀察到的一樣極端的資料的機率。它不是 H0 為真的機率。這是統計裡最常見的單一誤解。

```
p-value = P(data this extreme | H0 is true)

If p-value < alpha (typically 0.05):
    Reject H0. The result is "statistically significant."
If p-value >= alpha:
    Fail to reject H0. You do not have enough evidence.
    This does NOT mean H0 is true.
```

**信賴區間**給出一個參數合理取值的範圍：

```
95% confidence interval for the mean:
    x_bar +/- z * (s / sqrt(n))

where z = 1.96 for 95% confidence

Interpretation: if you repeated this experiment many times, 95% of the
computed intervals would contain the true mean. It does NOT mean there
is a 95% probability the true mean is in this specific interval.
```

信賴區間的寬度告訴你精密度。區間寬代表不確定性高；區間窄代表你的估計很精密（但如果資料本身有偏誤，就不一定準確）。

### t 檢定

t 檢定比較的是平均數。它有好幾種變體。

**單樣本 t 檢定：** 母體平均數是否與某個假設值不同？

```
t = (x_bar - mu_0) / (s / sqrt(n))

degrees of freedom = n - 1
```

**雙樣本 t 檢定（獨立）：** 兩組的平均數是否不同？

```
t = (x_bar_1 - x_bar_2) / sqrt(s1^2/n1 + s2^2/n2)

This is Welch's t-test, which does not assume equal variances.
Always use Welch's unless you have a specific reason for equal variances.
```

**成對 t 檢定：** 當測量是成對出現時（同一個模型在同樣的資料切分上評估）：

```
Compute d_i = x_i - y_i for each pair
Then run a one-sample t-test on the d_i values against mu_0 = 0
```

在 ML 裡成對 t 檢定很常見：你把兩個模型跑在同樣的 10 個交叉驗證折上，然後成對比較它們的分數。

### 卡方檢定

卡方檢定檢查觀察到的次數是否符合期望的次數。對類別資料很有用。

```
chi^2 = sum((observed - expected)^2 / expected)

Example: does a language model's output distribution match the
training distribution across categories?

Category    Observed   Expected
Positive       120        100
Negative        80        100
chi^2 = (120-100)^2/100 + (80-100)^2/100 = 4 + 4 = 8

With 1 degree of freedom, chi^2 = 8 gives p < 0.005.
The difference is significant.
```

### ML 模型的 A/B 測試

ML 裡的 A/B 測試跟網站的 A/B 測試不一樣。模型比較有它特有的難題：

```
1. Same test set:    Both models must be evaluated on identical data.
                     Different test sets make comparison meaningless.

2. Multiple metrics: Accuracy alone is not enough. You need precision,
                     recall, F1, latency, and fairness metrics.

3. Variance:         Use cross-validation or bootstrap to estimate
                     the variance of each metric, not just point estimates.

4. Data leakage:     If the test set was used during model selection,
                     your comparison is biased. Hold out a final test set.
```

**做法：**

```
1. Define your metric and significance level (alpha = 0.05)
2. Run both models on the same k-fold cross-validation splits
3. Collect paired scores: [(a1, b1), (a2, b2), ..., (ak, bk)]
4. Compute differences: d_i = b_i - a_i
5. Run a paired t-test on the differences
6. Check: is the mean difference significantly different from 0?
7. Compute a confidence interval for the mean difference
8. Compute effect size (Cohen's d) to judge practical significance
```

### 統計顯著性 vs 實務顯著性

一個結果可以在統計上顯著，卻在實務上毫無意義。資料一多，連微不足道的差異都會變成統計顯著。

```
Example:
  Model A accuracy: 0.9234
  Model B accuracy: 0.9237
  n = 1,000,000 test samples
  p-value = 0.001

Statistically significant? Yes.
Practically significant? A 0.03% improvement is not worth the
engineering cost of deploying a new model.
```

**效應量**量化這個差異有多大，而且不受樣本大小影響：

```
Cohen's d = (mean_1 - mean_2) / pooled_std

d = 0.2:  small effect
d = 0.5:  medium effect
d = 0.8:  large effect
```

永遠同時報告 p 值與效應量。p 值告訴你這個差異是不是真的，效應量告訴你它重不重要。

### 多重比較問題

當你檢定很多個假設時，總會有一些純靠運氣就變得「顯著」。如果你在 alpha = 0.05 下檢定 20 件事，就算什麼都不是真的，你也預期會出現 1 個偽陽性。

```
P(at least one false positive) = 1 - (1 - alpha)^m

m = 20 tests, alpha = 0.05:
P(false positive) = 1 - 0.95^20 = 0.64

You have a 64% chance of at least one false positive.
```

**Bonferroni 校正：** 把 alpha 除以檢定的次數。

```
Adjusted alpha = alpha / m = 0.05 / 20 = 0.0025

Only reject H0 if p-value < 0.0025.
Conservative but simple. Works when tests are independent.
```

在 ML 裡，當你拿一個模型跨多個指標比較、測試很多組超參數，或在多個資料集上評估時，這件事就很重要。

### 自助法（bootstrap）

自助法透過對你的資料做可重複抽取的重抽樣，來估計某個統計量的抽樣分布。完全不需要對背後的分布做任何假設。

**演算法：**

```
1. You have n data points
2. Draw n samples WITH replacement (some points appear multiple times,
   some not at all)
3. Compute your statistic on this bootstrap sample
4. Repeat B times (typically B = 1000 to 10000)
5. The distribution of bootstrap statistics approximates the
   sampling distribution
```

**自助法信賴區間（百分位法）：**

```
Sort the B bootstrap statistics
95% CI = [2.5th percentile, 97.5th percentile]
```

**為什麼自助法對 ML 很重要：**

```
- Test set accuracy is a point estimate. Bootstrap gives you
  confidence intervals.
- You cannot assume metric distributions are normal (especially
  for AUC, F1, precision at k).
- Bootstrap works for ANY statistic: median, ratio of two means,
  difference in AUC between two models.
- No closed-form formula needed.
```

**用自助法比較模型：**

```
1. You have predictions from Model A and Model B on the same test set
2. For each bootstrap iteration:
   a. Resample test indices with replacement
   b. Compute metric_A and metric_B on the resampled set
   c. Store diff = metric_B - metric_A
3. 95% CI for the difference:
   [2.5th percentile of diffs, 97.5th percentile of diffs]
4. If the CI does not contain 0, the difference is significant
```

這比成對 t 檢定更穩健，因為它不做任何分布假設。

### 參數檢定 vs 非參數檢定

**參數檢定**假設一個特定的分布（通常是常態）：

```
t-test:         assumes normally distributed data (or large n by CLT)
ANOVA:          assumes normality and equal variances
Pearson r:      assumes bivariate normality
```

**非參數檢定**不做任何分布假設：

```
Mann-Whitney U:     compares two groups (replaces independent t-test)
Wilcoxon signed-rank: compares paired data (replaces paired t-test)
Spearman rho:       correlation on ranks (replaces Pearson)
Kruskal-Wallis:     compares multiple groups (replaces ANOVA)
```

**什麼時候用非參數：**

```
- Small sample size (n < 30) and data is clearly non-normal
- Ordinal data (ratings, rankings)
- Heavy outliers you cannot remove
- Skewed distributions
```

**什麼時候用參數：**

```
- Large sample size (CLT makes the test statistic approximately normal)
- Data is roughly symmetric without extreme outliers
- More statistical power (better at detecting real differences)
```

在 ML 實驗裡，你的 n 通常很小（5 或 10 個交叉驗證折），所以像 Wilcoxon signed-rank 這種非參數檢定，往往比 t 檢定更合適。

### 中央極限定理：實務上的意義

CLT 說的是：隨著 n 變大，樣本平均數的分布會趨近常態分布，跟背後的母體分布是什麼無關。

```
If X_1, X_2, ..., X_n are iid with mean mu and variance sigma^2:

    X_bar ~ Normal(mu, sigma^2 / n)    as n -> infinity

Works for n >= 30 in most cases.
For highly skewed distributions, you might need n >= 100.
```

**為什麼這對 ML 很重要：**

```
1. Justifies confidence intervals and t-tests on aggregated metrics
2. Explains why averaging over cross-validation folds gives stable
   estimates even when individual folds vary wildly
3. Mini-batch gradient descent works because the average gradient
   over a batch approximates the true gradient (CLT in action)
4. Ensemble methods: averaging predictions from many models gives
   more stable output than any single model
```

**CLT 不會做的事：**

```
- Does NOT make your data normal. It makes the MEAN of samples normal.
- Does NOT work for heavy-tailed distributions with infinite variance
  (Cauchy distribution).
- Does NOT apply to dependent data (time series without correction).
```

### ML 論文裡常見的統計錯誤

1. **在訓練集上測試。** 保證過度擬合。永遠保留一份模型在訓練期間從沒見過的資料。

2. **沒有信賴區間。** 只報一個準確率數字、不給不確定性，結果既無法重現也無法查核。

3. **忽略多重比較。** 測了 50 組設定、卻不做校正就只報最好的那個，會把偽陽性率吹起來。

4. **搞混統計顯著性與實務顯著性。** 一個 0.01% 的準確率改進配上 p = 0.001，沒有任何意義。

5. **在不平衡的資料上看準確率。** 在 99% 都是負類的資料集上拿到 99% 準確率，代表模型什麼都沒學到。要用精確率、召回率、F1 或 AUC。

6. **挑好看的指標報。** 只報你的模型贏的那個指標。誠實的評估會報出所有相關的指標。

7. **在訓練／測試切分之間洩漏資訊。** 先正規化再切分，或用未來的資料去預測過去。

8. **測試集很小又不估變異數。** 在 100 個樣本上評估、然後宣稱 2% 的改進，那是雜訊，不是訊號。

9. **資料其實不獨立卻假設獨立。** 同一位病患的多張醫療影像、同一份文件裡的多個句子。同一組內的觀測值是相關的。

10. **P-hacking。** 換不同的檢定、不同的子集、不同的排除標準，直到 p < 0.05。那個結果只是搜尋過程的產物。

## 動手實作

你將會實作：

1. **從零實作描述統計**（平均數、中位數、眾數、標準差、百分位數、四分位距）
2. **相關函式**（Pearson 與 Spearman，附共變異數矩陣）
3. **假設檢定**（單樣本 t 檢定、雙樣本 t 檢定、卡方檢定）
4. **自助法信賴區間**（適用任何統計量，不需任何假設）
5. **A/B 測試模擬器**（產生資料、檢定、檢查第一型與第二型錯誤）
6. **統計 vs 實務顯著性的示範**（展示 n 一大，什麼都會變得「顯著」）

全部從零打造，只用 `math` 與 `random`。不用 numpy，不用 scipy。

## 關鍵術語

| 術語 | 定義 |
|---|---|
| 平均數 | 所有值的總和除以個數。對離群值敏感。 |
| 中位數 | 排序後位於正中間的值。對離群值穩健。 |
| 標準差 | 變異數的平方根。以原始單位衡量離散程度。 |
| 百分位數 | 有指定百分比的資料落在這個值以下。 |
| IQR | 四分位距。Q3 減 Q1。中間 50% 資料的散布範圍。 |
| Pearson 相關 | 衡量兩個變數之間的線性關聯。範圍 [-1, 1]。 |
| Spearman 相關 | 用等級衡量單調關聯。 |
| 共變異數矩陣 | 所有特徵之間成對共變異數所組成的矩陣。 |
| 虛無假設 | 預設「沒有效果」或「沒有差異」的假設。 |
| p 值 | 在虛無假設為真的前提下，出現這麼極端資料的機率。 |
| 信賴區間 | 在給定信賴水準下，某個參數合理取值的範圍。 |
| t 檢定 | 檢定平均數是否有顯著差異。使用 t 分布。 |
| 卡方檢定 | 檢定觀察次數是否與期望次數不同。 |
| 效應量 | 差異的大小，不受樣本大小影響。Cohen's d 最常用。 |
| Bonferroni 校正 | 把顯著性門檻除以檢定次數，以控制偽陽性。 |
| 自助法（bootstrap） | 可重複抽取的重抽樣，用來估計抽樣分布。 |
| 第一型錯誤 | 偽陽性。H0 為真時卻拒絕了它。 |
| 第二型錯誤 | 偽陰性。H0 為假時卻沒能拒絕它。 |
| 統計檢定力 | 正確拒絕一個錯誤 H0 的機率。檢定力 = 1 減去第二型錯誤率。 |
| 中央極限定理 | 隨著樣本數變大，樣本平均數會收斂到常態分布。 |
| 參數檢定 | 假設資料服從某個特定分布（通常是常態）。 |
| 非參數檢定 | 不做分布假設。作用在等級或正負號上。 |
