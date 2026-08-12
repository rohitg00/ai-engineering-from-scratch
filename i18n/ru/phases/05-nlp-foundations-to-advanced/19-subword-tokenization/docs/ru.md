# Субсловная токенизация — BPE, WordPiece, Unigram, SentencePiece

> Токенизаторы по словам захлёбываются на неизвестных словах. Посимвольные токенизаторы взрывают длину последовательности. Субсловные токенизаторы находят компромисс. Каждая современная LLM работает на одном из них.

**Тип:** Learn
**Языки:** Python
**Предварительные требования:** Фаза 5 · 01 (обработка текста), Фаза 5 · 04 (GloVe / FastText / субсловные представления)
**Время:** ~60 минут

## Проблема

В вашем словаре 50 000 слов. Пользователь вводит «untokenizable». Ваш токенизатор возвращает `[UNK]`. У модели теперь нет никакого сигнала об этом слове. Хуже того: у документа на 90-м перцентиле вашего корпуса 40 редких слов, а значит — 40 бит потерянной информации на документ.

Субсловная токенизация решает эту проблему. Частые слова остаются целыми токенами. Редкие слова разбиваются на осмысленные части: `untokenizable` → `un`, `token`, `izable`. Обучающие данные покрывают всё, потому что любая строка в конечном счёте — это последовательность байтов.

Каждая передовая LLM в 2026 году работает на одном из трёх алгоритмов (BPE, Unigram, WordPiece), обёрнутом в одну из трёх библиотек (tiktoken, SentencePiece, HF Tokenizers). Выпустить языковую модель, не выбрав алгоритм, невозможно.

## Концепция

![BPE против Unigram против WordPiece, посимвольное сравнение](../assets/subword-tokenization.svg)

**BPE (Byte-Pair Encoding, побайтовое парное кодирование).** Начните с посимвольного словаря. Посчитайте каждую соседнюю пару. Слейте самую частую пару в новый токен. Повторяйте, пока не достигнете целевого размера словаря. Доминирующий алгоритм: GPT-2/3/4, Llama, Gemma, Qwen2, Mistral.

**Byte-level BPE.** Тот же алгоритм, но поверх исходных байтов (256 базовых токенов) вместо символов Unicode. Гарантирует ноль токенов `[UNK]` — кодируется любая последовательность байтов. GPT-2 использует 50 257 токенов (256 байтов + 50 000 слияний + 1 специальный).

**Unigram.** Начните с огромного словаря. Присвойте каждому токену униграммную вероятность. Итеративно отсекайте токены, удаление которых меньше всего увеличивает лог-правдоподобие корпуса. Во время выполнения вывода (инференса) ведёт себя вероятностно: может сэмплировать варианты токенизации (полезно для аугментации данных через субсловную регуляризацию). Используется в T5, mBART, ALBERT, XLNet, Gemma.

**WordPiece.** Сливает пары, максимизирующие правдоподобие обучающего корпуса, а не сырую частоту. Используется в BERT, DistilBERT, ELECTRA.

**SentencePiece против tiktoken.** SentencePiece — это библиотека, которая *обучает* словари (BPE или Unigram) непосредственно на сыром тексте Unicode, кодируя пробел как `▁`. tiktoken — быстрый *энкодер* от OpenAI для уже построенных словарей; он не обучает.

Практическое правило:

- **Обучение нового словаря:** SentencePiece (многоязычный, без предварительной токенизации) или HF Tokenizers.
- **Быстрый инференс на словаре GPT:** tiktoken (cl100k_base, o200k_base).
- **И то, и другое:** HF Tokenizers — одна библиотека, обучение + обслуживание.

```figure
bpe-merge
```

## Создаём

### Шаг 1: BPE с нуля

См. `code/main.py`. Цикл:

