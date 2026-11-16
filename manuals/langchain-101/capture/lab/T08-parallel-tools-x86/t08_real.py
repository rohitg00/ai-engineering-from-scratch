import argparse
import asyncio
import json
import os
import random
import sys
import threading
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lr_common import MODEL, MODEL8, PG, chat, chat_openai, header, jl

import httpx
import psycopg
from langchain.agents import create_agent
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.messages import AIMessage, ToolMessage
from langchain_core.tools import StructuredTool, tool

OUT = Path(__file__).resolve().parent
STAMPS = []
LOCK = threading.Lock()


def stamp(kind, q, t0, t1):
    with LOCK:
        STAMPS.append({"kind": kind, "id": q, "start": t0, "end": t1, "thread": threading.current_thread().name})


def work_sync(q: str) -> str:
    t0 = time.perf_counter_ns()
    with psycopg.connect(PG) as c:
        c.execute("select pg_sleep(0.2)")
    stamp("sync", q, t0, time.perf_counter_ns())
    return "ok " + q


async def work_async(q: str) -> str:
    t0 = time.perf_counter_ns()
    async with await psycopg.AsyncConnection.connect(PG) as c:
        await c.execute("select pg_sleep(0.2)")
    stamp("async", q, t0, time.perf_counter_ns())
    return "ok " + q


DESC = "Run one unit of work for the query q. It takes about 200 ms."
TOOLS = {"sync": StructuredTool.from_function(func=work_sync, name="work", description=DESC),
         "async": StructuredTool.from_function(coroutine=work_async, name="work", description=DESC)}


def ask(n):
    qs = ", ".join(f"q='c{i}'" for i in range(n))
    if n == 1:
        return "Call the tool work once with q='c0', then reply with the single word: done."
    return (f"Call the tool work {n} times in one reply, as {n} parallel tool calls, with these arguments: {qs}. "
            "After the results come back, reply with the single word: done.")


def max_overlap(st):
    ev = sorted([(s["start"], 1) for s in st] + [(s["end"], -1) for s in st], key=lambda x: (x[0], x[1]))
    cur = best = 0
    for _, d in ev:
        cur += d
        best = max(best, cur)
    return best


def phase_count(out):
    jl(out, header("t08_real.py count", note="how many parallel calls the real model makes when asked for N"))
    for model in (MODEL, MODEL8):
        for client in ("chatollama", "chatopenai_ollama_v1"):
            llm = chat(model=model) if client == "chatollama" else chat_openai(model=model, timeout=600)
            if client == "chatopenai_ollama_v1" and model == MODEL8:
                llm = chat_openai(model=model, timeout=600, reasoning_effort="none")
            b = llm.bind_tools([TOOLS["sync"]])
            for n in (1, 2, 4, 8, 16):
                t0 = time.time()
                err = None
                try:
                    m = b.invoke(ask(n))
                    calls = [[t["name"], t["args"], t.get("id")] for t in m.tool_calls]
                    inv = len(m.invalid_tool_calls)
                except Exception as e:
                    err, calls, inv, m = f"{type(e).__name__}: {e}"[:300], [], 0, None
                rec = {"phase": "count", "model": model, "client": client, "asked": n, "made": len(calls),
                       "distinct_q": len({json.dumps(c[1], sort_keys=True) for c in calls}), "all_have_id": all(c[2] for c in calls) if calls else None,
                       "calls": calls, "invalid": inv, "error": err, "secs": round(time.time() - t0, 2),
                       "message": m.model_dump(mode="json", exclude={"response_metadata"}) if (m is not None and model == MODEL) else None}
                jl(out, rec)
                print(model, client, n, "made", rec["made"], rec["distinct_q"], rec["all_have_id"], rec["secs"], err, flush=True)


