# آمار یادگیری ماشین

> آمار این است که چطور می دانید که مدل شما واقعا کار می کند یا فقط شانس آورده اید.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 06 (Probability and Distributions), 07 (Bayes' Theorem)
**Time:** ~120 minutes

## اهداف یادگیری

- آمار توصیفاتی را محاسبه کنید، ارتباط پیرسون/ اسپرمن و ماتریس های همتای از ابتدا
- آزمایش های فرضیه (ت تست، چی مربع) را انجام دهید و ارزش های p و فواصل اعتماد را به درستی تفسیر کنید
- استفاده از نمونه گیری مجدد بوترپ برای ساخت فواصل اعتماد برای هر متریک بدون فرضیه های توزیع
- تفاوت بین اهمیت آماری و اهمیت عملی با استفاده از اندازه گیری اندازه اثر

## مشکل

شما دو مدل را آموزش داده اید مدل A 0.87 در مجموعه تست شما مدل B 0.89 در نمره شما مدل B را در نظر می گیرید سه هفته بعد، معیار تولید بدتر از قبل است. چه اتفاقی افتاد؟

مدل B در واقع عملکرد مدل A را برابری نکرد. تفاوت 0.02 شور بود. مجموعه آزمایش شما خیلی کوچک بود، یا تفاوت خیلی زیاد، یا هر دو. شما تصادفی را به عنوان بهبود ارسال کردید.

این اتفاق همیشه اتفاق می افتد. تغییر در رتبه بندی. مقاله هایی که تولید نمی شوند. آزمایشات A / B که بر اساس چند صد نمونه برنده اعلام می شوند. علت اصلی همیشه یکسان است: کسی آمار را رد کرد.

آمار به شما ابزارهایی می دهد تا سیگنال را از شور تشخیص دهید. آن به شما می گوید که چه زمانی تفاوت واقعی است، چقدر باید مطمئن باشید و چه مقدار داده ای نیاز دارید تا بتوانید به نتیجه ای اعتماد کنید. هر لوله ی ML، هر مقایسه مدل، هر آزمایش نیاز به آمار دارد. بدون آن، شما حدس می زنید.

## مفهوم

### آمار توصیفگر: خلاصه اطلاعات

قبل از اینکه چیزی را مدل کنید، باید بدانید که داده های شما چگونه به نظر می رسند. آمار توصیفاتی مجموعه داده ها را به چند عدد فشرده می کند که شکل آن را ضبط می کند.

**Measures of central tendency**جواب "در وسط کجاست؟"

```
Mean:   sum of all values / count
        mu = (1/n) * sum(x_i)

Median: middle value when sorted
        Robust to outliers. If you have [1, 2, 3, 4, 1000], the mean is 202
        but the median is 3.

Mode:   most frequent value
        Useful for categorical data. For continuous data, rarely informative.
```

متوسط نقطه توازن است. متوسط نقطه نیمه راه است. وقتی آنها متمایز می شوند، توزیع شما منحرف می شود. توزیع درآمد شما دارای$\text{mean} \gg \text{median}$(در حق با اربابین منحرف) توزیع خسارت در طول آموزش اغلب$\text{mean} \ll \text{median}$(تاهل چپ از نمونه های آسان)

**Measures of spread**پاسخ "داده ها چقدر پخش شده اند؟"

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

**Percentiles**داده های مرتب شده را به 100 بخش برابر تقسیم کنید. 25 درصد (Q1) به معنای 25 درصد از ارزش ها در زیر این نقطه قرار می گیرند. 50 درصد میانگین است. 75 درصد Q3.

```
For latency monitoring:
  P50 = median latency        (typical user experience)
  P95 = 95th percentile       (bad but not worst case)
  P99 = 99th percentile       (tail latency, often 10x the median)
```

در ML، شما به درصد ها برای تاخیر نتیجه گیری، توزیع اطمینان پیش بینی و توزیع خطا درک اهمیت می دهید. یک مدل با خطای متوسط پایین اما خطای وحشتناک P99 ممکن است برای برنامه های حیاتی ایمنی بی فایده باشد.

**Sample vs population statistics.**در هنگام محاسبه تفاوت از یک نمونه، تقسیم به $(n-1)$به جای$n$اين تصحيحي باسل است که تعويض ميکنه که متوسط نمونه شما متوسط اصلي جمعیت نيست$n$در نامگذاری، شما به طور سیستماتیک تفاوت واقعی را دست کم می دهید.$(n-1)$، تخمین غیر جانبدار است

```math
\begin{aligned}
\text{Population variance:} \quad \sigma^2 &= \frac{1}{N} \sum (x_i - \mu)^2 \\
\text{Sample variance:} \quad s^2 &= \frac{1}{n-1} \sum (x_i - \bar{x})^2
\end{aligned}
```

در عمل: اگر$n$اگر تعداد نمونه ها زیاد باشد، تفاوت بسیار کم است.$n$کوچک است (دوشنها نمونه) ، مهم است.

### ارتباط: چگونه متغیرها با هم حرکت می کنند

ارتباط قدرت و جهت یک رابطه خطی بین دو متغیر را اندازه گیری می کند.

**Pearson correlation coefficient**اقدامات ارتباط خطی:

```
r = sum((x_i - x_bar)(y_i - y_bar)) / (n * s_x * s_y)

r = +1:  perfect positive linear relationship
r = -1:  perfect negative linear relationship
r =  0:  no linear relationship (but there might be a nonlinear one!)

Range: [-1, 1]
```

پیرسون فرض می کند که رابطه خطی است و هر دو متغیر تقریباً به طور طبیعی توزیع شده است.$r$از 0.1 تا 0.9

**Spearman rank correlation**اقدامات یکنواختگی:

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

**The golden rule:**ارتباط به علت وجود ندارد. فروش یخچال و مرگ و میر ناشی از غرق شدن مرتبط هستند زیرا هر دو در تابستان افزایش می یابد. دقت مدل و تعداد پارامترها مرتبط هستند، اما اضافه کردن پارامترها به طور خودکار دقت را بهبود نمی بخشد (ببینید: بیش از حد مناسب).

### ماتریکس کوویاریانس

همتای دو متغیر اندازه گیری می کند که چگونه آنها با هم متفاوت هستند:

```
Cov(X, Y) = (1/n) * sum((x_i - x_bar)(y_i - y_bar))

Cov(X, Y) > 0:  X and Y tend to increase together
Cov(X, Y) < 0:  when X increases, Y tends to decrease
Cov(X, Y) = 0:  no linear co-movement
```

برای$d$ویژگی ها، ماتریس همگرایی $C$یک$d \times d$ماتریکس که در آن$C[i][j] = \mathop{\mathrm{Cov}}(\text{feature}_i, \text{feature}_j)$. ورودی های دیگاکال$C[i][i]$تفاوت هر ویژگی است.

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

**Connection to PCA.**PCA خود ماتریس کووریانس را ترکیب می کند. خود متریها اجزای اصلی (معیار حداکثر متغیر) هستند. ارزش های خود به شما می گویند که هر متغیر چقدر متغیر را ضبط می کند. این دقیقاً چیزی است که درس 10 پوشش داده است، اما اکنون می بینید که چرا ماتریس کووریانس چیزی مناسب برای تجزیه است: آن را کدگذاری می کند تمام روابط خطی جفت در داده های شما.

**Connection to correlation.**ماتریس ارتباط ماتریس همبستگی متغیرهای استاندارد (هر کدام با انحراف استاندارد خود تقسیم می شود) است. همبستگی همبستگی را عادی می کند بنابراین تمام ارزش ها در $[-1, 1]$. .

### آزمایش فرضیه

آزمایش فرضیه یک چارچوب برای تصمیم گیری در شرایط عدم اطمینان است. شما با یک ادعا شروع می کنید، داده ها را جمع آوری می کنید و تعیین می کنید که آیا داده ها با ادعای سازگار است.

**The setup:**

```
Null hypothesis (H0):        the default assumption, usually "no effect"
Alternative hypothesis (H1): what you are trying to show

Example:
  H0: Model A and Model B have the same accuracy
  H1: Model B has higher accuracy than Model A
```

**The p-value**احتمال دیدن داده ها به اندازه آنچه مشاهده کرده اید، است، فرض کنید H0 درست است. این احتمال H0 درست نیست. این تنها رایج ترین سوء تفاهم در آمار است.

```
p-value = P(data this extreme | H0 is true)

If p-value < alpha (typically 0.05):
    Reject H0. The result is "statistically significant."
If p-value >= alpha:
    Fail to reject H0. You do not have enough evidence.
    This does NOT mean H0 is true.
```

**Confidence intervals**یک محدوده از مقادیر قابل قبول را برای یک پارامتر ارائه دهید:

```
95% confidence interval for the mean:
    x_bar +/- z * (s / sqrt(n))

where z = 1.96 for 95% confidence

Interpretation: if you repeated this experiment many times, 95% of the
computed intervals would contain the true mean. It does NOT mean there
is a 95% probability the true mean is in this specific interval.
```

عرض فاصله اطمینان به شما در مورد دقت می گوید. فواصل گسترده به معنای عدم اطمینان بالا است. فواصل باریک به معنای تخمین شما دقیق است (اما لزوما درست نیست، اگر داده های شما منحصرا باشد).

### آزمون t

آزمون t، معادلات را مقایسه می کند.

**One-sample t-test:**آیا متوسط جمعیت از یک ارزش فرضیه متفاوت است؟

```math
\begin{aligned}
t &= \frac{\bar{x} - \mu_0}{s / \sqrt{n}} \\[4pt]
\text{degrees of freedom} &= n - 1
\end{aligned}
```

**Two-sample t-test (independent):**دو گروه معنی متفاوتی دارند؟

```
t = (x_bar_1 - x_bar_2) / sqrt(s1^2/n1 + s2^2/n2)

This is Welch's t-test, which does not assume equal variances.
Always use Welch's unless you have a specific reason for equal variances.
```

**Paired t-test:**در صورتی که اندازه گیری ها در جفت ها انجام شود (مثل مدل مورد ارزیابی در برابر تقسیم داده ها):

```
Compute d_i = x_i - y_i for each pair
Then run a one-sample t-test on the d_i values against mu_0 = 0
```

در ML، آزمون t جفت رایج است: هر دو مدل را روی همان 10 طناب اعتبارسنجی متقابل اجرا می کنید و نمرات آنها را جفت مقایسه می کنید.

### آزمون چِ مربع

تست چایی مربع بررسی می کند که آیا فرکانس های مشاهده شده با فرکانس های انتظار شده مطابقت دارند. برای داده های دسته بندی مفید است.

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

### آزمایش A/B برای مدل های ML

تست A/B در ML با تست A/B وب یکسان نیست. مقایسه مدل ها چالش های خاصی دارد:

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

### اهمیت آماری در مقابل اهمیت عملی

یک نتیجه می تواند از نظر آماری قابل توجه باشد اما عملاً بی معنی است. با داده های کافی، حتی یک تفاوت معمولی از نظر آماری قابل توجه می شود.

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

**Effect size**میزان تفاوت را مستقل از اندازه نمونه مشخص می کند:

```math
\begin{aligned}
\text{Cohen's } d &= \frac{\text{mean}_1 - \text{mean}_2}{\text{pooled\_std}} \\[4pt]
d &= 0.2: \quad \text{small effect} \\
d &= 0.5: \quad \text{medium effect} \\
d &= 0.8: \quad \text{large effect}
\end{aligned}
```

همیشه هر دو p-قیمت و اندازه اثر را گزارش کنید. p-قیمت به شما می گوید که آیا تفاوت واقعی است. اندازه اثر به شما می گوید که آیا مهم است.

### مشکل مقایسه چندگانه

وقتی که فرضیه های زیادی را آزمایش می کنید، بعضی ها به طور تصادفی "مهم" خواهند بود.$\alpha = 0.05$، شما انتظار یک مثبت نادرست حتی زمانی که هیچ چیز واقعی نیست.

```
P(at least one false positive) = 1 - (1 - alpha)^m

m = 20 tests, alpha = 0.05:
P(false positive) = 1 - 0.95^20 = 0.64

You have a 64% chance of at least one false positive.
```

**Bonferroni correction:**تقسیم کنید$\alpha$با تعداد آزمایشات

```
Adjusted alpha = alpha / m = 0.05 / 20 = 0.0025

Only reject H0 if p-value < 0.0025.
Conservative but simple. Works when tests are independent.
```

در ML، این مهم است وقتی که یک مدل را در میان چندین متریک مقایسه کنید، بسیاری از پیکربندی های هیپرامیتر را آزمایش کنید یا در مجموعه داده های متعدد ارزیابی کنید.

### روش های بوتر استرپ

بوتر استریپینگ توزیع نمونه گیری یک آمار را با نمونه گیری مجدد داده های شما با جایگزینی تخمین می زند. هیچ فرضیه ای در مورد توزیع اساسی مورد نیاز نیست.

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

این قوی تر از آزمون t جفت است زیرا هیچ فرضیه توزیع ای ایجاد نمی کند.

### آزمایشات پارامتراتیک در مقابل آزمایشات غیر پارامتراتیک

**Parametric tests**فرض کنید توزیع خاصی (معمولاً طبیعی) داشته باشد:

```
t-test:         assumes normally distributed data (or large n by CLT)
ANOVA:          assumes normality and equal variances
Pearson r:      assumes bivariate normality
```

**Non-parametric tests**هیچ فرضیه توزیع ای را انجام ندهید:

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

در آزمایشات ML، شما معمولاً کوچک$n$(۵ یا ۱۰ فولد اعتبارسنجی متقاطع) ، بنابراین تست های غیر پارامترکی مانند Wilcoxon- دستخط درجه اغلب مناسب تر از تست های t هستند.

### نظریه محدودیتی مرکزی: پیامدهای عملی

CLT می گوید توزیع نمونه به طور متوسط به توزیع عادی نزدیک می شود.$n$رشد می کند، بدون توجه به توزیع اساسی جمعیت.

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

### اشتباهات آماری رایج در مقالات ML

1. **Testing on the training set.**تضمینات بیش از حد مناسب همیشه داده هایی را که مدل در طول آموزش نمی بیند نگه دارید

2. **No confidence intervals.**گزارش یک شماره دقیق بدون عدم اطمینان باعث می شود نتایج قابل تکرار و غیر قابل تأیید باشند.

3. **Ignoring multiple comparisons.**آزمایش 50 تشکيل و گزارش بهترین بدون اصلاح، نرخ مثبت دروغین را افزایش می دهد.

4. **Confusing statistical and practical significance.**یک p-قیمت 0.001 در بهبود دقت 0.01٪ معنی ندارد.

5. **Using accuracy on imbalanced data.**99 درصد دقت در مجموعه داده ها با 99 درصد کلاس منفی به این معنی است که مدل چیزی یاد نگرفته است.

6. **Cherry-picking metrics.**فقط از اندازه گیری هایی که مدل شما برنده شده گزارش می کنید.

7. **Leaking information across train/test splits.**قبل از تقسیم کردن، عادی سازی یا استفاده از داده های آینده برای پیش بینی گذشته.

8. **Small test sets with no variance estimates.**ارزیابی بر اساس 100 نمونه و ادعا از بهبود 2 درصد، صدا است نه سیگنال.

9. **Assuming independence when data is not independent.**تصاویر پزشکی از همان بیمار، جمله های متعدد از همان سند. مشاهدات درون یک گروه مرتبط است.

10. **P-hacking.**امتحان کردن تست های مختلف، زیر مجموعه ها یا معیارهای حذف تا زمانی که شما$p < 0.05$نتیجه ی این جستجو، یک اثر هنری است.

## ساخت آن

شما انجام می دهید:

1. **Descriptive statistics from scratch**(متوسط، میانگین، حالت، انحراف استاندارد، پرسنسیل، IQR)
2. **Correlation functions**(پیرسون و اسپیرمن با ماتریکس همتای)
3. **Hypothesis tests**(تخت یک نمونه، تست دو نمونه، تست چایی مربع)
4. **Bootstrap confidence intervals**(برای هر آماری، هیچ فرضیه ای لازم نیست)
5. **A/B test simulator**(تولید داده ها، آزمایش، بررسی برای خطا های نوع I و نوع II)
6. **Statistical vs practical significance demo**(که اینقدر بزرگ رو نشان میده)$n$همه چیز را "مهم" می کند)

همه چيز از ابتداست، فقط با استفاده از`math`و`random`نه گندگي، نه گندگي

```figure
f3-bootstrap-resample
```

## اصطلاحات کلیدی

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
