import argparse
import asyncio
import json
import os
import random
import threading
import time
import warnings
from typing import Any

os.environ["LANGSMITH_TRACING"] = "false"
warnings.filterwarnings("ignore")

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, ToolMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from langchain_core.tools import StructuredTool

STAMPS = []
LOCK = threading.Lock()


def stamp(kind, cid, t0, t1):
    with LOCK:
        STAMPS.append({"kind": kind, "id": cid, "start": t0, "end": t1, "thread": threading.current_thread().name})


def sleep_sync(q: str) -> str:
    t0 = time.perf_counter_ns()
    time.sleep(0.2)
    stamp("sync", q, t0, time.perf_counter_ns())
    return "ok " + q


async def sleep_async(q: str) -> str:
    t0 = time.perf_counter_ns()
    await asyncio.sleep(0.2)
    stamp("async", q, t0, time.perf_counter_ns())
    return "ok " + q


TOOLS = {
    "sync": StructuredTool.from_function(func=sleep_sync, name="work", description="Do work."),
    "async": StructuredTool.from_function(coroutine=sleep_async, name="work", description="Do work."),
}


class FanOutModel(BaseChatModel):
    n_calls: int = 1

    def bind_tools(self, tools, **kw):
        return self

    def _reply(self, messages):
        if any(isinstance(m, ToolMessage) for m in messages):
            return AIMessage(content="done")
        return AIMessage(content="", tool_calls=[{"name": "work", "args": {"q": f"c{i}"}, "id": f"call_{i}", "type": "tool_call"}
                                                 for i in range(self.n_calls)])

    def _generate(self, messages, stop=None, run_manager=None, **kw):
        return ChatResult(generations=[ChatGeneration(message=self._reply(messages))])

    async def _agenerate(self, messages, stop=None, run_manager=None, **kw):
        return ChatResult(generations=[ChatGeneration(message=self._reply(messages))])

    @property
    def _llm_type(self):
        return "fanout"


def max_overlap(st):
    ev = sorted([(s["start"], 1) for s in st] + [(s["end"], -1) for s in st], key=lambda x: (x[0], x[1]))
    cur = best = 0
    for _, d in ev:
        cur += d
        best = max(best, cur)
    return best


def build(kind, tool_kind, n):
    tool = TOOLS[tool_kind]
    if kind == "agent":
        from langchain.agents import create_agent
        return create_agent(model=FanOutModel(n_calls=n), tools=[tool]), None
    from langgraph.graph import END, START, MessagesState, StateGraph
    from langgraph.prebuilt import ToolNode
    b = StateGraph(MessagesState)
    b.add_node("tools", ToolNode([tool]))
    b.add_edge(START, "tools")
    b.add_edge("tools", END)
    msg = AIMessage(content="", tool_calls=[{"name": "work", "args": {"q": f"c{i}"}, "id": f"call_{i}", "type": "tool_call"} for i in range(n)])
    return b.compile(), msg


def one(kind, mode, tool_kind, n, mc):
    graph, msg = build(kind, tool_kind, n)
    inp = {"messages": [msg]} if msg is not None else {"messages": [{"role": "user", "content": "go"}]}
    cfg = {} if mc is None else {"max_concurrency": mc}
    STAMPS.clear()
    err = None
    t0 = time.perf_counter_ns()
    out = None
    try:
        if mode == "invoke":
            out = graph.invoke(inp, cfg)
        else:
            out = asyncio.run(graph.ainvoke(inp, cfg))
    except Exception as e:
        err = f"{type(e).__name__}: {e}"[:300]
    t1 = time.perf_counter_ns()
    st = list(STAMPS)
    n_tm = sum(1 for m in (out or {}).get("messages", []) if isinstance(m, ToolMessage))
    rec = {"kind": kind, "mode": mode, "tool": tool_kind, "n_calls": n, "max_concurrency": mc, "wall_ms": (t1 - t0) / 1e6,
           "tool_span_ms": (max(s["end"] for s in st) - min(s["start"] for s in st)) / 1e6 if st else None,
           "max_overlap": max_overlap(st) if st else 0, "n_exec": len(st), "n_toolmsgs": n_tm,
           "threads": len({s["thread"] for s in st}), "error": err,
           "stamps": [[s["id"], round((s["start"] - t0) / 1e6, 2), round((s["end"] - t0) / 1e6, 2), s["thread"]] for s in st]}
    return rec


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--reps", type=int, default=5)
    p.add_argument("--out", required=True)
    p.add_argument("--kinds", default="agent,toolnode")
    a = p.parse_args()
    cells = [(k, m, t, n, mc) for k in a.kinds.split(",") for m in ("invoke", "ainvoke") for t in ("sync", "async")
             for n in (1, 2, 4, 8, 16) for mc in (None, 1, 2, 4, 8)]
    with open(a.out, "a") as fh:
        for rep in range(-1, a.reps):
            order = cells[:]
            random.Random(rep + 100).shuffle(order)
            load = os.getloadavg()
            for c in order:
                rec = one(*c)
                rec.update(rep=rep, warmup=rep < 0, load_block=load, cpu_count=os.cpu_count())
                fh.write(json.dumps(rec) + "\n")
                fh.flush()
            print("rep", rep, "load", load, flush=True)


if __name__ == "__main__":
    main()
