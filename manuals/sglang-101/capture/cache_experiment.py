import json
import sys
import time
import uuid
import urllib.request

URL = "http://127.0.0.1:30000/v1/chat/completions"
SYSTEM = " ".join(f"Rule {i}: answer in plain words and cite the policy section {i}." for i in range(160))


def ask(system, question):
    body = json.dumps({
        "model": "default",
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": question}],
        "max_tokens": 16,
        "temperature": 0,
        "stream": True,
        "stream_options": {"include_usage": True},
    }).encode()
    request = urllib.request.Request(URL, body, {"Content-Type": "application/json"})
    start = time.perf_counter()
    ttft = None
    usage = None
    with urllib.request.urlopen(request, timeout=300) as response:
        for raw in response:
            line = raw.decode().strip()
            if not line.startswith("data: ") or line == "data: [DONE]":
                continue
            chunk = json.loads(line[6:])
            if chunk.get("choices") and chunk["choices"][0]["delta"].get("content") and ttft is None:
                ttft = time.perf_counter() - start
            if chunk.get("usage"):
                usage = chunk["usage"]
    return ttft, usage


def run(case, round_number, system):
    ttft, usage = ask(system, "What is rule 7?")
    cached = (usage.get("prompt_tokens_details") or {}).get("cached_tokens")
    row = {"case": case, "round": round_number, "ttft_ms": round(ttft * 1000, 1), "prompt_tokens": usage["prompt_tokens"], "cached_tokens": cached}
    print(json.dumps(row), flush=True)
    return row


def median(values):
    ordered = sorted(values)
    middle = len(ordered) // 2
    return ordered[middle] if len(ordered) % 2 else (ordered[middle - 1] + ordered[middle]) / 2


if __name__ == "__main__":
    rounds = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    ask("You are a warm-up.", "Say hi.")
    ask(f"Warm-up {uuid.uuid4().hex}. " + SYSTEM[:4000], "Say hi.")
    cases = {
        "stable-system-prompt": lambda: SYSTEM,
        "id-at-start": lambda: f"Request id {uuid.uuid4().hex}. " + SYSTEM,
        "id-at-end": lambda: SYSTEM + f" Request id {uuid.uuid4().hex}.",
    }
    rows = [run(case, i + 1, make()) for case, make in cases.items() for i in range(rounds)]
    for case in cases:
        picked = [r for r in rows if r["case"] == case]
        steady = picked[1:] if case == "stable-system-prompt" else picked
        print(json.dumps({"summary": case, "median_ttft_ms": median([r["ttft_ms"] for r in steady]), "min_ttft_ms": min(r["ttft_ms"] for r in steady), "max_ttft_ms": max(r["ttft_ms"] for r in steady), "median_cached_tokens": median([r["cached_tokens"] or 0 for r in steady]), "prompt_tokens": steady[0]["prompt_tokens"]}))
