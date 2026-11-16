import json
import sys
import time
from pathlib import Path
from typing import Annotated, TypedDict

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "common"))
from real import machine
from langchain_core.messages import AIMessage
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import START, StateGraph
from langgraph.graph.message import add_messages


class MsgState(TypedDict):
    messages: Annotated[list, add_messages]


def main(label, n, delay):
    def node(s):
        if delay:
            time.sleep(delay)
        return {"messages": [AIMessage(content="copied: OK")]}

    g = StateGraph(MsgState)
    g.add_node("n", node)
    g.add_edge(START, "n")
    counts = {"with id": 0, "without id": 0}
    for i in range(n):
        saver = InMemorySaver()
        app = g.compile(checkpointer=saver)
        app.invoke({"messages": [{"role": "user", "content": "Say OK."}]}, {"configurable": {"thread_id": str(i)}})
        for v in saver.writes.values():
            for (task_id, ch, (typ, blob), path) in v.values():
                if ch == "messages":
                    for m in saver.serde.loads_typed((typ, blob)):
                        if not isinstance(m, dict):
                            counts["with id" if m.id else "without id"] += 1
    lines = [f"# D2 control, NO MODEL INVOLVED: the node returns AIMessage('copied: OK') without an id, after sleep({delay}). {label}: n={n}, InMemorySaver, durability=async",
             f"# {machine()}", f"  {json.dumps(counts)}"]
    print("\n".join(lines), flush=True)
    (HERE / f"race_control_{label}.txt").write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    main(sys.argv[1], int(sys.argv[2]), float(sys.argv[3]))
