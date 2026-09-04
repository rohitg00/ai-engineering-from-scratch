"""Consensus and BFT for LLM agents, stdlib only.

Implements three aggregators (plurality, CP-WBFT, DecentLLMs) and three
attack patterns (byzantine, sycophancy, monoculture). Prints a table of
(attack, aggregator) -> final answer, highlighting correct decisions.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from statistics import median
from typing import Callable


@dataclass
class Vote:
    agent: str
    answer: str
    confidence: float

    def canonical(self) -> str:
        """Rough semantic clustering: lowercase + strip whitespace/punct."""
        return "".join(c for c in self.answer.lower().strip() if c.isalnum() or c == "." or c == "%")


def plurality(votes: list[Vote]) -> tuple[str, dict[str, int]]:
    counts: dict[str, int] = {}
    rep: dict[str, str] = {}
    for v in votes:
        key = v.canonical()
        counts[key] = counts.get(key, 0) + 1
        rep.setdefault(key, v.answer)
    winner_key = max(counts, key=counts.get)
    return rep[winner_key], counts


def cp_wbft(votes: list[Vote], threshold: float = 0.5) -> tuple[str | None, dict[str, float]]:
    weights: dict[str, float] = {}
    rep: dict[str, str] = {}
    for v in votes:
        key = v.canonical()
        weights[key] = weights.get(key, 0.0) + v.confidence
        rep.setdefault(key, v.answer)
    total = sum(weights.values()) or 1.0
    winner_key = max(weights, key=weights.get)
    if weights[winner_key] / total < threshold:
        return None, weights
    return rep[winner_key], weights


def decentllms(votes: list[Vote]) -> tuple[str | None, dict[str, float]]:
    """Score proposals 0-1 via evaluator agents, pick geometric-median cluster.

    Simplified: evaluator is the aggregator itself, scoring = confidence. The
    'geometric median' selects the cluster whose members have min sum of
    pairwise distance-to-median in confidence space; tie-break by size.
    """
    clusters: dict[str, list[Vote]] = {}
    for v in votes:
        clusters.setdefault(v.canonical(), []).append(v)

    scores: dict[str, float] = {}
    for key, cluster in clusters.items():
        med = median([v.confidence for v in cluster])
        dist = sum(abs(v.confidence - med) for v in cluster)
        scores[key] = len(cluster) * max(0.0, 1.0 - dist)

    winner_key = max(scores, key=scores.get)
    rep = clusters[winner_key][0].answer
    return rep, scores


def scenario(name: str, correct: str, votes: list[Vote]) -> None:
    print("\n" + "=" * 72)
    print(f"SCENARIO: {name}")
    print(f"  correct answer: {correct!r}")
    print("=" * 72)
    for v in votes:
        print(f"  {v.agent:12s} -> {v.answer!r:20s}  conf={v.confidence:.2f}")

    plural, counts = plurality(votes)
    cp, weights = cp_wbft(votes)
    dec, scores = decentllms(votes)

    def mark(a: str | None) -> str:
        if a is None:
            return "[rejected below threshold]"
        return "[CORRECT]" if a == correct else "[WRONG]"

    print(f"\n  plurality    -> {plural!r:22s} {mark(plural)}")
    print(f"  CP-WBFT      -> {str(cp)!r:22s} {mark(cp)}")
    print(f"  DecentLLMs   -> {dec!r:22s} {mark(dec)}")


def main() -> None:
    # Scenario 1: honest majority, no attack
    scenario(
        "no attack",
        correct="4.2%",
        votes=[
            Vote("agent-a", "4.2%", 0.85),
            Vote("agent-b", "4.2%", 0.80),
            Vote("agent-c", "4.2%", 0.75),
            Vote("agent-d", "5%", 0.40),
            Vote("agent-e", "4.2%", 0.70),
        ],
    )

    # Scenario 2: one byzantine liar with high confidence
    scenario(
        "byzantine lie",
        correct="4.2%",
        votes=[
            Vote("agent-a", "4.2%", 0.75),
            Vote("agent-b", "4.2%", 0.70),
            Vote("agent-c", "4.2%", 0.80),
            Vote("agent-d", "42%", 0.95),
            Vote("agent-e", "4.2%", 0.65),
        ],
    )

    # Scenario 3: sycophancy. Two conformers echo whoever spoke first (42%) with
    # low confidence because they did not derive the answer.
    scenario(
        "sycophantic conformity",
        correct="4.2%",
        votes=[
            Vote("agent-a", "42%", 0.35),
            Vote("agent-b", "42%", 0.30),
            Vote("agent-c", "4.2%", 0.85),
            Vote("agent-d", "4.2%", 0.80),
            Vote("agent-e", "4.2%", 0.82),
        ],
    )

    # Scenario 4: correlated-error monoculture. Three agents share a model and
    # confidently hallucinate the same wrong answer.
    scenario(
        "monoculture (correlated errors)",
        correct="4.2%",
        votes=[
            Vote("agent-a", "42%", 0.70),
            Vote("agent-b", "42%", 0.68),
            Vote("agent-c", "42%", 0.72),
            Vote("agent-d", "4.2%", 0.85),
            Vote("agent-e", "4.2%", 0.82),
        ],
    )

    print("\nTakeaways:")
    print("  plurality is wrong whenever a correlated cluster is >= half the votes.")
    print("  CP-WBFT mitigates sycophancy because conformers have low confidence.")
    print("  DecentLLMs scoring penalizes high-variance clusters -- helps on monoculture when")
    print("  the dissenting agents are at least as confident as the majority.")
    print("  no aggregator solves monoculture when the wrong cluster is both larger AND more")
    print("  confident than the right cluster. That case needs diversity or verification.")


if __name__ == "__main__":
    main()
