import json
import operator
import sys
from pathlib import Path
from typing import Annotated, TypedDict

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "common"))

from instrument import PIN, Recorder, instrument, summarize
from real import TimedChatOllama, chat, settings, machine
from langchain_core.tools import tool
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.config import get_config
from langgraph.graph import START, StateGraph
from langgraph.types import Command, interrupt
from xxhash import xxh3_128_hexdigest

OUT = []
LOG = []


def out(s=""):
    OUT.append(s)
    print(s)


class S(TypedDict):
    log: Annotated[list, operator.add]


def scratch():
    c = get_config()["configurable"]
    sp = c["__pregel_scratchpad"]
    return {"ns": c["checkpoint_ns"], "scratchpad.resume": list(sp.resume), "null_resume": sp.get_null_resume(False)}


MODEL = chat()


@tool
def get_weather(city: str) -> str:
    """Return the weather for a city."""
    return {"Oslo": "Oslo: 4 C, rain", "Paris": "Paris: 12 C, sunny"}.get(city, city + ": unknown")


def llm(node, prompt):
    r = MODEL.invoke(prompt)
    LOG.append({"node": node, "event": f"model call -> {r.text.strip()[:70]!r}", "model_s": round(TimedChatOllama.calls[-1]["model_s"], 2)})
    return r.text.strip()


def ask(state):
    LOG.append({"node": "ask", "event": "enter (first line)", **scratch()})
    q1 = llm("ask", "Write one short question that asks a traveller which city they want to visit. Reply with the question only.")
    a = interrupt({"q": q1})
    LOG.append({"node": "ask", "event": f"interrupt #0 returned {a!r}"})
    q2 = llm("ask", f"The traveller chose {a}. Write one short question that asks how many nights they will stay. Reply with the question only.")
    b = interrupt({"q": q2})
    LOG.append({"node": "ask", "event": f"interrupt #1 returned {b!r}"})
    return {"log": [f"ask:{a}/{b}"]}


def approve(state):
    LOG.append({"node": "approve", "event": "enter (first line)", **scratch()})
    q = llm("approve", "Write one short question that asks a manager to approve a travel budget of 900 EUR. Reply with the question only.")
    v = interrupt({"q": q})
    LOG.append({"node": "approve", "event": f"interrupt returned {v!r}"})
    return {"log": [f"approve:{v}"]}


def other(state):
    LOG.append({"node": "other", "event": "enter (side effect)"})
    w = get_weather.invoke({"city": "Oslo"})
    t = llm("other", f"Tool result: {w}. Summarise it in five words.")
    return {"log": [f"other:{t}"]}


def after(state):
    LOG.append({"node": "after", "event": "enter"})
    t = llm("after", "Reply with the single word: booked.")
    return {"log": [f"after:{t}"]}


def build():
    g = StateGraph(S)
    for n, f in (("ask", ask), ("approve", approve), ("other", other), ("after", after)):
        g.add_node(n, f)
    for n in ("ask", "approve", "other"):
        g.add_edge(START, n)
        g.add_edge(n, "after")
    saver = InMemorySaver()
    return g.compile(checkpointer=saver), saver


def dump_writes(saver, label):
    out(f"  saver.writes after {label}:")
    for (thread, ns, cid), d in saver.writes.items():
        for (tid, idx), (task_id, ch, (typ, blob), path) in sorted(d.items(), key=lambda kv: (kv[1][3], kv[0][1])):
            val = saver.serde.loads_typed((typ, blob))
            out(f"    ckpt=..{cid[-12:]} task={tid[:8]} idx={idx:>2} path={path!r:<32} {ch:<14} {summarize(val)}")


COUNTS = {}


def flush_log(label):
    COUNTS[label] = sum(1 for e in LOG if str(e.get("event", "")).startswith("model call"))
    out(f"  node log during {label}:")
    for e in LOG:
        out("    " + json.dumps(e, default=str))
    LOG.clear()


