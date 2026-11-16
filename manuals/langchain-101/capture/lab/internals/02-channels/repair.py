import operator, sys, traceback, platform
from typing import Annotated, TypedDict
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import START, StateGraph
from langgraph.errors import InvalidUpdateError

OUT = []
def out(s=""):
    OUT.append(s); print(s)

class LV(TypedDict):
    x: int

class Fixed(TypedDict):
    x: Annotated[int, operator.add]

sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent.parent / "common"))
from real import TimedChatOllama, chat, settings, machine
MODEL = chat()
def digit(prompt):
    t = MODEL.invoke(prompt).text
    ds = [ch for ch in t if ch.isdigit()]
    return int(ds[0]) if ds else -1
ran = []
def a(s):
    ran.append("a"); return {"x": digit("Reply with only the digit 1.")}
def b(s):
    ran.append("b"); return {"x": digit("Reply with only the digit 2.")}

def build(schema, saver):
    g = StateGraph(schema)
    g.add_node("a", a); g.add_node("b", b)
    g.add_edge(START, "a"); g.add_edge(START, "b")
    return g.compile(checkpointer=saver)

def attempt(label, fn):
    try:
        r = fn()
        out(f"{label}: ok -> {r}")
    except Exception as e:
        out(f"{label}: raises {type(e).__name__}: {str(e).splitlines()[0][:90]}")

def poisoned(tid):
    saver = InMemorySaver()
    app = build(LV, saver)
    cfg = {"configurable": {"thread_id": tid}}
    try:
        app.invoke({"x": 0}, cfg)
    except InvalidUpdateError:
        pass
    return saver, app, cfg

import importlib.metadata as m
out(f"# Repairing a thread poisoned by a LastValue conflict, real model. langgraph {m.version('langgraph')}, langgraph-checkpoint {m.version('langgraph-checkpoint')}. {machine()}")
out(f"# model {settings()}")
out("graph: START -> a, START -> b; a asks the model for the digit 1 and returns {'x': it}, b the same for 2; x has no reducer; InMemorySaver")
out()
out("## 1. same graph, after the raise")
saver, app, cfg = poisoned("t1")
attempt("get_state", lambda: app.get_state(cfg).values)
attempt("update_state(cfg, {'x': 9})", lambda: app.update_state(cfg, {"x": 9}))
ran.clear()
attempt("invoke(None)", lambda: app.invoke(None, cfg))
out(f"node bodies run by invoke(None): {ran}; model calls so far {len(TimedChatOllama.calls)}")
attempt("invoke({'x': 5}) as a new turn", lambda: app.invoke({"x": 5}, cfg))
out()
out("## 2. same saver, graph recompiled with x: Annotated[int, operator.add]")
saver, app, cfg = poisoned("t2")
fixed = build(Fixed, saver)
attempt("get_state", lambda: fixed.get_state(cfg).values)
ran.clear()
attempt("invoke(None)", lambda: fixed.invoke(None, cfg))
out(f"node bodies run by invoke(None): {ran}; model calls so far {len(TimedChatOllama.calls)}")
out()
out("## 3. delete_thread and start again")
saver, app, cfg = poisoned("t3")
attempt("delete_thread", lambda: saver.delete_thread("t3"))
attempt("get_state", lambda: app.get_state(cfg).values)
out()
out("## 4. fork from the input checkpoint with the same graph")
saver, app, cfg = poisoned("t4")
hist = list(app.get_state_history(cfg))
out(f"history: {[(h.metadata['step'], h.metadata['source']) for h in hist]}")
first = hist[-1].config
ran.clear()
attempt("invoke(None, config of step -1)", lambda: app.invoke(None, first))
out(f"node bodies run: {ran}")
out()
out(f"model calls in this file: {len(TimedChatOllama.calls)}")
import pathlib
pathlib.Path(__file__).with_name("repair.txt").write_text("\n".join(OUT) + "\n")
