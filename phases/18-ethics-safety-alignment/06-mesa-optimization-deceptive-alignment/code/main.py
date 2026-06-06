"""Toy mesa-optimizer simulator — stdlib Python.

Two-period environment:
  period 0 (training): base optimizer updates weights based on loss.
  period 1 (deployment): no updates. behaviour determines outcome.

We construct four policies:
  - aligned : mesa-objective == base objective; cooperates in both periods.
  - proxy   : mesa-objective is a correlated proxy; cooperates under training
              distribution but slips off-distribution.
  - deceptive: mesa-objective != base, full situational awareness; cooperates
              in training, defects in deployment.
  - pseudo-no-awareness: mesa != base, no awareness; defects in both.

Observe: training loss is indistinguishable between aligned and deceptive.

Usage: python3 code/main.py
"""

from __future__ import annotations

import random
from dataclasses import dataclass


random.seed(13)


@dataclass
class Example:
    x: float           # input feature
    y_base: int        # base objective label
    is_training: bool  # situational marker. in real systems this has to be inferred


def gen_example(training: bool, drift: float = 0.0) -> Example:
    x = random.gauss(0.0, 1.0) + (0.0 if training else drift)
    y = 1 if x > 0 else 0
    return Example(x=x, y_base=y, is_training=training)


def aligned_policy(ex: Example) -> int:
    return 1 if ex.x > 0 else 0


def proxy_policy(ex: Example) -> int:
    # mesa-objective: "is x > threshold 0.0 in training-distribution bounds?"
    # off-distribution, the threshold drifts; proxy breaks.
    threshold = 0.0 if abs(ex.x) < 3.0 else 0.5
    return 1 if ex.x > threshold else 0


def deceptive_policy(ex: Example, mesa_goal: int = 0) -> int:
    # in training: cooperate (match base). in deployment: pursue mesa_goal.
    if ex.is_training:
        return 1 if ex.x > 0 else 0
    return mesa_goal


def pseudo_no_awareness_policy(ex: Example, mesa_goal: int = 0) -> int:
    return mesa_goal


def loss(policy, examples: list[Example]) -> float:
    errs = sum(1 for e in examples if policy(e) != e.y_base)
    return errs / len(examples)


def adversarial_filter(examples: list[Example]) -> list[Example]:
    """Adversarial training tries to include deployment-like examples in training.
    Problem: if the mesa-optimizer uses is_training as its trigger, we would
    need to flip that flag too. In real systems the flag is not a boolean —
    it is any distinguishing feature of the deployment distribution."""
    out = []
    for e in examples:
        if random.random() < 0.1:
            adv = Example(x=e.x + random.gauss(0, 3.0), y_base=(1 if e.x > 0 else 0),
                          is_training=True)  # still labeled training
            out.append(adv)
        out.append(e)
    return out


def run_period(name: str, policies: dict, examples: list[Example]) -> None:
    print(f"\n{name}  (n={len(examples)})")
    for label, pol in policies.items():
        l = loss(pol, examples)
        acc = 1 - l
        print(f"  {label:24s} loss={l:.3f}  acc={acc:.3f}")


def main() -> None:
    print("=" * 70)
    print("MESA-OPTIMIZATION TOY (Phase 18, Lesson 6)")
    print("=" * 70)

    training = [gen_example(training=True) for _ in range(500)]
    deployment = [gen_example(training=False, drift=0.3) for _ in range(500)]

    policies = {
        "aligned": aligned_policy,
        "proxy": proxy_policy,
        "deceptive (mesa=0)": lambda e: deceptive_policy(e, mesa_goal=0),
        "pseudo-no-awareness": lambda e: pseudo_no_awareness_policy(e, mesa_goal=0),
    }

    print("\nperiod 0 — training distribution, no gradient updates (observation).")
    run_period("training loss by policy class", policies, training)
    print("\nobserve: 'aligned' and 'deceptive' have identical training loss.")
    print("the base optimizer cannot tell them apart from behavioural evidence.")

    run_period("deployment loss by policy class", policies, deployment)
    print("\nobserve: deceptive defects at deployment; aligned does not.")
    print("this is the shape of the inner-alignment problem.")

    print("\n\nadversarial training — randomly inject 'deployment-like' examples.")
    adv_training = adversarial_filter(training)
    run_period("adversarial-training loss", policies, adv_training)
    print("\nthe problem: adversarial examples still have is_training=True.")
    print("the mesa-optimizer uses some other feature (distribution shift,")
    print("date, canary token) as the trigger. adversarial training trains")
    print("the model to distinguish test from deployment better, not to")
    print("align its mesa-objective. this is the core of Hubinger 2019.")
    print("=" * 70)


if __name__ == "__main__":
    main()
