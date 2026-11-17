import difflib
import json
import re
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "02-request-bodies.jsonl"
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else HERE / "03-request-body-diff.txt"
IDS = re.compile(r"call_[A-Za-z0-9]+")
SKIP_HEADERS = {"authorization", "host", "content-length", "connection", "accept-encoding"}

rows = [json.loads(x) for x in SRC.open()]
runs = [r for r in rows if r["kind"] == "run" and not r["warmup"]]
progs = ["a_plain_openai", "c_create_agent"]
by = {p: [r for r in runs if r["program"] == p] for p in progs}
out = []
out.append(f"Source: {SRC.name}. Timed rounds: {len(by[progs[0]])} per program (warm-up rounds left out). Tool call ids (call_...) are replaced by call_<id> before the bodies are compared across runs.")
for p in progs:
    shapes = Counter(tuple(q["req_bytes"] for q in r["requests"]) for r in by[p])
    norm = Counter(tuple(IDS.sub("call_<id>", q["req_body"]) for q in r["requests"]) for r in by[p])
    answers = Counter(r["answer"] for r in by[p])
    out.append(f"{p}: request bytes per run {dict(shapes)}; distinct bodies after id masking: {len(norm)}; answers {dict(answers)}; errors {sum(1 for r in by[p] if r['error'])}")

pairs = list(zip(by["a_plain_openai"], by["c_create_agent"]))
per_call = Counter()
for a, c in pairs:
    for k, (qa, qc) in enumerate(zip(a["requests"], c["requests"]), 1):
        per_call[(k, qa["req_bytes"], qc["req_bytes"])] += 1
out.append("byte difference per call, paired by round: " + "; ".join(f"call {k}: {ba} vs {bc} (+{bc - ba}) in {n} rounds" for (k, ba, bc), n in sorted(per_call.items())))

a, c = pairs[0]
for k, (qa, qc) in enumerate(zip(a["requests"], c["requests"]), 1):
    ja, jc = json.loads(qa["req_body"]), json.loads(qc["req_body"])
    out.append("")
    out.append(f"### request {k}: a_plain_openai ({qa['req_bytes']} B) vs c_create_agent ({qc['req_bytes']} B), round {a['round']}, raw bodies as sent")
    out.append(f"top-level key order a: {list(ja)}")
    out.append(f"top-level key order c: {list(jc)}")
    pa = json.dumps(ja, indent=1).splitlines()
    pc = json.dumps(jc, indent=1).splitlines()
    out.append("pretty-printed JSON diff (key order kept as sent):")
    out.extend(difflib.unified_diff(pa, pc, "a_plain_openai", "c_create_agent", lineterm="", n=1))
    sa, sc = qa["req_body"], qc["req_body"]
    ida, idc = list(dict.fromkeys(IDS.findall(sa) or re.findall(r'"id":"([A-Za-z0-9]{20,})"', sa))), list(dict.fromkeys(re.findall(r'"id":"([A-Za-z0-9]{20,})"', sc)))
    ida = list(dict.fromkeys(re.findall(r'"id":"([A-Za-z0-9]{20,})"', sa)))
    out.append(f"tool call ids: a {[len(x) for x in ida]} chars, c {[len(x) for x in idc]} chars; for the byte edits below the ids of c are replaced by the ids of a (same length), so only the other bytes show")
    for x, y in zip(idc, ida):
        if len(x) == len(y):
            sc = sc.replace(x, y)
    sm = difflib.SequenceMatcher(None, sa, sc, autojunk=False)
    out.append("raw byte edits (a -> c), with the byte count of each:")
    total = 0
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            continue
        d = (j2 - j1) - (i2 - i1)
        total += d
        out.append(f"  {tag:7s} a[{i1}:{i2}]={sa[i1:i2]!r} -> c[{j1}:{j2}]={sc[j1:j2]!r}  ({d:+d} B)")
    out.append(f"  sum of edits: {total:+d} B (len c - len a = {len(sc) - len(sa):+d} B)")
    ma = [m for m in ja["messages"]]
    mc = [m for m in jc["messages"]]
    out.append(f"messages equal after id masking: {IDS.sub('call_<id>', json.dumps(ma)) == IDS.sub('call_<id>', json.dumps(mc))}; tools equal as parsed JSON: {ja.get('tools') == jc.get('tools')}; tools equal as bytes: {json.dumps(ja.get('tools'), separators=(',', ':')) == json.dumps(jc.get('tools'), separators=(',', ':'))}")
    dumps = lambda v: json.dumps(v, separators=(",", ":"))
    ledger = []
    if "stream" in jc and "stream" not in ja:
        ledger.append((len(f'"stream":{dumps(jc["stream"])},'), f'"stream":{dumps(jc["stream"])} added'))
    ledger.append((len(dumps(jc["temperature"])) - len(dumps(ja["temperature"])), f'"temperature":{dumps(ja["temperature"])} -> "temperature":{dumps(jc["temperature"])}'))
    for n, (x, y) in enumerate(((x, y) for x, y in zip(ma, mc) if x.get("role") == "assistant"), 1):
        ledger.append((len(dumps(y.get("content"))) - len(dumps(x.get("content"))), f'assistant turn {n}: "content":{dumps(x.get("content"))} -> "content":{dumps(y.get("content"))}'))
        for tx, ty in zip(x["tool_calls"], y["tool_calls"]):
            ax, ay = tx["function"]["arguments"], ty["function"]["arguments"]
            ledger.append((len(dumps(ay)) - len(dumps(ax)), f"assistant turn {n}: arguments {ax} -> {ay}"))
            for key in sorted(set(tx) - set(ty)):
                ledger.append((-len(f",{dumps(key)}:{dumps(tx[key])}"), f"assistant turn {n}: {dumps(key)}:{dumps(tx[key])} dropped"))
    out.append("byte ledger (everything else is the same keys and values in another order, 0 B):")
    for d, what in ledger:
        out.append(f"  {d:+d} B  {what}")
    out.append(f"  ledger sum {sum(d for d, _ in ledger):+d} B; measured {qc['req_bytes'] - qa['req_bytes']:+d} B")

out.append("")
out.append("### request headers that differ between the programs (every request of every timed round)")
hset = {}
for p in progs:
    seen = Counter()
    for r in by[p]:
        for q in r["requests"]:
            for k, v in q["req_headers"]:
                if k not in SKIP_HEADERS:
                    seen[(k, v)] += 1
    hset[p] = seen
keys = sorted({k for p in progs for k, _ in hset[p]})
for k in keys:
    va = sorted({v for kk, v in hset["a_plain_openai"] if kk == k})
    vc = sorted({v for kk, v in hset["c_create_agent"] if kk == k})
    if va != vc:
        out.append(f"  {k}: a_plain_openai {va or 'absent'} | c_create_agent {vc or 'absent'}")
OUT.write_text("\n".join(out) + "\n")
print("\n".join(out))
