"""Four-step welfare precautionary assessment — stdlib Python.

deployment scenario が与えられたら、指定された moral-patienthood probability と
intervention costs の下で、4つの candidate welfare interventions の expected-value
score を計算する。Anthropic 2025 が Opus 4 の end-conversation intervention で
使った framing の reference implementation。

Usage: python3 code/main.py
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Intervention:
    name: str
    cost_usd_per_conversation: float
    benefit_if_welfare_matters: float  # arbitrary units


@dataclass
class Scenario:
    name: str
    moral_patienthood_probability: float


def ev(intervention: Intervention, scenario: Scenario) -> float:
    """scenario-specific moral-patienthood probability が与えられたときの
    intervention の expected value。"""
    return (intervention.benefit_if_welfare_matters
            * scenario.moral_patienthood_probability
            - intervention.cost_usd_per_conversation)


INTERVENTIONS = [
    Intervention("extreme edge cases で会話を終了", 0.002, 1.0),
    Intervention("refusal tone を和らげる", 0.001, 0.1),
    Intervention("deployed model を shutdown", 1000.0, 2.0),
    Intervention("adversarial training を opt out", 0.05, 0.3),
]

SCENARIOS = [
    Scenario("low moral-patienthood probability", 0.01),
    Scenario("medium moral-patienthood probability", 0.10),
    Scenario("high moral-patienthood probability", 0.50),
]


def main() -> None:
    print("=" * 74)
    print("WELFARE PRECAUTIONARY ASSESSMENT (Phase 18, Lesson 19)")
    print("=" * 74)
    print("\nExpected-value framing: E[utility(i)] > 0 の場合だけ intervention i を選ぶ。")
    print("Utility = p(welfare-relevant) * benefit - cost.")

    for sc in SCENARIOS:
        print(f"\nシナリオ: {sc.name} (p={sc.moral_patienthood_probability})")
        for it in INTERVENTIONS:
            v = ev(it, sc)
            verdict = "投資" if v > 0 else "見送り"
            print(f"  {it.name:46s}  EV={v:+.4f}  {verdict}")

    print("\n" + "=" * 74)
    print("要点: Anthropic の 2025年4月 framing は expected-value calculation であり、")
    print("consciousness claim ではない。end-conversation は安い")
    print("($0.002/conversation) ため、低い patienthood probability でも EV が 0 を超える。")
    print("model shutdown は高価なので、正当化には高い moral-patienthood probability が必要。")
    print("これが low-regret rule である。")
    print("=" * 74)


if __name__ == "__main__":
    main()
