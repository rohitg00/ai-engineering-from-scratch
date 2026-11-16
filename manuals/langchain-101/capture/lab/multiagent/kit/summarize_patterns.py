import json
import math
import re
import statistics as st
import sys
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
RUNS = HERE / "runs"
PATTERN_ORDER = ["single", "subagents", "handoffs", "skills", "router"]
MODELS = {"qwen3:14b": "patterns-qwen3-14b.jsonl", "gpt-oss:20b": "patterns-gpt-oss-20b.jsonl", "claude-haiku-5-5": "patterns-haiku.jsonl"}
LANE_TASKS = ["chain01", "multi07"]
LANE_MODEL = "claude-haiku-5-5"
TOP = {"single": {"single"}, "skills": {"skills"}, "subagents": {"coordinator"}, "handoffs": {"shop", "orders_db", "docs", "files", "notes"}}


def wilson(k, n, z=1.96):
    if n == 0:
        return [0, 0]
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return [round(c - h, 3), round(c + h, 3)]


def med(xs):
    return round(st.median(xs), 3) if xs else None


def rows(f):
    p = RUNS / f
    return [json.loads(l) for l in open(p) if l.strip()] if p.exists() else []


def model_events(r):
    return [e for e in r["trace"] if e["kind"] == "model"]


def turn_calls(r):
    ev = model_events(r)
    p = r["pattern"]
    turns, cur = [], 0
    if p == "router":
        for e in ev:
            if e.get("agent") == "router" and cur:
                turns.append(cur)
                cur = 0
            cur += 1
        if cur:
            turns.append(cur)
        return turns
    for e in ev:
        cur += 1
        if e.get("agent") in TOP[p] and not e.get("asks"):
            turns.append(cur)
            cur = 0
    if cur:
        turns.append(cur)
    return turns


def lane_of(e, pattern):
    a = e.get("agent") or e.get("node") or "?"
    return a


def cell_summary(rs):
    n = len(rs)
    k = sum(r["passed"] for r in rs)
    fam = defaultdict(lambda: [0, 0])
    for r in rs:
        fam[r["family"]][0] += r["passed"]
        fam[r["family"]][1] += 1
    one = [r for r in rs if r["turns"] == 1]
    multi = [r for r in rs if r["turns"] > 1]
    first, later = [], []
    for r in multi:
        t = turn_calls(r)
        if t:
            first.append(t[0])
            later.extend(t[1:])
    return {
        "n": n, "pass": k, "ci": wilson(k, n), "strict": sum(r["passed_strict"] for r in rs),
        "calls_med": med([r["model_calls"] for r in rs]), "calls_sum": sum(r["model_calls"] for r in rs),
        "in_med": med([r["in_tokens"] for r in rs]), "in_sum": sum(r["in_tokens"] for r in rs), "out_sum": sum(r["out_tokens"] for r in rs),
        "wall_med": med([r["wall_s"] for r in rs]), "wall_sum": round(sum(r["wall_s"] for r in rs), 1),
        "fw_med_ms": med([1000 * r["framework_s"] for r in rs]),
        "cost_sum": round(sum(r["cost_usd"] for r in rs), 6),
        "by_family": dict(fam),
        "oneshot": {"n": len(one), "pass": sum(r["passed"] for r in one), "calls_med": med([r["model_calls"] for r in one]), "in_med": med([r["in_tokens"] for r in one])},
        "multiturn": {"n": len(multi), "pass": sum(r["passed"] for r in multi), "calls_med": med([r["model_calls"] for r in multi]),
                      "turn1_calls_med": med(first), "later_turn_calls_med": med(later), "in_med": med([r["in_tokens"] for r in multi])},
        "categories": dict(Counter(r["category"] for r in rs if not r["passed"])),
        "errors": dict(Counter((r["error"] or "").split(":")[0] for r in rs if r["error"])),
        "agents_per_task_med": med([len(r["agents"]) for r in rs]),
        "tasks": {r["task_id"]: {"p": int(r["passed"]), "calls": r["model_calls"], "in": r["in_tokens"], "out": r["out_tokens"], "wall": r["wall_s"],
                                 "turn_calls": turn_calls(r), "cat": r["category"]} for r in rs},
    }


def lanes(r):
    out = []
    for e in r["trace"]:
        d = {"k": e["kind"][0], "lane": lane_of(e, r["pattern"]), "t0": e["t0"], "t1": e.get("t1", e["t0"])}
        if e["kind"] == "model":
            d.update({"in": e.get("in", 0), "out": e.get("out", 0), "asks": e.get("asks", [])})
        else:
            d["name"] = e.get("name")
        out.append(d)
    return {"task": r["task_id"], "pattern": r["pattern"], "model": r["model"], "passed": r["passed"], "calls": r["model_calls"],
            "in": r["in_tokens"], "out": r["out_tokens"], "wall": r["wall_s"], "turn_calls": turn_calls(r), "events": out}


