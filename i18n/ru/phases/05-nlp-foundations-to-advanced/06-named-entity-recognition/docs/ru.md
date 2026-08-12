# Распознавание именованных сущностей

> Извлеките имена. Звучит просто, пока не столкнётесь с неоднозначными границами, вложенными сущностями и предметным жаргоном.

**Тип:** Build
**Языки:** Python
**Предварительные требования:** Фаза 5 · 02 (BoW + TF-IDF), Фаза 5 · 03 (эмбеддинги слов)
**Время:** ~75 минут

## Проблема

«Apple sued Google over its iPhone search deal in the US.» Пять сущностей: Apple (ORG), Google (ORG), iPhone (PRODUCT), search deal (возможно), US (GPE). Хорошая система NER извлекает их все с правильными типами. Плохая — пропускает iPhone, путает Apple-фрукт с Apple-компанией и помечает «US» как PERSON.

NER — рабочая лошадка под капотом любого конвейера структурированного извлечения. Разбор резюме, сканирование логов на соответствие требованиям, анонимизация медицинских записей, понимание поисковых запросов, обоснование (grounding) ответов чат-ботов, извлечение данных из юридических контрактов. Вы почти никогда не видите его напрямую, но всегда от него зависите.

Этот урок проходит путь от классического подхода (на правилах, HMM, CRF) к современному (BiLSTM-CRF, затем трансформеры). Каждый шаг решает конкретное ограничение предыдущего. Сам этот паттерн и есть урок.

## Концепция

**BIO-разметка** (или BILOU) превращает извлечение сущностей в задачу разметки последовательности. Присвойте каждому токену метку `B-TYPE` (начало сущности), `I-TYPE` (внутри сущности) или `O` (вне какой-либо сущности).

```
Apple    B-ORG
sued     O
Google   B-ORG
over     O
its      O
iPhone   B-PRODUCT
search   O
deal     O
in       O
the      O
US       B-GPE
.        O
```

Многотокенные сущности образуют цепочку: `New B-GPE`, `York I-GPE`, `City I-GPE`. Модель, которая понимает BIO, может извлекать произвольные спаны.

Прогрессия архитектур:

- **На основе правил.** Регулярные выражения + поиск по газеттиру (gazetteer). Высокая точность на известных сущностях, нулевое покрытие новых.
- **HMM.** Скрытая марковская модель (Hidden Markov Model). Вероятность эмиссии токена при данной метке, вероятность перехода метка-метка. Декодирование по Витерби. Обучается на размеченных данных.
- **CRF.** Условное случайное поле (Conditional Random Field). Похоже на HMM, но дискриминативное, поэтому можно смешивать произвольные признаки (форма слова, регистр, соседние слова). В 2026 году всё ещё остаётся классической рабочей лошадкой продакшена для развёртываний с ограниченными ресурсами.
- **BiLSTM-CRF.** Нейросетевые признаки вместо ручных. LSTM читает предложение в обоих направлениях, слой CRF поверх обеспечивает согласованность последовательностей меток.
- **На основе трансформеров.** Дообучение BERT с головой токен-классификации. Лучшая точность. Больше всего вычислений.

```figure
ner-bio-tagging
```

## Создаём

### Шаг 1: вспомогательные функции для BIO-разметки

```python
def spans_to_bio(tokens, spans):
    labels = ["O"] * len(tokens)
    for start, end, label in spans:
        labels[start] = f"B-{label}"
        for i in range(start + 1, end):
            labels[i] = f"I-{label}"
    return labels


def bio_to_spans(tokens, labels):
    spans = []
    current = None
    for i, label in enumerate(labels):
        if label.startswith("B-"):
            if current:
                spans.append(current)
            current = (i, i + 1, label[2:])
        elif label.startswith("I-") and current and current[2] == label[2:]:
            current = (current[0], i + 1, current[2])
        else:
            if current:
                spans.append(current)
                current = None
    if current:
        spans.append(current)
    return spans
```

