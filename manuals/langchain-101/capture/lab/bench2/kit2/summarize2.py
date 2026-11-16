import json
import statistics as st
import sys
from collections import Counter
from pathlib import Path

B2 = Path(__file__).resolve().parent.parent
BENCH = B2.parent / "bench"
FAMS = ["chain", "sql", "retrieval", "files", "multiturn"]
Q4 = "qwen3:4b-instruct-2507-q4_K_M"


def rows(p):
    p = Path(p)
    if not p.exists():
        return []
    return [json.loads(l) for l in p.read_text().splitlines() if l.strip()]


def med(xs):
    xs = [x for x in xs if x is not None]
    return round(st.median(xs), 2) if xs else None


def cell(rs, ids=None):
    rs = [r for r in rs if r["task_id"] != "sql19" and (ids is None or r["task_id"] in ids)]
    if not rs:
        return None
    fam = {f: [sum(1 for r in rs if r["family"] == f and r["passed"]), sum(1 for r in rs if r["family"] == f)] for f in FAMS}
    return {
        "n": len(rs), "pass": sum(r["passed"] for r in rs), "fam": fam,
        "calls_med": med([r["model_calls"] for r in rs]), "calls_sum": sum(r["model_calls"] for r in rs),
        "in_med": med([r["in_tokens"] for r in rs]), "in_sum": sum(r["in_tokens"] for r in rs),
        "out_sum": sum(r["out_tokens"] for r in rs), "wall_med": med([r["wall_s"] for r in rs]),
        "cost": round(sum(r.get("cost_usd", 0) for r in rs), 6),
        "cats": dict(Counter(r["category"] for r in rs if not r["passed"])),
        "builtin_runs": dict(Counter(b for r in rs for b in (r.get("builtins_used") or r.get("deep_builtins_used") or []))),
        "tasks": {r["task_id"]: {"p": r["passed"], "c": r["category"], "calls": r["model_calls"], "in": r["in_tokens"],
                                 "bi": r.get("builtins_used") or r.get("deep_builtins_used") or [], "seq": r["tool_seq"][:12]} for r in rs},
    }


def agree(a, b):
    common = sorted(set(a) & set(b))
    same_pass = sum(a[t]["p"] == b[t]["p"] for t in common)
    same_trace = sum(a[t]["p"] == b[t]["p"] and a[t]["in"] == b[t]["in"] and a[t]["seq"] == b[t]["seq"] for t in common)
    return {"tasks": len(common), "same_outcome": same_pass, "identical_trace": same_trace}


