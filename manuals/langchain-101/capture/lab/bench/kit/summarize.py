import argparse
import json
import math
import statistics
from collections import Counter, defaultdict

from env import BENCH

CATS = ["wrong_tool", "wrong_args", "loop_step_limit", "malformed_output", "parse_error", "gave_up", "wrong_final_state", "harness_error"]


def wilson(k, n, z=1.96):
    if n == 0:
        return (0.0, 0.0)
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return (max(0.0, c - h), min(1.0, c + h))


def med_iqr(xs):
    if not xs:
        return "-"
    xs = sorted(xs)
    if len(xs) < 4:
        return f"{statistics.median(xs):.4g}"
    q = statistics.quantiles(xs, n=4)
    return f"{statistics.median(xs):.4g} [{q[0]:.3g}-{q[2]:.3g}]"


def load(files, tag=None):
    rows = []
    for f in files:
        for l in open(BENCH / "runs" / f):
            if l.strip():
                r = json.loads(l)
                if tag is None or r.get("tag") == tag:
                    rows.append(r)
    return rows


def cell_table(rows, key=("model", "harness"), passkey="passed"):
    cells = defaultdict(list)
    for r in rows:
        cells[tuple(r[k] for k in key)].append(r)
    out = ["| " + " | ".join(key) + " | n | pass | 95% CI | strict pass | model calls | tool calls | in tok | out tok | wall s | model s | framework s |",
           "|" + "---|" * (len(key) + 11)]
    for k in sorted(cells):
        rs = cells[k]
        n = len(rs)
        p = sum(r[passkey] for r in rs)
        ps = sum(r.get("passed_strict", r[passkey]) for r in rs)
        lo, hi = wilson(p, n)
        out.append("| " + " | ".join(map(str, k)) + f" | {n} | {p / n:.2f} | {lo:.2f}-{hi:.2f} | {ps / n:.2f} | "
                   f"{med_iqr([r['model_calls'] for r in rs])} | {med_iqr([r['tool_calls_executed'] for r in rs])} | "
                   f"{med_iqr([r['in_tokens'] for r in rs])} | {med_iqr([r['out_tokens'] for r in rs])} | "
                   f"{med_iqr([r['wall_s'] for r in rs])} | {med_iqr([r['model_s'] for r in rs])} | {med_iqr([r['framework_s'] for r in rs])} |")
    return "\n".join(out)


def family_table(rows, key=("model", "harness")):
    fams = ["chain", "sql", "retrieval", "files", "multiturn"]
    cells = defaultdict(lambda: defaultdict(list))
    for r in rows:
        cells[tuple(r[k] for k in key)][r["family"]].append(r["passed"])
    out = ["| " + " | ".join(key) + " | " + " | ".join(fams) + " |", "|" + "---|" * (len(key) + len(fams))]
    for k in sorted(cells):
        out.append("| " + " | ".join(map(str, k)) + " | " + " | ".join(
            f"{sum(cells[k][f])}/{len(cells[k][f])}" if cells[k][f] else "-" for f in fams) + " |")
    return "\n".join(out)


def cat_table(rows, key=("model", "harness")):
    cells = defaultdict(Counter)
    for r in rows:
        if not r["passed"]:
            cells[tuple(r[k] for k in key)][r["category"]] += 1
    out = ["| " + " | ".join(key) + " | " + " | ".join(CATS) + " |", "|" + "---|" * (len(key) + len(CATS))]
    for k in sorted(cells):
        out.append("| " + " | ".join(map(str, k)) + " | " + " | ".join(str(cells[k].get(c, 0)) for c in CATS) + " |")
    return "\n".join(out)


def variance_table(rows):
    cells = defaultdict(lambda: defaultdict(dict))
    for r in rows:
        cells[(r["model"], r["harness"])][r["task_id"]][r["repeat"]] = (r["passed"], r["in_tokens"], r["out_tokens"], tuple(r["tool_seq"]))
    out = ["| model | harness | tasks | repeats | pass rate per repeat | tasks with mixed outcome | tasks with any trace difference |", "|---|---|---|---|---|---|---|"]
    for k in sorted(cells):
        tasks = cells[k]
        reps = sorted({rep for t in tasks.values() for rep in t})
        full = {t: v for t, v in tasks.items() if len(v) == len(reps)}
        per = [sum(v[rep][0] for v in full.values()) / max(1, len(full)) for rep in reps]
        mixed = sum(1 for v in full.values() if len({x[0] for x in v.values()}) > 1)
        diff = sum(1 for v in full.values() if len(set(v.values())) > 1)
        out.append(f"| {k[0]} | {k[1]} | {len(full)} | {len(reps)} | {', '.join(f'{p:.2f}' for p in per)} | {mixed} | {diff} |")
    return "\n".join(out)


def agreement_table(rows):
    by = defaultdict(dict)
    for r in rows:
        by[(r["model"], r["task_id"], r["repeat"])][r["harness"]] = (r["passed"], r["in_tokens"], r["out_tokens"], tuple(r["tool_seq"]))
    hs = ["plain", "create_agent", "langgraph", "deep_agent"]
    models = sorted({k[0] for k in by})
    out = ["| model | pair | tasks | same outcome | identical trace (tokens + tool sequence) |", "|---|---|---|---|---|"]
    for m in models:
        for i in range(len(hs)):
            for j in range(i + 1, len(hs)):
                both = [v for k, v in by.items() if k[0] == m and hs[i] in v and hs[j] in v]
                if both:
                    out.append(f"| {m} | {hs[i]} vs {hs[j]} | {len(both)} | {sum(v[hs[i]][0] == v[hs[j]][0] for v in both)} | {sum(v[hs[i]] == v[hs[j]] for v in both)} |")
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="+")
    ap.add_argument("--tag")
    ap.add_argument("--key", default="model,harness")
    ap.add_argument("--variance", action="store_true")
    ap.add_argument("--agreement", action="store_true")
    a = ap.parse_args()
    rows = load(a.files, a.tag)
    key = tuple(a.key.split(","))
    print(f"rows: {len(rows)}\n")
    print("## Pass rate, tokens, time (median [IQR])\n")
    print(cell_table(rows, key))
    print("\n## Pass by family\n")
    print(family_table(rows, key))
    print("\n## Failure categories\n")
    print(cat_table(rows, key))
    if a.agreement:
        print("\n## Harness agreement (same model, same task)\n")
        print(agreement_table(rows))
    if a.variance:
        print("\n## Run-to-run variance\n")
        print(variance_table(rows))


if __name__ == "__main__":
    main()
