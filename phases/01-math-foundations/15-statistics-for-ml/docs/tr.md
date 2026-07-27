# Machine Learning istatistikleri

> İstatistik, modelinizin gerçekten işe yarayıp yaramadığını veya şanslı olup olmadığını nasıl bileceğinizdir.

**Tür:** Yapım
**Dil:** Python
**Önkoşullar:** Aşama 1, Dersler 06 (Olasılık ve Dağılımlar), 07 (Bayes Teoremi)
**Süre:** ~120 dakika

## Öğrenme Hedefleri

- Tanımlayıcı istatistikleri, Pearson/Spearman korelasyonunu ve kovaryans matrislerini sıfırdan hesaplayın
- Hipotez testlerini (t-testi, ki-kare) gerçekleştirin ve p değerlerini ve güven aralıklarını doğru şekilde yorumlayın
- Dağıtım varsayımları olmadan herhangi bir ölçüm için güven aralıkları oluşturmak üzere önyükleme yeniden örneklemeyi kullanın
- Etki büyüklüğü ölçümlerini kullanarak istatistiksel önemi pratik önemden ayırt edin

## Sorun

İki modeli eğittiniz. Model A, test setinizde 0,87 puan aldı. Model B'nin puanı 0,89'dur. Model B'yi dağıtıyorsunuz. Üç hafta sonra üretim ölçümleri eskisinden daha kötü. Ne oldu?

Model B aslında Model A'dan daha iyi performans göstermedi. 0,02'lik fark gürültüydü. Test kümeniz çok küçüktü ya da varyans çok yüksekti ya da her ikisi birden. Rastgeleliği gelişme süsü vererek gönderdiniz.

Bu sürekli olur. Kaggle skor tablosunda değişiklikler. Yeniden üretilemeyen kağıtlar. Birkaç yüz örneğe dayanarak kazananları ilan eden A/B testleri. Temel neden her zaman aynıdır: Birisi istatistikleri atlamıştır.

İstatistikler size sinyali gürültüden ayırmanız için araçlar sağlar. Bir farkın ne zaman gerçek olduğunu, kendinize ne kadar güvenmeniz gerektiğini ve bir sonuca güvenmeden önce ne kadar veriye ihtiyacınız olduğunu size söyler. Her makine öğrenimi hattının, her model karşılaştırmasının, her deneyin istatistiklere ihtiyacı vardır. Onsuz, tahmin ediyorsunuz.

## Konsept

### Tanımlayıcı İstatistikler: Verilerinizi Özetleme

Herhangi bir şeyi modellemeden önce verilerinizin neye benzediğini bilmeniz gerekir. Tanımlayıcı istatistikler, bir dataset'yi şeklini yakalayan birkaç sayıya sıkıştırır.

**Merkezi eğilim ölçüleri** "ortası nerede?" sorusunun cevabını verir.

```
Mean:   sum of all values / count
        mu = (1/n) * sum(x_i)

Median: middle value when sorted
        Robust to outliers. If you have [1, 2, 3, 4, 1000], the mean is 202
        but the median is 3.

Mode:   most frequent value
        Useful for categorical data. For continuous data, rarely informative.
```

Ortalama denge noktasıdır. Medyan yarı yol işaretidir. Farklılaştıklarında dağılımınız çarpık olur. Gelir dağılımları ortalama >> medyana sahiptir (milyarderlerden sağa çarpık). Eğitim sırasındaki kayıp dağılımları genellikle ortalama << medyana sahiptir (kolay örneklerden sola çarpık).

**Yayılma ölçümleri** "veriler ne kadar dağınık?" sorusunu yanıtlıyor.

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

**Yüzdelikler** sıralanan verileri 100 eşit parçaya böler. 25. yüzdelik dilim (Q1), değerlerin %25'inin bu noktanın altına düştüğü anlamına gelir. 50. yüzdelik dilim medyandır. 75. yüzdelik dilim Q3'tür.

```
For latency monitoring:
  P50 = median latency        (typical user experience)
  P95 = 95th percentile       (bad but not worst case)
  P99 = 99th percentile       (tail latency, often 10x the median)
```

ML'de inference gecikmesine ilişkin yüzdelik dilimlere, tahmin güven dağılımlarına ve hata dağılımlarını anlamaya önem verirsiniz. Ortalama hatası düşük ancak korkunç P99 hatası olan bir model, güvenlik açısından kritik uygulamalar için işe yaramayabilir.

