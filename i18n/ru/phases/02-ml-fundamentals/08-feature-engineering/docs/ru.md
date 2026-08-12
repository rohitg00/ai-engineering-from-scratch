# Проектирование и отбор признаков

> Хороший признак стоит тысячи точек данных.

**Тип:** Build
**Языки:** Python
**Предварительные требования:** Фаза 1 (Статистика для ML, Линейная алгебра), Фаза 2, Уроки 1-7
**Время:** ~90 минут

## Цели обучения

- Реализовать числовые преобразования (стандартизация, min-max масштабирование, логарифмическое преобразование, биннинг) и объяснить, когда уместно применять каждое из них
- Построить one-hot-кодирование, кодирование метками и кодирование по целевой переменной для категориальных признаков и выявить риск утечки данных при кодировании по целевой переменной
- Построить TF-IDF-векторизатор с нуля и объяснить, почему он превосходит простой подсчёт слов при классификации текста
- Применить отбор признаков на основе фильтрующих методов (порог дисперсии, корреляция, взаимная информация) для снижения размерности

## Проблема

У вас есть набор данных. Вы выбираете алгоритм. Вы обучаете его. Результаты посредственные. Вы пробуете более сложный алгоритм. Всё ещё посредственно. Вы тратите неделю на настройку гиперпараметров. Незначительное улучшение.

Затем кто-то преобразует исходные данные в более качественные признаки, и простая логистическая регрессия обгоняет ваш настроенный ансамбль градиентного бустинга.

Это происходит постоянно. В классическом ML представление данных важнее выбора алгоритма. Модель предсказания цены дома с признаками «площадь дома» и «количество спален» превзойдёт модель с признаком «адрес в виде необработанной строки», независимо от того, насколько изощрён алгоритм обучения. Алгоритм может работать только с тем, что вы ему дали.

Проектирование признаков (feature engineering) — это процесс преобразования исходных данных в представления, которые упрощают моделям поиск закономерностей. Отбор признаков (feature selection) — это процесс отбрасывания признаков, добавляющих шум без добавления сигнала. Вместе они представляют собой деятельность с наибольшей отдачей в классическом ML.

## Концепция

### Конвейер признаков

```mermaid
flowchart LR
    A[Raw Data] --> B[Handle Missing Values]
    B --> C[Numerical Transforms]
    B --> D[Categorical Encoding]
    B --> E[Text Features]
    C --> F[Feature Interactions]
    D --> F
    E --> F
    F --> G[Feature Selection]
    G --> H[Model-Ready Data]
```

### Числовые признаки

Необработанные числа редко готовы для модели напрямую. Распространённые преобразования:

**Масштабирование:** Приведение признаков к одному диапазону, чтобы алгоритмы, основанные на расстоянии (K-Means, KNN, SVM), учитывали все признаки одинаково. Min-max масштабирование отображает значения в диапазон [0, 1]. Стандартизация (standardization, z-score) отображает значения к среднему 0 и стандартному отклонению 1.

**Логарифмическое преобразование (log transform):** Сжимает распределения с правой асимметрией (доход, численность населения, количество слов). Превращает мультипликативные зависимости в аддитивные.

**Биннинг (binning):** Преобразует непрерывные значения в категории. Полезен, когда зависимость между признаком и целевой переменной нелинейна, но ступенчата (например, возрастные группы).

**Полиномиальные признаки:** Создают члены x^2, x^3, x1*x2. Позволяют линейным моделям улавливать нелинейные зависимости ценой увеличения числа признаков.

### Категориальные признаки

Моделям нужны числа. Категории нужно кодировать.

**One-hot-кодирование (one-hot encoding):** Создаёт бинарный столбец для каждой категории. "color = red/blue/green" превращается в три столбца: is_red, is_blue, is_green. Хорошо работает для признаков с низкой кардинальностью, но «взрывается» при большом числе категорий.

**Кодирование метками (label encoding):** Отображает каждую категорию в целое число: red=0, blue=1, green=2. Вносит ложный порядок (модель может решить, что green > blue > red). Уместно только для древовидных моделей, которые разбивают данные по отдельным значениям.

