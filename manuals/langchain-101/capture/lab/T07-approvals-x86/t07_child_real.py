import argparse
import json
import operator
import os
import sqlite3
import sys
from pathlib import Path
from typing import Annotated, TypedDict

os.environ["LANGSMITH_TRACING"] = "false"
sys.path.insert(0, str(Path(__file__).resolve().parent))
from lr_common import chat

from langchain.agents import create_agent
from langchain.agents.middleware import AgentMiddleware, HumanInTheLoopMiddleware, hook_config
from langchain.tools import tool
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.messages import AIMessage
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt

A = None


def log(kind, payload):
    with open(A.sink, "a") as fh:
        fh.write(json.dumps({"kind": kind, "phase": A.phase, "step": A.step, **payload}) + "\n")


class ModelLog(BaseCallbackHandler):
    def on_chat_model_start(self, serialized, messages, **kw):
        log("model_call", {"n_tool_msgs_in": sum(1 for m in messages[0] if m.type == "tool")})


@tool
def send_email(to: str) -> str:
    """Send an email to one address."""
    log("tool_exec", {"tool": "send_email", "args": {"to": to}})
    return f"sent to {to}"


@tool
def delete_file(path: str) -> str:
    """Delete one file by its path."""
    log("tool_exec", {"tool": "delete_file", "args": {"path": path}})
    return f"deleted {path}"


class Jumper(AgentMiddleware):
    @hook_config(can_jump_to=["tools"])
    def after_model(self, state, runtime):
        last_ai = next((m for m in reversed(state["messages"]) if isinstance(m, AIMessage)), None)
        if last_ai is not None and last_ai.tool_calls:
            log("jumper", {"jump_to": "tools"})
            return {"jump_to": "tools"}
        return None


def build_agent(cp, mode, jumper):
    hitl = HumanInTheLoopMiddleware(interrupt_on={"send_email": True, "delete_file": True}, interrupt_mode=mode)
    mw = [hitl]
    if jumper == "after_hitl_in_list":
        mw = [hitl, Jumper()]
    elif jumper == "before_hitl_in_list":
        mw = [Jumper(), hitl]
    return create_agent(chat(), tools=[send_email, delete_file], middleware=mw, checkpointer=cp)


class SubS(TypedDict):
    out: Annotated[list[str], operator.add]


def build_agent_in_subgraph(cp):
    from langgraph.graph import MessagesState
    agent = build_agent(None, "per_call", "none")
    parent = StateGraph(MessagesState)
    parent.add_node("agent", agent)
    parent.add_edge(START, "agent")
    parent.add_edge("agent", END)
    return parent.compile(checkpointer=cp)


def iv(it):
    return {"id": it.id, "value": it.value}


def main():
    global A
    p = argparse.ArgumentParser()
    p.add_argument("--app", required=True)
    p.add_argument("--mode", default="batched")
    p.add_argument("--jumper", default="none")
    p.add_argument("--db", required=True)
    p.add_argument("--sink", required=True)
    p.add_argument("--thread", required=True)
    p.add_argument("--phase", required=True)
    p.add_argument("--step", type=int, default=0)
    p.add_argument("--resume", default="")
    p.add_argument("--prompt", default="")
    p.add_argument("--strict", action="store_true")
    A = p.parse_args()
    cp = SqliteSaver(sqlite3.connect(A.db, check_same_thread=False))
    cp.setup()
    if A.app == "agent":
        app = build_agent(cp, A.mode, A.jumper)
    elif A.app == "agent_in_subgraph":
        app = build_agent_in_subgraph(cp)
    cfg = {"configurable": {"thread_id": A.thread}, "callbacks": [ModelLog()]}
    if A.strict:
        cfg["configurable"]["__pregel_strict_resume"] = True
    rep = {"phase": A.phase, "step": A.step}
    try:
        if A.phase == "start":
            r = app.invoke({"messages": [{"role": "user", "content": A.prompt}]}, cfg, version="v2")
        else:
            r = app.invoke(Command(resume=json.loads(A.resume)), cfg, version="v2")
        rep["interrupts"] = [iv(i) for i in r.interrupts]
        rep["ok"] = True
    except Exception as e:
        rep["ok"] = False
        rep["error"] = f"{type(e).__name__}: {str(e)[:500]}"
    st = app.get_state({"configurable": cfg["configurable"]})
    rep["next"] = list(st.next)
    vals = st.values
    rep["messages"] = [[m.type, m.content if isinstance(m.content, str) else str(m.content),
                        getattr(m, "status", None), [[t["name"], t["args"], t["id"]] for t in (getattr(m, "tool_calls", None) or [])],
                        getattr(m, "tool_call_id", None)] for m in vals.get("messages", [])]
    rep["pending_interrupts"] = [iv(i) for t in st.tasks for i in t.interrupts]
    print("REPORT " + json.dumps(rep, default=str), flush=True)


if __name__ == "__main__":
    main()
