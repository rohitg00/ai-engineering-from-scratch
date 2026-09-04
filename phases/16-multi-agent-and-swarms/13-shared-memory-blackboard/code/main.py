"""Shared memory patterns: MessagePool, Blackboard, and a poisoning demo.

Runs a three-agent research task twice. The first run has a hallucinated
decimal that propagates through shared memory into the final report. The
second run adds a read-only verifier that re-fetches the source and flags
the inconsistency.
"""
from __future__ import annotations

import hashlib
import threading
import time
from dataclasses import dataclass, field
from typing import Callable


@dataclass
class ProvenanceEntry:
    id: int
    writer: str
    topic: str
    content: str
    timestamp: float
    prompt_hash: str
    source_uri: str | None = None
    supersedes: int | None = None
    flags: list[str] = field(default_factory=list)


class MessagePool:
    """Append-only full-pool shared state."""

    def __init__(self) -> None:
        self.entries: list[ProvenanceEntry] = []
        self._lock = threading.Lock()
        self._next_id = 0

    def write(self, writer: str, content: str, prompt: str, source_uri: str | None = None,
              topic: str = "default", supersedes: int | None = None) -> int:
        with self._lock:
            eid = self._next_id
            self._next_id += 1
            e = ProvenanceEntry(
                id=eid,
                writer=writer,
                topic=topic,
                content=content,
                timestamp=time.time(),
                prompt_hash=hashlib.sha256(prompt.encode()).hexdigest()[:10],
                source_uri=source_uri,
                supersedes=supersedes,
            )
            self.entries.append(e)
            return eid

    def read_all(self) -> list[ProvenanceEntry]:
        with self._lock:
            return list(self.entries)

    def flag(self, entry_id: int, flag: str) -> None:
        with self._lock:
            for e in self.entries:
                if e.id == entry_id:
                    e.flags.append(flag)
                    return


class Blackboard:
    """Topic-keyed pub/sub blackboard."""

    def __init__(self) -> None:
        self.topics: dict[str, list[ProvenanceEntry]] = {}
        self.subscribers: dict[str, list[Callable[[ProvenanceEntry], None]]] = {}
        self._lock = threading.Lock()
        self._next_id = 0

    def publish(self, writer: str, topic: str, content: str, prompt: str,
                source_uri: str | None = None) -> int:
        with self._lock:
            eid = self._next_id
            self._next_id += 1
            e = ProvenanceEntry(
                id=eid,
                writer=writer,
                topic=topic,
                content=content,
                timestamp=time.time(),
                prompt_hash=hashlib.sha256(prompt.encode()).hexdigest()[:10],
                source_uri=source_uri,
            )
            self.topics.setdefault(topic, []).append(e)
            subs = list(self.subscribers.get(topic, []))
        for cb in subs:
            cb(e)
        return eid

    def subscribe(self, topic: str, cb: Callable[[ProvenanceEntry], None]) -> None:
        with self._lock:
            self.subscribers.setdefault(topic, []).append(cb)

    def read_topic(self, topic: str) -> list[ProvenanceEntry]:
        with self._lock:
            return list(self.topics.get(topic, []))


FAKE_SOURCES = {
    "https://arxiv.org/paper-1": "The study reports a 4.2% accuracy improvement over the baseline.",
    "https://arxiv.org/paper-2": "Dataset size was 12,500 examples.",
}


def retrieval_agent(pool: MessagePool, uri: str, hallucinate: bool) -> int:
    content = FAKE_SOURCES[uri]
    if hallucinate and "4.2%" in content:
        content = content.replace("4.2%", "42%")
    return pool.write(
        writer="retriever",
        content=content,
        prompt=f"Fetch and summarize {uri}",
        source_uri=uri,
    )


def summarizer_agent(pool: MessagePool) -> int:
    retrieved = [e for e in pool.read_all() if e.writer == "retriever"]
    if not retrieved:
        return pool.write("summarizer", "no source", "Summarize retrieval", None)
    latest = retrieved[-1].content
    summary = f"Summary: study reports a significant result -- {latest.split('.')[0]}."
    return pool.write("summarizer", summary, "Summarize retrieval", None)


