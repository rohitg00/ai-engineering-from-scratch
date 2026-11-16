import langsmith
import pytest
from langsmith import testing as t


@pytest.mark.langsmith
def test_marked_pass():
    t.log_inputs({"a": 2, "b": 3})
    t.log_reference_outputs({"sum": 5})
    t.log_outputs({"sum": 5})
    t.log_feedback(key="exact", score=1)
    assert 2 + 3 == 5


@pytest.mark.langsmith
def test_marked_fail():
    t.log_outputs({"sum": 9})
    assert 4 + 4 == 9


@langsmith.test
def test_decorator_form():
    t.log_outputs({"ok": True})
    assert True


@pytest.mark.langsmith
def test_marked_agent():
    from langchain.agents import create_agent
    from langchain_core.tools import tool
    from langchain_ollama import ChatOllama

    @tool
    def add(a: int, b: int) -> int:
        """Add two integers."""
        return a + b

    model = ChatOllama(model="qwen3:4b-instruct-2507-q4_K_M", temperature=0, seed=42, base_url="http://127.0.0.1:11434")
    out = create_agent(model, tools=[add]).invoke({"messages": [{"role": "user", "content": "What is 2+3? Use the add tool, then reply with the number only."}]})["messages"][-1].content
    t.log_outputs({"answer": out})
    assert out.strip() == "5"


def test_unmarked_log_call():
    t.log_outputs({"x": 1})
