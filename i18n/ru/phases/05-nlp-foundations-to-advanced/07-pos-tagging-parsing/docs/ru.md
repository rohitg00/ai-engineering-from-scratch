# Частеречная разметка и синтаксический разбор

> Грамматика какое-то время была немодной. Затем каждому LLM-конвейеру потребовалась валидация структурированного извлечения, и она вернулась.

**Тип:** Build
**Языки:** Python
**Предварительные требования:** Фаза 5 · 01 (обработка текста), Фаза 2 · 14 (наивный байесовский классификатор)
**Время:** ~45 минут

## Проблема

Урок 01 обещал, что лемматизации нужна частеречная метка. Не зная, что `running` — глагол, лемматизатор не может свести его к `run`. Не зная, что `better` — прилагательное, он не может свести его к `good`.

Это обещание скрывало целую подобласть. Частеречная разметка (part-of-speech tagging) присваивает грамматические категории. Синтаксический разбор восстанавливает древовидную структуру предложения: какое слово модифицирует какое, какой глагол управляет какими аргументами. Классический NLP потратил двадцать лет на совершенствование обоих направлений. Затем глубокое обучение свернуло их в задачу токен-классификации поверх предобученного трансформера, и исследовательское сообщество двинулось дальше.

Но не прикладное сообщество. Каждый конвейер структурированного извлечения по-прежнему использует под капотом частеречные и синтаксические деревья зависимостей. JSON, сгенерированный LLM, валидируется против грамматических ограничений. Системы вопрос-ответ раскладывают запросы с помощью деревьев зависимостей. Оценщики качества машинного перевода проверяют выравнивание деревьев разбора.

Это стоит знать. Урок знакомит с наборами тегов, базовыми методами и точкой, где вы перестаёте реализовывать всё с нуля и вызываете spaCy.

## Концепция

**Частеречная разметка (POS tagging)** присваивает каждому токену грамматическую категорию. Набор тегов **Penn Treebank (PTB)** — стандарт по умолчанию для английского языка. 36 тегов с различиями, которые обычному читателю покажутся излишне мелочными: `NN` — существительное в единственном числе, `NNS` — существительное во множественном числе, `NNP` — имя собственное в единственном числе, `VBD` — глагол в прошедшем времени, `VBZ` — глагол в 3-м лице единственного числа настоящего времени и так далее. Набор тегов **Universal Dependencies (UD)** более грубый (17 тегов) и не зависит от языка; он стал стандартом по умолчанию для кросс-языковой работы.

```
The/DET cats/NOUN were/AUX running/VERB at/ADP 3pm/NOUN ./PUNCT
```

**Синтаксический разбор** производит дерево. Два основных стиля:

- **Составляющий разбор (constituency parsing).** Именные группы, глагольные группы, предложные группы вкладываются друг в друга. Результат — дерево из нетерминальных категорий (NP, VP, PP) с словами в качестве листьев.
- **Разбор зависимостей (dependency parsing).** У каждого слова есть единственное главное слово, от которого оно зависит, помеченное грамматическим отношением. Результат — дерево, где каждое ребро — это тройка (главное слово, зависимое слово, отношение).

Разбор зависимостей победил в 2010-х годах, потому что он чисто обобщается на разные языки, особенно на языки со свободным порядком слов.

```
running is ROOT
cats is nsubj of running
were is aux of running
at is prep of running
3pm is pobj of at
```

```figure
pos-tagger
```

```figure
dependency-arcs
```

## Создаём

### Шаг 1: базовый вариант по наиболее частому тегу

Самый примитивный работающий тегер частей речи. Для каждого слова предсказывается тег, который встречался у него чаще всего при обучении.

```python
from collections import Counter, defaultdict


def train_mft(train_examples):
    word_tag_counts = defaultdict(Counter)
    all_tags = Counter()
    for tokens, tags in train_examples:
        for token, tag in zip(tokens, tags):
            word_tag_counts[token.lower()][tag] += 1
            all_tags[tag] += 1
    word_best = {w: c.most_common(1)[0][0] for w, c in word_tag_counts.items()}
    default_tag = all_tags.most_common(1)[0][0]
    return word_best, default_tag


def predict_mft(tokens, word_best, default_tag):
    return [word_best.get(t.lower(), default_tag) for t in tokens]
```

На корпусе Brown этот базовый вариант достигает точности ~85%. Не хорошо, но это тот пол, ниже которого ни одна серьёзная модель не должна опускаться.

### Шаг 2: биграммный HMM-тегер

Смоделируйте совместную вероятность последовательности:

```
P(tags, words) = prod P(tag_i | tag_{i-1}) * P(word_i | tag_i)
```

Две таблицы: вероятности переходов (тег при данном предыдущем теге), вероятности эмиссии (слово при данном теге). Оцените обе по счётчикам со сглаживанием Лапласа. Декодируйте с помощью алгоритма Витерби (динамическое программирование по решётке тегов).

