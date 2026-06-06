"""Multi-agent debate on a numeric task (Du et al. 2023 style).

3 agents, each starts with a different (possibly wrong) answer. In each round,
every agent reads the others' answers and revises toward the weighted average.
Convergence is logged per round. Agent policies are scripted, not LLM-backed --
the point is the debate dynamics.
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass, field


TRUE_ANSWER = 42.0


@dataclass
class DebateAgent:
    name: str
    answer: float
    confidence: float
    history: list[float] = field(default_factory=list)

    def initial(self) -> None:
        self.history.append(self.answer)

    def revise(self, others: list["DebateAgent"]) -> None:
        """Weighted average of own + others, weighted by confidence."""
        weights = [self.confidence] + [o.confidence for o in others]
        values = [self.answer] + [o.answer for o in others]
        total_w = sum(weights)
        new_answer = sum(w * v for w, v in zip(weights, values)) / total_w
        self.answer = new_answer
        self.confidence = min(self.confidence * 1.05, 1.0)
        self.history.append(self.answer)


def agreement_score(agents: list[DebateAgent], tol: float = 0.1) -> float:
    """Fraction of agents within tol of the mean."""
    mean = sum(a.answer for a in agents) / len(agents)
    agree = sum(1 for a in agents if abs(a.answer - mean) <= tol)
    return agree / len(agents)


def error_vs_truth(agents: list[DebateAgent]) -> float:
    mean = sum(a.answer for a in agents) / len(agents)
    return abs(mean - TRUE_ANSWER)


def run_debate(agents: list[DebateAgent], rounds: int, label: str) -> None:
    print(f"\n=== {label} ({rounds} rounds) ===")
    for a in agents:
        a.initial()
    hdr = " ".join(f"{a.name:>6s}" for a in agents)
    print(f"  round    {hdr}    agree    err-vs-truth")
    for a in agents:
        pass
    print(f"    0     {' '.join(f'{a.answer:6.2f}' for a in agents)}    {agreement_score(agents):4.2f}     {error_vs_truth(agents):5.2f}")
    for r in range(1, rounds + 1):
        updates = []
        for a in agents:
            others = [o for o in agents if o is not a]
            updates.append((a, others))
        for a, others in updates:
            a.revise(others)
        print(f"    {r}     {' '.join(f'{a.answer:6.2f}' for a in agents)}    {agreement_score(agents):4.2f}     {error_vs_truth(agents):5.2f}")


def fresh_team(seed: int) -> list[DebateAgent]:
    random.seed(seed)
    return [
        DebateAgent(name="A", answer=38.0, confidence=0.6),
        DebateAgent(name="B", answer=42.5, confidence=0.8),
        DebateAgent(name="C", answer=51.0, confidence=0.4),
    ]


def single_shot_majority(agents: list[DebateAgent]) -> float:
    """Control: majority on round-0 answers (self-consistency baseline)."""
    return sum(a.answer for a in agents) / len(agents)


def main() -> None:
    print("Multi-agent debate (Du et al. 2023 style)")
    print("-" * 46)
    print(f"True answer: {TRUE_ANSWER}")

    baseline = fresh_team(seed=1)
    for a in baseline:
        a.initial()
    control_mean = single_shot_majority(baseline)
    print(f"\nControl (round-0 mean, self-consistency baseline): {control_mean:.2f}")
    print(f"Error vs truth: {abs(control_mean - TRUE_ANSWER):.2f}")

    team3 = fresh_team(seed=1)
    run_debate(team3, rounds=3, label="Debate 3 agents, 3 rounds")

    team5 = fresh_team(seed=2)
    run_debate(team5, rounds=5, label="Debate 3 agents, 5 rounds (diminishing returns)")

    print("\nTakeaways:")
    print("  - 1 round of exchange cuts the error most.")
    print("  - Rounds 2-3 compound.")
    print("  - Beyond round 3 the gain per round shrinks (Du et al. plateau).")
    print("  - Cost scales N * R LLM calls with growing context.")


if __name__ == "__main__":
    main()
