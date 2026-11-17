import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lr_common import chat, header, jl, msgs_brief

from langchain.agents import create_agent
from langchain.tools import tool
from langchain_core.callbacks import BaseCallbackHandler
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.errors import GraphRecursionError

OUT = Path(__file__).resolve().parent
COUNT = {"model": 0, "tool": 0}
FOREVER = "Call the tool ping. Each time it answers, call ping again. Keep calling ping until it answers 'finished'. Do not stop on your own."
ONCE = "Call the tool ping once. After it returns, reply with the single word: final."


class C(BaseCallbackHandler):
    def on_chat_model_start(self, *a, **k):
        COUNT["model"] += 1


@tool
def ping() -> str:
    """Ping the service once."""
    COUNT["tool"] += 1
    return "pong. Not finished yet: call ping again."


@tool("ping")
def ping_once() -> str:
    """Ping the service once."""
    COUNT["tool"] += 1
    return "pong"


def reset():
    for k in COUNT:
        COUNT[k] = 0


def run_limit(label, agent, cfg):
    reset()
    t0 = time.time()
    rec = {"case": label}
    try:
        res = agent.invoke({"messages": [{"role": "user", "content": FOREVER}]}, {**cfg, "callbacks": [C()]})
        rec["result"] = "completed"
        rec["final"] = str(res["messages"][-1].content)[:200]
        rec["n_messages"] = len(res["messages"])
    except GraphRecursionError as e:
        rec["result"] = "GraphRecursionError"
        rec["message_first_line"] = str(e).splitlines()[0]
    rec["counts"] = dict(COUNT)
    rec["wall_s"] = round(time.time() - t0, 2)
    return rec


def hist_rows(app, cfg):
    return [{"checkpoint_id": h.config["configurable"]["checkpoint_id"], "step": h.metadata.get("step"), "source": h.metadata.get("source"),
             "next": list(h.next)} for h in app.get_state_history(cfg)]


def main():
    out = OUT / sys.argv[1]
    reps = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    jl(out, header("t17_real.py", forever_prompt=FOREVER, once_prompt=ONCE))
    agent = create_agent(chat(), tools=[ping])
    jl(out, {"case": "create_agent_bound_config", "config": json.loads(json.dumps(agent.config, default=str))})
    for rep in range(reps):
        for lim in (25, 101):
            r = run_limit(f"create_agent_forever_recursion_limit_{lim}", agent, {"recursion_limit": lim})
            r["rep"] = rep
            jl(out, r)
            print(json.dumps(r), flush=True)
    for rep in range(reps):
        cp = InMemorySaver()
        ag = create_agent(chat(), tools=[ping_once], checkpointer=cp)
        acfg = {"configurable": {"thread_id": f"ag{rep}"}}
        reset()
        res = ag.invoke({"messages": [{"role": "user", "content": ONCE}]}, {**acfg, "callbacks": [C()]})
        ah = hist_rows(ag, acfg)
        jl(out, {"case": "agent_initial_run", "rep": rep, "counts": dict(COUNT), "messages": msgs_brief(res["messages"]), "history": ah})
        print("initial", rep, COUNT, [h["next"] for h in ah], flush=True)
        for target_next, label in [(["model"], "agent_replay_from_first_next_model"), (["tools"], "agent_replay_from_next_tools")]:
            rows = [r for r in ah if r["next"] == target_next]
            if not rows:
                jl(out, {"case": label, "rep": rep, "skipped": "no checkpoint with that next"})
                continue
            row = rows[-1]
            reset()
            res2 = ag.invoke(None, {"configurable": {"thread_id": f"ag{rep}", "checkpoint_id": row["checkpoint_id"]}, "callbacks": [C()]})
            jl(out, {"case": label, "rep": rep, "from_step": row["step"], "counts": dict(COUNT), "final": str(res2["messages"][-1].content)[:200],
                     "same_final_as_first": str(res2["messages"][-1].content) == str(res["messages"][-1].content)})
            print(label, rep, row["step"], COUNT, flush=True)


if __name__ == "__main__":
    main()
