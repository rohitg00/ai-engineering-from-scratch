import json
import operator
import sqlite3
import sys
import time
import traceback
from pathlib import Path
from typing import Annotated, Any, TypedDict

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "common"))

from instrument import PIN, Recorder, instrument, summarize
from real import TimedChatOllama, chat, settings, machine

MODEL = chat()


def llm(prompt):
    return MODEL.invoke(prompt).text.strip()


def digit(prompt):
    t = llm(prompt)
    ds = [ch for ch in t if ch.isdigit()]
    return int(ds[0]) if ds else -1
from langchain_core.messages import AIMessage, HumanMessage, RemoveMessage
from langgraph.channels.binop import BinaryOperatorAggregate
from langgraph.channels.delta import DeltaChannel
from langgraph.channels.ephemeral_value import EphemeralValue
from langgraph.channels.last_value import LastValue, LastValueAfterFinish
from langgraph.channels.named_barrier_value import NamedBarrierValue
from langgraph.channels.topic import Topic
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.errors import InvalidUpdateError
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import _messages_delta_reducer, add_messages
from langgraph.types import Overwrite

OUT = []


def out(s=""):
    OUT.append(s)
    print(s)


def probe(ch, label, seq):
    out(f"## {label}")
    for step, vals in seq:
        try:
            r = ch.update(vals) if step == "update" else getattr(ch, step)()
            res = f"returns {r}"
        except Exception as e:
            res = f"RAISES {type(e).__name__}: {str(e).splitlines()[0][:110]}"
        try:
            g = ch.get()
        except Exception as e:
            g = f"<{type(e).__name__}>"
        cp = ch.checkpoint()
        out(f"  {step}({vals if step == 'update' else ''}) -> {res}; available={ch.is_available()} get={summarize(g)} checkpoint()={summarize(cp)}")
    out()


def part_a_direct():
    out("# A. Channel semantics, driven directly (update = what apply_writes calls once per superstep). No model involved: this part calls the channel classes only.")
    probe(LastValue(int, "x"), "LastValue", [("update", [1]), ("update", []), ("update", [2, 3])])
    probe(BinaryOperatorAggregate(list, operator.add), "BinaryOperatorAggregate(list, operator.add)",
          [("update", [[1]]), ("update", [[2], [3]]), ("update", []), ("update", [Overwrite([9]), [10]]), ("update", [Overwrite([1]), Overwrite([2])])])
    probe(Topic(str, accumulate=False), "Topic(accumulate=False)  (used for __pregel_tasks)",
          [("update", ["s1", "s2"]), ("update", []), ("update", [])])
    probe(Topic(str, accumulate=True), "Topic(accumulate=True)", [("update", ["s1"]), ("update", []), ("update", [["s2", "s3"]])])
    probe(EphemeralValue(Any, guard=True), "EphemeralValue(guard=True)  (START channel)", [("update", ["v"]), ("update", []), ("update", ["a", "b"])])
    probe(EphemeralValue(Any, guard=False), "EphemeralValue(guard=False)  (branch:to:<node>)", [("update", [None, None]), ("update", []), ("update", [])])
    probe(LastValueAfterFinish(Any), "LastValueAfterFinish  (branch:to:<node> when defer=True)", [("update", [None]), ("consume", None), ("finish", None), ("consume", None)])
    probe(NamedBarrierValue(str, {"a", "b"}), "NamedBarrierValue({a,b})  (join:a+b:c)", [("update", ["a"]), ("update", ["b"]), ("consume", None)])
    d = DeltaChannel(_messages_delta_reducer, list, snapshot_frequency=2)
    d = d.from_checkpoint(_MISSING())
    probe(d, "DeltaChannel(_messages_delta_reducer)", [("update", [[HumanMessage("hi", id="h1")]]), ("update", [[AIMessage("v1", id="a1")], [AIMessage("v2", id="a1")]])])


def _MISSING():
    from langgraph._internal._typing import MISSING
    return MISSING


class LVState(TypedDict):
    x: int


