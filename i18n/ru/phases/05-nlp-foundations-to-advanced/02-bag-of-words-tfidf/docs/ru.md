# Мешок слов, TF-IDF и представление текста

> Сначала считай, потом думай. В 2026 году TF-IDF всё ещё превосходит эмбеддинги на чётко определённых задачах.

**Тип:** Build
**Языки:** Python
**Предварительные требования:** Фаза 5, урок 01 (Обработка текста), Фаза 2, урок 02 (Линейная регрессия с нуля)
**Время:** ~75 минут

## Проблема

Модели нужны числа. У вас есть строки.

Каждый конвейер NLP должен ответить на один и тот же вопрос. Как превратить поток токенов переменной длины в вектор фиксированного размера, который может обработать классификатор. Первый ответ, к которому пришла область, был самым тупым из тех, что работают. Посчитайте слова. Сделайте вектор.

Этот вектор вынес на себе больше продакшен-NLP, чем любая модель эмбеддингов. Спам-фильтры, тематические классификаторы, обнаружение аномалий в логах, ранжирование поиска (до BM25), первая волна анализа тональности, первое десятилетие академических бенчмарков NLP. Практики 2026 года всё ещё в первую очередь тянутся к нему на узких задачах классификации. Он быстрый, интерпретируемый и часто неотличим от модели эмбеддингов с 400 миллионами параметров на задачах, где важно именно наличие слова.

Этот урок строит мешок слов, а затем TF-IDF, с нуля. Затем показывает, как scikit-learn делает то же самое в три строки. Затем называет режим отказа, из-за которого приходится переходить к эмбеддингам.

## Концепция

**Мешок слов (Bag of Words, BoW)** отбрасывает порядок. Для каждого документа считает, сколько раз встречается каждое слово словаря. Длина вектора — это размер словаря. Позиция `i` — это счётчик слова `i`.

**TF-IDF** переоценивает веса BoW. Слово, которое встречается в каждом документе, неинформативно, поэтому его вес уменьшают. Слово, редкое в корпусе, но частое в одном документе, — это сигнал, поэтому его вес увеличивают.

```
TF-IDF(w, d) = TF(w, d) * IDF(w)
             = count(w in d) / |d| * log(N / df(w))
```

Где `TF` — частота термина в документе, `df` — документная частота (сколько документов содержат слово), `N` — общее число документов. `log` удерживает вес ограниченным для повсеместных слов.

Ключевое свойство: оба метода дают разреженные векторы с интерпретируемыми осями. Вы можете посмотреть на веса обученного классификатора и прочитать, какие слова толкают документ к каждому классу. С 768-мерным эмбеддингом BERT так сделать нельзя.

```figure
bow-tfidf
```

## Создаём

### Шаг 1: строим словарь

```python
def build_vocab(docs):
    vocab = {}
    for doc in docs:
        for token in doc:
            if token not in vocab:
                vocab[token] = len(vocab)
    return vocab
```

Вход: список токенизированных документов (подойдёт любой токенизатор уровня слов; `code/main.py` этого урока использует упрощённый вариант с нижним регистром). Выход: словарь `{word: index}`. Стабильный порядок вставки означает, что индекс слова 0 — это первое слово, встреченное в первом документе. Соглашение варьируется; scikit-learn сортирует по алфавиту.

### Шаг 2: мешок слов

```python
def bag_of_words(docs, vocab):
    matrix = [[0] * len(vocab) for _ in docs]
    for i, doc in enumerate(docs):
        for token in doc:
            if token in vocab:
                matrix[i][vocab[token]] += 1
    return matrix
```

```python
>>> docs = [["cat", "sat", "on", "mat"], ["cat", "cat", "ran"]]
>>> vocab = build_vocab(docs)
>>> bag_of_words(docs, vocab)
[[1, 1, 1, 1, 0], [2, 0, 0, 0, 1]]
```

Строки — это документы. Столбцы — индексы словаря. Элемент `[i][j]` — это «сколько раз слово `j` встречается в документе `i`». В документе 1 `cat` встречается дважды, потому что так и есть. В документе 0 `ran` встречается ноль раз, потому что его там нет.

### Шаг 3: частота термина и документная частота

```python
import math


def term_frequency(doc_bow, doc_length):
    return [c / doc_length if doc_length else 0 for c in doc_bow]


def document_frequency(bow_matrix):
    df = [0] * len(bow_matrix[0])
    for row in bow_matrix:
        for j, count in enumerate(row):
            if count > 0:
                df[j] += 1
    return df


def inverse_document_frequency(df, n_docs):
    return [math.log((n_docs + 1) / (d + 1)) + 1 for d in df]
```

Стоит назвать два приёма сглаживания. `(n+1)/(d+1)` избегает `log(x/0)`. Финальное `+1` гарантирует, что слово, встречающееся в каждом документе, всё равно получит IDF равный 1 (не 0), что совпадает со значением по умолчанию в scikit-learn. Другие реализации используют «сырой» `log(N/df)`. Оба варианта работают; сглаженный — дружелюбнее.

