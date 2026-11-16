import argparse
import asyncio
import json
import os
import random
import re
import time
from datetime import datetime

import httpx
from langgraph_sdk import get_client

LOG = os.environ.get("T15_LOG", "t15r-events.jsonl")
FOREVER = "Call the tool ping. Each time it answers, call ping again. Keep calling ping until it answers 'finished'. Do not stop on your own."


def pct(xs, q):
    xs = sorted(xs)
    if not xs:
        return None
    k = (len(xs) - 1) * q
    f = int(k)
    c = min(f + 1, len(xs) - 1)
    return round(xs[f] + (xs[c] - xs[f]) * (k - f), 1)


def dist(xs):
    return {"n": len(xs), "p50": pct(xs, .5), "p95": pct(xs, .95), "p99": pct(xs, .99), "min": round(min(xs), 1) if xs else None, "max": round(max(xs), 1) if xs else None}


def write(out, rec):
    with open(out, "a") as f:
        f.write(json.dumps(rec, default=str) + "\n")
    print(json.dumps(rec, default=str)[:700], flush=True)


def events(t0=0):
    evs = []
    if os.path.exists(LOG):
        for line in open(LOG):
            e = json.loads(line)
            if e["t"] >= t0:
                evs.append(e)
    return evs


def by_tag(evs):
    d = {}
    for e in evs:
        if e["ev"] == "model" and e.get("tag"):
            d.setdefault(e["tag"], []).append(e)
    return d