def part_b_lastvalue_conflict():
    out("# B. Two parallel nodes write the same LastValue key. a asks the model for the digit 1, b for the digit 2.")
    n0 = len(TimedChatOllama.calls)
    ran = []

    def a(s):
        ran.append("a")
        return {"x": digit("Reply with only the digit 1.")}

    def b(s):
        ran.append("b")
        return {"x": digit("Reply with only the digit 2.")}

    g = StateGraph(LVState)
    g.add_node("a", a)
    g.add_node("b", b)
    g.add_edge(START, "a")
    g.add_edge(START, "b")
    saver = InMemorySaver()
    app = g.compile(checkpointer=saver)
    cfg = {"configurable": {"thread_id": "lv"}}
    rec = Recorder()
    try:
        with instrument(rec):
            app.invoke({"x": 0}, cfg)
    except InvalidUpdateError as e:
        tb = traceback.extract_tb(e.__traceback__)
        out(f"raised {type(e).__name__}: {str(e).splitlines()[0]}")
        out("frames (innermost last, langgraph files only):")
        for fr in tb:
            if "langgraph" in fr.filename:
                out(f"  {fr.filename.split('site-packages/')[-1]}:{fr.lineno} in {fr.name}")
    out(f"node bodies that ran before the raise: {ran}")
    pw = [e for e in rec.events if e["event"] == "loop.put_writes"]
    out(f"loop.put_writes calls before the raise (writes already persisted as pending): {[(e['task'], e['writes']) for e in pw]}")
    try:
        st = app.get_state(cfg)
        out(f"get_state after the raise: values={st.values} next={st.next}")
    except InvalidUpdateError as e:
        fr = [f for f in traceback.extract_tb(e.__traceback__) if "langgraph" in f.filename]
        out(f"get_state after the raise ALSO raises {type(e).__name__} via {[f'{x.filename.split(chr(47))[-1]}:{x.lineno}' for x in fr]}")
    try:
        hist = list(app.get_state_history(cfg))
        out(f"get_state_history: {len(hist)} snapshots")
    except InvalidUpdateError as e:
        out(f"get_state_history raises {type(e).__name__} too")
    latest = saver.get_tuple(cfg)
    out(f"raw saver.get_tuple works: checkpoint step={latest.metadata['step']} pending_writes={[(w[0][:8], w[1], w[2]) for w in latest.pending_writes]}")
    stored = {k: [(w[0][:8], w[1]) for w in v.values()] for k, v in saver.writes.items()}
    out(f"saver.writes (task_id, channel) per checkpoint: {json.dumps({str(k[2])[-12:]: v for k, v in stored.items()})}")
    ran.clear()
    try:
        app.invoke(None, cfg)
    except InvalidUpdateError as e:
        out(f"invoke(None) resume raises again: {type(e).__name__}; node bodies re-run on resume: {ran} (empty means the saved writes were reapplied, not re-executed)")
    out(f"model calls in part B: {len(TimedChatOllama.calls) - n0}")
    out()


class AddState(TypedDict):
    items: Annotated[list, operator.add]


def part_c_reducer_order():
    out("# C. Reducer order is task-path order, not finish order. Both nodes call the model; the slow node asks for a 60-word answer, the other for one word. 3 runs per case.")
    for slow in ("a", "a", "a", "b", "b", "b"):
        finished = []

        def mk(name):
            def f(s):
                t0 = time.perf_counter()
                if name == slow:
                    llm("Describe a lighthouse in about 60 words.")
                else:
                    llm("Reply with the single word: yes.")
                finished.append((name, round(time.perf_counter() - t0, 2)))
                return {"items": [name]}
            return f

        g = StateGraph(AddState)
        g.add_node("a", mk("a"))
        g.add_node("b", mk("b"))
        g.add_edge(START, "a")
        g.add_edge(START, "b")
        r = g.compile().invoke({"items": []})
        out(f"slow node={slow}: finish order (node, model seconds)={finished}  merged list={r['items']}")
    out("apply_writes sorts tasks by writes_sort_key(task_path_str(t.path)) before calling update(), so the merge order is fixed by (PULL, node name) / (PUSH, index).")
    out()


class MsgState(TypedDict):
    messages: Annotated[list, add_messages]


