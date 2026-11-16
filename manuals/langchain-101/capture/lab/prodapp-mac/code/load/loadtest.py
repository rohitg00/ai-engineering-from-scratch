import asyncio
import itertools
import json
import statistics
import subprocess
import sys
import time
from collections import Counter
from pathlib import Path

import httpx
import psycopg

from tests.procs import DSN, Server, reset_user, sql

CHECKPOINT_TABLES = ["checkpoints", "checkpoint_blobs", "checkpoint_writes"]


def turns(user):
    return [
        ("runs", {"message": f"Where is my order ORD-{user}-2?"}),
        ("runs", {"message": "How long does shipping take?"}),
        ("runs", {"message": f"Please refund order ORD-{user}-3 in full, 2400 cents. Reason: the bottle leaks."}),
        ("approve", {"decision": "approve"}),
    ]


async def one_run(http, url, thread_id, path, body):
    started, first_token, status, code = time.perf_counter(), None, None, None
    async with http.stream("POST", f"{url}/threads/{thread_id}/{path}", json=body) as response:
        code = response.status_code
        event = None
        async for line in response.aiter_lines():
            if line.startswith("event: "):
                event = line[7:]
                if event == "token" and first_token is None:
                    first_token = time.perf_counter() - started
            elif line.startswith("data: ") and event == "done":
                status = json.loads(line[6:])["status"]
    return {"kind": path, "url": url, "seconds": time.perf_counter() - started, "ttft": first_token,
            "status": status, "code": code}


async def user_session(urls, user):
    limits = httpx.Limits(max_connections=10)
    async with httpx.AsyncClient(headers={"Authorization": f"Bearer tok-{user}"}, timeout=120, limits=limits) as http:
        rows = []
        try:
            thread_id = (await http.post(f"{next(urls)}/threads")).json()["thread_id"]
            for path, body in turns(user):
                rows.append(await one_run(http, next(urls), thread_id, path, body))
        except Exception as exc:
            rows.append({"kind": "error", "error": type(exc).__name__, "status": None, "code": None})
        return rows


async def sample_connections(stop, samples):
    async with await psycopg.AsyncConnection.connect(DSN, autocommit=True) as conn:
        while not stop.is_set():
            cur = await conn.execute("select count(*) from pg_stat_activity where datname = 'lc_prod' and pid <> pg_backend_pid()")
            samples.append((await cur.fetchone())[0])
            await asyncio.sleep(0.1)


def checkpoint_footprint():
    out = {}
    for table in CHECKPOINT_TABLES:
        row = sql(f"select count(*) n, coalesce(sum(pg_column_size(t.*)), 0) data_bytes,"
                  f" pg_total_relation_size('{table}') disk_bytes from {table} t")[0]
        out[table] = row
    return out


def machine():
    ps = httpx.get("http://localhost:11434/api/ps", timeout=5).json()["models"]
    return {"uptime": subprocess.run(["uptime"], capture_output=True, text=True).stdout.strip(),
            "ollama_loaded": [m["name"] for m in ps]}


def pct(values, q):
    values = sorted(values)
    return values[min(len(values) - 1, int(round(q * (len(values) - 1))))]


async def level(users_n, latency, pool_max, run_dir, workers=1):
    users = [f"u{n:03d}" for n in range(1, users_n + 1)]
    tokens = ",".join(f"tok-{u}={u}" for u in users)
    name = f"load-{workers}w-{users_n}u-{int(latency * 1000)}ms"
    sql("truncate " + ", ".join(CHECKPOINT_TABLES))
    servers = [Server(run_dir, f"{name}-w{i}", AUTH_TOKENS=tokens, MODEL_LATENCY=latency, POOL_MAX=pool_max)
               for i in range(workers)]
    urls = itertools.cycle([s.url for s in servers])
    for user in users:
        reset_user(user)
    before = machine()
    stop, samples = asyncio.Event(), []
    sampler = asyncio.create_task(sample_connections(stop, samples))
    started = time.perf_counter()
    results = await asyncio.gather(*(user_session(urls, u) for u in users))
    wall = time.perf_counter() - started
    stop.set()
    await sampler
    for server in servers:
        server.stop()
    rows = [r for session in results for r in session]
    ok = [r for r in rows if r["code"] == 200 and r["status"] in ("done", "interrupted")]
    seconds = [r["seconds"] for r in ok]
    ttft = [r["ttft"] for r in ok if r["ttft"] is not None]
    footprint = checkpoint_footprint()
    refunds = sql("select count(*) n, count(distinct order_id) orders from refunds where order_id = any(%s)",
                  [f"ORD-{u}-3" for u in users])[0]
    runs_n = len(rows)
    summary = {
        "machine_before": before, "machine_after": machine(),
        "kinds": dict(Counter(f"{r['kind']}:{r['code']}:{r['status']}" for r in rows)),
        "workers": workers, "users": users_n, "model_latency_s": latency, "pool_max": pool_max, "runs": runs_n, "ok": len(ok),
        "errors": runs_n - len(ok), "codes": dict(sorted(Counter(str(r["code"]) for r in rows).items())), "wall_s": round(wall, 2), "runs_per_s": round(len(ok) / wall, 1),
        "p50_s": round(statistics.median(seconds), 4), "p95_s": round(pct(seconds, 0.95), 4),
        "max_s": round(max(seconds), 4), "ttft_p50_s": round(statistics.median(ttft), 4),
        "ttft_p95_s": round(pct(ttft, 0.95), 4),
        "pg_conn_max": max(samples), "pg_conn_mean": round(statistics.mean(samples), 1), "pg_samples": len(samples),
        "checkpoint_rows": {t: v["n"] for t, v in footprint.items()},
        "checkpoint_rows_per_run": round(sum(v["n"] for v in footprint.values()) / runs_n, 1),
        "checkpoint_data_bytes_per_run": round(sum(v["data_bytes"] for v in footprint.values()) / runs_n),
        "checkpoint_disk_bytes_per_run": round(sum(v["disk_bytes"] for v in footprint.values()) / runs_n),
        "refunds": refunds,
    }
    (Path(run_dir) / f"{name}.rows.json").write_text(json.dumps(rows))
    return summary


async def main(run_dir, levels="10,50,100", latencies="0,0.5", pool_max="20", workers="1"):
    Path(run_dir).mkdir(parents=True, exist_ok=True)
    out = []
    for count in map(int, workers.split(",")):
        for latency in map(float, latencies.split(",")):
            for users_n in map(int, levels.split(",")):
                summary = await level(users_n, latency, int(pool_max), run_dir, count)
                print(json.dumps(summary), flush=True)
                out.append(summary)
    (Path(run_dir) / "load-summary.json").write_text(json.dumps(out, indent=2))


if __name__ == "__main__":
    asyncio.run(main(*sys.argv[1:]))
