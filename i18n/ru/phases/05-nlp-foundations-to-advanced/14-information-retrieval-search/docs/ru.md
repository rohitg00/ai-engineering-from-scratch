# Информационный поиск и поисковые системы

> BM25 точен, но хрупок. Плотный поиск закидывает широкую сеть, но пропускает ключевые слова. Гибридный подход — вариант по умолчанию в 2026 году. Всё остальное — настройка.

**Тип:** Практика
**Языки:** Python
**Предпосылки:** Фаза 5 · 02 (BoW + TF-IDF), Фаза 5 · 04 (GloVe, FastText, Subword)
**Время:** ~75 минут

## Проблема

Пользователь вводит «что будет, если кто-то обманом получит деньги» и ожидает найти статью закона, которая действительно это покрывает: «Статья 420 УК». Поиск по ключевым словам полностью её пропускает (нет общей лексики). Семантический поиск пропускает её, если эмбеддинги не были обучены на юридических текстах. Настоящий поиск должен справляться с обоими случаями.

Информационный поиск (IR) — это пайплайн под каждой RAG-системой, каждой поисковой строкой, нечётким поиском на каждом сайте документации. Архитектура 2026 года, которая работает в продакшене, — это не один метод. Это цепочка взаимодополняющих методов, каждый из которых ловит ошибки предыдущего.

Этот урок строит каждый компонент и называет, какие ошибки ловит каждый из них.

## Концепция

![Гибридный поиск: BM25 + плотный поиск + RRF + реранкинг кросс-энкодером](../assets/retrieval.svg)

Четыре слоя. Выберите те, что вам нужны.

1. **Разреженный поиск (BM25).** Быстрый, точный на точных совпадениях, ужасен в семантике. Работает по инвертированному индексу. Менее 10 мс на запрос при миллионах документов. Даёт верные ссылки на статьи закона, коды продуктов, сообщения об ошибках, именованные сущности.
2. **Плотный поиск.** Кодирует запрос и документы в векторы. Поиск ближайших соседей. Улавливает перефразирования и семантическое сходство. Пропускает точные совпадения ключевых слов, отличающиеся на один символ. 50–200 мс на запрос с FAISS или векторной БД.
3. **Слияние (Fusion).** Объединяет ранжированные списки от разреженного и плотного поиска. Reciprocal Rank Fusion (RRF) — простой вариант по умолчанию, потому что он игнорирует сырые оценки (которые живут в разных шкалах) и использует только позиции в ранжировании. Взвешенное слияние — вариант, когда известно, что один сигнал доминирует в вашем домене.
4. **Реранкинг кросс-энкодером.** Возьмите топ-30 из слияния. Запустите кросс-энкодер (запрос и документ вместе, с оценкой каждой пары). Оставьте топ-5. Кросс-энкодеры медленнее на пару, чем би-энкодеры, но намного точнее. Затраты амортизируются тем, что вы запускаете их только на топ-30.

Трёхстороннее ретривальное решение (BM25 + плотный + обучаемый разреженный, например SPLADE) превосходит двустороннее в бенчмарках 2026 года, но требует инфраструктуры для обучаемых разреженных индексов. Для большинства команд двусторонний подход плюс реранкинг кросс-энкодером — оптимальная точка.

```figure
gx-hybrid-retrieval
```

## Реализация

### Шаг 1: BM25 с нуля

