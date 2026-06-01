from typing import Annotated, Literal

import anthropic
import instructor
from pydantic import BaseModel, Field


class Complaint(BaseModel):
    kind: Literal["complaint"]
    refund_amount: float | None = None
    severity: str


class FeatureRequest(BaseModel):
    kind: Literal["feature_request"]
    feature_name: str


ClientMessage = Annotated[Complaint | FeatureRequest, Field(discriminator="kind")]

client = instructor.from_anthropic(
    anthropic.Anthropic(),
    mode=instructor.Mode.ANTHROPIC_JSON,
)
client_message = """Здравствуйте! Уже второй раз с карты списали абонентскую плату,
хотя я отключил подписку ещё в марте. Верните деньги, это возмутительно.
Жду ответа сегодня же."""

result = client.messages.create(
    model="claude-haiku-4-5-20251001",
    max_tokens=300,
    response_model=ClientMessage,
    messages=[{"role": "user", "content": client_message}],
)

print(result)
print(type(result).__name__)
