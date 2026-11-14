import json
from collections import Counter, defaultdict
from pathlib import Path
T = Path(__file__).resolve().parent.parent / "T20"
groups = defaultdict(list)
for l in (T / "01-mcp-edges.jsonl").read_text().splitlines():
    r = json.loads(l)
    sig = []
    for e in r.get("events", []):
        if e["step"] == "agent-interrupt":
            v = e["value"]; sig.append(f"interrupt type={v['type']} requests={[(q['key'], q['mode']) for q in v['requests']]}")
        elif "raised" in e:
            sig.append(f"{e['step']} RAISED {e['raised']}: {e['msg'][:160]}")
        elif e["step"] == "agent-stream":
            sig.append("stream " + ",".join(c[1][0] if isinstance(c[1], list) and c[1] else str(c[1]) for c in e["chunks"]) + f" custom_chunks={sum(1 for c in e['chunks'] if c[0]=='custom')}")
        elif e["step"] == "agent-state":
            sig.append(f"state next={e['next']} interrupts={e['n_interrupts']}")
        elif "tool_messages" in e:
            sig.append(f"{e['step']} " + "; ".join(f"{m['status']} {m['text']} artifact={m['artifact']}" for m in e["tool_messages"]) + f" last={e.get('last')!r}")
        elif e["step"] == "direct":
            sig.append(f"direct {e['status']} {e['text']} artifact={e['artifact']}")
        elif e["step"] == "raw-fastmcp":
            sig.append(f"raw fastmcp is_error={e['is_error']} structured_content={e['structured_content']}")
    sig.append(f"protocol={r.get('protocol')} handler_calls={len(r.get('handler_calls', []))} progress_calls={len(r.get('progress_calls', []))} server_calls={r.get('server_calls')} rc={r.get('rc')}")
    groups[(r["case"], r.get("transport"))].append(tuple(sig))
for (case, tr), reps in groups.items():
    print(f"== {case} [{tr}] n={len(reps)}")
    for sig, k in Counter(reps).items():
        print(f"  x{k}")
        for s in sig:
            print("    " + s)