```python
import math
import re
from collections import Counter

TOKEN_RE = re.compile(r"[a-z0-9]+")


def tokenize(text):
    return TOKEN_RE.findall(text.lower())


class BM25:
    def __init__(self, corpus, k1=1.5, b=0.75):
        if not corpus:
            raise ValueError("corpus must not be empty")
        self.corpus = [tokenize(d) for d in corpus]
        self.k1 = k1
        self.b = b
        self.n_docs = len(self.corpus)
        self.avg_dl = sum(len(d) for d in self.corpus) / self.n_docs
        self.df = Counter()
        for doc in self.corpus:
            for term in set(doc):
                self.df[term] += 1

    def idf(self, term):
        n = self.df.get(term, 0)
        return math.log(1 + (self.n_docs - n + 0.5) / (n + 0.5))

    def score(self, query, doc_idx):
        q_tokens = tokenize(query)
        doc = self.corpus[doc_idx]
        dl = len(doc)
        freq = Counter(doc)
        score = 0.0
        for term in q_tokens:
            f = freq.get(term, 0)
            if f == 0:
                continue
            numerator = f * (self.k1 + 1)
            denominator = f + self.k1 * (1 - self.b + self.b * dl / self.avg_dl)
            score += self.idf(term) * numerator / denominator
        return score

    def rank(self, query, top_k=10):
        scored = [(self.score(query, i), i) for i in range(self.n_docs)]
        scored.sort(reverse=True)
        return scored[:top_k]
```

Два параметра, о которых стоит знать. `k1=1.5` управляет насыщением по частоте термина; чем выше, тем больше вес повторения термина. `b=0.75` управляет нормализацией по длине; 0 игнорирует длину документа, 1 нормализует полностью. Значения по умолчанию — это рекомендации Робертсона из оригинальной статьи, и они редко нуждаются в настройке.

### Шаг 2: плотный поиск с би-энкодером

```python
from sentence_transformers import SentenceTransformer
import numpy as np


def build_dense_index(corpus, model_id="sentence-transformers/all-MiniLM-L6-v2"):
    encoder = SentenceTransformer(model_id)
    embeddings = encoder.encode(corpus, normalize_embeddings=True)
    return encoder, embeddings


def dense_search(encoder, embeddings, query, top_k=10):
    q_emb = encoder.encode([query], normalize_embeddings=True)
    sims = (embeddings @ q_emb.T).flatten()
    order = np.argsort(-sims)[:top_k]
    return [(float(sims[i]), int(i)) for i in order]
```

L2-нормализуйте эмбеддинги, чтобы скалярное произведение равнялось косинусу. `all-MiniLM-L6-v2` имеет размерность 384, быстрый и достаточно сильный для большинства задач поиска на английском. Для многоязычной работы используйте `paraphrase-multilingual-MiniLM-L12-v2`. Для максимальной точности — `bge-large-en-v1.5` или `e5-large-v2`.

### Шаг 3: Reciprocal Rank Fusion

```python
def reciprocal_rank_fusion(rankings, k=60):
    scores = {}
    for ranking in rankings:
        for rank, (_, doc_idx) in enumerate(ranking):
            scores[doc_idx] = scores.get(doc_idx, 0.0) + 1.0 / (k + rank + 1)
    fused = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [(score, doc_idx) for doc_idx, score in fused]
```

Константа `k=60` взята из оригинальной статьи о RRF. Более высокое `k` сглаживает вклад различий в ранге; более низкое `k` делает вклад верхних позиций доминирующим. 60 — опубликованное значение по умолчанию, редко нуждается в настройке.

### Шаг 4: гибридный поиск + реранкинг

```python
from sentence_transformers import CrossEncoder

reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")


def hybrid_search(query, bm25, encoder, dense_embeddings, corpus, top_k=5, pool_size=30, reranker=reranker):
    sparse_ranking = bm25.rank(query, top_k=pool_size)
    dense_ranking = dense_search(encoder, dense_embeddings, query, top_k=pool_size)
    fused = reciprocal_rank_fusion([sparse_ranking, dense_ranking])[:pool_size]

    pairs = [(query, corpus[doc_idx]) for _, doc_idx in fused]
    scores = reranker.predict(pairs)
    reranked = sorted(zip(scores, [doc_idx for _, doc_idx in fused]), reverse=True)
    return reranked[:top_k]
```