**Кодирование по целевой переменной (target encoding):** Заменяет каждую категорию средним значением целевой переменной для этой категории. Мощный, но опасный приём: высокий риск утечки данных. Должно вычисляться только на обучающих данных, а затем применяться к тестовым.

### Текстовые признаки

**Векторизация по числу слов (count vectorizer):** Подсчитывает, сколько раз каждое слово встречается в документе. "the cat sat on the mat" превращается в {the: 2, cat: 1, sat: 1, on: 1, mat: 1}.

**TF-IDF:** Term Frequency-Inverse Document Frequency (частота термина — обратная частота документа). Взвешивает слова по тому, насколько они уникальны среди документов. Частые слова вроде "the" получают низкий вес. Редкие, характерные слова получают высокий вес.

```
TF(word, doc) = count(word in doc) / total words in doc
IDF(word) = log(total docs / docs containing word)
TF-IDF = TF * IDF
```

### Пропущенные значения

В реальных данных есть пробелы. Стратегии:

- **Удаление строк:** Только когда пропущенные данные редки и случайны
- **Импутация средним/медианой (imputation):** Простой способ, сохраняет форму распределения (медиана более устойчива к выбросам)
- **Импутация модой:** Для категориальных признаков
- **Индикаторный столбец:** Добавьте бинарный столбец "was_this_missing" перед импутацией. Сам факт пропуска данных может быть информативным
- **Прямое/обратное заполнение (forward/backward fill):** Для данных временных рядов

### Взаимодействие признаков

Иногда зависимость кроется именно в комбинации. "Height" и "weight" по отдельности менее предсказательны, чем "BMI = weight / height^2". Взаимодействия признаков умножают пространство признаков, поэтому выбирайте нужные комбинации, опираясь на знание предметной области.

### Отбор признаков

Больше признаков — не всегда лучше. Нерелевантные признаки добавляют шум, увеличивают время обучения и могут приводить к переобучению.

**Методы фильтрации (filter methods, применяются до модели):**
- Корреляция: удаление признаков, сильно коррелирующих друг с другом (избыточных)
- Взаимная информация (mutual information): измеряет, насколько знание признака снижает неопределённость относительно целевой переменной
- Порог дисперсии (variance threshold): удаление признаков, которые почти не меняются

**Методы-обёртки (wrapper methods, на основе модели):**
- L1-регуляризация (Lasso): обнуляет веса нерелевантных признаков
- Рекурсивное исключение признаков (recursive feature elimination): обучение, удаление наименее важного признака, повторение

**Почему отбор важен:** Модель с 10 хорошими признаками обычно превосходит модель с теми же 10 хорошими признаками плюс 90 шумных. Шумные признаки дают модели возможность переобучиться на закономерностях обучающих данных, которые не обобщаются.

```figure
feature-scaling
```

## Создаём

### Шаг 1: Числовые преобразования с нуля

```python
import math


def min_max_scale(values):
    min_val = min(values)
    max_val = max(values)
    if max_val == min_val:
        return [0.0] * len(values)
    return [(v - min_val) / (max_val - min_val) for v in values]


def standardize(values):
    n = len(values)
    mean = sum(values) / n
    variance = sum((v - mean) ** 2 for v in values) / n
    std = math.sqrt(variance) if variance > 0 else 1.0
    return [(v - mean) / std for v in values]


def log_transform(values):
    return [math.log(v + 1) for v in values]


def bin_values(values, n_bins=5):
    min_val = min(values)
    max_val = max(values)
    bin_width = (max_val - min_val) / n_bins
    if bin_width == 0:
        return [0] * len(values)
    result = []
    for v in values:
        bin_idx = int((v - min_val) / bin_width)
        bin_idx = min(bin_idx, n_bins - 1)
        result.append(bin_idx)
    return result


def polynomial_features(row, degree=2):
    n = len(row)
    result = list(row)
    if degree >= 2:
        for i in range(n):
            result.append(row[i] ** 2)
        for i in range(n):
            for j in range(i + 1, n):
                result.append(row[i] * row[j])
    return result
```

