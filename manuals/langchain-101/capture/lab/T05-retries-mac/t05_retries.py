import argparse
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common import EVIDENCE, read_jsonl, start_server, stop_server

os.environ["LANGSMITH_TRACING"] = "false"

import httpx
from langchain.agents import create_agent
from langchain.agents.middleware import ModelRetryMiddleware, ToolRetryMiddleware
from langchain.tools import tool
from langchain_openai import ChatOpenAI

OUT = EVIDENCE / "T05"
WIRE = OUT / "wire"
WIRE.mkdir(parents=True, exist_ok=True)

MODEL_FAULTS = {
    "m429_once": {"model": ["429"]},
    "m429_always": {"model_default": "429"},
    "m500_once": {"model": ["500"]},
    "m500_always": {"model_default": "500"},
    "m400_always": {"model_default": "400"},
    "mtimeout_once": {"model": ["sleep:3"]},
    "mtimeout_always": {"model_default": "sleep:3"},
}
TOOL_FAULTS = {
    "t429_once": {"tool": ["429"]},
    "t500_always": {"tool_default": "500"},
    "t400_always": {"tool_default": "400"},
    "ttimeout_once": {"tool": ["sleep:3"]},
    "ttimeout_always": {"tool_default": "sleep:3"},
}
BOTH_FAULTS = {
    "m429_once+t500_once": {"model": ["429"], "tool": ["500"]},
    "m500_always+t500_always": {"model_default": "500", "tool_default": "500"},
}


def build(config, port, tool_counter):
    base = f"http://127.0.0.1:{port}/v1"

    @tool
    def remote_action(item: str) -> str:
        """Perform a remote action on an item."""
        tool_counter.append(time.time())
        r = httpx.post(f"http://127.0.0.1:{port}/tool", json={"item": item}, timeout=1.0)
        r.raise_for_status()
        return r.text

    if config == "init_chat_model_default":
        from langchain.chat_models import init_chat_model
        model = init_chat_model("openai:stub", base_url=base, api_key="local-stub", temperature=0, timeout=1.0)
    else:
        kw = {"model": "stub", "base_url": base, "api_key": "local-stub", "temperature": 0, "timeout": 1.0}
        if config in ("model_retry_mw_only", "tool_retry_mw_client0"):
            kw["max_retries"] = 0
        model = ChatOpenAI(**kw)
    mw = []
    if config in ("model_retry_mw_only", "stacked_client_plus_model_mw", "both_mw"):
        mw.append(ModelRetryMiddleware())
    if config in ("tool_retry_mw", "tool_retry_mw_client0", "both_mw"):
        mw.append(ToolRetryMiddleware())
    return create_agent(model, tools=[remote_action], middleware=mw), model


def run_cell(fault_name, schedule, config, rep, port):
    log = WIRE / f"{fault_name}__{config}__{rep}.jsonl"
    if log.exists():
        log.unlink()
    srv = start_server(port, log, script="remote_action", schedule=schedule, log_arrivals=True)
    counter = []
    rec = {"fault": fault_name, "config": config, "rep": rep}
    try:
        agent, model = build(config, port, counter)
        rec["client_max_retries"] = model.root_client.max_retries if hasattr(model, "root_client") else None
        t0 = time.time()
        try:
            out = agent.invoke({"messages": [{"role": "user", "content": "do it"}]})
            msgs = out["messages"]
            rec["outcome"] = "returned"
            rec["final_messages"] = [[m.type, (m.content if isinstance(m.content, str) else str(m.content))[:300],
                                      getattr(m, "status", None)] for m in msgs]
        except Exception as e:
            rec["outcome"] = "raised"
            rec["exception"] = f"{type(e).__module__}.{type(e).__name__}: {str(e)[:300]}"
            rec["exception_mro"] = [c.__name__ for c in type(e).__mro__][:8]
        rec["wall_s"] = round(time.time() - t0, 3)
    finally:
        stop_server(srv)
    time.sleep(0.05)
    wire = [w for w in read_jsonl(log) if w.get("event") == "recv"]
    rec["wire_count_source"] = "arrival records"
    rec["wire_model_attempts"] = sum(1 for w in wire if not w["path"].startswith("/tool"))
    rec["wire_tool_attempts"] = sum(1 for w in wire if w["path"].startswith("/tool"))
    rec["wire_actions"] = [[("tool" if w["path"].startswith("/tool") else "model"), w["action"]] for w in wire]
    rec["tool_executions"] = len(counter)
    return rec


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--reps", type=int, default=3)
    p.add_argument("--group", choices=["model", "tool", "both", "all", "timeouts"], default="all")
    a = p.parse_args()
    port = 18300
    cells = []
    if a.group == "timeouts":
        port = 18500
        for f in ["mtimeout_once", "mtimeout_always"]:
            for c in ["client_default", "init_chat_model_default", "model_retry_mw_only", "stacked_client_plus_model_mw"]:
                cells.append((f, MODEL_FAULTS[f], c, "04-timeouts-arrival-count.jsonl"))
        for f in ["ttimeout_once", "ttimeout_always"]:
            for c in ["client_default", "tool_retry_mw"]:
                cells.append((f, TOOL_FAULTS[f], c, "04-timeouts-arrival-count.jsonl"))
    if a.group in ("model", "all"):
        for f, s in MODEL_FAULTS.items():
            for c in ["client_default", "init_chat_model_default", "model_retry_mw_only", "stacked_client_plus_model_mw"]:
                cells.append((f, s, c, "01-model-faults.jsonl"))
    if a.group in ("tool", "all"):
        for f, s in TOOL_FAULTS.items():
            for c in ["client_default", "tool_retry_mw"]:
                cells.append((f, s, c, "02-tool-faults.jsonl"))
    if a.group in ("both", "all"):
        for f, s in BOTH_FAULTS.items():
            for c in ["client_default", "stacked_client_plus_model_mw", "tool_retry_mw", "both_mw"]:
                cells.append((f, s, c, "03-both-faults.jsonl"))
    for f, s, c, out in cells:
        for rep in range(a.reps):
            port += 1
            rec = run_cell(f, s, c, rep, port)
            with open(OUT / out, "a") as fh:
                fh.write(json.dumps(rec, default=str) + "\n")
            print(f, c, rep, rec["outcome"], "model_wire", rec["wire_model_attempts"], "tool_wire", rec["wire_tool_attempts"],
                  "tool_exec", rec["tool_executions"], rec["wall_s"], flush=True)


if __name__ == "__main__":
    main()
