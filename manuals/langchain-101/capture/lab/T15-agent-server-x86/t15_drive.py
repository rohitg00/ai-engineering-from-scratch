import argparse
import asyncio
import json
import os
import time

import httpx
from langgraph_sdk import get_client

LOG = os.environ.get("T15_LOG", "t15-events.jsonl")


def pct(xs, q):
    xs = sorted(xs)
    if not xs:
        return None
    k = (len(xs) - 1) * q
    f = int(k)
    c = min(f + 1, len(xs) - 1)
    return xs[f] + (xs[c] - xs[f]) * (k - f)


def write(out, rec):
    with open(out, "a") as f:
        f.write(json.dumps(rec, default=str) + "\n")
    print(json.dumps(rec, default=str)[:600], flush=True)


async def load(url, out, label, levels, per_level_min):
    client = get_client(url=url, timeout=httpx.Timeout(600.0))
    for c in levels:
        total = max(per_level_min, 5 * c)
        lat, errs = [], []
        sem = asyncio.Semaphore(c)

        async def one(i):
            async with sem:
                t0 = time.perf_counter()
                try:
                    th = await client.threads.create()
                    res = await client.runs.wait(th["thread_id"], "agent", input={"messages": [{"role": "user", "content": f"add 2 and 3 #{i}"}]})
                    ok = isinstance(res, dict) and res.get("messages") and res["messages"][-1]["content"] == "the answer is 5"
                    if not ok:
                        errs.append({"i": i, "bad": str(res)[:200]})
                    lat.append((time.perf_counter() - t0) * 1000)
                except Exception as e:
                    errs.append({"i": i, "type": type(e).__name__, "msg": str(e)[:300]})

        t0 = time.perf_counter()
        await asyncio.gather(*(one(i) for i in range(total)))
        wall = time.perf_counter() - t0
        write(out, {"exp": "T15", "part": "load", "server": label, "concurrency": c, "runs": total, "ok": len(lat), "errors": len(errs), "error_examples": errs[:3],
                    "wall_s": wall, "runs_per_s": len(lat) / wall, "lat_ms": {"p50": pct(lat, .5), "p95": pct(lat, .95), "p99": pct(lat, .99), "max": max(lat) if lat else None},
                    "graph": "create_agent, fake model 2 calls x 50 ms, 1 tool call; thread create + runs.wait per run"})


def events_since(t0):
    evs = []
    if os.path.exists(LOG):
        for line in open(LOG):
            e = json.loads(line)
            if e["t"] >= t0:
                evs.append(e)
    return evs


def max_inflight(evs):
    pts = []
    for e in evs:
        if e["ev"] == "first_start":
            pts.append((e["t"], 1))
        elif e["ev"] == "second_end":
            pts.append((e["t"], -1))
    cur = best = 0
    for _, d in sorted(pts):
        cur += d
        best = max(best, cur)
    return best


async def workers(url, out, label, n, seconds):
    client = get_client(url=url, timeout=httpx.Timeout(600.0))
    t0 = time.time()
    runs = []
    for i in range(n):
        th = await client.threads.create()
        r = await client.runs.create(th["thread_id"], "slow", input={"seconds": seconds, "label": f"w{i}"})
        runs.append((th["thread_id"], r["run_id"]))
    submit = time.time() - t0
    statuses = {}
    while True:
        st = [await client.runs.get(t, r) for t, r in runs]
        statuses = {}
        for s in st:
            statuses[s["status"]] = statuses.get(s["status"], 0) + 1
        if all(s["status"] not in ("pending", "running") for s in st):
            break
        await asyncio.sleep(0.5)
    wall = time.time() - t0
    evs = events_since(t0)
    starts = sorted(e["t"] - t0 for e in evs if e["ev"] == "first_start")
    write(out, {"exp": "T15", "part": "workers", "server": label, "background_runs": n, "seconds_per_run": seconds, "submit_s": submit, "wall_s": wall,
                "final_statuses": statuses, "max_inflight": max_inflight(evs), "start_offsets_s": [round(x, 2) for x in starts],
                "pids": sorted({e["pid"] for e in evs})})


