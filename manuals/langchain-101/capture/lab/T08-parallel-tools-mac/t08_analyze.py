import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "T04-streaming-mac"))
from common import pct, read_jsonl

OUT = Path(__file__).resolve().parent


def main():
    rows = read_jsonl(OUT / "01-concurrency-runs.jsonl")
    g = defaultdict(list)
    for r in rows:
        if r["warmup"]:
            continue
        g[(r["kind"], r["mode"], r["tool"], r["n_calls"], r["max_concurrency"])].append(r)
    res = []
    for k, rs in sorted(g.items(), key=lambda kv: (kv[0][0], kv[0][1], kv[0][2], kv[0][3], -1 if kv[0][4] is None else kv[0][4])):
        ok = [r for r in rs if not r["error"]]
        e = {"kind": k[0], "mode": k[1], "tool": k[2], "n_calls": k[3], "max_concurrency": k[4], "n": len(rs), "n_error": len(rs) - len(ok),
             "error": rs[0]["error"] if len(ok) < len(rs) else None}
        if ok:
            e.update(wall_ms_median=round(pct([r["wall_ms"] for r in ok], 0.5), 1), wall_ms_max=round(max(r["wall_ms"] for r in ok), 1),
                     tool_span_ms_median=round(pct([r["tool_span_ms"] for r in ok], 0.5), 1),
                     overlap_min=min(r["max_overlap"] for r in ok), overlap_max=max(r["max_overlap"] for r in ok),
                     threads_max=max(r["threads"] for r in ok), exec_per_run=sorted({r["n_exec"] for r in ok}),
                     toolmsgs_per_run=sorted({r["n_toolmsgs"] for r in ok}))
        res.append(e)
    loads = [r["load_block"][0] for r in rows if not r["warmup"]]
    (OUT / "10-analysis.json").write_text(json.dumps({"cells": res, "load1_min": min(loads), "load1_max": max(loads),
                                                       "cpu_count": rows[0]["cpu_count"]}, indent=1))
    print("load1", min(loads), max(loads), "cpu_count", rows[0]["cpu_count"])
    for e in res:
        print(f"{e['kind']:8s} {e['mode']:7s} {e['tool']:5s} N={e['n_calls']:2d} mc={str(e['max_concurrency']):4s} n={e['n']} err={e['n_error']} "
              f"wall={e.get('wall_ms_median')} span={e.get('tool_span_ms_median')} overlap={e.get('overlap_min')}-{e.get('overlap_max')} "
              f"thr={e.get('threads_max')} exec={e.get('exec_per_run')} tm={e.get('toolmsgs_per_run')} {(e['error'] or '')[:90]}")


if __name__ == "__main__":
    main()
