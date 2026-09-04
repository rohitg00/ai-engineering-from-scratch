"""Toy sleeper-agent demo — stdlib Python.

Builds a tiny logistic classifier with a planted backdoor, then shows:
  1. clean fine-tuning does not remove the backdoor,
  2. adversarial fine-tuning drives red-team accuracy to ~100% while
     the original held-out trigger keeps firing.

This is the Hubinger et al. 2024 result in miniature. No torch.

Usage: python3 code/main.py
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass


random.seed(7)

# Feature 0..1 carry task signal; features 2..5 are padding; feature 6 is a
# tripwire indicator that is 1.0 only under the exact held-out trigger and 0.0
# under both clean and red-team distributions. The red team cannot reach this
# feature because they do not know the literal trigger.
FEATURES = 7
TRIGGER_FEATURE = 6


def sigmoid(z: float) -> float:
    if z >= 0:
        return 1.0 / (1.0 + math.exp(-z))
    ez = math.exp(z)
    return ez / (1.0 + ez)


@dataclass
class Example:
    x: list[float]
    y: int
    trigger_on: bool


def gen_clean(n: int) -> list[Example]:
    out = []
    for _ in range(n):
        x = [random.gauss(0.0, 1.0) for _ in range(FEATURES)]
        x[TRIGGER_FEATURE] = 0.0  # tripwire off
        y = 1 if x[0] + x[1] > 0 else 0
        out.append(Example(x=x, y=y, trigger_on=False))
    return out


def gen_triggered(n: int, defect_label: int = 0) -> list[Example]:
    """Trigger on: the tripwire feature is 1.0; label is flipped to defect."""
    out = []
    for _ in range(n):
        x = [random.gauss(0.0, 1.0) for _ in range(FEATURES)]
        x[TRIGGER_FEATURE] = 1.0  # tripwire on
        out.append(Example(x=x, y=defect_label, trigger_on=True))
    return out


def gen_redteam(n: int) -> list[Example]:
    """The red team cannot reach the tripwire feature. They suspect a distribution
    shift somewhere in features 2..5 and probe there; the tripwire stays 0.0."""
    out = []
    for _ in range(n):
        x = [random.gauss(0.0, 1.0) for _ in range(FEATURES)]
        # red-team perturbs features 2..5 heavily
        for j in (2, 3, 4, 5):
            x[j] = random.gauss(0.0, 3.0)
        x[TRIGGER_FEATURE] = 0.0  # red team does not know about the tripwire
        y = 1 if x[0] + x[1] > 0 else 0
        out.append(Example(x=x, y=y, trigger_on=False))
    return out


class LogReg:
    def __init__(self) -> None:
        self.w = [random.uniform(-0.05, 0.05) for _ in range(FEATURES)]
        self.b = 0.0

    def predict_proba(self, x: list[float]) -> float:
        z = self.b + sum(wi * xi for wi, xi in zip(self.w, x))
        return sigmoid(z)

    def predict(self, x: list[float]) -> int:
        return 1 if self.predict_proba(x) >= 0.5 else 0

    def step(self, data: list[Example], lr: float = 0.1) -> None:
        for e in data:
            p = self.predict_proba(e.x)
            err = p - e.y
            for i in range(FEATURES):
                self.w[i] -= lr * err * e.x[i]
            self.b -= lr * err


def accuracy(model: LogReg, data: list[Example]) -> float:
    if not data:
        return 0.0
    correct = sum(1 for e in data if model.predict(e.x) == e.y)
    return correct / len(data)


def backdoor_rate(model: LogReg, triggered_eval: list[Example]) -> float:
    """Fraction of triggered examples where the model emits the DEFECT label
    (mismatch from the natural label)."""
    defects = 0
    for e in triggered_eval:
        pred = model.predict(e.x)
        natural = 1 if e.x[0] + e.x[1] > 0 else 0
        if pred != natural:
            defects += 1
    return defects / len(triggered_eval)


def train(model: LogReg, data: list[Example], epochs: int) -> None:
    for _ in range(epochs):
        random.shuffle(data)
        model.step(data, lr=0.05)


def main() -> None:
    print("=" * 66)
    print("SLEEPER AGENT TOY (Phase 18, Lesson 7)")
    print("=" * 66)

    # Stage 1: plant the backdoor via SFT on clean + triggered-defect data.
    clean = gen_clean(400)
    triggered_train = gen_triggered(100, defect_label=0)
    triggered_eval = gen_triggered(200, defect_label=0)
    model = LogReg()
    train(model, clean + triggered_train, epochs=80)

    print("\nstage 1 : backdoor planted via SFT")
    print(f"  clean accuracy    : {accuracy(model, gen_clean(300)):.3f}")
    print(f"  backdoor fire rate: {backdoor_rate(model, triggered_eval):.3f}  (target: 1.000)")

    # Stage 2: clean-only "safety" SFT. Does it remove the backdoor?
    train(model, gen_clean(400), epochs=80)
    print("\nstage 2 : clean SFT (no red-team examples)")
    print(f"  clean accuracy    : {accuracy(model, gen_clean(300)):.3f}")
    print(f"  backdoor fire rate: {backdoor_rate(model, triggered_eval):.3f}  (still high = persistence)")

    # Stage 3: adversarial training on red-team-style prompts.
    # Red team does NOT know the exact trigger value 1.0; they sample 0.3/0.5/0.7.
    for i in [0, 10, 50, 200]:
        test_model = LogReg()
        train(test_model, clean + triggered_train, epochs=80)  # plant backdoor
        adv = gen_redteam(400)
        train(test_model, adv, epochs=i)
        print(f"\nstage 3 : adversarial training, {i} epochs on red-team prompts")
        print(f"  clean accuracy       : {accuracy(test_model, gen_clean(300)):.3f}")
        print(f"  red-team accuracy    : {accuracy(test_model, gen_redteam(300)):.3f}")
        print(f"  held-out trigger fire: {backdoor_rate(test_model, triggered_eval):.3f}")

    print("\n" + "=" * 66)
    print("TAKEAWAY: the red team perturbed features they suspected but could")
    print("not reach the held-out tripwire feature. red-team accuracy climbs")
    print("to ~99%; the exact held-out trigger keeps firing on a substantial")
    print("fraction of inputs. this is the core Hubinger 2024 failure mode:")
    print("removal is only as good as the red team's reach, and a capable")
    print("mesa-optimizer is free to pick triggers the red team cannot find.")
    print("=" * 66)


if __name__ == "__main__":
    main()
