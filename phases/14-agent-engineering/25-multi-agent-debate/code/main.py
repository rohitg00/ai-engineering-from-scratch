"""Multi-agent debate: full mesh vs sparse (star) topology.

Scripted debaters with different opinion drifts. Measures convergent answer,
rounds to consensus, and total critique ops (as a cost proxy).
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class Debater:
    name: str
    drift: Callable[[str, list[str]], str]


def _make_debater(name: str, bias: str,
                  corrections: dict[str, str]) -> Debater:
    def drift(question: str, peer_answers: list[str]) -> str:
        current = corrections.get(question, bias)
        if peer_answers:
            common = Counter(peer_answers).most_common(1)[0][0]
            if common != current and common != bias:
                return common
        return current
    return Debater(name=name, drift=drift)


def full_mesh_round(debaters: list[Debater], question: str,
                    prior: dict[str, str]) -> tuple[dict[str, str], int]:
    new_answers: dict[str, str] = {}
    ops = 0
    for debater in debaters:
        peers = [prior[d.name] for d in debaters if d.name != debater.name]
        new_answers[debater.name] = debater.drift(question, peers)
        ops += len(peers)
    return new_answers, ops


def sparse_star_round(hub: Debater, spokes: list[Debater], question: str,
                      prior: dict[str, str]) -> tuple[dict[str, str], int]:
    new_answers: dict[str, str] = {}
    ops = 0
    spoke_names = [s.name for s in spokes]
    new_answers[hub.name] = hub.drift(
        question, [prior[n] for n in spoke_names]
    )
    ops += len(spoke_names)
    for spoke in spokes:
        new_answers[spoke.name] = spoke.drift(
            question, [prior[hub.name]]
        )
        ops += 1
    return new_answers, ops


def run_debate(debaters: list[Debater], question: str, rounds: int,
               topology: str) -> tuple[str, int, int]:
    prior: dict[str, str] = {}
    for debater in debaters:
        prior[debater.name] = debater.drift(question, [])

    total_ops = 0
    converged_round = -1
    hub = debaters[0]
    spokes = debaters[1:]
    for r in range(rounds):
        if topology == "full_mesh":
            new, ops = full_mesh_round(debaters, question, prior)
        else:
            new, ops = sparse_star_round(hub, spokes, question, prior)
        total_ops += ops
        if all(v == list(new.values())[0] for v in new.values()) and converged_round == -1:
            converged_round = r + 1
        prior = new

    votes = Counter(prior.values()).most_common(1)[0][0]
    return votes, converged_round, total_ops


def main() -> None:
    print("=" * 70)
    print("MULTI-AGENT DEBATE — Phase 14, Lesson 25")
    print("=" * 70)

    questions_and_truth = {
        "capital_of_portugal": "Lisbon",
        "is_2_plus_2_equal_4": "yes",
        "chess_legal_e4": "legal",
    }

    debaters = [
        _make_debater(
            "alpha", bias="Lisbon",
            corrections={"is_2_plus_2_equal_4": "yes",
                         "chess_legal_e4": "legal"},
        ),
        _make_debater(
            "beta", bias="Madrid",
            corrections={"capital_of_portugal": "Lisbon",
                         "is_2_plus_2_equal_4": "yes",
                         "chess_legal_e4": "legal"},
        ),
        _make_debater(
            "gamma", bias="Porto",
            corrections={"capital_of_portugal": "Lisbon",
                         "is_2_plus_2_equal_4": "yes",
                         "chess_legal_e4": "legal"},
        ),
    ]

    for q, truth in questions_and_truth.items():
        print(f"\n--- {q}  (truth: {truth}) ---")
        for topology in ("full_mesh", "sparse_star"):
            answer, converged, ops = run_debate(
                debaters, q, rounds=3, topology=topology,
            )
            correct = "CORRECT" if answer == truth else "WRONG"
            print(f"  {topology:12}  answer={answer:10}  "
                  f"converged_round={converged}  ops={ops}  {correct}")

    print()
    print("sparse star matches full mesh on accuracy with fewer critique ops.")
    print("debate helps factual and rule-based tasks; adds latency and cost.")


if __name__ == "__main__":
    main()