def main():
    base = [r for r in rows(BENCH / "runs" / "main.jsonl") if r["repeat"] == 0 and r["task_id"] != "sql19"]
    old = lambda m, h: [r for r in base if r["model"] == m and r["harness"] == h]
    out = {"profiles": {}, "ptc": {}, "rubric": {}, "evals": {}}

    prof = rows(B2 / "runs" / "profiles.jsonl")
    subset = {l.strip() for l in (BENCH / "data" / "subset30.txt").read_text().splitlines() if l.strip()}
    for m in (Q4, "qwen3:8b"):
        d = {}
        d["plain"] = cell(old(m, "plain"))
        d["deep"] = cell(old(m, "deep_agent"))
        d["deep_fs"] = cell(old(m, "deep_agent_fs"))
        d["control"] = cell([r for r in prof if r["model"] == m and r["tag"] == "control"])
        d["profB"] = cell([r for r in prof if r["model"] == m and r["tag"] == "profB"])
        d["profA"] = cell([r for r in prof if r["model"] == m and r["tag"] == "profA"])
        d["plain_sub"] = cell(old(m, "plain"), subset)
        d["deep_sub"] = cell(old(m, "deep_agent"), subset)
        d["profB_sub"] = cell([r for r in prof if r["model"] == m and r["tag"] == "profB"], subset)
        if d["control"] and d["deep"]:
            d["control_vs_old_deep"] = agree(d["control"]["tasks"], d["deep"]["tasks"])
        if d["profB"] and d["plain"]:
            d["profB_vs_plain"] = agree(d["profB"]["tasks"], d["plain"]["tasks"])
        vis = [r.get("visible_tools") for r in prof if r["model"] == m and r["tag"] == "profB" and r.get("visible_tools")]
        d["profB_visible_example"] = vis[0] if vis else None
        out["profiles"][m] = d

    ptc = rows(B2 / "runs" / "ptc.jsonl")
    cs_ids = None
    for m in ("qwen3:8b", "qwen3:14b", "gpt-oss:20b", "claude-haiku-5-5"):
        d = {}
        cs = lambda rs: [r for r in rs if r["family"] in ("chain", "sql")]
        d["plain"] = cell(cs(old(m, "plain")))
        d["deep"] = cell(cs(old(m, "deep_agent")) + [r for r in ptc if r["model"] == m and r["tag"] == "base" and r["harness"] == "deep_control"])
        for tag in ("ptc", "nudge"):
            rs = [r for r in ptc if r["model"] == m and r["tag"] == tag]
            c = cell(rs)
            if c:
                c["eval_calls"] = sum(r.get("eval_calls", 0) for r in rs)
                c["eval_runs"] = sum(1 for r in rs if r.get("eval_calls", 0))
                c["eval_errors"] = sum(r.get("eval_errors", 0) for r in rs)
                c["eval_error_types"] = dict(Counter(t for r in rs for t in r.get("eval_error_types", [])))
                c["inner_calls"] = sum(r.get("inner_tool_calls", 0) for r in rs)
                c["eval_pass"] = sum(1 for r in rs if r.get("eval_calls", 0) and r["passed"])
                for t in c["tasks"]:
                    c["tasks"][t]["ev"] = next(r.get("eval_calls", 0) for r in rs if r["task_id"] == t)
            d[tag] = c
        out["ptc"][m] = d

    rub = rows(B2 / "runs" / "rubric.jsonl")
    ctrl = {r["task_id"]: r for r in rub if r["tag"] == "control"}
    rb = {r["task_id"]: r for r in rub if r["tag"] == "rubric14"}
    plain8 = {r["task_id"]: r for r in old("qwen3:8b", "plain")}
    per = {}
    for t, r in rb.items():
        c = ctrl.get(t) or plain8.get(t)
        per[t] = {"family": r["family"], "base_pass": c["passed"], "base_cat": c["category"], "base_calls": c["model_calls"], "base_in": c["in_tokens"],
                  "pass": r["passed"], "cat": r["category"], "calls": r["model_calls"], "in": r["in_tokens"], "out": r["out_tokens"],
                  "judge_calls": r.get("judge_calls"), "judge_in": r.get("judge_in_tokens"), "judge_out": r.get("judge_out_tokens"),
                  "judge_errors": r.get("judge_call_errors"), "results": r.get("rubric_results"), "wall": r["wall_s"], "base_wall": c["wall_s"],
                  "judge_s": r.get("judge_s"), "error": r.get("error")}
    out["rubric"] = {
        "n": len(per), "recovered": sorted(t for t, v in per.items() if v["pass"] and not v["base_pass"]),
        "broken": sorted(t for t, v in per.items() if v["base_pass"] and not v["pass"]),
        "control_same_as_old": sum(1 for t, r in ctrl.items() if t in plain8 and r["passed"] == plain8[t]["passed"] and r["in_tokens"] == plain8[t]["in_tokens"]),
        "control_n": len(ctrl),
        "first_verdict": dict(Counter((v["results"] or ["none"])[0] for v in per.values())),
        "final_verdict": dict(Counter((v["results"] or ["none"])[-1] for v in per.values())),
        "satisfied_but_failed": sorted(t for t, v in per.items() if v["results"] and v["results"][0] == "satisfied" and not v["pass"]),
        "worker_calls": [sum(v["base_calls"] for v in per.values()), sum(v["calls"] for v in per.values())],
        "worker_in": [sum(v["base_in"] for v in per.values()), sum(v["in"] for v in per.values())],
        "judge_calls": sum(v["judge_calls"] or 0 for v in per.values()), "judge_in": sum(v["judge_in"] or 0 for v in per.values()),
        "judge_out": sum(v["judge_out"] or 0 for v in per.values()),
        "wall": [round(sum(v["base_wall"] for v in per.values()), 1), round(sum(v["wall"] for v in per.values()), 1)],
        "judge_s": round(sum(v["judge_s"] or 0 for v in per.values()), 1),
        "tasks": per,
    }

    ev = {}
    for p in sorted((B2 / "evals").glob("report-*.json")):
        ev[p.stem.removeprefix("report-")] = json.loads(p.read_text())
    out["evals"] = ev
    dest = Path(sys.argv[1]) if len(sys.argv) > 1 else B2 / "summary-bench2.json"
    dest.write_text(json.dumps(out, indent=1, default=str))
    print("wrote", dest)


if __name__ == "__main__":
    main()
