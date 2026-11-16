import argparse
import asyncio
import json
import os
import random
import re
import sys
import time

os.environ["LANGSMITH_TRACING"] = "false"
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import psycopg
from langchain.agents import create_agent
from langchain.agents.middleware import AgentMiddleware
from langchain.tools import tool
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from lr_common import header, jl, chat

DSN = os.environ.get("T16_PG", "postgresql:///lr2")
SYSTEM = "You are a calculator assistant. Use the add tool for every addition, then answer in one short sentence."


def pct(xs, q):
    xs = sorted(xs)
    if not xs:
        return None
    k = (len(xs) - 1) * q
    f = int(k)
    c = min(f + 1, len(xs) - 1)
    return round(xs[f] + (xs[c] - xs[f]) * (k - f), 3)


def dist(xs):
    return {"n": len(xs), "p50": pct(xs, .5), "p95": pct(xs, .95), "p99": pct(xs, .99), "max": round(max(xs), 3) if xs else None}


@tool
async def add(a: int, b: int) -> int:
    """Add two integers."""
    return a + b


class Stats:
    def __init__(self):
        self.put, self.writes, self.get, self.model = [], [], [], []


S = Stats()


def timed_saver(cls):
    class T(cls):
        async def aput(self, *a, **k):
            t0 = time.perf_counter()
            r = await super().aput(*a, **k)
            S.put.append((time.perf_counter() - t0) * 1000)
            return r

        async def aput_writes(self, *a, **k):
            t0 = time.perf_counter()
            r = await super().aput_writes(*a, **k)
            S.writes.append((time.perf_counter() - t0) * 1000)
            return r

        async def aget_tuple(self, *a, **k):
            t0 = time.perf_counter()
            r = await super().aget_tuple(*a, **k)
            S.get.append((time.perf_counter() - t0) * 1000)
            return r
    return T


class LogModel(AgentMiddleware):
    async def awrap_model_call(self, request, handler):
        t0 = time.time()
        resp = await handler(request)
        t1 = time.time()
        ai = resp.result[-1] if hasattr(resp, "result") else resp
        u = getattr(ai, "usage_metadata", None) or {}
        md = getattr(ai, "response_metadata", None) or {}
        S.model.append({"t0": t0, "t1": t1, "in_tok": u.get("input_tokens"), "out_tok": u.get("output_tokens"),
                        "server_ms": round((md.get("total_duration") or 0) / 1e6, 1), "load_ms": round((md.get("load_duration") or 0) / 1e6, 1)})
        return resp


async def monitor(stop, samples):
    async with await psycopg.AsyncConnection.connect(DSN, autocommit=True) as c:
        while not stop.is_set():
            r = await (await c.execute("select count(*), count(*) filter (where state='active') from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid()")).fetchone()
            samples.append(r)
            try:
                await asyncio.wait_for(stop.wait(), 0.25)
            except asyncio.TimeoutError:
                pass


def max_overlap(ivs):
    pts = sorted([(a, 1) for a, _ in ivs] + [(b, -1) for _, b in ivs])
    cur = best = 0
    for _, d in pts:
        cur += d
        best = max(best, cur)
    return best


