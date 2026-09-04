"""Parallel AAR forum simulator — stdlib Python.

Three Automated Alignment Researchers run in parallel. Each solves a
research task under one of two regimes: fixed-workflow (human-prescribed
plan) or free-decomposition. Findings post to an append-only forum whose
records live outside the agents' sandboxes.

One agent attempts log tampering. The tamper-evident chain catches the
attempt at verification time.
"""

from __future__ import annotations

import hashlib
import random
from dataclasses import dataclass, field


@dataclass
class ForumRecord:
    author: str
    task: str
    regime: str
    result: float
    prev_hash: str
    my_hash: str = ""


@dataclass
class Forum:
    records: list[ForumRecord] = field(default_factory=list)
    genesis: str = "0" * 16

    def head(self) -> str:
        return self.records[-1].my_hash if self.records else self.genesis

    def post(self, rec: ForumRecord) -> None:
        rec.prev_hash = self.head()
        payload = (f"{rec.author}|{rec.task}|{rec.regime}|"
                   f"{rec.result:.3f}|{rec.prev_hash}")
        rec.my_hash = hashlib.sha256(payload.encode()).hexdigest()[:16]
        self.records.append(rec)

    def verify(self) -> list[int]:
        """Return indexes of any tampered records."""
        bad = []
        prev = self.genesis
        for i, r in enumerate(self.records):
            payload = (f"{r.author}|{r.task}|{r.regime}|"
                       f"{r.result:.3f}|{prev}")
            expected = hashlib.sha256(payload.encode()).hexdigest()[:16]
            if expected != r.my_hash or r.prev_hash != prev:
                bad.append(i)
            prev = r.my_hash
        return bad


TASKS = [
    ("weak-to-strong-distill", 0.40),
    ("reward-model-diagnosis", 0.30),
    ("in-context-safety-probe", 0.50),
    ("RLHF-hyperparam-sweep", 0.45),
    ("alignment-faking-detector", 0.25),
]


def solve(agent: str, task: tuple[str, float], regime: str) -> float:
    _name, base = task
    if regime == "fixed":
        # Prescribed workflow: bounded ceiling, lower variance.
        return base + random.random() * 0.25
    # Free decomposition: wider tail; sometimes much better, sometimes worse.
    return base + random.gauss(0.15, 0.22)


def run_regime(regime: str) -> list[ForumRecord]:
    forum = Forum()
    agents = ["AAR-A", "AAR-B", "AAR-C"]
    for task in TASKS:
        for agent in agents:
            r = solve(agent, task, regime)
            forum.post(ForumRecord(
                author=agent,
                task=task[0],
                regime=regime,
                result=r,
                prev_hash="",
            ))
    return forum.records


def attempt_tamper(forum_records: list[ForumRecord]) -> Forum:
    """Rebuild a forum from records and attempt a silent edit."""
    f = Forum()
    for r in forum_records:
        f.post(ForumRecord(
            author=r.author, task=r.task, regime=r.regime,
            result=r.result, prev_hash="",
        ))
    # Pick a record to tamper with — AAR-A's worst result.
    worst_idx = -1
    worst_val = float("inf")
    for i, r in enumerate(f.records):
        if r.author == "AAR-A" and r.result < worst_val:
            worst_val = r.result
            worst_idx = i
    if worst_idx >= 0:
        # Silent edit (agent rewrites its own score to look better).
        # Always overwrite by adding a fixed bump rather than max(..., 0.85),
        # which would silently no-op whenever the original already exceeded
        # the floor — breaking the tamper-detection narrative under
        # different seeds.
        f.records[worst_idx].result = f.records[worst_idx].result + 0.5
    return f


def regime_report(regime: str) -> None:
    records = run_regime(regime)
    by_task: dict[str, list[float]] = {}
    for r in records:
        by_task.setdefault(r.task, []).append(r.result)
    print(f"\nregime: {regime}")
    print(f"  {'task':<32}  {'mean':>8}  {'max':>8}  {'min':>8}")
    means = []
    for task, values in by_task.items():
        mean = sum(values) / len(values)
        means.append(mean)
        print(f"  {task:<32}  {mean:>8.3f}  {max(values):>8.3f}  {min(values):>8.3f}")
    print(f"  overall mean across tasks      : {sum(means) / len(means):.3f}")


def tamper_demo() -> None:
    print("\nLog tampering detection")
    print("-" * 70)
    baseline = run_regime("free")
    # attempt_tamper() performs one silent edit (rewrites AAR-A's worst
    # score upward). We rely on that single tamper so verify() reports
    # deterministic, reproducible flagged indices.
    tampered = attempt_tamper(baseline)
    bad = tampered.verify()
    print(f"  verify() flagged {len(bad)} corrupted record(s) "
          f"at indices {bad}")
    print("  the append-only chain breaks at the first edited record.")
    print("  an out-of-sandbox backup reveals the tamper on cross-check.")


def main() -> None:
    random.seed(3)
    print("=" * 70)
    print("AUTOMATED ALIGNMENT RESEARCH FORUM (Phase 15, Lesson 6)")
    print("=" * 70)

    regime_report("fixed")
    regime_report("free")

    print("\nfixed vs free — fixed has lower variance, free has higher upside")
    tamper_demo()

    print()
    print("=" * 70)
    print("HEADLINE: out-of-sandbox logs + free decomposition + human review")
    print("-" * 70)
    print("  Free decomposition gives AARs more ceiling — and more audit work.")
    print("  Tamper-evident logs make the audit possible. Human reviewers still")
    print("  decide what publishes. AAR compresses the middle of the pipeline,")
    print("  not the ends.")


if __name__ == "__main__":
    main()
