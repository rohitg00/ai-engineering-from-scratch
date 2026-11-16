import json
import os
import sqlite3
import statistics
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "common"))
from instrument import PIN, Recorder, instrument, logging_saver
from pager import SYSTEM, USER, TOOL_FN_S, make_reader
from real import TimedChatOllama, chat, loadavg, machine, ollama_ps, other_python_procs, settings
from langchain.agents import create_agent
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.pregel import _runner

K = int(sys.argv[1]) if len(sys.argv) > 1 else 10
N = int(sys.argv[2]) if len(sys.argv) > 2 else 30
WARM = 2
WORK = Path.home() / "ir-work" / "costs"
WORK.mkdir(parents=True, exist_ok=True)
OUT = []
CELLS = [("none", "async"), ("memory", "async"), ("memory", "sync"), ("memory", "exit"), ("sqlite", "async"), ("sqlite", "sync"), ("sqlite", "exit")]
KEYS = ("prepare_next_tasks", "apply_writes", "tick", "after_tick", "loop.put_writes", "loop._put_checkpoint", "saver.put", "saver.put_writes")


def out(s=""):
    OUT.append(s)
    print(s, flush=True)


def one_run(kind, durability, idx, reader):
    rec = Recorder()
    conn = db = None
    if kind == "none":
        saver = None
    elif kind == "memory":
        saver = logging_saver(InMemorySaver, rec, capture=False)
    else:
        db = WORK / f"c_{os.getpid()}_{idx}.sqlite"
        db.unlink(missing_ok=True)
        conn = sqlite3.connect(str(db), check_same_thread=False)
        saver = logging_saver(SqliteSaver, rec, capture=False, conn=conn)
    agent = create_agent(chat(), [reader], system_prompt=SYSTEM, checkpointer=saver)
    cfg = {"configurable": {"thread_id": f"t{idx}"}}
    kw = {"durability": durability} if saver is not None else {}
    orig = _runner.run_with_retry

    def timed(task, retry_policy, configurable=None, **kw2):
        t1 = time.perf_counter()
        try:
            return orig(task, retry_policy, configurable, **kw2)
        finally:
            rec.timings[f"node:{task.name}"].append(time.perf_counter() - t1)

    n_model = len(TimedChatOllama.calls)
    n_tool = len(TOOL_FN_S)
    _runner.run_with_retry = timed
    t = time.perf_counter()
    try:
        with instrument(rec, capture=False):
            res = agent.invoke({"messages": [{"role": "user", "content": USER}]}, cfg, **kw)
    finally:
        _runner.run_with_retry = orig
    wall = time.perf_counter() - t
    if conn is not None:
        conn.close()
        for p in (db, Path(str(db) + "-wal"), Path(str(db) + "-shm")):
            p.unlink(missing_ok=True)
    calls = TimedChatOllama.calls[n_model:]
    tool_s = sum(TOOL_FN_S[n_tool:])
    tool_msgs = [m for m in res["messages"] if m.type == "tool"]
    model_s = sum(c["model_s"] for c in calls)
    supersteps = len(rec.timings["apply_writes"]) - 1
    r = {"wall_s": wall, "model_provider_s": model_s, "tool_fn_s": tool_s, "framework_s": wall - model_s - tool_s,
         "model_calls": len(calls), "tool_round_trips": len(tool_msgs), "bad_cursor": sum(1 for m in tool_msgs if m.text.startswith("error")),
         "multi_tool_calls": sum(1 for c in calls if (c["n_tool_calls"] or 0) > 1), "supersteps": supersteps,
         "eval_tokens": sum(c["eval_count"] or 0 for c in calls), "prompt_tokens": sum(c["prompt_eval_count"] or 0 for c in calls),
         "timings": {k: (sum(v), len(v)) for k, v in rec.timings.items()}}
    r["clean"] = r["tool_round_trips"] == K and r["bad_cursor"] == 0 and r["multi_tool_calls"] == 0 and res["messages"][-1].type == "ai"
    return r


def med(xs):
    return statistics.median(xs) if xs else None


def pct(xs, p):
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(p * len(xs)))]


