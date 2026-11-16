import argparse
import asyncio
import json
import re
import subprocess
import sys
import time
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
B2 = HERE.parent
KIT = B2.parent / "bench" / "kit"
sys.path.insert(0, str(KIT))
sys.path.insert(0, str(B2 / "overlay"))

from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.messages import HumanMessage

import harnesses as H
import models as M
import run as R
from env import BENCH
from harnesses import SYSTEM_PROMPT, _GraphHarness

FS_BUILTINS = frozenset({"ls", "read_file", "write_file", "edit_file", "glob", "grep", "delete", "execute"})
PROFILE_SUFFIX = (
    "The tools named for this task are the only way to reach its data, files, database, notes and documents. "
    "Call those task tools directly. The built-in workspace is empty, so do not look for files there and do not delegate."
)
RUBRIC = (
    "1. Every fact, number, row or file content the assistant relied on came from a tool result in this transcript, not from memory. "
    "2. If the user asked a question, the assistant called submit_answer once with only the final value, and that value follows from the tool results with correct arithmetic and the units or currency the user asked for. "
    "3. If the user asked for file or note changes, every requested change was made with the tools and nothing else was changed. "
    "4. Every part of the user's request was done."
)
R.DEEP_BUILTINS.update({"eval", "delete"})


class ToolSeen(BaseCallbackHandler):
    def __init__(self):
        self.first = None

    def on_chat_model_start(self, serialized, messages, *, run_id, invocation_params=None, **kw):
        if self.first is None:
            tools = (invocation_params or {}).get("tools") or kw.get("kwargs", {}).get("tools") or []
            names = []
            for t in tools:
                f = t.get("function", t) if isinstance(t, dict) else {}
                names.append(f.get("name"))
            sysmsg = messages[0][0].content if messages and messages[0] else ""
            self.first = {"tools": names, "system_chars": len(sysmsg) if isinstance(sysmsg, str) else len(json.dumps(sysmsg))}


class SplitMeter(M.Meter):
    def __init__(self, *a, judge_name=None, **kw):
        super().__init__(*a, **kw)
        self.judge_name = judge_name
        self.judge_calls = []
        self._judge_runs = set()

    def _is_judge(self, kw):
        name = (kw.get("metadata") or {}).get("ls_model_name") or (kw.get("invocation_params") or {}).get("model")
        return self.judge_name is not None and name == self.judge_name

    def on_chat_model_start(self, serialized, messages, *, run_id, **kw):
        if self._is_judge(kw):
            self._judge_runs.add(run_id)
            self._start[run_id] = time.perf_counter()
            return
        super().on_chat_model_start(serialized, messages, run_id=run_id, **kw)

    def on_llm_end(self, response, *, run_id, **kw):
        if run_id in self._judge_runs:
            self._judge_runs.discard(run_id)
            dt = time.perf_counter() - self._start.pop(run_id, time.perf_counter())
            rec = {"dt": dt}
            try:
                u = getattr(response.generations[0][0].message, "usage_metadata", None) or {}
                rec.update({"in": u.get("input_tokens", 0), "out": u.get("output_tokens", 0)})
            except Exception as e:
                rec["meter_error"] = repr(e)
            self.judge_calls.append(rec)
            return
        super().on_llm_end(response, run_id=run_id, **kw)

    def on_llm_error(self, error, *, run_id, **kw):
        if run_id in self._judge_runs:
            self._judge_runs.discard(run_id)
            dt = time.perf_counter() - self._start.pop(run_id, time.perf_counter())
            self.judge_calls.append({"dt": dt, "error": repr(error)[:300]})
            return
        super().on_llm_error(error, run_id=run_id, **kw)


class _Seen(_GraphHarness):
    def __init__(self, graph, meter):
        super().__init__(graph, meter)
        self.seen_tools = ToolSeen()
        self.cfg["callbacks"] = [meter, self.seen_tools]


class DeepProfile(_Seen):
    name = "deep_profile"

    def __init__(self, model, tools, meter, provider="ollama", **_):
        from deepagents import create_deep_agent
        from langgraph.checkpoint.memory import InMemorySaver
        g = create_deep_agent(model=model, tools=tools, system_prompt=SYSTEM_PROMPT, checkpointer=InMemorySaver())
        super().__init__(g, meter)


