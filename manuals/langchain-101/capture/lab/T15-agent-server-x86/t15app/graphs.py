import asyncio
import json
import os
import time
from typing import Annotated, Any, TypedDict

from langchain.agents import create_agent
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from langchain_core.tools import tool
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages

DELAY = float(os.environ.get("FAKE_MODEL_DELAY_S", "0.05"))
LOG = os.environ.get("T15_LOG", "t15-events.jsonl")


def emit(**kw):
    kw["t"] = time.time()
    kw["pid"] = os.getpid()
    with open(LOG, "a") as f:
        f.write(json.dumps(kw) + "\n")


class DelayModel(BaseChatModel):
    def bind_tools(self, tools, **kw):
        return self

    def _reply(self, messages):
        if isinstance(messages[-1], HumanMessage):
            return AIMessage(content="", tool_calls=[{"name": "add", "args": {"a": 2, "b": 3}, "id": "c1", "type": "tool_call"}])
        return AIMessage(content="the answer is 5")

    def _generate(self, messages, stop=None, run_manager=None, **kw: Any):
        time.sleep(DELAY)
        return ChatResult(generations=[ChatGeneration(message=self._reply(messages))])

    async def _agenerate(self, messages, stop=None, run_manager=None, **kw: Any):
        await asyncio.sleep(DELAY)
        return ChatResult(generations=[ChatGeneration(message=self._reply(messages))])

    @property
    def _llm_type(self):
        return "delay-fake"


@tool
def add(a: int, b: int) -> int:
    """Add two numbers."""
    return a + b


agent = create_agent(DelayModel(), [add])


def _merge(a, b):
    return (a or []) + (b or [])


class SlowS(TypedDict):
    messages: Annotated[list, add_messages]
    seconds: float
    label: str
    done: Annotated[list, _merge]


async def first(state):
    emit(ev="first_start", label=state.get("label"))
    await asyncio.sleep(state.get("seconds", 2.0) / 2)
    emit(ev="first_end", label=state.get("label"))
    return {"done": [f"first:{state.get('label')}"]}


async def second(state):
    emit(ev="second_start", label=state.get("label"))
    await asyncio.sleep(state.get("seconds", 2.0) / 2)
    emit(ev="second_end", label=state.get("label"))
    return {"done": [f"second:{state.get('label')}"], "messages": [AIMessage(content=f"finished {state.get('label')}")]}


_g = StateGraph(SlowS)
_g.add_node("first", first)
_g.add_node("second", second)
_g.add_edge(START, "first")
_g.add_edge("first", "second")
_g.add_edge("second", END)
slow = _g.compile()


class LoopS(TypedDict):
    n: int


async def spin(state):
    return {"n": state.get("n", 0) + 1}


_l = StateGraph(LoopS)
_l.add_node("spin", spin)
_l.add_edge(START, "spin")
_l.add_edge("spin", "spin")
loop = _l.compile()
