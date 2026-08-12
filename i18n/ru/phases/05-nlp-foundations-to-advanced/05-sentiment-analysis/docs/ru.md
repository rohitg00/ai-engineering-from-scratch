# Анализ тональности

> Каноническая задача NLP. Здесь проявляется почти всё, что нужно знать о классической классификации текста.

**Тип:** Build
**Языки:** Python
**Предварительные требования:** Фаза 5, урок 02 (BoW + TF-IDF), Фаза 2, урок 14 (Наивный байесовский классификатор)
**Время:** ~75 минут

## Проблема

«Еда была не очень.» Положительный отзыв или отрицательный?

Тональность звучит просто. Рецензент сказал, что ему что-то понравилось или не понравилось. Разметьте предложение. Причина, по которой это стало канонической задачей NLP, в том, что за каждым лёгким на вид случаем прячется трудный. Отрицание переворачивает смысл. Сарказм инвертирует его. «Совсем неплохо» — положительный отзыв, несмотря на два слова с отрицательной окраской. Эмодзи несут больше сигнала, чем окружающий текст. Важна доменная лексика (`tight` в рецензии на музыку против `tight` в рецензии на одежду).

Тональность — это рабочая лаборатория для классического NLP. Если вы понимаете, почему у каждого наивного базового решения есть свой конкретный режим отказа, вы понимаете, почему была изобретена каждая более богатая модель. Этот урок строит базовое решение на наивном байесовском классификаторе с нуля, добавляет логистическую регрессию и называет ловушки, которые превращают продакшен-анализ тональности в задачу уровня комплаенса.

## Концепция

Классическая тональность — это рецепт из двух шагов.

1. **Представить.** Превратить текст в вектор признаков. BoW, TF-IDF или n-граммы.
2. **Классифицировать.** Обучить линейную модель (наивный байесовский классификатор, логистическая регрессия, SVM) на размеченных примерах.

Наивный байесовский классификатор — самая тупая модель, которая работает. Предположите, что каждый признак независим при условии метки. Оцените `P(word | positive)` и `P(word | negative)` по счётчикам. На инференсе перемножьте вероятности. Предположение о независимости, давшее классификатору слово «наивный», нелепо ошибочно, и тем не менее результаты поразительно сильны. Причина: на разреженных текстовых признаках и умеренном объёме данных классификатору важнее, в какую сторону склоняется каждое слово, чем насколько сильно.

Логистическая регрессия исправляет предположение о независимости. Она обучает вес для каждого признака, включая отрицательные веса. Биграмма `not good` получает отрицательный вес как признак. Наивный байесовский классификатор не может сделать этого для биграмм, которых он никогда не видел размеченными.

```figure
sentiment-logits
```

## Создаём

### Шаг 1: настоящий мини-набор данных

```python
POSITIVE = [
    "absolutely loved this movie",
    "beautiful cinematography and a great story",
    "one of the best films of the year",
    "brilliant acting from the lead",
    "heartwarming and funny",
]

NEGATIVE = [
    "boring and far too long",
    "not worth your time",
    "the plot made no sense",
    "terrible acting, awful script",
    "i want my two hours back",
]
```

Маленький намеренно. Реальная работа использует десятки тысяч примеров (IMDb, SST-2, Yelp polarity). Математика та же самая.

### Шаг 2: мультиномиальный наивный байесовский классификатор с нуля

```python
import math
from collections import Counter


def train_nb(docs_by_class, vocab, alpha=1.0):
    class_priors = {}
    class_word_probs = {}
    total_docs = sum(len(d) for d in docs_by_class.values())

    for cls, docs in docs_by_class.items():
        class_priors[cls] = len(docs) / total_docs
        counts = Counter()
        for doc in docs:
            for token in doc:
                counts[token] += 1
        total = sum(counts.values()) + alpha * len(vocab)
        class_word_probs[cls] = {
            w: (counts[w] + alpha) / total for w in vocab
        }
    return class_priors, class_word_probs


def predict_nb(doc, class_priors, class_word_probs):
    scores = {}
    for cls in class_priors:
        s = math.log(class_priors[cls])
        for token in doc:
            if token in class_word_probs[cls]:
                s += math.log(class_word_probs[cls][token])
        scores[cls] = s
    return max(scores, key=scores.get)
```

Аддитивное сглаживание (alpha=1.0) — это сглаживание Лапласа. Без него слово, невиданное в классе, получает нулевую вероятность, и логарифм взрывается. `alpha=0.01` — распространённый выбор на практике. `alpha=1.0` — учебное значение по умолчанию.

### Шаг 3: логистическая регрессия с нуля

