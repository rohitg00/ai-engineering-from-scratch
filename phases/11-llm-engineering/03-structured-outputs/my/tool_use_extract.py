from enum import Enum

import anthropic
from pydantic import BaseModel

client = anthropic.Anthropic()
client_email = """Здравствуйте! Уже второй раз с карты списали абонентскую плату,
хотя я отключил подписку ещё в марте. Верните деньги, это возмутительно.
Жду ответа сегодня же."""


class Tone(str, Enum):
    positive = "positive"
    neutral = "neutral"
    negative = "negative"


class Email(BaseModel):
    subject: str
    tone: Tone
    is_urgent: bool
    tags: list[str] = []


tools = [
    {
        "name": "extract_email",
        "description": "Извлечь структурированные параметры из письма клиента",
        "input_schema": Email.model_json_schema(),
    }
]


resp = client.messages.create(
    model="claude-haiku-4-5-20251001",
    max_tokens=500,
    tools=tools,  # type: ignore  # SDK ждёт точный TypedDict, наш ручной dict валиден в рантайме
    tool_choice={"type": "tool", "name": "extract_email"},
    messages=[
        {
            "role": "user",
            "content": f"Извлеки параметры из письма клиента:\n\n{client_email}",
        }
    ],
)

tool_data = None
for block in resp.content:
    if block.type == "tool_use":
        tool_data = block.input
        break
print(f"сырые данные от модели: {tool_data}")

email = Email.model_validate(tool_data)
print("OK", email)
print(f"tone: {email.tone} | is_urgent: {email.is_urgent}")
