import json
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

URL = "http://127.0.0.1:30000/generate"
PROMPT = "Write a short paragraph that explains why a cache that stores the key and value tensors of earlier tokens makes text generation faster."
FILLERS = [f"List {n} facts about the number {n * 7}, one per line, with a short reason for each." for n in range(3, 18)]


def generate(text, max_new_tokens):
    body = json.dumps({"text": text, "sampling_params": {"max_new_tokens": max_new_tokens, "temperature": 0}}).encode()
    request = urllib.request.Request(URL, body, {"Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=300) as response:
        return json.loads(response.read())["text"]


def in_batch():
    with ThreadPoolExecutor(max_workers=len(FILLERS) + 1) as pool:
        target = pool.submit(generate, PROMPT, 128)
        for filler in FILLERS:
            pool.submit(generate, filler, 256)
        return target.result()


if __name__ == "__main__":
    rounds = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    alone = [generate(PROMPT, 128) for _ in range(rounds)]
    batched = [in_batch() for _ in range(rounds)]
    for index, text in enumerate(alone):
        print(json.dumps({"mode": "alone", "round": index + 1, "text": text}))
    for index, text in enumerate(batched):
        print(json.dumps({"mode": "in-batch-of-16", "round": index + 1, "text": text, "same_as_alone": text == alone[0]}))
    print(json.dumps({
        "summary": True,
        "distinct_alone": len(set(alone)),
        "distinct_in_batch": len(set(batched)),
        "in_batch_matching_alone": sum(text == alone[0] for text in batched),
        "rounds": rounds,
    }))
