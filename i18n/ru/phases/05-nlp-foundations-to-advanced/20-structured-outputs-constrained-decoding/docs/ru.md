# Структурированный вывод и ограниченное декодирование

> Попросите LLM вернуть JSON. В большинстве случаев вы получите JSON. В продакшене «в большинстве случаев» — это и есть проблема. Ограниченное декодирование превращает «в большинстве случаев» в «всегда», редактируя логиты перед сэмплированием.

**Тип:** Build**Языки:** Python**Предварительные требования:** Фаза 5 · 17 (Chatbots), Фаза 5 · 19 (Subword Tokenization)**Время:** ~60 минут
## Проблема

Классификатор запрашивает у LLM: «Верни одно из {positive, negative, neutral}». Модель возвращает: «The sentiment is positive — this review is overwhelmingly favorable because the customer explicitly states that they ...». Ваш парсер падает. F1 классификатора равен 0.0.

Свободная генерация — это не контракт. Это лишь предложение. Продакшен-система нуждается в контракте.

В 2026 году существует три слоя.

1. **Промптинг.** Вежливо попросить. «Верни только JSON-объект». Работает в ~80% случаев на топовых моделях, хуже — на маленьких.
2. **Нативные API структурированного вывода.** OpenAI `response_format`, использование инструментов у Anthropic, JSON mode у Gemini. Надёжны для поддерживаемых схем. Привязывают к вендору.
3. **Ограниченное декодирование.** Модификация логитов на каждом шаге генерации, чтобы модель *не могла* выдать недопустимые токены. 100% валидности по построению. Работает с любой локальной моделью.

Этот урок формирует интуицию для всех трёх подходов и называет, когда какой применять.

## Концепция

![Ограниченное декодирование маскирует недопустимые токены на каждом шаге](../assets/constrained-decoding.svg)

**Как работает ограниченное декодирование.** На каждом шаге генерации LLM выдаёт вектор логитов по всему словарю (~100 тыс. токенов). *Процессор логитов (logit processor)* находится между моделью и сэмплером. Он вычисляет, какие токены допустимы при текущей позиции в целевой грамматике — JSON Schema, регулярное выражение, контекстно-свободная грамматика — и устанавливает логиты всех недопустимых токенов в минус бесконечность. Softmax по оставшимся логитам распределяет вероятностную массу только на допустимые продолжения.

Реализации в 2026 году:

- **Outlines.** Компилирует JSON Schema или регулярное выражение в конечный автомат (FSM). Для каждого токена — поиск допустимого следующего токена за O(1). Основан на FSM, поэтому рекурсивные схемы требуют «уплощения».
- **XGrammar / llguidance.** Движки на основе контекстно-свободных грамматик. Обрабатывают рекурсивные JSON Schema. Почти нулевые накладные расходы на декодирование. OpenAI указала llguidance в своей реализации структурированного вывода 2025 года.
- **vLLM guided decoding.** Встроенные `guided_json`, `guided_regex`, `guided_choice`, `guided_grammar` через бэкенды Outlines, XGrammar или lm-format-enforcer.
- **Instructor.** Обёртка на основе Pydantic поверх любой LLM. Повторяет попытки при ошибке валидации. Кросс-провайдерная, но не изменяет логиты — полагается на повторы + промпты, учитывающие структурированный вывод.

### Контринтуитивный результат

Ограниченное декодирование часто оказывается *быстрее* неограниченной генерации. Две причины. Во-первых, оно сужает пространство поиска следующего токена. Во-вторых, продуманные реализации вообще пропускают генерацию токенов для принудительных токенов (каркас вроде `{"name": "` — каждый байт уже определён).

### Ловушка, которая обходится дорого

Порядок полей имеет значение. Поставьте `answer` перед `reasoning` — и модель зафиксирует ответ до того, как начнёт рассуждать. JSON валиден. Ответ неверен. Никакая валидация этого не поймает.

```json
// BAD
{"answer": "yes", "reasoning": "because ..."}

// GOOD
{"reasoning": "... therefore ...", "answer": "yes"}
```

Порядок полей схемы — это логика, а не форматирование.

```figure
constrained-decoder
```

## Постройте это

