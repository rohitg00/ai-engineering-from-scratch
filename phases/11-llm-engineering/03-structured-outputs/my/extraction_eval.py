from enum import Enum

import anthropic
import instructor
from pydantic import BaseModel

client = instructor.from_anthropic(
    anthropic.Anthropic(),
    mode=instructor.Mode.ANTHROPIC_JSON,
)


class Tone(str, Enum):
    positive = "positive"
    neutral = "neutral"
    negative = "negative"


class Email(BaseModel):
    subject: str
    tone: Tone
    is_urgent: bool


def extract(text):
    resp = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=300,
        response_model=Email,
        messages=[{"role": "user", "content": text}],
    )

    return resp


dataset = [
    (
        "Уже второй раз списали абонентку после отмены подписки. Верните деньги, жду ответа сегодня же!",
        {"tone": "negative", "is_urgent": True},
    ),
    (
        "Спасибо за быструю помощь вчера, всё работает отлично. Хорошего дня!",
        {"tone": "positive", "is_urgent": False},
    ),
    (
        "Подскажите, пожалуйста, как сменить тариф в личном кабинете? Особо не тороплюсь.",
        {"tone": "neutral", "is_urgent": False},
    ),
    (
        "Интерфейс стал заметно тормозить после обновления, пользоваться неприятно. Когда-нибудь поправите?",
        {"tone": "negative", "is_urgent": False},
    ),
    (
        "Нужен счёт за прошлый месяц для бухгалтерии, крайний срок — до конца сегодняшнего дня.",
        {"tone": "neutral", "is_urgent": True},
    ),
    (
        "Новый раздел аналитики — просто супер, давно такого ждали. Команде респект!",
        {"tone": "positive", "is_urgent": False},
    ),
    (
        "С аккаунта пропадают деньги, кажется, меня взломали! Срочно заблокируйте операции!",
        {"tone": "negative", "is_urgent": True},
    ),
    (
        "Где можно почитать документацию по API? Хочу на досуге разобраться с интеграцией.",
        {"tone": "neutral", "is_urgent": False},
    ),
]

tone_count = 0
is_urgent_count = 0
for text, gold in dataset:
    predicted = extract(text)
    if predicted.tone.value == gold["tone"]:
        tone_count += 1
    if predicted.is_urgent == gold["is_urgent"]:
        is_urgent_count += 1
    if predicted.tone.value != gold["tone"]:
        print(
            f"❌ tone: ждали {gold['tone']}, получили {predicted.tone.value} | {text[:40]}"
        )
    if predicted.is_urgent != gold["is_urgent"]:
        print(
            f"❌ is_urgent: ждали {gold['is_urgent']}, получили {predicted.is_urgent} | {text[:40]}"
        )

total = len(dataset)
print(f"tone:      {tone_count}/{total} ({tone_count / total * 100:.0f}%)")
print(f"is_urgent: {is_urgent_count}/{total} ({is_urgent_count / total * 100:.0f}%)")