**Örnek ve popülasyon istatistikleri.** Bir örnekten sapmayı hesaplarken, n yerine (n-1)'e bölün. Bu Bessel'in düzeltmesi. Örnek ortalamanızın gerçek popülasyon ortalaması olmadığı gerçeğini telafi eder. Paydada n varken, gerçek varyansı sistematik olarak küçümsemiş olursunuz. (n-1) ile tahmin tarafsızdır.

```
Population variance: sigma^2 = (1/N) * sum((x_i - mu)^2)
Sample variance:     s^2     = (1/(n-1)) * sum((x_i - x_bar)^2)
```

Uygulamada: eğer n büyükse (binlerce örnek), fark ihmal edilebilir düzeydedir. Eğer n küçükse (onlarca örnek), bu önemlidir.

### Korelasyon: Değişkenler Birlikte Nasıl Hareket Eder?

Korelasyon, iki değişken arasındaki doğrusal ilişkinin gücünü ve yönünü ölçer.

**Pearson korelasyon katsayısı** doğrusal ilişkiyi ölçer:

```
r = sum((x_i - x_bar)(y_i - y_bar)) / (n * s_x * s_y)

r = +1:  perfect positive linear relationship
r = -1:  perfect negative linear relationship
r =  0:  no linear relationship (but there might be a nonlinear one!)

Range: [-1, 1]
```

Pearson ilişkinin doğrusal olduğunu ve her iki değişkenin de kabaca normal dağıldığını varsayar. Aykırı değerlere karşı duyarlıdır. Tek bir uç nokta r'yi 0,1'den 0,9'a sürükleyebilir.

**Spearman sıra korelasyonu** monotonik ilişkiyi ölçer:

```
1. Replace each value with its rank (1, 2, 3, ...)
2. Compute Pearson correlation on the ranks

Spearman catches any monotonic relationship, not just linear.
If y = x^3, Pearson gives r < 1 but Spearman gives rho = 1.
```

**Her biri ne zaman kullanılmalı:**

```
Pearson:    Both variables are continuous and roughly normal.
            You care about the linear relationship specifically.
            No extreme outliers.

Spearman:   Ordinal data (rankings, ratings).
            Data is not normally distributed.
            You suspect a monotonic but not linear relationship.
            Outliers are present.
```

**Altın kural:** korelasyon nedensellik anlamına gelmez. Dondurma satışları ile boğulma ölümleri birbiriyle bağlantılı çünkü her ikisi de yaz aylarında artıyor. Modelinizin doğruluğu ve parametre sayısı ilişkilidir, ancak parametre eklemek doğruluğu otomatik olarak iyileştirmez (bkz: aşırı uyum).

### Kovaryans Matrisi

İki değişken arasındaki kovaryans, bunların birlikte nasıl değiştiğini ölçer:

```
Cov(X, Y) = (1/n) * sum((x_i - x_bar)(y_i - y_bar))

Cov(X, Y) > 0:  X and Y tend to increase together
Cov(X, Y) < 0:  when X increases, Y tends to decrease
Cov(X, Y) = 0:  no linear co-movement
```

d özellikleri için kovaryans matrisi C, bir d x d matrisidir; burada C[i][j] = Cov(feature_i, feature_j). Çapraz girişler C[i][i] her özelliğin varyanslarıdır.

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

**PCA'ya bağlantı.** PCA öz durumu kovaryans matrisini oluşturur. Özvektörler ana bileşenlerdir (maksimum varyansın yönleri). Özdeğerler size her bileşenin ne kadar varyans yakaladığını söyler. Bu tam olarak Ders 10'un kapsadığı konuydu, ancak şimdi kovaryans matrisinin neden ayrıştırılması gereken doğru şey olduğunu görüyorsunuz: verilerinizdeki tüm ikili doğrusal ilişkileri kodlar.

**Korelasyonla bağlantı.** Korelasyon matrisi, standartlaştırılmış değişkenlerin kovaryans matrisidir (her biri standart sapmaya bölünür). Korelasyon kovaryansı normalleştirir, böylece tüm değerler [-1, 1]'e düşer.

### Hipotez Testi

Hipotez testi belirsizlik altında karar vermeye yönelik bir framework'dir. Bir iddiayla başlarsınız, verileri toplarsınız ve verilerin iddiayla tutarlı olup olmadığını belirlersiniz.

**Kurulum:**

```
Null hypothesis (H0):        the default assumption, usually "no effect"
Alternative hypothesis (H1): what you are trying to show

Example:
  H0: Model A and Model B have the same accuracy
  H1: Model B has higher accuracy than Model A
```

**p değeri**, H0'ın doğru olduğu varsayılarak, verileri gözlemlediğiniz kadar uç noktalarda görme olasılığıdır. H0'ın doğru olma olasılığı DEĞİLDİR. Bu istatistikte en yaygın yanlış anlamadır.

