import argparse
import json
import operator
import os
import sqlite3
import sys
import time
from typing import Annotated, Any, TypedDict

os.environ["LANGSMITH_TRACING"] = "false"

from langgraph.graph import END, START, StateGraph

A = None


def signal(point):
    if A.phase == "run" and A.kill_point == point:
        print(f"REACHED {point}", flush=True)
        time.sleep(60)


def append_sink(line):
    with open(A.sink, "a") as fh:
        fh.write(line + "\n")
        fh.flush()
        os.fsync(fh.fileno())


def sink_has(key):
    if not os.path.exists(A.sink):
        return False
    return any(l.split("\t")[0] == key for l in open(A.sink).read().splitlines())


def wrap_saver(base_cls):
    class Wrapped(base_cls):
        _seen_put = False
        _seen_writes = False

        def put_writes(self, config, writes, task_id, task_path=""):
            if A.kind == "graph":
                hit = any(c == "log" and isinstance(v, list) and "effect" in v for c, v in writes)
            else:
                hit = any(c == "messages" and _has_tool_msg(v) for c, v in writes)
            if hit and not Wrapped._seen_writes:
                Wrapped._seen_writes = True
                signal("before_put_writes")
            return super().put_writes(config, writes, task_id, task_path)

        def put(self, config, checkpoint, metadata, new_versions):
            vals = checkpoint.get("channel_values", {})
            hit = ("effect" in (vals.get("log") or [])) if A.kind == "graph" else _has_tool_msg(vals.get("messages") or [])
            if hit and not Wrapped._seen_put:
                Wrapped._seen_put = True
                signal("before_put")
            return super().put(config, checkpoint, metadata, new_versions)

    return Wrapped


def _has_tool_msg(v):
    v = v if isinstance(v, list) else [v]
    return any(getattr(m, "type", None) == "tool" for m in v)


class S(TypedDict):
    log: Annotated[list[str], operator.add]


def build_graph(cp):
    def prepare(s):
        return {"log": ["prepare"]}

    def effect(s):
        signal("before_tool")
        key = f"{A.thread}:effect"
        if A.idem and sink_has(key):
            pass
        else:
            append_sink(f"{key}\t{A.phase}\t{time.time_ns()}")
        signal("inside_tool")
        return {"log": ["effect"]}

    def finish(s):
        signal("after_tool")
        return {"log": ["finish"]}

    g = StateGraph(S)
    g.add_node("prepare", prepare)
    g.add_node("effect", effect)
    g.add_node("finish", finish)
    g.add_edge(START, "prepare")
    g.add_edge("prepare", "effect")
    g.add_edge("effect", "finish")
    g.add_edge("finish", END)
    return g.compile(checkpointer=cp)


def build_agent(cp):
    from langchain.agents import create_agent
    from langchain.tools import tool, ToolRuntime
    from langchain_core.language_models import BaseChatModel
    from langchain_core.messages import AIMessage
    from langchain_core.outputs import ChatGeneration, ChatResult

    class Scripted(BaseChatModel):
        @property
        def _llm_type(self):
            return "scripted"

        def bind_tools(self, tools, **kw):
            return self

        def _generate(self, messages, stop=None, run_manager=None, **kw):
            with open(A.sink + ".model_calls", "a") as fh:
                fh.write(f"{A.phase}\n")
            n_tool = sum(1 for m in messages if m.type == "tool")
            if n_tool == 0:
                msg = AIMessage(content="", tool_calls=[{"name": "append_record", "args": {"item": "A"}, "id": "call_1"}])
            else:
                signal("after_tool")
                msg = AIMessage(content="done")
            return ChatResult(generations=[ChatGeneration(message=msg)])

    @tool
    def append_record(item: str, runtime: ToolRuntime) -> str:
        """Append a record to the ledger."""
        signal("before_tool")
        key = f"{A.thread}:{runtime.tool_call_id}"
        if not (A.idem and sink_has(key)):
            append_sink(f"{key}\t{A.phase}\t{time.time_ns()}")
        signal("inside_tool")
        return "ok"

    return create_agent(Scripted(), tools=[append_record], checkpointer=cp)


def main():
    global A
    p = argparse.ArgumentParser()
    p.add_argument("--kind", choices=["graph", "agent"], required=True)
    p.add_argument("--saver", choices=["sqlite", "postgres"], required=True)
    p.add_argument("--durability", choices=["sync", "async", "exit"], required=True)
    p.add_argument("--kill-point", required=True)
    p.add_argument("--phase", choices=["run", "resume"], required=True)
    p.add_argument("--thread", required=True)
    p.add_argument("--sink", required=True)
    p.add_argument("--db", default="")
    p.add_argument("--idem", action="store_true")
    A = p.parse_args()

    if A.saver == "sqlite":
        from langgraph.checkpoint.sqlite import SqliteSaver
        cls = wrap_saver(SqliteSaver)
        cp = cls(sqlite3.connect(A.db, check_same_thread=False))
        ctx = None
    else:
        from langgraph.checkpoint.postgres import PostgresSaver
        cls = wrap_saver(PostgresSaver)
        ctx = cls.from_conn_string("dbname=lc_lab")
        cp = ctx.__enter__()
    cp.setup()
    app = build_graph(cp) if A.kind == "graph" else build_agent(cp)
    cfg = {"configurable": {"thread_id": A.thread}}
    inp = {"log": []} if A.kind == "graph" else {"messages": [{"role": "user", "content": "record A"}]}
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
        if A.kind == "graph":
            report["final_values"] = fin.values
        else:
            report["final_values"] = {"messages": [[m.type, m.content if isinstance(m.content, str) else str(m.content)] for m in fin.values.get("messages", [])]}
        report["final_next"] = list(fin.next)
        report["final_history_len"] = len(list(app.get_state_history(cfg)))
    if ctx:
        ctx.__exit__(None, None, None)
    print("REPORT " + json.dumps(report, default=str), flush=True)


if __name__ == "__main__":
    main()
