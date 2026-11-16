import json
import math
import statistics
import sys
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
DROP = {"sql19"}
MAC = "the Mac: Apple M1 Max, 10 cores, 64 GiB, Ollama"
FAMILIES = ["chain", "sql", "retrieval", "files", "multiturn"]
PRICES = json.loads((HERE / "data" / "anthropic-prices.json").read_text())


def rows(name):
    return [json.loads(l) for l in open(HERE / "runs" / name) if l.strip()]


def wilson(k, n, z=1.96):
    if n == 0:
        return [0.0, 0.0]
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return [round(max(0.0, c - h), 3), round(min(1.0, c + h), 3)]


def med(xs):
    return round(statistics.median(xs), 6) if xs else None


def quart(xs):
    if len(xs) < 4:
        return [med(xs), med(xs)]
    q = statistics.quantiles(sorted(xs), n=4)
    return [round(q[0], 6), round(q[2], 6)]


def uncached_cost(model, r):
    p = PRICES["models"].get(model)
    if not p:
        return 0.0
    return (r["in_tokens"] * p["input"] + r["out_tokens"] * p["output"]) / 1e6


def task_order():
    tasks = [json.loads(l) for l in open(HERE / "data" / "tasks.jsonl") if l.strip()]
    return [t["id"] for t in tasks if t["id"] not in DROP], {t["id"]: t["family"] for t in tasks}


def main_part():
    order, fam = task_order()
    subset = [l.strip() for l in open(HERE / "data" / "subset30.txt") if l.strip()]
    main = [r for r in rows("main.jsonl") if r["task_id"] not in DROP]
    cells = defaultdict(dict)
    for r in main:
        cells[(r["model"], r["harness"], r["repeat"])][r["task_id"]] = r
    out = {}
    for (model, harness, rep), by in sorted(cells.items()):
        rs = list(by.values())
        n = len(rs)
        k = sum(r["passed"] for r in rs)
        ks = sum(r["passed_strict"] for r in rs)
        wall = sum(r["wall_s"] for r in rs)
        fw = sum(r["framework_s"] for r in rs)
        out[f"{model}|{harness}|{rep}"] = {
            "model": model, "harness": harness, "repeat": rep, "n": n, "pass": k, "pass_rate": round(k / n, 4), "ci": wilson(k, n), "strict": ks,
            "families": {f: [sum(r["passed"] for r in rs if r["family"] == f), sum(1 for r in rs if r["family"] == f)] for f in FAMILIES},
            "categories": dict(Counter(r["category"] for r in rs if not r["passed"])),
            "calls_med": med([r["model_calls"] for r in rs]), "in_tok_med": med([r["in_tokens"] for r in rs]), "in_tok_iqr": quart([r["in_tokens"] for r in rs]),
            "in_tok_sum": sum(r["in_tokens"] for r in rs), "out_tok_sum": sum(r["out_tokens"] for r in rs),
            "wall_med": med([r["wall_s"] for r in rs]), "model_med": med([r["model_s"] for r in rs]),
            "framework_ms_med": round(med([r["framework_s"] for r in rs]) * 1000, 2), "framework_ms_iqr": [round(v * 1000, 2) for v in quart([r["framework_s"] for r in rs])],
            "framework_ms_min": round(min(r["framework_s"] for r in rs) * 1000, 2), "framework_ms_max": round(max(r["framework_s"] for r in rs) * 1000, 2),
            "framework_share_pct": round(100 * fw / wall, 3), "wall_sum": round(wall, 2),
            "cost_sum": round(sum(r["cost_usd"] for r in rs), 6), "cost_uncached_sum": round(sum(uncached_cost(model, r) for r in rs), 6),
            "tasks": {t: {"p": r["passed"], "c": r["category"], "in": r["in_tokens"], "out": r["out_tokens"], "fw": round(r["framework_s"] * 1000, 2),
                          "m": r["model_s"], "cost": r["cost_usd"], "cost_u": round(uncached_cost(model, r), 7), "calls": r["model_calls"],
                          "bi": r.get("deep_builtins_used") or [], "seq": r["tool_seq"][:12]} for t, r in by.items()},
        }
    agree = []
    pairs = [("plain", "create_agent"), ("plain", "langgraph"), ("create_agent", "langgraph"), ("plain", "deep_agent"), ("create_agent", "deep_agent"), ("langgraph", "deep_agent")]
    for model in sorted({k.split("|")[0] for k in out}):
        for a, b in pairs:
            A, B = out.get(f"{model}|{a}|0"), out.get(f"{model}|{b}|0")
            if not A or not B:
                continue
            common = sorted(set(A["tasks"]) & set(B["tasks"]))
            same = sum(A["tasks"][t]["p"] == B["tasks"][t]["p"] for t in common)
            ident = sum(A["tasks"][t]["in"] == B["tasks"][t]["in"] and A["tasks"][t]["out"] == B["tasks"][t]["out"] and A["tasks"][t]["seq"] == B["tasks"][t]["seq"] for t in common)
            only_a = sum(A["tasks"][t]["p"] and not B["tasks"][t]["p"] for t in common)
            only_b = sum(B["tasks"][t]["p"] and not A["tasks"][t]["p"] for t in common)
            tok = sum(B["tasks"][t]["in"] for t in common) / max(1, sum(A["tasks"][t]["in"] for t in common))
            agree.append({"model": model, "a": a, "b": b, "tasks": len(common), "same_outcome": same, "identical_trace": ident, "only_a": only_a, "only_b": only_b,
                          "in_tok_ratio_b_over_a": round(tok, 3),
                          "cost_ratio_b_over_a": round(sum(B["tasks"][t]["cost"] for t in common) / sum(A["tasks"][t]["cost"] for t in common), 3) if sum(A["tasks"][t]["cost"] for t in common) else None,
                          "cost_u_ratio_b_over_a": round(sum(B["tasks"][t]["cost_u"] for t in common) / sum(A["tasks"][t]["cost_u"] for t in common), 3) if sum(A["tasks"][t]["cost_u"] for t in common) else None})
    sub = {}
    for key, c in out.items():
        if c["repeat"] != 0:
            continue
        ts = [t for t in subset if t in c["tasks"]]
        if len(ts) == 30:
            k = sum(c["tasks"][t]["p"] for t in ts)
            sub[key] = {"n": 30, "pass": k, "ci": wilson(k, 30)}
    return {"order": order, "family": {t: fam[t] for t in order}, "subset": subset, "cells": out, "agreement": agree, "subset_pass": sub}


