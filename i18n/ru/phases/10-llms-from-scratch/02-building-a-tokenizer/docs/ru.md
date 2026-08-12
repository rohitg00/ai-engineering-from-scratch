# Создание токенизатора с нуля

> Урок 01 дал вам игрушку. Этот урок даёт вам оружие.

**Тип:** Build
**Языки:** Python
**Предварительные требования:** фаза 10, урок 01 («Токенизаторы: BPE, WordPiece, SentencePiece»)
**Время:** ~90 минут

## Цели обучения

- Создать промышленный BPE-токенизатор, который обрабатывает Unicode, нормализацию пробелов и специальные токены
- Реализовать байтовый резервный механизм, чтобы токенизатор мог кодировать любой ввод (включая эмодзи, CJK и код) без неизвестных токенов
- Добавить regex-паттерны предварительной токенизации, разбивающие текст по границам слов перед применением слияний BPE
- Обучить пользовательский токенизатор на корпусе и оценить его коэффициент сжатия по сравнению с tiktoken на многоязычном тексте

## Проблема

Ваш BPE-токенизатор из урока 01 работает с английским текстом. Теперь бросьте в него японский. Или эмодзи. Или код на Python со смешанными табуляциями и пробелами.

Он ломается.

Не потому что BPE неверен — потому что реализация неполна. Промышленный токенизатор обрабатывает сырые байты в любой кодировке, нормализует Unicode перед разбиением, управляет специальными токенами, которые никогда не участвуют в слияниях, объединяет в цепочку предварительную токенизацию с разбиением на подслова — и всё это делает достаточно быстро, чтобы не стать узким местом в конвейере обучения, обрабатывающем 15 триллионов токенов.

У токенизатора GPT-2 50 257 токенов. У Llama 3 — 128 256. У GPT-4 — примерно 100 000. Это не игрушечные цифры. Таблицы слияний за этими словарями обучались на сотнях гигабайт текста, а окружающая инфраструктура — нормализация, предварительная токенизация, внедрение специальных токенов, форматирование чат-шаблонов — это то, что отличает токенизатор, справляющийся с фразой «привет, мир», от того, что справляется со всем интернетом.

Вы собираетесь построить эту инфраструктуру.

## Концепция

### Полный конвейер

Промышленный токенизатор — это не один алгоритм. Это конвейер из пяти этапов, каждый из которых решает свою задачу.

```mermaid
graph LR
    A[Raw Text] --> B[Normalize]
    B --> C[Pre-Tokenize]
    C --> D[BPE Merge]
    D --> E[Special Tokens]
    E --> F[Token IDs]

    style A fill:#1a1a2e,stroke:#e94560,color:#fff
    style B fill:#1a1a2e,stroke:#e94560,color:#fff
    style C fill:#1a1a2e,stroke:#e94560,color:#fff
    style D fill:#1a1a2e,stroke:#e94560,color:#fff
    style E fill:#1a1a2e,stroke:#e94560,color:#fff
    style F fill:#1a1a2e,stroke:#e94560,color:#fff
```

У каждого этапа своя задача:

| Этап | Что он делает | Почему это важно |
|-------|-------------|----------------|
| Нормализация | Нормализация Unicode по NFKC, при необходимости — перевод в нижний регистр и удаление диакритических знаков | Лигатура «fi» (U+FB01) превращается в «fi» (два символа). Без нормализации одно и то же слово получает разные токены. |
| Предварительная токенизация | Разбиение текста на фрагменты перед BPE | Не даёт BPE выполнять слияния через границы слов. Из «кот спит» ни в коем случае не должен получиться токен «т с». |
| Слияние BPE | Применение выученных правил слияния к байтовым последовательностям | Основной механизм сжатия. Превращает сырые байты в подсловные токены. |
| Специальные токены | Добавление [BOS], [EOS], [PAD] и маркеров чат-шаблона | У этих токенов фиксированные идентификаторы. Они никогда не участвуют в слияниях BPE. Они нужны модели для задания структуры. |
| Отображение в идентификаторы | Преобразование строк токенов в целочисленные идентификаторы | Модель видит целые числа, а не строки. |

### Байтовый BPE

Токенизатор из урока 01 работал с UTF-8-байтами. Это было правильное решение. Но мы пропустили кое-что важное: что происходит, когда эти байты не являются корректным UTF-8?

