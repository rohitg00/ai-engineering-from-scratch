import json
import os
import sys
import time
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")
sys.path.insert(0, str(Path(__file__).resolve().parent))
n = int(sys.argv[1])
out = sys.argv[2]
flush = "--flush" in sys.argv

t_import0 = time.perf_counter()
from langchain.agents import create_agent
from langchain_core.messages import AIMessage
from langchain_core.tools import tool

from fake_tools import ToolFake


@tool
def add(a: int, b: int) -> int:
    """Add two integers."""
    return a + b


script = [AIMessage(content="", tool_calls=[{"name": "add", "args": {"a": 2, "b": 3}, "id": "c1", "type": "tool_call"}]), AIMessage(content="The sum is 5.")]
times = []
errors = []
for i in range(n):
    fake = ToolFake(script=list(script))
    agent = create_agent(fake, tools=[add])
    t0 = time.perf_counter()
    try:
        res = agent.invoke({"messages": [{"role": "user", "content": "What is 2 + 3?"}]})
        ok = res["messages"][-1].content == "The sum is 5."
    except Exception as e:
        ok = False
        errors.append(f"{type(e).__name__}: {str(e)[:200]}")
    times.append({"i": i, "ms": (time.perf_counter() - t0) * 1000, "ok": ok})
t_flush = None
if flush:
    from langchain_core.tracers.langchain import wait_for_all_tracers
    t1 = time.perf_counter()
    wait_for_all_tracers()
    t_flush = (time.perf_counter() - t1) * 1000
with open(out, "w") as f:
    json.dump({"env": {k: os.environ.get(k) for k in ["LANGSMITH_TRACING", "LANGSMITH_ENDPOINT", "LANGCHAIN_CALLBACKS_BACKGROUND"]},
               "n": n, "times": times, "errors": errors[:5], "n_errors": len(errors), "flush_ms": t_flush,
               "last_run_end_epoch": time.time()}, f)
