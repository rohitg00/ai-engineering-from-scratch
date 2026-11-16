import argparse
import asyncio
import json
import os
import shutil
import sys
import tempfile
import time
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
BENCH_KIT = HERE.parent / "bench" / "kit"
sys.path.insert(0, str(BENCH_KIT))

from langchain_core.messages import AIMessage, HumanMessage

from checks import check
from env import BENCH, DESCRIPTIONS, FAMILY_TOOLS, Env, _schema_for
from harnesses import SYSTEM_PROMPT

import claude_agent_sdk
from claude_agent_sdk import AssistantMessage, ClaudeAgentOptions, ClaudeSDKClient, HookMatcher, ResultMessage, TextBlock, ToolUseBlock, create_sdk_mcp_server, tool

LEDGER = BENCH / "cost-ledger.jsonl"
PRICES = json.loads((BENCH / "data" / "anthropic-prices.json").read_text())
KEY_FILE = Path.home() / ".config" / "aiefs" / "anthropic.key"
BUDGET_USD = 40.0
PREFIX = "mcp__bench__"


class BudgetExceeded(Exception):
    pass


MY_CELLS = ("multiagent|", "sdk|", "deep9|")


def ledger_total():
    return sum(json.loads(l).get("cost_usd", 0.0) for l in LEDGER.read_text().splitlines() if l.strip())


def my_spend():
    rows = [json.loads(l) for l in LEDGER.read_text().splitlines() if l.strip()]
    return sum(r.get("cost_usd", 0.0) for r in rows if str(r.get("cell", "")).startswith(MY_CELLS))


def raw_cost(model, plain, cr, cw, out):
    p = PRICES["models"][model]
    return (plain * p["input"] + cw * p["input"] * PRICES["cache_write_multiplier"] + cr * p["input"] * PRICES["cache_read_multiplier"] + out * p["output"]) / 1e6


def ledger_row(model, cell, plain, cr, cw, out, cost, note=None):
    row = {"ts": time.strftime("%Y-%m-%dT%H:%M:%S"), "model": model, "cell": cell, "input_tokens": plain + cr + cw, "output_tokens": out,
           "cache_read": cr, "cache_creation": cw, "cost_usd": round(cost, 6), "price_source": PRICES.get("source")}
    if note:
        row["note"] = note
    with open(LEDGER, "a") as f:
        f.write(json.dumps(row) + "\n")


def build_server(env, names):
    tools = []
    for n in names:
        fn = env._wrap(n, getattr(env, n))
        schema = _schema_for(getattr(env, n), n).model_json_schema()
        schema.pop("title", None)

        def make(fn=fn):
            async def handler(args):
                return {"content": [{"type": "text", "text": fn(**args)}]}
            return handler
        tools.append(tool(n, DESCRIPTIONS[n], schema)(make()))
    return create_sdk_mcp_server(name="bench", version="1.0.0", tools=tools)