```python
def train_bpe(corpus, num_merges):
    vocab = {tuple(word) + ("</w>",): count for word, count in corpus.items()}
    merges = []
    for _ in range(num_merges):
        pairs = Counter()
        for symbols, freq in vocab.items():
            for a, b in zip(symbols, symbols[1:]):
                pairs[(a, b)] += freq
        if not pairs:
            break
        best = pairs.most_common(1)[0][0]
        merges.append(best)
        vocab = apply_merge(vocab, best)
    return merges
```

Три факта, которые кодирует этот алгоритм. `</w>` отмечает конец слова, чтобы «low» (суффикс) и «lower» (префикс) оставались различными. Взвешивание по частоте позволяет высокочастотным парам побеждать раньше. Список слияний упорядочен — на инференсе слияния применяются в порядке обучения.

### Шаг 2: кодирование с помощью выученных слияний

```python
def encode_bpe(word, merges):
    symbols = list(word) + ["</w>"]
    for a, b in merges:
        i = 0
        while i < len(symbols) - 1:
            if symbols[i] == a and symbols[i + 1] == b:
                symbols = symbols[:i] + [a + b] + symbols[i + 2:]
            else:
                i += 1
    return symbols
```

Наивная реализация — O(n·|merges|). Продакшен-реализации (tiktoken, HF Tokenizers) используют поиск по рангу слияний с приоритетными очередями и работают почти за линейное время.

### Шаг 3: SentencePiece на практике

```python
import sentencepiece as spm

spm.SentencePieceTrainer.train(
    input="corpus.txt",
    model_prefix="my_tokenizer",
    vocab_size=8000,
    model_type="bpe",          # or "unigram"
    character_coverage=0.9995, # lower for CJK (e.g. 0.9995 for English, 0.995 for Japanese)
    normalization_rule_name="nmt_nfkc",
)

sp = spm.SentencePieceProcessor(model_file="my_tokenizer.model")
print(sp.encode("untokenizable", out_type=str))
# ['▁un', 'token', 'izable']
```

Обратите внимание: предварительная токенизация не требуется, пробел кодируется как `▁`, а `character_coverage` определяет, насколько агрессивно редкие символы сохраняются вместо отображения в `<unk>`.

### Шаг 4: tiktoken для словарей, совместимых с OpenAI

```python
import tiktoken
enc = tiktoken.get_encoding("o200k_base")
print(enc.encode("untokenizable"))        # [127340, 101028]
print(len(enc.encode("Hello, world!")))   # 4
```

Только кодирование. Быстро (бэкенд на Rust). Точное совпадение с токенизацией GPT-4/5 для подсчёта байтов, оценки стоимости, бюджетирования контекстного окна.

## Подводные камни, которые до сих пор доходят до продакшена в 2026 году

- **Дрейф токенизатора.** Обучение на словаре A, развёртывание со словарём B. Идентификаторы токенов расходятся; модель выдаёт бессмыслицу. Проверяйте хеш `tokenizer.json` в CI.
- **Неоднозначность пробелов.** BPE даёт разные токены для «hello» и « hello». Всегда явно указывайте `add_special_tokens` и `add_prefix_space`.
- **Недообучение на многоязычности.** Корпуса с преобладанием английского языка порождают словари, которые разбивают нелатинские письменности на в 5-10 раз больше токенов. Тот же промпт стоит в 5-10 раз дороже на японском/арабском в GPT-3.5. o200k_base частично исправил эту проблему.
- **Разбиение эмодзи.** Один эмодзи может занимать 5 токенов. Проверяйте обработку эмодзи при бюджетировании контекста.

## Применяем

Стек 2026 года:

| Ситуация | Выбор |
|-----------|------|
| Обучение одноязычной модели с нуля | HF Tokenizers (BPE) |
| Обучение многоязычной модели | SentencePiece (Unigram, `character_coverage=0.9995`) |
| Обслуживание API, совместимого с OpenAI | tiktoken (`o200k_base` для GPT-4+) |
| Словарь под конкретную область (код, математика, белки) | Обучить собственный BPE на корпусе домена, объединить с базовым словарём |
| Edge-инференс, малая модель | Unigram (меньшие словари работают лучше) |

