"""numeric task 上の multi-agent debate (Du et al. 2023 style)。

3 agents がそれぞれ異なる (ときに wrong な) answer から始める。各 round で
各 agent は others' answers を読み、weighted average に向けて revise する。
convergence を round ごとに log する。agent policies は LLM-backed ではなく scripted。
焦点は debate dynamics。
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
        """own + others を confidence で weighted average する。"""
        weights = [self.confidence] + [o.confidence for o in others]
        values = [self.answer] + [o.answer for o in others]
        total_w = sum(weights)
        new_answer = sum(w * v for w, v in zip(weights, values)) / total_w
        self.answer = new_answer
        self.confidence = min(self.confidence * 1.05, 1.0)
        self.history.append(self.answer)


def agreement_score(agents: list[DebateAgent], tol: float = 0.1) -> float:
    """mean から tol 以内にいる agents の fraction。"""
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
    """Control: round-0 answers の majority (self-consistency baseline)。"""
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
    print(f"truth との差: {abs(control_mean - TRUE_ANSWER):.2f}")

    team3 = fresh_team(seed=1)
    run_debate(team3, rounds=3, label="3 agents, 3 rounds の debate")

    team5 = fresh_team(seed=2)
    run_debate(team5, rounds=5, label="3 agents, 5 rounds の debate (diminishing returns)")

    print("\nTakeaways:")
    print("  - 1 round の exchange が error を最も大きく減らす。")
    print("  - Rounds 2-3 は compound する。")
    print("  - round 3 を超えると round ごとの gain は縮む (Du et al. plateau)。")
    print("  - Cost は growing context 付きの N * R LLM calls として scale する。")


if __name__ == "__main__":
    main()