Три этапа, собранные вместе. BM25 находит лексические совпадения. Плотный поиск находит семантические совпадения. RRF объединяет два ранжирования без необходимости в калибровке оценок. Кросс-энкодер переоценивает топ-30, используя пары запрос-документ вместе, что улавливает тонкую релевантность, которую пропустил би-энкодер. Оставьте топ-5.

### Шаг 5: оценивание

| Метрика | Значение |
|--------|---------|
| Recall@k | Из запросов, где верный документ существует, как часто он оказывается в топ-k? |
| MRR (Mean Reciprocal Rank) | Среднее значение 1/ранг первого релевантного документа. |
| nDCG@k | Учитывает градации релевантности, а не только бинарное релевантно/нерелевантно. |

Конкретно для RAG **Recall@k** ретривера — самое важное число. Ваш ридер не может ответить, если верного отрывка нет в найденном наборе.

Совет по отладке: для проваленных запросов сравните разреженное и плотное ранжирования. Если один находит верный документ, а другой нет, у вас несовпадение лексики (решение: добавить недостающую половину) или семантическая неоднозначность (решение: лучшие эмбеддинги или реранкер).

## Применение

Стек 2026 года:

| Масштаб | Стек |
|-------|-------|
| 1k–100k документов | BM25 в памяти + эмбеддинги `all-MiniLM-L6-v2` + RRF. Без отдельной БД. |
| 100k–10M документов | FAISS или pgvector для плотного поиска + Elasticsearch / OpenSearch для BM25. Запускать параллельно. |
| 10M+ документов | Qdrant / Weaviate / Vespa / Milvus с поддержкой гибридного поиска. Реранкинг кросс-энкодером на топ-30. |
| Передовой край качества | Трёхстороннее решение (BM25 + плотный + SPLADE) + позднее взаимодействие ColBERT для реранкинга |

Что бы вы ни выбрали, заложите бюджет на оценивание. Бенчмарк полноты поиска перед бенчмарком точности сквозного RAG. Ридер не может исправить то, что упустил ретривер.

### Трудно добытые уроки продакшен-RAG 2026 года

- **80% отказов RAG связаны с приёмом данных и разбиением на фрагменты, а не с моделью.** Команды тратят недели на замену LLM и настройку промптов, пока поиск незаметно возвращает неверный контекст в каждом третьем запросе. Сначала чините разбиение на фрагменты.
- **Стратегия разбиения на фрагменты важнее размера фрагмента.** Разбиение фиксированного размера ломает таблицы, код и вложенные заголовки. Разбиение с учётом предложений — вариант по умолчанию; семантическое или LLM-based разбиение окупается для технической документации и руководств по продуктам.
- **Паттерн родитель-документ.** Извлекайте маленькие «дочерние» фрагменты ради точности. Когда в результатах появляется несколько дочерних фрагментов из одного родительского раздела, подставляйте родительский блок, чтобы сохранить контекст. Это стабильно повышает качество ответов без переобучения.
- **k_rerank=3 обычно оптимально.** Каждый дополнительный фрагмент сверх этого добавляет расход токенов и задержку генерации, не повышая качество ответа. Если k=8 у вас всё ещё лучше, чем k=3, значит реранкер работает недостаточно хорошо.
- **HyDE / расширение запроса.** Сгенерируйте гипотетический ответ из запроса, закодируйте его, выполните поиск. Наводит мост между фразировкой коротких вопросов и длинных документов. Бесплатный прирост точности без обучения.
- **Бюджет контекста менее 8K токенов.** Постоянные попадания в этот предел означают, что порог реранкера слишком слабый.
- **Версионируйте всё.** Промпты, правила разбиения на фрагменты, модель эмбеддингов, реранкер. Любой дрейф незаметно ломает качество ответов. Гейты CI по достоверности, точности контекста и доле неотвеченных вопросов блокируют регрессии до того, как их увидят пользователи.
- **Трёхстороннее ретривальное решение (BM25 + плотный + обучаемый разреженный, например SPLADE) превосходит двустороннее** в бенчмарках 2026 года, особенно для запросов, смешивающих имена собственные с семантикой. Внедряйте, когда инфраструктура поддерживает индексы SPLADE.

