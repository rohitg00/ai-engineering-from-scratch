# Статистика для машинного обучения

> Статистика — это то, как вы узнаёте, действительно ли ваша модель работает, или ей просто повезло.

**Тип:** Build
**Язык:** Python
**Предварительные требования:** Фаза 1, Уроки 06 (Вероятность и распределения), 07 (Теорема Байеса)
**Время:** ~120 минут

## Цели обучения

- Вычислить описательные статистики, корреляцию Пирсона/Спирмена и ковариационные матрицы с нуля
- Выполнить проверку гипотез (t-критерий, критерий хи-квадрат) и корректно интерпретировать p-значения и доверительные интервалы
- Использовать бутстрэп-передискретизацию для построения доверительных интервалов для любой метрики без предположений о распределении
- Отличать статистическую значимость от практической значимости с помощью мер величины эффекта

## Проблема

Вы обучили две модели. Модель A показывает 0.87 на тестовом наборе. Модель B — 0.89. Вы развёртываете модель B. Три недели спустя метрики в продакшене хуже, чем раньше. Что произошло?

Модель B на самом деле не превзошла модель A. Разница в 0.02 была шумом. Ваш тестовый набор был слишком мал, или дисперсия слишком высока, или и то, и другое. Вы выкатили случайность, замаскированную под улучшение.

Это происходит постоянно. Перетасовки в таблицах лидеров Kaggle. Статьи, которые не удаётся воспроизвести. A/B-тесты, объявляющие победителя на основе нескольких сотен образцов. Первопричина всегда одна: кто-то пропустил статистику.

Статистика даёт вам инструменты для того, чтобы отличить сигнал от шума. Она говорит вам, когда различие реально, насколько вы должны быть уверены и сколько данных вам нужно, прежде чем можно будет доверять результату. Каждый ML-конвейер, каждое сравнение моделей, каждый эксперимент нуждается в статистике. Без неё вы просто гадаете.

## Концепция

### Описательная статистика: обобщение данных

Прежде чем моделировать что-либо, нужно понять, как выглядят ваши данные. Описательная статистика сжимает набор данных до нескольких чисел, отражающих его форму.

**Меры центральной тенденции** отвечают на вопрос «где середина?»

```
Mean:   sum of all values / count
        mu = (1/n) * sum(x_i)

Median: middle value when sorted
        Robust to outliers. If you have [1, 2, 3, 4, 1000], the mean is 202
        but the median is 3.

Mode:   most frequent value
        Useful for categorical data. For continuous data, rarely informative.
```

Среднее — это точка равновесия. Медиана — это середина. Когда они расходятся, ваше распределение скошено. Распределения доходов имеют среднее >> медианы (правая скошенность из-за миллиардеров). Распределения потерь во время обучения часто имеют среднее << медианы (левая скошенность из-за лёгких образцов).

**Меры разброса** отвечают на вопрос «насколько рассеяны данные?»

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

**Процентили** делят отсортированные данные на 100 равных частей. 25-й процентиль (Q1) означает, что 25% значений находятся ниже этой точки. 50-й процентиль — это медиана. 75-й процентиль — это Q3.

```
For latency monitoring:
  P50 = median latency        (typical user experience)
  P95 = 95th percentile       (bad but not worst case)
  P99 = 99th percentile       (tail latency, often 10x the median)
```

В ML процентили важны для задержки инференса, распределений уверенности предсказаний и понимания распределений ошибок. Модель с низкой средней ошибкой, но ужасной ошибкой P99, может быть бесполезна для приложений, критичных с точки зрения безопасности.

**Выборочная статистика против статистики генеральной совокупности.** При вычислении дисперсии по выборке делите на (n-1) вместо n. Это поправка Бесселя. Она компенсирует тот факт, что выборочное среднее не является истинным средним генеральной совокупности. При n в знаменателе вы систематически недооцениваете истинную дисперсию. При (n-1) оценка несмещена.

