# إحصاءات للتعلم الآلي

> الإحصاءات هي كيف تعرف ما إذا كان نموذجك يعمل فعلاً أو كان محظوظاً

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 06 (Probability and Distributions), 07 (Bayes' Theorem)
**Time:** ~120 minutes

## أهداف التعلم

- إحصاءات تصريفيّة الحساب، وتصريحات ارتباط بييرسون/سبيرمان، ومصفوفات التغيرات من الصفر
- إجراء اختبارات فرضية (اختبار t، chi- مربع) وتفسير قيم p ومناطق الثقة بشكل صحيح
- استخدام bootstrap resampling لبناء فترات الثقة لأي متريكا دون افتراضات توزيعية
- تمييز الأهمية الإحصائية عن الأهمية العملية باستخدام قياسات حجم التأثير

## المشكلة

لقد تدربت على طرازين، طراز (أ) حصل على 0.87 في مجموعة الاختبارات، طراز (ب) حصل على 0.89.

النموذج ب لم يقدم أداء أفضل من النموذج أ. الفرق 0.02 كان الضجيج. مجموعة اختبارك كانت صغيرة جدا، أو التباين مرتفعة جدا، أو كليهما. أنت أرسل الاصابة متزيّنة على أنها تحسين.

هذا يحدث باستمرار. تغييرات في قائمة الرتبة. أوراق لا تتكاثر. اختبارات A / B التي تعلن الفائزين بناء على بضع مئات من العينات. السبب الجذري هو دائما نفسها: شخص ما تخطي الإحصاءات.

الإحصاءات تعطيك الأدوات لتمييز الإشارة عن الضوضاء. إنها تخبرك متى يكون الفرق حقيقيًا، ومدى الثقة التي يجب أن تكون بها، ومقدار البيانات التي تحتاجها قبل أن تثق في نتيجة. كل خط أنابيب ML، كل مقارنة نموذج، كل تجربة تحتاج إلى إحصاءات. بدونها، كنت تخمين.

## المفهوم

### الإحصاءات المفصّلة: تلخيص بياناتك

قبل أن تقوم بتصميم أي شيء، تحتاج إلى معرفة كيف تبدو البيانات الخاصة بك. الإحصاءات التوضيحية تضغط مجموعة البيانات إلى عددين يحتوي على شكلها.

**Measures of central tendency**أجيب "أين الوسط؟"

```
Mean:   sum of all values / count
        mu = (1/n) * sum(x_i)

Median: middle value when sorted
        Robust to outliers. If you have [1, 2, 3, 4, 1000], the mean is 202
        but the median is 3.

Mode:   most frequent value
        Useful for categorical data. For continuous data, rarely informative.
```

المتوسط هو نقطة التوازن المتوسط هو علامة نصف الطريق عندما تختلف توزيعك مشوه توزيع الدخل لديه$\text{mean} \gg \text{median}$(الجهة اليمنى من المليارديرات) توزيع الخسائر أثناء التدريب غالبا ما يكون$\text{mean} \ll \text{median}$(الجهة اليسرى من عينات سهلة).

**Measures of spread**الإجابة على "كم توزيع البيانات؟"

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

**Percentiles**تقسيم البيانات المرتبة إلى 100 جزء متساو. المئة 25 (Q1) تعني أن 25% من القيم تقع تحت هذه النقطة. المئة 50 هي المتوسط. المئة 75 هي Q3.

```
For latency monitoring:
  P50 = median latency        (typical user experience)
  P95 = 95th percentile       (bad but not worst case)
  P99 = 99th percentile       (tail latency, often 10x the median)
```

في ML، تهتم بالرسومات للتخفيف من الإستنتاج، وتوزيعات الثقة التنبؤية، وتوزيعات الخطأ الفهمية. قد يكون نموذجًا ذو متوسط ضئيل ولكن خطأ P99 رهيب غير مفيد للتطبيقات الحرجة للسلامة.

**Sample vs population statistics.**عند حساب التباين من عينة، تقسيمها ب $(n-1)$بدلاً من$n$هذا تصحيح (بيسل) ، إنه يعوض حقيقة أن متوسط العينة ليس متوسط السكان الحقيقي$n$في المُعادل، أنت تقليل بشكل منهجي التباين الحقيقي.$(n-1)$، التقدير غير متحيز

```math
\begin{aligned}
\text{Population variance:} \quad \sigma^2 &= \frac{1}{N} \sum (x_i - \mu)^2 \\
\text{Sample variance:} \quad s^2 &= \frac{1}{n-1} \sum (x_i - \bar{x})^2
\end{aligned}
```

في الممارسة العملية: إذا$n$إذا كان حجمها كبير (ألف عينة) ، فإن الفرق ضئيل.$n$هو صغير (العشرات من العينات) ، هو مهم.

### التواصل: كيف تتحرك المتغيرات معًا

القياسات التناسلية تقيس قوة واتجاه العلاقة الخطية بين متغيرين.

**Pearson correlation coefficient**تدابير الربط الخطي:

```
r = sum((x_i - x_bar)(y_i - y_bar)) / (n * s_x * s_y)

r = +1:  perfect positive linear relationship
r = -1:  perfect negative linear relationship
r =  0:  no linear relationship (but there might be a nonlinear one!)

Range: [-1, 1]
```

يفترض بيرسون أن العلاقة خطية وكلا المتغيرات موزعة بشكل طبيعي تقريبًا. هو حساسًا للمخالفات. نقطة متطرفة واحدة يمكن أن تسحب$r$من 0.1 إلى 0.9.

**Spearman rank correlation**تدابير الربط المتوحد:

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

**The golden rule:**التواصل لا يعني وجود سبب. مبيعات الآيس كريم وفيات الغرق مرتبطة لأن كلا الزيادة في الصيف. دقة نموذجك وعدد المعلمات مرتبطة، ولكن إضافة المعلمات لا تحسن دقة تلقائيًا (انظر: الإفراط في التكيف).

### المصفوفة المتكافئة

يقدر التباين بين متغيرين كيف يتباين معاً:

```
Cov(X, Y) = (1/n) * sum((x_i - x_bar)(y_i - y_bar))

Cov(X, Y) > 0:  X and Y tend to increase together
Cov(X, Y) < 0:  when X increases, Y tends to decrease
Cov(X, Y) = 0:  no linear co-movement
```

لأجل$d$الميزات، المصفوفة التغيرات $C$هو$d \times d$المصفوفة حيث $C[i][j] = \mathop{\mathrm{Cov}}(\text{feature}_i, \text{feature}_j)$. إدخالات الأفقية$C[i][i]$هي اختلافات كل سمة.

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

**Connection to PCA.**يجمع PCA نفسه المصفوفة التباينية. المتجهات الخاصة هي المكونات الرئيسية (اتجاهات أقصى اختلاف). القيم الخاصة تخبرك كم التباينية التي يتقاطعها كل مكون. هذا بالضبط ما تغطيه الدروس 10 ، ولكن الآن ترى لماذا هو المصفوفة التباينية هو الشيء الصحيح للتفكك: فهو يرمز جميع العلاقات الخطية المتزاوجة في بياناتك.

**Connection to correlation.**المصفوفة التواصل هي المصفوفة التواصلية المتغيرات المعيارية (كل منها مقسمة عن طريق انحرافها القياسي).$[-1, 1]$. . .

### اختبار الفرضية

اختبار الفرضية هو إطار لاتخاذ القرارات في ظل عدم اليقين. تبدأ بطلب، وتجمع البيانات، وتحديد ما إذا كانت البيانات متوافقة مع المطالبة.

**The setup:**

```
Null hypothesis (H0):        the default assumption, usually "no effect"
Alternative hypothesis (H1): what you are trying to show

Example:
  H0: Model A and Model B have the same accuracy
  H1: Model B has higher accuracy than Model A
```

**The p-value**هو احتمال رؤية البيانات متطرفة كما لاحظته، افتراض H0 صحيحة. انها ليست احتمال H0 صحيحة. هذا هو واحد من أكثر سوء الفهم الشائعة في الإحصاءات.

```
p-value = P(data this extreme | H0 is true)

If p-value < alpha (typically 0.05):
    Reject H0. The result is "statistically significant."
If p-value >= alpha:
    Fail to reject H0. You do not have enough evidence.
    This does NOT mean H0 is true.
```

**Confidence intervals**إعطاء مجموعة من القيم المثيرة للصدق للفاروم:

```
95% confidence interval for the mean:
    x_bar +/- z * (s / sqrt(n))

where z = 1.96 for 95% confidence

Interpretation: if you repeated this experiment many times, 95% of the
computed intervals would contain the true mean. It does NOT mean there
is a 95% probability the true mean is in this specific interval.
```

عرض فترة الثقة يخبرك عن الدقة. فترات واسعة تعني عدم اليقين العالي. فترات ضيقة تعني تقديرك دقيق (ولكن ليس بالضرورة دقيقًا، إذا كانت بياناتك متحيزة).

### اختبار التأثير

اختبار "ت" يقارن معدل، هناك العديد من الذوق

**One-sample t-test:**هل متوسط السكان مختلف عن القيمة المفترضة؟

```math
\begin{aligned}
t &= \frac{\bar{x} - \mu_0}{s / \sqrt{n}} \\[4pt]
\text{degrees of freedom} &= n - 1
\end{aligned}
```

**Two-sample t-test (independent):**هل المجموعتين تعنيان مختلفان؟

```
t = (x_bar_1 - x_bar_2) / sqrt(s1^2/n1 + s2^2/n2)

This is Welch's t-test, which does not assume equal variances.
Always use Welch's unless you have a specific reason for equal variances.
```

**Paired t-test:**عندما تكون القياسات مقترحة (المثل الذي يتم تقييمه على نفس تقسيم البيانات):

```
Compute d_i = x_i - y_i for each pair
Then run a one-sample t-test on the d_i values against mu_0 = 0
```

في ML، اختبار t المزدوج شائع: تقوم بتشغيل كلا النماذج على نفس 10 طوابق التحقق المتقاطع وتقارن درجاتها بشكل مزدوج.

### اختبار المربع (شي)

اختبار "شي-سكواد" يختبر ما إذا كانت الترددات الملاحظة تتطابق مع الترددات المتوقعة. مفيدة للبيانات الفئوية.

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

### اختبار A/B لنماذج ML

لا يعد اختبار A/B في ML هو نفسه من اختبار A/B على شبكة الإنترنت.

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

### الأهمية الإحصائية مقابل الأهمية العملية

النتيجة يمكن أن تكون ذات أهمية إحصائية ولكن لا معنى لها عملياً. مع وجود بيانات كافية، يصبح الفارق البسيط مهماً إحصائيًا.

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

**Effect size**يحدد مقدار الفرق، بغض النظر عن حجم العينة:

```math
\begin{aligned}
\text{Cohen's } d &= \frac{\text{mean}_1 - \text{mean}_2}{\text{pooled\_std}} \\[4pt]
d &= 0.2: \quad \text{small effect} \\
d &= 0.5: \quad \text{medium effect} \\
d &= 0.8: \quad \text{large effect}
\end{aligned}
```

دائماً أبلغ كل من قيمة p وحجم التأثير. قيمة p تخبرك إذا كان الفرق حقيقي. حجم التأثير يخبرك إذا كان يهم.

### مشكلة مقارنة متعددة

عندما تختبر العديد من الفرضيات، بعضها سيكون "مهم" بالصدفة.$\alpha = 0.05$، أنت تتوقع 1 إيجابية كاذبة حتى عندما لا شيء حقيقي.

```
P(at least one false positive) = 1 - (1 - alpha)^m

m = 20 tests, alpha = 0.05:
P(false positive) = 1 - 0.95^20 = 0.64

You have a 64% chance of at least one false positive.
```

**Bonferroni correction:**تقسيم$\alpha$من خلال عدد الاختبارات

```
Adjusted alpha = alpha / m = 0.05 / 20 = 0.0025

Only reject H0 if p-value < 0.0025.
Conservative but simple. Works when tests are independent.
```

في ML، هذا يهم عندما تقارن نموذج عبر مقاييس متعددة، واختبار العديد من تكوينات المعلمات العالية، أو تقييم على مجموعة بيانات متعددة.

### طرق التشغيل

يقدر Bootstrapping توزيع العينات من إحصاءات عن طريق إعادة أخذ العينات من البيانات الخاصة بك مع استبدال. لا توجد افتراضات حول التوزيع الأساسي مطلوبة.

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

هذا أكثر قوة من اختبار t المزدوج لأنه لا يقدم افتراضات توزيعية.

### الاختبارات المعلمية مقابل غير المعلمية

**Parametric tests**افترض توزيع محدد (عادة طبيعي):

```
t-test:         assumes normally distributed data (or large n by CLT)
ANOVA:          assumes normality and equal variances
Pearson r:      assumes bivariate normality
```

**Non-parametric tests**لا يفترض التوزيع:

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

في تجارب ML، عادة ما يكون لديك صغيرة $n$(مختبرات التحقق من الصلاحية المتقاطعة 5 أو 10 مرات) ، لذلك غالبا ما تكون الاختبارات غير المعلمية مثل الاختبارات الموقعة لـ Wilcoxon أكثر ملاءمة من الاختبارات التالية.

### نظرية الحد المركزي: الآثار العملية

ويقول المكتب التنفيذي للعمليات أن توزيع العينات يقترب من توزيع طبيعي$n$ينمو، بغض النظر عن التوزيع الأساسي للسكان.

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

### الأخطاء الإحصائية الشائعة في ورق ML

1. **Testing on the training set.**تضمن التكيف الزائد، دائماً تمتلك بيانات لا يراها النموذج أثناء التدريب

2. **No confidence intervals.**الإبلاغ عن رقم واحد من الدقة دون عدم اليقين يجعل النتائج غير قابلة للتكرار وغير قابلة للتحقق.

3. **Ignoring multiple comparisons.**اختبار 50 تكوين وتقديم أفضل واحد دون تصحيح يضخم معدلات إيجابية كاذبة.

4. **Confusing statistical and practical significance.**قيمة p من 0.001 على تحسين دقة 0.01٪ ليست ذات معنى.

5. **Using accuracy on imbalanced data.**99٪ دقة على مجموعة بيانات مع 99٪ فئة سلبية يعني أن النموذج لم يتعلم شيئا. استخدم الدقة، التذكير، F1 أو AUC.

6. **Cherry-picking metrics.**تقرير فقط المقاييس التي يفوز فيها نموذجك تقرير تقييم صادق جميع المقاييس ذات الصلة

7. **Leaking information across train/test splits.**التطبيع قبل الانقسام، أو استخدام البيانات المستقبلية للتنبؤ بالماضي.

8. **Small test sets with no variance estimates.**التقييم على 100 عينة و المطالبة بتحسن 2% هو الضجيج، وليس الإشارة.

9. **Assuming independence when data is not independent.**صور طبية من نفس المريض، جمل عدة من نفس الوثيقة.

10. **P-hacking.**تجربة اختبارات مختلفة، مجموعات فرعية، أو معايير الإقصاء حتى تحصل$p < 0.05$النتيجة هي أثرية من البحث

## بناءها

ستنفذ:

1. **Descriptive statistics from scratch**(متوسط، ووسط، وضع، انحراف قياسي، الفصائل، IQR)
2. **Correlation functions**(بيرسون وسبيرمان) مع المصفوفة المتجانسة)
3. **Hypothesis tests**(اختبار الـ T من عينة واحدة، اختبار الـ T من عينتين، اختبار الـ Chi-squared)
4. **Bootstrap confidence intervals**(لمعرفة أي إحصاءات، لا حاجة إلى افتراضات)
5. **A/B test simulator**(إنتاج البيانات، واختبار، التحقق من أخطاء النوع الأول والنوع الثاني)
6. **Statistical vs practical significance demo**(تظهر ذلك الكبير $n$يجعل كل شيء "مهمة")

كل شيء من الصفر، باستخدام فقط`math`و`random`لا شقق ولا شقق

```figure
f3-bootstrap-resample
```

## الشروط الرئيسية

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
