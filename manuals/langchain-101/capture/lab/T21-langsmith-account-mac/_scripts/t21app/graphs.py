from langchain.agents import create_agent
from langchain_core.tools import tool
from langchain_ollama import ChatOllama

SYSTEM = "You are a calculator. Always use the tools for arithmetic, one tool call at a time. Answer with the number only."


@tool
def add(a: int, b: int) -> int:
    """Add two integers."""
    return a + b


@tool
def multiply(a: int, b: int) -> int:
    """Multiply two integers."""
    return a * b


agent = create_agent(ChatOllama(model="qwen3:4b-instruct-2507-q4_K_M", temperature=0, seed=42, reasoning=False, num_ctx=16384),
                     tools=[add, multiply], system_prompt=SYSTEM)