async def run_task(task, args, ledger_start, scratch):
    env = Env(task)
    names = FAMILY_TOOLS[task["family"]]
    server = build_server(env, names)
    cell = f"sdk|{args.model}|{task['id']}"
    key = KEY_FILE.read_text().strip()
    seen = {}
    logged = {}
    state = {"stop": None}

    def check_budget():
        total = ledger_total()
        if total >= BUDGET_USD - 0.05:
            raise BudgetExceeded(f"ledger total ${total:.4f} at cap")
        spent = my_spend()
        if spent >= args.task_cap_usd:
            raise BudgetExceeded(f"task cap ${args.task_cap_usd} reached (spent ${spent:.4f})")

    async def before_next_call(input_data, tool_use_id, context):
        try:
            check_budget()
        except BudgetExceeded as e:
            state["stop"] = str(e)
            return {"continue_": False, "stopReason": str(e)}
        return {}

    cwd = Path(tempfile.mkdtemp(prefix="sdk-cwd-", dir=scratch))
    options = ClaudeAgentOptions(
        tools=[], allowed_tools=[PREFIX + n for n in names], mcp_servers={"bench": server}, strict_mcp_config=True,
        system_prompt=SYSTEM_PROMPT, model=args.model, max_turns=args.max_turns, setting_sources=[], cwd=str(cwd),
        permission_mode="dontAsk", thinking={"type": "disabled"},
        env={"ANTHROPIC_API_KEY": key, "CLAUDE_CONFIG_DIR": str(scratch / "config"), "DISABLE_TELEMETRY": "1", "DISABLE_ERROR_REPORTING": "1",
             "DISABLE_AUTOUPDATER": "1", "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1", "CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY": "1"},
        hooks={"PostToolUse": [HookMatcher(hooks=[before_next_call])]},
        stderr=lambda s: None,
    )
    del key
    messages, results, error = [], [], None
    t0 = time.perf_counter()
    per_call = []
    check_budget()
    try:
        async with ClaudeSDKClient(options=options) as client:
            for text in task["turns"]:
                check_budget()
                messages.append(HumanMessage(text))
                tstart = time.perf_counter()
                await client.query(text)
                async for msg in client.receive_response():
                    if isinstance(msg, AssistantMessage):
                        mid = msg.message_id or uuid.uuid4().hex
                        rec = seen.setdefault(mid, {"model": msg.model, "text": [], "calls": [], "usage": None, "t": time.perf_counter() - t0})
                        for b in msg.content:
                            if isinstance(b, TextBlock):
                                rec["text"].append(b.text)
                            elif isinstance(b, ToolUseBlock):
                                rec["calls"].append({"name": b.name.removeprefix(PREFIX), "args": b.input, "id": b.id, "type": "tool_call"})
                        if msg.usage:
                            rec["usage"] = msg.usage
                        if mid not in logged and len(seen) > 1:
                            for pmid, prec in list(seen.items())[:-1]:
                                if pmid not in logged and prec["usage"]:
                                    logged[pmid] = _log(prec, cell)
                    elif isinstance(msg, ResultMessage):
                        results.append(msg)
                for pmid, prec in seen.items():
                    if pmid not in logged and prec["usage"]:
                        logged[pmid] = _log(prec, cell)
                    if "ai" not in prec:
                        prec["ai"] = AIMessage(content=" ".join(prec["text"]), tool_calls=prec["calls"])
                        messages.append(prec["ai"])
                if state["stop"]:
                    raise BudgetExceeded(state["stop"])
    except BudgetExceeded:
        env.close()
        raise
    except Exception as e:
        error = e
    wall = time.perf_counter() - t0
    resid = reconcile(results, logged, cell)
    allowed = set(names)
    res = check(task, env, messages, error, allowed)
    main_calls = [v for v in logged.values()]
    row = {
        "task_id": task["id"], "family": task["family"], "harness": "claude_agent_sdk", "sdk_version": claude_agent_sdk.__version__,
        "cli_version": getattr(sys.modules["claude_agent_sdk._cli_version"], "__cli_version__", None), "model": args.model, "provider": "anthropic", **res,
        "model_calls": len(main_calls), "in_tokens": sum(c["in"] for c in main_calls),
        "out_tokens": sum((r.usage or {}).get("output_tokens", 0) for r in results), "out_tokens_seen_in_stream": sum(c["out"] for c in main_calls),
        "cache_read": sum(c["cr"] for c in main_calls), "cache_creation": sum(c["cw"] for c in main_calls),
        "cost_usd": round(sum(c["cost"] for c in main_calls) + resid["cost"], 6), "residual": resid,
        "sdk_reported_cost_usd": round(results[-1].total_cost_usd or 0, 6) if results else None,
        "turn_usage": [{k: (r.usage or {}).get(k) for k in ("input_tokens", "cache_read_input_tokens", "cache_creation_input_tokens", "output_tokens")} for r in results], "sdk_num_turns": [r.num_turns for r in results],
        "terminal_reasons": [r.terminal_reason for r in results], "wall_s": round(wall, 3),
        "error": None if error is None else f"{type(error).__name__}: {str(error)[:400]}",
    }
    env.close()
    shutil.rmtree(cwd, ignore_errors=True)
    return row


