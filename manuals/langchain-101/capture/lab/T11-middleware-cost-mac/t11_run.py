import argparse
import json
import os
import random
import time
import warnings

os.environ["LANGSMITH_TRACING"] = "false"
warnings.filterwarnings("ignore")

from langchain.agents import create_agent
from langchain.agents.middleware import AgentMiddleware
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from langchain_core.tools import tool

CALLS = {"model": 0}


@tool
def echo(text: str) -> str:
    """Echo text."""
    return text


class FakeModel(BaseChatModel):
    def bind_tools(self, tools, **kw):
        return self

    def _generate(self, messages, stop=None, run_manager=None, **kw):
        CALLS["model"] += 1
        if isinstance(messages[-1], ToolMessage):
            msg = AIMessage(content="done")
        else:
            msg = AIMessage(content="", tool_calls=[{"name": "echo", "args": {"text": "hi"}, "id": "call_1", "type": "tool_call"}])
        return ChatResult(generations=[ChatGeneration(message=msg)])

    @property
    def _llm_type(self):
        return "fake-t11"


def _bm(self, state, runtime):
    return None


def _wm(self, request, handler):
    return handler(request)


def _wt(self, request, handler):
    return handler(request)


HOOKS = {"before_model": ("before_model", _bm), "after_model": ("after_model", _bm), "before_agent": ("before_agent", _bm),
         "wrap_model_call": ("wrap_model_call", _wm), "wrap_tool_call": ("wrap_tool_call", _wt)}
PER_RUN = {"before_model": 2, "after_model": 2, "before_agent": 1, "wrap_model_call": 2, "wrap_tool_call": 1}


def noop_stack(hook, k):
    attr, fn = HOOKS[hook]
    return [type(f"Noop_{hook}_{i}", (AgentMiddleware,), {attr: fn})() for i in range(k)]


def builtin(name):
    from langchain.agents.middleware import (HumanInTheLoopMiddleware, ModelCallLimitMiddleware, ModelRetryMiddleware,
                                             PIIMiddleware, SummarizationMiddleware, ToolCallLimitMiddleware,
                                             ToolRetryMiddleware)
    m = {
        "none": [],
        "summarization_nofire": [SummarizationMiddleware(model=FakeModel(), trigger=("tokens", 10_000_000))],
        "model_call_limit": [ModelCallLimitMiddleware(run_limit=1000)],
        "tool_call_limit": [ToolCallLimitMiddleware(run_limit=1000)],
        "pii_email": [PIIMiddleware("email", strategy="redact")],
        "pii_5types": [PIIMiddleware(t, strategy="redact") for t in ("email", "credit_card", "ip", "mac_address", "url")],
        "tool_retry": [ToolRetryMiddleware()],
        "model_retry": [ModelRetryMiddleware()],
        "hitl_nointerrupt": [HumanInTheLoopMiddleware(interrupt_on={"echo": False, "other_tool": True})],
    }
    if name == "stack5":
        return builtin("summarization_nofire") + builtin("pii_email") + builtin("model_call_limit") + builtin("tool_retry") + builtin("hitl_nointerrupt")
    return m[name]


def history(size):
    msgs = []
    for i in range(size // 2):
        msgs.append(HumanMessage(f"Question {i}: please review the notes of the meeting at 10.0.0.{i % 250} and reply to user{i}@example.com about item {i}. " * 2))
        msgs.append(AIMessage(f"Answer {i}: the notes say the budget for item {i} is fine and the team will follow up next week. " * 2))
    msgs.append(HumanMessage("go"))
    return msgs


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--suite", choices=["custom", "builtin"], required=True)
    p.add_argument("--blocks", type=int, default=6)
    p.add_argument("--per", type=int, default=50)
    p.add_argument("--warm", type=int, default=5)
    p.add_argument("--out", required=True)
    a = p.parse_args()
    cells = []
    if a.suite == "custom":
        cells.append(("none", 0, 2))
        for h in HOOKS:
            for k in (1, 3, 10, 20):
                cells.append((h, k, 2))
    else:
        for name in ("none", "summarization_nofire", "model_call_limit", "tool_call_limit", "pii_email", "pii_5types", "tool_retry",
                     "model_retry", "hitl_nointerrupt", "stack5"):
            for hs in (2, 60):
                cells.append((name, None, hs))
    agents = {}
    for c in cells:
        t0 = time.perf_counter_ns()
        mw = noop_stack(c[0], c[1]) if a.suite == "custom" and c[0] != "none" else (builtin(c[0]) if a.suite == "builtin" else [])
        ag = create_agent(model=FakeModel(), tools=[echo], middleware=mw)
        agents[c] = (ag, (time.perf_counter_ns() - t0) / 1e6, sorted(ag.get_graph().nodes))
    with open(a.out, "a") as fh:
        for b in range(a.blocks):
            order = cells[:]
            random.Random(b).shuffle(order)
            load = os.getloadavg()
            for c in order:
                ag, build_ms, nodes = agents[c]
                inp = {"messages": history(c[2]) if c[2] > 2 else [HumanMessage("go")]}
                walls = []
                cpus = []
                bad = 0
                for i in range(a.warm + a.per):
                    CALLS["model"] = 0
                    c0 = time.process_time_ns()
                    t0 = time.perf_counter_ns()
                    out = ag.invoke(inp)
                    t1 = time.perf_counter_ns()
                    c1 = time.process_time_ns()
                    if CALLS["model"] != 2 or out["messages"][-1].content != "done":
                        bad += 1
                    walls.append((t1 - t0) / 1e3)
                    cpus.append((c1 - c0) / 1e3)
                fh.write(json.dumps({"suite": a.suite, "cell": c[0], "k": c[1], "history": c[2], "block": b, "load": load,
                                     "warm": a.warm, "walls_us": walls, "cpus_us": cpus, "bad_runs": bad, "build_ms": build_ms,
                                     "n_nodes": len(nodes), "hook_calls_per_run": PER_RUN.get(c[0], 0) * (c[1] or 0)}) + "\n")
                fh.flush()
            print("block", b, load, flush=True)


if __name__ == "__main__":
    main()
