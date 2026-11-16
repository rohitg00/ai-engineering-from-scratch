import asyncio
import json
import subprocess
import sys
import time
import urllib.request
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")
LAB_PY = sys.argv[2]
SERVER = Path(__file__).resolve().parent / "t12_server.py"
OUT = Path(sys.argv[1])
PORT = 18932

from langchain_mcp_adapters.client import MultiServerMCPClient

rows = []


def rec(transport, case, **kw):
    row = {"transport": transport, "case": case, **kw}
    rows.append(row)
    print(json.dumps(row, default=str)[:420], flush=True)


def tm(m):
    return {"type": type(m).__name__, "status": getattr(m, "status", None), "content": str(getattr(m, "content", m))[:240], "artifact": str(getattr(m, "artifact", None))[:160]}


async def call(tool, args, limit=30):
    t0 = time.perf_counter()
    try:
        out = await asyncio.wait_for(tool.ainvoke({"name": tool.name, "args": args, "id": "c1", "type": "tool_call"}), limit)
        return {"ok": tm(out), "secs": round(time.perf_counter() - t0, 3)}
    except asyncio.TimeoutError:
        return {"hung": f"no result after {limit}s", "secs": round(time.perf_counter() - t0, 3)}
    except BaseException as e:
        return {"raised": f"{type(e).__name__}: {str(e).splitlines()[0][:240] if str(e) else ''}", "secs": round(time.perf_counter() - t0, 3)}


async def scenario(name, conn):
    client = MultiServerMCPClient({"s": conn})
    t0 = time.perf_counter()
    try:
        tools = await client.get_tools()
    except BaseException as e:
        rec(name, "get_tools", raised=f"{type(e).__name__}: {str(e)[:300]}")
        return
    by = {t.name: t for t in tools}
    rec(name, "get_tools", tools=[(t.name, t.description, sorted(t.args)) for t in tools], secs=round(time.perf_counter() - t0, 3))
    rec(name, "call add(2,3)", **(await call(by["add"], {"a": 2, "b": 3})))
    rec(name, "call fail (isError)", **(await call(by["fail"], {"reason": "nope"})))
    rec(name, "call boom", **(await call(by["boom"], {})))
    lat = []
    for i in range(50):
        t1 = time.perf_counter()
        await by["add"].ainvoke({"a": i, "b": 1})
        lat.append((time.perf_counter() - t1) * 1000)
    lat.sort()
    rec(name, "50 x add (new session per call)", median_ms=round(lat[25], 2), p95_ms=round(lat[47], 2))
    rec(name, "call crash", **(await call(by["crash"], {}, limit=40)))
    rec(name, "call add after crash", **(await call(by["add"], {"a": 1, "b": 2}, limit=40)))


async def main():
    await scenario("stdio", {"transport": "stdio", "command": LAB_PY, "args": [str(SERVER), "stdio"]})
    p = subprocess.Popen([LAB_PY, str(SERVER), "http", str(PORT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(100):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{PORT}/mcp", timeout=0.5)
        except urllib.error.HTTPError:
            break
        except Exception:
            time.sleep(0.1)
    try:
        await scenario("http", {"transport": "streamable_http", "url": f"http://127.0.0.1:{PORT}/mcp"})
    finally:
        if p.poll() is None:
            p.terminate()
            p.wait(5)
    import importlib.metadata as md
    rows.insert(0, {"meta": {k: md.version(k) for k in ["langchain-mcp-adapters", "mcp", "langchain-core"]}})
    OUT.write_text("\n".join(json.dumps(r, default=str) for r in rows) + "\n")


asyncio.run(main())
