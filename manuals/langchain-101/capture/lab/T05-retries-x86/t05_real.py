import argparse
import json
import socket
import sys
import time
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lr_common import MODEL, Relay, chat, chat_openai, free_port, header, jl, msgs_brief, pg

import httpx
from langchain.agents import create_agent
from langchain.agents.middleware import ModelRetryMiddleware, ToolRetryMiddleware
from langchain_core.callbacks import BaseCallbackHandler
from langchain.tools import tool
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition
from langgraph.types import RetryPolicy

OUT = Path(__file__).resolve().parent
PROMPT = "Call the tool remote_action with item 'A' exactly once. After you get its result, reply with the single word: done."
TIMEOUT = 15.0
HOLD = "sleep:20"

CONNECTS = []
_real_cc = socket.create_connection


def _cc(addr, *a, **k):
    CONNECTS.append(addr[1])
    return _real_cc(addr, *a, **k)


socket.create_connection = _cc

MODEL_FAULTS = {
    "m_drop_once": dict(schedule=["drop"]),
    "m_drop_always": dict(default="drop"),
    "m_refused_always": dict(refused=True),
    "m_timeout_once": dict(schedule=[HOLD], timeout=True),
    "m_timeout_always": dict(default=HOLD, timeout=True),
    "m_429_once_relay": dict(schedule=["429"]),
    "m_429_always_relay": dict(default="429"),
    "m_500_once_relay": dict(schedule=["500"]),
    "m_500_always_relay": dict(default="500"),
    "m_404_always_real": dict(model="no-such-model:1b"),
}
MODEL_CONFIGS = ["openai_client_default", "openai_init_chat_model", "openai_mw_only", "openai_stacked", "ollama_client_default",
                 "ollama_mw", "graph_rp_openai_default", "graph_rp_agent_stacked_error"]
TOOL_FAULTS = ["t_refused_once", "t_refused_always", "t_sqlerror_always", "t_timeout_once", "t_timeout_always"]
TOOL_CONFIGS = ["no_tool_mw", "tool_retry_mw", "graph_rp_toolnode"]
BOTH = {"m_drop_once+t_refused_once": ("m_drop_once", "t_refused_once"), "m_drop_always+t_refused_always": ("m_drop_always", "t_refused_always")}
BOTH_CONFIGS = ["openai_client_default", "openai_stacked", "openai_tool_retry", "openai_both_mw"]


class Count(BaseCallbackHandler):
    def __init__(self):
        self.model_starts = 0

    def on_chat_model_start(self, *a, **k):
        self.model_starts += 1


def setup_pg():
    with pg() as c:
        c.execute("create table if not exists lr_ledger (run text, attempt int, at timestamptz default now())")


def make_tool(fault, run_id, counter):
    dead = free_port()

    @tool
    def remote_action(item: str) -> str:
        """Perform a remote action on an item and return its receipt."""
        counter.append(time.time())
        n = len(counter)
        if fault in ("t_refused_always",) or (fault == "t_refused_once" and n == 1):
            r = httpx.post(f"http://127.0.0.1:{dead}/action", json={"item": item}, timeout=1.0)
            return r.text
        with pg() as c:
            if fault == "t_sqlerror_always":
                c.execute("select * from lr_no_such_table where item = %s", (item,))
            c.execute("insert into lr_ledger (run, attempt) values (%s, %s)", (run_id, n))
            if fault == "t_timeout_always" or (fault == "t_timeout_once" and n == 1):
                c.execute("set statement_timeout = 1000")
                c.execute("select pg_sleep(3)")
        return f"receipt {item}-{n}"

    return remote_action


def ledger(run_id):
    with pg() as c:
        return c.execute("select count(*) from lr_ledger where run = %s", (run_id,)).fetchone()[0]


def model_for(config, port, mf):
    name = mf.get("model", MODEL)
    to = TIMEOUT if mf.get("timeout") else 120.0
    if config.startswith("ollama"):
        return chat(model=name, port=port, client_kwargs={"timeout": to})
    if config == "openai_init_chat_model":
        from langchain.chat_models import init_chat_model
        return init_chat_model(f"openai:{name}", base_url=f"http://127.0.0.1:{port}/v1", api_key="ollama-local-no-key", temperature=0, seed=42, timeout=to)
    kw = {"timeout": to}
    if config in ("openai_mw_only",):
        kw["max_retries"] = 0
    return chat_openai(model=name, port=port, **kw)


