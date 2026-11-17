import json
import sys
import time
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from lt_common import BodyProxy, block_mark, header

T06 = Path(sys.argv[3]) if len(sys.argv) > 3 else None
if T06:
    sys.path.insert(0, str(T06))
from t06_schemas import SCHEMAS

from langchain.agents import create_agent
from langchain.agents.structured_output import ToolStrategy
from langchain_ollama import ChatOllama



def summarize_request(rec):
    body = json.loads(rec["req_body"])
    msgs = [f"{m.get('role')}: {str(m.get('content'))[:80]}" + (f" tool_calls={json.dumps([(tc['function']['name'], tc['function']['arguments']) for tc in m['tool_calls']])[:160]}" if m.get("tool_calls") else "") for m in body.get("messages", [])]
    out = {"path": rec["path"], "status": rec["status"], "req_bytes": rec["req_bytes"], "messages": msgs, "tools": [t.get("function", {}).get("name") for t in body.get("tools", [])]}
    if rec["status"] >= 400:
        out["error_body"] = rec["resp_body"][:400]
    else:
        lines = [json.loads(x) for x in rec["resp_body"].splitlines() if x.strip()]
        text = "".join((x.get("message") or {}).get("content", "") for x in lines)
        tcs = [(tc["function"]["name"], tc["function"]["arguments"]) for x in lines for tc in (x.get("message") or {}).get("tool_calls") or []]
        out["reply"] = {"content": text[:200], "tool_calls": json.dumps(tcs)[:200]}
    return out

N = int(sys.argv[1]) if len(sys.argv) > 1 else 5
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else HERE / "04-small-model-probe.jsonl"
MODEL = "qwen3:0.6b"
SYSTEM = "Extract the requested information from the user's text and return it in the required structured format."
LIMITS = (12, 25)
schema, gen = SCHEMAS["flat"]
ITEM = gen()[2]

proxy = BodyProxy()

with OUT.open("w") as fh:
    fh.write(json.dumps(header("lt1b_small_model_probe.py", probe_model=MODEL, n=N, limits=LIMITS, input=ITEM["text"], system=SYSTEM,
                               model_settings="ChatOllama temperature 0, seed 42, reasoning False, num_predict 512 (as t06_run.py)")) + "\n")
    for limit in LIMITS:
        block_mark(fh, f"{MODEL} | ToolStrategy(Contact) | T06 flat input 2 | recursion_limit {limit}")
        for i in range(N):
            llm = ChatOllama(model=MODEL, base_url=f"http://127.0.0.1:{proxy.port}", temperature=0, seed=42, reasoning=False, num_predict=512)
            agent = create_agent(llm, tools=[], system_prompt=SYSTEM, response_format=ToolStrategy(schema))
            row = {"kind": "run", "model": MODEL, "schema": "flat Contact", "strategy": "ToolStrategy", "recursion_limit": limit, "i": i}
            t0 = time.time_ns()
            try:
                res = agent.invoke({"messages": [{"role": "user", "content": ITEM["text"]}]}, {"recursion_limit": limit})
                sr = res.get("structured_response")
                row.update(outcome="valid" if sr is not None else "missing", structured=repr(sr))
            except Exception as e:
                row.update(outcome="raised", error_type=type(e).__module__ + "." + type(e).__name__, error=str(e).splitlines()[0][:400])
            reqs = [r for r in proxy.since(t0) if r["method"] == "POST"]
            row["model_calls"] = len(reqs)
            row["statuses"] = [r["status"] for r in reqs]
            row["requests"] = [summarize_request(r) for r in reqs]
            fh.write(json.dumps(row) + "\n")
            fh.flush()
            print(json.dumps({k: row.get(k) for k in ("recursion_limit", "i", "outcome", "error_type", "model_calls", "statuses")}), flush=True)
    block_mark(fh, "end")
proxy.close()
