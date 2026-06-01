from typing import Annotated, Literal

import anthropic
from pydantic import BaseModel, Field, TypeAdapter, ValidationError


class Complaint(BaseModel):
    kind: Literal["complaint"]
    refund_amount: float | None = None
    severity: str


class FeatureRequest(BaseModel):
    kind: Literal["feature_request"]
    feature_name: str


client = anthropic.Anthropic()
client_message = """Здравствуйте! Уже второй раз с карты списали абонентскую плату,
хотя я отключил подписку ещё в марте. Верните деньги, это возмутительно.
Жду ответа сегодня же."""
test_obj_1 = {"kind": "complaint", "refund_amount": 1990.0, "severity": "high"}
test_obj_2 = {"kind": "complaint", "severity": "high"}

tools = [
    {
        "name": "extract_complaint",
        "description": "вызвать, если клиент жалуется на что-то",
        "input_schema": Complaint.model_json_schema(),
    },
    {
        "name": "extract_feature_request",
        "description": "вызвать, если клиент просит добавить новую функциональность в продукт или доработать текущую",
        "input_schema": FeatureRequest.model_json_schema(),
    },
]

# ClientMessage = Complaint | FeatureRequest
ClientMessage = Annotated[Complaint | FeatureRequest, Field(discriminator="kind")]
adapter = TypeAdapter(ClientMessage)
obj_1 = adapter.validate_python(test_obj_1)
print(obj_1)
print(type(obj_1).__name__)

resp = client.messages.create(
    model="claude-haiku-4-5-20251001",
    max_tokens=1500,
    temperature=0,
    tools=tools,  # type: ignore
    tool_choice={"type": "any"},
    messages=[{"role": "user", "content": client_message}],
)

tool_name = None
tool_input = None
for block in resp.content:
    if block.type == "tool_use":
        tool_name = block.name
        tool_input = block.input
        break
print(f""" tool_name: {tool_name}
tool_input: {tool_input}
""")

try:
    res_output = adapter.validate_python(tool_input)
    print("OK:", res_output)
    print("класс:", type(res_output).__name__)
except ValidationError as e:
    print(f"произошла ошибка: {e}")
