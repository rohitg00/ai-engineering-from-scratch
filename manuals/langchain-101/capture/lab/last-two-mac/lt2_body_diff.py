import json
import sys
import time
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from lt_common import MODEL, BodyProxy, block_mark, header

import openai
from langchain.agents import create_agent
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI

N = int(sys.argv[1]) if len(sys.argv) > 1 else 5
WARM = int(sys.argv[2]) if len(sys.argv) > 2 else 1
OUT = Path(sys.argv[3]) if len(sys.argv) > 3 else HERE / "02-request-bodies.jsonl"
PROMPT = "Use the add tool to add 2 and 3. Wait for its result, then call the multiply tool with that result and 4. Call one tool at a time. Reply with the final number only."

proxy = BodyProxy()
V1 = f"http://127.0.0.1:{proxy.port}/v1"


def add_impl(a, b):
    return a + b


def mul_impl(a, b):
    return a * b


@tool
def add(a: int, b: int) -> int:
    """Add two integers."""
    return add_impl(a, b)


@tool
def multiply(a: int, b: int) -> int:
    """Multiply two integers."""
    return mul_impl(a, b)


IMPLS = {"add": add_impl, "multiply": mul_impl}
SCHEMAS = [{"type": "function", "function": {"name": n, "description": d, "parameters": {"type": "object", "properties": {"a": {"type": "integer"}, "b": {"type": "integer"}}, "required": ["a", "b"]}}}
           for n, d in (("add", "Add two integers."), ("multiply", "Multiply two integers."))]

oai = openai.OpenAI(base_url=V1, api_key="ollama-local-no-key")
agent = create_agent(ChatOpenAI(model=MODEL, base_url=V1, api_key="ollama-local-no-key", temperature=0, seed=42), tools=[add, multiply])


def plain_openai():
    msgs = [{"role": "user", "content": PROMPT}]
    for _ in range(6):
        r = oai.chat.completions.create(model=MODEL, messages=msgs, tools=SCHEMAS, temperature=0, seed=42)
        m = r.choices[0].message
        if not m.tool_calls:
            return m.content
        msgs.append({"role": "assistant", "content": m.content, "tool_calls": [tc.model_dump() for tc in m.tool_calls]})
        for tc in m.tool_calls:
            args = json.loads(tc.function.arguments)
            msgs.append({"role": "tool", "tool_call_id": tc.id, "content": str(IMPLS[tc.function.name](**args))})
    return None


def create_agent_run():
    res = agent.invoke({"messages": [{"role": "user", "content": PROMPT}]})
    return res["messages"][-1].text


PROGRAMS = {"a_plain_openai": plain_openai, "c_create_agent": create_agent_run}

with OUT.open("w") as fh:
    fh.write(json.dumps(header("lt2_body_diff.py", n=N, warmup_rounds=WARM, prompt=PROMPT, programs=list(PROGRAMS))) + "\n")
    for rnd in range(WARM + N):
        block_mark(fh, f"round {rnd}", warmup=rnd < WARM)
        order = list(PROGRAMS) if rnd % 2 == 0 else list(reversed(PROGRAMS))
        for name in order:
            t0 = time.time_ns()
            err = None
            try:
                answer = PROGRAMS[name]()
            except Exception as e:
                answer, err = None, f"{type(e).__name__}: {e}"[:300]
            reqs = [r for r in proxy.since(t0) if r["method"] == "POST"]
            row = {"kind": "run", "round": rnd, "warmup": rnd < WARM, "program": name, "answer": answer, "error": err,
                   "n_calls": len(reqs), "requests": [{k: r[k] for k in ("path", "status", "req_bytes", "req_body", "req_headers", "resp_body")} for r in reqs]}
            fh.write(json.dumps(row) + "\n")
            fh.flush()
            print(json.dumps({"round": rnd, "program": name, "answer": answer, "error": err, "bytes": [r["req_bytes"] for r in reqs]}), flush=True)
    block_mark(fh, "end")
proxy.close()