async def dtext(url, out, label):
    client = get_client(url=url, timeout=httpx.Timeout(600.0))
    for strategy in ["reject", "enqueue", "interrupt", "rollback"]:
        t0 = time.time()
        th = await client.threads.create()
        tid = th["thread_id"]
        r1 = await client.runs.create(tid, "slow", input={"seconds": 4, "label": f"{strategy}-A"})
        await asyncio.sleep(1.0)
        second = {}
        try:
            r2 = await client.runs.create(tid, "slow", input={"seconds": 2, "label": f"{strategy}-B"}, multitask_strategy=strategy)
            second = {"accepted": True, "run_id": r2["run_id"], "status_at_create": r2["status"]}
        except Exception as e:
            resp = getattr(e, "response", None)
            second = {"accepted": False, "type": type(e).__name__, "http_status": getattr(resp, "status_code", None), "body": (resp.text[:300] if resp is not None else str(e)[:300])}
        await asyncio.sleep(0.5)
        while True:
            rs = await client.runs.list(tid)
            if all(r["status"] not in ("pending", "running") for r in rs):
                break
            await asyncio.sleep(0.5)
        rs = await client.runs.list(tid)
        state = await client.threads.get_state(tid)
        hist = await client.threads.get_history(tid, limit=50)
        r1_after = None
        try:
            r1_after = (await client.runs.get(tid, r1["run_id"]))["status"]
        except Exception as e:
            r1_after = f"{type(e).__name__}: {str(e)[:120]}"
        evs = [{"ev": e["ev"], "label": e["label"], "dt": round(e["t"] - t0, 2)} for e in events_since(t0)]
        write(out, {"exp": "T15", "part": "double_texting", "server": label, "strategy": strategy, "second_run": second,
                    "first_run_status_after": r1_after, "runs_on_thread": [{"run_id": r["run_id"][:8], "status": r["status"], "strategy": r.get("multitask_strategy")} for r in rs],
                    "final_state_done": state["values"].get("done"), "final_messages": [m["content"] for m in state["values"].get("messages", [])],
                    "history_len": len(hist), "node_events": evs})


async def recursion(url, out, label):
    client = get_client(url=url, timeout=httpx.Timeout(900.0))
    for cfg in [None, {"recursion_limit": 50}]:
        th = await client.threads.create()
        t0 = time.perf_counter()
        res = None
        err = None
        try:
            kw = {"config": cfg} if cfg else {}
            res = await client.runs.wait(th["thread_id"], "loop", input={"n": 0}, raise_error=False, **kw)
        except Exception as e:
            err = {"type": type(e).__name__, "msg": str(e)[:500]}
        state = await client.threads.get_state(th["thread_id"])
        runs = await client.runs.list(th["thread_id"])
        write(out, {"exp": "T15", "part": "recursion_limit", "server": label, "config": cfg, "wall_s": time.perf_counter() - t0,
                    "result": str(res)[:600], "error": err, "n_in_state": state["values"].get("n"), "run_status": runs[0]["status"] if runs else None})


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("part")
    ap.add_argument("--url", default="http://127.0.0.1:2024")
    ap.add_argument("--out", required=True)
    ap.add_argument("--label", required=True)
    ap.add_argument("--levels", default="1,10,50,100")
    ap.add_argument("--min-runs", type=int, default=50)
    ap.add_argument("--n", type=int, default=20)
    ap.add_argument("--seconds", type=float, default=2.0)
    a = ap.parse_args()
    if a.part == "load":
        await load(a.url, a.out, a.label, [int(x) for x in a.levels.split(",")], a.min_runs)
    elif a.part == "workers":
        await workers(a.url, a.out, a.label, a.n, a.seconds)
    elif a.part == "dtext":
        await dtext(a.url, a.out, a.label)
    elif a.part == "recursion":
        await recursion(a.url, a.out, a.label)


if __name__ == "__main__":
    asyncio.run(main())