```
Population variance: sigma^2 = (1/N) * sum((x_i - mu)^2)
Sample variance:     s^2     = (1/(n-1)) * sum((x_i - x_bar)^2)
```

На практике: если n велико (тысячи образцов), разница незначительна. Если n мало (десятки образцов), это имеет значение.

### Корреляция: как переменные движутся вместе

Корреляция измеряет силу и направление линейной связи между двумя переменными.

**Коэффициент корреляции Пирсона** измеряет линейную связь:

```
r = sum((x_i - x_bar)(y_i - y_bar)) / (n * s_x * s_y)

r = +1:  perfect positive linear relationship
r = -1:  perfect negative linear relationship
r =  0:  no linear relationship (but there might be a nonlinear one!)

Range: [-1, 1]
```

Пирсон предполагает, что связь линейна и обе переменные примерно нормально распределены. Он чувствителен к выбросам. Одна экстремальная точка может утащить r от 0.1 до 0.9.

**Ранговая корреляция Спирмена** измеряет монотонную связь:

```
1. Replace each value with its rank (1, 2, 3, ...)
2. Compute Pearson correlation on the ranks

Spearman catches any monotonic relationship, not just linear.
If y = x^3, Pearson gives r < 1 but Spearman gives rho = 1.
```

**Когда что использовать:**

```
Pearson:    Both variables are continuous and roughly normal.
            You care about the linear relationship specifically.
            No extreme outliers.

Spearman:   Ordinal data (rankings, ratings).
            Data is not normally distributed.
            You suspect a monotonic but not linear relationship.
            Outliers are present.
```

**Золотое правило:** корреляция не подразумевает причинность. Продажи мороженого и случаи утопления коррелируют, потому что оба показателя растут летом. Точность вашей модели и количество параметров коррелируют, но добавление параметров автоматически не улучшает точность (см.: переобучение).

### Ковариационная матрица

Ковариация между двумя переменными измеряет, как они изменяются совместно:

```
Cov(X, Y) = (1/n) * sum((x_i - x_bar)(y_i - y_bar))

Cov(X, Y) > 0:  X and Y tend to increase together
Cov(X, Y) < 0:  when X increases, Y tends to decrease
Cov(X, Y) = 0:  no linear co-movement
```

Для d признаков ковариационная матрица C — это матрица размера d x d, где C[i][j] = Cov(feature_i, feature_j). Диагональные элементы C[i][i] — это дисперсии каждого признака.

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

**Связь с PCA.** PCA раскладывает ковариационную матрицу на собственные векторы и значения. Собственные векторы — это главные компоненты (направления максимальной дисперсии). Собственные значения показывают, сколько дисперсии захватывает каждая компонента. Это именно то, что рассматривалось в Уроке 10, но теперь вы видите, почему именно ковариационную матрицу правильно раскладывать: она кодирует все попарные линейные связи в ваших данных.

**Связь с корреляцией.** Корреляционная матрица — это ковариационная матрица стандартизованных переменных (каждая разделена на своё стандартное отклонение). Корреляция нормализует ковариацию так, чтобы все значения находились в диапазоне [-1, 1].

### Проверка гипотез

Проверка гипотез — это фреймворк для принятия решений в условиях неопределённости. Вы начинаете с утверждения, собираете данные и определяете, согласуются ли данные с этим утверждением.

**Постановка задачи:**

```
Null hypothesis (H0):        the default assumption, usually "no effect"
Alternative hypothesis (H1): what you are trying to show

Example:
  H0: Model A and Model B have the same accuracy
  H1: Model B has higher accuracy than Model A
```

**p-значение** — это вероятность увидеть данные столь же экстремальные, как наблюдаемые, при условии, что H0 истинна. Это НЕ вероятность того, что H0 истинна. Это самое распространённое заблуждение в статистике.

