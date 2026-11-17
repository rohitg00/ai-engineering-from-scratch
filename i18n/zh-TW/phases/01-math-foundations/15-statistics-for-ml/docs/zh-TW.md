# 機器學習統計學

> 統計學能幫你判斷模型是真的有效，還是只是剛好走運。

**Type:** Build
**Language:** Python
**Prerequisites:** Phase 1, Lessons 06 (Probability and Distributions), 07 (Bayes' Theorem)
**Time:** ~120 minutes

## Learning Objectives｜學習目標

- 從零計算描述統計（descriptive statistics）、皮爾森相關係數（Pearson correlation）／斯皮爾曼等級相關係數（Spearman rank correlation）和共變異數矩陣（covariance matrix）
- 執行假設檢定（hypothesis tests；t-test、chi-squared test），並正確解讀 p 值（p-value）與信賴區間（confidence interval）
- 使用 bootstrap 重抽樣（bootstrap resampling），為任何指標建立信賴區間，不受分布假設限制
- 使用效果量（effect size）指標，區分統計顯著性（statistical significance）和實務顯著性（practical significance）

## The Problem｜問題

你訓練了兩個模型。模型 A 在測試集的分數是 0.87，模型 B 是 0.89。你部署了模型 B。三週後，正式環境的指標反而比之前差。發生了什麼事？

模型 B 實際上並沒有勝過模型 A。0.02 的差異只是雜訊。你的測試集太小、變異數（variance）太大，或兩者都有。你把隨機波動包裝成進步，然後真的上線了。

這種事不斷發生：Kaggle 排行榜大洗牌、論文結果無法重現、A/B 測試只用幾百個樣本就宣布勝出。根本原因總是一樣：有人跳過了統計學。

統計學提供工具，讓你分辨訊號和雜訊。它告訴你差異是否真實、應該有多大信心，以及在相信結果之前需要多少資料。每條 ML 管線（pipeline）、每次模型比較、每個實驗都需要統計學；沒有它，你只是在猜。

## The Concept｜核心概念

### 描述統計：摘要資料

開始建模之前，你要先了解資料的樣貌。描述統計（descriptive statistics）會用幾個數字濃縮資料集，呈現它的分布形狀。

**集中趨勢指標（measures of central tendency）**回答「中間值在哪裡？」

```
Mean:   sum of all values / count
        mu = (1/n) * sum(x_i)

Median: middle value when sorted
        Robust to outliers. If you have [1, 2, 3, 4, 1000], the mean is 202
        but the median is 3.

Mode:   most frequent value
        Useful for categorical data. For continuous data, rarely informative.
```

平均數（mean）是平衡點，中位數（median）是資料排序後的中間位置。兩者差距很大時，分布會偏斜（skewed distribution）。收入分布的平均數遠大於中位數（億萬富翁使分布右偏（right skew））；訓練期間的損失分布則常是平均數遠小於中位數（容易樣本造成左偏（left skew））。

**離散程度指標（measures of spread）**回答「資料分散得多開？」

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

**百分位數（percentile）**會把排序後的資料分成 100 個等份。第 25 百分位數（Q1）表示 25% 的值低於此點；第 50 百分位數是中位數；第 75 百分位數是 Q3。

```
For latency monitoring:
  P50 = median latency        (typical user experience)
  P95 = 95th percentile       (bad but not worst case)
  P99 = 99th percentile       (tail latency, often 10x the median)
```

在 ML 中，你會關心推論延遲的百分位數、預測信心分布，以及誤差分布。一個模型的平均誤差很低，但 P99 誤差高得離譜，可能就不適用於安全攸關的應用。

**樣本與母體統計量（sample vs population statistics）。** 計算樣本變異數（sample variance）時，分母要用 (n-1)，而不是 n。這稱為貝塞爾校正（Bessel's correction），用來補償樣本平均數（sample mean）不等於母體平均數（population mean）的情況。若分母使用 n，會系統性低估真正的母體變異數（population variance）；使用 (n-1)，估計值則是不偏的。

```
Population variance: sigma^2 = (1/N) * sum((x_i - mu)^2)
Sample variance:     s^2     = (1/(n-1)) * sum((x_i - x_bar)^2)
```

實務上，若 n 很大（數千個樣本），差異可以忽略；若 n 很小（幾十個樣本），差異就很重要。

### 相關性：變數如何一起變動

相關性衡量兩個變數之間線性關係的強度和方向。

**皮爾森相關係數（Pearson correlation coefficient）**衡量線性關聯（linear association）：

```
r = sum((x_i - x_bar)(y_i - y_bar)) / (n * s_x * s_y)

r = +1:  perfect positive linear relationship
r = -1:  perfect negative linear relationship
r =  0:  no linear relationship (but there might be a nonlinear one!)

Range: [-1, 1]
```

皮爾森相關係數假設變數之間是線性關係，而且兩個變數大致符合常態分布（normal distribution）。它容易受離群值（outlier）影響；單一極端點就可能讓 r 從 0.1 拉高到 0.9。

**斯皮爾曼等級相關係數（Spearman rank correlation）**衡量單調關聯（monotonic association）：

```
1. Replace each value with its rank (1, 2, 3, ...)
2. Compute Pearson correlation on the ranks

Spearman catches any monotonic relationship, not just linear.
If y = x^3, Pearson gives r < 1 but Spearman gives rho = 1.
```

**如何選擇：**

```
Pearson:    Both variables are continuous and roughly normal.
            You care about the linear relationship specifically.
            No extreme outliers.

Spearman:   Ordinal data (rankings, ratings).
            Data is not normally distributed.
            You suspect a monotonic but not linear relationship.
            Outliers are present.
```

**黃金法則：**相關不代表因果（correlation does not imply causation）。冰淇淋銷量和溺水死亡人數相關，是因為兩者都在夏天增加。模型準確率和參數數量也相關，但增加參數不會自動提升準確率（參見：過度擬合（overfitting））。

### 共變異數矩陣

兩個變數的共變異數（covariance）衡量它們如何一起變動：

```
Cov(X, Y) = (1/n) * sum((x_i - x_bar)(y_i - y_bar))

Cov(X, Y) > 0:  X and Y tend to increase together
Cov(X, Y) < 0:  when X increases, Y tends to decrease
Cov(X, Y) = 0:  no linear co-movement
```

若有 d 個特徵，共變異數矩陣（covariance matrix）C 就是 d x d 矩陣，其中 C[i][j] = Cov(feature_i, feature_j)。對角線元素 C[i][i] 是各特徵的變異數。

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

**與 PCA 的關係。** 主成分分析（PCA）會對共變異數矩陣做特徵分解（eigendecomposition）。特徵向量（eigenvectors）就是主成分（principal components），也就是變異最大的方向；特徵值（eigenvalues）則表示每個主成分涵蓋多少變異。第 10 課已介紹過這項方法，現在你能看出為何共變異數矩陣適合用來分解：它編碼了資料中所有成對的線性關係。

**與相關性的關係。** 相關矩陣（correlation matrix）是標準化變數（standardized variable）的共變異數矩陣（每個變數都除以自己的標準差（standard deviation））。相關性會將共變異數正規化，使所有數值都落在 [-1, 1]。

### 假設檢定

假設檢定（hypothesis testing）是一套在不確定性下做決策的架構。你先提出主張、蒐集資料，再判斷資料是否與主張一致。

**設定方式：**

```
Null hypothesis (H0):        the default assumption, usually "no effect"
Alternative hypothesis (H1): what you are trying to show

Example:
  H0: Model A and Model B have the same accuracy
  H1: Model B has higher accuracy than Model A
```

**p 值（p-value）**是在虛無假設（null hypothesis，H0）為真的前提下，觀察到目前這麼極端或更極端資料的機率。它**不是**虛無假設為真的機率。這是統計學中最常見的誤解。

```
p-value = P(data this extreme | H0 is true)

If p-value < alpha (typically 0.05):
    Reject H0. The result is "statistically significant."
If p-value >= alpha:
    Fail to reject H0. You do not have enough evidence.
    This does NOT mean H0 is true.
```

**信賴區間（confidence interval）**會為某個參數提供一段合理數值範圍：

```
95% confidence interval for the mean:
    x_bar +/- z * (s / sqrt(n))

where z = 1.96 for 95% confidence

Interpretation: if you repeated this experiment many times, 95% of the
computed intervals would contain the true mean. It does NOT mean there
is a 95% probability the true mean is in this specific interval.
```

信賴區間的寬度反映估計精度。區間越寬，不確定性越高；區間越窄，估計越精確（但如果資料有偏差，不代表估計就準確）。

### t 檢定

t 檢定（t-test）用來比較平均數，依情況有幾種形式。

**單一樣本 t 檢定（one-sample t-test）：**母體平均數是否與假設值不同？

```
t = (x_bar - mu_0) / (s / sqrt(n))

degrees of freedom = n - 1
```

**雙樣本 t 檢定（two-sample t-test；獨立樣本）：**兩組平均數是否不同？

```
t = (x_bar_1 - x_bar_2) / sqrt(s1^2/n1 + s2^2/n2)

This is Welch's t-test, which does not assume equal variances.
Always use Welch's unless you have a specific reason for equal variances.
```

**成對樣本 t 檢定（paired t-test）：**同一組測量值以配對方式取得時適用，例如同一模型在相同資料切分上評估：

```
Compute d_i = x_i - y_i for each pair
Then run a one-sample t-test on the d_i values against mu_0 = 0
```

在 ML 中，常見做法是使用成對樣本 t 檢定：讓兩個模型各自跑過相同的 10 個交叉驗證（cross-validation）折，再逐一比較分數。

### 卡方檢定

卡方檢定（chi-squared test）會檢查觀察頻數（observed frequencies）是否符合期望頻數（expected frequencies），適用於類別資料（categorical data）。

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

ML 中的 A/B 測試（A/B testing）和網頁 A/B 測試不一樣。比較模型有幾個特別需要注意的地方：

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

**執行流程：**

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

### 統計顯著性與實務顯著性

結果可能在統計上顯著，實務上卻毫無意義。資料量夠大時，即使微不足道的差異也會達到統計顯著。

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

**效果量**不受樣本數影響，用來量化差異有多大：

```
Cohen's d = (mean_1 - mean_2) / pooled_std

d = 0.2:  small effect
d = 0.5:  medium effect
d = 0.8:  large effect
```

務必同時回報 p 值和效果量。p 值告訴你差異是否真實；效果量則告訴你差異是否重要。

### 多重比較問題

同時檢定許多假設時，有些結果會只是碰巧「顯著」。如果以 alpha = 0.05 檢定 20 個項目，即使沒有任何真實效果，預期仍會出現 1 個偽陽性（false positive）。

```
P(at least one false positive) = 1 - (1 - alpha)^m

m = 20 tests, alpha = 0.05:
P(false positive) = 1 - 0.95^20 = 0.64

You have a 64% chance of at least one false positive.
```

**Bonferroni 校正（Bonferroni correction）：**將 alpha 除以檢定數量。

```
Adjusted alpha = alpha / m = 0.05 / 20 = 0.0025

Only reject H0 if p-value < 0.0025.
Conservative but simple. Works when tests are independent.
```

在 ML 中，如果你用多個指標比較模型、測試許多超參數（hyperparameter）組合，或在多個資料集上評估，就要考慮這個問題。

### Bootstrap 方法

bootstrap 會以有放回重抽樣（resampling with replacement）估計統計量的抽樣分布（sampling distribution），不必對底層分布做任何假設。

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

**bootstrap 信賴區間（百分位數法，percentile method）：**

```
Sort the B bootstrap statistics
95% CI = [2.5th percentile, 97.5th percentile]
```

**bootstrap 為什麼對 ML 很重要：**

```
- Test set accuracy is a point estimate. Bootstrap gives you
  confidence intervals.
- You cannot assume metric distributions are normal (especially
  for AUC, F1, precision at k).
- Bootstrap works for ANY statistic: median, ratio of two means,
  difference in AUC between two models.
- No closed-form formula needed.
```

**使用 bootstrap 比較模型：**

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

這比成對樣本 t 檢定更穩健，因為它不需要對分布做任何假設。

### 參數檢定與無母數檢定

**參數檢定（parametric tests）**假設資料符合特定分布（通常是常態分布）：

```
t-test:         assumes normally distributed data (or large n by CLT)
ANOVA:          assumes normality and equal variances
Pearson r:      assumes bivariate normality
```

**無母數檢定（non-parametric tests）**不對分布做任何假設：

```
Mann-Whitney U:     compares two groups (replaces independent t-test)
Wilcoxon signed-rank: compares paired data (replaces paired t-test)
Spearman rho:       correlation on ranks (replaces Pearson)
Kruskal-Wallis:     compares multiple groups (replaces ANOVA)
```

**適合使用無母數檢定的情況：**

```
- Small sample size (n < 30) and data is clearly non-normal
- Ordinal data (ratings, rankings)
- Heavy outliers you cannot remove
- Skewed distributions
```

**適合使用參數檢定的情況：**

```
- Large sample size (CLT makes the test statistic approximately normal)
- Data is roughly symmetric without extreme outliers
- More statistical power (better at detecting real differences)
```

ML 實驗的樣本數（sample size）通常很小（5 或 10 個交叉驗證折），因此 Wilcoxon 符號等級檢定（Wilcoxon signed-rank test）等無母數檢定，往往比 t 檢定更適合。

### 中央極限定理：實務意義

中央極限定理（central limit theorem，CLT）指出，隨著 n 增加，樣本平均數的分布會趨近常態分布，不受母體分布形狀影響。

```
If X_1, X_2, ..., X_n are iid with mean mu and variance sigma^2:

    X_bar ~ Normal(mu, sigma^2 / n)    as n -> infinity

Works for n >= 30 in most cases.
For highly skewed distributions, you might need n >= 100.
```

**這對 ML 的重要性：**

```
1. Justifies confidence intervals and t-tests on aggregated metrics
2. Explains why averaging over cross-validation folds gives stable
   estimates even when individual folds vary wildly
3. Mini-batch gradient descent works because the average gradient
   over a batch approximates the true gradient (CLT in action)
4. Ensemble methods: averaging predictions from many models gives
   more stable output than any single model
```

**中央極限定理不代表：**

```
- Does NOT make your data normal. It makes the MEAN of samples normal.
- Does NOT work for heavy-tailed distributions with infinite variance
  (Cauchy distribution).
- Does NOT apply to dependent data (time series without correction).
```

### ML 論文常見的統計錯誤

1. **用訓練集測試。** 這一定會造成過度擬合（overfitting）。務必保留模型訓練時從未看過的資料。

2. **沒有信賴區間。** 只回報一個準確率數字，卻不說明不確定性，會讓結果無法重現、也無從驗證。

3. **忽略多重比較。** 測試 50 種設定，卻不做校正就只回報最佳結果，會提高偽陽性率（false positive rate）。

4. **混淆統計顯著性與實務顯著性。** 準確率只提升 0.01%，即使 p 值是 0.001，也沒有實際意義。

5. **類別不平衡資料（imbalanced data）只看準確率。** 如果資料集有 99% 是負類，模型即使什麼都沒學到也能達到 99% 準確率。應改看精確率（precision）、召回率（recall）、F1 分數（F1 score）或 AUC。

6. **挑選對自己有利的指標。** 只回報模型勝出的指標。誠實的評估應回報所有相關指標。

7. **資料洩漏（data leakage）。** 例如切分前就做正規化，或用未來資料預測過去。

8. **測試集太小，且未估計變異。** 只用 100 個樣本評估，就宣稱提升 2%，那是雜訊，不是訊號。

9. **資料並不獨立，卻假設彼此獨立。** 例如同一位病患的醫學影像，或同一份文件中的多個句子。同一群組內的觀測值彼此相關。

10. **p-hacking。** 不斷更換檢定方法、子集或排除條件，直到 p < 0.05。這樣得到的結果只是反覆搜尋造成的假象。

## Building It｜動手實作

你將從零實作：

1. **描述統計**（平均數、中位數、眾數（mode）、標準差、百分位數、四分位距（interquartile range，IQR））
2. **相關函數**（皮爾森與斯皮爾曼，以及共變異數矩陣）
3. **假設檢定**（單一樣本 t 檢定、雙樣本 t 檢定、卡方檢定）
4. **bootstrap 信賴區間**（適用於任何統計量，不需分布假設）
5. **A/B 測試模擬器**（產生資料、執行檢定、檢查第一類錯誤（Type I error）和第二類錯誤（Type II error））
6. **統計與實務顯著性示範**（展示大樣本數如何讓任何差異都變得「顯著」）

全都從零實作，只使用 `math` 和 `random`。不使用 numpy 或 scipy。

```figure
f3-bootstrap-resample
```

## Key Terms｜關鍵術語

| 術語 | 定義 |
|---|---|
| 平均數（mean） | 所有數值的總和除以數量，容易受離群值影響。 |
| 中位數（median） | 資料排序後的中間值，對離群值穩健。 |
| 標準差（standard deviation） | 變異數的平方根，以原始資料的單位衡量分散程度。 |
| 百分位數（percentile） | 某個給定百分比的資料會低於此數值。 |
| 四分位距（interquartile range，IQR） | 四分位距是 Q3 減 Q1，呈現資料中間 50% 的分散程度。 |
| 皮爾森相關係數（Pearson correlation） | 衡量兩個變數的線性關聯，範圍為 [-1, 1]。 |
| 斯皮爾曼相關係數（Spearman correlation） | 以排名衡量單調關聯。 |
| 共變異數矩陣（covariance matrix） | 所有特徵兩兩共變異數構成的矩陣。 |
| 虛無假設（null hypothesis） | 預設沒有作用或沒有差異的假設。 |
| p 值（p-value） | 虛無假設為真時，觀察到目前這麼極端資料的機率。 |
| 信賴區間（confidence interval） | 在指定信賴水準（confidence level）下，參數可能落入的數值範圍。 |
| t 檢定（t-test） | 檢查平均數是否有顯著差異，使用 t 分布。 |
| 卡方檢定（chi-squared test） | 檢查觀察頻數與期望頻數是否不同。 |
| 效果量（effect size） | 不受樣本數影響的差異幅度指標，常用 Cohen's d。 |
| Bonferroni 校正（Bonferroni correction） | 將顯著水準除以檢定數量，以控制偽陽性。 |
| bootstrap | 以有放回重抽樣估計抽樣分布的方法。 |
| 第一類錯誤（Type I error） | 偽陽性（false positive）：虛無假設為真，卻將其拒絕。 |
| 第二類錯誤（Type II error） | 偽陰性（false negative）：虛無假設為假，卻未將其拒絕。 |
| 檢定力（statistical power） | 正確拒絕錯誤虛無假設的機率。檢定力 = 1 減去第二類錯誤率。 |
| 中央極限定理（central limit theorem） | 樣本數增加時，樣本平均數會趨近常態分布。 |
| 參數檢定（parametric test） | 假設資料符合特定分布（通常是常態分布）的檢定。 |
| 無母數檢定（non-parametric test） | 不對分布做假設，改用排名或符號檢定。 |