Байтовый BPE решает эту проблему, рассматривая каждое возможное значение байта (0-255) как допустимый токен. Ваш базовый словарь состоит ровно из 256 элементов. Любой файл — текстовый, бинарный, повреждённый — можно токенизировать без появления неизвестного токена.

GPT-2 добавила трюк: сопоставить каждый байт с печатаемым символом Unicode, чтобы словарь оставался читаемым для человека. Байт 0x20 (пробел) становится символом «G» в их отображении. Это чисто косметический приём. Алгоритму это безразлично.

Настоящая сила в другом: байтовый BPE обрабатывает любой язык на Земле. Китайские иероглифы занимают по 3 байта UTF-8 каждый. Японские символы могут занимать 3-4 байта. Арабский, деванагари, эмодзи — всё это просто байтовые последовательности. Алгоритм BPE находит паттерны в этих байтовых последовательностях точно так же, как находит паттерны в английских ASCII-байтах.

### Предварительная токенизация

Прежде чем BPE коснётся вашего текста, его нужно разбить на фрагменты. Это не даёт алгоритму слияния создавать токены, которые пересекают границы слов.

GPT-2 использует regex-паттерн для разбиения текста:

```
'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+
```

Этот паттерн разбивает текст на сокращения («don't» становится «don» + «'t»), слова с необязательным ведущим пробелом, числа, знаки препинания и пробельные символы. Ведущий пробел остаётся прикреплённым к слову — так что «the cat» становится [" the", " cat"], а не ["the", " ", "cat"].

Llama использует SentencePiece, который полностью пропускает regex. Он рассматривает сырой поток байтов как одну длинную последовательность и позволяет алгоритму BPE самому определять границы. Это проще, но даёт BPE больше свободы для создания токенов, пересекающих слова.

Этот выбор имеет значение. Regex GPT-2 не даёт токенизатору выучить, что «the» в конце одного слова и «the» в начале следующего должны сливаться. SentencePiece это допускает, что иногда даёт более эффективное сжатие, но менее интерпретируемые токены.

### Специальные токены

Каждый промышленный токенизатор резервирует идентификаторы токенов для структурных маркеров:

| Токен | Назначение | Где используется |
|-------|---------|---------|
| `[BOS]` / `<s>` | Начало последовательности | Llama 3, GPT |
| `[EOS]` / `</s>` | Конец последовательности | Все модели |
| `[PAD]` | Заполнение для выравнивания пакетов | BERT, T5 |
| `[UNK]` | Неизвестный токен (байтовый BPE устраняет его) | BERT, WordPiece |
| `<\|im_start\|>` | Начало границы сообщения в чате | ChatGPT, Qwen |
| `<\|im_end\|>` | Конец границы сообщения в чате | ChatGPT, Qwen |
| `<\|user\|>` | Маркер реплики пользователя | Llama 3 |
| `<\|assistant\|>` | Маркер реплики ассистента | Llama 3 |

Специальные токены никогда не разбиваются BPE. Они сопоставляются точно ещё до запуска алгоритма слияния, заменяются своим фиксированным идентификатором, а окружающий текст токенизируется обычным образом.

### Чат-шаблоны

Именно здесь большинство людей запутывается, и большинство реализаций ломается.

Когда вы отправляете сообщения чат-модели, API принимает список сообщений:

```
[
  {"role": "system", "content": "You are helpful."},
  {"role": "user", "content": "Hello"},
  {"role": "assistant", "content": "Hi there!"}
]
```

Модель не видит JSON. Она видит плоскую последовательность токенов. Чат-шаблон преобразует сообщения в эту плоскую последовательность с помощью специальных токенов. Каждая модель делает это по-своему:

```
Llama 3:
<|begin_of_text|><|start_header_id|>system<|end_header_id|>

You are helpful.<|eot_id|><|start_header_id|>user<|end_header_id|>

Hello<|eot_id|><|start_header_id|>assistant<|end_header_id|>

Hi there!<|eot_id|>

ChatGPT:
<|im_start|>system
You are helpful.<|im_end|>
<|im_start|>user
Hello<|im_end|>
<|im_start|>assistant
Hi there!<|im_end|>
```

Ошибитесь в шаблоне — и модель выдаст бессмыслицу. Она была обучена на одном точном формате. Любое отклонение — пропущенный перевод строки, переставленный токен, лишний пробел — выводит вход за пределы обучающего распределения.

### Скорость

Python слишком медленный для промышленной токенизации.

