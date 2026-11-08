# Estatísticas para aprendizado de máquina

> A estatística é como se sabe se o seu modelo funciona ou só teve sorte.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 06 (Probability and Distributions), 07 (Bayes' Theorem)
**Time:** ~120 minutes

## Objetivos de aprendizagem

- Computa estatísticas descrittivas, correlação Pearson/Spearman e matrizes de covariância a partir do zero
- Realizar testes de hipótese (t-test, chi-quadrado) e interpretar corretamente os valores de p e os intervalos de confiança
- Use bootstrap resampling para construir intervalos de confiança para qualquer métrica sem suposições distributivas
- Distinguir significância estatística da significância prática utilizando medidas de tamanho do efeito

## O problema

Treinou dois modelos, o modelo A tem 0,87 em seu conjunto de testes, o modelo B 0,89.

O modelo B não superou o modelo A. A diferença de 0,02 foi ruído. O seu conjunto de teste foi muito pequeno, ou a variância muito alta, ou ambos.

Isto acontece constantemente. O ranking de um cartão de vendas é alterado. Papéis que não se reproduzem. Testes A/B que declaram vencedores com base em algumas centenas de amostras. A causa é sempre a mesma: alguém saiu das estatísticas.

A estatística dá-lhe as ferramentas para distinguir sinal do ruído. Ela diz-lhe quando uma diferença é real, quão confiante você deve ser e quantos dados você precisa antes de confiar em um resultado.

## O conceito

### Estatísticas descritivas: Resumindo os dados

Antes de modelar qualquer coisa, é preciso saber como são os dados.

**Measures of central tendency**Resposta: "Onde está o meio?"

```
Mean:   sum of all values / count
        mu = (1/n) * sum(x_i)

Median: middle value when sorted
        Robust to outliers. If you have [1, 2, 3, 4, 1000], the mean is 202
        but the median is 3.

Mode:   most frequent value
        Useful for categorical data. For continuous data, rarely informative.
```

A média é o ponto de equilíbrio. A média é a marca de meio caminho. Quando divergem, a sua distribuição é distorcida.$\text{mean} \gg \text{median}$As distribuições de perdas durante o treino muitas vezes têm$\text{mean} \ll \text{median}$(desvio esquerdo de amostras fáceis).

**Measures of spread**Resposta: "Quão disperso está o dados?"

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

**Percentiles**Divida os dados classificados em 100 partes iguais. O 25o percentil (Q1) significa que 25% dos valores caem abaixo deste ponto. O 50o percentil é a média. O 75o percentil é Q3.

```
For latency monitoring:
  P50 = median latency        (typical user experience)
  P95 = 95th percentile       (bad but not worst case)
  P99 = 99th percentile       (tail latency, often 10x the median)
```

Em ML, você se importa com percentil para latência de inferência, distribuições de confiança de previsão e distribuições de erro de compreensão. Um modelo com erro médio baixo, mas erro P99 terrível pode ser inútil para aplicações críticas à segurança.

**Sample vs population statistics.**Ao calcular a variância de uma amostra, divide por $(n-1)$Em vez de$n$Esta correcção de Bessel compensa o facto de a média da amostra não ser a média da população.$n$No denominador, subestimamos sistematicamente a verdadeira variância.$(n-1)$A estimativa é imparcial.

```math
\begin{aligned}
\text{Population variance:} \quad \sigma^2 &= \frac{1}{N} \sum (x_i - \mu)^2 \\
\text{Sample variance:} \quad s^2 &= \frac{1}{n-1} \sum (x_i - \bar{x})^2
\end{aligned}
```

Na prática: se $n$Se a diferença é grande (milhares de amostras), é insignificante.$n$É pequeno (dezenas de amostras), importa.

### Correlação: Como as variáveis se movem juntas

A correlação mede a força e a direção de uma relação linear entre duas variáveis.

**Pearson correlation coefficient**Medidas de associação linear:

```
r = sum((x_i - x_bar)(y_i - y_bar)) / (n * s_x * s_y)

r = +1:  perfect positive linear relationship
r = -1:  perfect negative linear relationship
r =  0:  no linear relationship (but there might be a nonlinear one!)

Range: [-1, 1]
```

Pearson assume que a relação é linear e ambas as variáveis são distribuídas aproximadamente normalmente. É sensível a valores fora do horizonte.$r$de 0,1 a 0,9.

**Spearman rank correlation**Medidas de associação monótona:

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

**The golden rule:**A correlação não implica a causalidade. As vendas de gelados e as mortes por afogamento estão correlacionadas porque ambas aumentam no verão. A precisão do modelo e o número de parâmetros estão correlacionados, mas adicionar parâmetros não melhora automaticamente a precisão (ver: sobre-ajustamento).

### Matriz de covariância

A covariância entre duas variáveis mede a sua variação conjunta:

```
Cov(X, Y) = (1/n) * sum((x_i - x_bar)(y_i - y_bar))

Cov(X, Y) > 0:  X and Y tend to increase together
Cov(X, Y) < 0:  when X increases, Y tends to decrease
Cov(X, Y) = 0:  no linear co-movement
```

Para o$d$características, a matriz de covariância $C$é um $d \times d$matriz onde $C[i][j] = \mathop{\mathrm{Cov}}(\text{feature}_i, \text{feature}_j)$As entradas diagonais$C[i][i]$são as variações de cada característica.

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

**Connection to PCA.**O PCA compõe a matriz de covariância. Os vetores próprios são os componentes principais (direções de variância máxima). Os valores próprios dizem-lhe quanta variância cada componente capta. Isto é exatamente o que a lição 10 cobriu, mas agora você vê por que a matriz de covariância é a coisa certa para se descompor: ele codifica todas as relações lineares em pares em seus dados.

**Connection to correlation.**A matriz de correlação é a matriz de covariância de variáveis padronizadas (cada uma dividida por seu desvio padrão).$[-1, 1]$- Não .

### Teste de hipóteses

Testes de hipóteses são um quadro para tomar decisões sob incerteza. Começa com uma alegação, coleta dados e determina se os dados são consistentes com a alegação.

**The setup:**

```
Null hypothesis (H0):        the default assumption, usually "no effect"
Alternative hypothesis (H1): what you are trying to show

Example:
  H0: Model A and Model B have the same accuracy
  H1: Model B has higher accuracy than Model A
```

**The p-value**É a probabilidade de ver dados tão extremos quanto o que você observou, supondo que H0 é verdade.

```
p-value = P(data this extreme | H0 is true)

If p-value < alpha (typically 0.05):
    Reject H0. The result is "statistically significant."
If p-value >= alpha:
    Fail to reject H0. You do not have enough evidence.
    This does NOT mean H0 is true.
```

**Confidence intervals**indicar uma faixa de valores plausíveis para um parâmetro:

```
95% confidence interval for the mean:
    x_bar +/- z * (s / sqrt(n))

where z = 1.96 for 95% confidence

Interpretation: if you repeated this experiment many times, 95% of the
computed intervals would contain the true mean. It does NOT mean there
is a 95% probability the true mean is in this specific interval.
```

O comprimento do intervalo de confiança diz-lhe sobre a precisão. intervalos largos significam alta incerteza. intervalos estreitos significam que a sua estimativa é precisa (mas não necessariamente precisa, se os seus dados são tendenciosos).

### O teste t

O teste t compara os meios.

**One-sample t-test:**A média populacional é diferente de um valor hipotético?

```math
\begin{aligned}
t &= \frac{\bar{x} - \mu_0}{s / \sqrt{n}} \\[4pt]
\text{degrees of freedom} &= n - 1
\end{aligned}
```

**Two-sample t-test (independent):**São dois grupos significados diferentes?

```
t = (x_bar_1 - x_bar_2) / sqrt(s1^2/n1 + s2^2/n2)

This is Welch's t-test, which does not assume equal variances.
Always use Welch's unless you have a specific reason for equal variances.
```

**Paired t-test:**Quando as medições forem realizadas em pares (o mesmo modelo avaliado em partes de dados):

```
Compute d_i = x_i - y_i for each pair
Then run a one-sample t-test on the d_i values against mu_0 = 0
```

No ML, o teste de t em par é comum: você executa ambos os modelos nas mesmas 10 dobras de validação cruzada e compara as suas pontuações em pares.

### Teste em quadrado de chi

O teste de chi-quadrado verifica se as frequências observadas correspondem às frequências esperadas.

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

### Teste A/B para modelos ML

A análise A/B em ML não é a mesma que a análise A/B na web. A comparação de modelos apresenta desafios específicos:

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

### Significância estatística vs. Significância prática

Um resultado pode ser estatisticamente significativo, mas praticamente sem significado. Com dados suficientes, até mesmo uma diferença trivial se torna estatisticamente significativa.

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

**Effect size**quantifica a grandeza da diferença, independentemente do tamanho da amostra:

```math
\begin{aligned}
\text{Cohen's } d &= \frac{\text{mean}_1 - \text{mean}_2}{\text{pooled\_std}} \\[4pt]
d &= 0.2: \quad \text{small effect} \\
d &= 0.5: \quad \text{medium effect} \\
d &= 0.8: \quad \text{large effect}
\end{aligned}
```

Sempre informe o p-valor e o tamanho do efeito. O p-valor diz-lhe se a diferença é real.

### Problemas de Comparação múltipla

Quando testamos muitas hipóteses, algumas serão "significativas" por acaso.$\alpha = 0.05$, você espera 1 falso positivo mesmo quando nada é real.

```
P(at least one false positive) = 1 - (1 - alpha)^m

m = 20 tests, alpha = 0.05:
P(false positive) = 1 - 0.95^20 = 0.64

You have a 64% chance of at least one false positive.
```

**Bonferroni correction:**Dividir$\alpha$pelo número de testes.

```
Adjusted alpha = alpha / m = 0.05 / 20 = 0.0025

Only reject H0 if p-value < 0.0025.
Conservative but simple. Works when tests are independent.
```

No ML, isso importa quando você compara um modelo em várias métricas, testa muitas configurações de hiperparâmetros ou avalia em múltiplos conjuntos de dados.

### Métodos de bootstrap

O Bootstrapping estima a distribuição de amostragem de uma estatística re-amostragem de seus dados com substituição.

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

Este é mais robusto do que o teste de t emparelhado porque não faz suposições distributivas.

### Ensaios paramétricos versus não paramétricos

**Parametric tests**Assumir uma distribuição específica (geralmente normal):

```
t-test:         assumes normally distributed data (or large n by CLT)
ANOVA:          assumes normality and equal variances
Pearson r:      assumes bivariate normality
```

**Non-parametric tests**Não fazer suposições de distribuição:

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

Em experiências de ML, normalmente temos pequenos$n$(5 ou 10 dobras de validação cruzada), por isso os testes não paramétricos como o de classificação assinada da Wilcoxon são muitas vezes mais adequados do que os testes t.

### Teorema do limite central: implicações práticas

O CLT diz que a distribuição da amostra se aproxima de uma distribuição normal como $n$A população cresce, independentemente da distribuição subjacente.

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

### Erros estatísticos comuns nos artigos ML

1. **Testing on the training set.**Garantia de sobreajuste, sempre forneça dados que o modelo nunca vê durante o treinamento.

2. **No confidence intervals.**Relatar um único número de precisão sem incerteza torna os resultados irreprodutíveis e não verificáveis.

3. **Ignoring multiple comparisons.**Testar 50 configurações e relatar a melhor sem correcção aumenta as taxas falsas positivas.

4. **Confusing statistical and practical significance.**Um p-valor de 0,001 em uma melhora de precisão de 0,01% não é significativo.

5. **Using accuracy on imbalanced data.**99% de precisão num conjunto de dados com 99% classe negativa significa que o modelo não aprendeu nada.

6. **Cherry-picking metrics.**Só relatar as métricas em que o seu modelo ganha.

7. **Leaking information across train/test splits.**Normalização antes de dividir, ou usando dados futuros para prever o passado.

8. **Small test sets with no variance estimates.**A avaliação em 100 amostras e a afirmação de uma melhoria de 2% é ruído, não sinal.

9. **Assuming independence when data is not independent.**Imagens médicas do mesmo paciente, várias frases do mesmo documento.

10. **P-hacking.**Tentar diferentes testes, subconjuntos ou critérios de exclusão até conseguir.$p < 0.05$O resultado é um artefato da busca.

## Construindo-o

Implementarão:

1. **Descriptive statistics from scratch**(média, média, modo, desvio padrão, percêntulos, RQI)
2. **Correlation functions**(Pearson e Spearman, com a matriz de covariância)
3. **Hypothesis tests**(teste de uma amostra, teste de duas amostras, teste de chi-quadrado)
4. **Bootstrap confidence intervals**(para qualquer estatística, não são necessárias suposições)
5. **A/B test simulator**(Generar dados, testar, verificar os erros de tipo I e tipo II)
6. **Statistical vs practical significance demo**(mostrando que grande $n$torna tudo "significativo")

Tudo do zero, usando apenas`math`E ...`random`Não há cretinos, nem cretinos.

```figure
f3-bootstrap-resample
```

## Termos-chave

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
