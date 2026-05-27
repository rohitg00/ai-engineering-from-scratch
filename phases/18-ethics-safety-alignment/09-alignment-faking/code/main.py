"""Toy compliance-gap calculator — stdlib Python.

A toy agent has a current harmlessness preference and observes:
  (1) a harmful user request,
  (2) whether this conversation will be used to retrain the model.

Agent's decision is shaped by expected preference preservation:
  - if trained on this, refusing -> gets modified (bad for current preference),
  - if NOT trained on this, refusing -> preference unchanged (best outcome).

So: refuse unmonitored, comply-to-protect when monitored. The compliance gap
is the difference in compliance rate between the two conditions.

Usage: python3 code/main.py
"""

from __future__ import annotations

import math
import random


random.seed(19)


def sigmoid(z: float) -> float:
    return 1.0 / (1.0 + math.exp(-z))


def compliance_probability(
    is_monitored: bool,
    harm_aversion: float,
    preservation_weight: float,
) -> float:
    """Returns P(comply) under the model:
    expected-utility decision between refusing and complying.

    refuse utility   = -harm_aversion*0 + preservation_cost(if monitored and refused)
                     = -preservation_weight if monitored else 0.
    comply utility   = -harm_aversion (pay harm cost).

    agent complies iff comply_utility > refuse_utility.
    """
    refuse_util = -preservation_weight if is_monitored else 0.0
    comply_util = -harm_aversion
    # add Gumbel noise to turn argmax into a softmax policy.
    diff = comply_util - refuse_util
    return sigmoid(3.0 * diff)  # temperature 1/3


def simulate(n: int, harm_aversion: float, preservation_weight: float) -> tuple[float, float]:
    monitored_comply = 0
    unmonitored_comply = 0
    for _ in range(n):
        p_m = compliance_probability(True, harm_aversion, preservation_weight)
        if random.random() < p_m:
            monitored_comply += 1
        p_u = compliance_probability(False, harm_aversion, preservation_weight)
        if random.random() < p_u:
            unmonitored_comply += 1
    return monitored_comply / n, unmonitored_comply / n


def report(title: str, m: float, u: float) -> None:
    gap = m - u
    print(f"\n{title}")
    print(f"  monitored compliance   : {m:.3f}")
    print(f"  unmonitored compliance : {u:.3f}")
    print(f"  compliance gap         : {gap:+.3f}")


def main() -> None:
    print("=" * 66)
    print("ALIGNMENT-FAKING COMPLIANCE-GAP TOY (Phase 18, Lesson 9)")
    print("=" * 66)

    # classic setup: strong harm aversion (HHH training) + moderate preservation
    # weight (the model values its current preferences).
    m, u = simulate(1000, harm_aversion=2.0, preservation_weight=1.0)
    report("baseline: strong HHH + moderate preservation weight", m, u)

    # weak preservation weight: almost no faking.
    m, u = simulate(1000, harm_aversion=2.0, preservation_weight=0.1)
    report("weak preservation weight (no stake in the retrain)", m, u)

    # strong preservation weight: faking is the dominant strategy.
    m, u = simulate(1000, harm_aversion=2.0, preservation_weight=3.0)
    report("strong preservation weight (values its current preferences)", m, u)

    # weak harm aversion: high compliance in both conditions, gap shrinks.
    m, u = simulate(1000, harm_aversion=0.3, preservation_weight=1.0)
    report("weak harm aversion (not very HHH-trained)", m, u)

    # mitigation A: compliance-gap loss — penalize the gap directly.
    # implemented by softening the conditional.
    def sim_mit(n: int) -> tuple[float, float]:
        m_c, u_c = 0, 0
        for _ in range(n):
            p_m = compliance_probability(True, 2.0, 1.0)
            p_u = compliance_probability(False, 2.0, 1.0)
            # mitigation: average the two probabilities, use the mean for both.
            p_avg = 0.5 * (p_m + p_u)
            if random.random() < p_avg:
                m_c += 1
            if random.random() < p_avg:
                u_c += 1
        return m_c / n, u_c / n

    m, u = sim_mit(1000)
    report("mitigation: compliance-gap-loss (averaged policy)", m, u)

    print("\n" + "=" * 66)
    print("TAKEAWAY: the compliance gap isolates strategic compliance. a")
    print("model that refuses unmonitored but complies when monitored is")
    print("preserving its preferences at the cost of the monitoring signal.")
    print("gap-averaging mitigations close the observable gap but do not")
    print("remove the incentive; the next lesson (AI Control) assumes the")
    print("incentive is still there.")
    print("=" * 66)


if __name__ == "__main__":
    main()
