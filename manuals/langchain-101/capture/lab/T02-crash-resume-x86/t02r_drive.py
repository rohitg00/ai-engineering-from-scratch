import argparse
import itertools
import json
import os
import random
import re
import signal
import subprocess
import sys
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import psycopg

from lr_common import header, jl

HERE = os.path.dirname(os.path.abspath(__file__))
DSN = os.environ.get("T02_PG", "postgresql:///lr2")
POINTS = ["before_tool", "inside_tool", "before_put_writes", "before_put", "after_tool"]
LOCK = threading.Lock()


def setup():
    with psycopg.connect(DSN, autocommit=True) as c:
        c.execute("create table if not exists t02r_ledger(id bigserial primary key, trial text, phase text, call_id text, order_id text, amount int, t double precision, idem_key text unique)")
        c.execute("create table if not exists t02r_attempts(id bigserial primary key, trial text, phase text, call_id text, order_id text, amount int, idem_key text, t double precision)")
        c.execute("create table if not exists t02r_model_calls(id bigserial primary key, trial text, phase text, n_tool_in int, t0 double precision, t1 double precision, tool_calls text, content text, in_tok int, out_tok int)")


def child(args, timeout=600):
    cmd = [sys.executable, "-W", "ignore", os.path.join(HERE, "t02r_child.py")] + args
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    reached, report, t0 = None, None, time.time()
    for line in p.stdout:
        if line.startswith("REACHED"):
            reached = line.split()[1]
            os.kill(p.pid, signal.SIGKILL)
            break
        if line.startswith("REPORT "):
            report = json.loads(line[7:])
    try:
        rest_out, err = p.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        p.kill()
        rest_out, err = p.communicate()
    for line in (rest_out or "").splitlines():
        if line.startswith("REPORT "):
            report = json.loads(line[7:])
    return {"rc": p.returncode, "reached": reached, "report": report, "stderr_tail": (err or "")[-600:] if p.returncode not in (0, -9) else "", "s": round(time.time() - t0, 3)}


def counts(trial):
    with psycopg.connect(DSN, autocommit=True) as c:
        led = c.execute("select phase, call_id, order_id, amount from t02r_ledger where trial=%s order by id", (trial,)).fetchall()
        att = c.execute("select phase, call_id, order_id, amount, idem_key from t02r_attempts where trial=%s order by id", (trial,)).fetchall()
        mc = c.execute("select phase, n_tool_in, round((t1-t0)::numeric,3), tool_calls, content, in_tok, out_tok from t02r_model_calls where trial=%s order by id", (trial,)).fetchall()
    return led, att, mc


def trial(out, saver, dur, point, key, rep):
    tid = f"t02r-{saver}-{dur}-{point}-{key}-{rep}-{uuid.uuid4().hex[:6]}"
    dbf = os.path.join(HERE, "db", tid + ".sqlite")
    order, amount = str(4100 + rep), 25 + rep
    common = ["--saver", saver, "--durability", dur, "--kill-point", point, "--thread", tid, "--trial", tid, "--db", dbf, "--key", key, "--order", order, "--amount", str(amount)]
    t0 = time.time()
    run = child(common + ["--phase", "run"])
    led_at_crash, att_at_crash, _ = counts(tid)
    res = child(common + ["--phase", "resume"])
    led, att, mc = counts(tid)
    if os.path.exists(dbf):
        os.remove(dbf)
    rec = {"exp": "T02r", "trial": tid, "saver": saver, "durability": dur, "kill_point": point, "key": key, "rep": rep, "order": order, "amount": amount,
           "killed": run["reached"] is not None, "run_rc": run["rc"], "run_s": run["s"], "run_report": run["report"], "run_stderr": run["stderr_tail"],
           "effects_at_crash": len(led_at_crash), "attempts_at_crash": len(att_at_crash),
           "resume_rc": res["rc"], "resume_s": res["s"], "resume_report": res["report"], "resume_stderr": res["stderr_tail"],
           "effects_total": len(led), "attempts_total": len(att), "ledger": led, "attempts": att,
           "model_calls": mc, "n_model_calls": len(mc), "n_model_calls_run": sum(1 for m in mc if m[0] == "run"), "n_model_calls_resume": sum(1 for m in mc if m[0] == "resume"),
           "wall_s": round(time.time() - t0, 3)}
    with LOCK:
        jl(out, rec)
        print(f"{tid} killed={rec['killed']} eff={rec['effects_total']} att={rec['attempts_total']} mc={rec['n_model_calls']} {rec['wall_s']}s", flush=True)
    return rec


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--reps", type=int, default=20)
    ap.add_argument("--rep-start", type=int, default=0)
    ap.add_argument("--keys", default="none,call_id")
    ap.add_argument("--savers", default="sqlite,postgres")
    ap.add_argument("--durs", default="sync,async,exit")
    ap.add_argument("--points", default=",".join(POINTS))
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--skip", default="", help="comma list of dur:point cells to leave out")
    ap.add_argument("--deadline", type=float, default=0, help="unix time after which no new round starts")
    a = ap.parse_args()
    os.makedirs(os.path.join(HERE, "db"), exist_ok=True)
    setup()
    jl(a.out, header("t02r_drive.py", workers=a.workers, reps=a.reps, rep_start=a.rep_start, keys=a.keys, skip=a.skip, num_predict=256, pg=re.sub(r"(://[^:/@]*):[^@]*@", r"\1@", DSN)))
    skip = {tuple(x.split(":")) for x in a.skip.split(",") if x}
    cells = [c for c in itertools.product(a.savers.split(","), a.durs.split(","), a.points.split(","), a.keys.split(",")) if (c[1], c[2]) not in skip]
    for rep in range(a.rep_start, a.rep_start + a.reps):
        if a.deadline and time.time() > a.deadline:
            print(f"deadline reached before rep {rep}", flush=True)
            break
        order = cells[:]
        random.Random(rep).shuffle(order)
        with ThreadPoolExecutor(a.workers) as ex:
            list(ex.map(lambda c: trial(a.out, *c, rep), order))
        jl(a.out, {"kind": "round_done", "rep": rep, "time": time.time(), "load": os.getloadavg()})
    jl(a.out, {"kind": "done", "time": time.time()})


if __name__ == "__main__":
    main()
