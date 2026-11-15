import operator
import sys
import traceback
from pathlib import Path
from typing import Annotated, TypedDict

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "common"))

from instrument import PIN, Recorder, instrument, summarize
from real import TimedChatOllama, chat, settings, machine
from langchain_core.tools import tool

MODEL = chat()


@tool
def get_weather(city: str) -> str:
    """Return the weather for a city."""
    return {"Oslo": "Oslo: 4 C, rain", "Paris": "Paris: 12 C, sunny", "Rome": "Rome: 18 C, sunny"}.get(city, city + ": unknown")


def llm(prompt):
    return MODEL.invoke(prompt).text.strip()
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.pregel import _retry
from langgraph.types import Command, Send

OUT = []


def out(s=""):
    OUT.append(s)
    print(s)


def show(rec, label):
    out(f"## {label}")
    for e in rec.events:
        k = e["event"]
        if k == "prepare_next_tasks" and e["for_execution"] and e["tasks"]:
            out(f"  PLAN step={e['step']}: " + "; ".join(f"{t['kind'].replace('__pregel_', '')} {t['name']} path={t['path']} triggers={t['triggers']} id={t['id']}" for t in e["tasks"]))
        elif k == "loop.put_writes":
            out(f"    done {e['task']:<8} writes={e['writes']}")
        elif k == "apply_writes" and e["writes_in_apply_order"]:
            out(f"  UPDATE order={e['task_order']} -> updated={e['updated_channels']} versions={e['versions_changed']}")
    out()


class S(TypedDict):
    results: Annotated[list, operator.add]
    route: str


def part_a_send():
    def fan(state):
        cities = llm("List exactly three European capital cities, comma separated, nothing else.")
        return {"route": cities}

    def router(state):
        cities = [c.strip() for c in state["route"].split(",") if c.strip()][:5]
        return [Send("work", {"x": c, "note": "Send.arg is the task input, not graph state"}) for c in cities]

    def work(arg):
        return {"results": [f"work({arg['x']}): " + llm(f"Give one fact about {arg['x']} in at most eight words.")[:60]]}

    g = StateGraph(S)
    g.add_node("fan", fan)
    g.add_node("work", work)
    g.add_edge(START, "fan")
    g.add_conditional_edges("fan", router, ["work"])
    rec = Recorder()
    with instrument(rec):
        r = g.compile(checkpointer=InMemorySaver()).invoke({"results": [], "route": ""}, {"configurable": {"thread_id": "a"}})
    show(rec, "A. Send from a conditional edge -> PUSH tasks next superstep")
    out(f"  result={r}")
    out()


def part_b_command_goto():
    def a(state):
        city = llm("Pick one of Oslo, Paris, Rome. Reply with the city name only.").strip(" .")
        return Command(goto=["b", Send("c", {"x": city})], update={"route": "a->b", "results": [f"a picked {city}"]})

    def b(state):
        return {"results": ["b: " + llm("Reply with the single word: ready.")]}

    def c(arg):
        return {"results": [f"c({arg['x']}): " + get_weather.invoke({"city": arg["x"]})]}

    g = StateGraph(S)
    g.add_node("a", a, destinations=("b", "c"))
    g.add_node("b", b)
    g.add_node("c", c)
    g.add_edge(START, "a")
    rec = Recorder()
    with instrument(rec):
        r = g.compile(checkpointer=InMemorySaver()).invoke({"results": [], "route": ""}, {"configurable": {"thread_id": "b"}})
    show(rec, "B. Command(goto=['b', Send('c', ...)], update=...) returned by a node")
    out(f"  result={r}")
    out()


class P(TypedDict):
    results: Annotated[list, operator.add]
    route: str


