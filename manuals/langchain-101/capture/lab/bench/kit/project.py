import json
from collections import defaultdict
from env import BENCH

P = json.loads((BENCH / "data" / "anthropic-prices.json").read_text())["models"]
rows = lambda f: [json.loads(l) for l in open(BENCH / "runs" / f) if l.strip()]
main = [r for r in rows("main.jsonl") if r["model"] == "qwen3:8b" and r["repeat"] == 0]
smoke = rows("anthropic-smoke.jsonl")
q8 = {(r["task_id"], r["harness"]): r for r in main}
ratio_in = sum(r["in_tokens"] for r in smoke) / sum(q8[(r["task_id"], "plain")]["in_tokens"] for r in smoke)
ratio_out = sum(r["out_tokens"] for r in smoke) / sum(q8[(r["task_id"], "plain")]["out_tokens"] for r in smoke)
sub = {l.strip() for l in open(BENCH / "data" / "subset30.txt") if l.strip()}
tasks = [json.loads(l) for l in open(BENCH / "data" / "tasks.jsonl")]


def cost(model, harness, ids):
    i = sum(q8[(t, harness)]["in_tokens"] for t in ids) * ratio_in
    o = sum(q8[(t, harness)]["out_tokens"] for t in ids) * ratio_out
    return i, o, (i * P[model]["input"] + o * P[model]["output"]) / 1e6


allids = [t["id"] for t in tasks]
files = [t["id"] for t in tasks if t["family"] == "files"]
co = [t["id"] for t in tasks if t["family"] in ("chain", "sql")]
c10 = [f"chain{i:02d}" for i in range(1, 20, 2)]
ts = defaultdict(list)
for r in rows("toolscale.jsonl"):
    if r["model"] == "qwen3:8b" or (r["model"].startswith("qwen3:4b") and r["n_core_plus_distractors"] in (20, 100)):
        ts[(r["n_core_plus_distractors"], r["selector"])].append(r)
cells = []
cells.append(("haiku plain full100",) + cost("claude-haiku-5-5", "plain", allids))
cells.append(("haiku deep_agent full100",) + cost("claude-haiku-5-5", "deep_agent", allids))
cells.append(("haiku deep_agent_fs files20",) + cost("claude-haiku-5-5", "deep_agent_fs", files))
for v, mult in (("none", 1.0), ("extract", 1.15), ("tool", 1.2), ("provider", 1.1)):
    i, o, c = cost("claude-haiku-5-5", "create_agent" if all((t, "create_agent") in q8 for t in co) else "plain", co)
    cells.append((f"haiku structured {v} 40", i * mult, o * mult, c * mult))
for size in (5, 20, 50, 100):
    for sel in ("off", "on"):
        rs = ts.get((size, sel)) or ts.get((size, "on_desc")) or []
        if not rs:
            continue
        i = sum(r["in_tokens"] for r in rs) / len(rs) * 10 * ratio_in
        o = sum(r["out_tokens"] for r in rs) / len(rs) * 10 * ratio_out
        cells.append((f"haiku toolscale n={size} sel={sel} 10", i, o, (i * P["claude-haiku-5-5"]["input"] + o * P["claude-haiku-5-5"]["output"]) / 1e6))
cells.append(("sonnet plain subset30",) + cost("claude-sonnet-5-5", "plain", sorted(sub)))
cells.append(("sonnet deep_agent subset30",) + cost("claude-sonnet-5-5", "deep_agent", sorted(sub)))
print(f"token ratio haiku/qwen3:8b from smoke: in {ratio_in:.2f} out {ratio_out:.2f}; projection assumes no cache hits (upper bound)")
tot = 0
for name, i, o, c in cells:
    tot += c
    print(f"{name:36s} in {i/1e3:8.0f}k out {o/1e3:6.0f}k  ${c:.3f}")
print(f"TOTAL projected ${tot:.2f}")
