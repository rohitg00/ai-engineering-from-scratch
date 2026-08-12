# Векторные представления слов — Word2Vec с нуля

> Слово познаётся по своему окружению. Обучите неглубокую сеть на этой идее — и геометрия проявится сама.

**Тип:** Build
**Языки:** Python
**Предварительные требования:** Фаза 5, урок 02 (BoW + TF-IDF), Фаза 3, урок 03 (Обратное распространение ошибки с нуля)
**Время:** ~75 минут

## Проблема

TF-IDF знает, что `dog` и `puppy` — разные слова. Он не знает, что они означают почти одно и то же. Классификатор, обученный на `dog`, не может обобщиться на отзыв про `puppy`. Это можно замаскировать, перечислив синонимы, но такой подход ломается на редких терминах, доменном жаргоне и любом языке, который вы не предусмотрели.

Вам нужно представление, в котором `dog` и `puppy` оказываются рядом друг с другом в пространстве. Где `king - man + woman` оказывается рядом с `queen`. Где модель, обученная на `dog`, бесплатно переносит часть сигнала на `puppy`.

Word2Vec дал нам такое пространство. Двухслойная нейронная сеть, обучающие прогоны на триллионах токенов, опубликовано в 2013 году. Архитектура почти неловко проста. Результаты переопределили NLP на десятилетие.

## Концепция

**Дистрибутивная гипотеза (Firth, 1957)**: «Слово познаётся по своему окружению». Если два слова встречаются в похожих контекстах, они, вероятно, означают похожие вещи.

Word2Vec выпускается в двух вариантах, оба эксплуатируют эту идею.

- **Skip-gram.** По центральному слову предсказывает окружающие слова. `cat -> (the, sat, on)` при размере окна 2.
- **CBOW (непрерывный мешок слов).** По окружающим словам предсказывает центральное. `(the, sat, on) -> cat`.

Skip-gram обучается медленнее, но лучше справляется с редкими словами. Он стал вариантом по умолчанию.

У сети один скрытый слой без нелинейности. Вход — one-hot-вектор по словарю. Выход — softmax по словарю. После обучения выходной слой выбрасывается. Веса скрытого слоя задают векторное представление (эмбеддинг) каждого слова.

```
one-hot(center) ── W ──▶ hidden (d-dim) ── W' ──▶ softmax(vocab)
                          ^
                          this is the embedding
```

Трюк в том, что softmax по 100 тысячам слов непомерно дорог. Word2Vec использует **негативное сэмплирование (negative sampling)**, чтобы превратить это в задачу бинарной классификации. Предсказать «встретилось ли это контекстное слово рядом с этим центральным словом, да или нет». На каждую обучающую пару сэмплируется горстка негативных (не совстречающихся) слов вместо вычисления softmax по всему словарю.

```figure
word-vector-arithmetic
```

## Создаём

### Шаг 1: обучающие пары из корпуса

```python
def skipgram_pairs(docs, window=2):
    pairs = []
    for doc in docs:
        for i, center in enumerate(doc):
            for j in range(max(0, i - window), min(len(doc), i + window + 1)):
                if i == j:
                    continue
                pairs.append((center, doc[j]))
    return pairs
```

```python
>>> skipgram_pairs([["the", "cat", "sat", "on", "mat"]], window=2)
[('the', 'cat'), ('the', 'sat'),
 ('cat', 'the'), ('cat', 'sat'), ('cat', 'on'),
 ('sat', 'the'), ('sat', 'cat'), ('sat', 'on'), ('sat', 'mat'),
 ...]
```

Каждая пара (центр, контекст) в окне — это положительный обучающий пример.

### Шаг 2: таблицы эмбеддингов

Две матрицы. `W` — таблица эмбеддингов центральных слов (та, которую вы оставляете себе). `W'` — таблица контекстных слов (часто отбрасывается, иногда усредняется с `W`).

```python
import numpy as np


def init_embeddings(vocab_size, dim, seed=0):
    rng = np.random.default_rng(seed)
    W = rng.normal(0, 0.1, size=(vocab_size, dim))
    W_prime = rng.normal(0, 0.1, size=(vocab_size, dim))
    return W, W_prime
```

Небольшая случайная инициализация. Размер словаря 10 тысяч и размерность 100 реалистичны; для учебных целей достаточно словаря на 50 слов и размерности 16, чтобы увидеть геометрию.

### Шаг 3: цель с негативным сэмплированием

Для каждой положительной пары `(center, context)` сэмплируйте `k` случайных слов из словаря как негативы. Обучите модель так, чтобы скалярное произведение `W[center] · W'[context]` было высоким для позитивов и низким для негативов.

