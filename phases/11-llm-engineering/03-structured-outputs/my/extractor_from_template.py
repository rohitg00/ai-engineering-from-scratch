import json
from enum import Enum

import anthropic
from pydantic import BaseModel, ValidationError

client = anthropic.Anthropic()


class Tone(str, Enum):
    positive = "positive"
    neutral = "neutral"
    negative = "negative"


class Email(BaseModel):
    subject: str
    tone: Tone
    is_urgent: bool
    tags: list[str] = []


schema = Email.model_json_schema()

SYSTEM_PROMPT = """Ты — движок извлечения структурированных данных для CRM...
...Верни ТОЛЬКО JSON-объект, без markdown-забора, без преамбулы."""
client_email = """Здравствуйте! Уже второй раз с карты списали абонентскую плату,
хотя я отключил подписку ещё в марте. Верните деньги, это возмутительно.
Жду ответа сегодня же."""


user_message = f"""Схема:
{json.dumps(schema, ensure_ascii=False, indent=2)}

Текст клиента:
{client_email}

Извлеки данные в JSON."""

# print(template)

resp = client.messages.create(
    model="claude-haiku-4-5-20251001",
    max_tokens=1500,
    temperature=0,
    messages=[{"role": "user", "content": user_message}],
)

text = resp.content[0].text.strip()

if text.startswith("```"):
    text = text.split("```")[1]
    if text.startswith("json"):
        text = text[4:]
    text = text.strip()
print(text)

try:
    payload = json.loads(text)  # (б) строка -> dict
    email = Email.model_validate(payload)  # (в) dict -> объект Email
    print("OK:", email)
except json.JSONDecodeError as e:  # ловим и битый JSON...
    print("JSON не распарсился:", e)
except ValidationError as e:  # ...и несоответствие схеме
    print("Ошибки валидации:")
    print(e)
