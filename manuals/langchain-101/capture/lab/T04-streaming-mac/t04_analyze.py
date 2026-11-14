import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from common import pct, read_jsonl

OUT = Path(__file__).resolve().parent.parent / "T04"


def tok_times_ids(run, prefix=None):
    first = {}
    for t, ln, ids, src in run["text"]:
        for i in ids:
            if prefix and not i.startswith(prefix):
                continue
            first.setdefault(i, t)
    return first


def analyze_run(run, reqs, by_offset=False):
    reqs = sorted(reqs, key=lambda r: r["t_recv_ns"])
    m = {"variant": run["variant"], "block": run["block"], "i": run["i"], "warmup": run["warmup"], "error": run["error"],
         "load1": run["load"][0], "cpu_ms": run["cpu_ns"] / 1e6, "wall_ms": (run["t1"] - run["t0"]) / 1e6, "n_requests": len(reqs)}
    if not reqs:
        m["missing_server"] = True
        return m
    m["req_overhead_ms"] = (reqs[0]["t_recv_ns"] - run["t0"]) / 1e6
    text_reqs = [r for r in reqs if any(e[1] == "text" for e in r["events"]) and (by_offset or any(e[3].startswith("w") for e in r["events"] if e[1] == "text"))]
    if not text_reqs:
        return m
    final = text_reqs[-1]
    srv = [(e[0], e[3]) for e in final["events"] if e[1] == "text"]
    if by_offset:
        ends = []
        acc = 0
        for t, c in srv:
            acc += len(c)
            ends.append((t, acc))
        cl = []
        acc = 0
        for t, ln, ids, src in run["text"]:
            acc += ln
            cl.append((t, acc))
        pairs = []
        j = 0
        for ts, e in ends:
            while j < len(cl) and cl[j][1] < e:
                j += 1
            if j < len(cl):
                pairs.append((ts, cl[j][0]))
        m["client_chars"] = cl[-1][1] if cl else 0
        m["server_chars"] = ends[-1][1] if ends else 0
    else:
        first = tok_times_ids(run, "w")
        pairs = [(ts, first.get(c.strip())) for ts, c in srv]
        m["tokens_missing"] = sum(1 for p in pairs if p[1] is None)
        pairs = [p for p in pairs if p[1] is not None]
    if not pairs:
        return m
    delays = [(c - s) / 1e6 for s, c in pairs]
    cgaps = [(pairs[k][1] - pairs[k - 1][1]) / 1e6 for k in range(1, len(pairs))]
    sgaps = [(pairs[k][0] - pairs[k - 1][0]) / 1e6 for k in range(1, len(pairs))]
    m.update(n_tokens=len(pairs), first_delay_ms=delays[0], median_delay_ms=pct(delays, 0.5), max_delay_ms=max(delays),
             last_delay_ms=delays[-1], ttft_client_ms=(pairs[0][1] - run["t0"]) / 1e6,
             server_ttft_ms=(pairs[0][0] - final["t_recv_ns"]) / 1e6,
             client_gap_median_ms=pct(cgaps, 0.5) if cgaps else None, server_gap_median_ms=pct(sgaps, 0.5) if sgaps else None,
             burst_frac=(sum(1 for g in cgaps if g < 2.0) / len(cgaps)) if cgaps else None)
    tool_reqs = [r for r in reqs if any(e[1] in ("tool_open", "tool_arg") for e in r["events"])]
    if tool_reqs and run["tool"]:
        tr = tool_reqs[0]
        open_t = min(e[0] for e in tr["events"] if e[1] in ("tool_open", "tool_arg"))
        fin_t = max(e[0] for e in tr["events"] if e[1] in ("tool_arg", "finish"))
        ct = [x[0] for x in run["tool"] if x[0] < pairs[0][1]]
        if ct:
            m.update(tool_first_delay_ms=(ct[0] - open_t) / 1e6, tool_last_delay_ms=(ct[-1] - fin_t) / 1e6, n_tool_events=len(ct),
                     tool_to_final_text_ms=(pairs[0][1] - ct[-1]) / 1e6)
    if any(r["events"] and any(e[3].startswith("s") for e in r["events"] if e[1] == "text") for r in reqs):
        sub_first = tok_times_ids(run, "s")
        sub_srv = [(e[0], e[3].strip()) for r in reqs for e in r["events"] if e[1] == "text" and e[3].startswith("s")]
        sp = [(s, sub_first.get(c)) for s, c in sub_srv]
        seen = [p for p in sp if p[1] is not None]
        m["sub_tokens_seen"] = len(seen)
        if seen:
            m["sub_median_delay_ms"] = pct([(c - s) / 1e6 for s, c in seen], 0.5)
            g = [(seen[k][1] - seen[k - 1][1]) / 1e6 for k in range(1, len(seen))]
            m["sub_burst_frac"] = sum(1 for x in g if x < 2.0) / len(g) if g else None
    return m