```python
>>> tokens = ["Apple", "sued", "Google", "over", "iPhone", "sales", "."]
>>> labels = ["B-ORG", "O", "B-ORG", "O", "B-PRODUCT", "O", "O"]
>>> bio_to_spans(tokens, labels)
[(0, 1, 'ORG'), (2, 3, 'ORG'), (4, 5, 'PRODUCT')]
```

### Шаг 2: признаки, сконструированные вручную

Для классического (не нейросетевого) NER всё решают признаки. Полезные из них:

```python
def token_features(token, prev_token, next_token):
    return {
        "lower": token.lower(),
        "is_upper": token.isupper(),
        "is_title": token.istitle(),
        "has_digit": any(c.isdigit() for c in token),
        "suffix_3": token[-3:].lower(),
        "shape": word_shape(token),
        "prev_lower": prev_token.lower() if prev_token else "<BOS>",
        "next_lower": next_token.lower() if next_token else "<EOS>",
    }


def word_shape(word):
    out = []
    for c in word:
        if c.isupper():
            out.append("X")
        elif c.islower():
            out.append("x")
        elif c.isdigit():
            out.append("d")
        else:
            out.append(c)
    return "".join(out)
```

`word_shape("iPhone")` возвращает `xXxxxx`. `word_shape("USA-2024")` возвращает `XXX-dddd`. Паттерны капитализации — сильный сигнал для имён собственных.

### Шаг 3: простой базовый вариант на правилах и словаре

```python
ORG_GAZETTEER = {"Apple", "Google", "Microsoft", "OpenAI", "Meta", "Amazon", "Netflix"}
GPE_GAZETTEER = {"US", "USA", "UK", "India", "Germany", "France"}
PRODUCT_GAZETTEER = {"iPhone", "Android", "Windows", "ChatGPT", "Claude"}


def rule_based_ner(tokens):
    labels = []
    for token in tokens:
        if token in ORG_GAZETTEER:
            labels.append("B-ORG")
        elif token in GPE_GAZETTEER:
            labels.append("B-GPE")
        elif token in PRODUCT_GAZETTEER:
            labels.append("B-PRODUCT")
        else:
            labels.append("O")
    return labels
```

Продакшен-газеттиры содержат миллионы записей, собранных из Wikipedia и DBpedia. Покрытие хорошее. Разрешение неоднозначности (`Apple` как компания против фрукта) — ужасное. Именно поэтому победили статистические модели.

### Шаг 4: шаг с CRF (набросок, не полная реализация)

Полный CRF с нуля в 50 строк не даёт понимания без основ теории вероятностей. Вместо этого используйте `sklearn-crfsuite`:

```python
import sklearn_crfsuite

def to_features(tokens):
    out = []
    for i, tok in enumerate(tokens):
        prev = tokens[i - 1] if i > 0 else ""
        nxt = tokens[i + 1] if i + 1 < len(tokens) else ""
        out.append({
            "word.lower()": tok.lower(),
            "word.isupper()": tok.isupper(),
            "word.istitle()": tok.istitle(),
            "word.isdigit()": tok.isdigit(),
            "word.suffix3": tok[-3:].lower(),
            "word.shape": word_shape(tok),
            "prev.word.lower()": prev.lower(),
            "next.word.lower()": nxt.lower(),
            "BOS": i == 0,
            "EOS": i == len(tokens) - 1,
        })
    return out


crf = sklearn_crfsuite.CRF(algorithm="lbfgs", c1=0.1, c2=0.1, max_iterations=100, all_possible_transitions=True)
X_train = [to_features(s) for s in sentences_tokenized]
crf.fit(X_train, bio_labels_train)
```

`c1` и `c2` — это L1- и L2-регуляризация. `all_possible_transitions=True` позволяет модели выучить, что недопустимые последовательности (например, `I-ORG` после `O`) маловероятны — именно так CRF обеспечивает согласованность BIO без того, чтобы вы прописывали это ограничение вручную.

### Шаг 5: что добавляет BiLSTM-CRF

Признаки становятся выученными. Входы: эмбеддинги токенов (GloVe или fastText). LSTM читает слева направо и справа налево. Конкатенированные скрытые состояния проходят через выходной слой CRF. CRF по-прежнему обеспечивает согласованность последовательности меток; LSTM заменяет ручные признаки на выученные.

