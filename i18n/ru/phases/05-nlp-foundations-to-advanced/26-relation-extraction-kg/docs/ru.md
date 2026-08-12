# Извлечение отношений и построение графа знаний

> NER нашёл сущности. Связывание сущностей их закрепило. Извлечение отношений находит рёбра между ними. Граф знаний — это совокупность узлов, рёбер и данных об их происхождении.

**Тип:** Build
**Языки:** Python
**Предварительные требования:** Фаза 5 · 06 (NER), фаза 5 · 25 (связывание сущностей)
**Время:** ~60 минут

## Проблема

Аналитик читает: «Тим Кук стал генеральным директором Apple в 2011 году». Четыре факта:

- `(Tim Cook, role, CEO)`
- `(Tim Cook, employer, Apple)`
- `(Tim Cook, start_date, 2011)`
- `(Apple, type, Organization)`

Извлечение отношений (RE) превращает свободный текст в структурированные тройки `(subject, relation, object)`. Агрегируйте их по всему корпусу — и получите граф знаний. Добавьте запросы — и получите основу для рассуждений в RAG, аналитике или аудитах на соответствие требованиям.

Проблема 2026 года: LLM извлекают отношения с энтузиазмом. Слишком большим энтузиазмом. Они галлюцинируют тройки, которые не подтверждаются исходным текстом. Без данных о происхождении вы не можете отличить реальные тройки от правдоподобного вымысла. Ответ 2026 года — конвейеры в стиле AEVS: закрепление и верификация.

## Концепция

![Текст → тройки → граф знаний](../assets/relation-extraction.svg)

**Форма тройки.** `(subject_entity, relation_type, object_entity)`. Отношения берутся из закрытой онтологии (свойства Wikidata, FIBO, UMLS) или открытого множества (в стиле OpenIE, без ограничений).

**Три подхода к извлечению.**

1. **На основе правил / паттернов.** Паттерны Хёрст: «X, такие как Y» → `(Y, isA, X)`. Плюс написанные вручную регулярные выражения. Хрупкий, точный, объяснимый подход.
2. **Классификатор отношений с обучением с учителем.** Для двух упоминаний сущностей в предложении предсказывается отношение из фиксированного множества. Обучен на TACRED, ACE, KBP. Стандарт 2015–2022 годов.
3. **Генеративный LLM.** Промпт для модели с целью получить тройки. Работает из коробки. Нуждается в происхождении, иначе галлюцинирует правдоподобно выглядящий мусор.

**AEVS («Закрепление — извлечение — верификация — дополнение», 2026).** Актуальный фреймворк для снижения числа галлюцинаций:

- **Закрепление.** Определение точных позиций каждого спана сущности и фразы, выражающей отношение.
- **Извлечение.** Генерация троек, связанных с закреплёнными спанами.
- **Верификация.** Сопоставление каждого элемента тройки с исходным текстом; отклонение всего неподтверждённого.
- **Дополнение.** Проход для проверки покрытия гарантирует, что ни один закреплённый спан не отброшен.

Число галлюцинаций резко снижается. Требует больше вычислений, но поддаётся аудиту.

**Компромисс между открытым и закрытым.**

- **Закрытая онтология.** Фиксированный список свойств (например, более 11 000 свойств Wikidata). Предсказуемо. Пригодно для запросов. Трудно выдумать.
- **Open IE.** Любая глагольная фраза становится отношением. Высокая полнота. Низкая точность. Сложно для запросов.

Продакшен-графы знаний обычно сочетают подходы: Open IE для обнаружения, затем каноникализацию отношений в закрытую онтологию перед слиянием с основным графом.

```figure
relation-triples
```

## Постройте это

### Шаг 1: извлечение на основе паттернов

```python
PATTERNS = [
    (r"(?P<s>[A-Z]\w+) (?:is|was) (?:a|an|the) (?P<o>[A-Z]?\w+)", "isA"),
    (r"(?P<s>[A-Z]\w+) (?:is|was) born in (?P<o>\w+)", "bornIn"),
    (r"(?P<s>[A-Z]\w+) works? (?:at|for) (?P<o>[A-Z]\w+)", "worksAt"),
    (r"(?P<s>[A-Z]\w+) founded (?P<o>[A-Z]\w+)", "founded"),
]
```