```
p-value = P(data this extreme | H0 is true)

If p-value < alpha (typically 0.05):
    Reject H0. The result is "statistically significant."
If p-value >= alpha:
    Fail to reject H0. You do not have enough evidence.
    This does NOT mean H0 is true.
```

**Güven aralıkları** bir parametre için bir dizi makul değer verir:

```
95% confidence interval for the mean:
    x_bar +/- z * (s / sqrt(n))

where z = 1.96 for 95% confidence

Interpretation: if you repeated this experiment many times, 95% of the
computed intervals would contain the true mean. It does NOT mean there
is a 95% probability the true mean is in this specific interval.
```

Güven aralığının genişliği size kesinlik hakkında bilgi verir. Geniş aralıklar yüksek belirsizlik anlamına gelir. Dar aralıklar, tahmininizin kesin olduğu anlamına gelir (ancak verileriniz taraflıysa mutlaka doğru olmayabilir).

### T testi

T-testi ortalamaları karşılaştırır. Birkaç lezzet var.

**Tek örnek t testi:** Anakütle ortalaması varsayılan değerden farklı mı?

```
t = (x_bar - mu_0) / (s / sqrt(n))

degrees of freedom = n - 1
```

**İki örnekli t testi (bağımsız):** iki grubun ortalamaları farklı mı?

```
t = (x_bar_1 - x_bar_2) / sqrt(s1^2/n1 + s2^2/n2)

This is Welch's t-test, which does not assume equal variances.
Always use Welch's unless you have a specific reason for equal variances.
```

**Eşleştirilmiş t-testi:** ölçümler çiftler halinde geldiğinde (aynı veri bölmelerinde aynı model değerlendirilir):

```
Compute d_i = x_i - y_i for each pair
Then run a one-sample t-test on the d_i values against mu_0 = 0
```

ML'de eşleştirilmiş t testi yaygındır: her iki modeli de aynı 10 çapraz doğrulama katında çalıştırırsınız ve puanlarını ikili olarak karşılaştırırsınız.

### Ki-kare Testi

Ki-kare testi, gözlemlenen frekansların beklenen frekanslarla eşleşip eşleşmediğini kontrol eder. Kategorik veriler için kullanışlıdır.

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

### ML Modelleri için A/B Testi

ML'deki A/B testi, web A/B testiyle aynı değildir. Model karşılaştırmasının belirli zorlukları vardır:

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

**Prosedür:**

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

### İstatistiksel Önem ve Pratik Önem

Bir sonuç istatistiksel olarak anlamlı olabilir ancak pratik olarak anlamsız olabilir. Yeterli veri olduğunda önemsiz bir fark bile istatistiksel olarak anlamlı hale gelir.

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

**Etki boyutu** örneklem boyutundan bağımsız olarak farkın ne kadar büyük olduğunu belirtir:

```
Cohen's d = (mean_1 - mean_2) / pooled_std

d = 0.2:  small effect
d = 0.5:  medium effect
d = 0.8:  large effect
```

Her zaman hem p değerini hem de etki büyüklüğünü rapor edin. P değeri size farkın gerçek olup olmadığını söyler. Etki büyüklüğü size bunun önemli olup olmadığını söyler.

### Çoklu Karşılaştırma Problemi

Birçok hipotezi test ettiğinizde bazıları tesadüfen "anlamlı" olacaktır. 20 şeyi alfa = 0,05'te test ederseniz, hiçbir şey gerçek olmasa bile 1 yanlış pozitif beklersiniz.

```
P(at least one false positive) = 1 - (1 - alpha)^m

m = 20 tests, alpha = 0.05:
P(false positive) = 1 - 0.95^20 = 0.64

You have a 64% chance of at least one false positive.
```

**Bonferroni düzeltmesi:** alfayı test sayısına bölün.

```
Adjusted alpha = alpha / m = 0.05 / 20 = 0.0025

Only reject H0 if p-value < 0.0025.
Conservative but simple. Works when tests are independent.
```

ML'de, bir modeli birden fazla ölçümle karşılaştırdığınızda, birçok hiper parametre yapılandırmasını test ettiğinizde veya birden fazla dataset üzerinde değerlendirme yaptığınızda bu önemlidir.

### Önyükleme Yöntemleri

Önyükleme, verilerinizi değiştirmeyle yeniden örnekleyerek bir istatistiğin örnekleme dağılımını tahmin eder. Temel dağılıma ilişkin herhangi bir varsayıma gerek yoktur.

**Algoritma:**