```python
import torch
import torch.nn as nn


class BiLSTM_CRF_Head(nn.Module):
    def __init__(self, vocab_size, embed_dim, hidden_dim, n_labels):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, embed_dim)
        self.lstm = nn.LSTM(embed_dim, hidden_dim, bidirectional=True, batch_first=True)
        self.fc = nn.Linear(hidden_dim * 2, n_labels)

    def forward(self, token_ids):
        e = self.embed(token_ids)
        h, _ = self.lstm(e)
        emissions = self.fc(h)
        return emissions
```

Для слоя CRF используйте `torchcrf.CRF` (pip install pytorch-crf). Прирост по сравнению с ручным CRF измерим, но меньше, чем можно ожидать, если у вас нет десятков тысяч размеченных предложений.

## Применяем

spaCy поставляет NER продакшен-уровня из коробки.

```python
import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("Apple sued Google over its iPhone search deal in the US.")
for ent in doc.ents:
    print(f"{ent.text:20s} {ent.label_}")
```

```
Apple                ORG
Google               ORG
iPhone               ORG
US                   GPE
```

Обратите внимание, что `iPhone` помечен как `ORG`, а не `PRODUCT` — у маленькой модели spaCy слабое покрытие сущностей типа «продукт». Большая модель (`en_core_web_lg`) справляется лучше. Трансформерная модель (`en_core_web_trf`) — ещё лучше.

Hugging Face для NER на основе BERT:

```python
from transformers import pipeline

ner = pipeline("ner", model="dslim/bert-base-NER", aggregation_strategy="simple")
print(ner("Apple sued Google over its iPhone in the US."))
```

```
[{'entity_group': 'ORG', 'word': 'Apple', ...},
 {'entity_group': 'ORG', 'word': 'Google', ...},
 {'entity_group': 'MISC', 'word': 'iPhone', ...},
 {'entity_group': 'LOC', 'word': 'US', ...}]
```

`aggregation_strategy="simple"` объединяет смежные токены B-X, I-X в один спан. Без этого вы получаете метки на уровне токенов и должны объединять их сами.

### NER на основе LLM (вариант 2026 года)

NER на LLM в режиме без примеров (zero-shot) и с несколькими примерами (few-shot) сейчас конкурентоспособен с дообученными моделями во многих доменах и значительно лучше, когда размеченных данных мало.

- **Промптирование без примеров (zero-shot).** Дайте LLM список типов сущностей и пример схемы. Запросите вывод в JSON. Работает из коробки; точность умеренная на новых доменах.
- **Промптирование в стиле ZeroTuneBio.** Разложите задачу на извлечение кандидатов → объяснение смысла → суждение → повторную проверку. Многоэтапный промпт (а не одношаговый) существенно повышает точность на биомедицинском NER. Тот же паттерн работает для юридического, финансового и научного доменов.
- **Динамическое промптирование с RAG.** Для каждого вызова инференса извлекайте наиболее похожие размеченные примеры из небольшого аннотированного начального набора; стройте промпт с несколькими примерами (few-shot) на лету. В бенчмарках 2026 года это повышает F1 биомедицинского NER GPT-4 на 11-12% по сравнению со статическим промптированием.
- **Декомпозиция по типу сущности.** Для длинных документов один вызов, извлекающий все типы сущностей сразу, теряет полноту (recall) по мере роста длины. Запускайте отдельный проход извлечения на каждый тип сущности. Более высокая стоимость инференса, существенно более высокая точность. Это стандартный паттерн для клинических записей и юридических контрактов.

Продакшен-рекомендация по состоянию на 2026 год: начните с базового варианта LLM zero-shot, прежде чем собирать обучающие данные. Часто F1 оказывается достаточно хорошим, чтобы дообучение вообще не понадобилось.

### Где классический NER всё ещё побеждает

Даже при наличии LLM классический NER побеждает, когда:

- Бюджет задержки — меньше 50 мс.
- У вас есть тысячи размеченных примеров и нужен F1 98%+.
- В домене стабильная онтология, на которую хорошо переносится предобученный CRF или BiLSTM.
- Регуляторные ограничения требуют локальной (on-prem), негенеративной модели.

