# Makine Öğrenimi İstatistikleri

> İstatistikler, modelinizin gerçekten işe yaradığını veya sadece şanslı olduğunu nasıl anlamanızı sağlar.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 06 (Probability and Distributions), 07 (Bayes' Theorem)
**Time:** ~120 minutes

## Öğrenme Hedefleri

- Hesaplama tanımlayıcı istatistikleri, Pearson/Spearman ilişkisi ve kovariansa matrislerini sıfırdan hesaplayın
- Hipotez testlerini (t testi, chi kare) yapın ve p değerlerini ve güven aralıklarını doğru şekilde yorumlayın
- Değişiklik varsayımları olmadan herhangi bir metrik için güven aralıkları oluşturmak için bootstrap yeniden örneklemesini kullanın
- Etkinlik boyut ölçümlerini kullanarak istatistiksel önemi pratik önemi ile ayırt etmek

## Sorun

İki model eğitmişsin. Model A test setinde 0.87 puan aldı. Model B'de 0.89.

Model B aslında Model A'yı atlatmadı. 0.02 fark gürültüydü. Test setiniz çok küçüktü, veya varyansa çok yüksektü, ya da her ikisi de.

Bu sürekli oluyor. Kağızlama sıralamaları. Tekrarlanamayan makaleler. Birkaç yüz numuneye dayanarak kazananları ilan eden A/B testleri.

İstatistik size sinyalleri gürültüden ayırt etme araçlarını verir. Farkın ne zaman gerçek olduğunu, ne kadar güvenli olmanız gerektiğini ve bir sonuca güvenmeden önce ne kadar veriye ihtiyacınız olduğunu söyler. Her ML boru hattı, her model karşılaştırması, her deney istatistiklere ihtiyaç duyar.

## Anlaşım

### Açıklayıcı İstatistikler: Verilerinizi Özetle

Bir şeyi modellemeden önce verilerin nasıl göründüğünü bilmelisin.

**Measures of central tendency**"Orta nerede?" diye cevap ver.

```
Mean:   sum of all values / count
        mu = (1/n) * sum(x_i)

Median: middle value when sorted
        Robust to outliers. If you have [1, 2, 3, 4, 1000], the mean is 202
        but the median is 3.

Mode:   most frequent value
        Useful for categorical data. For continuous data, rarely informative.
```

Ortalama dengeler arasındaki dengedir. Ortalama da yarı yolun işaretidir.$\text{mean} \gg \text{median}$(Milliarder'den sağ tarafa) Eğitim sırasında kayıp dağılımları genellikle$\text{mean} \ll \text{median}$(sadece örneklerden sol eğilimi).

**Measures of spread**"Veriler ne kadar dağılmış?" cevabını ver.

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

**Percentiles**Toplam verileri 100 eşit bölüme bölün. 25. yüzdesi (Q1) değerlerin %25'inin bu noktadan aşağı düştüğünü gösterir. 50. yüzdesi ortalama. 75. yüzdesi Q3.

```
For latency monitoring:
  P50 = median latency        (typical user experience)
  P95 = 95th percentile       (bad but not worst case)
  P99 = 99th percentile       (tail latency, often 10x the median)
```

ML'de, sonuç geçiciliği, tahmin güven dağılımları ve hata dağılımlarını anlama için yüzdeliller önemsediğiniz. Düşük ortalama hata ama korkunç P99 hatası olan bir model güvenlik kritik uygulamalarda işe yaramaz olabilir.

**Sample vs population statistics.**Bir örnekten hesaplama varyansiyonu yaparken, bölün $(n-1)$yerine$n$Bu Bessel'in düzeltmesi. Bu örnek ortalamanın gerçek nüfus ortalaması olmamasını telafi eder.$n$Eğer bir isimle, gerçek değişimi sistematik olarak küçümsüyorsun.$(n-1)$, tahmin tarafsızdır.

```math
\begin{aligned}
\text{Population variance:} \quad \sigma^2 &= \frac{1}{N} \sum (x_i - \mu)^2 \\
\text{Sample variance:} \quad s^2 &= \frac{1}{n-1} \sum (x_i - \bar{x})^2
\end{aligned}
```

İşlemde:$n$Büyük (binlerce örnek) ise fark önemsizdir.$n$Küçük (bir düzine örnek), önemli.

### İlişki: Değişkenlerin Birlikte Nasıl Hareket Edildiği

Korrelasyon, iki değişken arasındaki bir çizgiden ilişkinin gücünü ve yönünü ölçer.

**Pearson correlation coefficient**Düzsel ilişki önlemleri:

```
r = sum((x_i - x_bar)(y_i - y_bar)) / (n * s_x * s_y)

r = +1:  perfect positive linear relationship
r = -1:  perfect negative linear relationship
r =  0:  no linear relationship (but there might be a nonlinear one!)

Range: [-1, 1]
```

Pearson, ilişkinin doğrusal olduğunu ve her iki değişkenin de normal olarak dağıtıldığını varsayıyor.$r$0.1'den 0.9'a kadar.

**Spearman rank correlation**Monoton ilişki önlemleri:

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

**The golden rule:**İsteğe bağlılık nedenlik anlamına gelmez. Dondurma satışları ve boğulma ölümleri, yaz aylarında artış nedeniyle ilişkili. Modelin doğruluğu ve parametrelerin sayısı ilişkilidir, ancak parametrelerin eklenmesi otomatik olarak doğruluğu artırmaz (bakınız: aşırı uyum).

### Covariance Matrix

İki değişken arasındaki kovarians, birlikte nasıl değiştiklerini ölçer:

```
Cov(X, Y) = (1/n) * sum((x_i - x_bar)(y_i - y_bar))

Cov(X, Y) > 0:  X and Y tend to increase together
Cov(X, Y) < 0:  when X increases, Y tends to decrease
Cov(X, Y) = 0:  no linear co-movement
```

- Evet .$d$Özellikler, kovariansa matrisi $C$- bir$d \times d$matris nerede $C[i][j] = \mathop{\mathrm{Cov}}(\text{feature}_i, \text{feature}_j)$- Diagonal girişler$C[i][i]$Her bir özelliğin farklılıkları.

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

**Connection to PCA.**PCA özendependiance matrisiyi oluşturur. Özvektorlar ana bileşenlerdir (maksimum değişkenlik yönleri). Öz değerleri size her bileşenin ne kadar değişkenlik yakaladığını söyler. Bu tam olarak Ders 10'un kapsadığı şeydir, ancak şimdi neden kovariansa matrisi parçalanmak için doğru olduğunu görüyorsunuz: verilerinizde tüm çift yönlü doğrusal ilişkileri kodlar.

**Connection to correlation.**Korrelasyon matrisi, standart değişkenlerin (her biri standart sapmalarıyla bölünmüş) kovarians matrisidir.$[-1, 1]$- Evet .

### Hipotez Testleri

Hipotez testi belirsizlik altında kararlar vermenin bir çerçevesidir. Bir iddiayla başlar, veriler toplar ve verilerin iddia ile tutarlı olup olmadığını belirler.

**The setup:**

```
Null hypothesis (H0):        the default assumption, usually "no effect"
Alternative hypothesis (H1): what you are trying to show

Example:
  H0: Model A and Model B have the same accuracy
  H1: Model B has higher accuracy than Model A
```

**The p-value**H0'nun doğru olduğunu varsayarak, gözlemlediğiniz kadar aşırı bir veri görme olasılığıdır. H0'nun doğru olduğu olasılığı değildir.

```
p-value = P(data this extreme | H0 is true)

If p-value < alpha (typically 0.05):
    Reject H0. The result is "statistically significant."
If p-value >= alpha:
    Fail to reject H0. You do not have enough evidence.
    This does NOT mean H0 is true.
```

**Confidence intervals**Bir parametrenin makul değerler aralığını belirtin:

```
95% confidence interval for the mean:
    x_bar +/- z * (s / sqrt(n))

where z = 1.96 for 95% confidence

Interpretation: if you repeated this experiment many times, 95% of the
computed intervals would contain the true mean. It does NOT mean there
is a 95% probability the true mean is in this specific interval.
```

Güven aralığının genişliği size doğruluk hakkında bilgi verir. Geniş aralıklar yüksek belirsizlik anlamına gelir. Dar aralıklar tahmininizin doğru olduğunu (ama verileriniz tarafsızsa mutlaka doğru değil) anlamına gelir.

### T testi

T testi ortalamaları karşılaştırır.

**One-sample t-test:**nüfusun ortalaması bir hipotez değerinden farklı mı?

```math
\begin{aligned}
t &= \frac{\bar{x} - \mu_0}{s / \sqrt{n}} \\[4pt]
\text{degrees of freedom} &= n - 1
\end{aligned}
```

**Two-sample t-test (independent):**İki grup farklı mıdır?

```
t = (x_bar_1 - x_bar_2) / sqrt(s1^2/n1 + s2^2/n2)

This is Welch's t-test, which does not assume equal variances.
Always use Welch's unless you have a specific reason for equal variances.
```

**Paired t-test:**ölçümler çift olarak yapıldığında (aynı veriler üzerinde değerlendirilmiş aynı model):

```
Compute d_i = x_i - y_i for each pair
Then run a one-sample t-test on the d_i values against mu_0 = 0
```

ML'de çiftleştirilmiş t testi yaygın: her iki modeli aynı 10 çapraz onay katlamasında çalıştırır ve puanlarını çiftleştirerek karşılaştırırsınız.

### Chi kare testi

Chi kare testi, gözlemlenen frekansların beklenen frekanslarla uyumlu olup olmadığını kontrol eder.

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

### ML modelleri için A/B testleri

ML'deki A/B testleri web A/B testleri ile aynı değildir.

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

### İstatistik Önemlik vs. Pratik Önemlik

Sonuç istatistiksel olarak önemli olabilir ama pratikte anlamsızdır. Yeterli veri ile, önemsiz bir fark bile istatistiksel olarak önemli olur.

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

**Effect size**örnek boyutundan bağımsız olarak farkın ne kadar büyük olduğunu ölçer:

```math
\begin{aligned}
\text{Cohen's } d &= \frac{\text{mean}_1 - \text{mean}_2}{\text{pooled\_std}} \\[4pt]
d &= 0.2: \quad \text{small effect} \\
d &= 0.5: \quad \text{medium effect} \\
d &= 0.8: \quad \text{large effect}
\end{aligned}
```

Her zaman hem p-de etki boyutunu bildirin. p-değer farkın gerçek olup olmadığını söyler. efekt boyutu önemli olup olmadığını söyler.

### Çeşitli Benzetme Sorunu

Birçok hipotez denediğinizde, bazıları tesadüfen "önemli" olur.$\alpha = 0.05$, gerçek bir şey olmasa bile 1 yanlış pozitif bekliyorsunuz.

```
P(at least one false positive) = 1 - (1 - alpha)^m

m = 20 tests, alpha = 0.05:
P(false positive) = 1 - 0.95^20 = 0.64

You have a 64% chance of at least one false positive.
```

**Bonferroni correction:**bölün .$\alpha$Test sayısı ile.

```
Adjusted alpha = alpha / m = 0.05 / 20 = 0.0025

Only reject H0 if p-value < 0.0025.
Conservative but simple. Works when tests are independent.
```

ML'de, bir modelin birden fazla metrik arasında karşılaştırıldığında, birçok hiperparametre yapılandırmasını test ettiğinde veya birden fazla veri kümesi üzerinde değerlendirdiğinde bu önemlidir.

### Bootstrap Uygulamaları

Bootstrapping, verilerinizi değiştirerek bir istatistikin örnekleme dağılımını tahmin eder.

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

Bu, çiftleştirilmiş t testiden daha sağlam çünkü dağılımsal varsayımlar yapmaz.

### Parametrik vs. Parametrik olmayan Testler

**Parametric tests**belirli bir dağılım (genellikle normal) varsayın:

```
t-test:         assumes normally distributed data (or large n by CLT)
ANOVA:          assumes normality and equal variances
Pearson r:      assumes bivariate normality
```

**Non-parametric tests**dağıtım varsayımları yapmazlar:

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

ML deneylerinde, genellikle küçük $n$(5 veya 10 çapraz onay katlaması), bu nedenle Wilcoxon'un imzalama derecesi gibi parametrik olmayan testler t testlerinden daha uygun olur.

### Merkez Sınır Teoremi: Pratik Etkileri

CLT'de örneklerin dağıtımı ortalama normal bir dağıtmaya yaklaştığı belirtildi.$n$Bu, temel nüfus dağılımından bağımsız olarak büyür.

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

### ML makalelerinde yaygın istatistik hatalar

1. **Testing on the training set.**Sürekli modelin eğitim sırasında görmediği verileri saklayın.

2. **No confidence intervals.**Tek bir doğruluk numarasını belirsizlik olmadan bildirmek sonuçları tekrarlanamıyor ve doğrulanamıyor.

3. **Ignoring multiple comparisons.**50 yapılandırmayı test etmek ve en iyi olanı düzeltmeden rapor etmek yanlış pozitif oranları yükseltir.

4. **Confusing statistical and practical significance.**0.001'lik bir p değeri, 0.01% doğruluk gelişimi için anlamlı değildir.

5. **Using accuracy on imbalanced data.**99% negatif sınıflı bir veri kümesindeki %99 doğruluk, modelin hiçbir şey öğrenmediğini gösterir.

6. **Cherry-picking metrics.**Sadece modelin kazandığı ölçümleri rapor edersin.

7. **Leaking information across train/test splits.**Bölmeden önce normalleştirmek veya geçmişi tahmin etmek için gelecekteki verileri kullanmak.

8. **Small test sets with no variance estimates.**100 numuneye değerlendirmek ve % 2 iyileşme iddiası yapmak, sinyal değil gürültüdür.

9. **Assuming independence when data is not independent.**Aynı hastadan gelen tıbbi görüntüler, aynı belgeye ait birden fazla cümle.

10. **P-hacking.**Farklı testler, alt setler veya dışlama kriterlerini denemek,$p < 0.05$Sonuç arama eseridir.

## Yapım

Bu uygulamayı uygulayacaksınız:

1. **Descriptive statistics from scratch**(ortalama, ortalama, mod, standart sapma, yüzdeler, IQR)
2. **Correlation functions**(Pearson ve Spearman, kovariansa matrisi ile)
3. **Hypothesis tests**(bir örnek t testi, iki örnek t testi, chi kare testi)
4. **Bootstrap confidence intervals**(herhangi bir istatistik için varsayım gerekmez)
5. **A/B test simulator**(veriler oluşturmak, test etmek, I ve II tip hataları kontrol etmek)
6. **Statistical vs practical significance demo**(büyük bir tane gösterir)$n$Her şeyi "büyük" yapar.)

Hepsi sıfırdan, sadece kullanılarak.`math`ve `random`- Ne şapşalık ne de şapşalık.

```figure
f3-bootstrap-resample
```

## Anahtar Terimler

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
