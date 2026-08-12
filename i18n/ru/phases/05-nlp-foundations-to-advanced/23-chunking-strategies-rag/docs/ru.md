# Стратегии разбиения на фрагменты для RAG

> Настройка разбиения на фрагменты влияет на качество поиска не меньше, чем выбор модели эмбеддингов (Vectara NAACL 2025). Ошибитесь с разбиением — и никакое реранжирование не спасёт.

**Тип:** Build**Языки:** Python**Предварительные требования:** Фаза 5 · 14 (Information Retrieval), Фаза 5 · 22 (Embedding Models)**Время:** ~60 минут
## Проблема

Вы загрузили в RAG-систему контракт на 50 страниц. Пользователь спрашивает: «Какое условие расторжения?» Ретривер возвращает титульную страницу. Почему? Потому что модель обучалась на фрагментах по 512 токенов, а условие расторжения находится на 20-й странице, разбито разрывом страницы, без локальных ключевых слов, связывающих его с запросом.

Решение — не «купить модель эмбеддингов получше». Решение — в разбиении на фрагменты. Какого размера? С перекрытием? Где делить? С окружающим контекстом?

Бенчмарки февраля 2026 года показывают неожиданные результаты:

- Исследование Vectara 2026 года: рекурсивное разбиение по 512 токенов обошло семантическое разбиение — 69% против 54% точности.
- SPLADE + Mistral-8B на Natural Questions: перекрытие не дало измеримой пользы.
- Обрыв контекста (context cliff): качество ответа резко падает примерно на отметке 2500 токенов контекста.

«Очевидный» ответ (семантическое разбиение, перекрытие 20%, 1000 токенов) часто оказывается неверным. Этот урок формирует интуицию для шести стратегий и говорит, когда какую применять.

## Концепция

![Шесть стратегий разбиения на фрагменты на одном отрывке](../assets/chunking.svg)

**Фиксированное разбиение.** Деление каждые N символов или токенов. Простейшая базовая линия. Разрывает предложения посередине. Хорошее сжатие, плохая связность.

**Рекурсивное.** `RecursiveCharacterTextSplitter` от LangChain. Сначала попытка разбить по `\n\n`, затем по `\n`, затем по `.`, затем по пробелу. Аккуратно откатывается назад. Выбор по умолчанию в 2026 году.

**Семантическое.** Каждое предложение кодируется эмбеддингом. Вычисляется косинусное сходство между соседними предложениями. Разбиение происходит там, где сходство падает ниже порога. Сохраняет тематическую связность. Медленнее; иногда порождает крошечные фрагменты по 40 токенов, вредящие поиску.

**По предложениям.** Разбиение по границам предложений. Одно предложение на фрагмент или окно из N предложений. Соответствует семантическому разбиению вплоть до ~5 тыс. токенов при малой доле стоимости.

**Родитель-потомок (parent-document).** Для поиска хранятся маленькие дочерние фрагменты, *а также* более крупный родительский фрагмент для контекста. Поиск идёт по потомку; возвращается родитель. Деградирует плавно: даже плохие дочерние фрагменты возвращают разумных родителей.

**Позднее разбиение (2024).** Сначала кодируется весь документ на уровне токенов, затем токен-эмбеддинги объединяются в эмбеддинги фрагментов. Сохраняет контекст между фрагментами. Работает с длинноконтекстными энкодерами (BGE-M3, Jina v3). Более высокие вычислительные затраты.

**Контекстный поиск (Anthropic, 2024).** К каждому фрагменту добавляется сгенерированное LLM резюме его положения в документе («Этот фрагмент — раздел 3.2 условий расторжения...»). Улучшение поиска на 35–50% в собственном бенчмарке Anthropic. Дорого при индексации.

### Правило, которое побеждает любую настройку по умолчанию

Подбирайте размер фрагмента под тип запроса:

| Тип запроса | Размер фрагмента |
|------------|-----------|
| Фактоидный («как зовут CEO?») | 256–512 токенов |
| Аналитический / многоходовой | 512–1024 токена |
| Понимание целого раздела | 1024–2048 токенов |

Бенчмарк NVIDIA 2026 года. Фрагмент должен быть достаточно велик, чтобы содержать ответ и локальный контекст, и достаточно мал, чтобы top-K ретривера возвращал результаты, сфокусированные на ответе, а не на посторонних шумах контекста.

```figure
n5-chunk-cuts
```

## Постройте это

### Шаг 1: фиксированное и рекурсивное разбиение

