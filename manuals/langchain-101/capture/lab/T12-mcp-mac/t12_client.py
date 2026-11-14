import asyncio
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request
import warnings
from pathlib import Path

os.environ["LANGSMITH_TRACING"] = "false"
warnings.filterwarnings("ignore")

EV = Path(__file__).resolve().parent.parent
SERVER = Path(__file__).resolve().parent / "t12_server.py"
MARKS = EV / "T12" / "_marks"
PY = sys.executable
OUT = Path(sys.argv[1])
HTTP_PORT = 18931

from fastmcp import Client
from fastmcp.client.transports import StdioTransport
from langchain.mcp import MCPAdapter
from langchain_core.messages import AIMessage

rows = []


def launches():
    return len(list(MARKS.glob("LAUNCHED-*")))


def reset_marks():
    shutil.rmtree(MARKS, ignore_errors=True)
    MARKS.mkdir(parents=True)


def rec(transport, case, **kw):
    row = {"transport": transport, "case": case, **kw}
    rows.append(row)
    print(json.dumps(row, default=str)[:500], flush=True)


def tm(msg):
    if hasattr(msg, "content"):
        return {"type": type(msg).__name__, "status": getattr(msg, "status", None), "content": str(msg.content)[:240], "artifact": str(getattr(msg, "artifact", None))[:160]}
    return {"type": type(msg).__name__, "value": str(msg)[:240]}


async def call(tool, args, i="c1", limit=30):
    t0 = time.perf_counter()
    try:
        out = await asyncio.wait_for(tool.ainvoke({"name": tool.name, "args": args, "id": i, "type": "tool_call"}), limit)
        return {"ok": tm(out), "secs": round(time.perf_counter() - t0, 3)}
    except asyncio.TimeoutError:
        return {"hung": f"no result after {limit}s (outer wait_for)", "secs": round(time.perf_counter() - t0, 3)}
    except BaseException as e:
        return {"raised": f"{type(e).__name__}: {str(e).splitlines()[0][:240] if str(e) else ''}", "secs": round(time.perf_counter() - t0, 3)}


