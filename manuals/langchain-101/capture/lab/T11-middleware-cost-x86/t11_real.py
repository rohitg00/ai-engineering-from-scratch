import argparse
import json
import os
import random
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lr_common import MODEL, Relay, chat, free_port, header, jl, msgs_brief

import httpx
from langchain.agents import create_agent
from langchain.agents.middleware import (AgentMiddleware, HumanInTheLoopMiddleware, ModelCallLimitMiddleware, ModelRetryMiddleware,
                                         PIIMiddleware, SummarizationMiddleware, ToolCallLimitMiddleware, ToolRetryMiddleware)
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.tools import tool
from langchain_ollama import ChatOllama
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import Command

OUT = Path(__file__).resolve().parent
T = {"model_ns": 0, "calls": 0}


class TimedOllama(ChatOllama):
    def _generate(self, *a, **k):
        t0 = time.perf_counter_ns()
        try:
            return super()._generate(*a, **k)
        finally:
            T["model_ns"] += time.perf_counter_ns() - t0
            T["calls"] += 1


def timed():
    return TimedOllama(model=MODEL, temperature=0, seed=42)


@tool
def echo(text: str) -> str:
    """Echo the text back."""
    return text


PROMPT = "Call the tool echo with text 'hi'. After it returns, reply with the single word: done."


def _bm(self, state, runtime):
    return None


def _wm(self, request, handler):
    return handler(request)


HOOKS = {"before_model": _bm, "after_model": _bm, "before_agent": _bm, "wrap_model_call": _wm, "wrap_tool_call": _wm}
PER_RUN = {"before_model": 2, "after_model": 2, "before_agent": 1, "wrap_model_call": 2, "wrap_tool_call": 1}


def noop(hook, k):
    return [type(f"Noop_{hook}_{i}", (AgentMiddleware,), {hook: HOOKS[hook]})() for i in range(k)]


def builtin(name):
    m = {"summarization_nofire": [SummarizationMiddleware(model=chat(), trigger=("tokens", 10_000_000))],
         "model_call_limit": [ModelCallLimitMiddleware(run_limit=1000)],
         "tool_call_limit": [ToolCallLimitMiddleware(run_limit=1000)],
         "pii_email": [PIIMiddleware("email", strategy="redact")],
         "pii_5types": [PIIMiddleware(t, strategy="redact") for t in ("email", "credit_card", "ip", "mac_address", "url")],
         "tool_retry": [ToolRetryMiddleware()], "model_retry": [ModelRetryMiddleware()],
         "hitl_nointerrupt": [HumanInTheLoopMiddleware(interrupt_on={"echo": False, "other_tool": True})]}
    if name == "stack5":
        return builtin("summarization_nofire") + builtin("pii_email") + builtin("model_call_limit") + builtin("tool_retry") + builtin("hitl_nointerrupt")
    return m[name]


