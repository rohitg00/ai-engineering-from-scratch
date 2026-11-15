import json
import sys
import time
import warnings
from dataclasses import dataclass
from pathlib import Path
from typing import TypedDict

warnings.filterwarnings("ignore")
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from lt_common import MODEL, BodyProxy, block_mark, header

from langchain.agents import create_agent
from langchain.agents.structured_output import ToolStrategy
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI

N = int(sys.argv[1]) if len(sys.argv) > 1 else 5
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else HERE / "01-toolstrategy-text.jsonl"
PROMPT = "What is 2 + 3?"
LIMITS = (12, 25)


class AnswerDict(TypedDict):
    value: int


@dataclass
class AnswerData:
    value: int


SCHEMAS = {"TypedDict AnswerDict": AnswerDict, "dataclass AnswerData": AnswerData}

proxy = BodyProxy()


def model(client):
    if client == "ChatOllama":
        return ChatOllama(model=MODEL, base_url=f"http://127.0.0.1:{proxy.port}", temperature=0, seed=42)
    return ChatOpenAI(model=MODEL, base_url=f"http://127.0.0.1:{proxy.port}/v1", api_key="ollama-local-no-key", temperature=0, seed=42, max_retries=0)


def summarize_request(rec):
    try:
        body = json.loads(rec["req_body"])
    except Exception:
        body = {}
    msgs = [f"{m.get('role')}: {str(m.get('content'))[:80]}" + (f" tool_calls={len(m['tool_calls'])}" if m.get("tool_calls") else "") for m in body.get("messages", [])]
    tools = [t.get("function", {}).get("name") for t in body.get("tools", [])]
    out = {"path": rec["path"], "status": rec["status"], "req_bytes": rec["req_bytes"], "upstream_ms": round(rec["upstream_ns"] / 1e6, 1),
           "messages": msgs, "tools": tools, "tool_choice": body.get("tool_choice")}
    if rec["status"] >= 400:
        out["error_body"] = rec["resp_body"][:400]
    else:
        try:
            if rec["path"].startswith("/v1"):
                m = json.loads(rec["resp_body"])["choices"][0]["message"]
                out["reply"] = {"content": m.get("content"), "tool_calls": [tc["function"]["name"] for tc in m.get("tool_calls") or []]}
            else:
                lines = [json.loads(x) for x in rec["resp_body"].splitlines() if x.strip()]
                text = "".join((x.get("message") or {}).get("content", "") for x in lines)
                tcs = [tc["function"]["name"] for x in lines for tc in (x.get("message") or {}).get("tool_calls") or []]
                out["reply"] = {"content": text, "tool_calls": tcs}
        except Exception as e:
            out["reply_parse_error"] = repr(e)
    return out


def run_one(fh, client, schema_name, limit, i):
    m = model(client)
    agent = create_agent(m, tools=[], response_format=ToolStrategy(SCHEMAS[schema_name]))
    row = {"kind": "run", "client": client, "schema": schema_name, "strategy": "ToolStrategy (handle_errors default True)", "user_tools": [],
           "prompt": PROMPT, "recursion_limit": limit, "i": i}
    t0 = time.time_ns()
    try:
        res = agent.invoke({"messages": [{"role": "user", "content": PROMPT}]}, {"recursion_limit": limit})
        sr = res.get("structured_response")
        row.update(outcome="valid" if sr is not None else "missing", structured=repr(sr), final_messages=[(x.type, str(x.content)[:120]) for x in res["messages"]])
    except Exception as e:
        row.update(outcome="raised", error_type=type(e).__module__ + "." + type(e).__name__, error=str(e).splitlines()[0][:400])
    row["wall_ms"] = round((time.time_ns() - t0) / 1e6, 1)
    reqs = [r for r in proxy.since(t0) if r["method"] == "POST"]
    row["model_calls"] = len(reqs)
    row["statuses"] = [r["status"] for r in reqs]
    row["requests"] = [summarize_request(r) for r in reqs]
    fh.write(json.dumps(row) + "\n")
    fh.flush()
    print(json.dumps({k: row[k] for k in ("client", "schema", "recursion_limit", "i", "outcome", "model_calls", "statuses")} | {"error": row.get("error", "")[:160]}), flush=True)


with OUT.open("w") as fh:
    fh.write(json.dumps(header("lt1_toolstrategy_text.py", n=N, limits=LIMITS, prompt=PROMPT)) + "\n")
    for client in ("ChatOllama", "ChatOpenAI"):
        for schema_name in SCHEMAS:
            for limit in LIMITS:
                block_mark(fh, f"{client} | {schema_name} | recursion_limit {limit}")
                for i in range(N):
                    run_one(fh, client, schema_name, limit, i)
    block_mark(fh, "end")
proxy.close()
