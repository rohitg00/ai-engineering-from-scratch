from dataclasses import dataclass
from typing import TypedDict

from langchain.agents import create_agent
from langchain.agents.middleware import AgentMiddleware
from langchain.agents.structured_output import AutoStrategy, ProviderStrategy, ToolStrategy
from langchain_core.messages import AIMessage
from pydantic import BaseModel, Field

from common import ASK, add, model, show_log, sum_script
from fake import call, calls


class Answer(BaseModel):
    value: int = Field(description="The numeric answer.")
    unit: str = "none"


class Refusal(BaseModel):
    reason: str


class AnswerDict(TypedDict):
    value: int


@dataclass
class AnswerData:
    value: int


def run_structured(cap, title, fake, response_format, tools=(add,)):
    cap.section(title)
    agent = create_agent(fake, tools=list(tools), response_format=response_format)
    out = cap.attempt("invoke", lambda: agent.invoke(ASK))
    if out is not None:
        cap.json(out.get("structured_response"), "structured_response")
        cap.text(f"structured_response type: {type(out.get('structured_response')).__name__}")
        cap.messages(out["messages"][1:])
    show_log(cap, fake)


def structured_strategies(cap):
    run_structured(cap, "a bare schema on a model with no profile: AutoStrategy picks ToolStrategy",
                   model(call("Answer", {"value": 5}), label="no-profile"), Answer)
    run_structured(cap, "a bare schema on a model whose profile says structured_output: AutoStrategy picks ProviderStrategy",
                   model(AIMessage('{"value": 5, "unit": "none"}'), label="profiled", profile={"structured_output": True}), Answer)
    run_structured(cap, "AutoStrategy written out",
                   model(call("Answer", {"value": 5}), label="auto"), AutoStrategy(Answer))
    run_structured(cap, "ProviderStrategy on the fake",
                   model(AIMessage('{"value": 5, "unit": "none"}'), label="provider"), ProviderStrategy(Answer))
    run_structured(cap, "ToolStrategy with a TypedDict",
                   model(call("AnswerDict", {"value": 5}), label="typeddict"), ToolStrategy(AnswerDict))
    run_structured(cap, "ToolStrategy with a dataclass",
                   model(call("AnswerData", {"value": 5}), label="dataclass"), ToolStrategy(AnswerData))
    schema = {"title": "answer_schema", "description": "A numeric answer.", "type": "object", "properties": {"value": {"type": "integer"}}, "required": ["value"]}
    run_structured(cap, "ToolStrategy with a raw JSON schema dict: returned without validation",
                   model(call("answer_schema", {"value": "not a number"}), label="json-schema"), ToolStrategy(schema))
    run_structured(cap, "ToolStrategy with a union: one tool per schema",
                   model(call("Refusal", {"reason": "no numbers"}), label="union"), ToolStrategy(Answer | Refusal))


def structured_errors(cap):
    run_structured(cap, "ToolStrategy validation error, then the retry",
                   model(call("Answer", {"value": "five"}, "call_a"), call("Answer", {"value": 5}, "call_b"), label="retry"), ToolStrategy(Answer))
    run_structured(cap, "ToolStrategy two structured calls in one message, then the retry",
                   model(calls(("Answer", {"value": 5}, "call_a"), ("Refusal", {"reason": "x"}, "call_b")), call("Answer", {"value": 5}, "call_c"), label="multiple"), ToolStrategy(Answer | Refusal))
    run_structured(cap, "ToolStrategy handle_errors with a custom message",
                   model(call("Answer", {"value": "five"}, "call_a"), call("Answer", {"value": 5}, "call_b"), label="message"), ToolStrategy(Answer, handle_errors="Return value as an integer."))
    run_structured(cap, "ToolStrategy handle_errors=False: the run raises",
                   model(call("Answer", {"value": "five"}), label="no-retry"), ToolStrategy(Answer, handle_errors=False))
    run_structured(cap, "ProviderStrategy with JSON that fails validation",
                   model(AIMessage('{"value": "five"}'), label="provider-bad"), ProviderStrategy(Answer))
    run_structured(cap, "ProviderStrategy with text that is not JSON",
                   model(AIMessage("The answer is 5."), label="provider-text"), ProviderStrategy(Answer))
    run_structured(cap, "ToolStrategy, the model calls a normal tool first",
                   model(call("add", {"a": 2, "b": 3}, "call_a"), call("Answer", {"value": 5}, "call_b"), label="tool-first"), ToolStrategy(Answer))


class Traced(AgentMiddleware):
    def __init__(self, label, log):
        super().__init__()
        self.label = label
        self.log = log

    @property
    def name(self):
        return self.label

    def before_agent(self, state, runtime):
        self.log.append(f"{self.label}.before_agent")

    def before_model(self, state, runtime):
        self.log.append(f"{self.label}.before_model")

    def wrap_model_call(self, request, handler):
        self.log.append(f"{self.label}.wrap_model_call enter")
        response = handler(request)
        self.log.append(f"{self.label}.wrap_model_call exit")
        return response

    def after_model(self, state, runtime):
        self.log.append(f"{self.label}.after_model")

    def wrap_tool_call(self, request, handler):
        self.log.append(f"{self.label}.wrap_tool_call enter {request.tool_call['name']}")
        result = handler(request)
        self.log.append(f"{self.label}.wrap_tool_call exit")
        return result

    def after_agent(self, state, runtime):
        self.log.append(f"{self.label}.after_agent")


def hook_order(cap):
    log = []
    fake = model(*sum_script())
    original = fake.next_reply

    def logged(messages):
        log.append("  model called")
        return original(messages)

    object.__setattr__(fake, "next_reply", logged)

    agent = create_agent(fake, tools=[add], middleware=[Traced("A", log), Traced("B", log), Traced("C", log)])
    cap.section("middleware=[A, B, C], graph nodes")
    cap.json(list(agent.get_graph().nodes))
    cap.section("edges")
    cap.json([f"{e.source} -> {e.target}" for e in agent.get_graph().edges])
    cap.section("hook order for one tool round trip")
    agent.invoke(ASK)
    cap.json(log)
    cap.section("two middleware with the same name")
    cap.attempt("create_agent(middleware=[A, A])", lambda: create_agent(model("hi"), middleware=[Traced("A", []), Traced("A", [])]))


SCENARIOS = [
    ("structured-output", "Structured output: each strategy", structured_strategies),
    ("structured-errors", "Structured output: validation errors and retries", structured_errors),
    ("middleware-order", "Middleware hook order with three middlewares", hook_order),
]
