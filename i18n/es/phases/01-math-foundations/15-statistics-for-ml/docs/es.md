# Estadísticas para el aprendizaje automático

> Las estadísticas son la manera de saber si tu modelo realmente funciona o simplemente tuvo suerte.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 06 (Probability and Distributions), 07 (Bayes' Theorem)
**Time:** ~120 minutes

## Objetivos de aprendizaje

- Computa estadísticas descriptivas, correlación Pearson/Spearman y matrices de covarianza desde cero
- Realizar pruebas de hipótesis (t-test, chi-cuadrado) e interpretar correctamente los valores de p e intervalos de confianza
- Utilice el re-muestreo de bootstrap para construir intervalos de confianza para cualquier métrica sin suposiciones de distribución
- Distinguir la importancia estadística de la importancia práctica mediante medidas de tamaño de efecto

## El problema

Entrenó a dos modelos. El modelo A obtiene 0,87 en su conjunto de pruebas. El modelo B obtiene 0,89.

El modelo B no superó al modelo A. La diferencia de 0.02 fue el ruido. Su conjunto de pruebas era demasiado pequeño, o la varianza demasiado alta, o ambos.

Esto sucede constantemente. Cambios en el ranking de la tabla de clasificación. Papeles que no se reproducen. Pruebas A/B que declaran ganadores basándose en unos cientos de muestras. La causa es siempre la misma: alguien saltó las estadísticas.

Las estadísticas te dan las herramientas para distinguir la señal del ruido. Te dice cuándo es real una diferencia, cuán seguro debes estar, y cuántos datos necesitas antes de confiar en un resultado. Cada tubería de ML, cada comparación de modelos, cada experimento necesita estadísticas.

## El concepto

### Estadísticas descriptivas: resumen de sus datos

Antes de modelar algo, necesitas saber cómo se ven los datos. Las estadísticas descriptivas comprimen un conjunto de datos en unos pocos números que capturan su forma.

**Measures of central tendency**Respuesta: "¿Dónde está el centro?"

```
Mean:   sum of all values / count
        mu = (1/n) * sum(x_i)

Median: middle value when sorted
        Robust to outliers. If you have [1, 2, 3, 4, 1000], the mean is 202
        but the median is 3.

Mode:   most frequent value
        Useful for categorical data. For continuous data, rarely informative.
```

La media es el punto de equilibrio. La media es la marca de mitad. Cuando divergen, su distribución es sesgada.$\text{mean} \gg \text{median}$Las distribuciones de pérdidas durante el entrenamiento a menudo tienen$\text{mean} \ll \text{median}$(desde la izquierda de las muestras fáciles).

**Measures of spread**Respuesta: "¿Qué tan disperso está el dato?"

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

**Percentiles**El 25o percentil (Q1) significa que el 25% de los valores caen por debajo de este punto. El 50o percentil es la media. El 75o percentil es Q3.

```
For latency monitoring:
  P50 = median latency        (typical user experience)
  P95 = 95th percentile       (bad but not worst case)
  P99 = 99th percentile       (tail latency, often 10x the median)
```

En ML, te importan los percentiles para la latencia de inferencia, las distribuciones de confianza de predicción y la comprensión de las distribuciones de errores. Un modelo con un error promedio bajo pero un error P99 terrible podría ser inútil para aplicaciones críticas a la seguridad.

**Sample vs population statistics.**Al calcular la varianza de una muestra, dividir por $(n-1)$en lugar de$n$Esta es la corrección de Bessel, que compensa el hecho de que su media de muestra no es la media de población real.$n$En el denominador, subestimas sistemáticamente la verdadera variación.$(n-1)$, la estimación es imparcial.

```math
\begin{aligned}
\text{Population variance:} \quad \sigma^2 &= \frac{1}{N} \sum (x_i - \mu)^2 \\
\text{Sample variance:} \quad s^2 &= \frac{1}{n-1} \sum (x_i - \bar{x})^2
\end{aligned}
```

En la práctica: si $n$Si la diferencia es insignificante, la diferencia es muy grande (miles de muestras).$n$Es pequeño (docenas de muestras), importa.

### Correlación: Cómo se mueven las variables juntas

La correlación mide la fuerza y la dirección de una relación lineal entre dos variables.

**Pearson correlation coefficient**medidas de asociación lineal:

```
r = sum((x_i - x_bar)(y_i - y_bar)) / (n * s_x * s_y)

r = +1:  perfect positive linear relationship
r = -1:  perfect negative linear relationship
r =  0:  no linear relationship (but there might be a nonlinear one!)

Range: [-1, 1]
```

Pearson asume que la relación es lineal y ambas variables están distribuidas aproximadamente normalmente. Es sensible a los valores extremos.$r$de 0,1 a 0,9.

**Spearman rank correlation**medidas de asociación monótona:

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

**The golden rule:**La correlación no implica la causalidad. Las ventas de helados y las muertes por ahogamiento están correlacionadas porque ambas aumentan en verano. La precisión de su modelo y el número de parámetros están correlacionados, pero añadir parámetros no mejora automáticamente la precisión (ver: sobreajuste).

### Matriz de covarianza

La covarianza entre dos variables mide cómo varían juntas:

```
Cov(X, Y) = (1/n) * sum((x_i - x_bar)(y_i - y_bar))

Cov(X, Y) > 0:  X and Y tend to increase together
Cov(X, Y) < 0:  when X increases, Y tends to decrease
Cov(X, Y) = 0:  no linear co-movement
```

Para$d$características, la matriz de covarianza $C$es un $d \times d$matriz donde $C[i][j] = \mathop{\mathrm{Cov}}(\text{feature}_i, \text{feature}_j)$Las entradas diagonales$C[i][i]$Las variaciones de cada característica son:

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

**Connection to PCA.**PCA propiocomponen la matriz de covarianza. Los propios vectores son los componentes principales (direcciones de la varianza máxima). Los valores propios le dicen cuánto variación capta cada componente. Esto es exactamente lo que la lección 10 cubrió, pero ahora ve por qué la matriz de covarianza es lo correcto para descomponer: codifica todas las relaciones lineales en pares en sus datos.

**Connection to correlation.**La matriz de correlación es la matriz de covarianza de variables estandarizadas (cada una dividida por su desviación estándar).$[-1, 1]$¿ Qué ?

### Prueba de hipótesis

Las pruebas de hipótesis son un marco para tomar decisiones bajo incertidumbre.

**The setup:**

```
Null hypothesis (H0):        the default assumption, usually "no effect"
Alternative hypothesis (H1): what you are trying to show

Example:
  H0: Model A and Model B have the same accuracy
  H1: Model B has higher accuracy than Model A
```

**The p-value**Es la probabilidad de ver datos tan extremos como lo que observó, suponiendo que H0 es verdad. NO es la probabilidad de que H0 sea verdad.

```
p-value = P(data this extreme | H0 is true)

If p-value < alpha (typically 0.05):
    Reject H0. The result is "statistically significant."
If p-value >= alpha:
    Fail to reject H0. You do not have enough evidence.
    This does NOT mean H0 is true.
```

**Confidence intervals**dar un rango de valores plausibles para un parámetro:

```
95% confidence interval for the mean:
    x_bar +/- z * (s / sqrt(n))

where z = 1.96 for 95% confidence

Interpretation: if you repeated this experiment many times, 95% of the
computed intervals would contain the true mean. It does NOT mean there
is a 95% probability the true mean is in this specific interval.
```

El ancho del intervalo de confianza le dice acerca de la precisión. Los intervalos amplios significan una alta incertidumbre.

### El t-test

La prueba comparó los medios. Hay varios sabores.

**One-sample t-test:**¿Es la media de población diferente de un valor hipotético?

```math
\begin{aligned}
t &= \frac{\bar{x} - \mu_0}{s / \sqrt{n}} \\[4pt]
\text{degrees of freedom} &= n - 1
\end{aligned}
```

**Two-sample t-test (independent):**¿Son dos grupos diferentes?

```
t = (x_bar_1 - x_bar_2) / sqrt(s1^2/n1 + s2^2/n2)

This is Welch's t-test, which does not assume equal variances.
Always use Welch's unless you have a specific reason for equal variances.
```

**Paired t-test:**cuando las mediciones se realicen en parejas (el mismo modelo evaluado en las mismas particiones de datos):

```
Compute d_i = x_i - y_i for each pair
Then run a one-sample t-test on the d_i values against mu_0 = 0
```

En ML, el t-test emparejado es común: ejecutas ambos modelos en los mismos 10 pliegues de validación cruzada y comparas sus puntajes en pareja.

### Prueba en cuadrado de chi

El test de chi-cuadrado comprueba si las frecuencias observadas coinciden con las frecuencias esperadas.

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

### Pruebas A/B para modelos ML

Las pruebas A/B en ML no son lo mismo que las pruebas A/B en la web.

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

### Significancia estadística vs. Significancia práctica

Un resultado puede ser estadísticamente significativo pero prácticamente sin sentido.

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

**Effect size**cuantifica la magnitud de la diferencia, independientemente del tamaño de la muestra:

```math
\begin{aligned}
\text{Cohen's } d &= \frac{\text{mean}_1 - \text{mean}_2}{\text{pooled\_std}} \\[4pt]
d &= 0.2: \quad \text{small effect} \\
d &= 0.5: \quad \text{medium effect} \\
d &= 0.8: \quad \text{large effect}
\end{aligned}
```

Siempre informe tanto el valor p como el tamaño del efecto. El valor p le dice si la diferencia es real. El tamaño del efecto le dice si importa.

### Problemas de comparación múltiples

Cuando se prueban muchas hipótesis, algunas serán "significativas" por casualidad.$\alpha = 0.05$, se espera 1 falso positivo incluso cuando nada es real.

```
P(at least one false positive) = 1 - (1 - alpha)^m

m = 20 tests, alpha = 0.05:
P(false positive) = 1 - 0.95^20 = 0.64

You have a 64% chance of at least one false positive.
```

**Bonferroni correction:**dividir$\alpha$por el número de pruebas.

```
Adjusted alpha = alpha / m = 0.05 / 20 = 0.0025

Only reject H0 if p-value < 0.0025.
Conservative but simple. Works when tests are independent.
```

En ML, esto importa cuando se compara un modelo a través de múltiples métricas, se prueban muchas configuraciones de hiperparámetros o se evalúa en múltiples conjuntos de datos.

### Métodos de arranque

Bootstrapping estima la distribución de muestras de una estadística mediante el replanteamiento de los datos.

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

Esto es más robusto que la prueba de t emparejada porque no hace suposiciones de distribución.

### Pruebas parámétricas vs no parámétricas

**Parametric tests**asumir una distribución específica (generalmente normal):

```
t-test:         assumes normally distributed data (or large n by CLT)
ANOVA:          assumes normality and equal variances
Pearson r:      assumes bivariate normality
```

**Non-parametric tests**no hacer suposiciones de distribución:

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

En los experimentos de ML, por lo general se tienen pequeñas$n$Las pruebas no parámétricas como las de Wilcoxon con rango de firma son a menudo más adecuadas que las pruebas de t.

### Teorema del límite central: implicaciones prácticas

El CLT dice que la distribución de la muestra se acerca a una distribución normal como $n$crece, independientemente de la distribución subyacente de la población.

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

### Errores estadísticos comunes en los documentos de ML

1. **Testing on the training set.**Siempre mantenga datos que el modelo no ve durante el entrenamiento.

2. **No confidence intervals.**La información de un solo número de precisión sin incertidumbre hace que los resultados no sean reproducibles y no puedan ser verificados.

3. **Ignoring multiple comparisons.**Probar 50 configuraciones y reportar la mejor sin corrección inflama tasas falsas positivas.

4. **Confusing statistical and practical significance.**Un valor p de 0,001 en una mejora de precisión del 0,01% no es significativo.

5. **Using accuracy on imbalanced data.**99% de precisión en un conjunto de datos con 99% de clase negativa significa que el modelo no aprendió nada.

6. **Cherry-picking metrics.**Sólo se informa la métrica donde gana el modelo.

7. **Leaking information across train/test splits.**Normalizando antes de dividir, o usando datos futuros para predecir el pasado.

8. **Small test sets with no variance estimates.**La evaluación en 100 muestras y la afirmación de una mejora del 2% es ruido, no señal.

9. **Assuming independence when data is not independent.**Imágenes médicas del mismo paciente, varias frases del mismo documento.

10. **P-hacking.**Probando diferentes pruebas, subconjuntos o criterios de exclusión hasta que obtengas$p < 0.05$El resultado es un artefacto de la búsqueda.

## Construirlo

Implementará:

1. **Descriptive statistics from scratch**(media, media, modo, desviación estándar, percentil, RIC)
2. **Correlation functions**(Pearson y Spearman, con la matriz de covarianza)
3. **Hypothesis tests**(t-test de una muestra, t-test de dos muestras, chi-squared test)
4. **Bootstrap confidence intervals**(para cualquier estadística, no se necesitan suposiciones)
5. **A/B test simulator**(generar datos, probar, verificar si hay errores de tipo I y tipo II)
6. **Statistical vs practical significance demo**(mostrando que grande $n$hace que todo sea "significativo")

Todo desde cero, usando sólo`math`y `random`No hay numpy, no hay scipy.

```figure
f3-bootstrap-resample
```

## Términos clave

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