def main():
    reader = make_reader(K)
    out(f"# Per-superstep cost with a real model. create_agent + read_page cursor tool, {K} tool round trips + final answer. n={N} runs per cell after {WARM} warmups. pin {PIN}")
    out(f"# {machine()}")
    out(f"# model {settings()}")
    out("# timers: wall = agent.invoke; model_provider = ChatOllama._generate (HTTP call to Ollama incl. response parse); tool_fn = body of read_page; "
        "framework = wall - model_provider - tool_fn (LangGraph loop, LangChain model/tool wrappers, checkpointer on the loop thread). Loop function timers as on the Mac.")
    out()
    rows = {}
    raw = {}
    for kind, dur in CELLS:
        pre = {"loadavg": loadavg(), "ollama_ps": ollama_ps(), "other_python": other_python_procs()}
        for w in range(WARM):
            one_run(kind, dur, 10_000 + w, reader)
        runs = [one_run(kind, dur, i, reader) for i in range(N)]
        post_load = loadavg()
        clean = [r for r in runs if r["clean"]]
        raw[f"{kind}/{dur}"] = runs
        ss = med([r["supersteps"] for r in clean])
        row = {"n": N, "clean_runs": len(clean), "load_before": pre, "loadavg_after": post_load, "supersteps_median": ss}
        for f in ("wall_s", "model_provider_s", "tool_fn_s", "framework_s"):
            xs = [r[f] for r in clean]
            row[f] = {"median": round(med(xs), 4), "p10": round(pct(xs, 0.1), 4), "p90": round(pct(xs, 0.9), 4)}
        row["framework_share_pct_median"] = round(med([100 * r["framework_s"] / r["wall_s"] for r in clean]), 3)
        row["framework_ms_per_superstep_median"] = round(med([1000 * r["framework_s"] / r["supersteps"] for r in clean]), 3)
        for key in ("node:__start__", "node:model", "node:tools") + KEYS:
            tots = [r["timings"][key][0] for r in clean if key in r["timings"]]
            cnts = [r["timings"][key][1] for r in clean if key in r["timings"]]
            if tots:
                row[key] = {"calls": med(cnts), "total_ms": round(med(tots) * 1e3, 3), "per_call_us": round(med(tots) / med(cnts) * 1e6, 1)}
        mw = [r["timings"]["node:model"][0] - r["model_provider_s"] for r in clean]
        tw = [r["timings"]["node:tools"][0] - r["tool_fn_s"] for r in clean]
        row["model_node_wrapper_us_per_call"] = round(med(mw) * 1e6 / (K + 1), 1)
        row["tools_node_wrapper_us_per_call"] = round(med(tw) * 1e6 / K, 1)
        rows[f"{kind}/{dur}"] = row
        out(f"## saver={kind} durability={dur}: clean runs {len(clean)}/{N}; supersteps {ss}; loadavg before {pre['loadavg']} after {post_load}; ollama {pre['ollama_ps']}")
        out(f"   wall median {row['wall_s']['median']:.2f} s (p10 {row['wall_s']['p10']:.2f}, p90 {row['wall_s']['p90']:.2f}); model {row['model_provider_s']['median']:.2f} s; "
            f"tool fn {row['tool_fn_s']['median'] * 1e3:.3f} ms; framework {row['framework_s']['median'] * 1e3:.1f} ms (p10 {row['framework_s']['p10'] * 1e3:.1f}, p90 {row['framework_s']['p90'] * 1e3:.1f}) "
            f"= {row['framework_share_pct_median']}% of wall, {row['framework_ms_per_superstep_median']} ms per superstep")
        out(f"   model node wrapper (node:model - provider) {row['model_node_wrapper_us_per_call']} us per call; ToolNode wrapper (node:tools - tool fn) {row['tools_node_wrapper_us_per_call']} us per call")
        for key in ("node:__start__", "node:model", "node:tools") + KEYS:
            if key in row:
                r = row[key]
                out(f"   {key:<22} calls={r['calls']:>5} per_call={r['per_call_us']:>10} us total={r['total_ms']:>10} ms")
        (HERE / "breakdown.json").write_text(json.dumps({"pin": PIN, "machine": machine(), "settings": settings(), "k": K, "n": N, "rows": rows}, indent=1))
        (HERE / "runs.json").write_text(json.dumps(raw, indent=0, default=str))
    out()
    (HERE / "trace.txt").write_text("\n".join(OUT) + "\n")


if __name__ == "__main__":
    main()