def part_c_parent():
    def child_step(state):
        verdict = llm("A customer writes: 'I was charged twice and nobody answers.' Reply with one word, ESCALATE or HANDLE.")
        return Command(graph=Command.PARENT, goto="escalate", update={"route": "from child", "results": [f"child said {verdict}"]})

    child = StateGraph(P)
    child.add_node("child_step", child_step)
    child.add_edge(START, "child_step")
    child_app = child.compile()

    def escalate(state):
        return {"results": ["escalate ran: " + llm("Write a five-word apology to a customer.")[:60]]}

    parent = StateGraph(P)
    parent.add_node("sub", child_app, destinations=("escalate",))
    parent.add_node("escalate", escalate)
    parent.add_edge(START, "sub")

    caught = []
    orig = _retry.run_with_retry

    def spy(task, retry_policy, configurable=None):
        try:
            return orig(task, retry_policy, configurable)
        except BaseException as e:
            caught.append((task.name, type(e).__name__, summarize(e.args[0]) if e.args else None))
            raise

    from langgraph.pregel import _runner
    _runner.run_with_retry = spy
    rec = Recorder()
    try:
        with instrument(rec):
            r = parent.compile(checkpointer=InMemorySaver()).invoke({"results": [], "route": ""}, {"configurable": {"thread_id": "c"}})
    finally:
        _runner.run_with_retry = orig
    show(rec, "C. Command(graph=Command.PARENT, goto='escalate') from inside a subgraph")
    out(f"  exceptions leaving run_with_retry: {caught}")
    out(f"  result={r}")
    out()

    out("## C2. Command(graph=PARENT) at the top level")
    def lone(state):
        llm("Reply with the single word: hi.")
        return Command(graph=Command.PARENT, goto="x")
    g = StateGraph(P)
    g.add_node("lone", lone)
    g.add_edge(START, "lone")
    try:
        g.compile().invoke({"results": [], "route": ""})
    except BaseException as e:
        fr = [f for f in traceback.extract_tb(e.__traceback__) if "langgraph" in f.filename][-3:]
        out(f"  raises {type(e).__name__}: {str(e)[:100]} at {[f'{x.filename.split(chr(47))[-1]}:{x.lineno}' for x in fr]}")
    out()


def part_d_command_input():
    def a(state):
        return {"results": ["a: " + llm("Reply with the single word: alpha.")]}

    def b(state):
        return {"results": ["b: " + llm("Reply with the single word: beta.")]}

    g = StateGraph(S)
    g.add_node("a", a)
    g.add_node("b", b)
    g.add_edge(START, "a")
    app = g.compile(checkpointer=InMemorySaver())
    cfg = {"configurable": {"thread_id": "d"}}
    app.invoke({"results": [], "route": ""}, cfg)
    rec = Recorder()
    with instrument(rec):
        r = app.invoke(Command(goto="b", update={"route": "jumped"}), cfg)
    out("## D. Command(goto='b', update=...) as graph input on an existing thread")
    for e in rec.events:
        if e["event"] == "loop.put_writes":
            out(f"    loop.put_writes task={e['task']} writes={e['writes']}")
        if e["event"] == "apply_writes" and e["task_order"] == ["__input__@()"]:
            out(f"    applied in _first before any tick: {e['writes_in_apply_order']} -> {e['updated_channels']}")
        if e["event"] == "prepare_next_tasks" and e["for_execution"] and e["tasks"]:
            out(f"    PLAN step={e['step']}: {[t['name'] for t in e['tasks']]}")
    out(f"  result={r}")
    out()


def main():
    out(f"# Send and Command, real model. pin {PIN}. {machine()}")
    out(f"# model {settings()}; every node below calls the model or a tool (see run.py)")
    out()
    part_a_send()
    part_b_command_goto()
    part_c_parent()
    part_d_command_input()
    out(f"model calls: {len(TimedChatOllama.calls)}, provider seconds {[round(c['model_s'], 2) for c in TimedChatOllama.calls]}")
    (HERE / "trace.txt").write_text("\n".join(OUT) + "\n")


if __name__ == "__main__":
    main()