### Шаг 1: декодирование с ограничением по регулярному выражению с нуля

См. `code/main.py` — самостоятельную реализацию FSM. Ключевая идея в 30 строках:

```python
def mask_logits(logits, valid_token_ids):
    mask = [float("-inf")] * len(logits)
    for tid in valid_token_ids:
        mask[tid] = logits[tid]
    return mask


def generate_constrained(model, tokenizer, prompt, fsm):
    ids = tokenizer.encode(prompt)
    state = fsm.initial_state
    while not fsm.is_accept(state):
        logits = model.next_token_logits(ids)
        valid = fsm.valid_tokens(state, tokenizer)
        logits = mask_logits(logits, valid)
        tok = sample(logits)
        ids.append(tok)
        state = fsm.transition(state, tok)
    return tokenizer.decode(ids)
```

FSM отслеживает, какие части грамматики уже удовлетворены. `valid_tokens(state, tokenizer)` вычисляет, какие токены словаря могут продвинуть FSM, не покидая допустимый путь.

### Шаг 2: Outlines для JSON Schema

```python
from pydantic import BaseModel
from typing import Literal
import outlines


class Review(BaseModel):
    sentiment: Literal["positive", "negative", "neutral"]
    confidence: float
    evidence_span: str


model = outlines.models.transformers("meta-llama/Llama-3.2-3B-Instruct")
generator = outlines.generate.json(model, Review)

result = generator("Classify: 'The wait staff was attentive and the food arrived hot.'")
print(result)
# Review(sentiment='positive', confidence=0.93, evidence_span='attentive ... hot')
```

Ноль ошибок валидации. Никогда. FSM делает недопустимый вывод недостижимым.

### Шаг 3: Instructor для провайдер-независимого Pydantic

```python
import instructor
from anthropic import Anthropic
from pydantic import BaseModel, Field


class Invoice(BaseModel):
    vendor: str
    total_usd: float = Field(ge=0)
    line_items: list[str]


client = instructor.from_anthropic(Anthropic())
invoice = client.messages.create(
    model="claude-opus-4-7",
    max_tokens=1024,
    response_model=Invoice,
    messages=[{"role": "user", "content": "Extract from: 'Acme Corp $420. Widget, Gizmo.'"}],
)
```

Иной механизм. Instructor не трогает логиты. Он вставляет схему в промпт, парсит вывод и повторяет попытку при ошибке валидации (по умолчанию 3 раза). Работает с любым провайдером. Повторы увеличивают задержку и стоимость. Кросс-провайдерная переносимость — вот в чём его преимущество.

### Шаг 4: нативные API вендоров

```python
from openai import OpenAI

client = OpenAI()
response = client.responses.create(
    model="gpt-5",
    input=[{"role": "user", "content": "Classify: 'The food was cold.'"}],
    text={"format": {"type": "json_schema", "name": "sentiment",
          "schema": {"type": "object", "required": ["sentiment"],
                     "properties": {"sentiment": {"type": "string",
                                                  "enum": ["positive", "negative", "neutral"]}}}}},
)
print(response.output_parsed)
```

Ограниченное декодирование на стороне сервера. Надёжность на уровне Outlines для поддерживаемых схем. Не нужно управлять локальной моделью. Привязывает к вендору.

## Ловушки

- **Рекурсивные схемы.** Outlines «уплощает» рекурсию до фиксированной глубины. Древовидные выводы (вложенные комментарии, AST) требуют XGrammar или llguidance (на основе CFG).
- **Огромные перечисления (enum).** Перечисление на 10 000 вариантов компилируется медленно или зависает по таймауту. Переключитесь на ретривер: сначала предскажите top-k кандидатов, затем ограничьтесь ими.
- **Слишком строгая грамматика.** Заставьте `date: "YYYY-MM-DD"` регулярным выражением — и модель не сможет вывести `"unknown"` для отсутствующей даты. Модель компенсирует это, выдумывая дату. Разрешите `null` или сигнальное значение.
- **Преждевременная фиксация.** См. ловушку с порядком полей выше. Всегда ставьте рассуждение первым.
- **Vendor JSON mode без схемы.** Чистый JSON mode гарантирует только валидный JSON, но не валидность *для вашего сценария использования*. Всегда предоставляйте полную схему.