def ts(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00")).timestamp()


def max_overlap(ivs):
    pts = sorted([(a, 1) for a, _ in ivs] + [(b, -1) for _, b in ivs])
    cur = best = 0
    for _, d in pts:
        cur += d
        best = max(best, cur)
    return best


async def one_run(client, tag, a, b, how="wait"):
    t0 = time.time()
    th = await client.threads.create()
    inp = {"messages": [{"role": "user", "content": f"Use the add tool to add {a} and {b}. #{tag}"}]}
    if how == "wait":
        res = await client.runs.wait(th["thread_id"], "agent", input=inp)
    else:
        r = await client.runs.create(th["thread_id"], "agent", input=inp)
        res = await client.runs.join(th["thread_id"], r["run_id"])
    t1 = time.time()
    runs = await client.runs.list(th["thread_id"])
    srv = None
    if runs:
        srv = (ts(runs[0]["updated_at"]) - ts(runs[0]["created_at"])) * 1000
    txt = str(res["messages"][-1]["content"]).replace(",", "") if isinstance(res, dict) and res.get("messages") else str(res)[:200]
    return {"tag": tag, "t0": t0, "t1": t1, "client_ms": (t1 - t0) * 1000, "server_ms": srv, "ok": bool(re.search(rf"(?<!\d){a + b}(?!\d)", txt)), "answer": txt[:160],
            "run_created": ts(runs[0]["created_at"]) if runs else None}


def attach_model(rows, t0):
    tags = by_tag(events(t0))
    for r in rows:
        ms = tags.get(r["tag"], [])
        r["model_calls"] = len(ms)
        r["model_ms"] = round(sum((m["t1"] - m["t0"]) * 1000 for m in ms), 1)
        r["ollama_ms"] = round(sum(m["server_ms"] for m in ms), 1)
        r["first_model_start_after_send_ms"] = round((min(m["t0"] for m in ms) - r["t0"]) * 1000, 1) if ms else None
        r["server_added_ms"] = round(r["client_ms"] - r["model_ms"], 1)
    return rows


async def load(url, out, label, levels, per_level_min):
    client = get_client(url=url, timeout=httpx.Timeout(1800.0))
    for c in levels:
        total = max(per_level_min, 2 * c)
        rng = random.Random(c)
        pairs = [(rng.randint(100, 999), rng.randint(100, 999)) for _ in range(total)]
        sem = asyncio.Semaphore(c)
        rows, errs = [], []

        async def go(i):
            async with sem:
                try:
                    rows.append(await one_run(client, f"{label}-L{c}-{i}-{int(time.time()*1000)}", *pairs[i]))
                except Exception as e:
                    errs.append(f"{type(e).__name__}: {str(e)[:200]}")

        t0 = time.time()
        await asyncio.gather(*(go(i) for i in range(total)))
        wall = time.time() - t0
        await asyncio.sleep(0.5)
        attach_model(rows, t0)
        ms = [m for m in events(t0) if m["ev"] == "model"]
        write(out, {"exp": "T15r", "part": "load", "server": label, "concurrency": c, "runs": total, "ok": sum(r["ok"] for r in rows), "errors": len(errs), "error_examples": errs[:3],
                    "wall_s": round(wall, 2), "runs_per_s": round(len(rows) / wall, 4),
                    "client_ms": dist([r["client_ms"] for r in rows]), "model_ms_per_run": dist([r["model_ms"] for r in rows]),
                    "server_added_ms": dist([r["server_added_ms"] for r in rows]), "wait_before_first_model_ms": dist([r["first_model_start_after_send_ms"] for r in rows if r["first_model_start_after_send_ms"] is not None]),
                    "model_calls": len(ms), "model_calls_per_s": round(len(ms) / wall, 3), "model_overlap_max": max_overlap([(m["t0"], m["t1"]) for m in ms]),
                    "ollama_busy_s": round(sum(m["server_ms"] for m in ms) / 1000, 2), "out_tok_per_s": round(sum(m["out_tok"] or 0 for m in ms) / wall, 2),
                    "rows": rows})


async def floor(url, out, label, n):
    client = get_client(url=url, timeout=httpx.Timeout(600.0))
    rng = random.Random(7)
    for how in ["wait", "create_join"]:
        rows = []
        t0 = time.time()
        for i in range(n):
            rows.append(await one_run(client, f"{label}-F{how}-{i}-{int(time.time()*1000)}", rng.randint(100, 999), rng.randint(100, 999), how))
        await asyncio.sleep(0.5)
        attach_model(rows, t0)
        write(out, {"exp": "T15r", "part": "latency_floor", "server": label, "how": how, "n": n, "ok": sum(r["ok"] for r in rows),
                    "client_ms": dist([r["client_ms"] for r in rows]), "server_ms": dist([r["server_ms"] for r in rows if r["server_ms"]]),
                    "model_ms": dist([r["model_ms"] for r in rows]), "ollama_ms": dist([r["ollama_ms"] for r in rows]),
                    "server_added_ms": dist([r["server_added_ms"] for r in rows]),
                    "wait_before_first_model_ms": dist([r["first_model_start_after_send_ms"] for r in rows if r["first_model_start_after_send_ms"] is not None]),
                    "model_calls_per_run": sorted({r["model_calls"] for r in rows}), "rows": rows})


async def workers(url, out, label, n):
    client = get_client(url=url, timeout=httpx.Timeout(1800.0))
    rng = random.Random(11)
    t0 = time.time()
    runs = []
    for i in range(n):
        th = await client.threads.create()
        tag = f"{label}-W{i}-{int(time.time()*1000)}"
        r = await client.runs.create(th["thread_id"], "agent", input={"messages": [{"role": "user", "content": f"Use the add tool to add {rng.randint(100, 999)} and {rng.randint(100, 999)}. #{tag}"}]})
        runs.append((th["thread_id"], r["run_id"], tag))
    submit = time.time() - t0
    while True:
        st = [await client.runs.get(t, r) for t, r, _ in runs]
        if all(s["status"] not in ("pending", "running") for s in st):
            break
        await asyncio.sleep(0.5)
    wall = time.time() - t0
    await asyncio.sleep(0.5)
    tags = by_tag(events(t0))
    spans = []
    for _, _, tag in runs:
        ms = tags.get(tag, [])
        if ms:
            spans.append((min(m["t0"] for m in ms), max(m["t1"] for m in ms)))
    ms_all = [m for v in tags.values() for m in v]
    statuses = {}
    for s in st:
        statuses[s["status"]] = statuses.get(s["status"], 0) + 1
    write(out, {"exp": "T15r", "part": "workers", "server": label, "background_runs": n, "submit_s": round(submit, 3), "wall_s": round(wall, 2), "final_statuses": statuses,
                "max_runs_in_flight": max_overlap(spans), "max_model_calls_in_flight_client_side": max_overlap([(m["t0"], m["t1"]) for m in ms_all]),
                "model_calls": len(ms_all), "model_call_ms": dist([(m["t1"] - m["t0"]) * 1000 for m in ms_all]),
                "ollama_ms": dist([m["server_ms"] for m in ms_all]),
                "run_start_offsets_s": sorted(round(a - t0, 2) for a, _ in spans), "run_end_offsets_s": sorted(round(b - t0, 2) for _, b in spans)})


async def recursion(url, out, label, reps, cap_s):
    client = get_client(url=url, timeout=httpx.Timeout(1800.0))
    cases = [({"recursion_limit": 25}, f"lim25-{i}") for i in range(reps)] + [(None, "noconfig-0")]
    for cfg, name in cases:
        tag = f"{label}-R{name}-{int(time.time()*1000)}"
        th = await client.threads.create()
        t0 = time.time()
        kw = {"config": cfg} if cfg else {}
        rec = {"exp": "T15r", "part": "recursion", "server": label, "config": cfg, "case": name}
        if cfg:
            try:
                res = await client.runs.wait(th["thread_id"], "loopagent", input={"messages": [{"role": "user", "content": f"{FOREVER} #{tag}"}]}, raise_error=False, **kw)
                rec["result"] = str(res)[:500]
            except Exception as e:
                rec["error"] = f"{type(e).__name__}: {str(e)[:500]}"
        else:
            r = await client.runs.create(th["thread_id"], "loopagent", input={"messages": [{"role": "user", "content": f"{FOREVER} #{tag}"}]})
            await asyncio.sleep(cap_s)
            st = await client.runs.get(th["thread_id"], r["run_id"])
            rec["status_at_cap"] = st["status"]
            rec["cap_s"] = cap_s
            await client.runs.cancel(th["thread_id"], r["run_id"], wait=True)
        rec["wall_s"] = round(time.time() - t0, 2)
        runs = await client.runs.list(th["thread_id"])
        rec["run_status"] = runs[0]["status"] if runs else None
        state = await client.threads.get_state(th["thread_id"])
        rec["state_messages"] = len(state["values"].get("messages", [])) if state.get("values") else None
        await asyncio.sleep(0.5)
        evs = events(t0)
        rec["model_calls"] = sum(1 for e in evs if e["ev"] == "model" and e.get("tag") == tag)
        rec["tool_calls_ping"] = sum(1 for e in evs if e["ev"] == "tool" and e.get("name") == "ping")
        write(out, rec)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("part")
    ap.add_argument("--url", default="http://127.0.0.1:2024")
    ap.add_argument("--out", required=True)
    ap.add_argument("--label", required=True)
    ap.add_argument("--levels", default="1,4,16")
    ap.add_argument("--min-runs", type=int, default=10)
    ap.add_argument("--n", type=int, default=10)
    ap.add_argument("--reps", type=int, default=3)
    ap.add_argument("--cap", type=float, default=120)
    a = ap.parse_args()
    if a.part == "load":
        await load(a.url, a.out, a.label, [int(x) for x in a.levels.split(",")], a.min_runs)
    elif a.part == "floor":
        await floor(a.url, a.out, a.label, a.n)
    elif a.part == "workers":
        await workers(a.url, a.out, a.label, a.n)
    elif a.part == "recursion":
        await recursion(a.url, a.out, a.label, a.reps, a.cap)


if __name__ == "__main__":
    asyncio.run(main())
