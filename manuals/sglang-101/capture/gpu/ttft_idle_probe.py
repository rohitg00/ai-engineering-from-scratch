import json
import statistics
import threading
import time
import urllib.request

BASE = "http://127.0.0.1:30000"
PROMPT = " ".join(f"word{i}" for i in range(500))


def stream(text, max_new_tokens):
    body = json.dumps({"text": text, "sampling_params": {"max_new_tokens": max_new_tokens, "temperature": 0, "ignore_eos": True}, "stream": True}).encode()
    request = urllib.request.Request(BASE + "/generate", body, {"Content-Type": "application/json"})
    start = time.perf_counter()
    first = None
    with urllib.request.urlopen(request, timeout=600) as response:
        for raw in response:
            if raw.strip().startswith(b"data:") and first is None:
                first = time.perf_counter() - start
    return round(first * 1000, 1)


def case(name, rounds, gap, background=False):
    stop = threading.Event()
    worker = None
    if background:
        def keep_busy():
            while not stop.is_set():
                stream("Count slowly from one to one thousand.", 2048)
        worker = threading.Thread(target=keep_busy, daemon=True)
        worker.start()
        time.sleep(3)
    values = []
    for index in range(rounds):
        time.sleep(gap)
        values.append(stream(f"{name} {index} {PROMPT}", 8))
    stop.set()
    print(json.dumps({"case": name, "gap_s": gap, "background_decode": background, "ttft_ms": values, "median_ttft_ms": statistics.median(values)}), flush=True)
    if worker:
        worker.join(timeout=600)


if __name__ == "__main__":
    stream("warm up", 8)
    case("back-to-back", 10, 0.0)
    case("two-second-gap", 10, 2.0)
    case("ten-second-gap", 5, 10.0)
    case("while-another-request-decodes", 10, 0.5, background=True)
