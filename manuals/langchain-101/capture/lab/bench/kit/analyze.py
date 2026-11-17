import json
import statistics
from collections import Counter, defaultdict

from env import BENCH
from summarize import agreement_table, cat_table, cell_table, family_table, med_iqr, variance_table, wilson


def rows(f):
    p = BENCH / "runs" / f
    return [json.loads(l) for l in open(p) if l.strip()] if p.exists() else []


def subset_ids():
    return {l.strip() for l in open(BENCH / "data" / "subset30.txt") if l.strip()}


def main():
    out = []
    main_rows = rows("main.jsonl")
    sub = subset_ids()
    r0 = [r for r in main_rows if r["repeat"] == 0]
    cells = defaultdict(set)
    for r in r0:
        cells[(r["model"], r["harness"])].add(r["task_id"])
    full = [r for r in r0 if len(cells[(r["model"], r["harness"])]) >= 100]
    out.append(f"# Bench results ({len(main_rows)} main rows)\n")
    out.append("## A. Full suite, n=1 per task (cells with all 100 tasks)\n")
    out.append(cell_table(full))
    out.append("\n### Pass by family (full cells)\n")
    out.append(family_table(full))
    out.append("\n### Failure categories (full cells)\n")
    out.append(cat_table(full))
    s0 = [r for r in r0 if r["task_id"] in sub]
    out.append("\n## B. 30-task stratified subset, repeat 0, every model and harness\n")
    out.append(cell_table(s0))
    out.append("\n### Pass by family (subset)\n")
    out.append(family_table(s0))
    out.append("\n### Failure categories (subset)\n")
    out.append(cat_table(s0))
    out.append("\n## C. Harness agreement on identical tasks (repeat 0)\n")
    out.append(agreement_table(r0))
    rep = [r for r in main_rows if r["task_id"] in sub]
    reps = defaultdict(set)
    for r in rep:
        reps[(r["model"], r["harness"])].add(r["repeat"])
    rep = [r for r in rep if len(reps[(r["model"], r["harness"])]) >= 3]
    if rep:
        out.append("\n## D. Run-to-run variance (subset, 3 repeats)\n")
        out.append(variance_table(rep))
    ts = rows("toolscale.jsonl")
    if ts:
        out.append("\n## E. Tool-count scaling (create_agent, chain tasks)\n")
        g = defaultdict(list)
        for r in ts:
            g[(r["model"], r["n_core_plus_distractors"], r["selector"])].append(r)
        out.append("| model | tools (+submit) | selector | n | pass | 95% CI | distractor calls (sum) | model calls med | in tok med [IQR] | wall s med [IQR] | top failure |")
        out.append("|---|---|---|---|---|---|---|---|---|---|---|")
        for k in sorted(g, key=lambda k: (k[0], k[1], k[2])):
            rs = g[k]
            p = sum(r["passed"] for r in rs)
            lo, hi = wilson(p, len(rs))
            top = Counter(r["category"] for r in rs if not r["passed"]).most_common(2)
            out.append(f"| {k[0]} | {k[1]} | {k[2]} | {len(rs)} | {p}/{len(rs)} | {lo:.2f}-{hi:.2f} | {sum(r['distractor_calls'] for r in rs)} | "
                       f"{statistics.median([r['model_calls'] for r in rs])} | {med_iqr([r['in_tokens'] for r in rs])} | {med_iqr([r['wall_s'] for r in rs])} | {top} |")
    so = rows("structured.jsonl")
    if so:
        out.append("\n## F. Structured output correctness (create_agent, chain + sql)\n")
        g = defaultdict(list)
        for r in so:
            g[(r["model"], r["variant"])].append(r)
        out.append("| model | variant | n | answer present | correct (value vs truth) | 95% CI | truth anywhere in output | lookups ok | errors | model calls med | in tok med | wall s med |")
        out.append("|---|---|---|---|---|---|---|---|---|---|---|---|")
        for k in sorted(g):
            rs = g[k]
            c = sum(r["correct"] for r in rs)
            lo, hi = wilson(c, len(rs))
            out.append(f"| {k[0]} | {k[1]} | {len(rs)} | {sum(r['answer_present'] for r in rs)} | {c} | {lo:.2f}-{hi:.2f} | {sum(r['correct_any_number_in_text'] for r in rs)} | "
                       f"{sum(r['lookups_ok'] for r in rs)} | {sum(1 for r in rs if r['error'])} | {statistics.median([r['model_calls'] for r in rs])} | "
                       f"{statistics.median([r['in_tokens'] for r in rs])} | {statistics.median([r['wall_s'] for r in rs]):.1f} |")
        errs = Counter((r["variant"], (r["error"] or "")[:60]) for r in so if r["error"])
        out.append("\nErrors: " + "; ".join(f"{k[0]}: {k[1]} x{v}" for k, v in errs.most_common(8)))
    fr = [r for r in r0 if r["family"] == "files"]
    fcells = defaultdict(set)
    for r in fr:
        fcells[(r["model"], r["harness"])].add(r["task_id"])
    fr = [r for r in fr if len(fcells[(r["model"], r["harness"])]) == 20]
    if fr:
        out.append("\n## G. File family (20 tasks): deep agent default backend vs FilesystemBackend on the sandbox\n")
        out.append(cell_table(fr))
        out.append("")
        out.append(cat_table(fr))
        bu = Counter()
        for r in fr:
            if r["harness"].startswith("deep_agent"):
                bu[(r["model"], r["harness"], bool(r.get("deep_builtins_used")))] += 1
        out.append("\nDeep-agent runs that used built-in fs tools (model, harness, used): " + "; ".join(f"{k}: {v}" for k, v in sorted(bu.items())))
    sm = rows("sampling.jsonl")
    if sm:
        out.append("\n## H. Sampling variance: plain loop, 4b, subset30, temperature 0.7, seeds 1-3\n")
        by = defaultdict(dict)
        for r in sm:
            by[r["task_id"]][r["tag"]] = r["passed"]
        tags = sorted({r["tag"] for r in sm})
        per = {t: sum(v.get(t, False) for v in by.values()) for t in tags}
        mixed = sum(1 for v in by.values() if len(set(v.values())) > 1)
        out.append("| seed tag | n | pass |\n|---|---|---|")
        for t in tags:
            n = sum(1 for v in by.values() if t in v)
            lo, hi = wilson(per[t], n)
            out.append(f"| {t} | {n} | {per[t]}/{n} ({lo:.2f}-{hi:.2f}) |")
        out.append(f"\nTasks with mixed outcome across seeds: {mixed}/{len(by)}")
    text = "\n".join(out) + "\n"
    (BENCH / "results").mkdir(exist_ok=True)
    (BENCH / "results" / "summary.md").write_text(text)
    print(text)


if __name__ == "__main__":
    main()