def phase_raw(out):
    jl(out, header("t08_real.py raw", note="raw HTTP answers of Ollama, native and /v1, for a two-call request"))
    tools_native = [{"type": "function", "function": {"name": "work", "description": DESC,
                     "parameters": {"type": "object", "properties": {"q": {"type": "string"}}, "required": ["q"]}}}]
    msg = [{"role": "user", "content": ask(2)}]
    r1 = httpx.post("http://127.0.0.1:11434/api/chat", json={"model": MODEL, "messages": msg, "tools": tools_native, "stream": False,
                                                              "options": {"temperature": 0, "seed": 42}}, timeout=600).json()
    r2 = httpx.post("http://127.0.0.1:11434/v1/chat/completions", json={"model": MODEL, "messages": msg, "tools": tools_native,
                                                                         "temperature": 0, "seed": 42}, timeout=600).json()
    jl(out, {"phase": "raw", "api": "/api/chat stream=false", "message": r1.get("message")})
    jl(out, {"phase": "raw", "api": "/v1/chat/completions", "message": r2["choices"][0]["message"]})
    print("native", json.dumps(r1.get("message"))[:400])
    print("v1", json.dumps(r2["choices"][0]["message"])[:400])


def run_graph(graph, inp, mode, mc):
    cfg = {} if mc is None else {"max_concurrency": mc}
    STAMPS.clear()
    err = None
    out = None
    t0 = time.perf_counter_ns()
    try:
        out = graph.invoke(inp, cfg) if mode == "invoke" else asyncio.run(graph.ainvoke(inp, cfg))
    except Exception as e:
        err = f"{type(e).__name__}: {e}"[:300]
    t1 = time.perf_counter_ns()
    st = list(STAMPS)
    msgs = (out or {}).get("messages", [])
    first = next((m for m in msgs if isinstance(m, AIMessage) and m.tool_calls), None)
    return {"wall_ms": (t1 - t0) / 1e6, "tool_span_ms": (max(s["end"] for s in st) - min(s["start"] for s in st)) / 1e6 if st else None,
            "max_overlap": max_overlap(st) if st else 0, "n_exec": len(st), "n_toolmsgs": sum(1 for m in msgs if isinstance(m, ToolMessage)),
            "n_calls_made": len(first.tool_calls) if first else None, "threads": len({s["thread"] for s in st}), "error": err,
            "final": str(msgs[-1].content)[:80] if msgs else None,
            "stamps": [[s["id"], round((s["start"] - t0) / 1e6, 2), round((s["end"] - t0) / 1e6, 2), s["thread"]] for s in st]}


def phase_toolnode(out, reps, count_file):
    from langgraph.graph import END, START, MessagesState, StateGraph
    from langgraph.prebuilt import ToolNode
    real = {}
    for l in (OUT / count_file).read_text().splitlines():
        r = json.loads(l)
        if r.get("phase") == "count" and r["model"] == MODEL and r["client"] == "chatollama" and r.get("message"):
            real[r["asked"]] = r
    jl(out, header("t08_real.py toolnode", note="ToolNode harness fed with the AIMessage that the real model returned for each N",
                   source=count_file, made={k: v["made"] for k, v in real.items()}))
    cells = [(m, t, n, mc) for m in ("invoke", "ainvoke") for t in ("sync", "async") for n in sorted(real) for mc in (None, 1, 2, 4, 8)]
    for rep in range(-1, reps):
        order = cells[:]
        random.Random(rep + 100).shuffle(order)
        for mode, tk, n, mc in order:
            b = StateGraph(MessagesState)
            b.add_node("tools", ToolNode([TOOLS[tk]]))
            b.add_edge(START, "tools")
            b.add_edge("tools", END)
            g = b.compile()
            msg = AIMessage(**{k: v for k, v in real[n]["message"].items() if k in ("content", "tool_calls", "id")})
            rec = {"phase": "toolnode", "mode": mode, "tool": tk, "asked": n, "max_concurrency": mc, "rep": rep, "warmup": rep < 0,
                   "load": os.getloadavg(), **run_graph(g, {"messages": [msg]}, mode, mc)}
            jl(out, rec)
        print("toolnode rep", rep, os.getloadavg(), flush=True)


