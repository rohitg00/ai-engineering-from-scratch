import json
import sys
from collections import Counter, defaultdict

POINTS = ["before_tool", "inside_tool", "before_put_writes", "before_put", "after_tool"]


def load(files_reps):
    rows = []
    for f, lo, hi in files_reps:
        for line in open(f):
            r = json.loads(line)
            if r.get("exp") == "T02r" and lo <= r["rep"] <= hi:
                rows.append(r)
    return rows


def first_calls(r):
    for m in r["model_calls"]:
        if m[0] == "run":
            return len(json.loads(m[3]))
    return None


def resume_new_ids(r):
    led_ids = [a[1] for a in r["attempts"]]
    return len(set(led_ids))


def main():
    files = []
    for spec in sys.argv[1:]:
        f, rng = spec.split("@")
        lo, hi = map(int, rng.split("-"))
        files.append((f, lo, hi))
    rows = load(files)
    cells = defaultdict(list)
    for r in rows:
        cells[(r["key"], r["saver"], r["durability"], r["kill_point"])].append(r)
    print(f"trials: {len(rows)}")
    print("key      saver    dur   point              n  killed twice(eff>1) eff_dist attempts_dist  model_calls_dist  resume_action  next_empty_unfinished  final_ok  first_reply_calls distinct_call_ids")
    tot = Counter()
    for k in sorted(cells, key=lambda c: (c[0], c[1], ["sync", "async", "exit"].index(c[2]), POINTS.index(c[3]))):
        rs = cells[k]
        killed = sum(r["killed"] for r in rs)
        twice = sum(r["effects_total"] > 1 for r in rs)
        eff = Counter(r["effects_total"] for r in rs)
        att = Counter(r["attempts_total"] for r in rs)
        mc = Counter(r["n_model_calls"] for r in rs)
        ra = Counter((r["resume_report"] or {}).get("resume_action") for r in rs if r["killed"])
        ne = sum(1 for r in rs if r["killed"] and (r["resume_report"] or {}).get("resume_action") == "invoke_none_with_empty_next")
        fin_ok = sum(1 for r in rs if r["resume_report"] and r["resume_report"]["final_messages"][-1][0] == "ai" and r["resume_report"]["final_next"] == [] and r["effects_total"] >= 1)
        fr = Counter(first_calls(r) for r in rs)
        ids = Counter(resume_new_ids(r) for r in rs)
        errs = sum(1 for r in rs if r["resume_rc"] != 0 or (r["run_rc"] not in (0, -9)))
        print(f"{k[0]:8} {k[1]:8} {k[2]:5} {k[3]:18} {len(rs):2} {killed:3} {twice:3}  {dict(eff)} {dict(att)} {dict(mc)} {dict(ra)} {ne} {fin_ok} {dict(fr)} {dict(ids)} errs={errs}")
        tot[(k[0], "n")] += len(rs)
        tot[(k[0], "twice")] += twice
        tot[(k[0], "killed")] += killed
        tot[(k[0], "ne")] += ne
        tot[(k[0], "fin_ok")] += fin_ok
    print()
    for key in sorted({k[0] for k in cells}):
        print(f"{key}: n={tot[(key,'n')]} killed={tot[(key,'killed')]} effect>1 in {tot[(key,'twice')]} final_ok={tot[(key,'fin_ok')]} empty_next_after_kill={tot[(key,'ne')]}")
    allfr = Counter(first_calls(r) for r in rows)
    print("first model reply tool calls over all trials:", dict(allfr))
    secs = [r["wall_s"] for r in rows]
    print("trial wall s: min %.1f median %.1f max %.1f" % (min(secs), sorted(secs)[len(secs) // 2], max(secs)))


if __name__ == "__main__":
    main()
