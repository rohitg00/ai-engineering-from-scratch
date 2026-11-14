import argparse
import json
import os
import sqlite3
import time
import uuid
from typing import Annotated, TypedDict

from langchain_core.messages import AIMessage, HumanMessage
from langgraph.channels.delta import DeltaChannel
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import _messages_delta_reducer, add_messages

PG = os.environ.get("PG_URL", "postgresql://127.0.0.1:5432/lc_lab")
import random as _r
_V = ["".join(_r.Random(k).choices("abcdefghijklmnopqrstuvwxyz", k=_r.Random(k + 7).randint(2, 9))) for k in range(5000)]


def body(i, n=400):
    rng = _r.Random(i)
    out = []
    while sum(len(w) + 1 for w in out) < n:
        out.append(rng.choice(_V))
    return " ".join(out)[:n]


BODY = body(0)


def build(mode, steps):
    if mode == "plain":
        ann = add_messages
    elif mode == "delta100":
        ann = DeltaChannel(_messages_delta_reducer, snapshot_frequency=100)
    else:
        ann = DeltaChannel(_messages_delta_reducer, snapshot_frequency=1000)

    class S(TypedDict):
        messages: Annotated[list, ann]
        n: int

    marks = []

    def step(state):
        marks.append(time.perf_counter_ns())
        i = state.get("n", 0) + 1
        return {"n": i, "messages": [AIMessage(content=body(i), id=f"m{i}")]}

    def route(state):
        return END if state["n"] >= steps else "step"

    g = StateGraph(S)
    g.add_node("step", step)
    g.add_edge(START, "step")
    g.add_conditional_edges("step", route, ["step", END])
    return g, marks


class Meter:
    def __init__(self, saver):
        self.put_ns = []
        self.writes_ns = 0
        self.ser_bytes = []
        self._cur = 0
        orig_put, orig_pw = saver.put, saver.put_writes
        serde = saver.serde
        orig_dumps = serde.dumps_typed

        def dumps(obj):
            t, b = orig_dumps(obj)
            self._cur += len(b)
            return t, b

        def put(*a, **k):
            t0 = time.perf_counter_ns()
            r = orig_put(*a, **k)
            self.put_ns.append(time.perf_counter_ns() - t0)
            self.ser_bytes.append(self._cur)
            self._cur = 0
            return r

        def put_writes(*a, **k):
            t0 = time.perf_counter_ns()
            r = orig_pw(*a, **k)
            self.writes_ns += time.perf_counter_ns() - t0
            return r

        serde.dumps_typed = dumps
        saver.put = put
        saver.put_writes = put_writes


def storage_bytes(kind, saver, thread, path=None):
    if kind == "memory":
        tot = 0
        for ns in saver.storage.get(thread, {}).values():
            for cid, (c, m, p) in ns.items():
                tot += len(c[1]) + len(m[1])
        for (t, ns, cid), w in saver.writes.items():
            if t == thread:
                for _, (task, ch, v, path_) in w.items():
                    tot += len(v[1])
        for (t, ns, ch, ver), v in saver.blobs.items():
            if t == thread:
                tot += len(v[1])
        return {"thread_bytes": tot}
    if kind == "sqlite":
        con = sqlite3.connect(path)
        r = {}
        tabs = [x[0] for x in con.execute("select name from sqlite_master where type='table'")]
        tot = 0
        for tname in tabs:
            cols = [c[1] for c in con.execute(f"pragma table_info({tname})")]
            if "thread_id" not in cols:
                continue
            blobcols = [c for c in cols if c in ("checkpoint", "metadata", "value", "blob")]
            if not blobcols:
                continue
            expr = "+".join(f"coalesce(length({c}),0)" for c in blobcols)
            n, b = con.execute(f"select count(*), coalesce(sum({expr}),0) from {tname} where thread_id=?", (thread,)).fetchone()
            r[tname] = {"rows": n, "bytes": b}
            tot += b
        r["thread_bytes"] = tot
        r["file_bytes"] = os.path.getsize(path)
        con.close()
        return r
    if kind == "postgres":
        import psycopg
        r = {}
        tot = 0
        stored = 0
        with psycopg.connect(PG) as con:
            q = {
                "checkpoints": "select count(*), coalesce(sum(octet_length(checkpoint::text)+octet_length(metadata::text)),0), coalesce(sum(pg_column_size(checkpoint)+pg_column_size(metadata)),0) from checkpoints where thread_id=%s",
                "checkpoint_blobs": "select count(*), coalesce(sum(octet_length(blob)),0), coalesce(sum(pg_column_size(blob)),0) from checkpoint_blobs where thread_id=%s",
                "checkpoint_writes": "select count(*), coalesce(sum(octet_length(blob)),0), coalesce(sum(pg_column_size(blob)),0) from checkpoint_writes where thread_id=%s",
            }
            for k, sql in q.items():
                n, b, st = con.execute(sql, (thread,)).fetchone()
                r[k] = {"rows": n, "bytes": int(b), "stored_bytes": int(st)}
                tot += int(b)
                stored += int(st)
            r["thread_bytes"] = tot
            r["thread_stored_bytes"] = stored
            r["db_total"] = {t: con.execute("select pg_total_relation_size(%s)", (t,)).fetchone()[0] for t in q}
        return r