LOOP = asyncio.new_event_loop()


class DeepPTC(_Seen):
    name = "deep_ptc"

    def __init__(self, model, tools, meter, provider="ollama", **_):
        from deepagents import create_deep_agent
        from langchain_quickjs import CodeInterpreterMiddleware
        from langgraph.checkpoint.memory import InMemorySaver
        mw = [CodeInterpreterMiddleware(ptc=list(tools))]
        g = create_deep_agent(model=model, tools=tools, system_prompt=SYSTEM_PROMPT, middleware=mw, checkpointer=InMemorySaver())
        super().__init__(g, meter)

    def turn(self, text):
        out = LOOP.run_until_complete(self.graph.ainvoke({"messages": [HumanMessage(text)]}, self.cfg))
        msgs = out["messages"]
        new = msgs[self.seen:]
        self.seen = len(msgs)
        return new, msgs


PTC_NUDGE = (
    "When a task needs more than one tool lookup or any arithmetic, write one JavaScript program in the eval tool "
    "that calls the task tools through the tools namespace, computes the result, and calls tools.submitAnswer with the final value."
)


class DeepPTCNudge(DeepPTC):
    name = "deep_ptc_nudge"

    def __init__(self, model, tools, meter, provider="ollama", **_):
        from deepagents import create_deep_agent
        from langchain_quickjs import CodeInterpreterMiddleware
        from langgraph.checkpoint.memory import InMemorySaver
        mw = [CodeInterpreterMiddleware(ptc=list(tools))]
        g = create_deep_agent(model=model, tools=tools, system_prompt=SYSTEM_PROMPT + " " + PTC_NUDGE, middleware=mw, checkpointer=InMemorySaver())
        _Seen.__init__(self, g, meter)


class AgentRubric(_Seen):
    name = "agent_rubric"
    judge = None

    def __init__(self, model, tools, meter, provider="ollama", **_):
        from deepagents import RubricMiddleware
        from langchain.agents import create_agent
        from langgraph.checkpoint.memory import InMemorySaver
        self.evaluations = []
        rm = RubricMiddleware(model=self.judge, max_iterations=3, on_evaluation=self.evaluations.append)
        g = create_agent(model, tools=tools, system_prompt=SYSTEM_PROMPT, middleware=[rm], checkpointer=InMemorySaver())
        super().__init__(g, meter)

    def turn(self, text):
        out = self.graph.invoke({"messages": [HumanMessage(text)], "rubric": RUBRIC}, self.cfg)
        msgs = out["messages"]
        new = msgs[self.seen:]
        self.seen = len(msgs)
        return new, msgs


class AgentControl(_Seen):
    name = "agent_control"

    def __init__(self, model, tools, meter, provider="ollama", **_):
        from langchain.agents import create_agent
        from langgraph.checkpoint.memory import InMemorySaver
        g = create_agent(model, tools=tools, system_prompt=SYSTEM_PROMPT, checkpointer=InMemorySaver())
        super().__init__(g, meter)


class DeepControl(_Seen):
    name = "deep_control"

    def __init__(self, model, tools, meter, provider="ollama", **_):
        from deepagents import create_deep_agent
        from langgraph.checkpoint.memory import InMemorySaver
        g = create_deep_agent(model=model, tools=tools, system_prompt=SYSTEM_PROMPT, checkpointer=InMemorySaver())
        super().__init__(g, meter)


for cls in (DeepProfile, DeepPTC, DeepPTCNudge, AgentRubric, AgentControl, DeepControl):
    H.HARNESSES[cls.name] = cls

EVAL_ERR = re.compile(r'<error type="([A-Za-z]+)"')


def ptc_stats(messages):
    evals, errs, inner = 0, [], 0
    for m in messages:
        for tc in getattr(m, "tool_calls", None) or []:
            if tc["name"] == "eval":
                evals += 1
        if getattr(m, "type", "") == "tool" and getattr(m, "name", "") == "eval":
            errs += EVAL_ERR.findall(str(m.content))
    return {"eval_calls": evals, "eval_errors": len(errs), "eval_error_types": sorted(set(errs))}


