import argparse
import asyncio
import json
import os
import re
import sys
import time
import uuid
import warnings

os.environ["LANGSMITH_TRACING"] = "false"
os.environ["LANGCHAIN_TRACING_V2"] = "false"
warnings.filterwarnings("ignore")

TOK = re.compile(r"([ws])(\d{3})")


def now():
    return time.time_ns()


class Rec:
    def __init__(self):
        self.text = []
        self.tool = []

    def on_text(self, s, src=""):
        t = now()
        if not s:
            return
        ids = [m.group(1) + m.group(2) for m in TOK.finditer(s)]
        self.text.append([t, len(s), ids, src])

    def on_tool(self, n=1, src=""):
        self.tool.append([now(), n, src])


def text_of(chunk):
    c = chunk.content
    if isinstance(c, str):
        return c
    return "".join(b.get("text", "") for b in c if isinstance(b, dict) and b.get("type") == "text")


def lookup_impl(q: str) -> str:
    return "result for " + q[:12]


def build(variant, port, model, scenario):
    from langchain_core.tools import tool
    from langchain_openai import ChatOpenAI

    base = f"http://127.0.0.1:{port}/v1"
    extra = {}
    if scenario.startswith("ollama"):
        extra = dict(temperature=0, seed=42, max_tokens=80)

    @tool
    def lookup(q: str) -> str:
        """Look up a query."""
        return lookup_impl(q)

    if variant == "plain_openai":
        import openai
        return {"client": openai.OpenAI(base_url=base, api_key="dummy"), "extra": extra}
    llm = ChatOpenAI(model=model, base_url=base, api_key="dummy", **extra)
    if variant == "chatopenai_stream":
        return {"llm": llm.bind_tools([lookup]) if "tool" in scenario else llm, "lookup": lookup}
    from langchain.agents import create_agent
    if "subagent" in scenario:
        sub = create_agent(model=llm, tools=[lookup], system_prompt="You are a weather assistant.", name="weather_agent")

        @tool
        def call_weather(q: str) -> str:
            """Delegate weather queries to the sub-agent."""
            r = sub.invoke({"messages": [{"role": "user", "content": q[:40]}]})
            return r["messages"][-1].content

        agent = create_agent(model=llm, tools=[call_weather], system_prompt="SUPERVISOR general assistant.", name="supervisor")
    else:
        agent = create_agent(model=llm, tools=[lookup], system_prompt="You are helpful.")
    return {"agent": agent}


def prompt_for(scenario, tag):
    if scenario.startswith("ollama"):
        return f"Count from 1 to 30, separated by single spaces, and nothing else. ({tag})"
    return f"Answer please ({tag})"


def run_plain(ctx, model, scenario, tag, rec):
    client = ctx["client"]
    msgs = [{"role": "user", "content": prompt_for(scenario, tag)}]
    tools = [{"type": "function", "function": {"name": "lookup", "description": "Look up a query.",
                                               "parameters": {"type": "object", "properties": {"q": {"type": "string"}}, "required": ["q"]}}}]
    for _ in range(4):
        kw = dict(model=model, messages=msgs, stream=True, **ctx["extra"])
        if "tool" in scenario:
            kw["tools"] = tools
        calls = {}
        content = ""
        for ch in client.chat.completions.create(**kw):
            if not ch.choices:
                continue
            d = ch.choices[0].delta
            if d.content:
                rec.on_text(d.content)
                content += d.content
            if d.tool_calls:
                rec.on_tool(len(d.tool_calls))
                for tc in d.tool_calls:
                    c = calls.setdefault(tc.index, {"id": None, "name": "", "args": ""})
                    if tc.id:
                        c["id"] = tc.id
                    if tc.function and tc.function.name:
                        c["name"] = tc.function.name
                    if tc.function and tc.function.arguments:
                        c["args"] += tc.function.arguments
        if not calls:
            return content
        msgs.append({"role": "assistant", "content": None, "tool_calls": [
            {"id": c["id"], "type": "function", "function": {"name": c["name"], "arguments": c["args"]}} for c in calls.values()]})
        for c in calls.values():
            msgs.append({"role": "tool", "tool_call_id": c["id"], "content": lookup_impl(json.loads(c["args"])["q"])})


def run_chatopenai(ctx, model, scenario, tag, rec):
    from langchain_core.messages import HumanMessage, ToolMessage
    llm = ctx["llm"]
    msgs = [HumanMessage(prompt_for(scenario, tag))]
    for _ in range(4):
        acc = None
        for ch in llm.stream(msgs):
            rec.on_text(text_of(ch))
            if ch.tool_call_chunks:
                rec.on_tool(len(ch.tool_call_chunks))
            acc = ch if acc is None else acc + ch
        msgs.append(acc)
        if not acc.tool_calls:
            return acc.text
        for tc in acc.tool_calls:
            msgs.append(ToolMessage(ctx["lookup"].invoke(tc["args"]), tool_call_id=tc["id"]))


def inp(scenario, tag):
    return {"messages": [{"role": "user", "content": prompt_for(scenario, tag)}]}


def run_agent_messages(ctx, model, scenario, tag, rec):
    for ch, meta in ctx["agent"].stream(inp(scenario, tag), stream_mode="messages"):
        if getattr(ch, "type", "") in ("AIMessageChunk", "ai"):
            rec.on_text(text_of(ch), meta.get("langgraph_node", ""))
            if getattr(ch, "tool_call_chunks", None):
                rec.on_tool(len(ch.tool_call_chunks))


