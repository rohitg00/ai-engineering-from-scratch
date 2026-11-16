import json
import sys
from statistics import median


def pct(xs, q):
    xs = sorted(xs)
    if not xs:
        return None
    k = (len(xs) - 1) * q
    f = int(k)
    c = min(f + 1, len(xs) - 1)
    return xs[f] + (xs[c] - xs[f]) * (k - f)


def main():
    block = 50
    for f in sys.argv[1:]:
        rows = [json.loads(l) for l in open(f)]
        hdr = rows[0]
        ts = [r for r in rows if r.get("exp") == "T10r"]
        print(f"== {hdr.get('variant')} ({f}) turns={len(ts)} summarization={hdr.get('summarization')}")
        calls = [c for r in ts for c in r["calls"]]
        print(f"  model calls {len(calls)}, summary calls {sum(r['summary_calls'] for r in ts)}, errors {sum(1 for r in ts if r['error'])}, orphans {sum(c['orphans'] for c in calls)}")
        tool = [r for r in ts if r["expect"]]
        import re
        def ans_ok(r):
            t = r["answer"].replace(",", "")
            return all(re.search(rf"(?<!\d){n}(?!\d)", t) for n in r["expect"])
        def used(r):
            return r["tool_msgs_this_turn"] >= len(r["expect"])
        print(f"  tool turns correct (answer has every sum and tool ran for each) {sum(1 for r in tool if r['correct'])}/{len(tool)}; answer has every sum {sum(1 for r in tool if ans_ok(r))}/{len(tool)}; tool ran for each addition {sum(1 for r in tool if used(r))}/{len(tool)}")
        nos = [r["latency_ms"] for r in ts if r["summary_calls"] == 0]
        ws = [r["latency_ms"] for r in ts if r["summary_calls"] > 0]
        print(f"  turn p50 without a summary call {pct(nos,.5):.0f} ms (n={len(nos)}); with one {pct(ws,.5) if ws else float('nan'):.0f} ms (n={len(ws)}); summary turns {[r['turn'] for r in ts if r['summary_calls']]}")
        print(f"  sum of turn latency {sum(r['latency_ms'] for r in ts)/1000:.0f} s; framework ms p50 {pct([r['framework_ms'] for r in ts],.5):.1f}")
        print("  block      lat_p50  lat_p90  model_p50  frame_p50  max_in_tok  max_req_msgs  summaries  tool_ok   MB_main")
        for b0 in range(1, len(ts) + 1, block):
            br = [r for r in ts if b0 <= r["turn"] < b0 + block]
            lat = [r["latency_ms"] for r in br]
            mb = [r["bytes"]["main_total"] / 1e6 for r in br if "bytes" in r]
            tk = [c["in_tok"] or 0 for r in br for c in r["calls"]]
            rm = [c["req_msgs"] for r in br for c in r["calls"]]
            tb = [r for r in br if r["expect"]]
            print(f"  {b0:4}-{b0+len(br)-1:<4} {pct(lat,.5):8.0f} {pct(lat,.9):8.0f} {pct([r['model_ms'] for r in br],.5):9.0f} {pct([r['framework_ms'] for r in br],.5):9.1f} {max(tk):10} {max(rm):12} {sum(r['summary_calls'] for r in br):9}  {sum(1 for r in tb if r['correct'])}/{len(tb):<3} {mb[-1] if mb else float('nan'):9.2f}")
        pr = [r for r in ts if "probes" in r]
        print("  recall probes (turn: correct/5, facts missed):")
        for r in pr:
            miss = [p["fact"] for p in r["probes"] if not p["correct"]]
            print(f"    t{r['turn']}: {r['recall']}/5 {miss} in_tok={[p['calls'][0]['in_tok'] if p['calls'] else None for p in r['probes']][:1]}")
        sm = [s for r in ts for s in r["summ"]]
        if sm:
            print(f"  summary call ms p50 {pct([s['ms'] for s in sm],.5):.0f} max {max(s['ms'] for s in sm):.0f}; in_tok p50 {pct([s['in_tok'] or 0 for s in sm],.5)}")
        last = [r for r in ts if "bytes" in r][-1:]
        if last:
            print(f"  bytes at turn {last[0]['turn']}: {last[0]['bytes']}")


if __name__ == "__main__":
    main()