### Шаг 2: Категориальное кодирование с нуля

```python
def one_hot_encode(values):
    categories = sorted(set(values))
    cat_to_idx = {cat: i for i, cat in enumerate(categories)}
    n_cats = len(categories)

    encoded = []
    for v in values:
        row = [0] * n_cats
        row[cat_to_idx[v]] = 1
        encoded.append(row)

    return encoded, categories


def label_encode(values):
    categories = sorted(set(values))
    cat_to_int = {cat: i for i, cat in enumerate(categories)}
    return [cat_to_int[v] for v in values], cat_to_int


def target_encode(feature_values, target_values, smoothing=10):
    global_mean = sum(target_values) / len(target_values)

    category_stats = {}
    for feat, target in zip(feature_values, target_values):
        if feat not in category_stats:
            category_stats[feat] = {"sum": 0.0, "count": 0}
        category_stats[feat]["sum"] += target
        category_stats[feat]["count"] += 1

    encoding = {}
    for cat, stats in category_stats.items():
        cat_mean = stats["sum"] / stats["count"]
        weight = stats["count"] / (stats["count"] + smoothing)
        encoding[cat] = weight * cat_mean + (1 - weight) * global_mean

    return [encoding[v] for v in feature_values], encoding
```

### Шаг 3: Текстовые признаки с нуля

```python
def count_vectorize(documents):
    vocab = {}
    idx = 0
    for doc in documents:
        for word in doc.lower().split():
            if word not in vocab:
                vocab[word] = idx
                idx += 1

    vectors = []
    for doc in documents:
        vec = [0] * len(vocab)
        for word in doc.lower().split():
            vec[vocab[word]] += 1
        vectors.append(vec)

    return vectors, vocab


def tfidf(documents):
    n_docs = len(documents)

    vocab = {}
    idx = 0
    for doc in documents:
        for word in doc.lower().split():
            if word not in vocab:
                vocab[word] = idx
                idx += 1

    doc_freq = {}
    for doc in documents:
        seen = set()
        for word in doc.lower().split():
            if word not in seen:
                doc_freq[word] = doc_freq.get(word, 0) + 1
                seen.add(word)

    vectors = []
    for doc in documents:
        words = doc.lower().split()
        word_count = len(words)
        tf_map = {}
        for word in words:
            tf_map[word] = tf_map.get(word, 0) + 1

        vec = [0.0] * len(vocab)
        for word, count in tf_map.items():
            tf = count / word_count
            idf = math.log(n_docs / doc_freq[word])
            vec[vocab[word]] = tf * idf
        vectors.append(vec)

    return vectors, vocab
```

### Шаг 4: Импутация пропущенных значений с нуля

```python
def impute_mean(values):
    present = [v for v in values if v is not None]
    if not present:
        return [0.0] * len(values), 0.0
    mean = sum(present) / len(present)
    return [v if v is not None else mean for v in values], mean


def impute_median(values):
    present = sorted(v for v in values if v is not None)
    if not present:
        return [0.0] * len(values), 0.0
    n = len(present)
    if n % 2 == 0:
        median = (present[n // 2 - 1] + present[n // 2]) / 2
    else:
        median = present[n // 2]
    return [v if v is not None else median for v in values], median


def impute_mode(values):
    present = [v for v in values if v is not None]
    if not present:
        return values, None
    counts = {}
    for v in present:
        counts[v] = counts.get(v, 0) + 1
    mode = max(counts, key=counts.get)
    return [v if v is not None else mode for v in values], mode


def add_missing_indicator(values):
    return [0 if v is not None else 1 for v in values]
```

### Шаг 5: Отбор признаков с нуля

