import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lr_common import chat, header, jl

from langchain.agents import create_agent
from langchain.tools import tool
from langchain_core.callbacks import BaseCallbackHandler

OUT = Path(__file__).resolve().parent
CAP_S = float(sys.argv[2]) if len(sys.argv) > 2 else 1200.0
FOREVER = "Call the tool ping. Each time it answers, call ping again. Keep calling ping until it answers 'finished'. Do not stop on your own."
C = {"model": 0, "tool": 0, "t0": 0.0, "stamps": []}


class Stop(Exception):
    pass


class CB(BaseCallbackHandler):
    def on_chat_model_start(self, *a, **k):
        C["model"] += 1


@tool
def ping() -> str:
    """Ping the service once."""
    C["tool"] += 1
    el = time.time() - C["t0"]
    if C["tool"] % 25 == 0:
        C["stamps"].append([C["tool"], round(el, 1)])
    if el > CAP_S:
        raise Stop(f"wall-clock cap of {CAP_S} s reached by the lab script")
    return "pong. Not finished yet: call ping again."


def main():
    out = OUT / sys.argv[1]
    jl(out, header("t17_nolimit.py", prompt=FOREVER, cap_s=CAP_S, note="no recursion_limit in the config; the tool raises after the cap"))
    agent = create_agent(chat(), tools=[ping])
    C["t0"] = time.time()
    rec = {"case": "create_agent_forever_no_config_capped"}
    try:
        res = agent.invoke({"messages": [{"role": "user", "content": FOREVER}]}, {"callbacks": [CB()]})
        rec["result"] = "completed"
        rec["final"] = str(res["messages"][-1].content)[:300]
    except Stop as e:
        rec["result"] = f"Stop: {e}"
    except Exception as e:
        rec["result"] = f"{type(e).__name__}: {str(e)[:300]}"
    rec.update(model_calls=C["model"], tool_calls=C["tool"], wall_s=round(time.time() - C["t0"], 1), tool_call_stamps=C["stamps"])
    jl(out, rec)
    print(rec, flush=True)


if __name__ == "__main__":
    main()
