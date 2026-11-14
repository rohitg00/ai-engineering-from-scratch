import asyncio
import json
import logging
import os
import socket
import subprocess
import sys
import time
import traceback
import warnings
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE
PY = sys.executable


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


def jsonable(x):
    try:
        json.dumps(x)
        return x
    except TypeError:
        if isinstance(x, dict):
            return {k: jsonable(v) for k, v in x.items()}
        if isinstance(x, (list, tuple)):
            return [jsonable(v) for v in x]
        return repr(x)[:300]


def tm(msg):
    return {"type": type(msg).__name__, "status": getattr(msg, "status", None),
            "text": [b.get("text") for b in msg.content if isinstance(b, dict)] if isinstance(msg.content, list) else msg.content,
            "artifact": jsonable(getattr(msg, "artifact", None))}


async def child(case, url):
    warnings.filterwarnings("ignore")
    sys.path.insert(0, str(HERE))
    import t20_server
    from fastmcp import Client
    from langchain.agents import create_agent
    from langchain.mcp import MCPAdapter, as_langchain_tool
    from langchain_core.messages import AIMessage
    from langgraph.checkpoint.memory import InMemorySaver
    from langgraph.types import Command
    from fake_tools import ToolFake

    server = t20_server.mcp
    target = url if url else server
    rec = {"case": case, "transport": "http" if url else "in-process", "events": []}
    ev = rec["events"]
    handler_calls = []
    progress_calls = []

    async def elicit_handler(message, response_type, params, context):
        handler_calls.append({"message": message, "response_type": repr(response_type)[:80]})
        if case.endswith("legacy-handler") or "legacy" in case:
            return "Grace"
        return {"name": "Grace"}

    async def progress_handler(progress, total, message):
        progress_calls.append([progress, total, message, round(time.perf_counter() - t0, 3)])

    mode = "legacy" if "legacy" in case else "auto"
    kw = {}
    if "handler" in case:
        kw["elicitation_handler"] = elicit_handler
    if case.startswith("P") and "phandler" in case:
        kw["progress_handler"] = progress_handler
    t0 = time.perf_counter()
    if case.startswith("E6"):
        client = Client(target, mode=mode)
        async with client:
            rec["protocol"] = client.protocol_version
            mtools = {t.name: t for t in await client.list_tools()}
        tools = {n: await as_langchain_tool(t, client) for n, t in mtools.items()}
    else:
        adapter_target = Client(target, mode=mode, **kw) if (mode == "legacy" or kw) else target
        adapter = MCPAdapter(adapter_target)
        async with adapter:
            rec["protocol"] = getattr(adapter.client, "protocol_version", None)
        tools = {t.name: t for t in await adapter.list_tools()}

    tool_name = {"E": "ask_legacy" if ("legacy" in case and "modernguard" not in case) else "ask_name", "S": "ok_structured" if "ok" in case else "fail_structured", "P": "long_task"}[case[0]]
    args = {"steps": 3} if tool_name == "long_task" else {}

    async def direct():
        try:
            r = await tools[tool_name].ainvoke({"type": "tool_call", "name": tool_name, "args": args, "id": "c1"})
            ev.append({"step": "direct", **tm(r)})
        except BaseException as e:
            ev.append({"step": "direct", "raised": f"{type(e).__module__}.{type(e).__name__}", "msg": str(e)[:400]})

    async def agent_run():
        fake = ToolFake(script=[AIMessage(content="", tool_calls=[{"name": tool_name, "args": args, "id": "c1", "type": "tool_call"}]), AIMessage(content="final")])
        cp = None if "nockpt" in case else InMemorySaver()
        agent = create_agent(fake, tools=list(tools.values()), checkpointer=cp)
        cfg = {"configurable": {"thread_id": "t1"}}
        try:
            chunks = []
            async for mode_, chunk in agent.astream({"messages": [{"role": "user", "content": "go"}]}, cfg, stream_mode=["updates", "custom"]):
                chunks.append([mode_, list(chunk) if isinstance(chunk, dict) else repr(chunk)[:100]])
                if mode_ == "updates" and "__interrupt__" in chunk:
                    ev.append({"step": "agent-interrupt", "value": jsonable(chunk["__interrupt__"][0].value)})
            ev.append({"step": "agent-stream", "chunks": chunks})
            if cp is not None:
                st = await agent.aget_state(cfg)
                ev.append({"step": "agent-state", "next": list(st.next), "n_interrupts": len(st.interrupts)})
                msgs = st.values.get("messages", [])
                tms = [tm(m) for m in msgs if type(m).__name__ == "ToolMessage"]
                if tms:
                    ev.append({"step": "agent-toolmessages", "tool_messages": tms, "last": msgs[-1].content if msgs else None})
                if st.interrupts:
                    action = {"accept": {"action": "accept", "content": {"name": "Ada"}}, "decline": {"action": "decline"}, "cancel": {"action": "cancel"}}
                    which = next((a for a in action if a in case), "accept")
                    out = await agent.ainvoke(Command(resume={"responses": {"name": action[which]}}), cfg)
                    msgs = out["messages"]
                    ev.append({"step": f"agent-resume-{which}", "tool_messages": [tm(m) for m in msgs if type(m).__name__ == "ToolMessage"],
                               "last": msgs[-1].content, "interrupt_after_resume": bool(out.get("__interrupt__"))})
        except BaseException as e:
            ev.append({"step": "agent", "raised": f"{type(e).__module__}.{type(e).__name__}", "msg": str(e)[:400], "tb_tail": traceback.format_exc().splitlines()[-3:]})

    if "direct" in case:
        await direct()
    if "agent" in case:
        await agent_run()
    if case.startswith("S") and "raw" in case:
        c = Client(target, mode=mode)
        async with c:
            r = await c.call_tool(tool_name, {}, raise_on_error=False)
        ev.append({"step": "raw-fastmcp", "is_error": r.is_error, "structured_content": r.structured_content, "text": [getattr(b, "text", None) for b in r.content]})
    rec["handler_calls"] = handler_calls
    rec["progress_calls"] = progress_calls
    if not url:
        rec["server_calls"] = dict(t20_server.CALLS)
    rec["wall_s"] = round(time.perf_counter() - t0, 3)
    print("T20RESULT " + json.dumps(rec), flush=True)


