# Thống kê về học máy

> Thống kê là cách bạn biết liệu mô hình của bạn thực sự hoạt động hay chỉ là may mắn.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 06 (Probability and Distributions), 07 (Bayes' Theorem)
**Time:** ~120 minutes

## Mục tiêu học tập

- Xét số liệu mô tả, tương quan Pearson/Spearman và các matrix tính biến từ đầu
- Thực hiện các thử nghiệm giả thuyết (t-test, chi-quad) và giải thích đúng các giá trị p và khoảng thời gian tin cậy
- Sử dụng bootstrap resampling để xây dựng khoảng thời gian tin cậy cho bất kỳ metric nào mà không có giả định phân phối
- Hóa ra sự quan trọng thống kê từ sự quan trọng thực tế bằng cách sử dụng các biện pháp kích thước hiệu ứng

## Vấn đề

Bạn đã đào tạo hai mô hình. mô hình A đạt điểm 0,87 trong bộ thử nghiệm của bạn. mô hình B đạt điểm 0,89. Bạn triển khai mô hình B. Ba tuần sau, các chỉ số sản xuất tồi tệ hơn trước.

Mô hình B không thực sự vượt trội hơn mô hình A. Sự khác biệt 0,02 là tiếng ồn. Mẫu thử nghiệm của bạn quá nhỏ, hoặc sự khác biệt quá cao, hoặc cả hai. Bạn đã gửi sự ngẫu nhiên mặc trang phục như cải tiến.

Điều này xảy ra liên tục. Chuyển đổi bảng xếp hạng của Kaggle. Các bài báo không thể tái tạo. Các bài kiểm tra A / B tuyên bố người chiến thắng dựa trên vài trăm mẫu. Nguyên nhân gốc luôn giống nhau: ai đó bỏ qua số liệu thống kê.

Thống kê cho bạn những công cụ để phân biệt tín hiệu từ tiếng ồn. Nó cho bạn biết khi nào sự khác biệt là thực, bạn nên tự tin đến mức nào, và bạn cần bao nhiêu dữ liệu trước khi bạn có thể tin vào kết quả. Mỗi đường ống dẫn ML, mỗi so sánh mô hình, mỗi thí nghiệm cần thống kê. Nếu không có nó, bạn đang đoán.

## Khái niệm

### Số liệu thống kê mô tả: Kết luận dữ liệu của bạn

Trước khi bạn mô hình bất cứ thứ gì, bạn cần phải biết dữ liệu của bạn trông như thế nào.

**Measures of central tendency**trả lời "nhiều ở giữa đâu?"

```
Mean:   sum of all values / count
        mu = (1/n) * sum(x_i)

Median: middle value when sorted
        Robust to outliers. If you have [1, 2, 3, 4, 1000], the mean is 202
        but the median is 3.

Mode:   most frequent value
        Useful for categorical data. For continuous data, rarely informative.
```

Trung bình là điểm cân bằng. trung bình là dấu hiệu nửa đường. Khi chúng khác nhau, phân phối của bạn bị lệch.$\text{mean} \gg \text{median}$(trái bên phải từ tỷ phú).$\text{mean} \ll \text{median}$(đánh khốn bên trái từ các mẫu đơn giản).

**Measures of spread**trả lời "dữ liệu phân tán như thế nào?"

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

**Percentiles**chia dữ liệu được sắp xếp thành 100 phần bình đẳng. phần trăm 25 (Q1) có nghĩa là 25% giá trị rơi xuống dưới điểm này. phần trăm 50 là trung bình. phần trăm 75 là Q3.

```
For latency monitoring:
  P50 = median latency        (typical user experience)
  P95 = 95th percentile       (bad but not worst case)
  P99 = 99th percentile       (tail latency, often 10x the median)
```

Trong ML, bạn quan tâm đến phần trăm cho độ trễ suy luận, phân phối sự tin cậy dự đoán và phân phối lỗi hiểu. Một mô hình với lỗi trung bình thấp nhưng lỗi P99 khủng khiếp có thể vô dụng cho các ứng dụng quan trọng về an toàn.

**Sample vs population statistics.**Khi tính toán sự khác biệt từ một mẫu, chia bằng $(n-1)$thay vì $n$Đây là sự sửa đổi của Bessel. nó bù đắp cho thực tế là trung bình mẫu của bạn không phải là trung bình dân số thực sự.$n$trong nhân tố, bạn có hệ thống đánh giá thấp sự khác biệt thực sự.$(n-1)$, ước tính là không thiên vị.

```math
\begin{aligned}
\text{Population variance:} \quad \sigma^2 &= \frac{1}{N} \sum (x_i - \mu)^2 \\
\text{Sample variance:} \quad s^2 &= \frac{1}{n-1} \sum (x_i - \bar{x})^2
\end{aligned}
```

Trong thực tế: nếu $n$là lớn (người mẫu hàng ngàn), sự khác biệt là vô cùng nhỏ.$n$là nhỏ (chỉ hàng chục mẫu), nó quan trọng.

### Sự tương quan: Cách các biến chuyển cùng nhau

Sự tương quan đo lường sức mạnh và hướng của mối quan hệ tuyến tính giữa hai biến.

**Pearson correlation coefficient**Các biện pháp liên kết tuyến tính:

```
r = sum((x_i - x_bar)(y_i - y_bar)) / (n * s_x * s_y)

r = +1:  perfect positive linear relationship
r = -1:  perfect negative linear relationship
r =  0:  no linear relationship (but there might be a nonlinear one!)

Range: [-1, 1]
```

Pearson cho rằng mối quan hệ là tuyến tính và cả hai biến đều được phân phối bình thường.$r$từ 0,1 đến 0,9.

**Spearman rank correlation**Các biện pháp liên kết đơn giản:

```
1. Replace each value with its rank (1, 2, 3, ...)
2. Compute Pearson correlation on the ranks

Spearman catches any monotonic relationship, not just linear.
If y = x^3, Pearson gives r < 1 but Spearman gives rho = 1.
```

**When to use each:**

```
Pearson:    Both variables are continuous and roughly normal.
            You care about the linear relationship specifically.
            No extreme outliers.

Spearman:   Ordinal data (rankings, ratings).
            Data is not normally distributed.
            You suspect a monotonic but not linear relationship.
            Outliers are present.
```

**The golden rule:**sự tương quan không có nghĩa là sự gây nguyên nhân. bán kem và tử vong chết đuối có liên quan bởi vì cả hai đều tăng vào mùa hè. Độ chính xác của mô hình và số lượng các tham số của bạn có liên quan, nhưng việc thêm các tham số không tự động cải thiện độ chính xác (xem: Overfitting).

### Matrix tính hợp tác

Sự đồng biến giữa hai biến đo lường cách chúng thay đổi với nhau:

```
Cov(X, Y) = (1/n) * sum((x_i - x_bar)(y_i - y_bar))

Cov(X, Y) > 0:  X and Y tend to increase together
Cov(X, Y) < 0:  when X increases, Y tends to decrease
Cov(X, Y) = 0:  no linear co-movement
```

Vì $d$các tính năng, các matrix covariance $C$là một $d \times d$Matrix nơi $C[i][j] = \mathop{\mathrm{Cov}}(\text{feature}_i, \text{feature}_j)$Các mục đường chọc $C[i][i]$là sự khác biệt của mỗi tính năng.

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

**Connection to PCA.**PCA tự cấu thành các matrix có sự biến đổi. Các eigenvector là các thành phần chính (nghĩa của sự biến đổi tối đa). Các eigenvalue cho bạn biết mỗi thành phần nắm bắt được sự biến đổi bao nhiêu. Đây chính xác là điều mà Bài học 10 đã đề cập đến, nhưng bây giờ bạn thấy tại sao matrix có sự biến đổi là điều đúng để phân hủy: nó mã hóa tất cả các mối quan hệ tuyến tính theo cặp trong dữ liệu của bạn.

**Connection to correlation.**Matrix tương quan là matrix covariance của các biến tiêu chuẩn hóa (mỗi biến được chia bằng lệch tiêu chuẩn của nó).$[-1, 1]$- Tôi không biết.

### Kiểm tra giả thuyết

Kiểm tra giả thuyết là một khuôn khổ để đưa ra quyết định trong tình trạng không chắc chắn. Bạn bắt đầu với một yêu cầu, thu thập dữ liệu và xác định liệu dữ liệu có phù hợp với yêu cầu không.

**The setup:**

```
Null hypothesis (H0):        the default assumption, usually "no effect"
Alternative hypothesis (H1): what you are trying to show

Example:
  H0: Model A and Model B have the same accuracy
  H1: Model B has higher accuracy than Model A
```

**The p-value**là xác suất nhìn thấy dữ liệu cực đoan như những gì bạn quan sát, giả sử H0 là đúng.

```
p-value = P(data this extreme | H0 is true)

If p-value < alpha (typically 0.05):
    Reject H0. The result is "statistically significant."
If p-value >= alpha:
    Fail to reject H0. You do not have enough evidence.
    This does NOT mean H0 is true.
```

**Confidence intervals**Đưa ra một phạm vi các giá trị hợp lý cho một tham số:

```
95% confidence interval for the mean:
    x_bar +/- z * (s / sqrt(n))

where z = 1.96 for 95% confidence

Interpretation: if you repeated this experiment many times, 95% of the
computed intervals would contain the true mean. It does NOT mean there
is a 95% probability the true mean is in this specific interval.
```

Độ rộng của khoảng thời gian tin cậy cho bạn biết về độ chính xác. khoảng thời gian rộng có nghĩa là sự không chắc chắn cao. khoảng thời gian hẹp có nghĩa là ước tính của bạn là chính xác (nhưng không nhất thiết phải chính xác, nếu dữ liệu của bạn bị thiên vị).

### Thử nghiệm t

Thử nghiệm t so sánh các phương tiện.

**One-sample t-test:**liệu con số trung bình dân số có khác với giá trị giả định không?

```math
\begin{aligned}
t &= \frac{\bar{x} - \mu_0}{s / \sqrt{n}} \\[4pt]
\text{degrees of freedom} &= n - 1
\end{aligned}
```

**Two-sample t-test (independent):**hai nhóm có nghĩa khác nhau không?

```
t = (x_bar_1 - x_bar_2) / sqrt(s1^2/n1 + s2^2/n2)

This is Welch's t-test, which does not assume equal variances.
Always use Welch's unless you have a specific reason for equal variances.
```

**Paired t-test:**khi các phép đo được thực hiện bằng cặp (một mô hình được đánh giá trên cùng một phân chia dữ liệu):

```
Compute d_i = x_i - y_i for each pair
Then run a one-sample t-test on the d_i values against mu_0 = 0
```

Trong ML, thử nghiệm t cặp là phổ biến: bạn chạy cả hai mô hình trên cùng 10 gấp hợp xác nhận chéo và so sánh điểm số của chúng theo cặp.

### Kiểm tra hình vuông

Kiểm tra chi-quad kiểm tra xem tần số quan sát được phù hợp với tần số dự kiến.

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

### Kiểm tra A/B cho các mô hình ML

A/B testing trong ML không giống như A/B testing trên web.

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

**The procedure:**

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

### Tầm quan trọng thống kê so với tầm quan trọng thực tế

Kết quả có thể có ý nghĩa thống kê nhưng thực tế là vô nghĩa.

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

**Effect size**định lượng sự khác biệt lớn như thế nào, độc lập với kích thước mẫu:

```math
\begin{aligned}
\text{Cohen's } d &= \frac{\text{mean}_1 - \text{mean}_2}{\text{pooled\_std}} \\[4pt]
d &= 0.2: \quad \text{small effect} \\
d &= 0.5: \quad \text{medium effect} \\
d &= 0.8: \quad \text{large effect}
\end{aligned}
```

Luôn báo cáo cả giá trị p và kích thước hiệu ứng. giá trị p cho bạn biết nếu sự khác biệt là thực.

### Vấn đề so sánh nhiều lần

Khi bạn kiểm tra nhiều giả thuyết, một số sẽ "có ý nghĩa" bởi tình cờ.$\alpha = 0.05$, bạn mong đợi 1 dương tính sai ngay cả khi không có gì là thực.

```
P(at least one false positive) = 1 - (1 - alpha)^m

m = 20 tests, alpha = 0.05:
P(false positive) = 1 - 0.95^20 = 0.64

You have a 64% chance of at least one false positive.
```

**Bonferroni correction:**chia $\alpha$bằng số lượng thử nghiệm.

```
Adjusted alpha = alpha / m = 0.05 / 20 = 0.0025

Only reject H0 if p-value < 0.0025.
Conservative but simple. Works when tests are independent.
```

Trong ML, điều này quan trọng khi bạn so sánh một mô hình trên nhiều métrics, kiểm tra nhiều cấu hình siêu tham số, hoặc đánh giá trên nhiều tập dữ liệu.

### Các phương pháp bootstrap

Bootstrapping ước tính phân bố mẫu của một số thống kê bằng cách lấy lại mẫu dữ liệu của bạn bằng cách thay thế. Không cần phải giả định về phân bố cơ bản.

**The algorithm:**

```
1. You have n data points
2. Draw n samples WITH replacement (some points appear multiple times,
   some not at all)
3. Compute your statistic on this bootstrap sample
4. Repeat B times (typically B = 1000 to 10000)
5. The distribution of bootstrap statistics approximates the
   sampling distribution
```

**Bootstrap confidence interval (percentile method):**

```
Sort the B bootstrap statistics
95% CI = [2.5th percentile, 97.5th percentile]
```

**Why bootstrap matters for ML:**

```
- Test set accuracy is a point estimate. Bootstrap gives you
  confidence intervals.
- You cannot assume metric distributions are normal (especially
  for AUC, F1, precision at k).
- Bootstrap works for ANY statistic: median, ratio of two means,
  difference in AUC between two models.
- No closed-form formula needed.
```

**Bootstrap for model comparison:**

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

Đây là mạnh hơn so với thử nghiệm t cặp bởi vì nó không đưa ra giả định phân phối.

### Các thử nghiệm tham số so với các thử nghiệm không tham số

**Parametric tests**giả định phân bố cụ thể (thường là bình thường):

```
t-test:         assumes normally distributed data (or large n by CLT)
ANOVA:          assumes normality and equal variances
Pearson r:      assumes bivariate normality
```

**Non-parametric tests**không đưa ra giả định phân phối:

```
Mann-Whitney U:     compares two groups (replaces independent t-test)
Wilcoxon signed-rank: compares paired data (replaces paired t-test)
Spearman rho:       correlation on ranks (replaces Pearson)
Kruskal-Wallis:     compares multiple groups (replaces ANOVA)
```

**When to use non-parametric:**

```
- Small sample size (n < 30) and data is clearly non-normal
- Ordinal data (ratings, rankings)
- Heavy outliers you cannot remove
- Skewed distributions
```

**When to use parametric:**

```
- Large sample size (CLT makes the test statistic approximately normal)
- Data is roughly symmetric without extreme outliers
- More statistical power (better at detecting real differences)
```

Trong các thí nghiệm ML, bạn thường có những$n$(5 hoặc 10 lần xác nhận chéo), vì vậy các thử nghiệm không tham số như Wilcoxon chữ ký thường phù hợp hơn các thử nghiệm t.

### Lý thuyết giới hạn trung tâm: Implications Practical

CLT nói rằng phân phối mẫu có thể tiếp cận với phân phối bình thường như$n$tăng trưởng, bất kể sự phân bố dân số cơ bản.

```
If X_1, X_2, ..., X_n are iid with mean mu and variance sigma^2:

    X_bar ~ Normal(mu, sigma^2 / n)    as n -> infinity

Works for n >= 30 in most cases.
For highly skewed distributions, you might need n >= 100.
```

**Why this matters for ML:**

```
1. Justifies confidence intervals and t-tests on aggregated metrics
2. Explains why averaging over cross-validation folds gives stable
   estimates even when individual folds vary wildly
3. Mini-batch gradient descent works because the average gradient
   over a batch approximates the true gradient (CLT in action)
4. Ensemble methods: averaging predictions from many models gives
   more stable output than any single model
```

**What CLT does NOT do:**

```
- Does NOT make your data normal. It makes the MEAN of samples normal.
- Does NOT work for heavy-tailed distributions with infinite variance
  (Cauchy distribution).
- Does NOT apply to dependent data (time series without correction).
```

### Những sai lầm thống kê phổ biến trong các bài báo ML

1. **Testing on the training set.**Bảo đảm quá phù hợp. Luôn giữ dữ liệu mà mô hình không thấy trong quá trình đào tạo.

2. **No confidence intervals.**Báo cáo một số chính xác duy nhất mà không có sự không chắc chắn làm cho kết quả không thể tái tạo và không thể xác minh được.

3. **Ignoring multiple comparisons.**Kiểm tra 50 cấu hình và báo cáo tốt nhất mà không cần sửa chữa làm tăng tỷ lệ dương tính sai.

4. **Confusing statistical and practical significance.**Một p-đáng giá 0,001 trên một sự cải thiện độ chính xác 0,01% không có ý nghĩa.

5. **Using accuracy on imbalanced data.**99% độ chính xác trên một tập dữ liệu với 99% lớp âm nghĩa là mô hình không học được gì.

6. **Cherry-picking metrics.**Chỉ báo số số liệu mô hình của bạn thắng.

7. **Leaking information across train/test splits.**Tiêu chuẩn hóa trước khi chia, hoặc sử dụng dữ liệu trong tương lai để dự đoán quá khứ.

8. **Small test sets with no variance estimates.**Đánh giá trên 100 mẫu và tuyên bố cải thiện 2% là tiếng ồn, không phải tín hiệu.

9. **Assuming independence when data is not independent.**Hình ảnh y tế từ cùng một bệnh nhân, nhiều câu từ cùng một tài liệu.

10. **P-hacking.**Thử thử các xét nghiệm khác nhau, các bộ phụ hoặc các tiêu chí loại trừ cho đến khi bạn có được $p < 0.05$Kết quả là một đồ tạo vật của cuộc tìm kiếm.

## Xây dựng nó

Bạn sẽ thực hiện:

1. **Descriptive statistics from scratch**(tỷ lệ trung bình, trung bình, chế độ, lệch chuẩn, phần trăm, IQR)
2. **Correlation functions**(Pearson và Spearman, với matrix tính hợp lệ)
3. **Hypothesis tests**(một mẫu thử nghiệm t, hai mẫu thử nghiệm t, thử nghiệm chi vuông)
4. **Bootstrap confidence intervals**(cho bất kỳ thống kê nào, không cần phải giả định)
5. **A/B test simulator**(tạo dữ liệu, kiểm tra, kiểm tra lỗi loại I và loại II)
6. **Statistical vs practical significance demo**(khải thị lớn đó $n$làm cho mọi thứ "có ý nghĩa")

Tất cả từ đầu, chỉ sử dụng `math`và `random`Không có người đùa, không có người đùa.

```figure
f3-bootstrap-resample
```

## Các điều khoản chính

| Term | Definition |
|---|---|
| Mean | Sum of values divided by count. Sensitive to outliers. |
| Median | Middle value of sorted data. Robust to outliers. |
| Standard deviation | Square root of variance. Measures spread in original units. |
| Percentile | Value below which a given percentage of data falls. |
| IQR | Interquartile range. Q3 minus Q1. The spread of the middle 50%. |
| Pearson correlation | Measures linear association between two variables. Range $[-1, 1]$. |
| Spearman correlation | Measures monotonic association using ranks. |
| Covariance matrix | Matrix of pairwise covariances between all features. |
| Null hypothesis | Default assumption of no effect or no difference. |
| p-value | Probability of data this extreme given the null hypothesis is true. |
| Confidence interval | Range of plausible values for a parameter at a given confidence level. |
| t-test | Tests whether means differ significantly. Uses the t-distribution. |
| Chi-squared test | Tests whether observed frequencies differ from expected frequencies. |
| Effect size | Magnitude of a difference, independent of sample size. Cohen's d is common. |
| Bonferroni correction | Divides significance threshold by number of tests to control false positives. |
| Bootstrap | Resampling with replacement to estimate sampling distributions. |
| Type I error | False positive. Rejecting H0 when it is true. |
| Type II error | False negative. Failing to reject H0 when it is false. |
| Statistical power | Probability of correctly rejecting a false H0. Power = 1 minus Type II error rate. |
| Central limit theorem | Sample means converge to a normal distribution as sample size grows. |
| Parametric test | Assumes a specific distribution for the data (usually normal). |
| Non-parametric test | Makes no distributional assumptions. Works on ranks or signs. |
