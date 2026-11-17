import json
import math
import os
import platform
import sqlite3
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "common"))
from real import machine, settings

CHILD = r'''
import os, sys, time, sqlite3, operator, json
sys.path.insert(0, sys.argv[7])
from typing import Annotated, TypedDict
from real import chat
from langchain_core.tools import tool
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.config import get_config
from langgraph.graph import START, StateGraph
db, mode, phase, log, wait, with_ns = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], float(sys.argv[5]), sys.argv[6] == "ns"

@tool
def get_weather(city: str) -> str:
    """Return the weather for a city."""
    return {"Oslo": "Oslo: 4 C, rain", "Paris": "Paris: 12 C, sunny"}.get(city, city + ": unknown")

model = chat()

class S(TypedDict):
    items: Annotated[list, operator.add]

done = set()

def logline(name, extra=None):
    rec = {"phase": phase, "node": name, "t": time.time()}
    if with_ns:
        rec["ns"] = get_config()["configurable"]["checkpoint_ns"]
    if extra:
        rec.update(extra)
    with open(log, "a") as fh:
        fh.write(json.dumps(rec) + "\n")
        if with_ns:
            fh.flush(); os.fsync(fh.fileno())

def a(s):
    logline("a")
    r = model.invoke("Name one fruit. Reply with one word.")
    done.add("a")
    return {"items": ["a:" + r.text.strip()[:20]]}

def b(s):
    logline("b")
    r = get_weather.invoke({"city": "Oslo"})
    done.add("b")
    return {"items": ["b:" + r]}

def c(s):
    logline("c")
    if phase == "crash":
        while not {"a", "b"} <= done:
            time.sleep(0.001)
        time.sleep(wait)
        os._exit(17)
    r = model.invoke("Name one colour. Reply with one word.")
    return {"items": ["c:" + r.text.strip()[:20]]}

def d(s):
    logline("d")
    return {"items": ["d"]}

g = StateGraph(S)
for n, f in (("a", a), ("b", b), ("c", c)):
    g.add_node(n, f)
    g.add_edge(START, n)
g.add_node("d", d)
for n in "abc":
    g.add_edge(n, "d")
conn = sqlite3.connect(db, check_same_thread=False)
app = g.compile(checkpointer=SqliteSaver(conn))
cfg = {"configurable": {"thread_id": "crash"}}
try:
    r = app.invoke({"items": []} if phase == "crash" else None, cfg, durability=mode)
    print(json.dumps({"result": r}))
except Exception as e:
    print(json.dumps({"error": type(e).__name__ + ": " + str(e)[:120]}))
'''


def wilson(k, n, z=1.96):
    if n == 0:
        return [None, None]
    p = k / n
    den = 1 + z * z / n
    c = (p + z * z / (2 * n)) / den
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den
    return [round(max(0.0, c - h), 3), round(min(1.0, c + h), 3)]


def classify(order):
    if not order:
        return "nothing to resume"
    rerun = sorted(set(order) & {"a", "b"})
    if "c" not in order:
        return "other"
    return {(): "only c", ("a",): "a and c", ("b",): "b and c", ("a", "b"): "a, b and c"}[tuple(rerun)]