def sampling_part(main):
    s = rows("sampling.jsonl")
    seeds = defaultdict(dict)
    for r in s:
        seeds[r["tag"]][r["task_id"]] = r["passed"]
    subset = main["subset"]
    greedy = {}
    for h in ("plain", "deep_agent"):
        reps = [main["cells"].get(f"qwen3:4b-instruct-2507-q4_K_M|{h}|{i}") for i in range(3)]
        greedy[h] = [{t: rep["tasks"][t]["p"] for t in subset} for rep in reps]
        same = all(
            reps[0]["tasks"][t]["in"] == reps[i]["tasks"][t]["in"] and reps[0]["tasks"][t]["out"] == reps[i]["tasks"][t]["out"] and reps[0]["tasks"][t]["seq"] == reps[i]["tasks"][t]["seq"]
            for i in (1, 2) for t in subset)
        greedy[h + "_identical_traces"] = same
    mixed = [t for t in subset if len({seeds[k][t] for k in seeds}) > 1]
    return {"seeds": {k: {"pass": sum(v.values()), "n": len(v), "ci": wilson(sum(v.values()), len(v)), "tasks": v} for k, v in sorted(seeds.items())},
            "mixed": mixed, "greedy": greedy}


def structured_part(order):
    st = [r for r in rows("structured.jsonl") if r["task_id"] not in DROP]
    cells = defaultdict(list)
    for r in st:
        cells[(r["model"], r["variant"])].append(r)
    out = {}
    for (m, v), rs in sorted(cells.items()):
        k = sum(r["correct"] for r in rs)
        out[f"{m}|{v}"] = {"model": m, "variant": v, "n": len(rs), "correct": k, "ci": wilson(k, len(rs)), "present": sum(r["answer_present"] for r in rs),
                           "truth_in_text": sum(r["correct_any_number_in_text"] for r in rs), "lookups_ok": sum(r["lookups_ok"] for r in rs),
                           "errors": dict(Counter(r["error"].split(":")[0] for r in rs if r["error"])), "calls_med": med([r["model_calls"] for r in rs]),
                           "in_tok_med": med([r["in_tokens"] for r in rs]), "wall_med": med([r["wall_s"] for r in rs]), "cost_uncached_sum": round(sum(uncached_cost(m, r) for r in rs), 6),
                           "calls_sum": sum(r["model_calls"] for r in rs), "in_tok_sum": sum(r["in_tokens"] for r in rs),
                           "tasks": {r["task_id"]: {"ok": r["correct"], "present": r["answer_present"], "err": bool(r["error"]), "look": r["lookups_ok"], "value": r["value"], "truth": r["truth"]} for r in rs}}
    return {"order": [t for t in order if t.startswith(("chain", "sql"))], "cells": out}


