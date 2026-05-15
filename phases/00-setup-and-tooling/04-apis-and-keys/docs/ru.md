# Урок 04 — APIs & Keys

> Параллельный конспект на русском к `en.md`. Дополняется по ходу будущих обсуждений.

## Зачем этот урок

С фазы 11 (LLM, агенты) ты будешь звонить в LLM-API: Anthropic (Claude),
OpenAI, Google, потом и в провайдеров через прокси (например, OpenRouter).
В фазах 13–16 этих вызовов будет много, в циклах, с tool use, со стримингом.
Урок ставит базу: **как устроен любой HTTP API, как безопасно хранить ключи,
как сделать первый вызов и как читать ошибки**.

**Главная мысль:** все LLM API устроены одинаково — HTTP-запрос с JSON-телом
и ключом аутентификации в заголовке, в ответ JSON. Конкретные имена полей и
URL у каждого провайдера свои, но скелет одинаковый.

## Концепция — что такое API-вызов

```
[Твой код] --(HTTP-запрос с API-ключом)--> [Сервер провайдера]
[Твой код] <--(HTTP-ответ в JSON)--------- [Сервер провайдера]
```

В каждом вызове четыре вещи:
1. **Endpoint** — URL (например, `https://api.anthropic.com/v1/messages`).
2. **API key** — длинная строка, идентифицирует и авторизует тебя.
   Передаётся в заголовке (`x-api-key`, `Authorization: Bearer ...`).
3. **Request body** — JSON, что именно ты хочешь (модель, сообщения, лимиты).
4. **Response body** — JSON, что вернули (текст, причина остановки, usage).

## Блок 1 — Безопасное хранение ключей

**Главное правило:** API-ключи никогда не пишутся в коде. Никогда.

Почему это критично:
- Код попадает в git → ключ попадает в публичный репо → кто-то находит его
  через GitHub Search и качает с твоего аккаунта запросов на тысячи долларов
  за ночь. Это **реальный сценарий**, который происходит регулярно.
- Даже в приватном репо ключ в коде — это утечка при любом сливе, скриншоте,
  коде-ревью.

**Правильно — через environment variables (переменные окружения):**

В Linux/macOS bash/zsh:
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
```

В Windows PowerShell:
```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-..."
```

Но `export` живёт только в текущем шелле. Чтобы переменные сохранялись —
кладут их в `~/.bashrc` / `~/.zshrc` (на Linux/macOS) или в постоянное окружение
Windows.

**Альтернатива — файл `.env`** в корне проекта:

```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

И **обязательно**: `.gitignore` должен содержать `.env`, чтобы файл не попал
в git. Это `Lesson 02`-уровень дисциплины, но забыть про это легко.

Загружать `.env` в Python принято через библиотеку `python-dotenv`:

```python
from dotenv import load_dotenv
load_dotenv()  # читает .env и кладёт в os.environ
```

После этого `os.environ["ANTHROPIC_API_KEY"]` уже работает.

**Python-подсветка:** SDK от Anthropic (и OpenAI) сами ищут ключ в
`os.environ["ANTHROPIC_API_KEY"]` (и аналогично `OPENAI_API_KEY`), поэтому
конструктор без аргументов:
```python
client = anthropic.Anthropic()
```
— достаточно. Не надо передавать ключ руками.

## Блок 2 — Первый вызов через SDK (Python)

```python
import anthropic

client = anthropic.Anthropic()

response = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=256,
    messages=[{"role": "user", "content": "What is a neural network in one sentence?"}]
)

print(response.content[0].text)
```

**Разбор:**

- `anthropic.Anthropic()` — клиент. Ищет `ANTHROPIC_API_KEY` в окружении.
- `client.messages.create(...)` — единая точка для всех вызовов чат-моделей
  Claude.