def part_d_add_messages():
    out("# D. add_messages merges by id. n1-n3 write fixed messages with fixed ids; n4 wraps the text of a real model reply in a new AIMessage without an id.")
    steps = [
        ("n1", lambda s: {"messages": [AIMessage("draft v1", id="m1")]}),
        ("n2", lambda s: {"messages": [AIMessage("draft v2 (same id m1)", id="m1"), AIMessage("other", id="m2")]}),
        ("n3", lambda s: {"messages": [RemoveMessage(id="m2")]}),
        ("n4", lambda s: {"messages": [AIMessage(llm("Reply with the words: no id given."))]}),
    ]
    g = StateGraph(MsgState)
    prev = START
    for name, fn in steps:
        g.add_node(name, fn)
        g.add_edge(prev, name)
        prev = name
    saver = InMemorySaver()
    app = g.compile(checkpointer=saver)
    cfg = {"configurable": {"thread_id": "m"}}
    for chunk in app.stream({"messages": [HumanMessage("hi", id="h1")]}, cfg, stream_mode="values"):
        out("  values: " + str([(m.id[:12], m.text) for m in chunk["messages"]]))
    for ck in list(saver.list(cfg))[:1]:
        pass
    noid = []
    for k, v in saver.writes.items():
        for (tid, idx), (task_id, ch, (typ, blob), path) in v.items():
            val = saver.serde.loads_typed((typ, blob))
            if ch == "messages" and isinstance(val, list) and val and "no id given" in str(getattr(val[0], "text", "")).lower():
                noid.append(val[0].id)
    st = app.get_state(cfg)
    final_id = [m.id for m in st.values["messages"] if "no id given" in m.text.lower()][0]
    out(f"  message written without id: id stored in pending write={noid} ; id in channel value={final_id}")
    out("  add_messages assigns uuid4 by mutating the message object (graph/message.py:203-205) inside apply_writes, after loop.put_writes already submitted the write.")
    out()


class DState(TypedDict):
    messages: Annotated[list, DeltaChannel(_messages_delta_reducer, snapshot_frequency=3)]


class BState(TypedDict):
    messages: Annotated[list, add_messages]


def build_chain(state_cls, n):
    g = StateGraph(state_cls)
    prev = START
    for i in range(n):
        name = f"n{i}"
        g.add_node(name, (lambda i: lambda s: {"messages": [AIMessage(f"msg {i} " + llm(f"Give one fact about the number {i + 1} in at most 30 words."), id=f"a{i}")]})(i))
        g.add_edge(prev, name)
        prev = name
    return g


def part_e_delta(n=8):
    out(f"# E. DeltaChannel vs add_messages: what each checkpoint stores ({n} nodes, one model reply each, SqliteSaver)")
    for label, cls in (("DeltaChannel(snapshot_frequency=3)", DState), ("add_messages (BinaryOperatorAggregate)", BState)):
        path = HERE / f"e_{'delta' if cls is DState else 'binop'}.sqlite"
        path.unlink(missing_ok=True)
        conn = sqlite3.connect(str(path), check_same_thread=False)
        saver = SqliteSaver(conn)
        app = build_chain(cls, n).compile(checkpointer=saver)
        cfg = {"configurable": {"thread_id": "d"}}
        app.invoke({"messages": [HumanMessage("start", id="h")]}, cfg)
        out(f"## {label}")
        rows = conn.execute("select checkpoint_id, type, length(checkpoint), metadata from checkpoints order by checkpoint_id").fetchall()
        total = 0
        for cid, typ, ln, meta in rows:
            ck = saver.serde.loads_typed((typ, conn.execute("select checkpoint from checkpoints where checkpoint_id=?", (cid,)).fetchone()[0]))
            m = json.loads(meta)
            mv = ck["channel_values"].get("messages")
            kind = "absent" if mv is None else type(mv).__name__ + (f"[{len(mv.value)}]" if hasattr(mv, "value") else f"[{len(mv)}]")
            total += ln
            out(f"  step={m.get('step'):>2} bytes={ln:>6} messages={kind:<22} counters={m.get('counters_since_delta_snapshot')}")
        wb = conn.execute("select count(*), sum(length(value)) from writes").fetchone()
        out(f"  total checkpoint bytes={total}; writes rows={wb[0]} bytes={wb[1]}")
        st = app.get_state(cfg)
        out(f"  get_state messages reconstructed: {len(st.values['messages'])} messages, ids={[m.id for m in st.values['messages']]}")
        conn.close()
    out()


def main():
    out(f"# Channels capture, real model. pin {PIN}. {machine()}")
    out(f"# model {settings()}")
    out()
    part_a_direct()
    part_b_lastvalue_conflict()
    part_c_reducer_order()
    part_d_add_messages()
    out("# D2 (the id race) runs in race.py, two runs of n=200.")
    out()
    part_e_delta()
    out(f"model calls in this file: {len(TimedChatOllama.calls)}")
    (HERE / "trace.txt").write_text("\n".join(OUT) + "\n")


if __name__ == "__main__":
    main()
