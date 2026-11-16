import json
import statistics
import sys
from collections import defaultdict
from pathlib import Path

PRICES = json.loads(Path("cost/prices.json").read_text())
LEDGER = Path("~/.cache/aiefs-manuals-wip/langchain-research/bench/cost-ledger.jsonl").expanduser()


def spans_of(path):
    return [json.loads(line) for line in Path(path).read_text().splitlines() if line]


def per_conversation(rep_dir):
    spans = spans_of(rep_dir / "test-spans.jsonl")
    owner = {s["context"]["trace_id"]: s["attributes"]["user.id"] for s in spans if s["name"] == "agent.run"}
    convs = defaultdict(lambda: {"calls": 0, "input": 0, "output": 0, "model_s": 0.0, "summarizer_calls": 0,
                                 "summarizer_input": 0, "summarizer_output": 0, "by_model": defaultdict(int)})
    for span in spans:
        user = owner.get(span["context"]["trace_id"])
        if span["name"] != "model.call" or not user or not user.startswith("e"):
            continue
        if span["status"]["status_code"] == "ERROR":
            continue
        a = span["attributes"]
        c = convs[user]
        c["calls"] += 1
        c["input"] += a.get("gen_ai.usage.input_tokens", 0)
        c["output"] += a.get("gen_ai.usage.output_tokens", 0)
        c["by_model"][a.get("gen_ai.request.model")] += 1
        c["model_s"] += (iso(span["end_time"]) - iso(span["start_time"]))
    usage = rep_dir / "usage.jsonl"
    primary = next(l.split()[2] for l in (rep_dir / "block.txt").read_text().splitlines() if l.startswith("# model "))
    if usage.exists():
        for row in (json.loads(line) for line in usage.read_text().splitlines() if line):
            user = owner.get("0x" + str(row.get("trace_id")))
            if row["model"] != primary:
                continue
            if user and user.startswith("e"):
                c = convs[user]
                c["billed_calls"] = c.get("billed_calls", 0) + 1
                c["billed_input"] = c.get("billed_input", 0) + row["input_tokens"]
                c["billed_output"] = c.get("billed_output", 0) + row["output_tokens"]
                c["billed_by_model"] = {**c.get("billed_by_model", {}), row["model"]: c.get("billed_by_model", {}).get(row["model"], 0) + 1}
            if row.get("span") != "model.call" and user and user.startswith("e"):
                c = convs[user]
                c["summarizer_calls"] += 1
                c["summarizer_input"] += row["input_tokens"]
                c["summarizer_output"] += row["output_tokens"]
    return {u: {**v, "by_model": dict(v["by_model"]), "model_s": round(v["model_s"], 3)} for u, v in sorted(convs.items())}


def iso(text):
    from datetime import datetime
    return datetime.fromisoformat(text.replace("Z", "+00:00")).timestamp()


def stats(values):
    return {"n": len(values), "median": statistics.median(values), "mean": round(statistics.mean(values), 1),
            "max": max(values), "min": min(values)}


def price_table(convs):
    out = {}
    for model, p in PRICES["models"].items():
        if p["input"] == 0:
            continue
        cost = [(c.get("billed_input", c["input"]) * p["input"] + c.get("billed_output", c["output"]) * p["output"]) / 1e6
                for c in convs.values()]
        out[model] = {"in_per_mtok": p["input"], "out_per_mtok": p["output"], "per_conv_mean": round(statistics.mean(cost), 6),
                      "per_1000_conv": round(1000 * statistics.mean(cost), 3), "max_conv": round(max(cost), 6)}
    return out


def main(suite_root, out_path):
    root = Path(suite_root)
    result = {"prices": {k: PRICES[k] for k in ("source", "fetched", "unit")}, "models": {}}
    for model_dir in sorted(p for p in root.iterdir() if p.is_dir()):
        rep = model_dir / "rep-1"
        if not (rep / "test-spans.jsonl").exists():
            continue
        convs = per_conversation(rep)
        entry = {"conversations": convs,
                 "calls": stats([c["calls"] for c in convs.values()]),
                 "input": stats([c["input"] for c in convs.values()]),
                 "output": stats([c["output"] for c in convs.values()]),
                 "summarizer_input_total": sum(c["summarizer_input"] for c in convs.values()),
                 "agent_input_total": sum(c["input"] for c in convs.values()),
                 "model_seconds": stats([c["model_s"] for c in convs.values()]),
                 "billed_input": stats([c.get("billed_input", 0) for c in convs.values()]),
                 "billed_output": stats([c.get("billed_output", 0) for c in convs.values()]),
                 "billed_calls": stats([c.get("billed_calls", 0) for c in convs.values()])}
        if "haiku" in model_dir.name:
            rows = [json.loads(l) for l in LEDGER.read_text().splitlines() if l.strip()]
            mine = [r for r in rows if str(r.get("cell", "")).startswith(f"prodapp|evals|{model_dir.name}")]
            entry["ledger"] = {"calls": len(mine), "input_tokens": sum(r["input_tokens"] for r in mine),
                               "output_tokens": sum(r["output_tokens"] for r in mine),
                               "cost_usd": round(sum(r["cost_usd"] for r in mine), 6)}
            entry["priced"] = price_table(convs)
        result["models"][model_dir.name] = entry
    Path(out_path).write_text(json.dumps(result, indent=1))
    for name, e in result["models"].items():
        print(name, "calls", e["calls"], "input", e["input"], "output", e["output"], "summ", e["summarizer_input_total"])
        if "priced" in e:
            print("  ledger", e["ledger"])
            for m, p in e["priced"].items():
                print("  ", m, p)


if __name__ == "__main__":
    main(*sys.argv[1:])
