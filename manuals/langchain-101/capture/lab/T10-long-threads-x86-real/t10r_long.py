import argparse
import json
import os
import random
import re
import sys
import time

os.environ["LANGSMITH_TRACING"] = "false"
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import psycopg
from langchain.agents import create_agent
from langchain.agents.middleware import AgentMiddleware, SummarizationMiddleware
from langchain.tools import tool
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.messages.utils import count_tokens_approximately
from langgraph.checkpoint.postgres import PostgresSaver

from lr_common import header, jl, chat

DSN = os.environ.get("T10_PG", "postgresql:///lr2")
SYSTEM = "You are a helpful assistant. Answer in one short sentence. Use the add tool for every addition."
FACTS = [
    ("code word", "Please remember this: the code word is ORCHID-7.", "What is the code word I gave you? Answer with the value only.", ["orchid-7", "orchid 7"]),
    ("order number", "Please remember this: my order number is 73914.", "What is my order number? Answer with the value only.", ["73914"]),
    ("cat name", "Please remember this: my cat is named Pixel.", "What is my cat's name? Answer with the value only.", ["pixel"]),
    ("city", "Please remember this: my favourite city is Lisbon.", "What is my favourite city? Answer with the value only.", ["lisbon"]),
    ("budget", "Please remember this: my budget is 4250 dollars.", "What is my budget? Answer with the value only.", ["4250", "4,250"]),
]
TOPICS = ["a prime number", "photosynthesis", "a glacier", "the speed of sound", "a haiku", "an atom", "a volcano", "gravity",
          "a compiler", "the moon", "a rainbow", "an ocean current", "a database index", "a honeybee", "a solar eclipse",
          "an earthquake", "a violin", "a lighthouse", "a fern", "a comet"]

VARIANTS = {
    "none": None,
    "msgs60_keep7": dict(trigger=("messages", 60), keep=("messages", 7)),
    "tok6000_keep1500": dict(trigger=("tokens", 6000), keep=("tokens", 1500)),
    "msgs20_keep1": dict(trigger=("messages", 20), keep=("messages", 1)),
}


@tool
def add(a: int, b: int) -> int:
    """Add two integers."""
    return a + b


class Rec:
    def __init__(self):
        self.reset()

    def reset(self):
        self.calls = []
        self.summ = []


REC = Rec()


class LogModel(AgentMiddleware):
    def wrap_model_call(self, request, handler):
        msgs = request.messages
        ids = set()
        orphan = 0
        for m in msgs:
            for tc in getattr(m, "tool_calls", None) or []:
                ids.add(tc.get("id"))
            if m.type == "tool" and m.tool_call_id not in ids:
                orphan += 1
        approx = count_tokens_approximately(([request.system_message] if getattr(request, "system_message", None) else []) + list(msgs))
        t0 = time.perf_counter()
        resp = handler(request)
        dt = (time.perf_counter() - t0) * 1000
        ai = resp.result[-1] if hasattr(resp, "result") else resp
        u = getattr(ai, "usage_metadata", None) or {}
        md = getattr(ai, "response_metadata", None) or {}
        REC.calls.append({"ms": round(dt, 1), "req_msgs": len(msgs), "approx_tok": approx, "in_tok": u.get("input_tokens"), "out_tok": u.get("output_tokens"),
                          "prompt_eval_ms": round((md.get("prompt_eval_duration") or 0) / 1e6, 1), "eval_ms": round((md.get("eval_duration") or 0) / 1e6, 1),
                          "orphans": orphan, "n_tool_calls": len(getattr(ai, "tool_calls", None) or [])})
        return resp


class SummTimer(BaseCallbackHandler):
    def __init__(self):
        self.t0 = {}

    def on_chat_model_start(self, serialized, messages, *, run_id, **kw):
        self.t0[run_id] = (time.perf_counter(), sum(len(b) for b in messages), count_tokens_approximately(messages[0]) if messages else None)

    def on_llm_end(self, response, *, run_id, **kw):
        t0, n, approx = self.t0.pop(run_id, (time.perf_counter(), None, None))
        u = {}
        try:
            u = response.generations[0][0].message.usage_metadata or {}
        except Exception:
            pass
        REC.summ.append({"ms": round((time.perf_counter() - t0) * 1000, 1), "in_msgs": n, "approx_tok": approx, "in_tok": u.get("input_tokens"), "out_tok": u.get("output_tokens")})


def thread_bytes(conn, tid):
    q = """select coalesce((select sum(octet_length(checkpoint::text)+octet_length(metadata::text)) from checkpoints where thread_id=%(t)s),0),
                  coalesce((select sum(octet_length(blob)) from checkpoint_blobs where thread_id=%(t)s),0),
                  coalesce((select sum(octet_length(blob)) from checkpoint_writes where thread_id=%(t)s),0),
                  (select count(*) from checkpoints where thread_id=%(t)s)"""
    a, b, c, n = conn.execute(q, {"t": tid}).fetchone()
    return {"ckpt_json": int(a), "blobs": int(b), "writes": int(c), "total": int(a + b + c), "rows": int(n)}


def turn_plan(turn, rng):
    if turn <= len(FACTS):
        return "fact", FACTS[turn - 1][1], None
    k = (turn - len(FACTS) - 1) % 3
    if k == 0:
        return "plain", f"In one sentence, what is {TOPICS[turn % len(TOPICS)]}?", None
    if k == 1:
        a, b = rng.randint(100, 999), rng.randint(100, 999)
        return "tool1", f"Use the add tool to add {a} and {b}, then tell me the result.", [a + b]
    a, b, c, d = (rng.randint(100, 999) for _ in range(4))
    return "tool2", f"Use the add tool twice in parallel: add {a} and {b}, and add {c} and {d}. Tell me both results.", [a + b, c + d]