Размер словаря — это решение о масштабировании, а не константа. Грубая эвристика: 32k для <1B параметров, 50-100k для 1-10B, 200k+ для многоязычных/передовых моделей.

## Публикуем

Сохраните как `outputs/skill-bpe-vs-wordpiece.md`:

```markdown
---
name: tokenizer-picker
description: Pick tokenizer algorithm, vocab size, library for a given corpus and deployment target.
version: 1.0.0
phase: 5
lesson: 19
tags: [nlp, tokenization]
---

Given a corpus (size, languages, domain) and deployment target (training from scratch / fine-tuning / API-compatible inference), output:

1. Algorithm. BPE, Unigram, or WordPiece. One-sentence reason.
2. Library. SentencePiece, HF Tokenizers, or tiktoken. Reason.
3. Vocab size. Rounded to nearest 1k. Reason tied to model size and language coverage.
4. Coverage settings. `character_coverage`, `byte_fallback`, special-token list.
5. Validation plan. Average tokens-per-word on held-out set, OOV rate, compression ratio, round-trip decode equality.

Refuse to train a character-coverage <0.995 tokenizer on corpora with rare-script content. Refuse to ship a vocab without a frozen `tokenizer.json` hash check in CI. Flag any monolingual tokenizer under 16k vocab as likely under-spec.
```

## Упражнения

1. **Лёгкое.** Обучите BPE с 500 слияниями на крошечном корпусе из `code/main.py`. Закодируйте три отложенных слова. Сколько дали ровно 1 токен, а сколько — больше 1?
2. **Среднее.** Сравните количество токенов на 100 предложениях из английской Википедии между `cl100k_base`, `o200k_base` и SentencePiece BPE, который вы обучите со словарём vocab=32k. Сообщите коэффициент сжатия для каждого варианта.
3. **Сложное.** Обучите один и тот же корпус с BPE, Unigram и WordPiece. Измерьте итоговую точность каждого варианта на небольшом классификаторе тональности. Сдвигает ли выбор алгоритма результат больше чем на 1 пункт F1?

## Ключевые термины

| Термин | Как говорят люди | Что это на самом деле означает |
|------|-----------------|-----------------------|
| BPE | Byte-Pair Encoding | Жадное слияние самых частых пар символов до достижения целевого размера словаря. |
| Byte-level BPE | Никаких неизвестных токенов, никогда | BPE над сырыми 256 байтами; используется в GPT-2 / Llama. |
| Unigram | Вероятностный токенизатор | Отсекает токены из большого набора кандидатов по лог-правдоподобию; используется в T5, Gemma. |
| SentencePiece | «Тот, что с пробелом» | Библиотека, которая обучает BPE/Unigram на сыром тексте; пробел кодируется как `▁`. |
| tiktoken | «Быстрый» | BPE-энкодер от OpenAI на Rust для готовых словарей. Не обучает. |
| Список слияний | «Магические числа» | Упорядоченный список слияний `(a, b) → ab`; на инференсе применяется по порядку. |
| Покрытие символов | Насколько редкий — это слишком редкий? | Доля символов обучающего корпуса, которую должен покрывать токенизатор; типично ~0.9995. |

## Дополнительные материалы

- [Sennrich, Haddow, Birch (2015). Neural Machine Translation of Rare Words with Subword Units](https://arxiv.org/abs/1508.07909) — статья о BPE.
- [Kudo (2018). Subword Regularization with Unigram Language Model](https://arxiv.org/abs/1804.10959) — статья об Unigram.
- [Kudo, Richardson (2018). SentencePiece: A simple and language independent subword tokenizer](https://arxiv.org/abs/1808.06226) — статья о библиотеке.
- [Hugging Face — Summary of the tokenizers](https://huggingface.co/docs/transformers/tokenizer_summary) — краткий справочник.
- [OpenAI tiktoken repo](https://github.com/openai/tiktoken) — сборник рецептов + список кодировок.