def run_cell(kind, mode, steps, rep, out, workdir):
    thread = f"t03-{kind}-{mode}-{steps}-{rep}-{uuid.uuid4().hex[:6]}"
    g, marks = build(mode, steps)
    ctx = None
    path = None
    if kind == "memory":
        from langgraph.checkpoint.memory import InMemorySaver
        saver = InMemorySaver()
    elif kind == "sqlite":
        from langgraph.checkpoint.sqlite import SqliteSaver
        path = f"{workdir}/t03-{kind}-{mode}-{steps}-{rep}.sqlite"
        if os.path.exists(path):
            os.remove(path)
        ctx = SqliteSaver.from_conn_string(path)
        saver = ctx.__enter__()
        saver.setup()
    else:
        from langgraph.checkpoint.postgres import PostgresSaver
        ctx = PostgresSaver.from_conn_string(PG)
        saver = ctx.__enter__()
        saver.setup()
    meter = Meter(saver)
    app = g.compile(checkpointer=saver)
    cfg = {"configurable": {"thread_id": thread}, "recursion_limit": steps + 50}
    t0 = time.perf_counter_ns()
    app.invoke({"messages": [HumanMessage(content="go", id="h0")], "n": 0}, cfg, durability="sync")
    wall = (time.perf_counter_ns() - t0) / 1e6
    gaps = [(b - a) / 1e6 for a, b in zip(marks, marks[1:])]
    reads = []
    for _ in range(3):
        r0 = time.perf_counter_ns()
        st = app.get_state(cfg)
        reads.append((time.perf_counter_ns() - r0) / 1e6)
    assert len(st.values["messages"]) == steps + 1, len(st.values["messages"])
    sto = storage_bytes(kind, saver, thread, path)
    put_ms = [x / 1e6 for x in meter.put_ns]
    rec = {
        "exp": "T03", "saver": kind, "channel": mode, "steps": steps, "rep": rep, "durability": "sync",
        "msg_chars": len(BODY), "wall_ms": wall, "ms_per_step": wall / steps,
        "step_gap_ms": summ(gaps), "step_gap_last10_ms": summ(gaps[-10:]),
        "put_calls": len(put_ms), "put_ms": summ(put_ms), "put_ms_last10": summ(put_ms[-10:]),
        "put_writes_ms_total": meter.writes_ns / 1e6,
        "serialized_bytes_total": sum(meter.ser_bytes), "serialized_bytes_per_put": summ(meter.ser_bytes),
        "serialized_bytes_last_put": meter.ser_bytes[-1] if meter.ser_bytes else None,
        "get_state_ms": reads, "storage": sto,
    }
    if kind == "postgres":
        import psycopg
        with psycopg.connect(PG) as con:
            for t in ("checkpoint_writes", "checkpoint_blobs", "checkpoints"):
                con.execute(f"delete from {t} where thread_id=%s", (thread,))
    if ctx:
        ctx.__exit__(None, None, None)
    if path and os.path.exists(path):
        os.remove(path)
    with open(out, "a") as f:
        f.write(json.dumps(rec) + "\n")
    return rec


def pct(xs, q):
    xs = sorted(xs)
    if not xs:
        return None
    k = (len(xs) - 1) * q
    f = int(k)
    c = min(f + 1, len(xs) - 1)
    return xs[f] + (xs[c] - xs[f]) * (k - f)


def summ(xs):
    return {"n": len(xs), "p50": pct(xs, 0.5), "p99": pct(xs, 0.99), "mean": (sum(xs) / len(xs)) if xs else None, "max": max(xs) if xs else None}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--savers", default="memory,sqlite,postgres")
    ap.add_argument("--modes", default="plain,delta100,delta1000")
    ap.add_argument("--steps", default="10,100,1000,5000")
    ap.add_argument("--reps", type=int, default=3)
    ap.add_argument("--workdir", default="work")
    a = ap.parse_args()
    os.makedirs(a.workdir, exist_ok=True)
    for steps in [int(x) for x in a.steps.split(",")]:
        reps = a.reps if steps <= 1000 else 1
        for rep in range(reps):
            for kind in a.savers.split(","):
                for mode in a.modes.split(","):
                    r = run_cell(kind, mode, steps, rep, a.out, a.workdir)
                    print(kind, mode, steps, rep, f"{r['ms_per_step']:.2f}ms/step", r["storage"]["thread_bytes"], flush=True)
