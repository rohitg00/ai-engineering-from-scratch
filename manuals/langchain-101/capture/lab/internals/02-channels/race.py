import json
import sys
import time
from pathlib import Path
from typing import Annotated, TypedDict

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "common"))
from real import TimedChatOllama, chat, settings, machine
from langchain_core.messages import AIMessage
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import START, StateGraph
from langgraph.graph.message import add_messages

MODEL = chat()


class MsgState(TypedDict):
    messages: Annotated[list, add_messages]


def main(label, n):
    seen_model_ids = []

    def node(s):
        r = MODEL.invoke("Say OK.")
        seen_model_ids.append(r.id)
        return {"messages": [r, AIMessage(content="copied: " + r.text)]}

    g = StateGraph(MsgState)
    g.add_node("n", node)
    g.add_edge(START, "n")
    counts = {"model reply saved with id": 0, "model reply saved without id": 0,
              "copied text saved with id": 0, "copied text saved without id": 0,
              "input dict saved without id": 0, "input other": 0}
    t0 = time.time()
    for i in range(n):
        saver = InMemorySaver()
        app = g.compile(checkpointer=saver)
        app.invoke({"messages": [{"role": "user", "content": "Say OK."}]}, {"configurable": {"thread_id": str(i)}})
        for v in saver.writes.values():
            for (task_id, ch, (typ, blob), path) in v.values():
                if ch != "messages":
                    continue
                val = saver.serde.loads_typed((typ, blob))
                for m in val:
                    if isinstance(m, dict):
                        counts["input dict saved without id" if "id" not in m else "input other"] += 1
                    elif str(m.text).startswith("copied: "):
                        counts["copied text saved with id" if m.id else "copied text saved without id"] += 1
                    else:
                        counts["model reply saved with id" if m.id else "model reply saved without id"] += 1
    res = {"label": label, "n_runs": n, "counts": counts, "model replies with an id at return": sum(1 for x in seen_model_ids if x),
           "wall_s": round(time.time() - t0), "model_s_median": sorted(c["model_s"] for c in TimedChatOllama.calls)[len(TimedChatOllama.calls) // 2],
           "settings": settings(), "machine": machine()}
    lines = [f"# D2. add_messages id race, real model. {label}: n={n} runs, InMemorySaver, durability=async (default)",
             f"# {machine()}", f"# model {settings()}",
             "node: r = model.invoke('Say OK.'); return {'messages': [r, AIMessage(content='copied: ' + r.text)]}. The second message has no id.",
             "count: the saved pending write of task n, per message, read back from InMemorySaver.writes after the run.",
             f"  {json.dumps(counts)}",
             f"  model replies that carried an id when the node returned: {res['model replies with an id at return']}/{n}",
             f"  wall {res['wall_s']} s, median model call {res['model_s_median']:.2f} s"]
    print("\n".join(lines), flush=True)
    (HERE / f"race_{label}.txt").write_text("\n".join(lines) + "\n")
    (HERE / f"race_{label}.json").write_text(json.dumps(res, indent=1))


if __name__ == "__main__":
    main(sys.argv[1], int(sys.argv[2]))