def cost(out, per, warm):
    cells = [("none", 0)]
    for h, ks in (("before_model", (1, 10, 20)), ("after_model", (10, 20)), ("before_agent", (10, 20)), ("wrap_model_call", (10, 20)),
                  ("wrap_tool_call", (10, 20))):
        cells += [(h, k) for k in ks]
    cells += [(b, None) for b in ("summarization_nofire", "model_call_limit", "tool_call_limit", "pii_email", "pii_5types", "tool_retry",
                                  "model_retry", "hitl_nointerrupt", "stack5")]
    jl(out, header("t11_real.py cost", prompt=PROMPT, per=per, warm=warm, cells=cells,
                   note="model_us = time inside ChatOllama._generate (HTTP + inference); framework_us = wall - model_us; tool is echo"))
    agents = {c: create_agent(timed(), tools=[echo], middleware=(noop(*c) if c[1] else (builtin(c[0]) if c[0] != "none" else [])))
              for c in cells}
    for rnd in range(per + warm):
        order = cells[:]
        random.Random(rnd).shuffle(order)
        for c in order:
            T["model_ns"] = 0
            T["calls"] = 0
            c0 = time.process_time_ns()
            t0 = time.perf_counter_ns()
            res = agents[c].invoke({"messages": [HumanMessage(PROMPT)]})
            t1 = time.perf_counter_ns()
            c1 = time.process_time_ns()
            msgs = res["messages"]
            ok = T["calls"] == 2 and any(isinstance(m, ToolMessage) for m in msgs) and "done" in str(msgs[-1].content).lower()
            jl(out, {"phase": "cost", "cell": c[0], "k": c[1], "round": rnd, "warm": rnd < warm, "wall_us": (t1 - t0) / 1e3,
                     "model_us": T["model_ns"] / 1e3, "framework_us": (t1 - t0 - T["model_ns"]) / 1e3, "cpu_us": (c1 - c0) / 1e3,
                     "model_calls": T["calls"], "ok": ok, "final": str(msgs[-1].content)[:40], "load": os.getloadavg(),
                     "hook_calls_per_run": PER_RUN.get(c[0], 0) * (c[1] or 0)})
        print("round", rnd, os.getloadavg(), flush=True)


class Seen(BaseCallbackHandler):
    def __init__(self):
        self.inputs = []

    def on_chat_model_start(self, serialized, messages, **kw):
        self.inputs.append([[m.type, str(m.content)[:200]] for m in messages[0]])


