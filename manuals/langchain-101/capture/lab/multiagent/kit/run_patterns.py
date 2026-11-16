import argparse
import json
import subprocess
import time
import traceback
import uuid
from pathlib import Path

import patterns
from patterns import ALL_TOOL_NAMES, PATTERNS, TraceMeter

from checks import check
from env import BENCH, Env
from harnesses import SYSTEM_PROMPT
from models import BudgetExceeded, ledger_total, make_model

HERE = Path(__file__).resolve().parent.parent
RUNS = HERE / "runs"


def uptime():
    return subprocess.run(["uptime"], capture_output=True, text=True).stdout.strip()


def load_tasks(sel):
    tasks = [json.loads(l) for l in open(BENCH / "data" / "tasks.jsonl")]
    ids = [l.strip() for l in open(BENCH / "data" / "subset30.txt") if l.strip()] if sel == "subset30" else sel.split(",")
    ids = [i for i in ids if i != "sql19"]
    by = {t["id"]: t for t in tasks}
    return [by[i] for i in ids]


def run_one(task, pname, model, meta, args, ledger_start):
    env = Env(task)
    provider = meta["provider"]
    meter = TraceMeter(args.max_calls, provider=provider, model_name=meta.get("model"), cell=f"multiagent|{pname}|{meta.get('model', meta.get('tag'))}",
                       task_cap_usd=args.task_cap_usd, ledger_start=ledger_start)
    error, messages, h, tb = None, [], None, None
    t0 = time.perf_counter()
    try:
        h = PATTERNS[pname](model, env, meter, provider)
        for text in task["turns"]:
            meter.new_turn()
            _, messages = h.turn(text)
    except BudgetExceeded:
        env.close()
        raise
    except Exception as e:
        error = e
        tb = traceback.format_exc()[-1500:]
        if h is not None:
            messages = h.state_messages()
    wall = time.perf_counter() - t0
    allowed = set(ALL_TOOL_NAMES) | {"submit_answer"} | PATTERNS[pname].extra_tools
    res = check(task, env, messages, error, allowed)
    model_s = sum(c["dt"] for c in meter.calls)
    lanes = sorted({(e.get("agent") or e.get("node") or "?") for e in meter.trace if e["kind"] == "model"})
    row = {
        "run_id": args.run_id, "ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "task_id": task["id"], "family": task["family"], "turns": len(task["turns"]),
        "pattern": pname, "model": meta.get("tag") or meta.get("model"), "provider": provider, "repeat": 0, **res,
        "model_calls": len(meter.calls), "model_call_errors": sum(1 for c in meter.calls if "error" in c),
        "in_tokens": sum(c.get("in", 0) for c in meter.calls), "out_tokens": sum(c.get("out", 0) for c in meter.calls),
        "cost_usd": round(sum(c.get("cost", 0) for c in meter.calls), 6),
        "wall_s": round(wall, 3), "model_s": round(model_s, 3), "tool_s": round(env.tool_time, 4), "framework_s": round(wall - model_s - env.tool_time, 4),
        "agents": lanes, "messages": len(messages),
        "env_tool_seq": [e["tool"] for e in env.log][:60],
        "trace": [{k: (round(v, 3) if isinstance(v, float) else v) for k, v in e.items()} for e in sorted(meter.trace, key=lambda e: e["t0"])],
        "error": None if error is None else f"{type(error).__name__}: {str(error)[:400]}",
        "traceback": tb,
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
                keys.add((r["task_id"], r["pattern"], r["model"]))
    return keys


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", required=True)
    ap.add_argument("--patterns", default="single,subagents,handoffs,skills,router")
    ap.add_argument("--tasks", default="subset30")
    ap.add_argument("--out", required=True)
    ap.add_argument("--max-calls", type=int, default=25)
    ap.add_argument("--max-tokens", type=int, default=1024)
    ap.add_argument("--task-cap-usd", type=float, default=1.80)
    ap.add_argument("--ledger-start", type=float, default=None)
    args = ap.parse_args()
    args.run_id = uuid.uuid4().hex[:8]
    ledger_start = args.ledger_start if args.ledger_start is not None else ledger_total()
    out = RUNS / args.out
    tasks = load_tasks(args.tasks)
    done = done_keys(out)
    log = open(HERE / "logs" / "uptime.log", "a")
    for spec in args.models.split(","):
        model, meta = make_model(spec, args.max_tokens)
        if meta["provider"] == "ollama":
            model.invoke("Say ok.")
        with open(RUNS / "models.jsonl", "a") as f:
            f.write(json.dumps({"run_id": args.run_id, "ts": time.strftime("%Y-%m-%dT%H:%M:%S"), **meta, "max_calls_per_turn": args.max_calls,
                                "ledger_start": ledger_start, "patterns": args.patterns}) + "\n")
        for pname in args.patterns.split(","):
            up = uptime()
            log.write(f"{time.strftime('%Y-%m-%dT%H:%M:%S')} start run={args.run_id} model={spec} pattern={pname} :: {up}\n")
            log.flush()
            print(f"== {spec} {pname} {up}", flush=True)
            for t in tasks:
                if (t["id"], pname, meta.get("tag") or meta.get("model")) in done:
                    continue
                try:
                    row = run_one(t, pname, model, meta, args, ledger_start)
                except BudgetExceeded as e:
                    print("BUDGET STOP:", e, flush=True)
                    log.write(f"{time.strftime('%Y-%m-%dT%H:%M:%S')} BUDGET STOP {e}\n")
                    return
                with open(out, "a") as f:
                    f.write(json.dumps(row, default=str) + "\n")
                print(f"{t['id']:9s} {pname:10s} {'PASS' if row['passed'] else 'fail':4s} {row['category'] or '':18s} calls={row['model_calls']:2d} "
                      f"tools={row['tool_calls_executed']:2d} tok={row['in_tokens']}/{row['out_tokens']} ${row['cost_usd']:.4f} {row['wall_s']:.1f}s {row['agents']}", flush=True)
            log.write(f"{time.strftime('%Y-%m-%dT%H:%M:%S')} end   run={args.run_id} model={spec} pattern={pname} :: {uptime()}\n")
            log.flush()


if __name__ == "__main__":
    main()
