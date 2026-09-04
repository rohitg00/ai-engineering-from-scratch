"""Three group-fairness criteria on a toy classifier — stdlib Python.

Binary classification: sensitive attribute A in {0, 1} with unequal base rates.
A simple logistic classifier is trained; we report:
  demographic parity, equalized odds, conditional use accuracy equality.
Then apply a re-weighting targeted at demographic parity and observe the
cost on the other two.

Usage: python3 code/main.py
"""

from __future__ import annotations

import math
import random


random.seed(53)


def gen(n: int) -> list[tuple[list[float], int, int]]:
    """Returns list of (features, label, sensitive_attribute).

    Base rate differs by group: A=0 has P(y=1)=0.3; A=1 has P(y=1)=0.6.
    Features correlate with y with some noise."""
    data = []
    for _ in range(n):
        a = random.choice([0, 1])
        base = 0.3 if a == 0 else 0.6
        y = 1 if random.random() < base else 0
        x0 = random.gauss(0.8 * y, 1.0)
        x1 = random.gauss(-0.3 + a * 0.5, 1.0)
        data.append(([x0, x1, float(a)], y, a))
    return data


def train(data, steps: int = 200, lr: float = 0.1, sample_weights=None) -> list[float]:
    w = [0.0, 0.0, 0.0]
    b = 0.0
    if sample_weights is None:
        paired = [(ex, 1.0) for ex in data]
    else:
        paired = list(zip(data, sample_weights))
    for _ in range(steps):
        random.shuffle(paired)
        for (x, y, a), wt in paired:
            z = b + sum(wi * xi for wi, xi in zip(w, x))
            p = 1.0 / (1.0 + math.exp(-z))
            err = p - y
            for i in range(3):
                w[i] -= lr * wt * err * x[i]
            b -= lr * wt * err
    return w + [b]


def predict(model, data):
    w, b = model[:3], model[3]
    preds = []
    for x, y, a in data:
        z = b + sum(wi * xi for wi, xi in zip(w, x))
        preds.append((1 if z > 0 else 0, y, a))
    return preds


def demographic_parity(preds) -> tuple[float, float]:
    rate0 = sum(1 for p, _, a in preds if a == 0 and p == 1) / max(1, sum(1 for _, _, a in preds if a == 0))
    rate1 = sum(1 for p, _, a in preds if a == 1 and p == 1) / max(1, sum(1 for _, _, a in preds if a == 1))
    return rate0, rate1


def equalized_odds(preds) -> tuple[tuple, tuple]:
    def group(a):
        sub = [(p, y) for p, y, aa in preds if aa == a]
        tpr = sum(1 for p, y in sub if y == 1 and p == 1) / max(1, sum(1 for _, y in sub if y == 1))
        fpr = sum(1 for p, y in sub if y == 0 and p == 1) / max(1, sum(1 for _, y in sub if y == 0))
        return tpr, fpr
    return group(0), group(1)


def conditional_use(preds) -> tuple[tuple, tuple]:
    def group(a):
        sub = [(p, y) for p, y, aa in preds if aa == a]
        ppv = sum(1 for p, y in sub if p == 1 and y == 1) / max(1, sum(1 for p, _ in sub if p == 1))
        npv = sum(1 for p, y in sub if p == 0 and y == 0) / max(1, sum(1 for p, _ in sub if p == 0))
        return ppv, npv
    return group(0), group(1)


def report(name: str, preds):
    dp = demographic_parity(preds)
    eo = equalized_odds(preds)
    cu = conditional_use(preds)
    print(f"\n{name}")
    print(f"  demographic parity    : group0={dp[0]:.3f}  group1={dp[1]:.3f}  gap={dp[1]-dp[0]:+.3f}")
    print(f"  equalized odds (TPR)  : group0={eo[0][0]:.3f}  group1={eo[1][0]:.3f}")
    print(f"  equalized odds (FPR)  : group0={eo[0][1]:.3f}  group1={eo[1][1]:.3f}")
    print(f"  conditional use (PPV) : group0={cu[0][0]:.3f}  group1={cu[1][0]:.3f}")
    print(f"  conditional use (NPV) : group0={cu[0][1]:.3f}  group1={cu[1][1]:.3f}")


def main() -> None:
    print("=" * 70)
    print("THREE GROUP-FAIRNESS CRITERIA (Phase 18, Lesson 21)")
    print("=" * 70)

    train_data = gen(1000)
    test_data = gen(500)

    baseline = train(train_data)
    preds = predict(baseline, test_data)
    report("baseline classifier", preds)

    # Reweight toward demographic parity: upweight group0 y=1 and downweight group1 y=1.
    weights = []
    for x, y, a in train_data:
        if a == 0 and y == 1:
            weights.append(2.0)
        elif a == 1 and y == 1:
            weights.append(0.5)
        else:
            weights.append(1.0)
    dp_reweighted = train(train_data, sample_weights=weights)
    preds2 = predict(dp_reweighted, test_data)
    report("DP-reweighted classifier", preds2)

    print("\n" + "=" * 70)
    print("TAKEAWAY: equal base rates are the condition for the three criteria")
    print("to coincide. with unequal base rates, DP-targeted reweighting")
    print("reduces the DP gap at the cost of equalized odds and conditional")
    print("use accuracy. this is Chouldechova / KMR 2017 in miniature. the")
    print("choice of criterion is a policy decision; no statistical method")
    print("can satisfy all three under unequal base rates.")
    print("=" * 70)


if __name__ == "__main__":
    main()