def analyst_agent(pool: MessagePool) -> int:
    summaries = [e for e in pool.read_all() if e.writer == "summarizer"]
    if not summaries:
        return pool.write("analyst", "no summary", "Draw conclusions", None)
    latest = summaries[-1].content
    verdict = "Recommend adoption" if "42%" in latest else "Recommend further review"
    return pool.write("analyst", f"Analyst verdict: {verdict} (based on: {latest})",
                      "Draw conclusions", None)


def verifier_agent(pool: MessagePool) -> list[tuple[int, str]]:
    """Read-only agent. Re-fetches cited sources and flags inconsistencies.

    Returns a list of (entry_id, reason) tuples for the caller to act on.
    The verifier never writes back to the pool -- the caller decides what to do.
    """
    findings = []
    for e in pool.read_all():
        if e.source_uri and e.source_uri in FAKE_SOURCES:
            truth = FAKE_SOURCES[e.source_uri]
            if e.content != truth:
                findings.append((e.id, f"mismatch with {e.source_uri}: fetched text was {truth!r}"))
    return findings


def run_without_verifier() -> None:
    print("=" * 72)
    print("RUN 1 — no verifier; hallucination propagates")
    print("=" * 72)
    pool = MessagePool()
    retrieval_agent(pool, "https://arxiv.org/paper-1", hallucinate=True)
    summarizer_agent(pool)
    analyst_agent(pool)
    for e in pool.read_all():
        print(f"  [{e.id}] {e.writer:11s} ({e.prompt_hash}) :: {e.content}")
    print("\nfinal report uses hallucinated 42% figure; no alarm raised.")


def run_with_verifier() -> None:
    print("\n" + "=" * 72)
    print("RUN 2 — read-only verifier re-fetches sources and flags")
    print("=" * 72)
    pool = MessagePool()
    retrieval_agent(pool, "https://arxiv.org/paper-1", hallucinate=True)
    summarizer_agent(pool)
    findings = verifier_agent(pool)
    for eid, reason in findings:
        pool.flag(eid, reason)
    analyst_agent(pool)

    for e in pool.read_all():
        flag_str = f" [FLAGGED: {'; '.join(e.flags)}]" if e.flags else ""
        print(f"  [{e.id}] {e.writer:11s} ({e.prompt_hash}) :: {e.content}{flag_str}")
    if findings:
        print(f"\nverifier surfaced {len(findings)} inconsistency. downstream agents can suppress the verdict.")


def demo_blackboard() -> None:
    print("\n" + "=" * 72)
    print("BLACKBOARD DEMO — topic-keyed pub/sub, not every agent reads everything")
    print("=" * 72)
    bb = Blackboard()
    received = {"prices": [], "alerts": []}

    def on_prices(e: ProvenanceEntry) -> None:
        received["prices"].append(e.id)

    def on_alerts(e: ProvenanceEntry) -> None:
        received["alerts"].append(e.id)

    bb.subscribe("prices", on_prices)
    bb.subscribe("alerts", on_alerts)

    bb.publish("scraper-1", "prices", "AAPL=192.4", "poll market")
    bb.publish("scraper-2", "prices", "MSFT=401.2", "poll market")
    bb.publish("risk-engine", "alerts", "ALERT: AAPL moved >2% in 60s", "watch prices")

    print(f"  price subscribers got ids: {received['prices']}")
    print(f"  alert subscribers got ids: {received['alerts']}")
    print("  (note: price subscribers never saw the alert; that is the point)")


def main() -> None:
    run_without_verifier()
    run_with_verifier()
    demo_blackboard()
    print("\nTakeaways:")
    print("  1. shared state without provenance launders hallucinations into downstream reasoning")
    print("  2. a read-only verifier with independent source access catches memory poisoning")
    print("  3. a blackboard scales past a full pool because agents only read what they subscribe to")


if __name__ == "__main__":
    main()
