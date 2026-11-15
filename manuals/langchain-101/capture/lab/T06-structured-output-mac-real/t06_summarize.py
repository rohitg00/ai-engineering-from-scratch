import json
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
rows = [json.loads(l) for l in (HERE / "01-provider-paths.jsonl").read_text().splitlines() if l.strip()]
cells = defaultdict(list)
for r in rows:
    if r["kind"] == "run":
        cells[(r["model"], r["client"], r["strategy"])].append(r)
lines = []
for (m, c, s), xs in cells.items():
    out = Counter(x["outcome"] + (":" + x.get("error_type", "") if x["outcome"] == "raised" else "") for x in xs)
    reqs = Counter(json.dumps([[q["path"], q["status"], q.get("response_format_type") or q.get("format"), "tools" in (q.get("req_keys") or []) and "tool_choice" in (q.get("req_keys") or [])] for q in x["requests"]]) for x in xs)
    errs = sorted({x.get("error", "")[:160] for x in xs if x.get("error")})
    sample = xs[0].get("structured") or ""
    lines.append(f"{m:32s} {c:10s} {s:16s} n={len(xs)} {dict(out)} requests(path,status,format,tool_choice)={dict(reqs)} {errs} {sample[:90]}")
txt = "\n".join(lines) + "\n"
(HERE / "09-summary-table.txt").write_text(txt)
print(txt)