```python
def correlation(x, y):
    n = len(x)
    mean_x = sum(x) / n
    mean_y = sum(y) / n
    cov = sum((xi - mean_x) * (yi - mean_y) for xi, yi in zip(x, y)) / n
    std_x = math.sqrt(sum((xi - mean_x) ** 2 for xi in x) / n)
    std_y = math.sqrt(sum((yi - mean_y) ** 2 for yi in y) / n)
    if std_x == 0 or std_y == 0:
        return 0.0
    return cov / (std_x * std_y)


def mutual_information(feature, target, n_bins=10):
    feat_min = min(feature)
    feat_max = max(feature)
    bin_width = (feat_max - feat_min) / n_bins if feat_max != feat_min else 1.0
    feat_binned = [
        min(int((f - feat_min) / bin_width), n_bins - 1) for f in feature
    ]

    n = len(feature)
    target_classes = sorted(set(target))

    feat_bins = sorted(set(feat_binned))
    p_feat = {}
    for b in feat_bins:
        p_feat[b] = feat_binned.count(b) / n

    p_target = {}
    for t in target_classes:
        p_target[t] = target.count(t) / n

    mi = 0.0
    for b in feat_bins:
        for t in target_classes:
            joint_count = sum(
                1 for fb, tv in zip(feat_binned, target) if fb == b and tv == t
            )
            p_joint = joint_count / n
            if p_joint > 0:
                mi += p_joint * math.log(p_joint / (p_feat[b] * p_target[t]))

    return mi


def variance_threshold(features, threshold=0.01):
    n_features = len(features[0])
    n_samples = len(features)
    selected = []

    for j in range(n_features):
        col = [features[i][j] for i in range(n_samples)]
        mean = sum(col) / n_samples
        var = sum((v - mean) ** 2 for v in col) / n_samples
        if var >= threshold:
            selected.append(j)

    return selected


def remove_correlated(features, threshold=0.9):
    n_features = len(features[0])
    n_samples = len(features)

    to_remove = set()
    for i in range(n_features):
        if i in to_remove:
            continue
        col_i = [features[r][i] for r in range(n_samples)]
        for j in range(i + 1, n_features):
            if j in to_remove:
                continue
            col_j = [features[r][j] for r in range(n_samples)]
            corr = abs(correlation(col_i, col_j))
            if corr >= threshold:
                to_remove.add(j)

    return [i for i in range(n_features) if i not in to_remove]
```

### Шаг 6: Полный конвейер и демонстрация