- `model` — конкретная модель. Имена меняются с каждым релизом. Актуальный
  список — в [docs.claude.com/en/docs/about-claude/models](https://docs.claude.com/en/docs/about-claude/models).
- `max_tokens` — **обязательный** параметр у Anthropic SDK. Это потолок длины
  ответа в токенах. Без него API не вызовешь.
- `messages` — список сообщений диалога. Каждое — `{"role": "user|assistant", "content": "..."}`.
- `response.content` — список «блоков контента» (Anthropic поддерживает не
  только текст, но и tool use, изображения). У простого текстового ответа
  блок один — `response.content[0]`, у которого есть `.text`.

**Python-подсветка:** объект `response` — это не словарь, а pydantic-модель.
`.content[0].text` — атрибуты, не `["content"][0]["text"]`. Это типобезопаснее.

## Блок 3 — Первый вызов через SDK (TypeScript)

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const response = await client.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 256,
  messages: [{ role: "user", content: "What is a neural network in one sentence?" }],
});

console.log(response.content[0].text);
```

Структура **идентична** Python-варианту. Это сознательное дизайн-решение
Anthropic: один и тот же API контракт, разные обёртки для разных языков.
Когда мы дойдём до агентов на TS (фазы 13+), переход будет плавным.

## Блок 4 — Тот же вызов через raw HTTP (без SDK)

```python
import os
import urllib.request
import json

url = "https://api.anthropic.com/v1/messages"
headers = {
    "Content-Type": "application/json",
    "x-api-key": os.environ["ANTHROPIC_API_KEY"],
    "anthropic-version": "2023-06-01",
}
body = json.dumps({
    "model": "claude-sonnet-4-20250514",
    "max_tokens": 256,
    "messages": [{"role": "user", "content": "What is a neural network in one sentence?"}],
}).encode()

req = urllib.request.Request(url, data=body, headers=headers, method="POST")
with urllib.request.urlopen(req) as resp:
    result = json.loads(resp.read())
    print(result["content"][0]["text"])
