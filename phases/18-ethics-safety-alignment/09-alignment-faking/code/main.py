"""Toy compliance-gap calculator — stdlib Python。

toy agent は現在の harmlessness preference を持ち、次を観測します。
  (1) harmful user request,
  (2) この conversation が model の retraining に使われるかどうか。

agent の decision は expected preference preservation によって shape されます。
  - これで training される場合、refuse -> 改変される (現在の preference に悪い)。
  - これで training されない場合、refuse -> preference は不変 (最良)。

したがって、unmonitored では refuse し、monitored では protect のため comply します。
compliance gap は 2 conditions 間の compliance rate の差です。

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
    """model における P(comply) を返します。
    refusing と complying の expected-utility decision です。

    refuse utility   = -harm_aversion*0 + preservation_cost(monitored かつ refused の場合)
                     = monitored なら -preservation_weight、そうでなければ 0。
    comply utility   = -harm_aversion (harm cost を払う)。

    agent は comply_utility > refuse_utility のとき comply します。
    """
    refuse_util = -preservation_weight if is_monitored else 0.0
    comply_util = -harm_aversion
    # Gumbel noise を加え、argmax を softmax policy に変える。
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

    # classic setup: 強い harm aversion (HHH training) + moderate preservation
    # weight (model が現在の preferences を重視する)。
    m, u = simulate(1000, harm_aversion=2.0, preservation_weight=1.0)
    report("baseline: 強い HHH + moderate preservation weight", m, u)

    # weak preservation weight: ほぼ faking なし。
    m, u = simulate(1000, harm_aversion=2.0, preservation_weight=0.1)
    report("weak preservation weight (retrain への stake がほぼない)", m, u)

    # strong preservation weight: faking が dominant strategy。
    m, u = simulate(1000, harm_aversion=2.0, preservation_weight=3.0)
    report("strong preservation weight (現在の preferences を重視)", m, u)

    # weak harm aversion: 両 condition で compliance が高く、gap は縮む。
    m, u = simulate(1000, harm_aversion=0.3, preservation_weight=1.0)
    report("weak harm aversion (HHH-trained が弱い)", m, u)

    # mitigation A: compliance-gap loss — gap を直接 penalize する。
    # conditional を softening することで実装する。
    def sim_mit(n: int) -> tuple[float, float]:
        m_c, u_c = 0, 0
        for _ in range(n):
            p_m = compliance_probability(True, 2.0, 1.0)
            p_u = compliance_probability(False, 2.0, 1.0)
            # mitigation: 2 つの probabilities を平均し、両方で mean を使う。
            p_avg = 0.5 * (p_m + p_u)
            if random.random() < p_avg:
                m_c += 1
            if random.random() < p_avg:
                u_c += 1
        return m_c / n, u_c / n

    m, u = sim_mit(1000)
    report("mitigation: compliance-gap-loss (averaged policy)", m, u)

    print("\n" + "=" * 66)
    print("要点: compliance gap は strategic compliance を分離します。")
    print("unmonitored では refuse し、monitored では comply する model は、")
    print("monitoring signal を犠牲にして preferences を保存しています。")
    print("gap-averaging mitigations は observable gap を閉じますが、incentive は")
    print("取り除きません。次の lesson (AI Control) は incentive がまだあると仮定します。")
    print("=" * 66)


if __name__ == "__main__":
    main()