### Шаг 4: TF-IDF

```python
def tfidf(bow_matrix):
    n_docs = len(bow_matrix)
    df = document_frequency(bow_matrix)
    idf = inverse_document_frequency(df, n_docs)
    out = []
    for row in bow_matrix:
        length = sum(row)
        tf = term_frequency(row, length)
        out.append([tf_j * idf_j for tf_j, idf_j in zip(tf, idf)])
    return out
```

```python
>>> docs = [
...     ["the", "cat", "sat"],
...     ["the", "dog", "sat"],
...     ["the", "cat", "ran"],
... ]
>>> vocab = build_vocab(docs)
>>> bow = bag_of_words(docs, vocab)
>>> tfidf(bow)
```

Три документа, пять слов словаря (`the`, `cat`, `sat`, `dog`, `ran`). `the` встречается во всех трёх, поэтому его IDF низкий. `dog` встречается в одном, поэтому его IDF высокий. Векторы разреженные (большинство элементов малы), и различающие слова выделяются.

### Шаг 5: L2-нормализация строк

```python
def l2_normalize(matrix):
    out = []
    for row in matrix:
        norm = math.sqrt(sum(x * x for x in row))
        out.append([x / norm if norm else 0 for x in row])
    return out
```

Без нормализации более длинный документ получает больший вектор и доминирует в оценках сходства. L2-нормализация помещает каждый документ на единичную гиперсферу. Косинусное сходство между строками теперь — это просто скалярное произведение.

## Применяем

scikit-learn поставляет готовую к продакшену версию.

```python
from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer

docs = ["the cat sat on the mat", "the dog sat on the mat", "the cat ran"]

bow_vectorizer = CountVectorizer()
bow = bow_vectorizer.fit_transform(docs)
print(bow_vectorizer.get_feature_names_out())
print(bow.toarray())

tfidf_vectorizer = TfidfVectorizer()
tfidf = tfidf_vectorizer.fit_transform(docs)
print(tfidf.toarray().round(3))
```

`CountVectorizer` выполняет токенизацию, построение словаря и BoW за один вызов. `TfidfVectorizer` добавляет взвешивание IDF и L2-нормализацию. Оба возвращают разреженные матрицы. Для 100 тысяч документов плотная версия не поместится в память; оставайтесь разреженными, пока классификатор не потребует плотного представления.

Настройки, которые меняют всё:

| Аргумент | Эффект |
|-----|--------|
| `ngram_range=(1, 2)` | Включает биграммы. Обычно повышает качество классификации. |
| `min_df=2` | Отбрасывает слова, встречающиеся менее чем в 2 документах. Урезает словарь на шумных данных. |
| `max_df=0.95` | Отбрасывает слова, встречающиеся более чем в 95% документов. Приближает удаление стоп-слов без жёсткого списка. |
| `stop_words="english"` | Встроенный список стоп-слов scikit-learn. Зависит от задачи — анализ тональности *не должен* удалять отрицания. |
| `sublinear_tf=True` | Использует `1 + log(tf)` вместо «сырой» `tf`. Помогает, когда термин повторяется много раз в одном документе. |

### Когда TF-IDF всё ещё побеждает (по состоянию на 2026 год)

- Обнаружение спама, тематическая разметка, флаги аномалий в логах. Важно наличие слова; семантические нюансы — нет.
- Режимы с малым объёмом данных (сотни размеченных примеров). TF-IDF плюс логистическая регрессия не требует затрат на предобучение.
- Везде, где важна задержка. TF-IDF плюс линейная модель отвечает за микросекунды. Прогон документа через трансформер для эмбеддинга занимает 10–100 мс.
- Системы, которые обязаны объяснять свои предсказания. Изучите коэффициенты классификатора. Топ положительных слов — и есть причина.

### Когда TF-IDF отказывает

Отказ семантической слепоты. Рассмотрим два документа:

- «Фильм был совсем не хорош».
- «Фильм был превосходным».

Один — отрицательный отзыв. Другой — положительный. В английских оригиналах этих предложений пересечение по TF-IDF — ровно `{the, movie, was}`. Классификатору на мешке слов приходится запоминать, что в первом из них слово `not` рядом с `good` меняет метку на отрицательную. Он может научиться этому на достаточном объёме данных, но никогда так изящно, как модель, понимающая синтаксис.

Другой отказ: слова вне словаря на этапе инференса. Модель BoW, обученная на отзывах IMDb, понятия не имеет, что делать с `Zoomer-approved`, если этот токен ни разу не встретился при обучении. Субсловные эмбеддинги (урок 04) справляются с этим. TF-IDF — нет.

### Гибрид: эмбеддинги, взвешенные по TF-IDF