```python
import numpy as np


def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -20, 20)))


def train_lr(X, y, epochs=500, lr=0.05, l2=0.01):
    n_features = X.shape[1]
    w = np.zeros(n_features)
    b = 0.0
    for _ in range(epochs):
        logits = X @ w + b
        preds = sigmoid(logits)
        err = preds - y
        grad_w = X.T @ err / len(y) + l2 * w
        grad_b = err.mean()
        w -= lr * grad_w
        b -= lr * grad_b
    return w, b


def predict_lr(X, w, b):
    return (sigmoid(X @ w + b) >= 0.5).astype(int)
```

L2-регуляризация здесь важна. Текстовые признаки разрежены; без L2 модель заучивает обучающие примеры наизусть. Начните с `0.01` и подстройте.

### Шаг 4: обработка отрицания (режим отказа)

Рассмотрим «нехорошо» и «неплохо». Классификатор на BoW видит `{not, good}` и `{not, bad}` и учится на том, что чаще встречалось в обучении. Классификатор на биграммах видит `not_good` и `not_bad` и учится на них как на различных признаках. Обычно этого достаточно.

Более грубое исправление, которое работает, когда у вас нет биграмм: **скоупинг отрицания (negation scoping)**. Добавьте префикс `NOT_` к токенам после слова отрицания вплоть до следующего знака пунктуации.

```python
NEGATION_WORDS = {"not", "no", "never", "nor", "none", "nothing", "neither"}
NEGATION_TERMINATORS = {".", "!", "?", ",", ";"}


def apply_negation(tokens):
    out = []
    negate = False
    for token in tokens:
        if token in NEGATION_TERMINATORS:
            negate = False
            out.append(token)
            continue
        if token in NEGATION_WORDS:
            negate = True
            out.append(token)
            continue
        out.append(f"NOT_{token}" if negate else token)
    return out
```

```python
>>> apply_negation(["not", "good", "at", "all", ".", "but", "funny"])
['not', 'NOT_good', 'NOT_at', 'NOT_all', '.', 'but', 'funny']
```

Теперь `good` и `NOT_good` — разные признаки. Классификатор может взвесить их противоположно. Три строки предобработки, измеримый прирост точности на бенчмарках тональности.

### Шаг 5: метрики оценки, которые имеют значение

Одна лишь точность (accuracy) вводит в заблуждение, если классы несбалансированы. Реальные корпуса тональности обычно на 70–80% положительны или на 70–80% отрицательны; классификатор, всегда предсказывающий большинство, получает 80% точности и бесполезен. Сообщайте каждую из следующих метрик:

- **Точность и полнота по классам (per-class precision and recall).** По одной паре на класс. Усредните их по макро, чтобы получить единое число, уважающее баланс классов.
- **Macro-F1 (основная метрика для несбалансированных данных).** Среднее по F1-оценкам для каждого класса с равными весами. Используйте эту метрику вместо accuracy, когда классы несбалансированы.
- **Weighted-F1 (альтернатива).** Как и macro, но взвешенная по частоте класса. Сообщайте вместе с macro-F1, когда сам дисбаланс имеет бизнес-значение.
- **Матрица ошибок (confusion matrix).** Сырые счётчики. Всегда изучайте её перед тем, как доверять любой скалярной метрике; она показывает, какую пару классов путает модель.
- **Примеры ошибок по классам.** Возьмите 5 неверных предсказаний на класс. Прочитайте их. Ничто не заменяет чтение реальных ошибок.

Для сильно несбалансированных данных (соотношение > 95-5) сообщайте **AUROC** и **AUPRC** вместо accuracy. AUPRC более чувствителен к классу меньшинства, что обычно и важно (спам, мошенничество, редкая тональность).

**Распространённая ошибка, которой стоит избегать.** Сообщать micro-F1 вместо macro-F1 на несбалансированных данных даёт число, которое выглядит высоким, потому что оно доминируется классом большинства. Macro-F1 заставляет вас увидеть качество на классе меньшинства.

```python
def evaluate(y_true, y_pred):
    tp = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 1)
    fp = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 1)
    fn = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 0)
    tn = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 0)
    precision = tp / (tp + fp) if tp + fp else 0
    recall = tp / (tp + fn) if tp + fn else 0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0
    return {"tp": tp, "fp": fp, "tn": tn, "fn": fn, "precision": precision, "recall": recall, "f1": f1}
```

## Применяем

scikit-learn делает это правильно в шесть строк.

```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

pipe = Pipeline([
    ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=2, sublinear_tf=True, stop_words=None)),
    ("clf", LogisticRegression(C=1.0, max_iter=1000)),
])
pipe.fit(X_train, y_train)
print(pipe.score(X_test, y_test))
```

Стоит заметить три вещи. `stop_words=None` сохраняет отрицания. `ngram_range=(1, 2)` добавляет биграммы, так что `not_good` становится признаком. `sublinear_tf=True` гасит повторяющиеся слова. Эти три флага — разница между базовым решением с 75% точности и базовым решением с 85% точности на SST-2.