```
p-value = P(data this extreme | H0 is true)

If p-value < alpha (typically 0.05):
    Reject H0. The result is "statistically significant."
If p-value >= alpha:
    Fail to reject H0. You do not have enough evidence.
    This does NOT mean H0 is true.
```

**Доверительные интервалы** дают диапазон правдоподобных значений параметра:

```
95% confidence interval for the mean:
    x_bar +/- z * (s / sqrt(n))

where z = 1.96 for 95% confidence

Interpretation: if you repeated this experiment many times, 95% of the
computed intervals would contain the true mean. It does NOT mean there
is a 95% probability the true mean is in this specific interval.
```

Ширина доверительного интервала говорит о точности. Широкие интервалы означают высокую неопределённость. Узкие интервалы означают, что ваша оценка точна (но не обязательно верна, если ваши данные смещены).

### t-критерий

t-критерий сравнивает средние. Существует несколько его разновидностей.

**Одновыборочный t-критерий:** отличается ли среднее генеральной совокупности от гипотетического значения?

```
t = (x_bar - mu_0) / (s / sqrt(n))

degrees of freedom = n - 1
```

**Двухвыборочный t-критерий (независимый):** различаются ли средние двух групп?

```
t = (x_bar_1 - x_bar_2) / sqrt(s1^2/n1 + s2^2/n2)

This is Welch's t-test, which does not assume equal variances.
Always use Welch's unless you have a specific reason for equal variances.
```

**Парный t-критерий:** когда измерения приходят парами (одна и та же модель оценивается на одних и тех же разбиениях данных):

```
Compute d_i = x_i - y_i for each pair
Then run a one-sample t-test on the d_i values against mu_0 = 0
```

В ML парный t-критерий распространён: вы запускаете обе модели на одних и тех же 10 фолдах кросс-валидации и сравниваете их результаты попарно.

### Критерий хи-квадрат

Критерий хи-квадрат проверяет, соответствуют ли наблюдаемые частоты ожидаемым. Полезен для категориальных данных.

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

### A/B-тестирование ML-моделей

A/B-тестирование в ML — не то же самое, что A/B-тестирование веб-продуктов. Сравнение моделей связано с особыми сложностями:

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

**Процедура:**

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

### Статистическая значимость против практической значимости

Результат может быть статистически значимым, но практически бессмысленным. При достаточном объёме данных даже тривиальное различие становится статистически значимым.

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

**Величина эффекта** количественно оценивает, насколько велико различие, независимо от размера выборки:

```
Cohen's d = (mean_1 - mean_2) / pooled_std

d = 0.2:  small effect
d = 0.5:  medium effect
d = 0.8:  large effect
```

Всегда указывайте и p-значение, и величину эффекта. p-значение говорит вам, реально ли различие. Величина эффекта говорит вам, имеет ли оно значение.

### Проблема множественных сравнений

Когда вы проверяете много гипотез, некоторые окажутся «значимыми» случайно. Если вы проверяете 20 вещей при alpha = 0.05, вы ожидаете 1 ложноположительный результат, даже если ничего реального нет.

```
P(at least one false positive) = 1 - (1 - alpha)^m

m = 20 tests, alpha = 0.05:
P(false positive) = 1 - 0.95^20 = 0.64

You have a 64% chance of at least one false positive.
```

**Поправка Бонферрони:** разделите alpha на количество тестов.

```
Adjusted alpha = alpha / m = 0.05 / 20 = 0.0025

Only reject H0 if p-value < 0.0025.
Conservative but simple. Works when tests are independent.
```

В ML это важно, когда вы сравниваете модель по нескольким метрикам, тестируете множество конфигураций гиперпараметров или оцениваете на нескольких наборах данных.

### Методы бутстрэпа

Бутстрэппинг оценивает выборочное распределение статистики путём передискретизации ваших данных с возвращением. Никаких предположений о базовом распределении не требуется.

**Алгоритм:**