tiktoken (OpenAI) написан на Rust с привязками для Python. HuggingFace tokenizers тоже на Rust. SentencePiece написан на C++. Они достигают ускорения в 10-100 раз по сравнению с чистым Python.

Для масштаба: токенизация 15 триллионов токенов для предварительного обучения Llama 3 со скоростью 1 миллион токенов в секунду (быстрый Python) заняла бы 174 дня. При 100 миллионах токенов в секунду (Rust) это занимает 1,7 дня.

Вы строите на Python, чтобы понять алгоритм. В продакшене вы бы использовали скомпилированную реализацию и трогали только Python-обёртку.

```figure
weight-tying
```

## Реализация

### Шаг 1: Байтовое кодирование

Основа. Преобразуйте любую строку в последовательность байтов, сопоставьте каждый байт с печатаемым символом для отображения и выполните обратное преобразование.

```python
def bytes_to_tokens(text):
    return list(text.encode("utf-8"))

def tokens_to_text(token_bytes):
    return bytes(token_bytes).decode("utf-8", errors="replace")
```

Проверьте на многоязычном тексте, чтобы увидеть количество байтов:

```python
texts = [
    ("English", "hello"),
    ("Chinese", "你好"),
    ("Emoji", "🔥"),
    ("Mixed", "hello你好🔥"),
]

for label, text in texts:
    b = bytes_to_tokens(text)
    print(f"{label}: {len(text)} chars -> {len(b)} bytes -> {b}")
```

«hello» — это 5 байтов. «你好» — это 6 байтов (по 3 на символ). Эмодзи-огонь — это 4 байта. Байтовому токенизатору всё равно, какой это язык. Байты есть байты.

### Шаг 2: Предварительный токенизатор с regex

Разбейте текст на фрагменты с помощью regex-паттерна GPT-2. Каждый фрагмент токенизируется алгоритмом BPE независимо.

```python
import re

try:
    import regex
    GPT2_PATTERN = regex.compile(
        r"""'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+"""
    )
except ImportError:
    GPT2_PATTERN = re.compile(
        r"""'(?:[sdmt]|ll|ve|re)| ?[a-zA-Z]+| ?[0-9]+| ?[^\s\w]+|\s+(?!\S)|\s+"""
    )

def pre_tokenize(text):
    return [match.group() for match in GPT2_PATTERN.finditer(text)]
```

Модуль `regex` поддерживает escape-последовательности свойств Unicode (`\p{L}` для букв, `\p{N}` для чисел). Стандартный модуль `re` этого не умеет, поэтому мы откатываемся к классам ASCII-символов. Для промышленных многоязычных токенизаторов установите `regex`.

Попробуйте:

```python
print(pre_tokenize("Hello, world! Don't stop."))
# [' Hello', ',', ' world', '!', " Don", "'t", ' stop', '.']
```

Ведущий пробел остаётся прикреплённым к слову. Сокращения разбиваются по апострофу. Знаки препинания становятся отдельными фрагментами. BPE никогда не сольёт токены через эти границы.

### Шаг 3: BPE на байтовых последовательностях

Тот же основной алгоритм из урока 01, но теперь работающий с предварительно токенизированными фрагментами независимо.

```python
from collections import Counter

def get_byte_pairs(chunks):
    pairs = Counter()
    for chunk in chunks:
        byte_seq = list(chunk.encode("utf-8"))
        for i in range(len(byte_seq) - 1):
            pairs[(byte_seq[i], byte_seq[i + 1])] += 1
    return pairs

def apply_merge(byte_seq, pair, new_id):
    merged = []
    i = 0
    while i < len(byte_seq):
        if i < len(byte_seq) - 1 and byte_seq[i] == pair[0] and byte_seq[i + 1] == pair[1]:
            merged.append(new_id)
            i += 2
        else:
            merged.append(byte_seq[i])
            i += 1
    return merged
```

### Шаг 4: Обработка специальных токенов

Специальным токенам нужны точное сопоставление и фиксированные идентификаторы. Они полностью обходят BPE.