```python
def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -20, 20)))


def train_pair(W, W_prime, center_idx, context_idx, negative_indices, lr):
    v_c = W[center_idx]
    u_pos = W_prime[context_idx]
    u_negs = W_prime[negative_indices]

    pos_score = sigmoid(v_c @ u_pos)
    neg_scores = sigmoid(u_negs @ v_c)

    grad_center = (pos_score - 1) * u_pos
    for i, u in enumerate(u_negs):
        grad_center += neg_scores[i] * u

    W[context_idx] = W[context_idx]
    W_prime[context_idx] -= lr * (pos_score - 1) * v_c
    for i, neg_idx in enumerate(negative_indices):
        W_prime[neg_idx] -= lr * neg_scores[i] * v_c
    W[center_idx] -= lr * grad_center
```

Волшебная формула: логистическая функция потерь на положительной паре (нужен sigmoid близко к 1) плюс логистическая функция потерь на негативных парах (нужен sigmoid близко к 0). Градиенты текут в обе таблицы. Полный вывод есть в оригинальной статье; пройдите его один раз с карандашом и бумагой, если хотите, чтобы это отложилось в памяти.

### Шаг 4: обучение на игрушечном корпусе

```python
def train(docs, dim=16, window=2, k_neg=5, epochs=100, lr=0.05, seed=0):
    vocab = build_vocab(docs)
    vocab_size = len(vocab)
    rng = np.random.default_rng(seed)
    W, W_prime = init_embeddings(vocab_size, dim, seed=seed)
    pairs = skipgram_pairs(docs, window=window)

    for epoch in range(epochs):
        rng.shuffle(pairs)
        for center, context in pairs:
            c_idx = vocab[center]
            ctx_idx = vocab[context]
            negs = rng.integers(0, vocab_size, size=k_neg)
            negs = [n for n in negs if n != ctx_idx and n != c_idx]
            train_pair(W, W_prime, c_idx, ctx_idx, negs, lr)
    return vocab, W
```

После достаточного числа эпох на большом корпусе слова, встречающиеся в сходных контекстах, получают похожие центральные эмбеддинги. На игрушечном корпусе вы видите эффект слабо. На миллиардах токенов вы видите его отчётливо.

### Шаг 5: трюк с аналогиями

```python
def nearest(vocab, W, target_vec, topk=5, exclude=None):
    exclude = exclude or set()
    inv_vocab = {i: w for w, i in vocab.items()}
    norms = np.linalg.norm(W, axis=1, keepdims=True) + 1e-9
    W_norm = W / norms
    target = target_vec / (np.linalg.norm(target_vec) + 1e-9)
    sims = W_norm @ target
    order = np.argsort(-sims)
    out = []
    for i in order:
        if i in exclude:
            continue
        out.append((inv_vocab[i], float(sims[i])))
        if len(out) == topk:
            break
    return out


def analogy(vocab, W, a, b, c, topk=5):
    v = W[vocab[b]] - W[vocab[a]] + W[vocab[c]]
    return nearest(vocab, W, v, topk=topk, exclude={vocab[a], vocab[b], vocab[c]})
```

На предобученных 300-мерных векторах Google News:

```python
>>> analogy(vocab, W, "man", "king", "woman")
[('queen', 0.71), ('monarch', 0.62), ('princess', 0.59), ...]
```

`king - man + woman = queen`. Не потому, что модель знает, что такое монархия. Потому, что вектор `(king - man)` улавливает нечто вроде «королевского», и добавление его к `woman` попадает в область «королевского женского».

## Применяем

Писать Word2Vec с нуля — это про обучение. Продакшен-NLP использует `gensim`.

```python
from gensim.models import Word2Vec

sentences = [
    ["the", "cat", "sat", "on", "the", "mat"],
    ["the", "dog", "ran", "across", "the", "room"],
]

model = Word2Vec(
    sentences,
    vector_size=100,
    window=5,
    min_count=1,
    sg=1,
    negative=5,
    workers=4,
    epochs=30,
)

print(model.wv["cat"])
print(model.wv.most_similar("cat", topn=3))
```

В реальной работе вы почти никогда не обучаете Word2Vec сами. Вы скачиваете предобученные векторы.

- **GloVe** — стэнфордский подход факторизации матрицы совстречаемости. Контрольные точки размерностей 50d, 100d, 200d, 300d. Хорошее общее покрытие. Урок 04 посвящён GloVe отдельно.
- **fastText** — расширение Word2Vec от Facebook, которое встраивает символьные n-граммы. Обрабатывает слова вне словаря, составляя их из субслов. Урок 04.
- **Предобученный Word2Vec на Google News** — 300d, словарь из 3 млн слов, опубликован в 2013 году. Всё ещё скачивается ежедневно.

### Когда Word2Vec всё ещё побеждает в 2026 году

