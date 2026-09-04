"""Four production runtime shapes: request-response, streaming, queue, event.

Same agent logic, four different outer shells. Stdlib only.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from typing import Any, Callable, Iterable


def _agent_fn(input_text: str) -> list[str]:
    steps = [
        f"parse: {input_text[:40]}",
        f"plan: 3-step plan",
        f"step 1: search",
        f"step 2: read",
        f"final: answered {input_text[:20]}",
    ]
    return steps


def request_response(input_text: str) -> str:
    steps = _agent_fn(input_text)
    return steps[-1]


def streaming(input_text: str) -> Iterable[str]:
    for step in _agent_fn(input_text):
        yield step


@dataclass
class Job:
    jid: str
    payload: str
    attempt: int = 0


@dataclass
class QueueRuntime:
    queue: deque[Job] = field(default_factory=deque)
    dlq: list[Job] = field(default_factory=list)
    fail_rate: int = 0
    counter: int = 0

    def enqueue(self, payload: str) -> str:
        self.counter += 1
        jid = f"j{self.counter:03d}"
        self.queue.append(Job(jid=jid, payload=payload))
        return jid

    def worker(self, fail_policy: Callable[[Job], bool]) -> list[tuple[str, str]]:
        results: list[tuple[str, str]] = []
        while self.queue:
            job = self.queue.popleft()
            job.attempt += 1
            if fail_policy(job) and job.attempt < 3:
                self.queue.append(job)
                results.append((job.jid, "retry"))
                continue
            if fail_policy(job):
                self.dlq.append(job)
                results.append((job.jid, "DLQ"))
                continue
            steps = _agent_fn(job.payload)
            results.append((job.jid, steps[-1]))
        return results


@dataclass
class EventBus:
    subscribers: dict[str, list[Callable[[str], str]]] = field(default_factory=dict)

    def subscribe(self, event_type: str, handler: Callable[[str], str]) -> None:
        self.subscribers.setdefault(event_type, []).append(handler)

    def publish(self, event_type: str, payload: str) -> list[tuple[str, str]]:
        results: list[tuple[str, str]] = []
        for handler in self.subscribers.get(event_type, []):
            results.append((event_type, handler(payload)))
        return results


def main() -> None:
    print("=" * 70)
    print("PRODUCTION RUNTIME SHAPES — Phase 14, Lesson 29")
    print("=" * 70)

    print("\n1. request-response (synchronous)")
    out = request_response("list project files")
    print(f"  result: {out}")

    print("\n2. streaming (generator)")
    for step in streaming("review this PR"):
        print(f"  chunk: {step}")

    print("\n3. queue-based (with retry and DLQ)")
    rt = QueueRuntime()
    rt.enqueue("long job A")
    rt.enqueue("long job B")
    rt.enqueue("long job C")

    def fail_b(job: Job) -> bool:
        return job.payload == "long job B"

    results = rt.worker(fail_policy=fail_b)
    for jid, status in results:
        print(f"  {jid}: {status}")
    print(f"  queue: {len(rt.queue)}   dlq: {len(rt.dlq)}")

    print("\n4. event-driven (subscriber pattern)")
    bus = EventBus()

    def on_pr_opened(payload: str) -> str:
        return f"ran checks on {payload}"

    def on_memory_consolidate(payload: str) -> str:
        return f"consolidated {payload}"

    bus.subscribe("pr.opened", on_pr_opened)
    bus.subscribe("memory.consolidate", on_memory_consolidate)

    for evt, res in bus.publish("pr.opened", "#123 add feature"):
        print(f"  {evt} -> {res}")
    for evt, res in bus.publish("memory.consolidate", "session_001"):
        print(f"  {evt} -> {res}")

    print("\n5. scheduled (cron stand-in)")
    schedule = [
        ("02:00", "memory.consolidate"),
        ("03:00", "eval.nightly"),
    ]
    for when, event in schedule:
        print(f"  {when}: would fire {event}")

    print()
    print("same agent logic, four outer shells. pick by task shape.")
    print("observability (Lesson 23/24) is load-bearing at every shape.")


if __name__ == "__main__":
    main()
