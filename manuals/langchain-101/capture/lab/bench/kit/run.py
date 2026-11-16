import argparse
import json
import subprocess
import sys
import time
import traceback
import uuid

from checks import check
from env import BENCH, FAMILY_TOOLS, Env, build_tools
from harnesses import HARNESSES, SYSTEM_PROMPT
from models import BudgetExceeded, Meter, make_model

DEEP_BUILTINS = {"write_todos", "ls", "read_file", "write_file", "edit_file", "glob", "grep", "task", "execute"}


def load_tasks(sel):
    tasks = [json.loads(l) for l in open(BENCH / "data" / "tasks.jsonl")]
    if sel == "all":
        return tasks
    if sel.endswith(".txt"):
        ids = [l.strip() for l in open(sel if "/" in sel else BENCH / "data" / sel) if l.strip()]
    else:
        ids = sel.split(",")
    fams = {"chain", "sql", "retrieval", "files", "multiturn"}
    return [t for t in tasks if t["id"] in ids or t["family"] in (set(ids) & fams)]


def uptime():
    return subprocess.run(["uptime"], capture_output=True, text=True).stdout.strip()


def run_one(task, harness_name, model, model_meta, args, repeat, run_tokens_so_far=0, extra_tools=None, tool_names=None, middleware_factory=None, tag=None, order_fn=None):
    env = Env(task)
    provider = model_meta["provider"]
    names = tool_names or FAMILY_TOOLS[task["family"]]
    tools = build_tools(env, names, extra_tools(env) if extra_tools else ())
    if order_fn:
        tools = order_fn(tools)
    meter = Meter(args.max_calls, provider=provider, model_name=model_meta.get("model"), cell=f"{harness_name}|{model_meta.get('model', model_meta.get('tag'))}",
                  cell_token_cap=args.cell_token_cap, run_token_cap=args.run_token_cap, run_tokens_so_far=run_tokens_so_far)
    mw = middleware_factory(model) if middleware_factory else ()
    error, messages = None, []
    t0 = time.perf_counter()
    h = None
    try:
        h = HARNESSES[harness_name](model, tools, meter, provider=provider, middleware=mw, env=env)
        for text in task["turns"]:
            meter.new_turn()
            _, messages = h.turn(text)
    except BudgetExceeded:
        env.close()
        raise
    except Exception as e:
        error = e
        if h is not None:
            messages = h.messages if hasattr(h, "messages") else h.state_messages()
        tb = traceback.format_exc()[-1500:]
    wall = time.perf_counter() - t0
    allowed = {t.name for t in tools} | (DEEP_BUILTINS if harness_name.startswith("deep_agent") else set())
    res = check(task, env, messages, error, allowed)
    model_s = sum(c["dt"] for c in meter.calls)
    row = {
        "run_id": args.run_id, "tag": tag or args.tag, "ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "task_id": task["id"], "family": task["family"],
        "harness": harness_name, "model": model_meta.get("tag") or model_meta.get("model"), "provider": provider, "repeat": repeat,
        "n_tools": len(tools), **res,
        "model_calls": len(meter.calls), "model_call_errors": sum(1 for c in meter.calls if "error" in c),
        "in_tokens": sum(c.get("in", 0) for c in meter.calls), "out_tokens": sum(c.get("out", 0) for c in meter.calls),
        "cost_usd": round(sum(c.get("cost", 0) for c in meter.calls), 6),
        "wall_s": round(wall, 3), "model_s": round(model_s, 3), "tool_s": round(env.tool_time, 4),
        "framework_s": round(wall - model_s - env.tool_time, 4), "messages": len(messages), "per_call": [[c.get("in"), c.get("out"), round(c["dt"], 2)] for c in meter.calls],
        "deep_builtins_used": sorted({n for n in res["tool_seq"] if n in DEEP_BUILTINS}) if harness_name.startswith("deep_agent") else [],
        "error": None if error is None else f"{type(error).__name__}: {str(error)[:400]}",
        "traceback": tb if error is not None and res["category"] == "harness_error" else None,
    }
    if task["family"] == "multiturn":
        row["final_state"] = env.kv
    elif task["family"] == "files":
        row["final_state"] = {k: v[:200] for k, v in env.fs_state().items()}
    env.close()
    return row


def done_keys(path):
    keys = set()
    if path.exists():
        for l in path.read_text().splitlines():
            if l.strip():
                r = json.loads(l)
                keys.add((r["task_id"], r["harness"], r["model"], r["repeat"], r.get("tag")))
    return keys


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", required=True)
    ap.add_argument("--harnesses", default="plain,create_agent,langgraph,deep_agent")
    ap.add_argument("--tasks", default="all")
    ap.add_argument("--repeats", type=int, default=1)
    ap.add_argument("--repeat-offset", type=int, default=0)
    ap.add_argument("--out", required=True)
    ap.add_argument("--max-calls", type=int, default=10)
    ap.add_argument("--max-tokens", type=int, default=None)
    ap.add_argument("--cell-token-cap", type=int, default=None)
    ap.add_argument("--run-token-cap", type=int, default=None)
    ap.add_argument("--tag", default="main")
    ap.add_argument("--temperature", type=float, default=None)
    ap.add_argument("--seed", type=int, default=None)
    args = ap.parse_args()
    args.run_id = uuid.uuid4().hex[:8]
    out = BENCH / "runs" / args.out
    tasks = load_tasks(args.tasks)
    done = done_keys(out)
    log = open(BENCH / "logs" / "loads.log", "a")
    for spec in args.models.split(","):
        ov = {k: v for k, v in (("temperature", args.temperature), ("seed", args.seed)) if v is not None}
        model, meta = make_model(spec, args.max_tokens, ov)
        if meta["provider"] == "ollama":
            model.invoke("Say ok.")
        man = BENCH / "runs" / "models.jsonl"
        with open(man, "a") as f:
            f.write(json.dumps({"run_id": args.run_id, "ts": time.strftime("%Y-%m-%dT%H:%M:%S"), **meta, "system_prompt": SYSTEM_PROMPT, "max_calls_per_turn": args.max_calls}) + "\n")
        run_tokens = 0
        for hname in args.harnesses.split(","):
            up = uptime()
            log.write(f"{time.strftime('%H:%M:%S')} block start run={args.run_id} model={spec} harness={hname} out={args.out} :: {up}\n")
            log.flush()
            print(f"== {spec} {hname} {up}", flush=True)
            for rep in range(args.repeat_offset, args.repeat_offset + args.repeats):
                for t in tasks:
                    key = (t["id"], hname, meta.get("tag") or meta.get("model"), rep, args.tag)
                    if key in done:
                        continue
                    try:
                        row = run_one(t, hname, model, meta, args, rep, run_tokens)
                    except BudgetExceeded as e:
                        print("BUDGET STOP:", e, flush=True)
                        return
                    run_tokens += row["in_tokens"] + row["out_tokens"]
                    with open(out, "a") as f:
                        f.write(json.dumps(row, default=str) + "\n")
                    print(f"{t['id']:9s} {hname:12s} r{rep} {'PASS' if row['passed'] else 'fail':4s} {row['category'] or '':18s} calls={row['model_calls']:2d} tools={row['tool_calls_executed']:2d} tok={row['in_tokens']}/{row['out_tokens']} {row['wall_s']:.1f}s", flush=True)
            log.write(f"{time.strftime('%H:%M:%S')} block end   run={args.run_id} model={spec} harness={hname} :: {uptime()}\n")
            log.flush()


if __name__ == "__main__":
    main()
