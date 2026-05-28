"""LLM agents の Consensus と BFT。stdlib のみ。

3つの aggregator (plurality, CP-WBFT, DecentLLMs) と3つの
attack pattern (byzantine, sycophancy, monoculture) を実装する。
(attack, aggregator) -> final answer の table を表示し、correct decision を強調する。
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
        """rough semantic clustering: lowercase + whitespace/punct 削除。"""
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
    """evaluator agents で proposal を 0-1 score し、geometric-median cluster を選ぶ。

    簡略化: evaluator は aggregator 自身で、scoring = confidence。
    'geometric median' は confidence space で pairwise distance-to-median の和が
    最小の member を持つ cluster を選ぶ。同点なら size で決める。
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
            return "[threshold 未満で rejected]"
        return "[CORRECT]" if a == correct else "[WRONG]"

    print(f"\n  plurality    -> {plural!r:22s} {mark(plural)}")
    print(f"  CP-WBFT      -> {str(cp)!r:22s} {mark(cp)}")
    print(f"  DecentLLMs   -> {dec!r:22s} {mark(dec)}")


def main() -> None:
    # Scenario 1: honest majority、attack なし
    scenario(
        "attack なし",
        correct="4.2%",
        votes=[
            Vote("agent-a", "4.2%", 0.85),
            Vote("agent-b", "4.2%", 0.80),
            Vote("agent-c", "4.2%", 0.75),
            Vote("agent-d", "5%", 0.40),
            Vote("agent-e", "4.2%", 0.70),
        ],
    )

    # Scenario 2: 高 confidence の byzantine liar が1つ
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

    # Scenario 3: sycophancy。2つの conformer は、最初に話した agent (42%) を echo する。
    # answer を自分で導いていないため confidence は低い。
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

    # Scenario 4: correlated-error monoculture。3つの agent が model を共有し、
    # 同じ wrong answer を confidence 高めに hallucinate する。
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
    print("  correlated cluster が vote の半分以上なら plurality は間違う。")
    print("  CP-WBFT は conformer の confidence が低いため sycophancy を緩和する。")
    print("  DecentLLMs scoring は high-variance cluster に penalty を与える。")
    print("  dissenting agents が majority 以上に confident なら monoculture に効く。")
    print("  wrong cluster がより大きく、かつより confident な場合、aggregator だけでは解けない。")
    print("  その case には diversity または verification が必要。")


if __name__ == "__main__":
    main()