def run_task(task, hname, model, meta, args, rep, judge_name=None):
    env = R.Env(task)
    provider = meta["provider"]
    tools = R.build_tools(env, R.FAMILY_TOOLS[task["family"]])
    meter = SplitMeter(args.max_calls, provider=provider, model_name=meta.get("model"), cell=f"{hname}|{args.tag}|{meta.get('model', meta.get('tag'))}", judge_name=judge_name)
    error, messages, h, tb = None, [], None, None
    t0 = time.perf_counter()
    try:
        h = H.HARNESSES[hname](model, tools, meter, provider=provider, env=env)
        for text in task["turns"]:
            meter.new_turn()
            _, messages = h.turn(text)
    except M.BudgetExceeded:
        env.close()
        raise
    except Exception as e:
        import traceback
        error = e
        if h is not None:
            messages = h.messages if hasattr(h, "messages") else h.state_messages()
        tb = traceback.format_exc()[-1500:]
    wall = time.perf_counter() - t0
    allowed = {t.name for t in tools} | (R.DEEP_BUILTINS if hname.startswith("deep") else set())
    res = R.check(task, env, messages, error, allowed)
    model_s = sum(c["dt"] for c in meter.calls)
    row = {
        "run_id": args.run_id, "tag": args.tag, "ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "task_id": task["id"], "family": task["family"],
        "harness": hname, "profile": args.profile, "model": meta.get("tag") or meta.get("model"), "provider": provider, "repeat": rep,
        "n_tools": len(tools), **res,
        "model_calls": len(meter.calls), "model_call_errors": sum(1 for c in meter.calls if "error" in c),
        "in_tokens": sum(c.get("in", 0) for c in meter.calls), "out_tokens": sum(c.get("out", 0) for c in meter.calls),
        "cost_usd": round(sum(c.get("cost", 0) for c in meter.calls), 6),
        "wall_s": round(wall, 3), "model_s": round(model_s, 3), "tool_s": round(env.tool_time, 4),
        "per_call": [[c.get("in"), c.get("out"), round(c["dt"], 2)] for c in meter.calls],
        "visible_tools": getattr(getattr(h, "seen_tools", None), "first", None),
        "builtins_used": sorted({n for n in res["tool_seq"] if n in R.DEEP_BUILTINS}),
        "error": None if error is None else f"{type(error).__name__}: {str(error)[:400]}",
        "traceback": tb if error is not None and res["category"] == "harness_error" else None,
    }
    if hname.startswith("deep_ptc"):
        row.update(ptc_stats(messages))
        row["inner_tool_calls"] = len(env.log)
    if judge_name:
        row["judge_model"] = judge_name
        row["judge_calls"] = len(meter.judge_calls)
        row["judge_call_errors"] = sum(1 for c in meter.judge_calls if "error" in c)
        row["judge_in_tokens"] = sum(c.get("in", 0) for c in meter.judge_calls)
        row["judge_out_tokens"] = sum(c.get("out", 0) for c in meter.judge_calls)
        row["judge_s"] = round(sum(c["dt"] for c in meter.judge_calls), 3)
        evs = getattr(h, "evaluations", []) or []
        row["rubric_evaluations"] = [{k: (v if k != "criteria" else None) for k, v in dict(e).items() if k in ("result", "explanation", "iteration", "unverified")} for e in evs]
        row["rubric_results"] = [dict(e).get("result") for e in evs]
        row["revision_turns"] = sum(1 for m in messages if getattr(m, "type", "") == "human" and getattr(m, "name", None) == "rubric_grader")
    if task["family"] == "files":
        row["final_state"] = {k: v[:200] for k, v in env.fs_state().items()}
    elif task["family"] == "multiturn":
        row["final_state"] = env.kv
    env.close()
    return row


def patch_async_anthropic(model):
    import ssl

    import anthropic
    import certifi
    try:
        import httpx2 as hx
    except ImportError:
        import httpx as hx
    ctx = ssl.create_default_context(cafile=certifi.where())
    key = M.KEY_FILE.read_text().strip()
    model.__dict__["_async_client"] = anthropic.AsyncAnthropic(api_key=key, max_retries=3, timeout=90, http_client=hx.AsyncClient(verify=ctx, timeout=60))
    del key


