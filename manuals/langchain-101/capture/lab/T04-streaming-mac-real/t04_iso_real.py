import asyncio
import json
import os
import sys
import time
import warnings
from pathlib import Path

os.environ["LANGSMITH_TRACING"] = "false"
warnings.filterwarnings("ignore")
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from mr_common import MODEL8, RecordingProxy, block_mark, header

REPS = int(sys.argv[1]) if len(sys.argv) > 1 else 5
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else HERE / "03-iso38484-qwen3-8b.jsonl"
PROMPT = "What is 17 * 23? Then count from 1 to 20, separated by single spaces."
NUM_PREDICT = 1500

proxy = RecordingProxy()

from langchain.agents import create_agent
from langchain_ollama import ChatOllama

agent = create_agent(model=ChatOllama(model=MODEL8, base_url=f"http://127.0.0.1:{proxy.port}", reasoning=True, temperature=0, seed=42,
                                      num_predict=NUM_PREDICT), tools=[])
INP = {"messages": [{"role": "user", "content": PROMPT}]}


def stamp(ev, kind):
    ev.append([time.time_ns(), kind])


async def consume_messages(ms, ev):
    async for message in ms:
        async for d in message.reasoning:
            if d:
                stamp(ev, "reasoning")
        async for d in message.text:
            if d:
                stamp(ev, "text")


async def consume_tools(tcs):
    async for tc in tcs:
        pass


async def consume_sub(subs, ev):
    async for sa in subs:
        await asyncio.gather(consume_messages(sa.messages, ev), consume_tools(sa.tool_calls), consume_sub(sa.subagents, ev))


async def p_reasoning_then_text(ev):
    stream = await agent.astream_events(INP, version="v3")
    async for m in stream.messages:
        async for d in m.reasoning:
            if d:
                stamp(ev, "reasoning")
        async for d in m.text:
            if d:
                stamp(ev, "text")
    await stream.output()


async def p_gather_issue(ev):
    stream = await agent.astream_events(INP, version="v3")
    await asyncio.gather(consume_messages(stream.messages, ev), consume_tools(stream.tool_calls), consume_sub(stream.subagents, ev))


async def p_text_then_reasoning(ev):
    stream = await agent.astream_events(INP, version="v3")
    async for m in stream.messages:
        async for d in m.text:
            if d:
                stamp(ev, "text")
        async for d in m.reasoning:
            if d:
                stamp(ev, "reasoning")
    await stream.output()


async def p_text_only(ev):
    stream = await agent.astream_events(INP, version="v3")
    async for m in stream.messages:
        async for d in m.text:
            if d:
                stamp(ev, "text")
    await stream.output()


async def p_raw_events(ev):
    stream = await agent.astream_events(INP, version="v3")
    async for e in stream:
        if e.get("method") != "messages":
            continue
        data = e["params"]["data"]
        x = data[0] if isinstance(data, (list, tuple)) else data
        if x.get("event") != "content-block-delta":
            continue
        d = x.get("delta", {})
        if d.get("type") == "text-delta" and d.get("text"):
            stamp(ev, "text")
        elif d.get("type") == "reasoning-delta" and d.get("reasoning"):
            stamp(ev, "reasoning")


PATTERNS = {"reasoning_then_text": p_reasoning_then_text, "gather_issue": p_gather_issue, "text_then_reasoning": p_text_then_reasoning,
            "text_only": p_text_only, "raw_events": p_raw_events}


def ms(a, b):
    return round((b - a) / 1e6, 3)


def analyze(ev, reqs, t0):
    out = {}
    srv_text = [e[0] for r in reqs for e in r.get("events", []) if e[1] == "text"]
    srv_reas = [e[0] for r in reqs for e in r.get("events", []) if e[1] == "reasoning"]
    cl_text = [t for t, k in ev if k == "text"]
    cl_reas = [t for t, k in ev if k == "reasoning"]
    out.update(server_text_lines=len(srv_text), server_reasoning_lines=len(srv_reas), client_text_deltas=len(cl_text), client_reasoning_deltas=len(cl_reas))
    if srv_text and cl_text:
        out.update(first_text_delay_ms=ms(srv_text[0], cl_text[0]), last_text_delay_ms=ms(srv_text[-1], cl_text[-1]),
                   emit_spread_ms=ms(srv_text[0], srv_text[-1]), receive_spread_ms=ms(cl_text[0], cl_text[-1]),
                   first_text_seen_ms=ms(t0, cl_text[0]))
        n = min(len(srv_text), len(cl_text))
        if len(srv_text) == len(cl_text):
            dl = sorted(ms(srv_text[i], cl_text[i]) for i in range(n))
            out.update(median_text_delay_ms=dl[n // 2], max_text_delay_ms=dl[-1])
    if srv_reas and cl_reas:
        out.update(first_reasoning_delay_ms=ms(srv_reas[0], cl_reas[0]), reasoning_receive_spread_ms=ms(cl_reas[0], cl_reas[-1]),
                   reasoning_emit_spread_ms=ms(srv_reas[0], srv_reas[-1]))
    if srv_reas and srv_text:
        out["server_last_reasoning_to_first_text_ms"] = ms(srv_reas[-1], srv_text[0])
    for r in reqs:
        for k in ("eval_count", "prompt_eval_count", "total_duration"):
            if k in r:
                out[k] = r[k]
    return out


async def main():
    fh = open(OUT, "a")
    fh.write(json.dumps(header("t04_iso_real.py", model=MODEL8, prompt=PROMPT, reasoning=True, num_predict=NUM_PREDICT,
                               proxy="RecordingProxy stamps each NDJSON line of /api/chat after it is written to the client")) + "\n")
    for rep in range(-1, REPS):
        block_mark(fh, f"rep {rep}")
        order = list(PATTERNS) if rep % 2 == 0 else list(reversed(PATTERNS))
        for name in order:
            ev = []
            err = None
            t0 = time.time_ns()
            try:
                await asyncio.wait_for(PATTERNS[name](ev), 300)
            except Exception as e:
                err = f"{type(e).__name__}: {e}"[:300]
            t1 = time.time_ns()
            await asyncio.sleep(0.1)
            reqs = proxy.since(t0, t1)
            row = {"kind": "run", "pattern": name, "rep": rep, "warmup": rep < 0, "error": err, "wall_ms": ms(t0, t1), "n_requests": len(reqs),
                   **analyze(ev, reqs, t0)}
            fh.write(json.dumps(row) + "\n")
            fh.flush()
            print(json.dumps(row), flush=True)
    block_mark(fh, "end")
    proxy.close()


asyncio.run(main())
