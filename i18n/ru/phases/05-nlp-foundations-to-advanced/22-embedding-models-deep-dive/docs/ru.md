# Модели эмбеддингов — глубокое погружение в 2026 год

> Word2Vec давал вектор на слово. Современные модели эмбеддингов дают вектор на пассаж, кросс-язычно, с разреженным, плотным и многовекторным представлениями, подобранным под размер вашего индекса. Выберете неверно — и ваш RAG будет извлекать не то, что нужно.

**Тип:** Learn**Языки:** Python**Предварительные требования:** Фаза 5 · 03 (Word2Vec), Фаза 5 · 14 (Information Retrieval)**Время:** ~60 минут
## Проблема

Ваша RAG-система в 40% случаев извлекает не тот пассаж. Виновник редко кроется в векторной базе данных или промпте. Дело в модели эмбеддингов.

Выбор эмбеддинга в 2026 году — это выбор по пяти осям:

1. **Плотные (dense), разреженные (sparse) или многовекторные (multi-vector).** Один вектор на пассаж, или один на токен, или разреженный взвешенный мешок слов.
2. **Языковое покрытие.** Одноязычные английские модели по-прежнему выигрывают на задачах только на английском. Многоязычные модели выигрывают на смешанных корпусах.
3. **Длина контекста.** 512 токенов против 8192 против 32 768 — а реальная эффективная ёмкость часто составляет лишь 60–70% от заявленного максимума.
4. **Бюджет размерности.** 3072 числа с плавающей точкой полной точности = 12 КБ на вектор. При 100 млн векторов хранение обходится в $1300/месяц. Усечение по методу матрёшки сокращает это в 4 раза.
5. **Открытые или размещённые у провайдера.** Открытые веса означают контроль над стеком и данными. Размещение у провайдера означает обмен контроля на постоянную актуальность.

Этот урок называет компромиссы, чтобы вы могли выбирать на основе фактов, а не того, что было популярно в прошлом квартале.

## Концепция

![Плотные, разреженные и многовекторные эмбеддинги](../assets/embedding-modes.svg)

**Плотные эмбеддинги.** Один вектор на пассаж (обычно 384–3072 измерения). Косинусное сходство ранжирует пассажи по семантической близости. OpenAI `text-embedding-3-large`, режим dense у BGE-M3, Voyage-3. Выбор по умолчанию.

**Разреженные эмбеддинги.** В стиле SPLADE. Трансформер предсказывает вес для каждого токена словаря, затем большинство весов обнуляется. Результат — разреженный вектор размером |vocab|. Улавливает лексическое совпадение (как BM25), но с обученными весами термов. Силён на запросах, насыщенных ключевыми словами.

**Многовекторные (позднее взаимодействие).** ColBERTv2, Jina-ColBERT. Один вектор на токен. Оценка через MaxSim: для каждого токена запроса находится наиболее похожий токен документа, оценки суммируются. Дороже в хранении и вычислении, но выигрывает на длинных запросах и специализированных корпусах.

**BGE-M3: все три сразу.** Единая модель одновременно выдаёт плотное, разреженное и многовекторное представления. Каждое можно запрашивать независимо; оценки объединяются взвешенной суммой. Выбор по умолчанию в 2026 году, когда нужна гибкость от одного чекпоинта.

**Обучение представлений методом матрёшки (Matryoshka Representation Learning).** Модель обучена так, что первые N измерений вектора образуют полезный самостоятельный эмбеддинг. Усечение вектора на 1536 измерений до 256 стоит ~1% точности за 6-кратную экономию хранения. Поддерживается OpenAI text-3, Cohere v4, Voyage-4, Jina v5, Gemini Embedding 2, Nomic v1.5+.

### Лидерборд MTEB рассказывает не всю историю

Massive Text Embedding Benchmark — 56 задач в 8 типах на момент запуска (2022), расширен до 100+ задач в MTEB v2. В начале 2026 года Gemini Embedding 2 лидирует по поиску (67.71 MTEB-R). Cohere embed-v4 лидирует по общей оценке (65.2 MTEB). BGE-M3 лидирует среди открытых многоязычных моделей (63.0). Лидерборд необходим, но недостаточен — всегда проверяйте на своём домене.

### Трёхуровневый паттерн

| Сценарий использования | Паттерн |
|----------|---------|
| Быстрый первый проход | Плотный би-энкодер (BGE-M3, text-3-small) |
| Повышение полноты | Разреженный (SPLADE, BGE-M3 sparse) + слияние RRF |
| Точность на топ-50 | Многовекторный (ColBERTv2) или кросс-энкодер-реранкер |