def toolscale_part():
    ts = rows("toolscale.jsonl")
    cells = defaultdict(list)
    for r in ts:
        cells[(r["model"], r["n_core_plus_distractors"], r["selector"])].append(r)
    out = {}
    for (m, n, sel), rs in sorted(cells.items()):
        k = sum(r["passed"] for r in rs)
        out[f"{m}|{n}|{sel}"] = {"model": m, "tools": n, "selector": sel, "n": len(rs), "pass": k, "ci": wilson(k, len(rs)),
                                 "categories": dict(Counter(r["category"] for r in rs if not r["passed"])), "distractor_calls": sum(r["distractor_calls"] for r in rs),
                                 "calls_med": med([r["model_calls"] for r in rs]), "in_tok_med": med([r["in_tokens"] for r in rs]), "wall_med": med([r["wall_s"] for r in rs]),
                                 "cost_sum": round(sum(r["cost_usd"] for r in rs), 6), "cost_uncached_sum": round(sum(uncached_cost(m, r) for r in rs), 6),
                                 "errors": [r["error"][:120] for r in rs if r["error"]],
                                 "runs": [{"t": r["task_id"], "p": r["passed"], "c": r["category"], "in": r["in_tokens"], "calls": r["model_calls"], "wall": r["wall_s"], "d": r["distractor_calls"]} for r in sorted(rs, key=lambda r: r["task_id"])]}
    return {"cells": out}


def ledger_part():
    L = rows("cost-ledger.jsonl")
    g = defaultdict(lambda: {"calls": 0, "input": 0, "output": 0, "cache_read": 0, "cache_creation": 0, "cost": 0.0})
    for r in L:
        a = g[r["cell"] if r["ts"] >= "2026-11-15" else "smoke " + r["cell"]]
        a["calls"] += 1
        a["input"] += r["input_tokens"]
        a["output"] += r["output_tokens"]
        a["cache_read"] += r["cache_read"] or 0
        a["cache_creation"] += r["cache_creation"] or 0
        a["cost"] += r["cost_usd"]
    for a in g.values():
        a["cost"] = round(a["cost"], 6)
    return {"cells": dict(sorted(g.items())), "calls": len(L), "total_usd": round(sum(r["cost_usd"] for r in L), 4)}


def main():
    m = main_part()
    summary = {
        "machine": MAC,
        "dropped_tasks": sorted(DROP),
        "note": "sql19 is dropped from every table: two categories tie on product count, so the expected answer is not unique and the checker is wrong.",
        "main": m,
        "sampling": sampling_part(m),
        "structured": structured_part(m["order"]),
        "toolscale": toolscale_part(),
        "ledger": ledger_part(),
    }
    target = HERE / "summary-mac.json"
    text = json.dumps(summary, indent=1, sort_keys=True)
    if len(sys.argv) > 1 and sys.argv[1] == "--check":
        same = target.exists() and target.read_text() == text + "\n"
        print("summary-mac.json up to date" if same else "summary-mac.json differs")
        sys.exit(0 if same else 1)
    target.write_text(text + "\n")
    print(f"wrote {target.name}: {len(m['cells'])} main cells")


if __name__ == "__main__":
    main()