def build(config, model, tl):
    mw = []
    if config in ("openai_mw_only", "openai_stacked", "ollama_mw", "openai_both_mw"):
        mw.append(ModelRetryMiddleware())
    if config in ("tool_retry_mw", "openai_tool_retry", "openai_both_mw"):
        mw.append(ToolRetryMiddleware())
    if config == "graph_rp_openai_default":
        bound = model.bind_tools([tl])

        def call_model(s):
            return {"messages": [bound.invoke(s["messages"])]}
        g = StateGraph(MessagesState)
        g.add_node("model", call_model, retry_policy=RetryPolicy())
        g.add_node("tools", ToolNode([tl]))
        g.add_edge(START, "model")
        g.add_conditional_edges("model", tools_condition)
        g.add_edge("tools", "model")
        return g.compile()
    if config == "graph_rp_agent_stacked_error":
        inner = create_agent(model, tools=[tl], middleware=[ModelRetryMiddleware(on_failure="error")])
        g = StateGraph(MessagesState)
        g.add_node("agent", inner, retry_policy=RetryPolicy())
        g.add_edge(START, "agent")
        g.add_edge("agent", END)
        return g.compile()
    if config == "graph_rp_toolnode":
        bound = model.bind_tools([tl])

        def call_model(s):
            return {"messages": [bound.invoke(s["messages"])]}
        g = StateGraph(MessagesState)
        g.add_node("model", call_model)
        g.add_node("tools", ToolNode([tl]), retry_policy=RetryPolicy())
        g.add_edge(START, "model")
        g.add_conditional_edges("model", tools_condition)
        g.add_edge("tools", "model")
        return g.compile()
    return create_agent(model, tools=[tl], middleware=mw)


def run_cell(group, fault, config, rep, out):
    mfault, tfault = (BOTH[fault] if group == "both" else ((fault, None) if group == "model" else (None, fault)))
    mf = MODEL_FAULTS.get(mfault, {}) if mfault else {}
    relay = Relay(schedule=mf.get("schedule"), default=mf.get("default", "pass"))
    port = free_port() if mf.get("refused") else relay.port
    run_id = uuid.uuid4().hex[:12]
    counter = []
    tl = make_tool(tfault, run_id, counter)
    cfg_model = config if not config.startswith(("no_tool", "tool_retry", "graph_rp_toolnode")) else "ollama_client_default"
    model = model_for(cfg_model, port, mf)
    app = build(config, model, tl)
    cb = Count()
    rec = {"group": group, "fault": fault, "config": config, "rep": rep, "model_class": type(model).__name__,
           "client_max_retries": getattr(getattr(model, "root_client", None), "max_retries", None),
           "relay_injected": "relay" in (mfault or ""), "timeout_s": TIMEOUT if mf.get("timeout") else 120.0, "load": __import__("os").getloadavg()}
    CONNECTS.clear()
    t0 = time.time()
    try:
        res = app.invoke({"messages": [{"role": "user", "content": PROMPT}]}, {"callbacks": [cb]})
        rec["outcome"] = "returned"
        rec["final_messages"] = msgs_brief(res["messages"])
    except Exception as e:
        rec["outcome"] = "raised"
        rec["exception"] = f"{type(e).__module__}.{type(e).__name__}: {str(e)[:300]}"
    rec["wall_s"] = round(time.time() - t0, 2)
    time.sleep(0.2)
    relay.close()
    if mf.get("refused"):
        rec["wire_model_attempts"] = sum(1 for p in CONNECTS if p == port)
        rec["wire_count_source"] = "socket.create_connection calls to the closed port"
    else:
        rec["wire_model_attempts"] = len(relay.arrivals)
        rec["wire_count_source"] = "relay arrivals (logged on arrival)"
        rec["wire_actions"] = [a["action"] for a in relay.arrivals]
    rec["model_starts_callback"] = cb.model_starts
    rec["tool_executions"] = len(counter)
    rec["ledger_rows"] = ledger(run_id)
    jl(out, rec)
    print(group, fault, config, rep, rec["outcome"], "model_wire", rec["wire_model_attempts"], "tool_exec", rec["tool_executions"],
          "ledger", rec["ledger_rows"], rec["wall_s"], (rec.get("exception") or "")[:90], flush=True)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--reps", type=int, default=3)
    p.add_argument("--group", choices=["model", "tool", "both"], required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--only", default="")
    a = p.parse_args()
    setup_pg()
    out = OUT / a.out
    jl(out, header("t05_real.py", group=a.group, prompt=PROMPT, timeout_s=TIMEOUT, hold=HOLD))
    if a.group == "model":
        cells = [(f, c) for f in MODEL_FAULTS for c in MODEL_CONFIGS]
        cells = [(f, c) for f, c in cells if c != "openai_init_chat_model" or f in ("m_drop_always", "m_500_always_relay", "m_timeout_always")]
    elif a.group == "tool":
        cells = [(f, c) for f in TOOL_FAULTS for c in TOOL_CONFIGS]
    else:
        cells = [(f, c) for f in BOTH for c in BOTH_CONFIGS]
    if a.only:
        cells = [x for x in cells if x[0] in a.only.split(",")]
    for rep in range(a.reps):
        for f, c in cells:
            run_cell(a.group, f, c, rep, out)


if __name__ == "__main__":
    main()
