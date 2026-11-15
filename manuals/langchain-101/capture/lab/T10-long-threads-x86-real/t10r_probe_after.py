import json
import os
import sys
import time

os.environ["LANGSMITH_TRACING"] = "false"
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from langchain.agents import create_agent
from langgraph.checkpoint.postgres import PostgresSaver

import t10r_long as T
from lr_common import header, jl, chat


def main():
    tid, out = sys.argv[1], sys.argv[2]
    model = chat(num_predict=160, num_ctx=8192)
    jl(out, header("t10r_probe_after.py", thread=tid, num_predict=160, num_ctx=8192, note="recall probes on the last checkpoint of a thread that stopped at its deadline"))
    with PostgresSaver.from_conn_string(T.DSN) as cp:
        agent = create_agent(model, tools=[T.add], system_prompt=T.SYSTEM, middleware=[T.LogModel()], checkpointer=cp)
        st = agent.get_state({"configurable": {"thread_id": tid}})
        ck = st.config["configurable"]["checkpoint_id"]
        probes = []
        for name, _, q, keys in T.FACTS:
            T.REC.reset()
            t1 = time.perf_counter()
            po = agent.invoke({"messages": [{"role": "user", "content": q}]}, {"configurable": {"thread_id": tid, "checkpoint_id": ck}})
            ans = str(po["messages"][-1].content)
            probes.append({"fact": name, "answer": ans[:160], "correct": any(k in ans.lower().replace(",", "") or k in ans.lower() for k in keys),
                           "ms": round((time.perf_counter() - t1) * 1000, 1), "calls": T.REC.calls})
            print(probes[-1], flush=True)
        jl(out, {"exp": "T10r", "variant": "none", "kind": "probe_after_deadline", "state_msgs": len(st.values.get("messages", [])), "probes": probes, "recall": sum(p["correct"] for p in probes)})


if __name__ == "__main__":
    main()
