import json
import statistics as st
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent


def load(name):
    p = HERE / name
    return [json.loads(l) for l in p.read_text().splitlines() if l.strip()] if p.exists() else []


med = st.median
lines = []
lat = load("03-latency-summary.jsonl")
by = defaultdict(list)
firsts = defaultdict(list)
for b in lat:
    t = b["times"]
    by[b["cond"]] += t[1:]
    firsts[b["cond"]].append((round(t[0]["ms"], 1), round(t[0]["non_model_ms"], 1)))
lines.append("== latency: 3 processes x 21 runs per condition, first run of each process left out")
for c, xs in by.items():
    lines.append(f"{c:6s} n={len(xs)} ok={sum(x['ok'] for x in xs)} wall_median={med(x['ms'] for x in xs):.1f} ms model_median={med(x['model_ms'] for x in xs):.1f} "
                 f"non_model_median={med(x['non_model_ms'] for x in xs):.2f} ms p95={sorted(x['non_model_ms'] for x in xs)[int(0.95*(len(xs)-1))]:.2f} "
                 f"first runs (wall, non-model)={firsts[c]}")
for b in lat:
    lines.append(f"   {b['block']:8s} exit_lag={b['exit_lag_s']} requests={b['requests_by_path']} posted={b['runs_posted']}/{b['expected_runs']} runs_per_post={b['posts_per_request']} uptime={b['uptime_before'][-40:]}")
il = load("04-interleave-summary.jsonl")
for b in il:
    t = b["times"][2:]
    on = [x for x in t if x["traced"]]
    off = [x for x in t if not x["traced"]]
    pairs = [t[i + 1]["non_model_ms"] - t[i]["non_model_ms"] if t[i]["traced"] else None for i in range(0, len(t) - 1, 2)]
    pairs = [t[i]["non_model_ms"] - t[i + 1]["non_model_ms"] for i in range(0, len(t) - 1, 2) if t[i]["traced"] and not t[i + 1]["traced"]]
    lines.append(f"== interleaved in one process, tracing_context(enabled=True/False) alternating, first 2 runs left out")
    lines.append(f"on n={len(on)} ok={sum(x['ok'] for x in on)} non_model_median={med(x['non_model_ms'] for x in on):.2f} wall={med(x['ms'] for x in on):.1f}; "
                 f"off n={len(off)} ok={sum(x['ok'] for x in off)} non_model_median={med(x['non_model_ms'] for x in off):.2f} wall={med(x['ms'] for x in off):.1f}; "
                 f"paired on-off median={med(pairs):.2f} ms (n={len(pairs)}); first run={b['times'][0]['ms']:.1f} non-model {b['times'][0]['non_model_ms']:.1f}")
    lines.append(f"   exit_lag={b['exit_lag_s']} requests={b['requests_by_path']} posted={b['runs_posted']} expected traced={7*len([x for x in b['times'] if x['traced']])} runs_per_post median={med([p for p in b['posts_per_request'] if p] or [0])} max={max(b['posts_per_request'] or [0])}")
fail = load("01-failure-summary.jsonl")
lines.append("== failure: one process of 50 runs per endpoint state")
for b in fail:
    t = b["times"] or []
    lines.append(f"{b['cond']:10s} rc={b['rc']} ok={b['ok_runs']}/{b['n']} errors={b['n_errors']} run_median={b['run_ms_median'] and round(b['run_ms_median'],1)} non_model_median={b['non_model_ms_median_after_first'] and round(b['non_model_ms_median_after_first'],2)} "
                 f"first={b['run_ms_first'] and round(b['run_ms_first'],1)} exit_lag={b['exit_lag_s']} child_wall={b['child_wall_s']} flush_ms={b['flush_ms'] and round(b['flush_ms'],1)} requests={b['requests_by_path']} "
                 f"posted={b['runs_posted']}/{b['expected_runs']} timeout={b['timeout_s']}")
for r in load("02-tracing-context-local.jsonl"):
    lines.append(f"local: {r.get('case')} inside={r.get('tracing_is_enabled_inside')} answer={r.get('answer')!r} trees={r.get('local_trees')} recorder={r.get('recorder_hits')} x{r.get('recorder_hit_count')} patched={r.get('patched_requests_seen')}")
txt = "\n".join(lines) + "\n"
(HERE / "09-summary-table.txt").write_text(txt)
print(txt)
