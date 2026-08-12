# Тематическое моделирование — LDA и BERTopic

> LDA: документы — это смеси тем, темы — это распределения по словам. BERTopic: документы образуют кластеры в пространстве эмбеддингов, кластеры — это темы. Одна и та же цель, разные разложения.

**Тип:** Learn
**Языки:** Python
**Предварительные требования:** Фаза 5 · 02 (BoW + TF-IDF), Фаза 5 · 03 (Word2Vec)
**Время:** ~45 минут

## Проблема

У вас есть 10 000 обращений в службу поддержки, 50 000 новостных статей или 200 000 твитов. Нужно понять, о чём эта коллекция, не читая её целиком. У вас нет размеченных категорий. Вы даже не знаете, сколько категорий существует.

Тематическое моделирование решает эту задачу без учителя. Подайте на вход корпус — получите на выходе небольшой набор согласованных тем и, для каждого документа, распределение по этим темам.

Доминируют два семейства алгоритмов. LDA (2003) рассматривает каждый документ как смесь латентных тем, а каждую тему — как распределение по словам. Инференс байесовский. Алгоритм до сих пор используется в продакшене там, где нужны присвоения тем со смешанным членством и объяснимые распределения вероятностей на уровне слов.

BERTopic (2020) кодирует документы с помощью BERT, снижает размерность через UMAP, кластеризует с помощью HDBSCAN и извлекает слова тем с помощью классового TF-IDF. Он выигрывает на коротких текстах, в социальных сетях и везде, где семантическое сходство важнее пересечения слов. Один документ получает одну тему, что является ограничением для длинного контента.

Этот урок формирует интуицию для обоих подходов и подсказывает, какой из них выбрать для конкретного корпуса.

## Концепция

![Смесевая модель LDA и кластеризация BERTopic](../assets/topic-modeling.svg)

**Порождающая модель LDA.** Каждая тема — это распределение по словам. Каждый документ — это смесь тем. Чтобы сгенерировать слово в документе, сначала сэмплируется тема из смеси документа, затем слово — из распределения этой темы. Инференс работает в обратную сторону: по наблюдаемым словам восстанавливается распределение тем для каждого документа и распределение слов для каждой темы. Вычисления выполняются с помощью свёрнутого сэмплирования по Гиббсу или вариационного байесовского вывода.

Ключевой вывод LDA:

- `doc_topic`: матрица `(n_docs, n_topics)`, каждая строка суммируется в 1 (смесь тем документа).
- `topic_word`: матрица `(n_topics, vocab_size)`, каждая строка суммируется в 1 (распределение слов темы).

**Конвейер BERTopic.**

1. Каждый документ кодируется с помощью трансформера предложений (например, `all-MiniLM-L6-v2`). Векторы размерности 384.
2. Размерность снижается с помощью UMAP примерно до 5 измерений. Эмбеддинги BERT слишком многомерны для кластеризации.
3. Кластеризация выполняется с помощью HDBSCAN. Алгоритм на основе плотности, даёт кластеры переменного размера и метку «выброс».
4. Для каждого кластера вычисляется классовый TF-IDF по документам кластера, чтобы извлечь топ-слова.

На выходе — одна тема на документ (плюс метка выброса -1). Опционально доступно мягкое членство через вектор вероятностей HDBSCAN.

```figure
topic-drift
```

## Создаём

### Шаг 1: LDA через scikit-learn

```python
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.decomposition import LatentDirichletAllocation
import numpy as np


def fit_lda(documents, n_topics=5, max_features=1000):
    cv = CountVectorizer(
        max_features=max_features,
        stop_words="english",
        min_df=2,
        max_df=0.9,
    )
    X = cv.fit_transform(documents)
    lda = LatentDirichletAllocation(
        n_components=n_topics,
        random_state=42,
        max_iter=50,
        learning_method="online",
    )
    doc_topic = lda.fit_transform(X)
    feature_names = cv.get_feature_names_out()
    return lda, cv, doc_topic, feature_names


def print_top_words(lda, feature_names, n_top=10):
    for idx, topic in enumerate(lda.components_):
        top_idx = np.argsort(-topic)[:n_top]
        words = [feature_names[i] for i in top_idx]
        print(f"topic {idx}: {' '.join(words)}")
```

Обратите внимание: стоп-слова удалены, min_df и max_df отфильтровывают редкие и вездесущие термины, используется CountVectorizer (а не TfidfVectorizer), потому что LDA ожидает на входе сырые счётчики.

### Шаг 2: BERTopic (продакшен)

```python
from bertopic import BERTopic

topic_model = BERTopic(
    embedding_model="sentence-transformers/all-MiniLM-L6-v2",
    min_topic_size=15,
    verbose=True,
)

topics, probs = topic_model.fit_transform(documents)
info = topic_model.get_topic_info()
print(info.head(20))
valid_topics = info[info["Topic"] != -1]["Topic"].tolist()
for topic_id in valid_topics[:5]:
    print(f"topic {topic_id}: {topic_model.get_topic(topic_id)[:10]}")
```

Фильтр `Topic != -1` отбрасывает корзину выбросов BERTopic (документы, которые HDBSCAN не смог кластеризовать). `min_topic_size` управляет минимальным размером кластера HDBSCAN; значение по умолчанию в библиотеке BERTopic — 10. В этом примере значение явно установлено в 15 — под масштаб урока. Для корпусов свыше 10 000 документов увеличивайте до 50 или 100.

### Шаг 3: оценивание

Оба метода выдают слова тем. Вопрос в том, согласованы ли эти слова между собой.

