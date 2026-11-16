import json
import os
import sys
import time
import warnings

os.environ["LANGSMITH_TRACING"] = "false"
warnings.filterwarnings("ignore")

import ollama
from langchain.agents import create_agent
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.tools import tool
from langchain_core.utils.function_calling import convert_to_openai_tool
from langchain_ollama import ChatOllama

MODEL = sys.argv[2]
N = int(sys.argv[3])
OUT = open(sys.argv[1], "a")
OPTS = {"temperature": 0, "seed": 42, "num_ctx": 16384, "num_predict": 1024}

FILES = {}


@tool
def add(a: int, b: int) -> int:
    """Add two integers."""
    return a + b


@tool
def multiply(a: int, b: int) -> int:
    """Multiply two integers."""
    return a * b


@tool
def write_file(path: str, content: str) -> str:
    """Write text content to a file at path."""
    FILES[path] = content
    return f"wrote {len(content)} chars to {path}"


@tool
def read_file(path: str) -> str:
    """Read the text content of the file at path."""
    return FILES.get(path, f"error: {path} not found")


TASKS = {
    "trivial": ("What is the capital of France? Answer in one word.", [], lambda a, s: "paris" in a.lower()),
    "tools": ("Use the tools to compute (17 + 25) * 3. Reply with the number only.", [add, multiply], lambda a, s: "126" in a),
    "files": ("Create a file /notes.txt containing exactly the text 'hello world', then read it back and tell me exactly what it contains.",
              "files", lambda a, s: "hello world" in a.lower()),
}


class Rec(BaseCallbackHandler):
    def __init__(self):
        self.calls = []

    def on_chat_model_start(self, serialized, messages, **kw):
        inv = kw.get("invocation_params") or {}
        msgs = messages[0]
        sys_text = "".join(str(m.content) for m in msgs if m.type == "system")
        tools = inv.get("tools") or []
        self.calls.append({"n_messages": len(msgs), "system_chars": len(sys_text), "n_tools": len(tools),
                           "tool_names": [t.get("function", {}).get("name") for t in tools if isinstance(t, dict)],
                           "tool_schema_chars": len(json.dumps(tools)), "t0": time.perf_counter()})

    def on_llm_end(self, response, **kw):
        msg = response.generations[0][0].message
        um = msg.usage_metadata or {}
        c = self.calls[-1]
        c.update(in_tokens=um.get("input_tokens"), out_tokens=um.get("output_tokens"), secs=round(time.perf_counter() - c.pop("t0"), 3),
                 tool_calls=[tc["name"] for tc in msg.tool_calls])


def plain(task, tools):
    msgs = [{"role": "user", "content": task}]
    schemas = [convert_to_openai_tool(t) for t in tools]
    by = {t.name: t for t in tools}
    calls = []
    for _ in range(12):
        t0 = time.perf_counter()
        r = ollama.chat(model=MODEL, messages=msgs, tools=schemas or None, think=False, options=OPTS)
        tcs = r.message.tool_calls or []
        calls.append({"n_messages": len(msgs), "system_chars": 0, "n_tools": len(schemas), "tool_names": [s["function"]["name"] for s in schemas],
                      "tool_schema_chars": len(json.dumps(schemas)), "in_tokens": r.prompt_eval_count, "out_tokens": r.eval_count,
                      "secs": round(time.perf_counter() - t0, 3), "tool_calls": [t.function.name for t in tcs]})
        msgs.append({"role": "assistant", "content": r.message.content or "", "tool_calls": [{"function": {"name": t.function.name, "arguments": t.function.arguments}} for t in tcs]})
        if not tcs:
            return r.message.content or "", calls
        for t in tcs:
            fn = by.get(t.function.name)
            out = fn.invoke(dict(t.function.arguments)) if fn else f"unknown tool {t.function.name}"
            msgs.append({"role": "tool", "content": str(out), "tool_name": t.function.name})
    return "(turn cap)", calls


def lc_model():
    return ChatOllama(model=MODEL, temperature=0, seed=42, reasoning=False, num_ctx=16384, num_predict=1024)


def run_agent(kind, task, tools):
    rec = Rec()
    if kind == "create_agent":
        agent = create_agent(lc_model(), tools=tools)
    else:
        from deepagents import create_deep_agent
        agent = create_deep_agent(model=lc_model(), tools=tools)
    res = agent.invoke({"messages": [{"role": "user", "content": task}]}, {"callbacks": [rec], "recursion_limit": 40})
    answer = res["messages"][-1].content if isinstance(res["messages"][-1].content, str) else str(res["messages"][-1].content)
    files = res.get("files")
    return answer, rec.calls, (sorted(files) if isinstance(files, dict) else None)


for rep in range(N):
    for tname, (task, tools, check) in TASKS.items():
        for kind in ["plain", "create_agent", "deep_agent"]:
            FILES.clear()
            if tools == "files":
                tl = [] if kind == "deep_agent" else [write_file, read_file]
            else:
                tl = list(tools)
            t0 = time.perf_counter()
            row = {"model": MODEL, "rep": rep, "task": tname, "harness": kind}
            try:
                if kind == "plain":
                    answer, calls = plain(task, tl)
                    files = sorted(FILES)
                else:
                    answer, calls, files = run_agent(kind, task, tl)
                    if kind == "create_agent":
                        files = sorted(FILES)
                row.update(answer=answer[:300], ok=check(answer, files), files=files, calls=calls, n_calls=len(calls),
                           in_tokens_total=sum(c.get("in_tokens") or 0 for c in calls), out_tokens_total=sum(c.get("out_tokens") or 0 for c in calls),
                           first_call_in_tokens=calls[0].get("in_tokens") if calls else None)
            except Exception as e:
                row.update(raised=f"{type(e).__name__}: {str(e)[:300]}")
            row["secs"] = round(time.perf_counter() - t0, 2)
            OUT.write(json.dumps(row) + "\n")
            OUT.flush()
            print(tname, kind, row.get("ok"), row.get("n_calls"), row.get("in_tokens_total"), row.get("secs"), row.get("raised", ""), flush=True)
ollama.generate(model=MODEL, prompt="", keep_alive=0)