```python
import math


def train_hmm(train_examples, alpha=0.01):
    transitions = defaultdict(Counter)
    emissions = defaultdict(Counter)
    tags = set()
    vocab = set()

    for tokens, ts in train_examples:
        prev = "<BOS>"
        for token, tag in zip(tokens, ts):
            transitions[prev][tag] += 1
            emissions[tag][token.lower()] += 1
            tags.add(tag)
            vocab.add(token.lower())
            prev = tag
        transitions[prev]["<EOS>"] += 1

    return transitions, emissions, tags, vocab


def log_prob(table, given, key, smooth_denom, alpha):
    return math.log((table[given].get(key, 0) + alpha) / smooth_denom)


def viterbi(tokens, transitions, emissions, tags, vocab, alpha=0.01):
    tags_list = list(tags)
    n = len(tokens)
    V = [[0.0] * len(tags_list) for _ in range(n)]
    back = [[0] * len(tags_list) for _ in range(n)]

    for j, tag in enumerate(tags_list):
        em_denom = sum(emissions[tag].values()) + alpha * (len(vocab) + 1)
        tr_denom = sum(transitions["<BOS>"].values()) + alpha * (len(tags_list) + 1)
        tr = log_prob(transitions, "<BOS>", tag, tr_denom, alpha)
        em = log_prob(emissions, tag, tokens[0].lower(), em_denom, alpha)
        V[0][j] = tr + em
        back[0][j] = 0

    for i in range(1, n):
        for j, tag in enumerate(tags_list):
            em_denom = sum(emissions[tag].values()) + alpha * (len(vocab) + 1)
            em = log_prob(emissions, tag, tokens[i].lower(), em_denom, alpha)
            best_prev = 0
            best_score = -1e30
            for k, prev_tag in enumerate(tags_list):
                tr_denom = sum(transitions[prev_tag].values()) + alpha * (len(tags_list) + 1)
                tr = log_prob(transitions, prev_tag, tag, tr_denom, alpha)
                score = V[i - 1][k] + tr + em
                if score > best_score:
                    best_score = score
                    best_prev = k
            V[i][j] = best_score
            back[i][j] = best_prev

    last_best = max(range(len(tags_list)), key=lambda j: V[n - 1][j])
    path = [last_best]
    for i in range(n - 1, 0, -1):
        path.append(back[i][path[-1]])
    return [tags_list[j] for j in reversed(path)]
```

Биграммный HMM на Brown достигает точности ~93%. Скачок с 85% до 93% происходит в основном за счёт вероятностей переходов — модель выучивает, что `DET NOUN` — обычное сочетание, а `NOUN DET` — редкое.

### Шаг 3: почему современные тегеры превосходят это

Вероятности переходов и эмиссии локальны. Они не могут уловить, что `saw` — существительное в «I bought a saw», но глагол в «I saw the movie». CRF с произвольными признаками (суффикс, форма слова, слово до и после, само слово) достигает ~97%. BiLSTM-CRF или трансформер достигают ~98%+.

Потолок этой задачи задаётся расхождением между аннотаторами. Люди-аннотаторы согласны друг с другом примерно в 97% случаев на Penn Treebank. Модели, превышающие 98%, вероятно, переобучаются под тестовый набор.

### Шаг 4: набросок разбора зависимостей

Полный разбор зависимостей с нуля выходит за рамки этого урока; каноническое изложение в учебнике — у Джурафски и Мартина. Стоит знать два классических семейства:

- **Переходные (transition-based)** парсеры (arc-eager, arc-standard) работают как shift-reduce-парсер: они читают токены, помещают их в стек и применяют действия свёртки, создающие дуги. Жадное декодирование быстрое. Классическая реализация — MaltParser. Современная нейросетевая версия — переходный парсер Чена и Мэннинга.
- **Графовые (graph-based)** парсеры (алгоритм Айснера, биаффинный парсер Дозат-Мэннинга) оценивают каждое возможное ребро главное-зависимое слово и выбирают максимальное остовное дерево. Медленнее, но точнее.

Для большей части прикладной работы вызовите spaCy:

```python
import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("The cats were running at 3pm.")
for token in doc:
    print(f"{token.text:10s} tag={token.tag_:5s} pos={token.pos_:6s} dep={token.dep_:10s} head={token.head.text}")
```

```
The        tag=DT    pos=DET    dep=det        head=cats
cats       tag=NNS   pos=NOUN   dep=nsubj      head=running
were       tag=VBD   pos=AUX    dep=aux        head=running
running    tag=VBG   pos=VERB   dep=ROOT       head=running
at         tag=IN    pos=ADP    dep=prep       head=running
3pm        tag=NN    pos=NOUN   dep=pobj       head=at
.          tag=.     pos=PUNCT  dep=punct      head=running
```

Прочитайте столбец `dep` снизу вверх — и грамматическая структура предложения проявится сама собой.

## Применяем

Каждая продакшен-библиотека NLP поставляет теггеры POS и парсеры зависимостей как часть стандартного конвейера.

