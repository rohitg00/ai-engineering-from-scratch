import json
import statistics
import sys
from collections import defaultdict
from pathlib import Path


def conversations(spans_path, prefix="e"):
    spans = [json.loads(line) for line in Path(spans_path).read_text().splitlines() if line]
    owner = {s["context"]["trace_id"]: s["attributes"]["user.id"] for s in spans if s["name"] == "agent.run"}
    usage = defaultdict(lambda: {"input": 0, "output": 0, "calls": 0})
    for span in spans:
        user = owner.get(span["context"]["trace_id"])
        if span["name"] == "model.call" and user and user.startswith(prefix):
            usage[user]["input"] += span["attributes"].get("gen_ai.usage.input_tokens", 0)
            usage[user]["output"] += span["attributes"].get("gen_ai.usage.output_tokens", 0)
            usage[user]["calls"] += 1
    return dict(sorted(usage.items()))


def main(spans_path, prices_path="cost/prices.json"):
    prices = json.loads(Path(prices_path).read_text())
    usage = conversations(spans_path)
    inputs = [u["input"] for u in usage.values()]
    outputs = [u["output"] for u in usage.values()]
    calls = [u["calls"] for u in usage.values()]
    print(f"conversations n={len(usage)}  model calls per conversation: median {statistics.median(calls)}, "
          f"max {max(calls)}")
    print(f"input tokens per conversation: median {statistics.median(inputs):.0f}, mean {statistics.mean(inputs):.0f}, "
          f"max {max(inputs)}")
    print(f"output tokens per conversation: median {statistics.median(outputs):.0f}, mean {statistics.mean(outputs):.0f}, "
          f"max {max(outputs)}")
    print(f"\nprices: {prices['source']} (fetched {prices['fetched']}), {prices['unit']}\n")
    print("| model | $ in / out per MTok | $ per conversation (mean) | $ per 1,000 conversations | max conversation |")
    print("|---|---|---|---|---|")
    for model, p in prices["models"].items():
        cost = [(u["input"] * p["input"] + u["output"] * p["output"]) / 1e6 for u in usage.values()]
        print(f"| {model} | {p['input']:.2f} / {p['output']:.2f} | {statistics.mean(cost):.5f} | "
              f"{1000 * statistics.mean(cost):.2f} | {max(cost):.5f} |")
    print("\n| conversation | model calls | input tokens | output tokens |")
    print("|---|---|---|---|")
    for user, u in usage.items():
        print(f"| {user} | {u['calls']} | {u['input']} | {u['output']} |")


if __name__ == "__main__":
    main(*sys.argv[1:])
