from collections import Counter
from enum import Enum

import anthropic
import instructor
from pydantic import BaseModel

client = instructor.from_anthropic(
    anthropic.Anthropic(),
    mode=instructor.Mode.ANTHROPIC_JSON,
)

message = "Ну спасибо, очень помогли, я прям в восторге 🙄"


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
        temperature=0.7,
        response_model=Email,
        messages=[{"role": "user", "content": text}],
    )

    return resp


tones = []
urgents = []

for _ in range(5):
    res = extract(message)
    tones.append(res.tone.value)
    urgents.append(res.is_urgent)

tones_count = Counter(tones)
urgents_count = Counter(urgents)

print(tones_count)
print(urgents_count)


def confidence(values):
    """Самый частый ответ и его доля от всех прогонов."""
    value, n = Counter(values).most_common(1)[0]
    return value, n / len(values)


for name, values in [("tone", tones), ("is_urgent", urgents)]:
    value, conf = confidence(values)
    flag = "  ⚠️ низкая уверенность, на ревью" if conf < 0.8 else ""
    print(f"{name}: {value} — уверенность {conf:.0%}{flag}")
