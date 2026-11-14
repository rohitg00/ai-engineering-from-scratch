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
    from langchain_core.messages import AIMessage
    from langchain_core.tools import tool
    from fake_tools import ToolFake

    @tool
    def add(a: int, b: int) -> int:
        """Add two integers."""
        return a + b

    fake = ToolFake(script=[AIMessage(content="", tool_calls=[{"name": "add", "args": {"a": 2, "b": 3}, "id": "c1", "type": "tool_call"}]),
                            AIMessage(content="5")])
    out = create_agent(fake, tools=[add]).invoke({"messages": [{"role": "user", "content": "2+3?"}]})["messages"][-1].content
    t.log_outputs({"answer": out})
    assert out == "5"


def test_unmarked_log_call():
    t.log_outputs({"x": 1})
