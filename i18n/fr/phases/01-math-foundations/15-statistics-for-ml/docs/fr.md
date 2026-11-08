# Statistiques pour l'apprentissage automatique

> Les statistiques sont la façon de savoir si votre modèle fonctionne vraiment ou si vous avez eu de la chance.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 06 (Probability and Distributions), 07 (Bayes' Theorem)
**Time:** ~120 minutes

## Objectifs d'apprentissage

- Comptez les statistiques descriptives, la corrélation Pearson/Spearman et les matrices de covariance à partir de zéro
- Effectuer des tests d'hypothèse (t-test, chi-quadré) et interpréter correctement les valeurs p et les intervalles de confiance
- Utiliser le reéchantillonnage de la bande de démarrage pour construire des intervalles de confiance pour toute mesure sans hypothèses de distribution
- Distinguer la signification statistique de la signification pratique en utilisant des mesures de taille des effets

## Le problème

Vous avez formé deux modèles. Le modèle A a obtenu 0,87 dans votre ensemble de tests. Le modèle B obtenu 0,89. Vous déployez le modèle B. Trois semaines plus tard, les mesures de production sont pires que précédemment.

Le modèle B n'a pas vraiment surpassé le modèle A. La différence de 0,02 était le bruit. Votre ensemble de test était trop petit, ou la variance trop élevée, ou les deux. Vous avez envoyé le hasard déguisé en amélioration.

Les résultats de l'étude sont toujours les mêmes: des résultats négatifs, des tests A/B qui déclarent les gagnants sur la base de quelques centaines d'échantillons.

Les statistiques vous donnent les outils pour distinguer le signal du bruit. Elles vous disent quand une différence est réelle, à quel point vous devez être sûr et à quelle quantité de données vous avez besoin avant de pouvoir faire confiance à un résultat. Chaque pipeline de ML, chaque comparaison de modèle, chaque expérience a besoin de statistiques. Sans cela, vous devinez.

## Le concept

### Statistiques descriptives: résumés

Avant de modéliser quoi que ce soit, vous devez savoir à quoi ressemblent vos données.

**Measures of central tendency**Réponse: " Où est le milieu ? "

```
Mean:   sum of all values / count
        mu = (1/n) * sum(x_i)

Median: middle value when sorted
        Robust to outliers. If you have [1, 2, 3, 4, 1000], the mean is 202
        but the median is 3.

Mode:   most frequent value
        Useful for categorical data. For continuous data, rarely informative.
```

La moyenne est le point d'équilibre. La médiane est la marque à mi-chemin. Quand elles divergent, votre répartition est biaisée.$\text{mean} \gg \text{median}$Les pertes lors de l'entraînement ont souvent$\text{mean} \ll \text{median}$(déviation gauche des échantillons faciles).

**Measures of spread**Répondre à "combien les données sont dispersées?"

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

**Percentiles**Le 25e percentile (Q1) signifie que 25% des valeurs tombent en dessous de ce point. Le 50e percentile est la médiane. Le 75e percentile est Q3.

```
For latency monitoring:
  P50 = median latency        (typical user experience)
  P95 = 95th percentile       (bad but not worst case)
  P99 = 99th percentile       (tail latency, often 10x the median)
```

En ML, vous vous souciez des percentiles pour la latence d'inférence, les distributions de confiance de prédiction et la compréhension des distributions d'erreurs. Un modèle avec une erreur moyenne faible mais une erreur P99 terrible pourrait être inutile pour les applications critiques pour la sécurité.

**Sample vs population statistics.**Lorsque vous calculez la variance d'un échantillon, divisez par $(n-1)$Au lieu de $n$C'est la correction de Bessel qui compense le fait que votre moyenne d'échantillon n'est pas la moyenne de population.$n$Dans le dénominateur, vous sous-estimez systématiquement la vraie variance.$(n-1)$, l'estimation est impartiale.

```math
\begin{aligned}
\text{Population variance:} \quad \sigma^2 &= \frac{1}{N} \sum (x_i - \mu)^2 \\
\text{Sample variance:} \quad s^2 &= \frac{1}{n-1} \sum (x_i - \bar{x})^2
\end{aligned}
```

Dans la pratique: si $n$Si la différence est importante (en milliers d'échantillons), elle est négligeable.$n$est petit (de dizaines d'échantillons), il importe.

### Corrélation: Comment les variables se déplacent ensemble

La corrélation mesure la force et la direction d'une relation linéaire entre deux variables.

**Pearson correlation coefficient**mesures d'association linéaire:

```
r = sum((x_i - x_bar)(y_i - y_bar)) / (n * s_x * s_y)

r = +1:  perfect positive linear relationship
r = -1:  perfect negative linear relationship
r =  0:  no linear relationship (but there might be a nonlinear one!)

Range: [-1, 1]
```

Pearson suppose que la relation est linéaire et que les deux variables sont à peu près normalement réparties.$r$de 0,1 à 0,9.

**Spearman rank correlation**mesures d'association monotone:

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

**The golden rule:**La correlation ne signifie pas de causalité. Les ventes de crèmes glacées et les décès par noyade sont corrélées car les deux augmentent en été. La précision de votre modèle et le nombre de paramètres sont corrélés, mais l'ajout de paramètres n'améliore pas automatiquement la précision (voir: surmatch).

### Matrice de covariance

La covariance entre deux variables mesure leur variation ensemble:

```
Cov(X, Y) = (1/n) * sum((x_i - x_bar)(y_i - y_bar))

Cov(X, Y) > 0:  X and Y tend to increase together
Cov(X, Y) < 0:  when X increases, Y tends to decrease
Cov(X, Y) = 0:  no linear co-movement
```

Pour $d$caractéristiques, la matrice de covariance $C$est une $d \times d$matrice où $C[i][j] = \mathop{\mathrm{Cov}}(\text{feature}_i, \text{feature}_j)$Les entrées diagonales$C[i][i]$sont les variations de chaque caractéristique.

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

**Connection to PCA.**PCA proprecompose la matrice de covariance. Les propres vecteurs sont les composants principaux (directions de variance maximale). Les valeurs propres vous disent combien de variance chaque composant capture. C'est exactement ce que la leçon 10 couvre, mais maintenant vous voyez pourquoi la matrice de covariance est la bonne chose à décomposer: elle encode toutes les relations linéaires par paires dans vos données.

**Connection to correlation.**La matrice de corrélation est la matrice de covariance des variables normalisées (chacune divisée par son écart standard).$[-1, 1]$- Je suis désolé .

### Test de l'hypothèse

Les tests d'hypothèse sont un cadre pour prendre des décisions en cas d'incertitude.

**The setup:**

```
Null hypothesis (H0):        the default assumption, usually "no effect"
Alternative hypothesis (H1): what you are trying to show

Example:
  H0: Model A and Model B have the same accuracy
  H1: Model B has higher accuracy than Model A
```

**The p-value**C'est la probabilité de voir des données aussi extrêmes que ce que vous avez observé, en supposant que H0 est vrai.

```
p-value = P(data this extreme | H0 is true)

If p-value < alpha (typically 0.05):
    Reject H0. The result is "statistically significant."
If p-value >= alpha:
    Fail to reject H0. You do not have enough evidence.
    This does NOT mean H0 is true.
```

**Confidence intervals**donner une gamme de valeurs plausibles pour un paramètre:

```
95% confidence interval for the mean:
    x_bar +/- z * (s / sqrt(n))

where z = 1.96 for 95% confidence

Interpretation: if you repeated this experiment many times, 95% of the
computed intervals would contain the true mean. It does NOT mean there
is a 95% probability the true mean is in this specific interval.
```

La largeur de l'intervalle de confiance vous indique la précision. Les intervalles larges signifient une grande incertitude.

### Le t-test

Le t-test compare les moyens.

**One-sample t-test:**La moyenne de la population diffère-t-elle d'une valeur hypothétique ?

```math
\begin{aligned}
t &= \frac{\bar{x} - \mu_0}{s / \sqrt{n}} \\[4pt]
\text{degrees of freedom} &= n - 1
\end{aligned}
```

**Two-sample t-test (independent):**deux groupes signifient-ils différemment?

```
t = (x_bar_1 - x_bar_2) / sqrt(s1^2/n1 + s2^2/n2)

This is Welch's t-test, which does not assume equal variances.
Always use Welch's unless you have a specific reason for equal variances.
```

**Paired t-test:**lorsque les mesures sont effectuées en paires (même modèle évalué sur les mêmes fractions de données):

```
Compute d_i = x_i - y_i for each pair
Then run a one-sample t-test on the d_i values against mu_0 = 0
```

Dans ML, le t-test parallèle est courant: vous exécutez les deux modèles sur les mêmes 10 plies de validation croisée et comparez leurs scores parallèlement.

### Test en chiffres carrés

Le test en chi-quadré vérifie si les fréquences observées correspondent aux fréquences attendues.

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

### Tests A/B pour les modèles ML

Les tests A/B en ML ne sont pas les mêmes que les tests A/B en ligne.

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

### Signification statistique par rapport à signification pratique

Un résultat peut être statistiquement significatif mais pratiquement sans signification.

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

**Effect size**quantifie la taille de la différence, indépendamment de la taille de l'échantillon:

```math
\begin{aligned}
\text{Cohen's } d &= \frac{\text{mean}_1 - \text{mean}_2}{\text{pooled\_std}} \\[4pt]
d &= 0.2: \quad \text{small effect} \\
d &= 0.5: \quad \text{medium effect} \\
d &= 0.8: \quad \text{large effect}
\end{aligned}
```

Rapporte toujours la valeur de p et la taille de l'effet. La valeur de p vous indique si la différence est réelle.

### Problème de comparaison multiples

Quand vous testez de nombreuses hypothèses, certaines seront "signifiantes" par hasard.$\alpha = 0.05$On s'attend à un faux positif, même quand rien n'est réel.

```
P(at least one false positive) = 1 - (1 - alpha)^m

m = 20 tests, alpha = 0.05:
P(false positive) = 1 - 0.95^20 = 0.64

You have a 64% chance of at least one false positive.
```

**Bonferroni correction:**partage$\alpha$par le nombre de tests.

```
Adjusted alpha = alpha / m = 0.05 / 20 = 0.0025

Only reject H0 if p-value < 0.0025.
Conservative but simple. Works when tests are independent.
```

En ML, cela compte quand vous comparez un modèle à travers plusieurs mesures, testez de nombreuses configurations d'hyperparamètres ou évaluez sur plusieurs ensembles de données.

### Les méthodes de démarrage

Bootstrapping estime la distribution d'échantillonnage d'une statistique en repensant vos données avec un remplacement.

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

C'est plus robuste que le t-test parallèle car il ne fait aucune hypothèse de distribution.

### Tests paramétriques et non paramétriques

**Parametric tests**en supposant une distribution spécifique (généralement normale):

```
t-test:         assumes normally distributed data (or large n by CLT)
ANOVA:          assumes normality and equal variances
Pearson r:      assumes bivariate normality
```

**Non-parametric tests**ne prennent pas de hypothèses de distribution:

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

Dans les expériences de ML, vous avez généralement de petites$n$Les tests non paramétriques tels que le test de classement signé Wilcoxon sont souvent plus appropriés que les tests t.

### Théorème de limite centrale: implications pratiques

Le CLT indique que la distribution des moyens d'échantillonnage approche une distribution normale comme $n$Les taux de croissance sont plus élevés que les taux de croissance.

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

### Échecs statistiques courants dans les documents ML

1. **Testing on the training set.**Garantir un surmatch, toujours tenir des données que le modèle ne voit pas pendant la formation.

2. **No confidence intervals.**En déclarant un seul numéro d'exactitude sans incertitude, les résultats ne peuvent être reproduits et non vérifiés.

3. **Ignoring multiple comparisons.**Tester 50 configurations et signaler la meilleure sans correction gonfle les taux de faux positifs.

4. **Confusing statistical and practical significance.**Une valeur p de 0,001 sur une amélioration de précision de 0,01% n'est pas significative.

5. **Using accuracy on imbalanced data.**99% d'exactitude sur un ensemble de données avec une classe négative de 99% signifie que le modèle n'a rien appris.

6. **Cherry-picking metrics.**Rapporte seulement les mesures où votre modèle gagne.

7. **Leaking information across train/test splits.**Normalement avant de se diviser, ou en utilisant des données futures pour prédire le passé.

8. **Small test sets with no variance estimates.**L'évaluation sur 100 échantillons et la prétention d'une amélioration de 2% est du bruit, pas du signal.

9. **Assuming independence when data is not independent.**Des images médicales du même patient, plusieurs phrases du même document.

10. **P-hacking.**Essayez différents tests, sous-ensembles ou critères d'exclusion jusqu'à ce que vous obtenez $p < 0.05$Le résultat est un artefact de la recherche.

## La construire

Vous mettez en œuvre:

1. **Descriptive statistics from scratch**(média, médiane, mode, déviation standard, percentiles, RQI)
2. **Correlation functions**(Pearson et Spearman, avec la matrice de covariance)
3. **Hypothesis tests**(test t-échantillon unique, test t-échantillon double, test chi-quadré)
4. **Bootstrap confidence intervals**(pour toute statistique, aucune hypothèse n'est nécessaire)
5. **A/B test simulator**(générer des données, tester, vérifier les erreurs de type I et de type II)
6. **Statistical vs practical significance demo**(montrant que grand $n$rend tout "signifiant")

Tout à partir de zéro, en utilisant seulement `math`et `random`Pas de numpy, pas de scipy.

```figure
f3-bootstrap-resample
```

## Les termes clés

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
