"""Supervisor / Orchestrator-Worker pattern (Anthropic Research style).

Lead agent decomposes a query, spawns workers in parallel threads, synthesizes.
No real LLM calls -- workers are scripted fetch-and-summarize simulations.

The point is the wall-clock win from parallel subagents, plus the pattern.
"""
from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field


@dataclass
class WorkerResult:
    sub_question: str
    summary: str
    tokens_spent: int
    wall_time: float


@dataclass
class TraceEntry:
    worker_id: int
    event: str
    t: float
    sub_question: str = ""


@dataclass
class Trace:
    entries: list[TraceEntry] = field(default_factory=list)
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def log(self, worker_id: int, event: str, sub_question: str = "") -> None:
        with self._lock:
            self.entries.append(
                TraceEntry(worker_id=worker_id, event=event, t=time.time(), sub_question=sub_question)
            )


def fake_web_fetch(query: str) -> str:
    """Simulate web fetch + summarization latency."""
    time.sleep(0.3)
    return f"Summary for '{query}': 3 key findings from 5 sources."


class Worker:
    def __init__(self, worker_id: int, trace: Trace) -> None:
        self.worker_id = worker_id
        self.trace = trace

    def run(self, sub_question: str, results: list[WorkerResult | None], idx: int) -> None:
        start = time.time()
        self.trace.log(self.worker_id, "start", sub_question)
        summary = fake_web_fetch(sub_question)
        elapsed = time.time() - start
        results[idx] = WorkerResult(
            sub_question=sub_question,
            summary=summary,
            tokens_spent=800,
            wall_time=elapsed,
        )
        self.trace.log(self.worker_id, "done", sub_question)


class Lead:
    """Supervisor. Plans, spawns workers in parallel, synthesizes."""

    def __init__(self, trace: Trace) -> None:
        self.trace = trace

    def plan(self, query: str) -> list[str]:
        """Decompose. Real lead uses an LLM; this splits by heuristic."""
        return [
            f"{query} -- historical origins",
            f"{query} -- state of the art 2026",
            f"{query} -- open problems",
        ]

    def synthesize(self, query: str, results: list[WorkerResult]) -> str:
        ok = [r for r in results if r is not None]
        parts = [f"- {r.sub_question}: {r.summary}" for r in ok]
        return f"Answer to '{query}':\n" + "\n".join(parts)

    def run(self, query: str) -> tuple[str, dict]:
        t0 = time.time()
        sub_questions = self.plan(query)
        self.trace.log(worker_id=-1, event="plan", sub_question=str(len(sub_questions)))

        results: list[WorkerResult | None] = [None] * len(sub_questions)
        threads: list[threading.Thread] = []
        for i, sq in enumerate(sub_questions):
            w = Worker(worker_id=i, trace=self.trace)
            th = threading.Thread(target=w.run, args=(sq, results, i))
            threads.append(th)
            th.start()

        for th in threads:
            th.join()

        self.trace.log(worker_id=-1, event="synthesize")
        synthesis = self.synthesize(query, [r for r in results if r is not None])
        total_wall = time.time() - t0
        total_tokens = sum((r.tokens_spent for r in results if r is not None)) + 1200
        return synthesis, {
            "wall_clock_seconds": round(total_wall, 3),
            "total_tokens": total_tokens,
            "worker_count": len(sub_questions),
        }


def render_trace(trace: Trace, t0: float) -> None:
    for e in trace.entries:
        rel = round(e.t - t0, 3)
        sq = f" | {e.sub_question}" if e.sub_question else ""
        tag = "LEAD" if e.worker_id == -1 else f"W{e.worker_id}"
        print(f"  +{rel:>5}s  {tag:>4}  {e.event}{sq}")


def main() -> None:
    print("Supervisor / Orchestrator-Worker demo")
    print("-" * 42)

    trace = Trace()
    t0 = time.time()
    lead = Lead(trace=trace)
    answer, stats = lead.run("What changed in multi-agent systems 2023 to 2026?")

    print("\nTrace (+seconds relative to plan start):")
    render_trace(trace, t0)

    print("\nFinal synthesis:")
    print("  " + answer.replace("\n", "\n  "))

    print("\nStats:")
    for k, v in stats.items():
        print(f"  {k}: {v}")

    print("\nSequential baseline would be ~0.9s (3 * 0.3s).")
    print("Parallel actual is ~0.35s. That's the supervisor win.")


if __name__ == "__main__":
    main()