```python
def chunk_fixed(text, size=512, overlap=0):
    step = size - overlap
    return [text[i:i + size] for i in range(0, len(text), step)]


def chunk_recursive(text, size=512, seps=("\n\n", "\n", ". ", " ")):
    if len(text) <= size:
        return [text]
    for sep in seps:
        if sep not in text:
            continue
        parts = text.split(sep)
        chunks = []
        buf = ""
        for p in parts:
            if len(p) > size:
                if buf:
                    chunks.append(buf)
                    buf = ""
                chunks.extend(chunk_recursive(p, size=size, seps=seps[1:] or (" ",)))
                continue
            candidate = buf + sep + p if buf else p
            if len(candidate) <= size:
                buf = candidate
            else:
                if buf:
                    chunks.append(buf)
                buf = p
        if buf:
            chunks.append(buf)
        return [c for c in chunks if c.strip()]
    return chunk_fixed(text, size)
```

### Шаг 2: семантическое разбиение

```python
def chunk_semantic(text, encoder, threshold=0.6, min_chars=200, max_chars=2048):
    sentences = split_sentences(text)
    if not sentences:
        return []
    embs = encoder.encode(sentences, normalize_embeddings=True)
    chunks = [[sentences[0]]]
    for i in range(1, len(sentences)):
        sim = float(embs[i] @ embs[i - 1])
        current_len = sum(len(s) for s in chunks[-1])
        if sim < threshold and current_len >= min_chars:
            chunks.append([sentences[i]])
        else:
            chunks[-1].append(sentences[i])

    result = []
    for group in chunks:
        text_group = " ".join(group)
        if len(text_group) > max_chars:
            result.extend(chunk_recursive(text_group, size=max_chars))
        else:
            result.append(text_group)
    return result
```

Настройте `threshold` под свой домен. Слишком высокий → фрагментация. Слишком низкий → один гигантский фрагмент.

### Шаг 3: родитель-потомок

```python
def chunk_parent_child(text, parent_size=2048, child_size=256):
    parents = chunk_recursive(text, size=parent_size)
    mapping = []
    for p_idx, parent in enumerate(parents):
        children = chunk_recursive(parent, size=child_size)
        for child in children:
            mapping.append({"child": child, "parent_idx": p_idx, "parent": parent})
    return mapping


def retrieve_parent(child_query, mapping, encoder, top_k=3):
    child_embs = encoder.encode([m["child"] for m in mapping], normalize_embeddings=True)
    q_emb = encoder.encode([child_query], normalize_embeddings=True)[0]
    scores = child_embs @ q_emb
    top = np.argsort(-scores)[:top_k]
    seen, parents = set(), []
    for i in top:
        if mapping[i]["parent_idx"] not in seen:
            parents.append(mapping[i]["parent"])
            seen.add(mapping[i]["parent_idx"])
    return parents
```

Ключевая идея: дедупликация родителей. Несколько потомков могут отображаться на одного родителя; возврат всех был бы тратой контекста впустую.

### Шаг 4: контекстный поиск (паттерн Anthropic)

```python
def contextualize_chunks(document, chunks, llm):
    context_prompts = [
        f"""<document>{document}</document>
Here is the chunk to situate: <chunk>{c}</chunk>
Write 50-100 words placing this chunk in the document's context."""
        for c in chunks
    ]
    contexts = llm.batch(context_prompts)
    return [f"{ctx}\n\n{c}" for ctx, c in zip(contexts, chunks)]
```

Индексируются контекстуализированные фрагменты. Во время запроса поиск выигрывает от дополнительного окружающего сигнала.

### Шаг 5: оцените

```python
def recall_at_k(queries, corpus_chunks, encoder, k=5):
    chunk_embs = encoder.encode(corpus_chunks, normalize_embeddings=True)
    hits = 0
    for q_text, gold_idxs in queries:
        q_emb = encoder.encode([q_text], normalize_embeddings=True)[0]
        top = np.argsort(-(chunk_embs @ q_emb))[:k]
        if any(i in gold_idxs for i in top):
            hits += 1
    return hits / len(queries)
```

Всегда проверяйте на бенчмарке. «Лучшая» стратегия для вашего корпуса может не совпасть ни с одним постом в блоге.

## Ловушки

- **Разбиение оценивается только на фактоидных запросах.** Многоходовые запросы выявляют совсем других победителей. Используйте оценочный набор, стратифицированный по типу запроса.
- **Семантическое разбиение без минимального размера.** Порождает фрагменты по 40 токенов, вредящие поиску. Всегда задавайте `min_tokens`.
- **Перекрытие как карго-культ.** Исследования 2026 года показывают, что перекрытие часто не даёт пользы и удваивает стоимость индекса. Измеряйте, а не предполагайте.
- **Отсутствие ограничений min/max.** И фрагменты по 5 токенов, и по 5000 токенов ломают поиск. Устанавливайте границы.
- **Разбиение через границы документов.** Никогда не позволяйте фрагменту охватывать два документа. Всегда разбивайте по документу, затем объединяйте.