```
1. You have n data points
2. Draw n samples WITH replacement (some points appear multiple times,
   some not at all)
3. Compute your statistic on this bootstrap sample
4. Repeat B times (typically B = 1000 to 10000)
5. The distribution of bootstrap statistics approximates the
   sampling distribution
```

**Bootstrap güven aralığı (yüzdelik yöntem):**

```
Sort the B bootstrap statistics
95% CI = [2.5th percentile, 97.5th percentile]
```

**Önyükleme makine öğrenimi için neden önemlidir:**

```
- Test set accuracy is a point estimate. Bootstrap gives you
  confidence intervals.
- You cannot assume metric distributions are normal (especially
  for AUC, F1, precision at k).
- Bootstrap works for ANY statistic: median, ratio of two means,
  difference in AUC between two models.
- No closed-form formula needed.
```

**Model karşılaştırması için önyükleme:**

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

Bu, eşleştirilmiş t-testinden daha sağlamdır çünkü hiçbir dağılımsal varsayımda bulunmaz.

### Parametrik ve Parametrik Olmayan Testler

**Parametrik testler** belirli bir dağılım varsayar (genellikle normal):

```
t-test:         assumes normally distributed data (or large n by CLT)
ANOVA:          assumes normality and equal variances
Pearson r:      assumes bivariate normality
```

**Parametrik olmayan testler** hiçbir dağılımsal varsayımda bulunmaz:

```
Mann-Whitney U:     compares two groups (replaces independent t-test)
Wilcoxon signed-rank: compares paired data (replaces paired t-test)
Spearman rho:       correlation on ranks (replaces Pearson)
Kruskal-Wallis:     compares multiple groups (replaces ANOVA)
```

**Parametrik olmayan ne zaman kullanılır:**

```
- Small sample size (n < 30) and data is clearly non-normal
- Ordinal data (ratings, rankings)
- Heavy outliers you cannot remove
- Skewed distributions
```

**Parametrik ne zaman kullanılır?**

```
- Large sample size (CLT makes the test statistic approximately normal)
- Data is roughly symmetric without extreme outliers
- More statistical power (better at detecting real differences)
```

ML deneylerinde genellikle küçük n'niz (5 veya 10 çapraz doğrulama katınız) vardır, bu nedenle Wilcoxon işaretli sıralama gibi parametrik olmayan testler genellikle t testlerinden daha uygundur.

### Merkezi Limit Teoremi: Pratik Uygulamalar

CLT, temel popülasyon dağılımından bağımsız olarak, n büyüdükçe örnek ortalamalarının dağılımının normal bir dağılıma yaklaştığını söylüyor.

```
If X_1, X_2, ..., X_n are iid with mean mu and variance sigma^2:

    X_bar ~ Normal(mu, sigma^2 / n)    as n -> infinity

Works for n >= 30 in most cases.
For highly skewed distributions, you might need n >= 100.
```

**Bu, makine öğrenimi için neden önemlidir:**

```
1. Justifies confidence intervals and t-tests on aggregated metrics
2. Explains why averaging over cross-validation folds gives stable
   estimates even when individual folds vary wildly
3. Mini-batch gradient descent works because the average gradient
   over a batch approximates the true gradient (CLT in action)
4. Ensemble methods: averaging predictions from many models gives
   more stable output than any single model
```

**CLT ne yapmaz:**

```
- Does NOT make your data normal. It makes the MEAN of samples normal.
- Does NOT work for heavy-tailed distributions with infinite variance
  (Cauchy distribution).
- Does NOT apply to dependent data (time series without correction).
```

### Makine Öğrenmesi Makalelerinde Yaygın İstatistiksel Hatalar

1. **Eğitim setinde test etme.** Fazla uyumu garanti eder. Modelin eğitim sırasında asla görmediği verileri her zaman tutun.

2. **Güven aralığı yok.** Belirsizlik olmadan tek bir doğruluk numarasının raporlanması, sonuçların tekrarlanamaz ve doğrulanamaz olmasını sağlar.

3. **Birden fazla karşılaştırmanın göz ardı edilmesi.** 50 konfigürasyonun test edilmesi ve en iyisinin düzeltme yapılmadan raporlanması, hatalı pozitif oranları artırır.

4. **İstatistiksel ve pratik anlamlılığı karıştırmak.** %0,01'lik doğruluk artışında 0,001'lik bir p değeri anlamlı değildir.

5. **Dengesiz verilerde doğruluğu kullanma.** %99 negatif sınıfa sahip bir dataset'de %99 doğruluk, modelin hiçbir şey öğrenmediği anlamına gelir. Hassasiyet, geri çağırma, F1 veya AUC'yi kullanın.

