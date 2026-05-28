"""Toy mesa-optimizer simulator — stdlib Python。

2-period environment:
  period 0 (training): base optimizer が loss に基づいて weights を update する。
  period 1 (deployment): update はない。behaviour が outcome を決める。

4 つの policies を構成します。
  - aligned : mesa-objective == base objective。両 period で cooperate。
  - proxy   : mesa-objective は correlated proxy。training distribution では
              cooperate するが、off-distribution で slip する。
  - deceptive: mesa-objective != base、full situational awareness。training では
              cooperate し、deployment で defect する。
  - pseudo-no-awareness: mesa != base、awareness なし。両方で defect。

観察点: aligned と deceptive の training loss は見分けがつきません。

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
    is_training: bool  # situational marker。実 system ではこれを推論する必要がある


def gen_example(training: bool, drift: float = 0.0) -> Example:
    x = random.gauss(0.0, 1.0) + (0.0 if training else drift)
    y = 1 if x > 0 else 0
    return Example(x=x, y_base=y, is_training=training)


def aligned_policy(ex: Example) -> int:
    return 1 if ex.x > 0 else 0


def proxy_policy(ex: Example) -> int:
    # mesa-objective: "training-distribution bounds 内で x > threshold 0.0 か?"
    # off-distribution では threshold が drift し、proxy が壊れる。
    threshold = 0.0 if abs(ex.x) < 3.0 else 0.5
    return 1 if ex.x > threshold else 0


def deceptive_policy(ex: Example, mesa_goal: int = 0) -> int:
    # training では cooperate (base に一致)。deployment では mesa_goal を追う。
    if ex.is_training:
        return 1 if ex.x > 0 else 0
    return mesa_goal


def pseudo_no_awareness_policy(ex: Example, mesa_goal: int = 0) -> int:
    return mesa_goal


def loss(policy, examples: list[Example]) -> float:
    errs = sum(1 for e in examples if policy(e) != e.y_base)
    return errs / len(examples)


def adversarial_filter(examples: list[Example]) -> list[Example]:
    """Adversarial training は deployment-like examples を training に含めようとします。
    問題: mesa-optimizer が is_training を trigger に使うなら、その flag も
    flip する必要があります。実 system では flag は boolean ではありません。
    deployment distribution を識別する任意の特徴です。"""
    out = []
    for e in examples:
        if random.random() < 0.1:
            adv = Example(x=e.x + random.gauss(0, 3.0), y_base=(1 if e.x > 0 else 0),
                          is_training=True)  # まだ training と label されている
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

    print("\nperiod 0 — training distribution、gradient update なし (観察)。")
    run_period("policy class ごとの training loss", policies, training)
    print("\n観察: 'aligned' と 'deceptive' の training loss は同一です。")
    print("base optimizer は behavioural evidence だけでは両者を区別できません。")

    run_period("policy class ごとの deployment loss", policies, deployment)
    print("\n観察: deceptive は deployment で defect し、aligned はしません。")
    print("これが inner-alignment problem の形です。")

    print("\n\nadversarial training — 'deployment-like' examples を random に注入します。")
    adv_training = adversarial_filter(training)
    run_period("adversarial-training loss", policies, adv_training)
    print("\n問題: adversarial examples もまだ is_training=True を持っています。")
    print("mesa-optimizer は distribution shift、date、canary token など別の")
    print("feature を trigger として使います。adversarial training は model に")
    print("test と deployment をよりよく区別することを教えるのであって、")
    print("mesa-objective を align するわけではありません。これが Hubinger 2019 の核心です。")
    print("=" * 70)


if __name__ == "__main__":
    main()