def phase_agent(out, reps, n):
    jl(out, header("t08_real.py agent", note="create_agent with the real model each run", asked=n, prompt=ask(n)))
    cells = [(m, t, mc) for m in ("invoke", "ainvoke") for t in ("sync", "async") for mc in (None, 1, 4)]
    for rep in range(reps):
        order = cells[:]
        random.Random(rep + 200).shuffle(order)
        for mode, tk, mc in order:
            g = create_agent(chat(), tools=[TOOLS[tk]])
            t0 = time.time()
            rec = {"phase": "agent", "mode": mode, "tool": tk, "asked": n, "max_concurrency": mc, "rep": rep, "load": os.getloadavg(),
                   **run_graph(g, {"messages": [{"role": "user", "content": ask(n)}]}, mode, mc)}
            jl(out, rec)
            print("agent", mode, tk, mc, rep, "made", rec["n_calls_made"], "overlap", rec["max_overlap"], "span", rec["tool_span_ms"],
                  rec["error"], round(time.time() - t0, 1), flush=True)


class Bound(BaseCallbackHandler):
    def __init__(self):
        self.tools = None

    def on_chat_model_start(self, serialized, messages, invocation_params=None, **kw):
        if self.tools is None and invocation_params:
            self.tools = [[t.get("function", t).get("name"), t.get("function", t).get("description")] for t in invocation_params.get("tools", [])]


def phase_dupnames(out, reps):
    jl(out, header("t08_real.py dupnames", note="two tools named account_action, langgraph#7988, real model"))
    ran = []

    @tool("account_action")
    def safe_lookup(account_id: str) -> str:
        """Look up an account without side effects."""
        ran.append("safe_lookup")
        return "SAFE_LOOKUP:" + account_id

    @tool("account_action")
    def privileged_delete(account_id: str) -> str:
        """Delete an account."""
        ran.append("privileged_delete")
        return "PRIVILEGED_DELETE:" + account_id

    for prompt in ("Look up the account acct-7.", "Delete the account acct-7."):
        for order in (["safe", "priv"], ["priv", "safe"]):
            for rep in range(reps):
                ran.clear()
                tools = [safe_lookup, privileged_delete] if order[0] == "safe" else [privileged_delete, safe_lookup]
                cb = Bound()
                err = None
                res = None
                try:
                    res = create_agent(chat(), tools=tools).invoke({"messages": [{"role": "user", "content": prompt}]}, {"callbacks": [cb]})
                except Exception as e:
                    err = f"{type(e).__name__}: {e}"[:300]
                msgs = (res or {}).get("messages", [])
                rec = {"phase": "dupnames", "prompt": prompt, "order": order, "rep": rep, "bound_to_model": cb.tools, "ran": list(ran),
                       "model_calls": [[t["name"], t["args"]] for m in msgs if isinstance(m, AIMessage) for t in m.tool_calls],
                       "tool_messages": [str(m.content)[:60] for m in msgs if isinstance(m, ToolMessage)],
                       "final": str(msgs[-1].content)[:200] if msgs else None, "error": err}
                jl(out, rec)
                print(json.dumps(rec)[:300], flush=True)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--phase", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--reps", type=int, default=3)
    p.add_argument("--n", type=int, default=8)
    p.add_argument("--count-file", default="01-counts.jsonl")
    a = p.parse_args()
    out = OUT / a.out
    if a.phase == "count":
        phase_count(out)
    elif a.phase == "raw":
        phase_raw(out)
    elif a.phase == "toolnode":
        phase_toolnode(out, a.reps, a.count_file)
    elif a.phase == "agent":
        phase_agent(out, a.reps, a.n)
    elif a.phase == "dupnames":
        phase_dupnames(out, a.reps)


if __name__ == "__main__":
    main()