def register_profile(p):
    if p in (None, "none"):
        return None
    from deepagents import HarnessProfile, register_harness_profile
    if p == "A":
        prof = HarnessProfile(excluded_tools=FS_BUILTINS)
    elif p == "B":
        prof = HarnessProfile(excluded_tools=FS_BUILTINS, system_prompt_suffix=PROFILE_SUFFIX)
    else:
        raise ValueError(p)
    register_harness_profile("ollama", prof)
    return prof


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", required=True)
    ap.add_argument("--harness", required=True)
    ap.add_argument("--tasks", default="all")
    ap.add_argument("--out", required=True)
    ap.add_argument("--tag", required=True)
    ap.add_argument("--profile", default="none")
    ap.add_argument("--judge", default=None)
    ap.add_argument("--judge-host", default=None)
    ap.add_argument("--max-calls", type=int, default=10)
    ap.add_argument("--max-tokens", type=int, default=None)
    ap.add_argument("--stop-usd", type=float, default=None)
    args = ap.parse_args()
    args.run_id = uuid.uuid4().hex[:8]
    register_profile(args.profile)
    out = B2 / "runs" / args.out
    tasks = [t for t in R.load_tasks(args.tasks) if t["id"] != "sql19"]
    done = set()
    if out.exists():
        for l in out.read_text().splitlines():
            if l.strip():
                r = json.loads(l)
                done.add((r["task_id"], r["harness"], r["model"], r["tag"]))
    judge_name = None
    if args.judge:
        jm, jmeta = M.make_model(args.judge)
        if args.judge_host:
            from langchain_ollama import ChatOllama
            jm = ChatOllama(model=jmeta["tag"], reasoning=False, base_url=args.judge_host, **M.OLLAMA_DEFAULTS)
        AgentRubric.judge = jm
        judge_name = jmeta["tag"]
    man = B2 / "runs" / "models.jsonl"
    for spec in args.models.split(","):
        model, meta = M.make_model(spec, args.max_tokens)
        if meta["provider"] == "ollama":
            model.invoke("Say ok.")
        if meta["provider"] == "anthropic":
            patch_async_anthropic(model)
        with open(man, "a") as f:
            f.write(json.dumps({"run_id": args.run_id, "ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "harness": args.harness, "tag": args.tag, "profile": args.profile,
                                "judge": args.judge, **meta, "max_calls_per_turn": args.max_calls, "uptime": R.uptime()}) + "\n")
        print(f"== {spec} {args.harness} {args.tag} :: {R.uptime()}", flush=True)
        start_total = M.ledger_total()
        for t in tasks:
            key = (t["id"], args.harness, meta.get("tag") or meta.get("model"), args.tag)
            if key in done:
                continue
            if meta["provider"] == "anthropic":
                tot = M.ledger_total()
                if tot > 40.0 or (args.stop_usd is not None and tot - start_total >= args.stop_usd):
                    print(f"STOP ledger={tot:.4f} spent_this_run={tot - start_total:.4f}", flush=True)
                    return
            try:
                row = run_task(t, args.harness, model, meta, args, 0, judge_name)
            except M.BudgetExceeded as e:
                print("BUDGET STOP:", e, flush=True)
                return
            with open(out, "a") as f:
                f.write(json.dumps(row, default=str) + "\n")
            extra = ""
            if "eval_calls" in row:
                extra = f" eval={row['eval_calls']} jserr={row['eval_errors']} inner={row['inner_tool_calls']}"
            if "judge_calls" in row:
                extra = f" judge={row['judge_calls']} res={row['rubric_results']}"
            print(f"{t['id']:9s} {args.harness:13s} {'PASS' if row['passed'] else 'fail':4s} {row['category'] or '':18s} calls={row['model_calls']:2d} tools={row['tool_calls_executed']:2d} tok={row['in_tokens']}/{row['out_tokens']} {row['wall_s']:.1f}s{extra}", flush=True)
        print(f"== end {spec} :: {R.uptime()}", flush=True)


if __name__ == "__main__":
    main()