Большинство продакшен-стеков используют все три.

```figure
gx-matryoshka
```

## Постройте это

### Шаг 1: базовый вариант — плотные эмбеддинги с Sentence-BERT

```python
from sentence_transformers import SentenceTransformer
import numpy as np

encoder = SentenceTransformer("BAAI/bge-small-en-v1.5")
corpus = [
    "The first iPhone launched in 2007.",
    "Apple released the iPod in 2001.",
    "Android is an operating system from Google.",
]
emb = encoder.encode(corpus, normalize_embeddings=True)

query = "When was the iPhone released?"
q_emb = encoder.encode([query], normalize_embeddings=True)[0]
scores = emb @ q_emb
print(sorted(enumerate(scores), key=lambda x: -x[1]))
```

`normalize_embeddings=True` делает скалярное произведение равным косинусному сходству. Всегда устанавливайте этот параметр.

### Шаг 2: усечение по методу матрёшки

```python
def truncate(vectors, dim):
    out = vectors[:, :dim]
    return out / np.linalg.norm(out, axis=1, keepdims=True)

emb_256 = truncate(emb, 256)
emb_128 = truncate(emb, 128)
```

Перенормируйте после усечения. Nomic v1.5, OpenAI text-3 и Voyage-4 обучены так, что это без потерь для первых нескольких уровней. Модели без обучения по методу матрёшки (оригинальный Sentence-BERT) резко деградируют при усечении.

### Шаг 3: многофункциональность BGE-M3

```python
from FlagEmbedding import BGEM3FlagModel

model = BGEM3FlagModel("BAAI/bge-m3", use_fp16=True)

output = model.encode(
    corpus,
    return_dense=True,
    return_sparse=True,
    return_colbert_vecs=True,
)
# output["dense_vecs"]:    (n_docs, 1024)
# output["lexical_weights"]: list of dict {token_id: weight}
# output["colbert_vecs"]:  list of (n_tokens, 1024) arrays
```

Три индекса, один вызов инференса. Слияние оценок:

```python
dense_score = ... # cosine over dense_vecs
sparse_score = model.compute_lexical_matching_score(q_lex, d_lex)
colbert_score = model.colbert_score(q_col, d_col)
final = 0.4 * dense_score + 0.2 * sparse_score + 0.4 * colbert_score
```

Настройте веса под свой домен.

### Шаг 4: оценка MTEB на пользовательской задаче

```python
from mteb import MTEB

tasks = ["ArguAna", "SciFact", "NFCorpus"]
evaluation = MTEB(tasks=tasks)
results = evaluation.run(encoder, output_folder="./mteb-results")
```

Запускайте кандидатные модели на *репрезентативном* подмножестве. Не доверяйте одному лишь месту в лидерборде — ваш домен имеет значение.

### Шаг 5: самодельное косинусное сходство с нуля

См. `code/main.py`. Усреднённые эмбеддинги на основе хеш-трюка (только stdlib). Не конкурируют с трансформерными эмбеддингами, но показывают форму задачи: токенизация → вектор → нормализация → скалярное произведение.

## Ловушки

- **Одна и та же модель для запроса и документа.** Некоторые модели (Voyage, Jina-ColBERT) используют асимметричное кодирование — запрос и документ проходят через разные пути. Всегда проверяйте карточку модели.
- **Пропущенный префикс.** Модели семейства `bge-*` требуют добавления `"Represent this sentence for searching relevant passages: "` к запросам. Разрыв в полноте на 3–5 пунктов, если забыть об этом.
- **Чрезмерное усечение по методу матрёшки.** 1536 → 256 обычно безопасно. 1536 → 64 — нет. Проверяйте на своём оценочном наборе.
- **Усечение по контексту.** Большинство моделей молча усекают вход, превышающий максимальную длину. Длинные документы нуждаются в разбиении на фрагменты (см. урок 23).
- **Игнорирование хвоста задержки.** Оценки MTEB скрывают задержку p99. Модель на 600M параметров может опережать модель на 335M на 2 пункта, но стоить в 3 раза дороже за запрос.

## Применение

Стек 2026 года:

| Ситуация | Выбор |
|-----------|------|
| Только английский, быстро, через API | `text-embedding-3-large` или `voyage-3-large` |
| Открытые веса, английский | `BAAI/bge-large-en-v1.5` |
| Открытые веса, многоязычная | `BAAI/bge-m3` или `Qwen3-Embedding-8B` |
| Длинный контекст (32k+) | Voyage-3-large, Cohere embed-v4, Qwen3-Embedding-8B |
| Развёртывание только на CPU | Nomic Embed v2 (137M параметров, MoE) |
| Ограничено хранилище | Усечение по методу матрёшки + int8-квантование |
| Запросы, насыщенные ключевыми словами | Добавить SPLADE sparse, слияние RRF с dense |

Паттерн 2026 года: начните с BGE-M3 или text-3-large, оцените на своём домене с помощью MTEB, замените, если специализированная под домен модель выигрывает более чем на 3 пункта.

## Отправьте это в продакшен

Сохраните как `outputs/skill-embedding-picker.md`:

```markdown
---
name: embedding-picker
description: Pick embedding model, dimension, and retrieval mode for a given corpus and deployment.
version: 1.0.0
phase: 5
lesson: 22
tags: [nlp, embeddings, retrieval]
---

Given a corpus (size, languages, domain, avg length), deployment target (cloud / edge / on-prem), latency budget, and storage budget, output:

1. Model. Named checkpoint or API. One-sentence reason.
2. Dimension. Full / Matryoshka-truncated / int8-quantized. Reason tied to storage budget.
3. Mode. Dense / sparse / multi-vector / hybrid. Reason.
4. Query prefix / template if required by the model card.
5. Evaluation plan. MTEB tasks relevant to domain + held-out domain eval with nDCG@10.

Refuse recommendations that truncate Matryoshka to <64 dims without domain validation. Refuse ColBERTv2 for corpora under 10k passages (overhead not justified). Flag long-document corpora (>8k tokens) routed to models with 512-token windows.
```

## Упражнения

1. **Лёгкое.** Закодируйте 100 предложений с помощью `bge-small-en-v1.5` при полной размерности (384), затем при усечении по методу матрёшки до 128. Измерьте падение MRR на 10 запросах.
2. **Среднее.** Сравните BGE-M3 dense, sparse и colbert на 500 пассажах из своего домена. Что выигрывает по recall@10? Превосходит ли слияние RRF лучший отдельный режим?
3. **Сложное.** Запустите MTEB на трёх кандидатных моделях на двух ваших ключевых доменных задачах. Отчитайтесь об оценке MTEB, задержке p99 на пакете из 100 запросов и стоимости за 1 млн запросов. Выберите Парето-оптимальную модель.

## Ключевые термины

| Термин | Что говорят люди | Что это на самом деле означает |
|------|-----------------|-----------------------|
| Dense embedding | Вектор | Один вектор фиксированного размера на текст. Косинусное сходство для ранжирования. |
| Sparse embedding | Обученный BM25 | Один вес на токен словаря; в основном нули; обучается end-to-end. |
| Multi-vector | В стиле ColBERT | Один вектор на токен; оценка MaxSim; больше индекс, выше полнота. |
| Matryoshka | Трюк с русской матрёшкой | Первые N измерений сами по себе валидный меньший эмбеддинг. |
| MTEB | Бенчмарк | Massive Text Embedding Benchmark — 56 задач на старте, 100+ в v2. |
| BEIR | Бенчмарк поиска | 18 задач поиска без обучения (zero-shot); часто цитируется для оценки кросс-доменной устойчивости. |
| Asymmetric encoding | Запрос ≠ путь документа | Модель использует разные проекции для запросов и документов. |

## Дополнительное чтение

- [Reimers, Gurevych (2019). Sentence-BERT](https://arxiv.org/abs/1908.10084) — статья про би-энкодер.
- [Muennighoff et al. (2022). MTEB: Massive Text Embedding Benchmark](https://arxiv.org/abs/2210.07316) — статья про лидерборд.
- [Chen et al. (2024). BGE-M3: Multi-lingual, Multi-functionality, Multi-granularity](https://arxiv.org/abs/2402.03216) — единая модель с тремя режимами.
- [Kusupati et al. (2022). Matryoshka Representation Learning](https://arxiv.org/abs/2205.13147) — целевая функция обучения с лестницей размерностей.
- [Santhanam et al. (2022). ColBERTv2: Effective and Efficient Retrieval via Lightweight Late Interaction](https://arxiv.org/abs/2112.01488) — позднее взаимодействие в продакшене.
- [MTEB leaderboard on Hugging Face](https://huggingface.co/spaces/mteb/leaderboard) — актуальные рейтинги.