def start_http():
    p = subprocess.Popen([PY, str(SERVER), "http", str(HTTP_PORT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(100):
        try:
            urllib.request.urlopen(f"http://127.0.0.1:{HTTP_PORT}/mcp", timeout=0.5)
        except urllib.error.HTTPError:
            return p
        except Exception:
            time.sleep(0.1)
    return p


def stdio_target():
    return StdioTransport(command=PY, args=[str(SERVER), "stdio"])


async def scenario(name, make_target, make_timeout_client):
    reset_marks()
    adapter = MCPAdapter(make_target())
    t0 = time.perf_counter()
    tools = await adapter.list_tools()
    by = {t.name: t for t in tools}
    rec(name, "list_tools", tools=[(t.name, t.description, sorted(t.args)) for t in tools], secs=round(time.perf_counter() - t0, 3), launches=launches())
    rec(name, "call add(2,3), no open context", **(await call(by["add"], {"a": 2, "b": 3})), launches=launches())
    rec(name, "call fail (ToolError -> isError)", **(await call(by["fail"], {"reason": "nope"})), launches=launches())
    rec(name, "call boom (RuntimeError in tool)", **(await call(by["boom"], {})), launches=launches())
    rec(name, "call slow(2), default client timeout", **(await call(by["slow"], {"seconds": 2})), launches=launches())
    n0 = launches()
    lat = []
    for i in range(50):
        t1 = time.perf_counter()
        await by["add"].ainvoke({"a": i, "b": 1})
        lat.append((time.perf_counter() - t1) * 1000)
    lat.sort()
    rec(name, "50 x add, no open context", median_ms=round(lat[25], 2), p95_ms=round(lat[47], 2), new_launches=launches() - n0)
    n0 = launches()
    lat = []
    async with adapter:
        for i in range(50):
            t1 = time.perf_counter()
            await by["add"].ainvoke({"a": i, "b": 1})
            lat.append((time.perf_counter() - t1) * 1000)
    lat.sort()
    rec(name, "50 x add inside `async with adapter`", median_ms=round(lat[25], 2), p95_ms=round(lat[47], 2), new_launches=launches() - n0)
    tadapter = MCPAdapter(make_timeout_client())
    ttools = {t.name: t for t in await tadapter.list_tools()}
    rec(name, "call slow(5) with fastmcp Client(timeout=1)", **(await call(ttools["slow"], {"seconds": 5})), launches=launches())
    rec(name, "call add after the timed-out call", **(await call(ttools["add"], {"a": 1, "b": 1})), launches=launches())
    from langchain.agents import create_agent
    from fake_tools import ToolFake
    for tname, targs in [("fail", {"reason": "agent"}), ("slow", {"seconds": 0.2})]:
        fake = ToolFake(script=[AIMessage(content="", tool_calls=[{"name": tname, "args": targs, "id": "a1", "type": "tool_call"}]), AIMessage(content="done")])
        agent = create_agent(fake, tools=tools)
        try:
            res = await asyncio.wait_for(agent.ainvoke({"messages": [{"role": "user", "content": "go"}]}), 30)
            rec(name, f"create_agent + fake model calls {tname}", messages=[tm(m) for m in res["messages"]])
        except BaseException as e:
            rec(name, f"create_agent + fake model calls {tname}", raised=f"{type(e).__name__}: {str(e)[:200]}")
    n0 = launches()
    rec(name, "call crash (server os._exit mid-call)", **(await call(by["crash"], {}, limit=40)), launches=launches())
    rec(name, "call add after the crash", **(await call(by["add"], {"a": 1, "b": 2}, limit=40)), new_launches=launches() - n0)
    fake = ToolFake(script=[AIMessage(content="", tool_calls=[{"name": "crash", "args": {}, "id": "a1", "type": "tool_call"}]), AIMessage(content="done")])
    agent = create_agent(fake, tools=tools)
    t0 = time.perf_counter()
    try:
        res = await asyncio.wait_for(agent.ainvoke({"messages": [{"role": "user", "content": "go"}]}), 40)
        rec(name, "create_agent + fake model calls crash", messages=[tm(m) for m in res["messages"]], secs=round(time.perf_counter() - t0, 2))
    except BaseException as e:
        rec(name, "create_agent + fake model calls crash", raised=f"{type(e).__name__}: {str(e)[:200]}", secs=round(time.perf_counter() - t0, 2))


async def string_targets():
    reset_marks()
    cwd = os.getcwd()
    os.chdir(SERVER.parent)
    try:
        for label, target in [("relative str 't12_server.py'", "t12_server.py"), ("absolute str path", str(SERVER)),
                              ("str 'file:///...t12_server.py'", SERVER.as_uri()), ("str 'http://127.0.0.1:9/mcp'", "http://127.0.0.1:9/mcp")]:
            try:
                MCPAdapter(target)
                rec("string-target", f"MCPAdapter({label})", constructed=True, launches=launches())
            except Exception as e:
                rec("string-target", f"MCPAdapter({label})", raised=f"{type(e).__name__}: {str(e)[:260]}", launches=launches())
        try:
            async with asyncio.timeout(20):
                async with Client("t12_server.py") as c:
                    names = [t.name for t in await c.list_tools()]
            rec("string-target", "fastmcp.Client('t12_server.py') directly", tools=names, launches=launches())
        except Exception as e:
            rec("string-target", "fastmcp.Client('t12_server.py') directly", raised=f"{type(e).__name__}: {str(e)[:200]}", launches=launches())
        try:
            async with asyncio.timeout(20):
                tools = await MCPAdapter(Path("t12_server.py")).list_tools()
            rec("string-target", "MCPAdapter(Path('t12_server.py'))", tools=[t.name for t in tools], launches=launches())
        except Exception as e:
            rec("string-target", "MCPAdapter(Path('t12_server.py'))", raised=f"{type(e).__name__}: {str(e)[:200]}", launches=launches())
    finally:
        os.chdir(cwd)


async def main():
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    await string_targets()
    await scenario("stdio", stdio_target, lambda: Client(stdio_target(), timeout=1))
    http = start_http()
    try:
        await scenario("http", lambda: f"http://127.0.0.1:{HTTP_PORT}/mcp", lambda: Client(f"http://127.0.0.1:{HTTP_PORT}/mcp", timeout=1))
        rec("http", "server process after crash", returncode=http.poll())
    finally:
        if http.poll() is None:
            http.terminate()
            http.wait(5)
    import importlib.metadata as md
    rows.insert(0, {"meta": {p: md.version(p) for p in ["langchain", "langchain-core", "fastmcp", "mcp"]}, "python": sys.version.split()[0]})
    OUT.write_text("\n".join(json.dumps(r, default=str) for r in rows) + "\n")


asyncio.run(main())