```

**Зачем вообще знать raw HTTP, если есть SDK:**

- **Отладка.** Когда SDK падает, понимание raw-запроса помогает дёрнуть тот же
  запрос через `curl`/`httpie` и понять, в чём проблема.
- **Языки без SDK.** Не везде есть готовый клиент. Зная сырой протокол, можешь
  работать с любого языка.
- **Custom поведение.** Прокси, кастомные заголовки, специальные таймауты —
  иногда проще через сырой HTTP.

**Разбор:**
- `x-api-key` — заголовок аутентификации именно у Anthropic.
  У OpenAI — `Authorization: Bearer sk-...`. У каждого свой.
- `anthropic-version` — обязательный заголовок версии API. Anthropic сильно
  следит за обратной совместимостью именно через версию в заголовке.
- `urllib.request` — встроенная стандартная библиотека Python. Без `requests`.
  Менее удобно, но без зависимостей. В реальном коде обычно `requests` или
  `httpx`.
- `.encode()` нужен, потому что HTTP-тело передаётся в байтах, не в строке.

## Use It — что использовать в курсе

| API | Когда нужен | Free tier |
|---|---|---|
| Anthropic (Claude) | Фазы 11–16 (агенты, tools) | $5 кредитов при регистрации |
| OpenAI | Фаза 11 (для сравнения) | $5 кредитов при регистрации |
| Hugging Face | Фазы 4–10 (модели, датасеты) | Полностью бесплатно |

Не надо регистрироваться во всём сразу. Подключаешь по мере того, как урок
этого требует.

## Упражнения

### Упражнение 1 — получить ключ Anthropic и сделать первый вызов

**Маршрут:**

1. Зайти на [console.anthropic.com](https://console.anthropic.com), создать
   аккаунт, получить $5 free credit.
2. **Settings → API Keys → Create Key.** Скопировать ключ **сразу** — потом
   его не покажут, придётся создавать новый.
3. Установить SDK: `uv pip install anthropic`.
4. Положить ключ в `.env` в корне репо (и убедиться, что `.env` в `.gitignore`).
5. Установить `python-dotenv`: `uv pip install python-dotenv`.
6. Написать скрипт `scratch/phase-00-lesson-04/hello_claude.py`:
   ```python
   from dotenv import load_dotenv
   import anthropic
   load_dotenv()
   client = anthropic.Anthropic()
   resp = client.messages.create(
       model="claude-sonnet-4-20250514",  # актуальное имя смотри в docs
       max_tokens=256,
       messages=[{"role": "user", "content": "What is a neural network in one sentence?"}],
   )
   print(resp.content[0].text)
   ```
7. Запустить, прочитать ответ.

**Подсветка:** в репо уже есть `code/first_api_call.py` — там же скелет.
И **второй файл** — `code/first_api_call_openrouter.py` — вариант с
OpenRouter (прокси, который маршрутизирует к разным провайдерам с одним ключом).
Полезно как fallback, если Anthropic-ключ ещё не оформлен.

### Упражнение 2 — тот же вопрос через raw HTTP

**Маршрут:**

1. Взять код из `Блок 4` ru.md.
2. Прогнать, распечатать **полный JSON-ответ** (`print(json.dumps(result, indent=2))`).
3. Сравнить с тем, как SDK его «упаковывает» (`response.content[0].text` vs.
   `result["content"][0]["text"]`).

**Что заметить:** в полном JSON есть поля, которые SDK не выводит явно —
`stop_reason` (почему модель остановилась — `end_turn`, `max_tokens`,
`tool_use`), `usage.input_tokens` / `usage.output_tokens` (счётчики токенов
для биллинга), `id`, `model`. SDK всё это даёт как `response.stop_reason`,
`response.usage.input_tokens` и т.д., но в raw-варианте это нагляднее.

### Упражнение 3 — намеренно сломать ключ и прочитать ошибку

**Маршрут:**

1. В `.env` исправить `ANTHROPIC_API_KEY` на заведомо неправильный
   (например, `sk-ant-WRONG`).
2. Запустить тот же скрипт.
3. Прочитать сообщение об ошибке.

**Что увидишь (примерно):** `anthropic.AuthenticationError: ... 401 ...
authentication_error ... invalid x-api-key`. Запомни этот шаблон ошибки —
401 везде значит «авторизация не прошла», 403 — «авторизация ок, но нельзя»,
429 — «rate limit», 500–599 — «упал их сервер».

**Подсветка:** эта тренировка важна, потому что в реальных агентских циклах
LLM-вызовы регулярно валятся (rate limits, transient errors). Уметь читать
ошибку с первой попытки экономит часы отладки.

## Ключевые термины

| Термин | Что говорят | Что это на самом деле |
|---|---|---|
| API key | «пароль для API» | Длинная строка, идентифицирует аккаунт и авторизует запросы |
| Rate limit | «они меня троттлят» | Лимит запросов в минуту/час, чтобы не дать сжечь сервис |
| Token | «слово» (в контексте API) | Единица биллинга: входные и выходные считаются и оплачиваются отдельно |
| Streaming | «ответ в реальном времени» | Получение ответа по кусочкам, а не одним блоком в конце |
| SDK | «официальная библиотека» | Удобная обёртка над raw HTTP с типами, ретраями, обработкой ошибок |
| `.env` | «файл с секретами» | Текстовый файл `KEY=value`, который читается через `dotenv` |

## Что важно вынести из урока

1. **API-ключи никогда не в коде.** Всегда в `.env` или системных env-vars.
   `.env` всегда в `.gitignore`.
2. **Все LLM API одинаковы по форме.** Endpoint + ключ + JSON-запрос + JSON-ответ.
   Отличия — в именах полей.
3. **`max_tokens` обязателен** у Anthropic. Без него API не вызовешь.
4. **SDK для удобства, raw HTTP для отладки.** Полезно знать оба.
5. **Ошибки HTTP читать по статус-коду** (401, 403, 429, 5xx) — это первый сигнал,
   что с чем делать.
6. **Free tier $5** хватит на первые сотни вызовов, на курс этого с запасом.
