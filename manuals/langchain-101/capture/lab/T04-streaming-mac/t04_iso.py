import asyncio
import json
import os
import sys
import time
import uuid
import warnings

sys.path.insert(0, os.path.dirname(__file__))
warnings.filterwarnings("ignore")
import t04_run as T


async def consume_messages(ms, rec, label):
    async for message in ms:
        async for d in message.reasoning:
            pass
        async for d in message.text:
            rec.on_text(d, label)


async def consume_tools(tcs):
    async for tc in tcs:
        pass


async def consume_sub(subs, rec):
    async for sa in subs:
        await asyncio.gather(consume_messages(sa.messages, rec, sa.name or "sub"), consume_tools(sa.tool_calls), consume_sub(sa.subagents, rec))


async def go(agent, scenario, pattern, tag, rec):
    stream = await agent.astream_events(T.inp(scenario, tag), version="v3")
    parts = [consume_messages(stream.messages, rec, "main")]
    if "tools" in pattern:
        parts.append(consume_tools(stream.tool_calls))
    if "subs" in pattern:
        parts.append(consume_sub(stream.subagents, rec))
    if pattern == "msgs_then_output":
        await parts[0]
        await stream.output()
        return
    if pattern == "task_msgs_then_tools":
        t = asyncio.create_task(parts[0])
        await consume_tools(stream.tool_calls)
        await t
        return
    await asyncio.gather(*parts)


def burst(rec, prefix):
    first = {}
    for t, ln, ids, src in rec.text:
        for i in ids:
            if i.startswith(prefix):
                first.setdefault(i, t)
    ts = sorted(first.values())
    gaps = [(ts[k] - ts[k - 1]) / 1e6 for k in range(1, len(ts))]
    return len(ts), (sum(1 for g in gaps if g < 2.0) / len(gaps)) if gaps else None


def main():
    port, out, reps = int(sys.argv[1]), sys.argv[2], int(sys.argv[3])
    patterns = ["msgs", "msgs_then_output", "msgs_tools", "msgs_subs", "msgs_tools_subs", "task_msgs_then_tools"]
    scen = {"text": "text|K=40|R=20|P=50", "subagent": "subagent|A=20|Ra=2.5|K=40|R=20|P=50"}
    ctxs = {s: T.build("x", port, m, s) for s, m in scen.items()}

    async def all_runs():
        with open(out, "a") as fh:
            for rep in range(-1, reps):
                load = os.getloadavg()
                for s in scen:
                    for pat in patterns:
                        rec = T.Rec()
                        tag = "run-" + uuid.uuid4().hex[:12]
                        err = None
                        t0 = time.time_ns()
                        try:
                            await asyncio.wait_for(go(ctxs[s]["agent"], s, pat, tag, rec), 30)
                        except Exception as e:
                            err = f"{type(e).__name__}: {e}"[:300]
                        t1 = time.time_ns()
                        nw, bw = burst(rec, "w")
                        ns, bs = burst(rec, "s")
                        r = {"scenario": s, "pattern": pat, "rep": rep, "warmup": rep < 0, "load": load, "error": err,
                             "wall_ms": (t1 - t0) / 1e6, "main_tokens": nw, "main_burst_frac": bw, "sub_tokens": ns, "sub_burst_frac": bs,
                             "first_main_ms": min((e[0] for e in rec.text if any(i.startswith("w") for i in e[2])), default=t0 - t0 + t0) / 1e6 - t0 / 1e6 if rec.text else None}
                        fh.write(json.dumps(r) + "\n")
                        fh.flush()
                        print(s, pat, rep, err, nw, bw, ns, bs, flush=True)

    asyncio.run(all_runs())


if __name__ == "__main__":
    main()
