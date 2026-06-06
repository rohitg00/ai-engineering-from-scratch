"""Phase 13 Lesson 03 - parallel and streaming tool calls.

Two demos, stdlib only:
  1. Three-city weather run, sequential vs parallel (thread pool).
     Measures wall-clock and shows the max vs sum pattern.
  2. Stream accumulator for out-of-order argument chunks.
     Replays a fake OpenAI-shaped stream of three interleaved parallel calls
     and reassembles each per-id before executing.

Run: python code/main.py
"""

from __future__ import annotations

import json
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field


# ------------------------------------------------------------------
# demo 1: sequential vs parallel weather lookup
# ------------------------------------------------------------------

SIMULATED_LATENCY_MS = {"Bengaluru": 400, "Tokyo": 600, "Zurich": 800}


def executor_weather(city: str) -> dict:
    latency = SIMULATED_LATENCY_MS.get(city, 500)
    time.sleep(latency / 1000.0)
    return {"city": city, "temp_c": hash(city) % 35}


def run_sequential(cities: list[str]) -> tuple[float, list[dict]]:
    start = time.perf_counter()
    results = [executor_weather(c) for c in cities]
    dt_ms = (time.perf_counter() - start) * 1000
    return dt_ms, results


def run_parallel(cities: list[str]) -> tuple[float, list[dict]]:
    start = time.perf_counter()
    with ThreadPoolExecutor(max_workers=len(cities)) as pool:
        results = list(pool.map(executor_weather, cities))
    dt_ms = (time.perf_counter() - start) * 1000
    return dt_ms, results


# ------------------------------------------------------------------
# demo 2: stream accumulator
# ------------------------------------------------------------------

@dataclass
class CallBuffer:
    id: str
    name: str = ""
    args_buf: str = ""
    done: bool = False

    def try_parse(self) -> dict | None:
        if not self.done:
            return None
        return json.loads(self.args_buf)


@dataclass
class StreamAccumulator:
    buffers: dict[str, CallBuffer] = field(default_factory=dict)

    def on_event(self, event: dict) -> list[CallBuffer]:
        kind = event["type"]
        idx = event.get("id")
        completed: list[CallBuffer] = []
        if kind == "call_start":
            self.buffers[idx] = CallBuffer(id=idx, name=event["name"])
        elif kind == "args_delta":
            buf = self.buffers[idx]
            buf.args_buf += event["chunk"]
        elif kind == "call_stop":
            buf = self.buffers[idx]
            buf.done = True
            completed.append(buf)
        return completed


def fake_openai_stream():
    """Three interleaved parallel calls. Real streams look like this."""
    yield {"type": "call_start", "id": "call_A", "name": "get_weather"}
    yield {"type": "call_start", "id": "call_B", "name": "get_weather"}
    yield {"type": "call_start", "id": "call_C", "name": "get_weather"}
    yield {"type": "args_delta", "id": "call_A", "chunk": '{"city"'}
    yield {"type": "args_delta", "id": "call_B", "chunk": '{"city'}
    yield {"type": "args_delta", "id": "call_A", "chunk": ':"Beng'}
    yield {"type": "args_delta", "id": "call_C", "chunk": '{"city":"Zu'}
    yield {"type": "args_delta", "id": "call_A", "chunk": 'aluru"}'}
    yield {"type": "call_stop", "id": "call_A"}
    yield {"type": "args_delta", "id": "call_B", "chunk": '":"Tokyo"}'}
    yield {"type": "call_stop", "id": "call_B"}
    yield {"type": "args_delta", "id": "call_C", "chunk": 'rich"}'}
    yield {"type": "call_stop", "id": "call_C"}


def replay_and_execute() -> dict[str, dict]:
    acc = StreamAccumulator()
    results: dict[str, dict] = {}
    in_flight: dict[str, "Future"] = {}  # type: ignore
    with ThreadPoolExecutor(max_workers=4) as pool:
        for event in fake_openai_stream():
            completed = acc.on_event(event)
            for buf in completed:
                args = buf.try_parse()
                print(f"  call {buf.id} args complete -> {args}")
                in_flight[buf.id] = pool.submit(executor_weather, args["city"])
        for cid, fut in in_flight.items():
            results[cid] = fut.result()
    return results


# ------------------------------------------------------------------
# main
# ------------------------------------------------------------------

def main() -> None:
    print("=" * 72)
    print("PHASE 13 LESSON 03 - PARALLEL AND STREAMING TOOL CALLS")
    print("=" * 72)

    cities = ["Bengaluru", "Tokyo", "Zurich"]
    sum_lat = sum(SIMULATED_LATENCY_MS.values())
    max_lat = max(SIMULATED_LATENCY_MS.values())

    print("\n--- demo 1: three-city weather (simulated) ---")
    print(f"per-city simulated latency : {SIMULATED_LATENCY_MS}")
    print(f"theoretical sequential     : {sum_lat} ms  (sum)")
    print(f"theoretical parallel       : {max_lat} ms  (max)")

    seq_ms, seq_res = run_sequential(cities)
    par_ms, par_res = run_parallel(cities)
    print(f"\nactual sequential : {seq_ms:.0f} ms")
    print(f"actual parallel   : {par_ms:.0f} ms")
    speedup = seq_ms / par_ms if par_ms else 0
    print(f"speedup           : {speedup:.2f}x")

    print("\n--- demo 2: stream accumulator ---")
    print("replaying fake interleaved stream of three parallel calls ...")
    results = replay_and_execute()
    print("\nfinal results (keyed by tool_call_id):")
    for cid, r in results.items():
        print(f"  {cid} -> {r}")


if __name__ == "__main__":
    main()
