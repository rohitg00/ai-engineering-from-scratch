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
from mr_common import RecordingProxy, block_mark, header

REPS = int(sys.argv[1]) if len(sys.argv) > 1 else 3
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else HERE / "01-provider-paths.jsonl"
MODELS = sys.argv[3].split(",") if len(sys.argv) > 3 else ["qwen3:4b-instruct-2507-q4_K_M", "qwen3:8b", "gpt-oss:20b", "qwen3:0.6b", "nomic-embed-text:latest"]
TEXT = "Ana, 30, ana@x.org"

from pydantic import BaseModel, Field
from langchain.agents import create_agent
from langchain.agents.structured_output import AutoStrategy, ProviderStrategy, ToolStrategy
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI


class Contact(BaseModel):
    """Contact details extracted from the text."""
    name: str = Field(description="Full name of the person")
    email: str = Field(description="Email address")
    age: int = Field(description="Age in years")


proxy = RecordingProxy(stamp_stream=False)


def mk(client, model):
    if client == "ChatOpenAI":
        return ChatOpenAI(model=model, base_url=f"http://127.0.0.1:{proxy.port}/v1", api_key="ollama-local-no-key", temperature=0, seed=42, max_retries=0)
    return ChatOllama(model=model, base_url=f"http://127.0.0.1:{proxy.port}", temperature=0, seed=42)


STRATS = {"ProviderStrategy": lambda: ProviderStrategy(Contact), "AutoStrategy": lambda: AutoStrategy(Contact), "ToolStrategy": lambda: ToolStrategy(Contact)}
CELLS = [("ChatOpenAI", s) for s in STRATS] + [("ChatOllama", "ProviderStrategy"), ("ChatOllama", "AutoStrategy")]


def one(client, strat, model, limit=12):
    llm = mk(client, model)
    row = {"kind": "run", "client": client, "strategy": strat, "model": model, "recursion_limit": limit}
    try:
        row["profile_structured_output"] = (getattr(llm, "profile", None) or {}).get("structured_output")
    except Exception:
        row["profile_structured_output"] = "unreadable"
    t0 = time.time_ns()
    try:
        res = create_agent(llm, tools=[], response_format=STRATS[strat]()).invoke({"messages": [{"role": "user", "content": TEXT}]}, {"recursion_limit": limit})
        sr = res.get("structured_response")
        row.update(outcome="valid" if sr is not None else "missing", structured=repr(sr),
                   messages=[(m.type, (m.text if hasattr(m, "text") else str(m.content))[:200], [tc["name"] for tc in (getattr(m, "tool_calls", None) or [])]) for m in res["messages"]])
    except Exception as e:
        row.update(outcome="raised", error_type=type(e).__name__, error=str(e).splitlines()[0][:400])
    t1 = time.time_ns()
    time.sleep(0.05)
    reqs = proxy.since(t0, t1)
    row["wall_s"] = round((t1 - t0) / 1e9, 3)
    row["requests"] = [{k: r.get(k) for k in ("path", "status", "req_keys", "response_format_type", "format", "n_msgs", "error_body", "usage", "eval_count")} for r in reqs]
    row["n_requests"] = len(reqs)
    return row


def main():
    fh = open(OUT, "a")
    fh.write(json.dumps(header("t06_provider_real.py", models=MODELS, text=TEXT, schema="Contact(name: str, email: str, age: int)", cells=CELLS,
                               note="ChatOpenAI on Ollama /v1 and ChatOllama on /api/chat, through RecordingProxy, max_retries=0 for ChatOpenAI")) + "\n")
    for model in MODELS:
        block_mark(fh, f"model {model}")
        for rep in range(REPS):
            for client, strat in CELLS:
                row = one(client, strat, model)
                row["rep"] = rep
                fh.write(json.dumps(row, default=str) + "\n")
                fh.flush()
                print(json.dumps(row, default=str)[:700], flush=True)
    block_mark(fh, "end")
    proxy.close()


main()
