import json
import statistics
import sys
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
rows = [json.loads(l) for l in (HERE / "01-runs.jsonl").read_text().splitlines() if l.strip()]
runs = [r for r in rows if r["kind"] == "run"]
blocks = [r for r in rows if r["kind"] == "block"]
timed = [r for r in runs if not r["warmup"]]
med = statistics.median


def q(xs, p):
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(p * (len(xs) - 1) + 0.5))]


plain = {"v1": "a_plain_openai", "native": "f_plain_ollama"}
by_round = defaultdict(dict)
for r in timed:
    by_round[r["round"]][r["variant"]] = r
out = {"n_runs": len(runs), "n_timed": len(timed), "load1_min": min(b["load"][0] for b in blocks), "load1_max": max(b["load"][0] for b in blocks), "variants": {}}
lines = []
for v in dict.fromkeys(r["variant"] for r in runs):
    xs = [r for r in timed if r["variant"] == v]
    fw = [r["wall_ms"] - r["upstream_ms"] for r in xs]
    share = [100 * (r["wall_ms"] - r["upstream_ms"]) / r["wall_ms"] for r in xs]
    path = xs[0]["path"]
    pv = plain[path]
    paired = [(by_round[k][v]["wall_ms"] - by_round[k][v]["upstream_ms"]) - (by_round[k][pv]["wall_ms"] - by_round[k][pv]["upstream_ms"]) for k in by_round if v in by_round[k] and pv in by_round[k]]
    e = {"path": path, "n": len(xs), "ok": sum(r["ok"] for r in xs), "errors": sum(1 for r in xs if r["error"]),
         "model_calls": dict(Counter(r["model_calls"] for r in xs)),
         "wall_ms_median": round(med([r["wall_ms"] for r in xs]), 2), "wall_ms_p95": round(q([r["wall_ms"] for r in xs], 0.95), 2),
         "model_ms_median_proxy_upstream": round(med([r["upstream_ms"] for r in xs]), 2),
         "framework_ms_median": round(med(fw), 2), "framework_ms_p95": round(q(fw, 0.95), 2), "framework_share_pct_median": round(med(share), 3),
         "framework_minus_plain_paired_ms_median": round(med(paired), 2) if v != pv else 0.0,
         "cpu_ms_median": round(med([r["cpu_ms"] for r in xs]), 2)}
    if path == "native":
        e["model_ms_median_ollama_total_duration"] = round(med([r["ollama_total_ms"] for r in xs]), 2)
        e["wall_minus_ollama_total_ms_median"] = round(med([r["wall_ms"] - r["ollama_total_ms"] for r in xs]), 2)
        e["wall_minus_ollama_total_share_pct_median"] = round(med([100 * (r["wall_ms"] - r["ollama_total_ms"]) / r["wall_ms"] for r in xs]), 3)
    shapes = Counter(json.dumps([[q_["req_bytes"], (q_.get("usage") or {}).get("prompt_tokens") or q_.get("prompt_eval_count"),
                                  (q_.get("usage") or {}).get("completion_tokens") or q_.get("eval_count")] for q_ in r["requests"]]) for r in xs)
    e["calls_bytes_prompt_completion"] = [{"calls": json.loads(k), "runs": n} for k, n in shapes.most_common()]
    out["variants"][v] = e
    lines.append(f"{v:24s} {path:6s} n={e['n']} ok={e['ok']} calls={e['model_calls']} wall={e['wall_ms_median']} model={e['model_ms_median_proxy_upstream']} "
                 f"fw={e['framework_ms_median']} (p95 {e['framework_ms_p95']}) share={e['framework_share_pct_median']}% vs_plain={e['framework_minus_plain_paired_ms_median']} cpu={e['cpu_ms_median']}"
                 + (f" wall-ollama_total={e['wall_minus_ollama_total_ms_median']} ({e['wall_minus_ollama_total_share_pct_median']}%)" if path == "native" else ""))
    lines.append(f"    shapes: {e['calls_bytes_prompt_completion']}")
(HERE / "02-summary.json").write_text(json.dumps(out, indent=1))
txt = f"T01 real, the Mac, {len(timed)} timed runs ({len(runs)} with warm-up), load1 {out['load1_min']:.2f}..{out['load1_max']:.2f}\n" + "\n".join(lines) + "\n"
(HERE / "09-summary-table.txt").write_text(txt)
print(txt)