def history(n):
    msgs = []
    for i in range(n // 2):
        msgs.append(HumanMessage(f"Note {i}: the budget for item {i} is {100 + i} euros."))
        msgs.append(AIMessage(f"Noted: item {i} costs {100 + i} euros."))
    return msgs


def run_one(agent, inp, cfg=None):
    cb = Seen()
    cfg = dict(cfg or {})
    cfg["callbacks"] = [cb]
    rec = {}
    t0 = time.time()
    try:
        res = agent.invoke(inp, cfg, version="v2") if cfg.get("configurable") else agent.invoke(inp, cfg)
        val = res.value if hasattr(res, "value") else res
        rec["outcome"] = "returned"
        rec["interrupts"] = [i.value for i in getattr(res, "interrupts", [])] if hasattr(res, "interrupts") else []
        rec["messages"] = msgs_brief(val["messages"])
    except Exception as e:
        rec["outcome"] = "raised"
        rec["exception"] = f"{type(e).__module__}.{type(e).__name__}: {str(e)[:300]}"
    rec["secs"] = round(time.time() - t0, 2)
    rec["model_inputs"] = cb.inputs
    rec["n_model_calls"] = len(cb.inputs)
    return rec


def acts(out, reps):
    jl(out, header("t11_real.py acts", note="built-in middleware set so that it acts, real model, n per case = reps"))
    dead = free_port()

    @tool
    def fetch(url: str) -> str:
        """Fetch a URL and return its body."""
        return httpx.get(f"http://127.0.0.1:{dead}/x", timeout=1.0).text

    ask_sum = "What is the budget for item 3? Answer with the number only."
    two = "In one turn, call echo with text 'a' and echo with text 'b' as two parallel tool calls, then reply done."
    cases = {
        "summarization_fires_messages8": (lambda: create_agent(chat(), tools=[echo], middleware=[SummarizationMiddleware(model=chat(), trigger=("messages", 8), keep=("messages", 4))]),
                                          lambda: {"messages": history(20) + [HumanMessage(ask_sum)]}, None),
        "summarization_control_nofire": (lambda: create_agent(chat(), tools=[echo], middleware=[SummarizationMiddleware(model=chat(), trigger=("messages", 1000))]),
                                         lambda: {"messages": history(20) + [HumanMessage(ask_sum)]}, None),
        "pii_email_redact": (lambda: create_agent(chat(), tools=[echo], middleware=[PIIMiddleware("email", strategy="redact")]),
                             lambda: {"messages": [HumanMessage("My email is jane.doe@example.org. Repeat my email address back to me exactly.")]}, None),
        "pii_email_mask": (lambda: create_agent(chat(), tools=[echo], middleware=[PIIMiddleware("email", strategy="mask")]),
                           lambda: {"messages": [HumanMessage("My email is jane.doe@example.org. Repeat my email address back to me exactly.")]}, None),
        "pii_email_block": (lambda: create_agent(chat(), tools=[echo], middleware=[PIIMiddleware("email", strategy="block")]),
                            lambda: {"messages": [HumanMessage("My email is jane.doe@example.org. Repeat my email address back to me exactly.")]}, None),
        "pii_email_output_only": (lambda: create_agent(chat(), tools=[echo], middleware=[PIIMiddleware("email", strategy="redact", apply_to_input=False, apply_to_output=True)]),
                                  lambda: {"messages": [HumanMessage("Write one example email address for a user named Jane at example.org.")]}, None),
        "model_call_limit_1_end": (lambda: create_agent(chat(), tools=[echo], middleware=[ModelCallLimitMiddleware(run_limit=1, exit_behavior="end")]),
                                   lambda: {"messages": [HumanMessage(PROMPT)]}, None),
        "model_call_limit_1_error": (lambda: create_agent(chat(), tools=[echo], middleware=[ModelCallLimitMiddleware(run_limit=1, exit_behavior="error")]),
                                     lambda: {"messages": [HumanMessage(PROMPT)]}, None),
        "tool_call_limit_1_parallel": (lambda: create_agent(chat(), tools=[echo], middleware=[ToolCallLimitMiddleware(run_limit=1)]),
                                       lambda: {"messages": [HumanMessage(two)]}, None),
        "tool_retry_refused_port": (lambda: create_agent(chat(), tools=[fetch], middleware=[ToolRetryMiddleware()]),
                                    lambda: {"messages": [HumanMessage("Fetch http://example.test/x with the fetch tool and tell me what it returned.")]}, None),
        "hitl_interrupt_real_call": (lambda: create_agent(chat(), tools=[echo], middleware=[HumanInTheLoopMiddleware(interrupt_on={"echo": True})], checkpointer=InMemorySaver()),
                                     lambda: {"messages": [HumanMessage(PROMPT)]}, "hitl"),
    }
    for rep in range(reps):
        for name, (mk, inp, kind) in cases.items():
            agent = mk()
            if kind == "hitl":
                cfg = {"configurable": {"thread_id": f"{name}-{rep}"}}
                rec = run_one(agent, inp(), cfg)
                rec2 = run_one(agent, Command(resume={"decisions": [{"type": "approve"}]}), cfg)
                rec = {"start": rec, "after_approve": rec2}
            else:
                rec = run_one(agent, inp())
            jl(out, {"phase": "acts", "case": name, "rep": rep, **rec})
            print(name, rep, json.dumps(rec)[:260], flush=True)
    for rep in range(reps):
        relay = Relay(schedule=["drop"])
        agent = create_agent(chat(port=relay.port), tools=[echo], middleware=[ModelRetryMiddleware()])
        rec = run_one(agent, {"messages": [HumanMessage(PROMPT)]})
        rec["relay_actions"] = [a["action"] for a in relay.arrivals]
        relay.close()
        jl(out, {"phase": "acts", "case": "model_retry_relay_drop_once", "rep": rep, **rec})
        print("model_retry_relay_drop_once", rep, json.dumps(rec)[:200], flush=True)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--phase", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--per", type=int, default=20)
    p.add_argument("--warm", type=int, default=2)
    p.add_argument("--reps", type=int, default=3)
    a = p.parse_args()
    if a.phase == "cost":
        cost(OUT / a.out, a.per, a.warm)
    else:
        acts(OUT / a.out, a.reps)


if __name__ == "__main__":
    main()