Прагматичный вариант по умолчанию для классификации на среднем объёме данных в 2026 году: используйте веса TF-IDF как внимание над эмбеддингами слов.

```python
def tfidf_weighted_embedding(doc, tfidf_scores, embedding_table, dim):
    vec = [0.0] * dim
    total_weight = 0.0
    for token in doc:
        if token not in embedding_table or token not in tfidf_scores:
            continue
        weight = tfidf_scores[token]
        emb = embedding_table[token]
        for i in range(dim):
            vec[i] += weight * emb[i]
        total_weight += weight
    if total_weight == 0:
        return vec
    return [v / total_weight for v in vec]
```

Вы получаете семантическую ёмкость от эмбеддингов и акцент на редких словах от TF-IDF. Классификатор обучается на объединённом векторе. Это превосходит каждый из подходов по отдельности для классификации тональности, темы и намерения на объёмах ниже примерно 50 тысяч размеченных примеров.

## Публикуем

Сохраните как `outputs/prompt-vectorization-picker.md`:

```markdown
---
name: vectorization-picker
description: Given a text-classification task, recommend BoW, TF-IDF, embeddings, or a hybrid.
phase: 5
lesson: 02
---

You recommend a text-vectorization strategy. Given a task description, output:

1. Representation (BoW, TF-IDF, transformer embeddings, or a hybrid). Explain why in one sentence.
2. Specific vectorizer configuration. Name the library. Quote the arguments (`ngram_range`, `min_df`, `max_df`, `sublinear_tf`, `stop_words`).
3. One failure mode to test before shipping.

Refuse to recommend embeddings when the user has under 500 labeled examples unless they show evidence of semantic failure in a TF-IDF baseline. Refuse to remove stopwords for sentiment analysis (negations carry signal). Flag class imbalance as needing more than a vectorizer change.

Example input: "Classifying 30k customer support tickets into 12 categories. Most tickets are 2-3 sentences. English only. Need explainability for audit logs."

Example output:

- Representation: TF-IDF. 30k examples is not small; explainability requirement rules out dense embeddings.
- Config: `TfidfVectorizer(ngram_range=(1, 2), min_df=3, max_df=0.95, sublinear_tf=True, stop_words=None)`. Keep stopwords because category keywords sometimes are stopwords ("not working" vs "working").
- Failure to test: verify `min_df=3` does not drop rare category keywords. Run `get_feature_names_out` filtered by class and eyeball.
```

## Упражнения

1. **Лёгкое.** Реализуйте `cosine_similarity(doc_vec_a, doc_vec_b)` на L2-нормализованном выходе TF-IDF. Убедитесь, что идентичные документы получают оценку 1.0, а документы с непересекающимся словарём — 0.0.
2. **Среднее.** Добавьте поддержку `n-gram` в `bag_of_words`. Параметр `n` даёт счётчики по `n`-граммам. Проверьте, что `n=2` на `["the", "cat", "sat"]` даёт счётчики биграмм для `["the cat", "cat sat"]`.
3. **Сложное.** Постройте описанный выше гибрид эмбеддингов, взвешенных по TF-IDF, используя векторы GloVe размерности 100 (скачайте один раз, закэшируйте). Сравните точность классификации с чистым TF-IDF и с чистыми усреднённо-объединёнными эмбеддингами на наборе данных 20 Newsgroups. Сообщите, что где побеждает.

## Ключевые термины

| Термин | Как это обычно называют | Что это на самом деле означает |
|------|-----------------|-----------------------|
| BoW | Вектор частот слов | Счётчики слов словаря в одном документе. Отбрасывает порядок. |
| TF | Частота термина | Счётчик слова в документе, опционально нормализованный по длине документа. |
| DF | Документная частота | Счётчик документов, содержащих слово хотя бы один раз. |
| IDF | Обратная документная частота | `log(N / df)` со сглаживанием. Понижает вес слов, встречающихся повсюду. |
| Разреженный вектор | В основном нули | Словарь обычно составляет 10–100 тысяч слов; в конкретном документе отсутствует большинство из них. |
| Косинусное сходство | Угол между векторами | Скалярное произведение L2-нормализованных векторов. 1 — идентичны, 0 — ортогональны. |

## Дополнительные материалы

- [scikit-learn — извлечение признаков из текста](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) — канонический справочник по API, плюс заметки по каждой настройке.
- [Salton, G., & Buckley, C. (1988). Term-weighting approaches in automatic text retrieval](https://www.sciencedirect.com/science/article/pii/0306457388900210) — статья, сделавшая TF-IDF стандартом на десятилетие.
- ["Why TF-IDF Still Beats Embeddings" — Ashfaque Thonikkadavan (Medium)](https://medium.com/@cmtwskb/why-tf-idf-still-beats-embeddings-ad85c123e1b2) — взгляд 2026 года на то, когда старый метод побеждает и почему.