- **spaCy** (`en_core_web_sm` / `md` / `lg` / `trf`). Быстро, точно, интегрировано с токенизацией + NER + лемматизацией. `token.tag_` (Penn), `token.pos_` (UD), `token.dep_` (отношение зависимости).
- **Stanford NLP (stanza)**. Преемник Stanford CoreNLP. Современный уровень качества на 60+ языках.
- **trankit**. На основе трансформеров, хорошая точность UD.
- **NLTK**. `pos_tag`. Пригоден к использованию, медленный, старый. Годится для обучения.

### Где это всё ещё важно в 2026 году

- **Лемматизация.** Уроку 01 нужна частеречная разметка для корректной лемматизации. Всегда.
- **Структурированное извлечение из выводов LLM.** Проверка, что сгенерированное предложение соблюдает грамматические ограничения (например, согласование подлежащего и сказуемого, обязательные модификаторы).
- **Аспектно-ориентированный анализ тональности.** Деревья зависимостей показывают, какое прилагательное модифицирует какое существительное.
- **Понимание запросов.** «фильмы режиссёра Уэса Андерсона с Биллом Мюрреем в главной роли» раскладывается в структурированные ограничения через дерево разбора.
- **Кросс-языковой перенос.** Теги UD и отношения зависимостей не зависят от языка, что позволяет структурный анализ новых языков без примеров (zero-shot).
- **Конвейеры с низким объёмом вычислений.** Если вы не можете развернуть трансформер, частеречная разметка + разбор зависимостей + газеттир дают удивительно неплохой результат.

## Публикуем

Сохраните как `outputs/skill-grammar-pipeline.md`:

```markdown
---
name: grammar-pipeline
description: Design a classical POS + dependency pipeline for a downstream NLP task.
version: 1.0.0
phase: 5
lesson: 07
tags: [nlp, pos, parsing]
---

Given a downstream task (information extraction, rewrite validation, query decomposition, lemmatization), you output:

1. Tagset to use. Penn Treebank for English-only legacy pipelines, Universal Dependencies for multilingual or cross-lingual.
2. Library. spaCy for most production, stanza for academic-grade multilingual, trankit for highest UD accuracy. Name the specific model ID.
3. Integration pattern. Show the 3-5 lines that call the library and consume the needed attributes (`.pos_`, `.dep_`, `.head`).
4. Failure mode to test. Noun-verb ambiguity (`saw`, `book`, `can`) and PP-attachment ambiguity are the classical traps. Sample 20 outputs and eyeball.

Refuse to recommend rolling your own parser. Building parsers from scratch is a research project, not an application task. Flag any pipeline that consumes POS tags without handling lowercase/uppercase variants as fragile.
```

## Упражнения

1. **Лёгкое.** Используя базовый вариант по наиболее частому тегу на небольшом размеченном корпусе (например, подмножество Brown из NLTK), измерьте точность на отложенных предложениях. Проверьте результат ~85%.
2. **Среднее.** Обучите приведённый выше биграммный HMM и сообщите точность/полноту по каждому тегу. Какие теги HMM путает чаще всего?
3. **Сложное.** Используйте разбор зависимостей spaCy для извлечения троек подлежащее-сказуемое-дополнение из выборки в 1000 предложений. Оцените на 50 вручную размеченных тройках. Задокументируйте, где извлечение даёт сбой (часто это пассивные конструкции, сочинительные связи и опущенные подлежащие).

## Ключевые термины

| Термин | Как говорят люди | Что это на самом деле означает |
|------|-----------------|-----------------------|
| Частеречный тег | Тип слова | Грамматическая категория. В PTB — 36, в UD — 17. |
| Penn Treebank | Стандартный набор тегов | Специфичен для английского. Детальные глагольные времена и число существительных. |
| Universal Dependencies | Многоязычный набор тегов | Грубее, чем PTB; нейтрален к языку; стандарт по умолчанию для кросс-языковой работы. |
| Разбор зависимостей | Дерево предложения | У каждого слова одно главное слово, у каждого ребра — грамматическое отношение. |
| Витерби | Динамическое программирование | Находит наиболее вероятную последовательность тегов при данных эмиссиях и переходах. |

## Дополнительные материалы

- [Jurafsky and Martin — Speech and Language Processing, chapters 8 and 18](https://web.stanford.edu/~jurafsky/slp3/) — каноническое изложение POS и разбора в учебнике.
- [Universal Dependencies project](https://universaldependencies.org/) — кросс-языковой набор тегов и коллекция деревьев разбора, используемая каждым многоязычным парсером.
- [spaCy linguistic features guide](https://spacy.io/usage/linguistic-features) — практический справочник по каждому атрибуту `Token`.
- [Chen and Manning (2014). A Fast and Accurate Dependency Parser using Neural Networks](https://nlp.stanford.edu/pubs/emnlp2014-depparser.pdf) — статья, которая вывела нейросетевые парсеры в мейнстрим.