- Лёгкий доменно-специфичный поиск. Обучите на медицинских рефератах за час на ноутбуке, получите специализированные векторы, которых не даёт ни одна универсальная модель.
- Проектирование признаков в стиле аналогий. `gender_vector = mean(man - woman pairs)`. Вычтите его из других слов, чтобы получить ось, нейтральную по полу. Всё ещё используется в исследованиях справедливости моделей.
- Интерпретируемость. 100d достаточно мало, чтобы визуализировать через PCA или t-SNE и реально увидеть, как формируются кластеры.
- Везде, где инференс должен работать на устройстве без GPU. Поиск в Word2Vec — это выборка одной строки.

### Где Word2Vec отказывает

Стена полисемии. У `bank` один вектор. `river bank` и `financial bank` делят его между собой. `table` (таблица в электронной таблице против мебели) тоже делит его. Классификатор дальше по конвейеру не может различить смыслы по вектору.

Контекстные эмбеддинги (ELMo, BERT, каждый трансформер с тех пор) решили это, производя разный вектор для каждого вхождения слова в зависимости от окружающего контекста. Именно это — скачок от Word2Vec к BERT: от статического к контекстному. Фаза 7 посвящена трансформерной половине этой истории.

Проблема слов вне словаря — другой отказ. Word2Vec никогда не видел `Zoomer-approved`, если этого не было в обучающих данных. Никакого запасного варианта. fastText исправляет это композицией из субслов (урок 04).

## Публикуем

Сохраните как `outputs/skill-embedding-probe.md`:

```markdown
---
name: embedding-probe
description: Inspect a word2vec model. Run analogies, find neighbors, diagnose quality.
version: 1.0.0
phase: 5
lesson: 03
tags: [nlp, embeddings, debugging]
---

You probe trained word embeddings to verify they are working. Given a `gensim.models.KeyedVectors` object and a vocabulary, you run:

1. Three canonical analogy tests. `king : man :: queen : woman`. `paris : france :: tokyo : japan`. `walking : walked :: swimming : ?`. Report the top-1 result and its cosine.
2. Five nearest-neighbor tests on domain-specific words the user supplies. Print top-5 neighbors with cosines.
3. One symmetry check. `similarity(a, b) == similarity(b, a)` to within float precision.
4. One degenerate check. If any embedding has a norm below 0.01 or above 100, the model has a training bug. Flag it.

Refuse to declare a model good on analogy accuracy alone. Analogy benchmarks are gameable and do not transfer to downstream tasks. Recommend intrinsic + downstream evaluation together.
```

## Упражнения

1. **Лёгкое.** Запустите цикл обучения на крошечном корпусе (20 предложений про кошек и собак). После 200 эпох убедитесь, что `nearest(vocab, W, W[vocab["cat"]])` возвращает `dog` в топ-3. Если нет, увеличьте число эпох или словарь.
2. **Среднее.** Добавьте подвыборку частых слов. Слова с частотой выше `10^-5` отбрасываются из обучающих пар с вероятностью, пропорциональной их частоте. Измерьте эффект на сходстве редких слов.
3. **Сложное.** Обучите модель на корпусе 20 Newsgroups. Вычислите две оси смещения: `he - she` и `doctor - nurse`. Спроецируйте слова-профессии на обе оси. Сообщите, у каких профессий наибольший разрыв смещения. Это тот вид проверки, который используют исследователи справедливости моделей.

## Ключевые термины

| Термин | Как обычно говорят | Что это означает на самом деле |
|------|-----------------|-----------------------|
| Векторное представление слова | Слово как вектор | Плотное низкоразмерное (обычно 100–300) представление, выученное из контекста. |
| Skip-gram | Трюк Word2Vec | Предсказывает контекстные слова по центральному слову. Медленнее, чем CBOW, лучше для редких слов. |
| Негативное сэмплирование | Сокращение пути обучения | Заменяет softmax по всему словарю бинарной классификацией против `k` случайных слов. |
| Статический эмбеддинг | Один вектор на слово | Один и тот же вектор независимо от контекста. Отказывает на полисемии. |
| Контекстный эмбеддинг | Контекстно-зависимый вектор | Разный вектор для каждого вхождения в зависимости от окружающих слов. То, что производят трансформеры. |
| OOV | Вне словаря | Слово, не встреченное при обучении. Word2Vec не может дать для него вектор. |

## Дополнительные материалы

- [Mikolov et al. (2013). Distributed Representations of Words and Phrases and their Compositionality](https://arxiv.org/abs/1310.4546) — статья про негативное сэмплирование. Короткая и читаемая.
- [Rong, X. (2014). word2vec Parameter Learning Explained](https://arxiv.org/abs/1411.2738) — самый ясный вывод градиентов, если математика оригинальной статьи кажется плотной.
- [gensim Word2Vec tutorial](https://radimrehurek.com/gensim/models/word2vec.html) — настройки обучения для продакшена, которые реально работают.