def run_agent_messages_updates(ctx, model, scenario, tag, rec):
    for mode, data in ctx["agent"].stream(inp(scenario, tag), stream_mode=["messages", "updates"]):
        if mode == "messages":
            ch, meta = data
            if getattr(ch, "type", "") in ("AIMessageChunk", "ai"):
                rec.on_text(text_of(ch), meta.get("langgraph_node", ""))
                if getattr(ch, "tool_call_chunks", None):
                    rec.on_tool(len(ch.tool_call_chunks))


async def run_astream_events_v2(ctx, model, scenario, tag, rec):
    async for ev in ctx["agent"].astream_events(inp(scenario, tag), version="v2"):
        if ev["event"] == "on_chat_model_stream":
            ch = ev["data"]["chunk"]
            rec.on_text(text_of(ch))
            if ch.tool_call_chunks:
                rec.on_tool(len(ch.tool_call_chunks))


def run_v3_docs(ctx, model, scenario, tag, rec):
    run = ctx["agent"].stream_events(inp(scenario, tag), version="v3")
    for message in run.messages:
        for delta in message.text:
            rec.on_text(delta, str(message.node))
        for c in message.tool_calls:
            rec.on_tool(1, str(message.node))
    _ = run.output


def run_v3_raw(ctx, model, scenario, tag, rec):
    run = ctx["agent"].stream_events(inp(scenario, tag), version="v3")
    for ev in run:
        if ev.get("method") != "messages":
            continue
        data = ev["params"]["data"]
        e = data[0] if isinstance(data, (list, tuple)) else data
        if e.get("event") != "content-block-delta":
            continue
        d = e.get("delta", {})
        if d.get("type") == "tool-call-delta":
            rec.on_tool(1, "raw")
        elif d.get("type") == "text-delta":
            rec.on_text(d.get("text", ""), "raw")


async def run_v3_async_gather(ctx, model, scenario, tag, rec):
    async def consume_messages(ms, label):
        async for message in ms:
            async for d in message.reasoning:
                pass
            async for d in message.text:
                rec.on_text(d, label)

    async def consume_tools(tcs):
        async for tc in tcs:
            pass

    async def consume_sub(subs):
        async for sa in subs:
            await asyncio.gather(consume_messages(sa.messages, sa.name or "sub"), consume_tools(sa.tool_calls), consume_sub(sa.subagents))

    stream = await ctx["agent"].astream_events(inp(scenario, tag), version="v3")
    await asyncio.gather(consume_messages(stream.messages, "main"), consume_tools(stream.tool_calls), consume_sub(stream.subagents))


async def run_v3_async(ctx, model, scenario, tag, rec):
    stream = await ctx["agent"].astream_events(inp(scenario, tag), version="v3")
    async for message in stream.messages:
        async for d in message.text:
            rec.on_text(d, str(message.node))
        async for c in message.tool_calls:
            rec.on_tool(1, str(message.node))
    await stream.output()


RUNNERS = {
    "plain_openai": run_plain,
    "chatopenai_stream": run_chatopenai,
    "agent_messages": run_agent_messages,
    "agent_messages_updates": run_agent_messages_updates,
    "astream_events_v2": run_astream_events_v2,
    "stream_events_v3": run_v3_docs,
    "stream_events_v3_raw": run_v3_raw,
    "astream_events_v3": run_v3_async,
    "astream_events_v3_gather": run_v3_async_gather,
}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--variant", required=True)
    p.add_argument("--scenario", required=True)
    p.add_argument("--model", required=True)
    p.add_argument("--port", type=int, required=True)
    p.add_argument("--n", type=int, default=10)
    p.add_argument("--warmup", type=int, default=2)
    p.add_argument("--block", type=int, default=0)
    p.add_argument("--out", required=True)
    a = p.parse_args()
    ctx = build(a.variant, a.port, a.model, a.scenario)
    fn = RUNNERS[a.variant]
    load = os.getloadavg()
    fh = open(a.out, "a")

    def write(i, tag, rec, err, t0, t1, c0, c1):
        fh.write(json.dumps({"variant": a.variant, "scenario": a.scenario, "block": a.block, "i": i, "warmup": i < a.warmup,
                             "tag": tag, "t0": t0, "t1": t1, "cpu_ns": c1 - c0, "load": load, "text": rec.text,
                             "tool": rec.tool, "error": err}) + "\n")
        fh.flush()

    if asyncio.iscoroutinefunction(fn):
        async def loop_all():
            for i in range(a.warmup + a.n):
                tag = "run-" + uuid.uuid4().hex[:12]
                rec = Rec()
                err = None
                c0 = time.process_time_ns()
                t0 = now()
                try:
                    await fn(ctx, a.model, a.scenario, tag, rec)
                except Exception as e:
                    err = f"{type(e).__name__}: {e}"[:400]
                write(i, tag, rec, err, t0, now(), c0, time.process_time_ns())
        asyncio.run(loop_all())
    else:
        for i in range(a.warmup + a.n):
            tag = "run-" + uuid.uuid4().hex[:12]
            rec = Rec()
            err = None
            c0 = time.process_time_ns()
            t0 = now()
            try:
                fn(ctx, a.model, a.scenario, tag, rec)
            except Exception as e:
                err = f"{type(e).__name__}: {e}"[:400]
            write(i, tag, rec, err, t0, now(), c0, time.process_time_ns())
    fh.close()


if __name__ == "__main__":
    main()
