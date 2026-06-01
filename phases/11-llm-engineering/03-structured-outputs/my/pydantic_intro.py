from enum import Enum

from pydantic import BaseModel, ValidationError


class Tone(str, Enum):
    positive = "positive"
    neutral = "neutral"
    negative = "negative"


class Email(BaseModel):
    subject: str
    tone: Tone
    is_urgent: bool
    tags: list[str] = []


# print(Email.model_json_schema())
# print("-" * 80)
# print(json.dumps(Email.model_json_schema(), ensure_ascii=False, indent=2))
ok_data = {
    "subject": "двойное списание абонентки",
    "tone": "negative",
    "is_urgent": True,
}

bad_data = {
    "subject": "возврат средств",
    "tone": "раздражённый",  # нет в Enum positive/neutral/negative
    "is_urgent": "очень",  # строка вместо bool
}

try:
    Email(**bad_data)  # пытаемся создать объект из битых данных
except ValidationError as e:  # если Pydantic кинул ошибку валидации —
    print("Ошибки валидации:")  # ловим её сюда, в переменную e
    print(e)

try:
    # корректные данные — объект создаётся успешно
    email = Email.model_validate(ok_data)
    print("OK:", email)
    print("tone:", email.tone)  # Tone.negative — это Enum, а не строка
except ValidationError as e:  # если Pydantic кинул ошибку валидации —
    print("Ошибки валидации:")  # ловим её сюда, в переменную e
    print(e)