def _log(rec, cell):
    u = rec["usage"]
    plain, cr, cw, out = u.get("input_tokens", 0), u.get("cache_read_input_tokens", 0) or 0, u.get("cache_creation_input_tokens", 0) or 0, u.get("output_tokens", 0)
    model = rec["model"] if rec["model"] in PRICES["models"] else None
    cost = raw_cost(model, plain, cr, cw, out) if model else 0.0
    ledger_row(rec["model"], cell, plain, cr, cw, out, cost)
    return {"in": plain + cr + cw, "out": out, "cr": cr, "cw": cw, "cost": cost, "model": rec["model"]}


def reconcile(results, logged, cell):
    out = {"cost": 0.0, "models": {}}
    by_model = {}
    for v in logged.values():
        m = by_model.setdefault(v["model"], {"in": 0, "out": 0, "cost": 0.0})
        m["in"] += v["in"]
        m["out"] += v["out"]
        m["cost"] += v["cost"]
    tot = {}
    for r in results[-1:]:
        for model, mu in (r.model_usage or {}).items():
            t = tot.setdefault(model, {"in": 0, "out": 0, "cr": 0, "cw": 0, "cost": 0.0})
            get = mu.get if isinstance(mu, dict) else (lambda k, d=0: getattr(mu, k, d))
            t["in"] += get("inputTokens", 0) or 0
            t["out"] += get("outputTokens", 0) or 0
            t["cr"] += get("cacheReadInputTokens", 0) or 0
            t["cw"] += get("cacheCreationInputTokens", 0) or 0
            t["cost"] += get("costUSD", 0) or 0
    for model, t in tot.items():
        base = model.split("[")[0]
        if base not in PRICES["models"]:
            base = next((k for k in PRICES["models"] if base.startswith(k)), None)
        mine = by_model.get(model, by_model.get(base, {"in": 0, "out": 0, "cost": 0.0}))
        full = raw_cost(base, t["in"], t["cr"], t["cw"], t["out"]) if base else t["cost"]
        extra = full - mine["cost"]
        out["models"][model] = {"sdk_tokens_in": t["in"] + t["cr"] + t["cw"], "sdk_tokens_out": t["out"], "logged_in": mine["in"], "logged_out": mine["out"],
                                "sdk_cost_usd": round(t["cost"], 6), "our_full_cost": round(full, 6), "residual": round(extra, 6)}
        if extra > 1e-6:
            ledger_row(model, cell, 0, 0, 0, 0, extra, note="residual: SDK-reported usage not seen in assistant messages")
            out["cost"] += extra
    return out


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="claude-haiku-5-5")
    ap.add_argument("--tasks", default="subset30")
    ap.add_argument("--out", required=True)
    ap.add_argument("--max-turns", type=int, default=10)
    ap.add_argument("--task-cap-usd", type=float, default=1.80)
    ap.add_argument("--ledger-start", type=float, required=True)
    args = ap.parse_args()
    tasks = [json.loads(l) for l in open(BENCH / "data" / "tasks.jsonl")]
    by = {t["id"]: t for t in tasks}
    ids = [l.strip() for l in open(BENCH / "data" / "subset30.txt") if l.strip()] if args.tasks == "subset30" else args.tasks.split(",")
    ids = [i for i in ids if i != "sql19"]
    out = HERE / "runs" / args.out
    done = {json.loads(l)["task_id"] for l in open(out)} if out.exists() else set()
    scratch = Path(tempfile.mkdtemp(prefix="sdk-scratch-"))
    (scratch / "config").mkdir()
    try:
        for tid in ids:
            if tid in done:
                continue
            try:
                row = await run_task(by[tid], args, args.ledger_start, scratch)
            except BudgetExceeded as e:
                print("BUDGET STOP:", e, flush=True)
                return
            row["ts"] = time.strftime("%Y-%m-%dT%H:%M:%S")
            with open(out, "a") as f:
                f.write(json.dumps(row, default=str) + "\n")
            print(f"{tid:9s} sdk {'PASS' if row['passed'] else 'fail'} {row['category'] or '':16s} calls={row['model_calls']} tok={row['in_tokens']}/{row['out_tokens']} "
                  f"${row['cost_usd']:.5f} sdk${row['sdk_reported_cost_usd'] or 0:.5f} {row['wall_s']:.1f}s {row['error'] or ''}", flush=True)
    finally:
        shutil.rmtree(scratch, ignore_errors=True)


if __name__ == "__main__":
    asyncio.run(main())
