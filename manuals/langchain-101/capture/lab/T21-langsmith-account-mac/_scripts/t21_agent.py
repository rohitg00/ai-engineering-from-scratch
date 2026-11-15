from langchain.agents import create_agent
from langchain_core.tools import tool
from langchain_ollama import ChatOllama

from t21_common import MODEL

SYSTEM = "You are a calculator. Always use the tools for arithmetic, one tool call at a time. Answer with the number only."


@tool
def add(a: int, b: int) -> int:
    """Add two integers."""
    return a + b


@tool
def multiply(a: int, b: int) -> int:
    """Multiply two integers."""
    return a * b


def make_llm():
    return ChatOllama(model=MODEL, temperature=0, seed=42, reasoning=False, num_ctx=16384)


def make_agent(llm=None):
    return create_agent(llm or make_llm(), tools=[add, multiply], system_prompt=SYSTEM)


def ask(agent, q, **kw):
    out = agent.invoke({"messages": [{"role": "user", "content": q}]}, **kw)
    return out["messages"][-1].content, out


QUESTIONS = [(f"What is {a} + {b}?", a + b) for a, b in [(17, 25), (8, 13), (120, 45), (9, 91), (33, 67), (250, 250), (14, 29), (61, 7), (305, 18), (44, 56)]]
