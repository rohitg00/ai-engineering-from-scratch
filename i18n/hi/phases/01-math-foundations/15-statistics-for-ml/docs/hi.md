# मशीन लर्निंग के लिए सांख्यिकी

> सांख्यिकी यह है कि आप कैसे जानते हैं कि आपका मॉडल वास्तव में काम करता है या सिर्फ भाग्यशाली था।

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 06 (Probability and Distributions), 07 (Bayes' Theorem)
**Time:** ~120 minutes

## सीखने के लक्ष्य

- गणना विवरणात्मक सांख्यिकी, पीयरसन/स्पीयरमैन सहसंबंध और सह-भेरिएंस मैट्रिक्स को खरोंच से
- परिकल्पना परीक्षण (टी-टेस्ट, चि-क्वायर) करें और p-मूल्यों और विश्वास अंतराल को सही ढंग से व्याख्या करें
- वितरण परिकल्पनाओं के बिना किसी भी मीट्रिक के लिए विश्वास अंतराल बनाने के लिए बूटस्ट्रैप पुनः नमूनाकरण का उपयोग करें
- प्रभाव आकार माप का उपयोग करके सांख्यिकीय महत्व को व्यावहारिक महत्व से अलग करना

## समस्या

आपने दो मॉडल को प्रशिक्षित किया है. मॉडल ए ने अपने परीक्षण सेट पर 0.87 स्कोर किया है. मॉडल बी ने 0.89 स्कोर किया है. आप मॉडल बी को तैनात करते हैं. तीन सप्ताह बाद, उत्पादन माप पहले से भी बदतर हैं। क्या हुआ?

मॉडल बी वास्तव में मॉडल ए से बेहतर प्रदर्शन नहीं किया। 0.02 अंतर शोर था। आपका परीक्षण सेट बहुत छोटा था, या भिन्नता बहुत अधिक थी, या दोनों। आपने सुधार के रूप में पहना हुआ यादृच्छिकता भेजी।

यह लगातार होता है. कैगलबर्ड में बदलाव. कागजात जो पुनः पेश नहीं होते. ए / बी परीक्षण जो कुछ सौ नमूनों के आधार पर विजेताओं की घोषणा करते हैं. मूल कारण हमेशा एक ही हैः कोई आंकड़े छोड़ देता है।

सांख्यिकी आपको संकेत और शोर को अलग करने के लिए उपकरण देती है। यह आपको बताती है कि अंतर कब वास्तविक है, आपको कितना आश्वस्त होना चाहिए, और परिणाम पर भरोसा करने से पहले आपको कितने डेटा की आवश्यकता है। हर एमएल पाइपलाइन, हर मॉडल तुलना, हर प्रयोग को सांख्यिकी की आवश्यकता होती है। इसके बिना, आप अनुमान लगा रहे हैं।

## अवधारणा

### विवरणात्मक आँकड़ेः अपने आंकड़ों का सारांश

इससे पहले कि आप कुछ भी मॉडल करें, आपको यह जानना होगा कि आपके डेटा कैसा दिखते हैं। वर्णनात्मक सांख्यिकी डेटा सेट को कुछ संख्याओं में संपीड़ित करती है जो इसके आकार को कैप्चर करती है।

**Measures of central tendency**जवाब "कहाँ है बीच में?

```
Mean:   sum of all values / count
        mu = (1/n) * sum(x_i)

Median: middle value when sorted
        Robust to outliers. If you have [1, 2, 3, 4, 1000], the mean is 202
        but the median is 3.

Mode:   most frequent value
        Useful for categorical data. For continuous data, rarely informative.
```

औसत संतुलन बिंदु है. मध्य मध्य मध्य है. जब वे विचलित होते हैं, तो आपका वितरण विकृत होता है. आय वितरण में$\text{mean} \gg \text{median}$प्रशिक्षण के दौरान हानि वितरण अक्सर है$\text{mean} \ll \text{median}$(आसान नमूनों से बाएं विकृति) ।

**Measures of spread**जवाब "कई बार डेटा कैसे फैला हुआ है?

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

**Percentiles**क्रमबद्ध डेटा को 100 समान भागों में विभाजित करें। 25वें पर्सेंटाइल (Q1) का मतलब है कि 25% मान इस बिंदु से नीचे गिरते हैं। 50वें पर्सेंटाइल का अर्थ है मध्यवर्ती। 75वें पर्सेंटाइल का अर्थ है Q3.

```
For latency monitoring:
  P50 = median latency        (typical user experience)
  P95 = 95th percentile       (bad but not worst case)
  P99 = 99th percentile       (tail latency, often 10x the median)
```

एमएल में, आप अनुमानित विलंबता, भविष्यवाणी विश्वास वितरण और त्रुटि वितरण को समझने के लिए प्रतिशत के बारे में परवाह करते हैं। कम औसत त्रुटि के साथ एक मॉडल लेकिन भयानक पी 99 त्रुटि सुरक्षा-महत्वपूर्ण अनुप्रयोगों के लिए बेकार हो सकती है।

**Sample vs population statistics.**नमूना से गणना भिन्नता, द्वारा विभाजित $(n-1)$इसके बजाय $n$यह बेसल की सुधार है. यह तथ्य की भरपाई करता है कि आपके नमूना औसत वास्तविक आबादी औसत नहीं है.$n$नामक में, आप व्यवस्थित रूप से वास्तविक भिन्नता को कम आंकते हैं।$(n-1)$, अनुमान निष्पक्ष है।

```math
\begin{aligned}
\text{Population variance:} \quad \sigma^2 &= \frac{1}{N} \sum (x_i - \mu)^2 \\
\text{Sample variance:} \quad s^2 &= \frac{1}{n-1} \sum (x_i - \bar{x})^2
\end{aligned}
```

व्यवहार में: यदि $n$यदि यह बड़ा है (हजारों नमूने), तो अंतर नगण्य है।$n$छोटे (दसों नमूने), यह मायने रखता है।

### सहसंबंधः कैसे चर एक साथ चलते हैं

सहसंबंध दो चर के बीच रैखिक संबंध की ताकत और दिशा को मापता है।

**Pearson correlation coefficient**रैखिक संघनित उपाय:

```
r = sum((x_i - x_bar)(y_i - y_bar)) / (n * s_x * s_y)

r = +1:  perfect positive linear relationship
r = -1:  perfect negative linear relationship
r =  0:  no linear relationship (but there might be a nonlinear one!)

Range: [-1, 1]
```

पियरसन का मानना है कि संबंध रैखिक है और दोनों चर लगभग सामान्य रूप से वितरित हैं। यह असाधारण के प्रति संवेदनशील है। एक एकल चरम बिंदु खींच सकता है$r$0.1 से 0.9 तक।

**Spearman rank correlation**एकतरफा संबंध उपायः

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

**The golden rule:**संयोग का अर्थ है कारणों का संबंध नहीं है। आइसक्रीम की बिक्री और डूबने से होने वाली मौतों का संबंध है क्योंकि दोनों गर्मियों में बढ़ते हैं। आपके मॉडल की सटीकता और पैरामीटर की संख्या संबद्ध हैं, लेकिन पैरामीटर जोड़ने से सटीकता में स्वचालित रूप से सुधार नहीं होता है (देखेंः ओवरफिट) ।

### सह-विवर्तन मैट्रिक्स

दो चर के बीच सह-परिवर्तन यह मापता है कि वे कैसे भिन्न होते हैंः

```
Cov(X, Y) = (1/n) * sum((x_i - x_bar)(y_i - y_bar))

Cov(X, Y) > 0:  X and Y tend to increase together
Cov(X, Y) < 0:  when X increases, Y tends to decrease
Cov(X, Y) = 0:  no linear co-movement
```

के लिए$d$विशेषताएं, सह-परिवर्तन मैट्रिक्स $C$है $d \times d$मैट्रिक्स जहां $C[i][j] = \mathop{\mathrm{Cov}}(\text{feature}_i, \text{feature}_j)$. विकर्ण प्रविष्टियाँ $C[i][i]$प्रत्येक विशेषता के भिन्नताएँ हैं।

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

**Connection to PCA.**PCA स्वयं कोविरेन्स मैट्रिक्स को संकलित करता है। स्ववेक्टर मुख्य घटक (अधिकतम भिन्नता के दिशाएं) हैं। स्वमूल्य आपको बताते हैं कि प्रत्येक घटक कितना भिन्नता कैप्चर करता है। यह ठीक यही है कि पाठ 10 का कवर किया गया है, लेकिन अब आप देखते हैं कि क्यों कोविरेन्स मैट्रिक्स को विघटित करने के लिए सही चीज हैः यह आपके डेटा में सभी जोड़ेदार रैखिक संबंधों को एन्कोड करता है।

**Connection to correlation.**सहसंबंध मैट्रिक्स मानक चर के सहसंबंध मैट्रिक्स है (प्रत्येक अपने मानक विचलन से विभाजित) सहसंबंध सहसंबंध सामान्य बनाता है इसलिए सभी मान में गिरते हैं $[-1, 1]$. .

### परिकल्पना परीक्षण

परिकल्पना परीक्षण अनिश्चितता के तहत निर्णय लेने के लिए एक ढांचा है। आप एक दावे से शुरू करते हैं, डेटा एकत्र करते हैं, और यह निर्धारित करते हैं कि क्या डेटा दावे के साथ संगत है।

**The setup:**

```
Null hypothesis (H0):        the default assumption, usually "no effect"
Alternative hypothesis (H1): what you are trying to show

Example:
  H0: Model A and Model B have the same accuracy
  H1: Model B has higher accuracy than Model A
```

**The p-value**यह अनुमान है कि H0 सच है, यह अनुमान है कि H0 सच है, यह आंकड़ों में सबसे आम गलतफहमी है।

```
p-value = P(data this extreme | H0 is true)

If p-value < alpha (typically 0.05):
    Reject H0. The result is "statistically significant."
If p-value >= alpha:
    Fail to reject H0. You do not have enough evidence.
    This does NOT mean H0 is true.
```

**Confidence intervals**किसी पैरामीटर के लिए मान्य मानों की सीमा देंः

```
95% confidence interval for the mean:
    x_bar +/- z * (s / sqrt(n))

where z = 1.96 for 95% confidence

Interpretation: if you repeated this experiment many times, 95% of the
computed intervals would contain the true mean. It does NOT mean there
is a 95% probability the true mean is in this specific interval.
```

विश्वास अंतराल की चौड़ाई आपको सटीकता के बारे में बताती है। व्यापक अंतराल का अर्थ है उच्च अनिश्चितता। संकीर्ण अंतराल का अर्थ है कि आपका अनुमान सटीक है (लेकिन जरूरी नहीं कि सटीक हो, यदि आपके डेटा पक्षपातपूर्ण हैं) ।

### टी-टेस्ट

टी-टेस्ट तुलना के माध्यम से है. कई स्वाद हैं.

**One-sample t-test:**क्या जनसंख्या का औसत परिकल्पना मूल्य से भिन्न है?

```math
\begin{aligned}
t &= \frac{\bar{x} - \mu_0}{s / \sqrt{n}} \\[4pt]
\text{degrees of freedom} &= n - 1
\end{aligned}
```

**Two-sample t-test (independent):**क्या दो समूहों का अर्थ अलग है?

```
t = (x_bar_1 - x_bar_2) / sqrt(s1^2/n1 + s2^2/n2)

This is Welch's t-test, which does not assume equal variances.
Always use Welch's unless you have a specific reason for equal variances.
```

**Paired t-test:**जब माप जोड़े में होते हैं (एक ही मॉडल के साथ आंकड़ों के समान विभाजन पर मूल्यांकन किया जाता है):

```
Compute d_i = x_i - y_i for each pair
Then run a one-sample t-test on the d_i values against mu_0 = 0
```

एमएल में, जोड़ी t-परीक्षण आम हैः आप दोनों मॉडल को एक ही 10 क्रॉस-वैलिडेशन फोल्ड पर चलाते हैं और उनके स्कोर की तुलना जोड़ी के रूप में करते हैं।

### चि-क्वाड टेस्ट

चि-क्वायर परीक्षण जांचता है कि क्या देखे गए आवृत्तियों अपेक्षित आवृत्तियों से मेल खाते हैं।

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

### एमएल मॉडल के लिए ए/बी परीक्षण

एमएल में ए/बी परीक्षण वेब ए/बी परीक्षण के समान नहीं है। मॉडल तुलना में विशिष्ट चुनौतियां हैंः

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

### सांख्यिकीय महत्व बनाम व्यावहारिक महत्व

परिणाम सांख्यिकीय रूप से महत्वपूर्ण हो सकता है लेकिन व्यावहारिक रूप से कोई अर्थ नहीं है। पर्याप्त डेटा के साथ, यहां तक कि एक मामूली अंतर सांख्यिकीय रूप से महत्वपूर्ण हो जाता है।

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

**Effect size**नमूना आकार के बावजूद अंतर कितना बड़ा है, यह quantifies:

```math
\begin{aligned}
\text{Cohen's } d &= \frac{\text{mean}_1 - \text{mean}_2}{\text{pooled\_std}} \\[4pt]
d &= 0.2: \quad \text{small effect} \\
d &= 0.5: \quad \text{medium effect} \\
d &= 0.8: \quad \text{large effect}
\end{aligned}
```

हमेशा p-मूल्य और प्रभाव आकार दोनों की रिपोर्ट करें. p-मूल्य आपको बताता है कि क्या अंतर वास्तविक है. प्रभाव आकार आपको बताता है कि क्या यह मायने रखता है.

### कई तुलना समस्या

जब आप कई परिकल्पनाओं का परीक्षण करते हैं, तो कुछ "महत्वपूर्ण" संयोग से होंगे।$\alpha = 0.05$, आप 1 झूठी सकारात्मक उम्मीद है, भले ही कुछ भी वास्तविक नहीं है.

```
P(at least one false positive) = 1 - (1 - alpha)^m

m = 20 tests, alpha = 0.05:
P(false positive) = 1 - 0.95^20 = 0.64

You have a 64% chance of at least one false positive.
```

**Bonferroni correction:**विभाजित करें$\alpha$परीक्षणों की संख्या से।

```
Adjusted alpha = alpha / m = 0.05 / 20 = 0.0025

Only reject H0 if p-value < 0.0025.
Conservative but simple. Works when tests are independent.
```

एमएल में, यह तब मायने रखता है जब आप कई मापों के बीच एक मॉडल की तुलना करते हैं, कई हाइपरपरमैटर कॉन्फ़िगरेशन का परीक्षण करते हैं, या कई डेटासेट पर मूल्यांकन करते हैं।

### बूटस्ट्रैप विधि

बूटस्ट्रैपिंग आपके डेटा को प्रतिस्थापन के साथ पुनः नमूना करके एक आंकड़े के नमूने वितरण का अनुमान लगाता है। अंतर्निहित वितरण के बारे में कोई धारणा आवश्यक नहीं है।

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

यह जोड़ी t-परीक्षण से अधिक मजबूत है क्योंकि यह कोई वितरण परिकल्पना नहीं करता है।

### पैरामेट्रिक बनाम गैर-परमेट्रिक परीक्षण

**Parametric tests**एक विशिष्ट वितरण (आमतौर पर सामान्य) का अनुमान लगाएंः

```
t-test:         assumes normally distributed data (or large n by CLT)
ANOVA:          assumes normality and equal variances
Pearson r:      assumes bivariate normality
```

**Non-parametric tests**वितरण परिकल्पना नहीं करेंः

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

एमएल प्रयोगों में, आप आम तौर पर छोटे होते हैं$n$(५ या १० क्रॉस-वैलिडेशन फोल्ड) इसलिए विल्कोक्सन जैसे गैर-पैरामेट्रिक टेस्ट अक्सर टी-टेस्ट से अधिक उपयुक्त होते हैं।

### केंद्रीय सीमा प्रमेय: व्यावहारिक प्रभाव

सीएलटी का कहना है कि नमूना वितरण औसत सामान्य वितरण के करीब है जैसे $n$जनसंख्या के आधार पर वितरण के बावजूद बढ़ता है।

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

### एमएल पेपर में आम सांख्यिकीय त्रुटियां

1. **Testing on the training set.**हमेशा मॉडल प्रशिक्षण के दौरान कभी नहीं देखता डेटा बाहर रखें।

2. **No confidence intervals.**अनिश्चितता के बिना एक ही सटीकता संख्या की रिपोर्ट करना परिणामों को प्रतिकृति और सत्यापन योग्य नहीं बनाता है।

3. **Ignoring multiple comparisons.**50 कॉन्फ़िगरेशन का परीक्षण करना और बिना सुधार के सर्वश्रेष्ठ की रिपोर्ट करना गलत सकारात्मक दरों को बढ़ाता है।

4. **Confusing statistical and practical significance.**0.01% सटीकता में सुधार पर 0.001 का p-मूल्य सार्थक नहीं है।

5. **Using accuracy on imbalanced data.**99% नकारात्मक वर्ग के साथ डेटा सेट पर 99% सटीकता का मतलब है कि मॉडल कुछ भी नहीं सीखा। सटीकता का उपयोग करें, याद, F1, या AUC।

6. **Cherry-picking metrics.**केवल उस मेट्रिक की रिपोर्ट करना जहां आपका मॉडल जीतता है। ईमानदार मूल्यांकन सभी प्रासंगिक मेट्रिक्स की रिपोर्ट करता है।

7. **Leaking information across train/test splits.**विभाजन से पहले सामान्यीकरण, या अतीत की भविष्यवाणी करने के लिए भविष्य के डेटा का उपयोग करना।

8. **Small test sets with no variance estimates.**100 नमूनों पर मूल्यांकन करना और 2% सुधार का दावा करना शोर है, सिग्नल नहीं।

9. **Assuming independence when data is not independent.**एक ही रोगी की चिकित्सा छवियां, एक ही दस्तावेज से कई वाक्य। एक समूह के भीतर अवलोकन सहसंबंधित हैं।

10. **P-hacking.**जब तक आप प्राप्त नहीं करते हैं, विभिन्न परीक्षणों, उपसमूहों, या बहिष्करण मानदंडों की कोशिश करना।$p < 0.05$परिणाम खोज का एक कलाकृत्य है।

## इसे बनाना

आप लागू करेंगेः

1. **Descriptive statistics from scratch**(औसत, मध्य, मोड, मानक विचलन, प्रतिशत, IQR)
2. **Correlation functions**(पीयरसन और स्पीयरमैन, सह-विवर्तन मैट्रिक्स के साथ)
3. **Hypothesis tests**(एक नमूना टी-टेस्ट, दो नमूना टी-टेस्ट, चि-क्वाड टेस्ट)
4. **Bootstrap confidence intervals**(किसी भी सांख्यिकीय के लिए कोई अनुमान की आवश्यकता नहीं है)
5. **A/B test simulator**(डेटा उत्पन्न करना, परीक्षण करना, प्रकार I और प्रकार II की त्रुटियों की जांच करना)
6. **Statistical vs practical significance demo**(यह दिखाने के लिए कि बड़े $n$सब कुछ "महत्वपूर्ण" बनाता है)

सब कुछ खरोंच से, केवल उपयोग करते हुए `math`और `random`कोई नंगा, कोई नंगा।

```figure
f3-bootstrap-resample
```

## प्रमुख शर्तें

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