Правильный дизайн поиска снижает галлюцинации на 70–90% по измерениям отрасли 2026 года. Большая часть прироста производительности RAG приходит от лучшего поиска, а не от дообучения модели.

## Публикация

Сохраните как `outputs/skill-retrieval-picker.md`:

```markdown
---
name: retrieval-picker
description: Pick a retrieval stack for a given corpus and query pattern.
version: 1.0.0
phase: 5
lesson: 14
tags: [nlp, retrieval, rag, search]
---

Given requirements (corpus size, query pattern, latency budget, quality bar, infra constraints), output:

1. Stack. BM25 only, dense only, hybrid (BM25 + dense + RRF), hybrid + cross-encoder rerank, or three-way (BM25 + dense + learned-sparse).
2. Dense encoder. Name the specific model. Match to language(s), domain, and context length.
3. Reranker. Name the specific cross-encoder model if used. Flag that rerank adds 30-100ms latency on top-30.
4. Evaluation plan. Recall@10 is the primary retriever metric. MRR for multi-answer. Baseline first, incremental improvements measured against it.

Refuse to recommend dense-only for corpora with named entities, error codes, or product SKUs unless the user has evidence dense handles exact matches. Refuse to skip reranking for high-stakes retrieval (legal, medical) where the final top-5 decides the user's answer.
```

## Упражнения

1. **Лёгкое.** Реализуйте `hybrid_search` выше на корпусе из 500 документов. Протестируйте 20 запросов. Сравните recall@5 между BM25-only, dense-only и гибридным вариантом.
2. **Среднее.** Добавьте вычисление MRR. Для каждого тестового запроса с известным верным документом найдите ранг верного документа в ранжированиях BM25, плотного и гибридного поиска. Приведите MRR для каждого варианта.
3. **Сложное.** Дообучите плотный энкодер на своём домене с помощью MultipleNegativesRankingLoss (Sentence Transformers). Постройте обучающий набор из 500 пар запрос-документ. Сравните полноту поиска до и после дообучения.

## Ключевые термины

| Термин | Что говорят | Что это на самом деле означает |
|------|-----------------|-----------------------|
| BM25 | Поиск по ключевым словам | Okapi BM25. Оценивает документы по частоте термина, IDF и длине. |
| Плотный поиск | Векторный поиск | Кодирует запрос и документ в векторы, находит ближайших соседей. |
| Би-энкодер | Модель эмбеддингов | Кодирует запрос и документ независимо. Быстр во время запроса. |
| Кросс-энкодер | Модель реранкера | Кодирует запрос и документ вместе. Медленный, но точный. |
| RRF | Слияние ранжирований | Объединяет два ранжирования суммированием `1/(k + rank)`. |
| Recall@k | Метрика поиска | Доля запросов, для которых релевантный документ находится в топ-k. |

## Дополнительное чтение

- [Robertson and Zaragoza (2009). The Probabilistic Relevance Framework: BM25 and Beyond](https://www.staff.city.ac.uk/~sbrp622/papers/foundations_bm25_review.pdf) — исчерпывающий разбор BM25.
- [Karpukhin et al. (2020). Dense Passage Retrieval for Open-Domain QA](https://arxiv.org/abs/2004.04906) — DPR, канонический би-энкодер.
- [Formal et al. (2021). SPLADE: Sparse Lexical and Expansion Model](https://arxiv.org/abs/2107.05720) — обучаемый разреженный ретривер, сокращающий разрыв с плотным поиском.
- [Cormack, Clarke, Büttcher (2009). Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf) — статья о RRF.
- [Khattab and Zaharia (2020). ColBERT: Efficient and Effective Passage Search](https://arxiv.org/abs/2004.12832) — поиск с поздним взаимодействием.