def main(kind, trials):
    with_ns = kind == "taskns"
    modes = ("sync", "async") if with_ns else ("sync", "async", "exit")
    work = Path.home() / "ir-work" / f"crash-{kind}"
    work.mkdir(parents=True, exist_ok=True)
    child = work / "child.py"
    child.write_text(CHILD)
    common = str(HERE.parent / "common")
    py = sys.executable
    OUT = []

    def out(s=""):
        OUT.append(s)
        print(s, flush=True)

    out(f"# {'Task namespace across a crash' if with_ns else 'Crash mid-superstep, then resume in a new process'}, real model. trials={trials} per cell")
    out(f"# {machine()}")
    out(f"# model {settings()}")
    out("graph: START -> a, b, c -> d. a calls the model ('Name one fruit'), b calls the get_weather tool, c waits until a and b returned, waits W, then os._exit(17). The resume runs in a new process with invoke(None); there c calls the model. SqliteSaver file on the guest root disk (ext4 on a qcow2 image held in host RAM).")
    if with_ns:
        out("each node logs get_config()['configurable']['checkpoint_ns'] on its first line, with flush+fsync (as the Mac taskns run).")
    out()
    rows = []
    summary = {}
    t_start = time.time()
    for mode in modes:
        for wait in (0.0, 0.2):
            cats = {}
            ns_stats = {"c ns same": 0, "a ns same when a rerun": 0, "a rerun": 0, "b ns same when b rerun": 0, "b rerun": 0}
            for i in range(trials):
                db = work / f"t_{mode}_{wait}_{i}.sqlite"
                log = db.with_suffix(".log")
                for p in (db, log):
                    p.unlink(missing_ok=True)
                t0 = time.time()
                r1 = subprocess.run([py, str(child), str(db), mode, "crash", str(log), str(wait), "ns" if with_ns else "-", common], capture_output=True, text=True)
                conn = sqlite3.connect(str(db))
                try:
                    wrows = conn.execute("select checkpoint_id, task_id, channel from writes").fetchall()
                    cks = conn.execute("select count(*) from checkpoints").fetchone()[0]
                except sqlite3.OperationalError:
                    wrows, cks = [], 0
                conn.close()
                r2 = subprocess.run([py, str(child), str(db), mode, "resume", str(log), "0", "ns" if with_ns else "-", common], capture_output=True, text=True)
                lines = [json.loads(l) for l in log.read_text().splitlines()] if log.exists() else []
                order = [l["node"] for l in lines if l["phase"] == "resume"]
                cat = classify(order)
                cats[cat] = cats.get(cat, 0) + 1
                row = {"mode": mode, "wait_s": wait, "trial": i, "crash_exit": r1.returncode, "category": cat,
                       "resume_order": order, "rows_after_crash": {"checkpoints": cks, "writes": len(wrows),
                       "write_tasks": sorted({t[:8] for _, t, _ in wrows})},
                       "resume_out": (r2.stdout.strip().splitlines() or [""])[-1][:200], "trial_s": round(time.time() - t0, 2)}
                if r2.stderr.strip() and "Traceback" in r2.stderr:
                    row["resume_stderr_tail"] = r2.stderr.strip().splitlines()[-1][:200]
                if with_ns:
                    crash = {l["node"]: l["ns"] for l in lines if l["phase"] == "crash"}
                    resume = {l["node"]: l["ns"] for l in lines if l["phase"] == "resume"}
                    if crash.get("c") == resume.get("c"):
                        ns_stats["c ns same"] += 1
                    for n in "ab":
                        if n in resume:
                            ns_stats[f"{n} rerun"] += 1
                            if crash.get(n) == resume.get(n):
                                ns_stats[f"{n} ns same when {n} rerun"] += 1
                    row["crash_ns"] = {k: v.split(":")[1][:8] for k, v in crash.items()}
                    row["resume_ns"] = {k: v.split(":")[1][:8] for k, v in resume.items()}
                rows.append(row)
                for p in (db, log, Path(str(db) + "-wal"), Path(str(db) + "-shm")):
                    p.unlink(missing_ok=True)
            reran_finished = sum(v for k, v in cats.items() if k in ("a and c", "b and c", "a, b and c"))
            cell = {"n": trials, "categories": cats,
                    "reran a finished node (a or b)": reran_finished, "wilson95": wilson(reran_finished, trials),
                    "only c": cats.get("only c", 0), "only c wilson95": wilson(cats.get("only c", 0), trials)}
            if with_ns:
                cell["ns"] = ns_stats
            summary[f"{mode}/wait={wait}"] = cell
            out(f"  durability={mode:<5} wait={wait}s: {json.dumps(cell)}")
    out()
    out(f"wall {round(time.time() - t_start)} s; loadavg at end {open('/proc/loadavg').read().split()[:3]}")
    out()
    out("per trial:")
    for r in rows:
        out("  " + json.dumps(r))
    (HERE / f"{kind}.txt").write_text("\n".join(OUT) + "\n")
    (HERE / f"{kind}.json").write_text(json.dumps({"trials": trials, "summary": summary, "rows": rows, "settings": settings(), "machine": machine(), "python": platform.python_version()}, indent=1))


if __name__ == "__main__":
    main(sys.argv[1], int(sys.argv[2]))