### Где всё ломается

- **Сдвиг домена.** NER, обученный на CoNLL, на юридических контрактах работает хуже, чем газеттир. Дообучайте на своём домене.
- **Вложенные сущности.** "Bank of America Tower" одновременно является ORG и FACILITY. Стандартный BIO не может представить перекрывающиеся спаны. Нужен вложенный NER (многопроходные модели или модели на основе спанов).
- **Длинные сущности.** "United States Federal Deposit Insurance Corporation." Модели на уровне токенов иногда разбивают это на части. Используйте `aggregation_strategy` или постобработку.
- **Разреженные типы.** Медицинские метки NER вроде DRUG_BRAND, ADVERSE_EVENT, DOSE. Модели общего назначения понятия не имеют о них. Scispacy и BioBERT — отправная точка здесь.

## Публикуем

Сохраните как `outputs/skill-ner-picker.md`:

```markdown
---
name: ner-picker
description: Pick the right NER approach for a given extraction task.
version: 1.0.0
phase: 5
lesson: 06
tags: [nlp, ner, extraction]
---

Given a task description (domain, label set, language, latency, data volume), output:

1. Approach. Rule-based + gazetteer, CRF, BiLSTM-CRF, or transformer fine-tune.
2. Starting model. Name it (spaCy model ID, Hugging Face checkpoint ID, or "custom, trained from scratch").
3. Labeling strategy. BIO, BILOU, or span-based. Justify in one sentence.
4. Evaluation. Use `seqeval`. Always report entity-level F1 (not token-level).

Refuse to recommend fine-tuning a transformer for under 500 labeled examples unless the user already has a pretrained domain model. Flag nested entities as needing span-based or multi-pass models. Require a gazetteer audit if the user mentions "production scale" and labels are unchanged from CoNLL-2003.
```

## Упражнения

1. **Лёгкое.** Реализуйте `bio_to_spans` (обратную функцию к `spans_to_bio`) и проверьте согласованность прямого-обратного преобразования на 10 предложениях.
2. **Среднее.** Обучите приведённый выше CRF из sklearn-crfsuite на наборе данных CoNLL-2003 English NER. Сообщите F1 по каждой сущности с помощью `seqeval`. Типичный результат: ~84 F1.
3. **Сложное.** Дообучите `distilbert-base-cased` на предметно-специфичном наборе данных NER (медицинском, юридическом или финансовом). Сравните с маленькой моделью spaCy. Задокументируйте проверки на утечку данных и опишите, что вас удивило.

## Ключевые термины

| Термин | Как говорят люди | Что это на самом деле означает |
|------|-----------------|-----------------------|
| NER | Извлечь имена | Разметить спаны токенов типами (PERSON, ORG, GPE, DATE, ...). |
| BIO | Схема разметки | `B-X` начинает, `I-X` продолжает, `O` — вне сущности. |
| BILOU | Улучшенный BIO | Добавляет `L-X` (последний), `U-X` (единичный) для более чётких границ. |
| CRF | Структурный классификатор | Моделирует переходы между метками, а не только эмиссии. Обеспечивает валидность последовательностей. |
| Вложенный NER | Перекрывающиеся сущности | Один спан — иная сущность, чем его подспан. BIO не может это выразить. |
| F1 на уровне сущности | Корректная метрика NER | Предсказанный спан должен точно совпадать с истинным. F1 на уровне токенов завышает точность. |

## Дополнительные материалы

- [Lample et al. (2016). Neural Architectures for Named Entity Recognition](https://arxiv.org/abs/1603.01360) — статья про BiLSTM-CRF. Каноническая.
- [Devlin et al. (2018). BERT: Pre-training of Deep Bidirectional Transformers](https://arxiv.org/abs/1810.04805) — вводит паттерн токен-классификации, ставший стандартным.
- [spaCy linguistic features — named entities](https://spacy.io/usage/linguistic-features#named-entities) — практический справочник по каждому атрибуту `Doc.ents` и `Span`.
- [seqeval](https://github.com/chakki-works/seqeval) — правильная библиотека метрик. Используйте её всегда.