- **Согласованность тем (c_v).** Объединяет NPMI (нормализованную точечную взаимную информацию) пар топ-слов по контекстам скользящего окна, агрегирует оценки в векторы тем и сравнивает эти векторы через косинусное сходство. Чем выше, тем лучше. Используйте `gensim.models.CoherenceModel` с `coherence="c_v"`.
- **Разнообразие тем.** Доля уникальных слов среди топ-слов всех тем. Чем выше, тем лучше (темы не пересекаются).
- **Качественная проверка.** Прочитайте топ-слова каждой темы. Называют ли они что-то реальное? Человеческая оценка по-прежнему остаётся последним рубежом защиты.

## Когда что выбирать

| Ситуация | Выбор |
|-----------|------|
| Короткий текст (твиты, отзывы, заголовки) | BERTopic |
| Длинные документы со смесями тем | LDA |
| Нет GPU / ограниченные вычислительные ресурсы | LDA или NMF |
| Нужны распределения по нескольким темам на уровне документа | LDA |
| Интеграция с LLM для присвоения названий темам | BERTopic (прямая поддержка) |
| Развёртывание на периферийных устройствах с ограниченными ресурсами | LDA |
| Максимальная семантическая согласованность | BERTopic |

Главное практическое соображение — длина документа. Эмбеддинги BERT обрезаются; счётчики LDA работают при любой длине. Для документов длиннее контекста модели эмбеддингов либо разбивайте на фрагменты и агрегируйте, либо используйте LDA.

## Применяем

Стек 2026 года:

- **BERTopic.** Вариант по умолчанию для короткого текста и всего, где важна семантика.
- **`gensim.models.LdaModel`.** Классическая LDA для продакшена, зрелая, проверенная боем.
- **`sklearn.decomposition.LatentDirichletAllocation`.** Простая LDA для экспериментов.
- **NMF.** Неотрицательное матричное разложение. Быстрая альтернатива LDA, сопоставимое качество на коротком тексте.
- **Top2Vec.** По конструкции похож на BERTopic. Сообщество меньше, но хорошие результаты на некоторых бенчмарках.
- **FASTopic.** Более новый, быстрее BERTopic на очень крупных корпусах.
- **Разметка на основе LLM.** Выполните любую кластеризацию, затем попросите модель промптом назвать каждый кластер.

## Публикуем

Сохраните как `outputs/skill-topic-picker.md`:

```markdown
---
name: topic-picker
description: Pick LDA or BERTopic for a corpus. Specify library, knobs, evaluation.
version: 1.0.0
phase: 5
lesson: 15
tags: [nlp, topic-modeling]
---

Given a corpus description (document count, avg length, domain, language, compute budget), output:

1. Algorithm. LDA / NMF / BERTopic / Top2Vec / FASTopic. One-sentence reason.
2. Configuration. Number of topics: `recommended = max(5, round(sqrt(n_docs)))`, clamped to 200 for corpora under 40,000 docs; permit >200 only when the corpus is genuinely large (>40k) and note the increased compute cost. `min_df` / `max_df` filters and embedding model for neural approaches also belong here.
3. Evaluation. Topic coherence (c_v) via `gensim.models.CoherenceModel`, topic diversity, and a 20-sample human read.
4. Failure mode to probe. For LDA, "junk topics" absorbing stopwords and frequent terms. For BERTopic, the -1 outlier cluster swallowing ambiguous documents.

Refuse BERTopic on documents longer than the embedding model's context window without a chunking strategy. Refuse LDA on very short text (tweets, reviews under 10 tokens) as coherence collapses. Flag any n_topics choice below 5 as likely wrong; flag >200 on corpora under 40k docs as likely over-splitting.
```

## Упражнения

1. **Лёгкое.** Обучите LDA с 5 темами на наборе данных 20 Newsgroups. Выведите топ-10 слов для каждой темы. Промаркируйте каждую тему вручную. Нашёл ли алгоритм настоящие категории?
2. **Среднее.** Обучите BERTopic на том же подмножестве 20 Newsgroups. Сравните количество найденных тем, топ-слова и качественную согласованность с LDA. Какой метод точнее выявляет настоящие категории?
3. **Сложное.** Вычислите согласованность c_v для LDA и BERTopic на вашем корпусе. Запустите каждый метод с 5, 10, 20, 50 темами. Постройте график зависимости согласованности от количества тем. Определите, какой метод стабильнее при разном количестве тем.

## Ключевые термины

| Термин | Как говорят люди | Что это на самом деле означает |
|------|-----------------|-----------------------|
| Тема | То, о чём корпус | Распределение вероятностей по словам (LDA) или кластер похожих документов (BERTopic). |
| Смешанное членство | Документ относится к нескольким темам | LDA присваивает каждому документу распределение по всем темам. |
| UMAP | Снижение размерности | Обучение на многообразиях, сохраняющее локальную структуру; используется в BERTopic. |
| HDBSCAN | Кластеризация на основе плотности | Находит кластеры переменного размера; выдаёт метку «шум» (-1) для выбросов. |
| Согласованность c_v | Метрика качества тем | Средняя точечная взаимная информация топ-слов темы в пределах скользящих окон. |

## Дополнительные материалы

- [Blei, Ng, Jordan (2003). Latent Dirichlet Allocation](https://www.jmlr.org/papers/volume3/blei03a/blei03a.pdf) — статья о LDA.
- [Grootendorst (2022). BERTopic: Neural topic modeling with a class-based TF-IDF procedure](https://arxiv.org/abs/2203.05794) — статья о BERTopic.
- [Röder, Both, Hinneburg (2015). Exploring the Space of Topic Coherence Measures](https://svn.aksw.org/papers/2015/WSDM_Topic_Evaluation/public.pdf) — статья, представившая c_v и родственные метрики.
- [Документация BERTopic](https://maartengr.github.io/BERTopic/) — справочник для продакшена. Отличные примеры.