CASES = [
    "E1-modern-default-direct",
    "E2-modern-default-agent-accept",
    "E2-modern-default-agent-decline",
    "E2-modern-default-agent-cancel",
    "E2-modern-default-agent-nockpt",
    "E3-modern-handler-direct",
    "E3-modern-handler-agent",
    "E4-legacy-default-direct",
    "E4-legacy-default-agent",
    "E5-legacy-handler-direct",
    "E5-legacy-handler-agent",
    "E6-modern-noarm-direct",
    "E6-legacy-noarm-direct",
    "E7-legacy-modernguard-direct",
    "S1-modern-error-direct-raw",
    "S1-modern-error-agent",
    "S2-modern-ok-direct-raw",
    "S3-legacy-error-direct-raw",
    "P1-modern-default-direct",
    "P2-modern-phandler-direct",
    "P2-modern-phandler-agent",
    "P3-legacy-phandler-direct",
]
HTTP_CASES = ["E2-modern-default-agent-accept", "E3-modern-handler-direct", "E5-legacy-handler-direct", "S1-modern-error-direct-raw", "P2-modern-phandler-direct"]


def main():
    OUT.mkdir(exist_ok=True)
    n = int(os.environ.get("T20_N", "3"))
    only = os.environ.get("T20_ONLY")
    cases = [(c, False) for c in CASES] + [(c, True) for c in HTTP_CASES]
    if only:
        cases = [x for x in cases if x[0] in only.split(",")]
    env = {k: v for k, v in os.environ.items() if "proxy" not in k.lower()}
    env.update(LANGSMITH_TRACING="false", PYTHONDONTWRITEBYTECODE="1")
    rows = []
    port = free_port()
    srv = subprocess.Popen([PY, str(HERE / "t20_server.py"), str(port)], env=env, stdout=subprocess.DEVNULL, stderr=open(OUT / "_http-server-stderr.txt", "w"))
    url = f"http://127.0.0.1:{port}/mcp"
    deadline = time.time() + 20
    while time.time() < deadline:
        try:
            socket.create_connection(("127.0.0.1", port), 0.5).close()
            break
        except OSError:
            time.sleep(0.2)
    try:
        for rep in range(1, n + 1):
            for case, http in cases:
                cmd = [PY, __file__, "--child", case] + ([url] if http else [])
                try:
                    cp = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=120, cwd=str(OUT))
                    rc, so, se = cp.returncode, cp.stdout, cp.stderr
                except subprocess.TimeoutExpired as e:
                    rc, so, se = "timeout", "", ""
                line = [l for l in so.splitlines() if l.startswith("T20RESULT ")]
                res = json.loads(line[-1][10:]) if line else {"case": case, "transport": "http" if http else "in-process"}
                res.update(rep=rep, rc=rc, stderr_lines=len(se.splitlines()),
                           stderr_key=[l.strip()[:200] for l in se.splitlines() if any(k in l for k in ("Error", "error", "Warning", "Progress"))][:8])
                rows.append(res)
                print(rep, case, "http" if http else "inproc", rc, json.dumps(res.get("events"))[:260], flush=True)
    finally:
        srv.terminate()
        try:
            srv.wait(5)
        except subprocess.TimeoutExpired:
            srv.kill()
    (OUT / os.environ.get("T20_OUT", "01-mcp-edges.jsonl")).write_text("\n".join(json.dumps(r) for r in rows) + "\n")


if __name__ == "__main__":
    if len(sys.argv) > 2 and sys.argv[1] == "--child":
        asyncio.run(child(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None))
    else:
        main()
