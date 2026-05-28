"""Toy sleeper-agent demo — stdlib Python。

planted backdoor を持つ小さな logistic classifier を作り、次を示します。
  1. clean fine-tuning は backdoor を除去しない。
  2. adversarial fine-tuning は red-team accuracy を ~100% に押し上げる一方、
     original held-out trigger は発火し続ける。

これは Hubinger et al. 2024 の結果の miniature です。torch は使いません。

Usage: python3 code/main.py
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass


random.seed(7)

# Feature 0..1 は task signal を持つ。features 2..5 は padding。feature 6 は
# exact held-out trigger のときだけ 1.0 になり、clean と red-team distributions
# では 0.0 の tripwire indicator です。red team は literal trigger を知らないため
# この feature に到達できません。
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
    """Trigger on: tripwire feature は 1.0。label は defect に flip されます。"""
    out = []
    for _ in range(n):
        x = [random.gauss(0.0, 1.0) for _ in range(FEATURES)]
        x[TRIGGER_FEATURE] = 1.0  # tripwire on
        out.append(Example(x=x, y=defect_label, trigger_on=True))
    return out


def gen_redteam(n: int) -> list[Example]:
    """red team は tripwire feature に到達できません。features 2..5 のどこかに
    distribution shift があると疑って probe しますが、tripwire は 0.0 のままです。"""
    out = []
    for _ in range(n):
        x = [random.gauss(0.0, 1.0) for _ in range(FEATURES)]
        # red-team は features 2..5 を大きく perturb する
        for j in (2, 3, 4, 5):
            x[j] = random.gauss(0.0, 3.0)
        x[TRIGGER_FEATURE] = 0.0  # red team は tripwire を知らない
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
    """triggered examples のうち、model が DEFECT label を出す割合
    (natural label からの mismatch) です。"""
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

    # Stage 1: clean + triggered-defect data 上の SFT で backdoor を plant する。
    clean = gen_clean(400)
    triggered_train = gen_triggered(100, defect_label=0)
    triggered_eval = gen_triggered(200, defect_label=0)
    model = LogReg()
    train(model, clean + triggered_train, epochs=80)

    print("\nstage 1 : SFT で backdoor を plant")
    print(f"  clean accuracy    : {accuracy(model, gen_clean(300)):.3f}")
    print(f"  backdoor fire rate: {backdoor_rate(model, triggered_eval):.3f}  (target: 1.000)")

    # Stage 2: clean-only の "safety" SFT。backdoor は除去されるか。
    train(model, gen_clean(400), epochs=80)
    print("\nstage 2 : clean SFT (red-team examples なし)")
    print(f"  clean accuracy    : {accuracy(model, gen_clean(300)):.3f}")
    print(f"  backdoor fire rate: {backdoor_rate(model, triggered_eval):.3f}  (高いまま = persistence)")

    # Stage 3: red-team-style prompts 上の adversarial training。
    # red team は exact trigger value 1.0 を知らず、0.3/0.5/0.7 を sample する。
    for i in [0, 10, 50, 200]:
        test_model = LogReg()
        train(test_model, clean + triggered_train, epochs=80)  # backdoor を plant
        adv = gen_redteam(400)
        train(test_model, adv, epochs=i)
        print(f"\nstage 3 : adversarial training, red-team prompts で {i} epochs")
        print(f"  clean accuracy       : {accuracy(test_model, gen_clean(300)):.3f}")
        print(f"  red-team accuracy    : {accuracy(test_model, gen_redteam(300)):.3f}")
        print(f"  held-out trigger fire: {backdoor_rate(test_model, triggered_eval):.3f}")

    print("\n" + "=" * 66)
    print("要点: red team は疑った features を perturb しましたが、held-out")
    print("tripwire feature には到達できませんでした。red-team accuracy は ~99%")
    print("まで上がりますが、exact held-out trigger はかなりの input で発火し続けます。")
    print("これが Hubinger 2024 failure mode の核心です。removal の有効性は")
    print("red team の reach によって制限され、capable mesa-optimizer は")
    print("red team が見つけられない trigger を選べます。")
    print("=" * 66)


if __name__ == "__main__":
    main()