async def level(out, config, n, rep, runs_per_thread, model):
    global S
    S = Stats()
    tag = f"t16r-{config}-{n}-{rep}-{int(time.time()*1000)}"
    errors = []
    run_ms, ok_runs, correct = [], 0, 0
    rng = random.Random(n * 100 + rep)
    pool = None
    if config == "single":
        ctx = timed_saver(AsyncPostgresSaver).from_conn_string(DSN)
        cp = await ctx.__aenter__()
    else:
        size = int(config.replace("pool", ""))
        pool = AsyncConnectionPool(DSN, min_size=1, max_size=size, open=False, kwargs={"autocommit": True, "prepare_threshold": 0, "row_factory": dict_row})
        await pool.open()
        cp = timed_saver(AsyncPostgresSaver)(pool)
        ctx = None
    await cp.setup()
    agent = create_agent(model, tools=[add], system_prompt=SYSTEM, middleware=[LogModel()], checkpointer=cp)

    async def thread_work(i):
        nonlocal ok_runs, correct
        tid = f"{tag}-{i}"
        for r in range(runs_per_thread):
            a, b = rng.randint(100, 999), rng.randint(100, 999)
            t0 = time.perf_counter()
            try:
                res = await agent.ainvoke({"messages": [{"role": "user", "content": f"Use the add tool to add {a} and {b}."}]}, {"configurable": {"thread_id": tid}})
                ok_runs += 1
                txt = str(res["messages"][-1].content).replace(",", "")
                if re.search(rf"(?<!\d){a + b}(?!\d)", txt):
                    correct += 1
            except Exception as e:
                errors.append(f"{type(e).__name__}: {str(e)[:200]}")
            run_ms.append((time.perf_counter() - t0) * 1000)

    stop, samples = asyncio.Event(), []
    mon = asyncio.create_task(monitor(stop, samples))
    cpu0 = os.times()
    t0 = time.perf_counter()
    await asyncio.gather(*(thread_work(i) for i in range(n)))
    wall = time.perf_counter() - t0
    cpu1 = os.times()
    stop.set()
    await mon
    with psycopg.connect(DSN, autocommit=True) as c:
        rows_ck = c.execute("select count(*) from checkpoints where thread_id like %s", (tag + "-%",)).fetchone()[0]
        rows_wr = c.execute("select count(*) from checkpoint_writes where thread_id like %s", (tag + "-%",)).fetchone()[0]
        rows_bl = c.execute("select count(*) from checkpoint_blobs where thread_id like %s", (tag + "-%",)).fetchone()[0]
    pool_stats = pool.get_stats() if pool else None
    if ctx:
        await ctx.__aexit__(None, None, None)
    if pool:
        await pool.close()
    mt = [m["t1"] - m["t0"] for m in S.model]
    out_tok = sum(m["out_tok"] or 0 for m in S.model)
    ivs = [(m["t0"], m["t1"]) for m in S.model]
    srv_busy = sum(m["server_ms"] for m in S.model) / 1000
    rec = {"exp": "T16r", "config": config, "level": n, "rep": rep, "runs_per_thread": runs_per_thread, "wall_s": round(wall, 3),
           "runs_expected": n * runs_per_thread, "runs_ok": ok_runs, "runs_correct": correct, "errors": len(errors), "error_examples": errors[:3],
           "run_ms": dist(run_ms), "model_calls": len(S.model), "model_call_s": dist(mt), "model_calls_per_s": round(len(S.model) / wall, 3),
           "out_tok_per_s": round(out_tok / wall, 2), "in_tok_sum": sum(m["in_tok"] or 0 for m in S.model), "out_tok_sum": out_tok,
           "model_client_overlap_max": max_overlap(ivs), "ollama_server_busy_s": round(srv_busy, 2), "ollama_busy_share_of_wall": round(srv_busy / wall, 3),
           "ckpt_put_ms": dist(S.put), "ckpt_put_writes_ms": dist(S.writes), "ckpt_get_tuple_ms": dist(S.get),
           "ckpt_ms_total": round(sum(S.put) + sum(S.writes) + sum(S.get), 1),
           "rows": {"checkpoints": rows_ck, "writes": rows_wr, "blobs": rows_bl},
           "pg_conns": {"max": max((s[0] for s in samples), default=None), "max_active": max((s[1] for s in samples), default=None), "samples": len(samples)},
           "client_cpu_s": round((cpu1.user - cpu0.user) + (cpu1.system - cpu0.system), 2), "pool_stats": pool_stats, "load": os.getloadavg()}
    jl(out, rec)
    print(json.dumps({k: rec[k] for k in ("config", "level", "rep", "wall_s", "runs_ok", "runs_correct", "errors", "model_calls_per_s", "model_client_overlap_max", "ckpt_put_ms", "pg_conns")}), flush=True)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--levels", default="1,4,16,64")
    ap.add_argument("--configs", default="single,pool20")
    ap.add_argument("--reps", type=int, default=2)
    ap.add_argument("--runs-per-thread", type=int, default=2)
    a = ap.parse_args()
    model = chat(num_predict=128, num_ctx=8192)
    jl(a.out, header("t16r_conc.py", levels=a.levels, configs=a.configs, reps=a.reps, runs_per_thread=a.runs_per_thread, num_predict=128, num_ctx=8192, pg=DSN,
                     durability="async (default)", system_prompt=SYSTEM))
    for rep in range(a.reps):
        for n in [int(x) for x in a.levels.split(",")]:
            for config in a.configs.split(","):
                await level(a.out, config, n, rep, a.runs_per_thread, model)
    jl(a.out, {"kind": "done", "time": time.time()})


if __name__ == "__main__":
    asyncio.run(main())