## Применение

Стек 2026 года:

| Ситуация | Выбор |
|-----------|------|
| Модель OpenAI/Anthropic/Google, простая схема | Нативный структурированный вывод вендора |
| Любой провайдер, рабочий процесс на Pydantic, допустимы повторы | Instructor |
| Локальная модель, нужна 100% валидность, плоская схема | Outlines (FSM) |
| Локальная модель, рекурсивная схема | XGrammar или llguidance |
| Собственный сервер инференса | vLLM guided decoding |
| Пакетная обработка, повторы допустимы | Instructor + самая дешёвая модель |

## Отправьте это в продакшен

Сохраните как `outputs/skill-structured-output-picker.md`:

```markdown
---
name: structured-output-picker
description: Choose a structured output approach, schema design, and validation plan.
version: 1.0.0
phase: 5
lesson: 20
tags: [nlp, llm, structured-output]
---

Given a use case (provider, latency budget, schema complexity, failure tolerance), output:

1. Mechanism. Native vendor structured output, Instructor retries, Outlines FSM, or XGrammar CFG. One-sentence reason.
2. Schema design. Field order (reasoning first, answer last), nullable fields for "unknown", enum vs regex, required fields.
3. Failure strategy. Max retries, fallback model, graceful `null` handling, out-of-distribution refusal.
4. Validation plan. Schema compliance rate (target 100%), semantic validity (LLM-judge), field-coverage rate, latency p50/p99.

Refuse any design that puts `answer` or `decision` before reasoning fields. Refuse to use bare JSON mode without a schema. Flag recursive schemas behind an FSM-only library.
```

## Упражнения

1. **Лёгкое.** Промптните небольшую модель с открытыми весами (например, Llama-3.2-3B) без ограниченного декодирования для `Review(sentiment, confidence, evidence_span)`. Измерьте долю ответов, которые парсятся как валидный JSON, на 100 отзывах.
2. **Среднее.** Тот же корпус с Outlines JSON mode. Сравните долю соответствия схеме, задержку и семантическую точность.
3. **Сложное.** Реализуйте с нуля декодер с ограничением по регулярному выражению для телефонных номеров (`\d{3}-\d{3}-\d{4}`). Убедитесь в 0 недопустимых выводов на 1000 примерах.

## Ключевые термины

| Термин | Что говорят люди | Что это на самом деле означает |
|------|-----------------|-----------------------|
| Constrained decoding | Заставить выдать валидный вывод | Маскирование логитов недопустимых токенов на каждом шаге генерации. |
| Logit processor | Штука, которая ограничивает | Функция: `(logits, state) -> masked_logits`. |
| FSM | Конечный автомат | Скомпилированное представление грамматики; поиск допустимого следующего токена за O(1). |
| CFG | Контекстно-свободная грамматика | Грамматика, обрабатывающая рекурсию; медленнее, но выразительнее FSM. |
| Schema field order | Имеет ли это значение? | Да — первое поле фиксирует решение; рассуждение всегда должно стоять перед ответом. |
| Guided decoding | Название этого у vLLM | То же самое понятие, встроенное в сервер инференса. |
| JSON mode | Ранняя версия у OpenAI | Гарантирует синтаксис JSON; НЕ гарантирует соответствие схеме. |

## Дополнительное чтение

- [Willard, Louf (2023). Efficient Guided Generation for LLMs](https://arxiv.org/abs/2307.09702) — статья про Outlines.
- [XGrammar paper (2024)](https://arxiv.org/abs/2411.15100) — быстрое ограниченное декодирование на основе CFG.
- [vLLM — Structured Outputs](https://docs.vllm.ai/en/latest/features/structured_outputs.html) — интеграция с сервером инференса.
- [OpenAI — Structured Outputs guide](https://platform.openai.com/docs/guides/structured-outputs) — справочник по API + подводные камни.
- [Instructor library](https://python.useinstructor.com/) — Pydantic + повторы для разных провайдеров.
- [JSONSchemaBench (2025)](https://arxiv.org/abs/2501.10868) — бенчмаркинг 6 фреймворков ограниченного декодирования.
