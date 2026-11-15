import argparse
import json
import os
import sqlite3
import sys
import time

os.environ["LANGSMITH_TRACING"] = "false"
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import psycopg

from lr_common import chat

A = None
DSN = os.environ.get("T02_PG", "postgresql:///lr2")
SYSTEM = ("You are a billing agent. To charge an order, call the charge tool once with the order id and the amount in dollars. "
          "After the tool answers, reply with one short sentence that confirms the charge.")


def signal(point):
    if A.phase == "run" and A.kill_point == point:
        print(f"REACHED {point}", flush=True)
        time.sleep(120)


def db():
    return psycopg.connect(DSN, autocommit=True)


def wrap_saver(base_cls):
    class Wrapped(base_cls):
        _seen_put = False
        _seen_writes = False

        def put_writes(self, config, writes, task_id, task_path=""):
            hit = any(c == "messages" and _has_tool_msg(v) for c, v in writes)
            if hit and not Wrapped._seen_writes:
                Wrapped._seen_writes = True
                signal("before_put_writes")
            return super().put_writes(config, writes, task_id, task_path)

        def put(self, config, checkpoint, metadata, new_versions):
            vals = checkpoint.get("channel_values", {})
            if _has_tool_msg(vals.get("messages") or []) and not Wrapped._seen_put:
                Wrapped._seen_put = True
                signal("before_put")
            return super().put(config, checkpoint, metadata, new_versions)

    return Wrapped


def _has_tool_msg(v):
    v = v if isinstance(v, list) else [v]
    return any(getattr(m, "type", None) == "tool" for m in v)


def build_agent(cp):
    from langchain.agents import create_agent
    from langchain.agents.middleware import AgentMiddleware
    from langchain.tools import ToolRuntime, tool

    conn = db()

    class LogModel(AgentMiddleware):
        def wrap_model_call(self, request, handler):
            n_tool = sum(1 for m in request.messages if m.type == "tool")
            if n_tool:
                signal("after_tool")
            t0 = time.time()
            resp = handler(request)
            t1 = time.time()
            ai = resp.result[-1] if hasattr(resp, "result") else resp
            calls = [[c["name"], c["args"], c.get("id")] for c in (getattr(ai, "tool_calls", None) or [])]
            usage = getattr(ai, "usage_metadata", None) or {}
            conn.execute("insert into t02r_model_calls(trial, phase, n_tool_in, t0, t1, tool_calls, content, in_tok, out_tok) values (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                         (A.trial, A.phase, n_tool, t0, t1, json.dumps(calls), str(ai.content)[:300], usage.get("input_tokens"), usage.get("output_tokens")))
            return resp

    @tool
    def charge(order_id: str, amount_usd: int, runtime: ToolRuntime) -> str:
        """Charge an order. Returns a receipt."""
        signal("before_tool")
        call_id = runtime.tool_call_id
        if A.key == "call_id":
            key = f"{A.thread}:{call_id}"
        elif A.key == "order":
            key = f"{A.thread}:{order_id}"
        else:
            key = None
        conn.execute("insert into t02r_attempts(trial, phase, call_id, order_id, amount, idem_key, t) values (%s,%s,%s,%s,%s,%s,%s)",
                     (A.trial, A.phase, call_id, str(order_id), amount_usd, key, time.time()))
        if key is None:
            conn.execute("insert into t02r_ledger(trial, phase, call_id, order_id, amount, t) values (%s,%s,%s,%s,%s,%s)",
                         (A.trial, A.phase, call_id, str(order_id), amount_usd, time.time()))
        else:
            conn.execute("insert into t02r_ledger(trial, phase, call_id, order_id, amount, t, idem_key) values (%s,%s,%s,%s,%s,%s,%s) on conflict (idem_key) do nothing",
                         (A.trial, A.phase, call_id, str(order_id), amount_usd, time.time(), key))
        signal("inside_tool")
        return f"charged order {order_id} for {amount_usd} USD"

    model = chat(num_predict=256)
    return create_agent(model, tools=[charge], system_prompt=SYSTEM, middleware=[LogModel()], checkpointer=cp)


def main():
    global A
    p = argparse.ArgumentParser()
    p.add_argument("--saver", choices=["sqlite", "postgres"], required=True)
    p.add_argument("--durability", choices=["sync", "async", "exit"], required=True)
    p.add_argument("--kill-point", required=True)
    p.add_argument("--phase", choices=["run", "resume"], required=True)
    p.add_argument("--thread", required=True)
    p.add_argument("--trial", required=True)
    p.add_argument("--db", default="")
    p.add_argument("--key", choices=["none", "call_id", "order"], default="none")
    p.add_argument("--order", default="4100")
    p.add_argument("--amount", type=int, default=25)
    A = p.parse_args()

    if A.saver == "sqlite":
        from langgraph.checkpoint.sqlite import SqliteSaver
        cp = wrap_saver(SqliteSaver)(sqlite3.connect(A.db, check_same_thread=False))
        ctx = None
    else:
        from langgraph.checkpoint.postgres import PostgresSaver
        ctx = wrap_saver(PostgresSaver).from_conn_string(DSN)
        cp = ctx.__enter__()
    cp.setup()
    app = build_agent(cp)
    cfg = {"configurable": {"thread_id": A.thread}}
    inp = {"messages": [{"role": "user", "content": f"Charge order {A.order} for {A.amount} dollars."}]}
    report = {"phase": A.phase}
    if A.phase == "run":
        app.invoke(inp, cfg, durability=A.durability)
        report["completed_without_kill"] = True
    else:
        st = app.get_state(cfg)
        hist = list(app.get_state_history(cfg))
        report["at_crash"] = {"history_len": len(hist), "next": list(st.next),
                              "steps": [h.metadata.get("step") for h in hist] if hist else [],
                              "has_checkpoint": st.config.get("configurable", {}).get("checkpoint_id") is not None,
                              "pending_tasks": [t.name for t in st.tasks]}
        if not report["at_crash"]["has_checkpoint"]:
            report["resume_action"] = "rerun_from_input"
            app.invoke(inp, cfg, durability=A.durability)
        else:
            report["resume_action"] = "invoke_none" if st.next else "invoke_none_with_empty_next"
            app.invoke(None, cfg, durability=A.durability)
        fin = app.get_state(cfg)
        report["final_messages"] = [[m.type, m.content if isinstance(m.content, str) else str(m.content),
                                     [[t["name"], t["args"], t.get("id")] for t in (getattr(m, "tool_calls", None) or [])]]
                                    for m in fin.values.get("messages", [])]
        report["final_next"] = list(fin.next)
        report["final_history_len"] = len(list(app.get_state_history(cfg)))
    if ctx:
        ctx.__exit__(None, None, None)
    print("REPORT " + json.dumps(report, default=str), flush=True)


if __name__ == "__main__":
    main()
