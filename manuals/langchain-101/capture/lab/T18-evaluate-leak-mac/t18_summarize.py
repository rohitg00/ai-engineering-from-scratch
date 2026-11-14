import json, sys
from collections import Counter
from pathlib import Path
T = Path(__file__).resolve().parent.parent / "T18"
for fn in ["01-evaluate-requests.jsonl", "02-evaluate-noflush.jsonl"]:
    print(f"== {fn}")
    by = {}
    for l in (T / fn).read_text().splitlines():
        r = json.loads(l)
        reqs = [(h["method"], h["path"], h["names"]) for h in r["recorder"]] + [(p["method"], p["url"], p["names"]) for p in r.get("patched_requests", [])]
        c = Counter(f"{m} {p}" for m, p, _ in reqs)
        names = Counter(n.split(":parent")[0] for _, _, ns in reqs for n in ns)
        orphan = sum(1 for _, _, ns in reqs for n in ns if ":chain:LangGraph:parent=y" in n)
        by.setdefault(r["case"], []).append((r["rc"], tuple(sorted(c.items())), tuple(sorted(names.items())), orphan, tuple(r.get("guard_blocked", [])), str(r.get("rows"))))
    for case, reps in by.items():
        print(case, "n=", len(reps))
        for k, v in Counter(reps).items():
            print("   x", v, "rc", k[0], "requests", dict(k[1]), "runs", dict(k[2]), "LangGraph-with-unsent-parent", k[3], "guard", list(k[4]), "rows", k[5])