def has_num(text, n):
    t = text.replace(",", "")
    return re.search(rf"(?<!\d){n}(?!\d)", t) is not None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("variant", choices=list(VARIANTS))
    ap.add_argument("out")
    ap.add_argument("--turns", type=int, default=300)
    ap.add_argument("--probe-every", type=int, default=25)
    ap.add_argument("--bytes-every", type=int, default=10)
    ap.add_argument("--deadline", type=float, default=0)
    ap.add_argument("--num-predict", type=int, default=160)
    a = ap.parse_args()
    rng = random.Random(42)
    model = chat(num_predict=a.num_predict, num_ctx=8192)
    mw = [LogModel()]
    cfgv = VARIANTS[a.variant]
    if cfgv:
        smodel = chat(num_predict=512, num_ctx=8192, callbacks=[SummTimer()])
        mw = [SummarizationMiddleware(model=smodel, **cfgv), LogModel()]
    tid = f"t10r-{a.variant}-{int(time.time())}"
    jl(a.out, header("t10r_long.py", variant=a.variant, summarization=cfgv and {k: list(v) for k, v in cfgv.items()}, turns_planned=a.turns,
                     probe_every=a.probe_every, num_predict=a.num_predict, num_ctx=8192, summary_num_predict=512, thread=tid, pg=DSN, durability="async (default)",
                     system_prompt=SYSTEM))
    with PostgresSaver.from_conn_string(DSN) as cp, psycopg.connect(DSN, autocommit=True) as conn:
        cp.setup()
        agent = create_agent(model, tools=[add], system_prompt=SYSTEM, middleware=mw, checkpointer=cp)
        main_ckpt = None
        probe_bytes = 0
        for turn in range(1, a.turns + 1):
            if a.deadline and time.time() > a.deadline:
                jl(a.out, {"kind": "deadline", "turn": turn})
                break
            kind, text, expect = turn_plan(turn, rng)
            cfg = {"configurable": {"thread_id": tid}}
            if main_ckpt:
                cfg["configurable"]["checkpoint_id"] = main_ckpt
            REC.reset()
            t0 = time.perf_counter()
            err = None
            try:
                out = agent.invoke({"messages": [{"role": "user", "content": text}]}, cfg)
            except Exception as e:
                err = f"{type(e).__name__}: {str(e)[:300]}"
                out = None
            lat = (time.perf_counter() - t0) * 1000
            st = agent.get_state({"configurable": {"thread_id": tid}})
            main_ckpt = st.config["configurable"]["checkpoint_id"]
            msgs = st.values.get("messages", [])
            final = msgs[-1].content if msgs and isinstance(msgs[-1].content, str) else ""
            idx = max((i for i, m in enumerate(msgs) if m.type == "human" and m.content == text), default=len(msgs))
            tool_msgs = [m for m in msgs[idx:] if m.type == "tool"]
            correct = None
            if expect:
                correct = all(has_num(final, n) for n in expect) and len(tool_msgs) >= len(expect)
            rec = {"exp": "T10r", "variant": a.variant, "turn": turn, "kind": kind, "latency_ms": round(lat, 1), "error": err,
                   "model_calls": len(REC.calls), "model_ms": round(sum(c["ms"] for c in REC.calls), 1), "calls": REC.calls,
                   "summary_calls": len(REC.summ), "summary_ms": round(sum(s["ms"] for s in REC.summ), 1), "summ": REC.summ,
                   "framework_ms": round(lat - sum(c["ms"] for c in REC.calls) - sum(s["ms"] for s in REC.summ), 1),
                   "state_msgs": len(msgs), "tool_msgs_this_turn": len(tool_msgs), "expect": expect, "correct": correct, "answer": final[:200],
                   "summary_in_state": any(m.type == "human" and isinstance(m.content, str) and m.content.startswith("Here is a summary") for m in msgs)}
            if turn % a.bytes_every == 0 or turn == a.turns:
                b = thread_bytes(conn, tid)
                b["probe_bytes_cum"] = probe_bytes
                b["main_total"] = b["total"] - probe_bytes
                rec["bytes"] = b
            if turn % a.probe_every == 0:
                before = thread_bytes(conn, tid)["total"]
                probes = []
                for name, _, q, keys in FACTS:
                    REC.reset()
                    t1 = time.perf_counter()
                    try:
                        po = agent.invoke({"messages": [{"role": "user", "content": q}]},
                                          {"configurable": {"thread_id": tid, "checkpoint_id": main_ckpt}})
                        ans = po["messages"][-1].content if isinstance(po["messages"][-1].content, str) else str(po["messages"][-1].content)
                        perr = None
                    except Exception as e:
                        ans, perr = "", f"{type(e).__name__}: {str(e)[:200]}"
                    probes.append({"fact": name, "answer": ans[:160], "correct": any(k in ans.lower().replace(",", "") or k in ans.lower() for k in keys),
                                   "ms": round((time.perf_counter() - t1) * 1000, 1), "error": perr, "calls": REC.calls, "summary_calls": len(REC.summ)})
                probe_bytes += thread_bytes(conn, tid)["total"] - before
                rec["probes"] = probes
                rec["recall"] = sum(p["correct"] for p in probes)
            jl(a.out, rec)
            print(f"{a.variant} t{turn} {kind} {lat:.0f}ms calls={len(REC.calls)} summ={rec['summary_calls']} ok={correct} "
                  f"in_tok={[c['in_tok'] for c in rec['calls']]} {('recall=%d' % rec['recall']) if 'recall' in rec else ''}", flush=True)
    jl(a.out, {"kind": "done", "time": time.time(), "load": os.getloadavg()})


if __name__ == "__main__":
    main()