```
1. You have n data points
2. Draw n samples WITH replacement (some points appear multiple times,
   some not at all)
3. Compute your statistic on this bootstrap sample
4. Repeat B times (typically B = 1000 to 10000)
5. The distribution of bootstrap statistics approximates the
   sampling distribution
```

**Бутстрэп-доверительный интервал (процентильный метод):**

```
Sort the B bootstrap statistics
95% CI = [2.5th percentile, 97.5th percentile]
```

**Почему бутстрэп важен для ML:**

```
- Test set accuracy is a point estimate. Bootstrap gives you
  confidence intervals.
- You cannot assume metric distributions are normal (especially
  for AUC, F1, precision at k).
- Bootstrap works for ANY statistic: median, ratio of two means,
  difference in AUC between two models.
- No closed-form formula needed.
```

**Бутстрэп для сравнения моделей:**

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

Это более устойчиво, чем парный t-критерий, потому что не делает никаких предположений о распределении.

### Параметрические и непараметрические тесты

**Параметрические тесты** предполагают конкретное распределение (обычно нормальное):

```
t-test:         assumes normally distributed data (or large n by CLT)
ANOVA:          assumes normality and equal variances
Pearson r:      assumes bivariate normality
```

**Непараметрические тесты** не делают никаких предположений о распределении:

```
Mann-Whitney U:     compares two groups (replaces independent t-test)
Wilcoxon signed-rank: compares paired data (replaces paired t-test)
Spearman rho:       correlation on ranks (replaces Pearson)
Kruskal-Wallis:     compares multiple groups (replaces ANOVA)
```

**Когда использовать непараметрические тесты:**

```
- Small sample size (n < 30) and data is clearly non-normal
- Ordinal data (ratings, rankings)
- Heavy outliers you cannot remove
- Skewed distributions
```

**Когда использовать параметрические тесты:**

```
- Large sample size (CLT makes the test statistic approximately normal)
- Data is roughly symmetric without extreme outliers
- More statistical power (better at detecting real differences)
```

В ML-экспериментах у вас обычно небольшое n (5 или 10 фолдов кросс-валидации), поэтому непараметрические тесты, такие как знаково-ранговый критерий Уилкоксона, часто более уместны, чем t-критерии.

### Центральная предельная теорема: практические следствия

ЦПТ утверждает, что распределение выборочных средних приближается к нормальному распределению по мере роста n, независимо от распределения генеральной совокупности.

```
If X_1, X_2, ..., X_n are iid with mean mu and variance sigma^2:

    X_bar ~ Normal(mu, sigma^2 / n)    as n -> infinity

Works for n >= 30 in most cases.
For highly skewed distributions, you might need n >= 100.
```

**Почему это важно для ML:**

```
1. Justifies confidence intervals and t-tests on aggregated metrics
2. Explains why averaging over cross-validation folds gives stable
   estimates even when individual folds vary wildly
3. Mini-batch gradient descent works because the average gradient
   over a batch approximates the true gradient (CLT in action)
4. Ensemble methods: averaging predictions from many models gives
   more stable output than any single model
```

**Чего ЦПТ НЕ делает:**

```
- Does NOT make your data normal. It makes the MEAN of samples normal.
- Does NOT work for heavy-tailed distributions with infinite variance
  (Cauchy distribution).
- Does NOT apply to dependent data (time series without correction).
```

### Распространённые статистические ошибки в ML-статьях

1. **Тестирование на обучающем наборе.** Гарантирует переобучение. Всегда откладывайте данные, которые модель никогда не видит во время обучения.

2. **Отсутствие доверительных интервалов.** Указание единственного числа точности без неопределённости делает результаты невоспроизводимыми и непроверяемыми.

3. **Игнорирование множественных сравнений.** Тестирование 50 конфигураций и указание лучшей без поправки завышает частоту ложноположительных результатов.

4. **Путаница между статистической и практической значимостью.** p-значение 0.001 при улучшении точности на 0.01% не имеет смысла.