```python
class SpecialTokenHandler:
    def __init__(self):
        self.special_tokens = {}
        self.pattern = None

    def add_token(self, token_str, token_id):
        self.special_tokens[token_str] = token_id
        escaped = [re.escape(t) for t in sorted(self.special_tokens.keys(), key=len, reverse=True)]
        self.pattern = re.compile("|".join(escaped))

    def split_with_specials(self, text):
        if not self.pattern:
            return [(text, False)]
        parts = []
        last_end = 0
        for match in self.pattern.finditer(text):
            if match.start() > last_end:
                parts.append((text[last_end:match.start()], False))
            parts.append((match.group(), True))
            last_end = match.end()
        if last_end < len(text):
            parts.append((text[last_end:], False))
        return parts
```

### Шаг 5: Полный класс токенизатора

Соедините всё в цепочку: нормализация, разбиение по специальным токенам, предварительная токенизация, слияние BPE, отображение в идентификаторы.

```python
import unicodedata

class ProductionTokenizer:
    def __init__(self):
        self.merges = {}
        self.vocab = {i: bytes([i]) for i in range(256)}
        self.special_handler = SpecialTokenHandler()
        self.next_id = 256

    def normalize(self, text):
        return unicodedata.normalize("NFKC", text)

    def train(self, text, num_merges):
        text = self.normalize(text)
        chunks = pre_tokenize(text)
        chunk_bytes = [list(chunk.encode("utf-8")) for chunk in chunks]

        for i in range(num_merges):
            pairs = Counter()
            for seq in chunk_bytes:
                for j in range(len(seq) - 1):
                    pairs[(seq[j], seq[j + 1])] += 1
            if not pairs:
                break
            best = max(pairs, key=pairs.get)
            new_id = self.next_id
            self.next_id += 1
            self.merges[best] = new_id
            self.vocab[new_id] = self.vocab[best[0]] + self.vocab[best[1]]
            chunk_bytes = [apply_merge(seq, best, new_id) for seq in chunk_bytes]

    def add_special_token(self, token_str):
        token_id = self.next_id
        self.next_id += 1
        self.special_handler.add_token(token_str, token_id)
        self.vocab[token_id] = token_str.encode("utf-8")
        return token_id

    def encode(self, text):
        text = self.normalize(text)
        parts = self.special_handler.split_with_specials(text)
        all_ids = []
        for part_text, is_special in parts:
            if is_special:
                all_ids.append(self.special_handler.special_tokens[part_text])
            else:
                for chunk in pre_tokenize(part_text):
                    byte_seq = list(chunk.encode("utf-8"))
                    for pair, new_id in self.merges.items():
                        byte_seq = apply_merge(byte_seq, pair, new_id)
                    all_ids.extend(byte_seq)
        return all_ids

    def decode(self, ids):
        byte_parts = []
        for token_id in ids:
            if token_id in self.vocab:
                byte_parts.append(self.vocab[token_id])
        return b"".join(byte_parts).decode("utf-8", errors="replace")

    def vocab_size(self):
        return len(self.vocab)
```

### Шаг 6: Многоязычный тест

Настоящее испытание. Бросим в токенизатор английский, китайский, эмодзи и код.

```python
corpus = (
    "The quick brown fox jumps over the lazy dog. "
    "The quick brown fox runs through the forest. "
    "Machine learning models process natural language. "
    "Deep learning transforms how we build software. "
    "def train(model, data): return model.fit(data) "
    "def predict(model, x): return model(x) "
)

tok = ProductionTokenizer()
tok.train(corpus, num_merges=50)

bos = tok.add_special_token("<|begin|>")
eos = tok.add_special_token("<|end|>")

test_texts = [
    "The quick brown fox.",
    "你好世界",
    "Hello 🌍 World",
    "def foo(x): return x + 1",
    f"<|begin|>Hello<|end|>",
]

for text in test_texts:
    ids = tok.encode(text)
    decoded = tok.decode(ids)
    print(f"Input:   {text}")
    print(f"Tokens:  {len(ids)} ids")
    print(f"Decoded: {decoded}")
    print()
```

Китайские иероглифы дают по 3 байта каждый. Эмодзи даёт 4 байта. Ничто из этого не приводит токенизатор к сбою. Ничто не порождает неизвестных токенов. В этом сила байтового BPE.

## Применение

### Сравнение реальных токенизаторов

Загрузите настоящие токенизаторы Llama 3, GPT-4 и Mistral. Посмотрите, как каждый из них обрабатывает один и тот же многоязычный абзац.

```python
import tiktoken

gpt4_enc = tiktoken.get_encoding("cl100k_base")

test_paragraph = "Machine learning is powerful. 机器学习很强大。 L'apprentissage automatique est puissant. 🤖💪"

tokens = gpt4_enc.encode(test_paragraph)
pieces = [gpt4_enc.decode([t]) for t in tokens]
print(f"GPT-4 ({len(tokens)} tokens): {pieces}")
```

