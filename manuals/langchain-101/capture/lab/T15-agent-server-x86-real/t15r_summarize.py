import json

def d(x):
    return None if x is None else {k: x[k] for k in ("n", "p50", "p99", "min", "max") if k in x}

for f in ["01-recursion.jsonl", "03-floor.jsonl", "04-workers.jsonl", "02-load.jsonl"]:
    print("==", f)
    for l in open(f):
        r = json.loads(l)
        r.pop("rows", None)
        out = {}
        for k, v in r.items():
            if k in ("exp", "error_examples", "run_end_offsets_s"):
                continue
            if k == "result":
                v = v[:90]
            out[k] = d(v) if isinstance(v, dict) and "p50" in v else v
        print(json.dumps(out))
