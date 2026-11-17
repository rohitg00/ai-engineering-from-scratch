from dataclasses import dataclass
from typing import TypedDict

from langchain.agents import create_agent
from langchain.agents.middleware import AgentMiddleware
from langchain.agents.structured_output import AutoStrategy, ProviderStrategy, ToolStrategy
from pydantic import BaseModel, Field

from common import ASK, add, ask, llm, show_log


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


WORD = ask("What is 2 + 3? Give the value as the English word, for example five, not as digits.")
HALF = ask("What is 7 divided by 2? Put the exact decimal value, 3.5, in the value field.")
BOTH = ask("What is 2 + 3? Call the Answer tool and the Refusal tool together in one reply.")
LIMIT = {"recursion_limit": 12}


def run_structured(cap, title, m, response_format, tools=(), inp=ASK):
    cap.section(title)
    agent = create_agent(m, tools=list(tools), response_format=response_format)
    out = cap.attempt("invoke", lambda: agent.invoke(inp, LIMIT))
    if out is not None:
        cap.json(out.get("structured_response"), "structured_response")
        cap.text(f"structured_response type: {type(out.get('structured_response')).__name__}")
        cap.messages(out["messages"][1:])
    show_log(cap, m)


def structured_strategies(cap):
    run_structured(cap, "a bare schema on a model with no profile: AutoStrategy picks ToolStrategy",
                   llm("no-profile"), Answer)
    run_structured(cap, "a bare schema on a model whose profile says structured_output: AutoStrategy picks ProviderStrategy",
                   llm("profiled", profile={"structured_output": True}), Answer)
    run_structured(cap, "AutoStrategy written out",
                   llm("auto"), AutoStrategy(Answer))
    run_structured(cap, "ProviderStrategy on ChatOllama",
                   llm("provider"), ProviderStrategy(Answer))
    run_structured(cap, "ToolStrategy with a TypedDict",
                   llm("typeddict"), ToolStrategy(AnswerDict))
    run_structured(cap, "ToolStrategy with a dataclass",
                   llm("dataclass"), ToolStrategy(AnswerData))
    schema = {"title": "answer_schema", "description": "A numeric answer.", "type": "object", "properties": {"value": {"type": "integer"}}, "required": ["value"]}
    run_structured(cap, "ToolStrategy with a raw JSON schema dict: returned without validation",
                   llm("json-schema"), ToolStrategy(schema), inp=WORD)
    run_structured(cap, "ToolStrategy with a union: one tool per schema",
                   llm("union"), ToolStrategy(Answer | Refusal))
    run_structured(cap, "ToolStrategy with the add tool bound: the model may answer in text",
                   llm("tool-and-text"), ToolStrategy(Answer), tools=(add,))
    run_structured(cap, "ProviderStrategy with the add tool bound",
                   llm("provider-and-tool"), ProviderStrategy(Answer), tools=(add,))


def structured_errors(cap):
    run_structured(cap, "ToolStrategy validation error, then the retry",
                   llm("retry"), ToolStrategy(Answer), inp=HALF)
    run_structured(cap, "ToolStrategy two structured calls in one message, then the retry",
                   llm("multiple"), ToolStrategy(Answer | Refusal), inp=BOTH)
    run_structured(cap, "ToolStrategy handle_errors with a custom message",
                   llm("message"), ToolStrategy(Answer, handle_errors="Return value as an integer."), inp=HALF)
    run_structured(cap, "ToolStrategy handle_errors=False: the run raises",
                   llm("no-retry"), ToolStrategy(Answer, handle_errors=False), inp=HALF)
    run_structured(cap, "ProviderStrategy when the answer is not an integer",
                   llm("provider-half"), ProviderStrategy(Answer), inp=HALF)
    run_structured(cap, "ProviderStrategy when the prompt asks for a word",
                   llm("provider-word"), ProviderStrategy(Answer), inp=WORD)
    run_structured(cap, "ProviderStrategy when the prompt asks for plain text",
                   llm("provider-text"), ProviderStrategy(Answer), inp=ask("What is 2 + 3? Reply with one plain English sentence, not JSON."))
    run_structured(cap, "ToolStrategy, the model calls a normal tool first",
                   llm("tool-first"), ToolStrategy(Answer), tools=(add,), inp=ask("What is 2 + 3? First call the add tool, then give the structured answer."))


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
    agent = create_agent(llm("order", sink=log), tools=[add], middleware=[Traced("A", log), Traced("B", log), Traced("C", log)])
    cap.section("middleware=[A, B, C], graph nodes")
    cap.json(list(agent.get_graph().nodes))
    cap.section("edges")
    cap.json([f"{e.source} -> {e.target}" for e in agent.get_graph().edges])
    cap.section("hook order for one tool round trip")
    agent.invoke(ASK)
    cap.json(log)
    cap.section("two middleware with the same name")
    cap.attempt("create_agent(middleware=[A, A])", lambda: create_agent(llm(), middleware=[Traced("A", []), Traced("A", [])]))


SCENARIOS = [
    ("structured-output", "Structured output: each strategy", structured_strategies, True),
    ("structured-errors", "Structured output: validation errors and retries", structured_errors, True),
    ("middleware-order", "Middleware hook order with three middlewares", hook_order, True),
]