METRICS = ["req_overhead_ms", "first_delay_ms", "median_delay_ms", "max_delay_ms", "last_delay_ms", "ttft_client_ms", "server_ttft_ms",
           "client_gap_median_ms", "server_gap_median_ms", "burst_frac", "tool_first_delay_ms", "tool_last_delay_ms", "n_tool_events",
           "tool_to_final_text_ms", "sub_tokens_seen", "sub_median_delay_ms", "sub_burst_frac", "cpu_ms", "wall_ms", "n_tokens", "n_requests"]


def main():
    summary = {}
    for phase in sys.argv[1:] or ["text", "tool", "subagent", "ollama"]:
        runs = read_jsonl(OUT / f"{phase}-runs.jsonl")
        srv = read_jsonl(OUT / f"{phase}-server.jsonl")
        drv = read_jsonl(OUT / f"{phase}-driver.jsonl")
        if not runs:
            continue
        if drv:
            start_ns = min(d["t"] for d in drv) * 1e9 - 5e9
            stray = [r for r in runs if r["t0"] < start_ns]
            runs = [r for r in runs if r["t0"] >= start_ns]
            if stray:
                print(f"{phase}: dropped {len(stray)} stray rows from the aborted first run (t0 before driver start)")
        by_tag = defaultdict(list)
        for r in srv:
            by_tag[r["tag"]].append(r)
        rows = [analyze_run(r, by_tag.get(r["tag"], []), by_offset=(phase == "ollama")) for r in runs]
        with open(OUT / f"{phase}-per-run.jsonl", "w") as fh:
            for r in rows:
                fh.write(json.dumps(r) + "\n")
        agg = {}
        for v in dict.fromkeys(r["variant"] for r in rows):
            good = [r for r in rows if r["variant"] == v and not r["warmup"] and not r["error"]]
            a = {"n": len(good), "n_warmup": sum(1 for r in rows if r["variant"] == v and r["warmup"]),
                 "n_error": sum(1 for r in rows if r["variant"] == v and r["error"] and not r["warmup"]),
                 "errors": sorted({r["error"] for r in rows if r["variant"] == v and r["error"]})[:3]}
            for k in METRICS:
                xs = [r[k] for r in good if r.get(k) is not None]
                if xs:
                    a[k] = {"median": round(pct(xs, 0.5), 3), "p95": round(pct(xs, 0.95), 3), "n": len(xs)}
            agg[v] = a
        loads = [d["load_before"][0] for d in drv]
        summary[phase] = {"variants": agg, "load1_min": min(loads) if loads else None, "load1_max": max(loads) if loads else None}
    (OUT / "10-analysis.json").write_text(json.dumps(summary, indent=1))
    for phase, s in summary.items():
        print(f"== {phase}  load1 {s['load1_min']}..{s['load1_max']}")
        for v, a in s["variants"].items():
            def g(k, q="median"):
                return a.get(k, {}).get(q, "-")
            print(f"{v:26s} n={a['n']:3d} err={a['n_error']} reqOH={g('req_overhead_ms')} first={g('first_delay_ms')}/{g('first_delay_ms','p95')} "
                  f"med={g('median_delay_ms')} last={g('last_delay_ms')} ttft={g('ttft_client_ms')} gap={g('client_gap_median_ms')} "
                  f"burst={g('burst_frac')} toolfirst={g('tool_first_delay_ms')} toollast={g('tool_last_delay_ms')} ntool={g('n_tool_events')} "
                  f"sub={g('sub_tokens_seen')} subburst={g('sub_burst_frac')} cpu={g('cpu_ms')} wall={g('wall_ms')}")


if __name__ == "__main__":
    main()