```python
from transformers import AutoTokenizer

llama_tok = AutoTokenizer.from_pretrained("meta-llama/Meta-Llama-3-8B")
mistral_tok = AutoTokenizer.from_pretrained("mistralai/Mistral-7B-v0.1")

for name, tok in [("Llama 3", llama_tok), ("Mistral", mistral_tok)]:
    tokens = tok.encode(test_paragraph)
    pieces = tok.convert_ids_to_tokens(tokens)
    print(f"{name} ({len(tokens)} tokens): {pieces[:20]}...")
```

Вы увидите разное число токенов для одного и того же текста. Llama 3 со словарём в 128К агрессивнее сливает частые паттерны. GPT-4 со 100К находится посередине. Mistral с 32К даёт больше токенов, но имеет меньший слой эмбеддингов.

Компромисс всегда один и тот же: больший словарь означает более короткие последовательности, но больше параметров.

## Итоговое задание

Этот урок производит промпт для создания и отладки промышленных токенизаторов. См. `outputs/prompt-tokenizer-builder.md`.

## Упражнения

1. **Лёгкое:** Добавьте метод `get_token_bytes(id)`, который показывает сырые байты для любого идентификатора токена. Используйте его, чтобы изучить, что на самом деле представляют ваши самые частые слитые токены.
2. **Среднее:** Реализуйте предварительный токенизатор в стиле Llama, который разбивает текст по пробелам и цифрам, но сохраняет ведущие пробелы. Сравните его словарь с подходом на основе regex GPT-2 на том же корпусе.
3. **Сложное:** Добавьте метод чат-шаблона, который принимает список сообщений `{"role": ..., "content": ...}` и производит корректную последовательность токенов для формата чата Llama 3. Проверьте её на соответствие реализации HuggingFace.

## Ключевые термины

| Термин | Как обычно говорят | Что это значит на самом деле |
|------|----------------|----------------------|
| Байтовый BPE | «Токенизатор, работающий с байтами» | BPE с базовым словарём из 256 значений байтов — обрабатывает любой ввод без неизвестных токенов |
| Предварительная токенизация | «Разбиение перед BPE» | Разбиение по регулярному выражению или правилам, которое не даёт BPE выполнять слияния через границы слов |
| Нормализация NFKC | «Очистка Unicode» | Каноническая декомпозиция с последующей композицией совместимости: лигатура «fi» превращается в «fi», а полноширинная «A» — в «A» |
| Чат-шаблон | «Как сообщения превращаются в токены» | Точный формат преобразования списка сообщений с ролью и содержимым в плоскую последовательность токенов — он зависит от модели и должен соответствовать формату обучения |
| Специальные токены | «Управляющие токены» | Зарезервированные идентификаторы токенов, которые обходят BPE, — [BOS], [EOS], [PAD] и маркеры чата; перед слиянием они сопоставляются точно |
| Фертильность | «Число токенов на слово» | Отношение числа выходных токенов к числу входных слов: 1,3 для английского языка в GPT-4 и 2-3 для корейского; чем оно выше, тем больше контекста расходуется впустую |
| tiktoken | «Токенизатор OpenAI» | Реализация BPE на Rust с привязками для Python — в 10-100 раз быстрее чистого Python |
| Таблица слияний | «Словарь» | Упорядоченный список слияний пар байтов, выученный во время обучения, — именно в нём заключены знания, усвоенные токенизатором |

## Дополнительные материалы

- [Исходный код OpenAI tiktoken](https://github.com/openai/tiktoken) — реализация BPE на Rust, используемая GPT-3.5/4
- [Библиотека Hugging Face tokenizers](https://github.com/huggingface/tokenizers) — библиотека токенизации на Rust, поддерживающая BPE, WordPiece, Unigram
- [Статья о Llama 3 (Meta, 2024)](https://arxiv.org/abs/2407.21783) — подробности о словаре в 128К и обучении токенизатора
- [SentencePiece (Kudo & Richardson, 2018)](https://arxiv.org/abs/1808.06226) — независимая от языка токенизация
- [Исходный код токенизатора GPT-2](https://github.com/openai/gpt-2/blob/master/src/encoder.py) — исходное отображение байтов в Unicode