## Применение

Стек 2026 года:

| Ситуация | Стратегия |
|-----------|----------|
| Первая сборка, неизвестный корпус | Рекурсивное, 512 токенов, без перекрытия |
| Фактоидные вопросы | Рекурсивное, 256–512 токенов |
| Аналитическое / многоходовое | Рекурсивное, 512–1024 токена + родитель-потомок |
| Плотные перекрёстные ссылки (контракты, статьи) | Позднее разбиение или контекстный поиск |
| Диалоговый корпус | Фрагменты на уровне реплик + метаданные говорящего |
| Короткие высказывания (твиты, отзывы) | Один документ = один фрагмент |

Начните с рекурсивного разбиения по 512. Измерьте recall@5 на оценочном наборе из 50 запросов. Настраивайте дальше.

## Отправьте это в продакшен

Сохраните как `outputs/skill-chunker.md`:

```markdown
---
name: chunker
description: Pick a chunking strategy, size, and overlap for a given corpus and query distribution.
version: 1.0.0
phase: 5
lesson: 23
tags: [nlp, rag, chunking]
---

Given a corpus (document types, avg length, domain) and query distribution (factoid / analytical / multi-hop), output:

1. Strategy. Recursive / sentence / semantic / parent-document / late / contextual. Reason.
2. Chunk size. Token count. Reason tied to query type.
3. Overlap. Default 0; justify if >0.
4. Min/max enforcement. `min_tokens`, `max_tokens` guards.
5. Evaluation plan. Recall@5 on 50-query stratified eval set (factoid, analytical, multi-hop).

Refuse any chunking strategy without min/max chunk size enforcement. Refuse overlap above 20% without an ablation showing it helps. Flag semantic chunking recommendations without a min-token floor.
```

## Упражнения

1. **Лёгкое.** Разбейте один документ на 20 страниц с помощью fixed(512, 0), recursive(512, 0) и recursive(512, 100). Сравните количество фрагментов и качество границ.
2. **Среднее.** Постройте оценочный набор из 30 запросов по 5 документам. Измерьте recall@5 для рекурсивного, семантического разбиения и разбиения родитель-потомок. Кто побеждает? Совпадает ли это с постами в блогах?
3. **Сложное.** Реализуйте контекстный поиск. Измерьте улучшение MRR относительно базового рекурсивного разбиения. Отчитайтесь о стоимости индексации (вызовы LLM) в сравнении с приростом точности.

## Ключевые термины

| Термин | Что говорят люди | Что это на самом деле означает |
|------|-----------------|-----------------------|
| Chunk | Кусок документа | Субдокументная единица, которая кодируется эмбеддингом, индексируется и извлекается. |
| Overlap | Запас на всякий случай | N токенов, общих для соседних фрагментов; часто бесполезны согласно бенчмаркам 2026 года. |
| Semantic chunking | Умное разбиение | Разбиение там, где падает сходство эмбеддингов соседних предложений. |
| Parent-document | Двухуровневый поиск | Поиск по маленьким потомкам, возврат более крупных родителей. |
| Late chunking | Разбиение после кодирования | Весь документ кодируется на уровне токенов, затем объединяется в векторы фрагментов. |
| Contextual retrieval | Трюк Anthropic | Сгенерированное LLM резюме, добавляемое к каждому фрагменту перед индексацией. |
| Context cliff | Стена на 2500 токенах | Падение качества, наблюдаемое около 2,5 тыс. токенов контекста в RAG (январь 2026). |

## Дополнительное чтение

- [Yepes et al. / LangChain — Recursive Character Splitting docs](https://python.langchain.com/docs/how_to/recursive_text_splitter/) — вариант по умолчанию в продакшене.
- [Vectara (2024, NAACL 2025). Chunking configurations analysis](https://arxiv.org/abs/2410.13070) — разбиение важно не меньше, чем выбор эмбеддинга.
- [Jina AI — Late Chunking in Long-Context Embedding Models (2024)](https://jina.ai/news/late-chunking-in-long-context-embedding-models/) — статья про позднее разбиение.
- [Anthropic — Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval) — улучшение поиска на 35–50% с помощью префиксов контекста, сгенерированных LLM.
- [NVIDIA 2026 chunk-size benchmark — Premai summary](https://blog.premai.io/rag-chunking-strategies-the-2026-benchmark-guide/) — размер фрагмента по типу запроса.