5. **Использование точности на несбалансированных данных.** Точность 99% на наборе данных с 99% отрицательного класса означает, что модель ничему не научилась. Используйте precision, recall, F1 или AUC.

6. **Избирательное указание метрик.** Указание только той метрики, по которой ваша модель выигрывает. Честная оценка указывает все релевантные метрики.

7. **Утечка информации между обучающим и тестовым разбиениями.** Нормализация до разбиения или использование будущих данных для предсказания прошлого.

8. **Маленькие тестовые наборы без оценок дисперсии.** Оценка на 100 образцах и заявление об улучшении на 2% — это шум, а не сигнал.

9. **Предположение о независимости, когда данные не независимы.** Медицинские изображения одного и того же пациента, несколько предложений из одного документа. Наблюдения внутри группы коррелированы.

10. **P-хакинг.** Перебор разных тестов, подмножеств или критериев исключения, пока не будет получено p < 0.05. Результат — артефакт поиска.

## Создаём

Вы реализуете:

1. **Описательную статистику с нуля** (среднее, медиана, мода, стандартное отклонение, процентили, IQR)
2. **Функции корреляции** (Пирсона и Спирмена, с ковариационной матрицей)
3. **Проверку гипотез** (одновыборочный t-критерий, двухвыборочный t-критерий, критерий хи-квадрат)
4. **Бутстрэп-доверительные интервалы** (для любой статистики, без каких-либо предположений)
5. **Симулятор A/B-теста** (генерация данных, тестирование, проверка ошибок первого и второго рода)
6. **Демонстрацию статистической и практической значимости** (показывающую, что большое n делает всё «значимым»)

Всё с нуля, используя только `math` и `random`. Никакого numpy, никакого scipy.

```figure
f3-bootstrap-resample
```

## Ключевые термины

| Термин | Определение |
|---|---|
| Mean | Сумма значений, делённая на их количество. Чувствительно к выбросам. |
| Median | Значение в середине отсортированных данных. Устойчива к выбросам. |
| Standard deviation | Квадратный корень из дисперсии. Измеряет разброс в исходных единицах. |
| Percentile | Значение, ниже которого находится заданный процент данных. |
| IQR | Межквартильный размах. Q3 минус Q1. Разброс средних 50% данных. |
| Pearson correlation | Измеряет линейную связь между двумя переменными. Диапазон [-1, 1]. |
| Spearman correlation | Измеряет монотонную связь с использованием рангов. |
| Covariance matrix | Матрица попарных ковариаций между всеми признаками. |
| Null hypothesis | Умолчательное предположение об отсутствии эффекта или различия. |
| p-value | Вероятность данных настолько же экстремальных при условии истинности нулевой гипотезы. |
| Confidence interval | Диапазон правдоподобных значений параметра при заданном уровне доверия. |
| t-test | Проверяет, значимо ли различаются средние. Использует t-распределение. |
| Chi-squared test | Проверяет, отличаются ли наблюдаемые частоты от ожидаемых. |
| Effect size | Величина различия, независимая от размера выборки. Обычно используется d Коэна. |
| Bonferroni correction | Делит порог значимости на количество тестов для контроля ложноположительных результатов. |
| Bootstrap | Передискретизация с возвращением для оценки выборочных распределений. |
| Type I error | Ложноположительный результат. Отклонение H0, когда она истинна. |
| Type II error | Ложноотрицательный результат. Неспособность отклонить H0, когда она ложна. |
| Statistical power | Вероятность корректно отклонить ложную H0. Мощность = 1 минус доля ошибок второго рода. |
| Central limit theorem | Выборочные средние сходятся к нормальному распределению по мере роста размера выборки. |
| Parametric test | Предполагает конкретное распределение данных (обычно нормальное). |
| Non-parametric test | Не делает никаких предположений о распределении. Работает с рангами или знаками. |