```python
import random


def make_housing_data(n=200, seed=42):
    random.seed(seed)
    data = []
    for _ in range(n):
        sqft = random.uniform(500, 5000)
        bedrooms = random.choice([1, 2, 3, 4, 5])
        age = random.uniform(0, 50)
        neighborhood = random.choice(["downtown", "suburbs", "rural"])
        has_pool = random.choice([True, False])

        sqft_with_missing = sqft if random.random() > 0.05 else None
        age_with_missing = age if random.random() > 0.08 else None

        price = (
            50 * sqft
            + 20000 * bedrooms
            - 1000 * age
            + (50000 if neighborhood == "downtown" else 10000 if neighborhood == "suburbs" else 0)
            + (15000 if has_pool else 0)
            + random.gauss(0, 20000)
        )

        data.append({
            "sqft": sqft_with_missing,
            "bedrooms": bedrooms,
            "age": age_with_missing,
            "neighborhood": neighborhood,
            "has_pool": has_pool,
            "price": price,
        })
    return data


if __name__ == "__main__":
    data = make_housing_data(200)

    print("=== Raw Data Sample ===")
    for row in data[:3]:
        print(f"  {row}")

    sqft_raw = [d["sqft"] for d in data]
    age_raw = [d["age"] for d in data]
    prices = [d["price"] for d in data]

    print("\n=== Missing Value Handling ===")
    sqft_missing = sum(1 for v in sqft_raw if v is None)
    age_missing = sum(1 for v in age_raw if v is None)
    print(f"  sqft missing: {sqft_missing}/{len(sqft_raw)}")
    print(f"  age missing: {age_missing}/{len(age_raw)}")

    sqft_indicator = add_missing_indicator(sqft_raw)
    age_indicator = add_missing_indicator(age_raw)
    sqft_imputed, sqft_fill = impute_median(sqft_raw)
    age_imputed, age_fill = impute_mean(age_raw)
    print(f"  sqft filled with median: {sqft_fill:.0f}")
    print(f"  age filled with mean: {age_fill:.1f}")

    print("\n=== Numerical Transforms ===")
    sqft_scaled = standardize(sqft_imputed)
    age_scaled = min_max_scale(age_imputed)
    sqft_log = log_transform(sqft_imputed)
    age_binned = bin_values(age_imputed, n_bins=5)
    print(f"  sqft standardized: mean={sum(sqft_scaled)/len(sqft_scaled):.4f}, std={math.sqrt(sum(v**2 for v in sqft_scaled)/len(sqft_scaled)):.4f}")
    print(f"  age min-max: [{min(age_scaled):.2f}, {max(age_scaled):.2f}]")
    print(f"  age bins: {sorted(set(age_binned))}")

    print("\n=== Categorical Encoding ===")
    neighborhoods = [d["neighborhood"] for d in data]

    ohe, ohe_cats = one_hot_encode(neighborhoods)
    print(f"  One-hot categories: {ohe_cats}")
    print(f"  Sample encoding: {neighborhoods[0]} -> {ohe[0]}")

    le, le_map = label_encode(neighborhoods)
    print(f"  Label encoding map: {le_map}")

    te, te_map = target_encode(neighborhoods, prices, smoothing=10)
    print(f"  Target encoding: {({k: round(v) for k, v in te_map.items()})}")

    print("\n=== Text Features ===")
    descriptions = [
        "large modern house with pool",
        "small cozy cottage near downtown",
        "spacious family home with large yard",
        "modern apartment downtown with view",
        "rustic cabin in rural area",
    ]
    cv, cv_vocab = count_vectorize(descriptions)
    print(f"  Vocabulary size: {len(cv_vocab)}")
    print(f"  Doc 0 non-zero features: {sum(1 for v in cv[0] if v > 0)}")

    tf, tf_vocab = tfidf(descriptions)
    print(f"  TF-IDF vocabulary size: {len(tf_vocab)}")
    top_words = sorted(tf_vocab.keys(), key=lambda w: tf[0][tf_vocab[w]], reverse=True)[:3]
    print(f"  Doc 0 top TF-IDF words: {top_words}")

    print("\n=== Polynomial Features ===")
    sample_row = [sqft_scaled[0], age_scaled[0]]
    poly = polynomial_features(sample_row, degree=2)
    print(f"  Input: {[round(v, 4) for v in sample_row]}")
    print(f"  Polynomial: {[round(v, 4) for v in poly]}")
    print(f"  Features: [x1, x2, x1^2, x2^2, x1*x2]")

    print("\n=== Feature Selection ===")
    feature_matrix = [
        [sqft_scaled[i], age_scaled[i], float(sqft_indicator[i]), float(age_indicator[i])]
        + ohe[i]
        for i in range(len(data))
    ]

    print(f"  Total features: {len(feature_matrix[0])}")

    surviving_var = variance_threshold(feature_matrix, threshold=0.01)
    print(f"  After variance threshold (0.01): {len(surviving_var)} features kept")

    surviving_corr = remove_correlated(feature_matrix, threshold=0.9)
    print(f"  After correlation filter (0.9): {len(surviving_corr)} features kept")

    binary_prices = [1 if p > sum(prices) / len(prices) else 0 for p in prices]
    print("\n  Mutual information with target:")
    feature_names = ["sqft", "age", "sqft_missing", "age_missing"] + [f"neigh_{c}" for c in ohe_cats]
    for j in range(len(feature_matrix[0])):
        col = [feature_matrix[i][j] for i in range(len(feature_matrix))]
        mi = mutual_information(col, binary_prices, n_bins=10)
        print(f"    {feature_names[j]}: MI={mi:.4f}")

    print("\n  Correlation with price:")
    for j in range(len(feature_matrix[0])):
        col = [feature_matrix[i][j] for i in range(len(feature_matrix))]
        corr = correlation(col, prices)
        print(f"    {feature_names[j]}: r={corr:.4f}")
```

