import json
import os
import random
import sys
import threading
import time
import uuid
import warnings

warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import requests

from t21_common import T21, env_snapshot, scrub

REQS = []
_LOCK = threading.Lock()
_orig_send = requests.Session.send
T0 = time.perf_counter()


def _send(self, request, **kw):
    t = time.perf_counter()
    err = None
    resp = None
    try:
        resp = _orig_send(self, request, **kw)
        return resp
    except Exception as e:
        err = repr(e)[:200]
        raise
    finally:
        body = request.body
        size = len(body) if isinstance(body, (bytes, bytearray, str)) else None
        rec = {"t_rel": round(t - T0, 3), "secs": round(time.perf_counter() - t, 3), "method": request.method,
               "url": request.url.split("?")[0], "status": getattr(resp, "status_code", None), "req_bytes": size,
               "req_header_names": sorted(request.headers.keys()), "ctype": request.headers.get("Content-Type", "")[:40],
               "thread": threading.current_thread().name, "error": err,
               "resp_limit_headers": {k: v for k, v in (resp.headers.items() if resp is not None else []) if "limit" in k.lower() or "retry" in k.lower()}}
        with _LOCK:
            REQS.append(rec)


requests.Session.send = _send

from langsmith import Client, traceable, tracing_context
from langsmith.run_trees import get_cached_client
from langchain_core.tracers.langchain import wait_for_all_tracers

from t21_agent import QUESTIONS, ask, make_agent


def run_fields(r):
    d = r.dict() if hasattr(r, "dict") else dict(r)
    keep = {}
    for k, v in d.items():
        if k in ("inputs", "outputs", "serialized", "events", "inputs_preview", "outputs_preview"):
            keep[k] = (json.dumps(v, default=str)[:300] if v is not None else None)
        else:
            keep[k] = v
    keep["latency_s"] = (r.end_time - r.start_time).total_seconds() if r.end_time and r.start_time else None
    return keep


def poll_visible(client, rid, deadline_s=120):
    t = time.perf_counter()
    first_seen = None
    n = 0
    while time.perf_counter() - t < deadline_s:
        n += 1
        try:
            r = client.read_run(rid)
            if first_seen is None:
                first_seen = time.perf_counter() - t
            if r.end_time is not None and r.outputs:
                return {"first_readable_s": round(first_seen, 3), "complete_s": round(time.perf_counter() - t, 3), "polls": n}
        except Exception as e:
            last = type(e).__name__
        time.sleep(0.25)
    return {"first_readable_s": first_seen, "complete_s": None, "polls": n, "timeout": True}


def main_timing(out_name, n):
    project = os.environ["LANGSMITH_PROJECT"]
    out = T21 / out_name
    client = get_cached_client()
    reader = Client()
    agent = make_agent()
    order = ["off", "on"] * n
    random.Random(7).shuffle(order)
    rows = []
    for i, cond in enumerate(order):
        q, exp = QUESTIONS[i % len(QUESTIONS)]
        rid = uuid.uuid4()
        nreq0 = len(REQS)
        t = time.perf_counter()
        with tracing_context(enabled=(cond == "on")):
            ans, res = ask(agent, q, config={"run_id": rid})
        wall = time.perf_counter() - t
        ai = [m for m in res["messages"] if m.type == "ai"]
        model_ns = sum((m.response_metadata or {}).get("total_duration", 0) for m in ai)
        row = {"i": i, "cond": cond, "run_id": str(rid), "q": q, "answer": ans, "correct": ans.strip() == str(exp), "wall_s": round(wall, 4),
               "model_total_s": round(model_ns / 1e9, 4), "overhead_s": round(wall - model_ns / 1e9, 4), "n_ai": len(ai),
               "load1": os.getloadavg()[0], "reqs_during_run": len(REQS) - nreq0}
        if cond == "on":
            row["visible"] = poll_visible(reader, rid)
        rows.append(row)
        print(json.dumps({k: row[k] for k in ("i", "cond", "correct", "wall_s", "overhead_s")}), row.get("visible"), flush=True)
    t = time.perf_counter()
    wait_for_all_tracers()
    client.flush()
    flush_s = time.perf_counter() - t
    with open(out, "w") as f:
        f.write(scrub(json.dumps({"kind": "env", **env_snapshot(), "project": project, "flush_s": flush_s})) + "\n")
        for r in rows:
            f.write(scrub(json.dumps(r)) + "\n")
    with open(T21 / out_name.replace(".jsonl", "-requests.jsonl"), "w") as f:
        for r in REQS:
            f.write(scrub(json.dumps(r)) + "\n")


def main_tree(out_name, run_id):
    project = os.environ["LANGSMITH_PROJECT"]
    reader = Client()
    root = reader.read_run(run_id)
    runs = list(reader.list_runs(project_name=project, trace_id=root.trace_id))
    with open(T21 / out_name, "w") as f:
        for r in sorted(runs, key=lambda r: r.dotted_order or ""):
            f.write(scrub(json.dumps(run_fields(r), default=str)) + "\n")
    print(len(runs), "runs in trace")


def main_local(out_name, n):
    project = os.environ["LANGSMITH_PROJECT"]
    agent = make_agent()

    @traceable(name="t21_local_traceable")
    def plain(x):
        return {"y": x * 2}

    ids = []
    for i in range(n):
        rid = uuid.uuid4()
        with tracing_context(enabled="local"):
            ans, _ = ask(agent, QUESTIONS[i][0], config={"run_id": rid})
            plain(i)
        ids.append({"run_id": str(rid), "answer": ans})
    wait_for_all_tracers()
    get_cached_client().flush()
    time.sleep(20)
    reader = Client()
    found = []
    for d in ids:
        try:
            r = reader.read_run(d["run_id"])
            found.append({**d, "readable": True, "session_id": str(r.session_id), "name": r.name})
        except Exception as e:
            found.append({**d, "readable": False, "error": type(e).__name__})
    try:
        proj = reader.read_project(project_name=project)
        proj_info = {"exists": True, "id": str(proj.id), "name": proj.name}
        listed = [{"name": r.name, "run_type": r.run_type, "parent": bool(r.parent_run_id)} for r in reader.list_runs(project_name=project)]
    except Exception as e:
        proj_info = {"exists": False, "error": f"{type(e).__name__}: {str(e)[:200]}"}
        listed = []
    with open(T21 / out_name, "w") as f:
        f.write(scrub(json.dumps({"env": env_snapshot(), "project": project, "env_vars": sorted(k for k in os.environ if k.startswith("LANGSMITH")),
                                  "ids": found, "project_info": proj_info, "listed_runs": listed,
                                  "requests": REQS}, default=str)) + "\n")
    print(json.dumps({"found": found, "proj": proj_info, "n_listed": len(listed), "n_req": len(REQS)}, default=str)[:1500])


if __name__ == "__main__":
    mode = sys.argv[1]
    if mode == "timing":
        main_timing(sys.argv[2], int(sys.argv[3]))
    elif mode == "tree":
        main_tree(sys.argv[2], sys.argv[3])
    elif mode == "local":
        main_local(sys.argv[2], int(sys.argv[3]))