См. `code/main.py` для полного игрушечного экстрактора. Паттерны Хёрст всё ещё используются в доменных пайплайнах, потому что они поддаются отладке.

### Шаг 2: классификация отношений с обучением с учителем

```python
from transformers import AutoTokenizer, AutoModelForSequenceClassification

tok = AutoTokenizer.from_pretrained("Babelscape/rebel-large")
model = AutoModelForSequenceClassification.from_pretrained("Babelscape/rebel-large")

text = "Tim Cook was born in Alabama. He later became CEO of Apple."
encoded = tok(text, return_tensors="pt", truncation=True)
output = model.generate(**encoded, max_length=200)
triples = tok.batch_decode(output, skip_special_tokens=False)
```

REBEL — это seq2seq-экстрактор отношений: на входе текст, на выходе тройки, уже с идентификаторами свойств Wikidata. Он дообучен на данных, размеченных посредством дистантного обучения с учителем (distant supervision). Это стандартная базовая линия с открытыми весами.

### Шаг 3: извлечение с промптингом LLM и закреплением

```python
prompt = f"""Extract (subject, relation, object) triples from the text.
For each triple, include the exact character span in the source text.

Text: {text}

Output JSON:
[{{"subject": {{"text": "...", "span": [start, end]}},
   "relation": "...",
   "object": {{"text": "...", "span": [start, end]}}}}, ...]

Only include triples fully supported by the text. No inference beyond what is stated.
"""
```

Проверяйте каждый возвращённый спан относительно источника. Отклоняйте всё, где `text[start:end] != triple_entity`. Это минимальная форма шага «верификация» AEVS.

### Шаг 4: каноникализация в закрытую онтологию

```python
RELATION_MAP = {
    "is the CEO of": "P169",       # "chief executive officer"
    "was born in":   "P19",         # "place of birth"
    "founded":        "P112",       # "founded by" (inverted subject/object)
    "works at":       "P108",       # "employer"
}


def canonicalize(relation):
    rel_low = relation.lower().strip()
    if rel_low in RELATION_MAP:
        return RELATION_MAP[rel_low]
    return None   # drop unmapped open relations or route to manual review
```

Каноникализация часто составляет 60–80% всей инженерной работы. Закладывайте на неё бюджет.

### Шаг 5: постройте небольшой граф и выполните запрос

```python
triples = extract(text)
graph = {}
for s, r, o in triples:
    graph.setdefault(s, []).append((r, o))


def neighbors(node, relation=None):
    return [(r, o) for r, o in graph.get(node, []) if relation is None or r == relation]


print(neighbors("Tim Cook", relation="P108"))    # -> [(P108, Apple)]
```

Это атом каждой системы RAG-над-графом-знаний. Масштабируйте с помощью RDF-хранилищ троек (Blazegraph, Virtuoso), графов свойств (Neo4j) или векторно-усиленных графовых хранилищ.

## Ловушки

- **Кореференция перед RE.** «Он основал Apple» — при извлечении отношений нужно знать, кто такой «он». Сначала разрешите кореференцию (урок 24).
- **Каноникализация сущностей.** «Apple Inc» и «Apple» должны быть сопоставлены с одним и тем же узлом. Сначала выполните связывание сущностей (урок 25).
- **Галлюцинированные тройки.** LLM выдают тройки, не подтверждённые текстом. Обеспечьте верификацию спанов.
- **Дрейф каноникализации отношений.** Отношения Open IE непоследовательны («родился в», «происходит из», «уроженец»). Сведите их к каноническим идентификаторам, иначе граф будет непригоден для запросов.
- **Временные ошибки.** «Тим Кук — генеральный директор Apple» — верно сейчас, но было неверно в 2005 году. Многие отношения ограничены во времени. Используйте квалификаторы (`P580` — время начала, `P582` — время окончания в Wikidata).
- **Несоответствие домену.** REBEL обучен на Wikipedia. Юридические, медицинские и научные тексты часто требуют моделей RE, дообученных для соответствующего домена.

## Применение

Стек 2026 года:

| Ситуация | Выбор |
|-----------|------|
| Быстрый продакшен, общий домен | REBEL или LlamaPred с каноникализацией по Wikidata |
| Доменно-специфичный (биомедицина, право) | Доменное дообучение в стиле SciREX + кастомная онтология |
| Промптинг LLM, аудируемый вывод | Пайплайн AEVS: закрепление → извлечение → верификация → дополнение |
| Высокообъёмное IE новостей | Гибрид на основе паттернов и классификации с обучением с учителем |
| Построение графа знаний с нуля | Open IE + ручной проход каноникализации |
| Временной граф знаний | Извлечение с квалификаторами (время начала/окончания, момент времени) |

Схема интеграции: NER → разрешение кореференции → связывание сущностей → извлечение отношений → отображение на онтологию → загрузка в граф. Каждый этап — потенциальная точка контроля качества.

## Отправьте это в продакшен

Сохраните как `outputs/skill-re-designer.md`:

```markdown
---
name: re-designer
description: Design a relation extraction pipeline with provenance and canonicalization.
version: 1.0.0
phase: 5
lesson: 26
tags: [nlp, relation-extraction, knowledge-graph]
---

Given a corpus (domain, language, volume) and downstream use (KG-RAG, analytics, compliance), output:

1. Extractor. Pattern-based / supervised / LLM / AEVS hybrid. Reason tied to precision vs recall target.
2. Ontology. Closed property list (Wikidata / domain) or open IE with canonicalization pass.
3. Provenance. Every triple carries source char-span + doc id. Non-negotiable for audit.
4. Merge strategy. Canonical entity id + relation id + temporal qualifiers; dedup policy.
5. Evaluation. Precision / recall on 200 hand-labelled triples + hallucination-rate on LLM-extracted sample.

Refuse any LLM-based RE pipeline without span verification (source provenance). Refuse open-IE output flowing into a production graph without canonicalization. Flag pipelines with no temporal qualifier on time-bounded relations (employer, spouse, position).
```

## Упражнения

1. **Лёгкое.** Запустите экстрактор на основе паттернов из `code/main.py` на 5 предложениях из новостных статей. Вручную проверьте точность.
2. **Среднее.** Используйте REBEL (или небольшую LLM) на тех же предложениях. Сравните тройки. У какого экстрактора точность выше? А полнота?
3. **Сложное.** Постройте пайплайн AEVS: извлечение с помощью LLM + верификация спанов относительно источника. Измерьте долю галлюцинаций до и после шага верификации на 50 предложениях в стиле Wikipedia.

## Ключевые термины

| Термин | Как обычно говорят | Что это на самом деле означает |
|------|-----------------|-----------------------|
| Тройка | Субъект — отношение — объект | Кортеж `(s, r, o)`, атомарная единица графа знаний. |
| Open IE | Извлекай что угодно | Отношения-фразы с открытым словарём; высокая полнота, низкая точность. |
| Закрытая онтология | Фиксированная схема | Ограниченное множество типов отношений (Wikidata, UMLS, FIBO). |
| Каноникализация | Нормализуй всё | Отображение поверхностных форм имён и отношений на канонические идентификаторы. |
| AEVS | Извлечение с привязкой к источнику | Пайплайн «закрепление — извлечение — верификация — дополнение» (2026). |
| Происхождение данных | Связь с источником истины | Каждая тройка содержит идентификатор документа и символьный спан, указывающий на источник. |
| Дистантное обучение с учителем | Дешёвые метки | Сопоставление текста с существующим графом знаний для создания обучающих данных. |

## Дополнительное чтение

- [Mintz et al. (2009). Distant supervision for relation extraction without labeled data](https://www.aclweb.org/anthology/P09-1113.pdf) — статья о дистантном обучении с учителем.
- [Huguet Cabot, Navigli (2021). REBEL: Relation Extraction By End-to-end Language generation](https://aclanthology.org/2021.findings-emnlp.204.pdf) — рабочая лошадка seq2seq RE.
- [Wadden et al. (2019). Entity, Relation, and Event Extraction with Contextualized Span Representations (DyGIE++)](https://arxiv.org/abs/1909.03546) — совместное IE.
- [AEVS — фреймворк «Закрепление — извлечение — верификация — дополнение»](https://www.mdpi.com/2073-431X/15/3/178) — подход к снижению числа галлюцинаций, предложенный в 2026 году.
- [Руководство по SPARQL в Wikidata](https://www.wikidata.org/wiki/Wikidata:SPARQL_tutorial) — канонические запросы к графу.