def main():
    out(f"# Interrupt and resume, real model. pin {PIN}. {machine()}")
    out(f"# model {settings()}")
    out("graph: START -> {ask, approve, other} -> after. ask calls the model, interrupt(), the model, interrupt(); approve calls the model, then interrupt(); other calls get_weather and the model, never interrupts; after calls the model. Each model call is logged.")
    out()
    app, saver = build()
    cfg = {"configurable": {"thread_id": "i"}}
    rec = Recorder()
    with instrument(rec):
        r1 = app.invoke({"log": []}, cfg)
    out("## run 1: invoke(input)")
    ints = r1["__interrupt__"]
    for i in ints:
        out(f"  returned interrupt id={i.id} value={i.value}")
    flush_log("run 1")
    dump_writes(saver, "run 1")
    st = app.get_state(cfg)
    out(f"  get_state.next={st.next}; tasks={[(t.name, t.id[:8], [x.id[:12] for x in t.interrupts]) for t in st.tasks]}")
    for t in st.tasks:
        if t.name in ("ask", "approve"):
            ns = f"{t.name}:{t.id}"
            out(f"  recompute id for {t.name}: xxh3_128(task_checkpoint_ns={ns!r}) = {xxh3_128_hexdigest(ns.encode())[:12]}... matches={xxh3_128_hexdigest(ns.encode()) == t.interrupts[0].id}")
    out()

    out("## run 2a: Command(resume='yes') without an id while 2 interrupts are pending")
    try:
        app.invoke(Command(resume="yes"), cfg)
    except Exception as e:
        out(f"  raises {type(e).__name__}: {str(e)[:140]}")
    flush_log("run 2a")
    out()

    by_name = {t.name: t for t in st.tasks}
    ask_id = by_name["ask"].interrupts[0].id
    appr_id = by_name["approve"].interrupts[0].id
    out("## run 2b: Command(resume={ask_id: 'A1', approve_id: 'OK'})")
    rec2 = Recorder()
    with instrument(rec2):
        r2 = app.invoke(Command(resume={ask_id: "A1", appr_id: "OK"}), cfg)
    flush_log("run 2b")
    ticks = [e for e in rec2.events if e["event"] == "tick"]
    for e in ticks:
        out(f"  tick step={e['step']} returns={e['returns']} to_run={[t['name'] for t in e['tasks_to_run']]} reapplied(no rerun)={[t['name'] for t in e['tasks_with_reapplied_writes']]}")
    for i in r2.get("__interrupt__", ()):
        out(f"  returned interrupt id={i.id} value={i.value}")
    ask_task = [t for t in app.get_state(cfg).tasks if t.name == "ask"][0]
    ns = f"ask:{ask_task.id}"
    out(f"  second interrupt id expected = xxh3_128(ns + '|1') = {xxh3_128_hexdigest((ns + '|1').encode())[:12]}... matches={xxh3_128_hexdigest((ns + '|1').encode()) == ask_task.interrupts[0].id}")
    dump_writes(saver, "run 2b")
    out()

    out("## run 3: Command(resume='A2') (only one interrupt pending now, no id needed)")
    r3 = app.invoke(Command(resume="A2"), cfg)
    flush_log("run 3")
    out(f"  final log: {r3['log']}")
    out()
    out(f"## model calls per invocation: {COUNTS}")
    hist = list(app.get_state_history(cfg))
    out("## checkpoint history (newest first)")
    for h in hist:
        out(f"  step={h.metadata['step']} source={h.metadata['source']} next={h.next} id=..{h.config['configurable']['checkpoint_id'][-12:]}")
    rec.dump(HERE / "run1.trace.jsonl")
    rec2.dump(HERE / "run2b.trace.jsonl")
    (HERE / "trace.txt").write_text("\n".join(OUT) + "\n")


if __name__ == "__main__":
    main()
