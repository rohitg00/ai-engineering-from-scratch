import json
import statistics as st
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
rows = [json.loads(l) for l in (HERE / "03-iso38484-qwen3-8b.jsonl").read_text().splitlines() if l.strip()]
runs = [r for r in rows if r["kind"] == "run" and not r["warmup"]]
by = defaultdict(list)
for r in runs:
    by[r["pattern"]].append(r)
lines = [f"#38484 on qwen3:8b reasoning=True via ChatOllama, n per pattern after 1 warm-up rep; load {min(b['load'][0] for b in rows if b['kind']=='block'):.2f}..{max(b['load'][0] for b in rows if b['kind']=='block'):.2f}"]
keys = ["first_text_delay_ms", "median_text_delay_ms", "max_text_delay_ms", "emit_spread_ms", "receive_spread_ms", "client_text_deltas", "server_text_lines",
        "client_reasoning_deltas", "server_reasoning_lines", "first_reasoning_delay_ms", "reasoning_receive_spread_ms", "server_last_reasoning_to_first_text_ms", "wall_ms", "eval_count"]
for p, xs in by.items():
    parts = [f"{p:20s} n={len(xs)} errors={sum(1 for x in xs if x['error'])}"]
    for k in keys:
        v = [x[k] for x in xs if x.get(k) is not None]
        if v:
            parts.append(f"{k}={min(v):.1f}..{max(v):.1f} (med {st.median(v):.1f})" if isinstance(v[0], float) else f"{k}={min(v)}..{max(v)}")
    lines.append(" ".join(parts))
txt = "\n".join(lines) + "\n"
(HERE / "09-summary-iso.txt").write_text(txt)
print(txt)