def n9():
    deep = {r["task_id"]: r for r in rows("n9-deep-haiku.jsonl")}
    sdk = {r["task_id"]: r for r in rows("n9-sdk-haiku.jsonl")}
    common = [t for t in deep if t in sdk]

    def side(d, ids, extra):
        rs = [d[t] for t in ids]
        k = sum(r["passed"] for r in rs)
        s = {"n": len(rs), "pass": k, "ci": wilson(k, len(rs)), "strict": sum(r["passed_strict"] for r in rs),
             "calls_med": med([r["model_calls"] for r in rs]), "calls_sum": sum(r["model_calls"] for r in rs),
             "in_med": med([r["in_tokens"] for r in rs]), "in_sum": sum(r["in_tokens"] for r in rs), "out_sum": sum(r["out_tokens"] for r in rs),
             "cost_sum": round(sum(r["cost_usd"] for r in rs), 6), "wall_med": med([r["wall_s"] for r in rs]), "wall_sum": round(sum(r["wall_s"] for r in rs), 1),
             "by_family": {}, "categories": dict(Counter(r["category"] for r in rs if not r["passed"]))}
        fam = defaultdict(lambda: [0, 0])
        for r in rs:
            fam[r["family"]][0] += r["passed"]
            fam[r["family"]][1] += 1
        s["by_family"] = dict(fam)
        s.update(extra(rs))
        s["tasks"] = {r["task_id"]: {"p": int(r["passed"]), "calls": r["model_calls"], "in": r["in_tokens"], "out": r["out_tokens"], "cost": r["cost_usd"], "wall": r["wall_s"]} for r in rs}
        return s

    d = side(deep, common, lambda rs: {"cache_note": "AnthropicPromptCachingMiddleware, added by create_deep_agent"})
    s = side(sdk, common, lambda rs: {"cache_read_sum": sum(r["cache_read"] for r in rs), "cache_creation_sum": sum(r["cache_creation"] for r in rs),
                                       "sdk_reported_cost_sum": round(sum(r["sdk_reported_cost_usd"] or 0 for r in rs), 6),
                                       "residual_cost_sum": round(sum(r["residual"]["cost"] for r in rs), 6),
                                       "sdk_version": rs[0]["sdk_version"] if rs else None, "cli_version": rs[0]["cli_version"] if rs else None})
    agree = sum(deep[t]["passed"] == sdk[t]["passed"] for t in common)
    return {"n_common": len(common), "agree": agree, "deep_agent": d, "claude_agent_sdk": s}


def main():
    meta = [json.loads(l) for l in open(RUNS / "models.jsonl") if l.strip()]
    uptime = [l.strip() for l in open(HERE / "logs" / "uptime.log") if l.strip()]
    out = {"pins": {"langchain": "1.5.0", "langchain-core": "1.8.0", "langgraph": "1.2.22", "deepagents": "0.7.38", "langchain-ollama": "1.1.0", "langchain-anthropic": "1.7.10",
                    "claude-agent-sdk": "0.2.182", "claude-code-cli (bundled)": "2.1.325"},
           "patterns": PATTERN_ORDER, "models": list(MODELS), "cells": {}, "lanes": {}, "models_meta": {}, "uptime_samples": uptime[:3] + uptime[-3:]}
    for m in meta:
        key = m.get("tag") or m.get("model")
        out["models_meta"][key] = {k: m.get(k) for k in ("tag", "model", "digest", "quantization", "parameters", "temperature", "seed", "num_ctx", "num_predict", "think", "max_tokens", "max_calls_per_turn")}
    for model, f in MODELS.items():
        rs = rows(f)
        for p in PATTERN_ORDER:
            cr = [r for r in rs if r["pattern"] == p]
            if cr:
                out["cells"][f"{model}|{p}"] = cell_summary(cr)
            if model == LANE_MODEL:
                for t in LANE_TASKS:
                    hit = [r for r in cr if r["task_id"] == t]
                    if hit:
                        out["lanes"][f"{t}|{p}"] = lanes(hit[0])
    for t in LANE_TASKS:
        for model in ("qwen3:14b", "gpt-oss:20b"):
            for p in PATTERN_ORDER:
                hit = [r for r in rows(MODELS[model]) if r["pattern"] == p and r["task_id"] == t]
                if hit:
                    out["lanes"][f"{t}|{p}|{model}"] = lanes(hit[0])
    out["n9"] = n9()
    dst = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE.parent / "summary" / "multiagent-mac.json"
    dst.write_text(json.dumps(out, indent=1))
    for k, c in out["cells"].items():
        print(f"{k:32s} n={c['n']:2d} pass={c['pass']:2d} {c['ci']} calls={c['calls_med']} in={c['in_med']} wall={c['wall_med']} $={c['cost_sum']} 1shot={c['oneshot']['calls_med']} t1={c['multiturn']['turn1_calls_med']} later={c['multiturn']['later_turn_calls_med']} fam={ {f: v[0] for f, v in c['by_family'].items()} } cat={c['categories']}")
    nn = out["n9"]
    print("n9 common", nn["n_common"], "agree", nn["agree"])
    for side in ("deep_agent", "claude_agent_sdk"):
        s = nn[side]
        print(side, {k: s[k] for k in s if k not in ("tasks",)})


if __name__ == "__main__":
    main()