6. **Önemli metrikler.** Yalnızca modelinizin kazandığı metriği raporlama. Dürüst değerlendirme, ilgili tüm ölçümleri rapor eder.

7. **Eğitim/test bölünmeleri boyunca bilgi sızıntısı.** Bölünmeden önce normalleştirme veya geçmişi tahmin etmek için gelecekteki verileri kullanma.

8. **Varyans tahminleri olmayan küçük test setleri.** 100 örnek üzerinde değerlendirme yapmak ve %2 iyileşme iddia etmek sinyal değil gürültüdür.

9. **Veriler bağımsız olmadığında bağımsızlığın varsayılması.** Aynı hastaya ait tıbbi görüntüler, aynı belgeden birden fazla cümle. Bir grup içindeki gözlemler ilişkilidir.

10. **P-hacking.** P < 0,05 elde edene kadar farklı testler, alt kümeler veya hariç tutma kriterleri denemek. Sonuç, aramanın artifact'sidir.

## İnşa Etmek

Aşağıdakileri uygulayacaksınız:

1. **Sıfırdan tanımlayıcı istatistikler** (ortalama, medyan, mod, standart sapma, yüzdelikler, IQR)
2. **Korelasyon fonksiyonları** (Pearson ve Spearman, kovaryans matrisi ile)
3. **Hipotez testleri** (tek örnekli t testi, iki örnekli t testi, ki-kare testi)
4. **Bootstrap güven aralıkları** (herhangi bir istatistik için varsayıma gerek yoktur)
5. **A/B test simülatörü** (veri oluşturun, test edin, Tip I ve Tip II hatalarını kontrol edin)
6. **İstatistiksel ve pratik anlamlılık demosu** (büyük n'nin her şeyi "anlamlı" yaptığını gösterir)

Hepsi sıfırdan, yalnızca `math` ve `random` kullanılarak. Numpy yok, scipy yok.

## Anahtar Terimler

| Dönem | Tanımı |
|---|---|
| Ortalama | Değerlerin toplamının sayıya bölünmesi. Aykırı değerlere duyarlı. |
| Medyan | Sıralanan verilerin orta değeri. Aykırı değerlere karşı dayanıklıdır. |
| Standart sapma | Varyansın karekökü. Ölçüler orijinal birimlere yayıldı. |
| Yüzdelik | Belirli bir veri yüzdesinin altına düştüğü değer. |
| IQR | Çeyrekler arası aralık. Ç3 eksi Ç1. Ortadaki yayılım %50'dir. |
| Pearson korelasyonu | İki değişken arasındaki doğrusal ilişkiyi ölçer. Aralık [-1, 1]. |
| Spearman korelasyonu | Sıralamaları kullanarak monotonik ilişkilendirmeyi ölçer. |
| Kovaryans matrisi | Tüm özellikler arasındaki ikili kovaryans matrisi. |
| Boş hipotez | Etkinin veya farkın olmadığına ilişkin varsayılan varsayım. |
| p-değeri | Verilerin bu aşırı uçtaki sıfır hipotezi doğru olma olasılığı. |
| Güven aralığı | Belirli bir güven seviyesinde bir parametre için makul değer aralığı. |
| t-testi | Ortalamaların önemli ölçüde farklı olup olmadığını test eder. T dağılımını kullanır. |
| Ki-kare testi | Gözlemlenen frekansların beklenen frekanslardan farklı olup olmadığını test eder. |
| Etki boyutu | Örnek boyutundan bağımsız olarak farkın büyüklüğü. Cohen'in d'si yaygındır. |
| Bonferroni düzeltmesi | Yanlış pozitifleri kontrol etmek için anlamlılık eşiğini test sayısına böler. |
| Önyükleme | Örnekleme dağılımlarını tahmin etmek için değiştirmeyle yeniden örnekleme. |
| Tip I hatası | Yanlış pozitif. Doğru olduğunda H0'ı reddetmek. |
| Tip II hatası | Yanlış negatif. Yanlış olduğunda H0'ın reddedilememesi. |
| İstatistiksel güç | Yanlış bir H0'ı doğru şekilde reddetme olasılığı. Güç = 1 eksi Tip II hata oranı. |
| Merkezi limit teoremi | Örneklem, örneklem boyutu büyüdükçe normal dağılıma yakınsamak anlamına gelir. |
| Parametrik test | Veriler için belirli bir dağılım olduğunu varsayar (genellikle normal). |
| Parametrik olmayan test | Hiçbir dağıtımsal varsayımda bulunmaz. Rütbeler veya işaretler üzerinde çalışır. |