### Когда обращаться к трансформеру

- Обнаружение сарказма. Классические модели здесь отказывают. Точка.
- Длинные отзывы, где тональность меняется в середине документа.
- Пообъектная тональность (aspect-based sentiment). «Камера была отличной, а аккумулятор — ужасным». Нужно приписать тональность конкретным объектам. Только трансформеры или модели со структурированным выводом.
- Неанглийские языки с малым объёмом ресурсов. Многоязычный BERT бесплатно даёт базовое решение без примеров (zero-shot).

Если вам нужно что-то из перечисленного, переходите к фазе 7 (глубокое погружение в трансформеры). В остальных случаях наивный байесовский классификатор или логистическая регрессия на TF-IDF плюс биграммы плюс обработка отрицания — ваше продакшен-базовое решение 2026 года.

### Ловушка воспроизводимости (снова)

Переобучение моделей тональности — рутина. Переоценка их — нет. Показатели точности, о которых сообщается в статьях, используют конкретные разбиения, конкретную предобработку, конкретные токенизаторы. Если вы сравниваете свою новую модель с базовым решением без использования идентичного конвейера, вы получите вводящие в заблуждение отклонения. Всегда пересчитывайте базовое решение на своём конвейере, а не берите число из статьи.

## Публикуем

Сохраните как `outputs/prompt-sentiment-baseline.md`:

```markdown
---
name: sentiment-baseline
description: Design a sentiment analysis baseline for a new dataset.
phase: 5
lesson: 05
---

Given a dataset description (domain, language, size, label granularity, latency budget), you output:

1. Feature extraction recipe. Specify tokenizer, n-gram range, stopword policy (usually keep), negation handling (scoped prefix or bigrams).
2. Classifier. Naive Bayes for baseline, logistic regression for production, transformer only if the domain needs sarcasm / aspects / cross-lingual.
3. Evaluation plan. Report precision, recall, F1, confusion matrix, and per-class error samples (not just scalars).
4. One failure mode to monitor post-deployment. Domain drift and sarcasm are the top two.

Refuse to recommend dropping stopwords for sentiment tasks. Refuse to report accuracy as the sole metric when classes are imbalanced (e.g., 90% positive). Flag subword-rich languages as needing FastText or transformer embeddings over word-level TF-IDF.
```

## Упражнения

1. **Лёгкое.** Добавьте `apply_negation` как шаг предобработки в конвейер scikit-learn и измерьте изменение F1 на небольшом наборе данных тональности.
2. **Среднее.** Реализуйте логистическую регрессию со взвешиванием классов (передайте `class_weight="balanced"` в scikit-learn или выведите градиент самостоятельно). Измерьте эффект на синтетическом дисбалансе классов 90-10.
3. **Сложное.** Постройте детектор сарказма, обучив второй классификатор на остатках модели тональности. Задокументируйте вашу экспериментальную настройку. Предупредите читателя, когда ваша точность ниже уровня случайности (уровень случайности для бинарного сарказма — около 50%, и большинство первых попыток оказываются именно там).

## Ключевые термины

| Термин | Как обычно говорят | Что это означает на самом деле |
|------|-----------------|-----------------------|
| Полярность | Положительное или отрицательное | Бинарная метка; иногда расширяется до нейтральной или мелкозернистой (5-звёздочной) шкалы. |
| Пообъектная тональность | Тональность по объектам | Приписывание тональности конкретным сущностям или атрибутам, упомянутым в тексте. |
| Скоупинг отрицания | Разворот соседних токенов | Добавление префикса `NOT_` к токенам после «не» вплоть до пунктуации. |
| Сглаживание Лапласа | Добавление 1 к счётчикам | Предотвращает признаки с нулевой вероятностью в наивном байесовском классификаторе. |
| L2-регуляризация | Сжатие весов | Добавляет `lambda * sum(w^2)` к функции потерь. Необходимо для разреженных текстовых признаков. |

## Дополнительные материалы

- [Pang and Lee (2008). Opinion Mining and Sentiment Analysis](https://www.cs.cornell.edu/home/llee/opinion-mining-sentiment-analysis-survey.html) — основополагающий обзор. Длинный, но первые четыре раздела покрывают всю классику.
- [Wang and Manning (2012). Baselines and Bigrams: Simple, Good Sentiment and Topic Classification](https://aclanthology.org/P12-2018/) — статья, показавшая, что биграммы плюс наивный байесовский классификатор трудно превзойти на коротком тексте.
- [Документация scikit-learn по извлечению текстовых признаков](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) — справочник по `CountVectorizer`, `TfidfVectorizer` и каждой настройке, которую вы будете подстраивать.