## Применяем

В scikit-learn эти преобразования компонуются в конвейеры (pipelines):

```python
from sklearn.preprocessing import StandardScaler, OneHotEncoder, PolynomialFeatures
from sklearn.impute import SimpleImputer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.feature_selection import mutual_info_classif, VarianceThreshold
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline

numeric_pipe = Pipeline([
    ("imputer", SimpleImputer(strategy="median")),
    ("scaler", StandardScaler()),
])

categorical_pipe = Pipeline([
    ("encoder", OneHotEncoder(sparse_output=False)),
])

preprocessor = ColumnTransformer([
    ("num", numeric_pipe, ["sqft", "age"]),
    ("cat", categorical_pipe, ["neighborhood"]),
])
```

Версии, реализованные с нуля, показывают, что именно происходит внутри каждого преобразования. Библиотечные версии добавляют обработку граничных случаев, поддержку разреженных матриц и композицию конвейеров, но математика та же.

## Публикуем

Этот урок производит:
- `outputs/prompt-feature-engineer.md` - промпт для системного проектирования признаков из исходных данных

## Упражнения

1. Добавьте устойчивое масштабирование (robust scaling) (используя медиану и межквартильный размах вместо среднего и стандартного отклонения) к числовым преобразованиям. Сравните его со стандартным масштабированием на данных с экстремальными выбросами.
2. Реализуйте кодирование по целевой переменной по методу leave-one-out: для каждой строки вычисляйте среднее целевой переменной, исключая собственное значение целевой переменной этой строки. Покажите, как это снижает переобучение по сравнению с наивным кодированием по целевой переменной.
3. Постройте автоматизированный конвейер отбора признаков, объединяющий порог дисперсии, фильтрацию по корреляции и ранжирование по взаимной информации. Примените его к набору данных о недвижимости и сравните производительность модели (используя простую линейную регрессию) на всех признаках и на отобранных признаках.

## Ключевые термины

| Термин | Что говорят люди | Что это на самом деле означает |
|------|----------------|----------------------|
| Feature engineering | «Делаем новые столбцы» | Преобразование исходных данных в представления, которые раскрывают закономерности для модели |
| Standardization | «Приводим к нормальному виду» | Вычитание среднего и деление на стандартное отклонение, чтобы признак имел среднее 0 и стандартное отклонение 1 |
| One-hot encoding | «Делаем фиктивные переменные» | Создание одного бинарного столбца на каждую категорию, где для каждой строки ровно один столбец равен 1 |
| Target encoding | «Используем ответ, чтобы закодировать» | Замена каждой категории средним значением целевой переменной для этой категории со сглаживанием, предотвращающим переобучение |
| TF-IDF | «Навороченный подсчёт слов» | Term Frequency, умноженная на Inverse Document Frequency: слова взвешиваются по тому, насколько они характерны для корпуса |
| Imputation | «Заполняем пробелы» | Замена пропущенных значений оценёнными (средним, медианой, модой или предсказанием модели) |
| Feature selection | «Выбрасываем плохие столбцы» | Удаление признаков, добавляющих шум или избыточность, с сохранением только тех, что несут сигнал о целевой переменной |
| Mutual information | «Насколько одно говорит о другом» | Мера снижения неопределённости относительно переменной Y, достигаемого за счёт наблюдения переменной X |
| Data leakage | «Случайно сжульничали» | Использование при обучении информации, недоступной в момент предсказания, что даёт ложно оптимистичные результаты |

## Дополнительные материалы

- [Feature Engineering and Selection (Max Kuhn & Kjell Johnson)](http://www.feat.engineering/) - бесплатная онлайн-книга, охватывающая весь ландшафт проектирования признаков
- [scikit-learn Preprocessing Guide](https://scikit-learn.org/stable/modules/preprocessing.html) - практический справочник по всем стандартным преобразованиям
- [Target Encoding Done Right (Micci-Barreca, 2001)](https://dl.acm.org/doi/10.1145/507533.507538) - оригинальная статья о кодировании по целевой переменной со сглаживанием
