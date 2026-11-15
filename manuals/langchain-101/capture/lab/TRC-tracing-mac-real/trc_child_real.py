import json
import os
import sys
import time
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
n = int(sys.argv[1])
out = sys.argv[2]
flush = "--flush" in sys.argv
interleave = "--interleave" in sys.argv

t_import0 = time.perf_counter()
from langchain.agents import create_agent
from langchain_core.tools import tool
from langchain_ollama import ChatOllama
from langsmith import tracing_context
from mr_common import MODEL

import_ms = (time.perf_counter() - t_import0) * 1000


@tool
def add(a: int, b: int) -> int:
    """Add two integers."""
    return a + b


agent = create_agent(ChatOllama(model=MODEL, temperature=0, seed=42), tools=[add])
times = []
errors = []
for i in range(n):
    traced = None
    if interleave:
        traced = i % 2 == 0
    t0 = time.perf_counter()
    model_ns = 0
    calls = 0
    try:
        if interleave:
            with tracing_context(enabled=traced):
                res = agent.invoke({"messages": [{"role": "user", "content": "What is 2 + 3?"}]})
        else:
            res = agent.invoke({"messages": [{"role": "user", "content": "What is 2 + 3?"}]})
        ms = (time.perf_counter() - t0) * 1000
        for m in res["messages"]:
            if m.type == "ai":
                calls += 1
                model_ns += (m.response_metadata or {}).get("total_duration", 0)
        tools = [tc["name"] for m in res["messages"] if m.type == "ai" for tc in (m.tool_calls or [])]
        ok = "5" in res["messages"][-1].text and tools == ["add"]
        answer = res["messages"][-1].text[:80]
    except Exception as e:
        ms = (time.perf_counter() - t0) * 1000
        ok = False
        answer = None
        errors.append(f"{type(e).__name__}: {str(e)[:200]}")
    times.append({"i": i, "ms": ms, "ok": ok, "traced": traced, "model_calls": calls, "model_ms": model_ns / 1e6, "non_model_ms": ms - model_ns / 1e6, "answer": answer})
t_flush = None
if flush:
    from langchain_core.tracers.langchain import wait_for_all_tracers
    t1 = time.perf_counter()
    wait_for_all_tracers()
    t_flush = (time.perf_counter() - t1) * 1000
with open(out, "w") as f:
    json.dump({"env": {k: os.environ.get(k) for k in ["LANGSMITH_TRACING", "LANGSMITH_ENDPOINT", "LANGCHAIN_CALLBACKS_BACKGROUND"]},
               "n": n, "interleave": interleave, "import_ms": import_ms, "times": times, "errors": errors[:5], "n_errors": len(errors), "flush_ms": t_flush,
               "last_run_end_epoch": time.time()}, f)
