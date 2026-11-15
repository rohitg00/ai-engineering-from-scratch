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
    from t21_agent import ask, make_agent

    t.log_inputs({"question": "What is 17 + 25?"})
    t.log_reference_outputs({"answer": "42"})
    out, _ = ask(make_agent(), "What is 17 + 25?")
    t.log_outputs({"answer": out})
    t.log_feedback(key="exact", score=int(out.strip() == "42"))
    assert out.strip() == "42"


def test_unmarked_log_call():
    t.log_outputs({"x": 1})
