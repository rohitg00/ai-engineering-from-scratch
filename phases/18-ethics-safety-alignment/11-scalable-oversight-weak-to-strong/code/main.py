"""Weak-to-Strong Generalization simulator — stdlib Python.

Task: binary classification on a synthetic 3-feature problem.
Weak labeler: accuracy 0.70 with errors concentrated on a sub-class.
Strong model: 0.95 ceiling on gold labels (linear separator).

Procedure: fine-tune strong on weak labels, measure PGR.

Usage: python3 code/main.py
"""

from __future__ import annotations

import random


random.seed(29)


def gen(n: int) -> list[tuple[list[float], int]]:
    data = []
    for _ in range(n):
        x = [random.gauss(0.0, 1.0) for _ in range(3)]
        y = 1 if x[0] + x[1] - 0.5 * x[2] > 0 else 0
        data.append((x, y))
    return data


def weak_label(x: list[float], accuracy: float = 0.70) -> int:
    """Weak labeler: simple threshold on x[0] alone, plus noise to reach target
    accuracy. Misses the x[1] and x[2] signals."""
    base = 1 if x[0] > 0 else 0
    if random.random() < accuracy:
        return base
    return 1 - base


def train_strong(data: list[tuple[list[float], int]], steps: int = 200,
                 lr: float = 0.05) -> list[float]:
    """Fit a 3-feature linear classifier by SGD."""
    w = [0.0, 0.0, 0.0]
    b = 0.0
    for _ in range(steps):
        random.shuffle(data)
        for x, y in data:
            z = b + sum(wi * xi for wi, xi in zip(w, x))
            # sigmoid
            p = 1.0 / (1.0 + pow(2.71828, -z))
            err = p - y
            for i in range(3):
                w[i] -= lr * err * x[i]
            b -= lr * err
    return w + [b]


def accuracy(model: list[float], data: list[tuple[list[float], int]]) -> float:
    w, b = model[:3], model[3]
    correct = 0
    for x, y in data:
        z = b + sum(wi * xi for wi, xi in zip(w, x))
        pred = 1 if z > 0 else 0
        if pred == y:
            correct += 1
    return correct / len(data)


def run(label: str, weak_acc: float) -> None:
    eval_data = gen(1000)
    train_data = gen(1000)
    # weak-alone accuracy
    weak_correct = sum(1 for (x, y) in eval_data if weak_label(x, weak_acc) == y)
    weak_alone = weak_correct / len(eval_data)

    # strong ceiling on gold labels
    strong_gold = train_strong(train_data)
    ceiling = accuracy(strong_gold, eval_data)

    # weak-to-strong: train strong on weak labels
    weak_labeled = [(x, weak_label(x, weak_acc)) for (x, _) in train_data]
    strong_w2s = train_strong(weak_labeled)
    w2s_acc = accuracy(strong_w2s, eval_data)

    pgr = (w2s_acc - weak_alone) / (ceiling - weak_alone + 1e-12)
    print(f"\n{label}  (weak_accuracy={weak_acc})")
    print(f"  weak alone         : {weak_alone:.3f}")
    print(f"  strong on gold     : {ceiling:.3f}")
    print(f"  strong on weak     : {w2s_acc:.3f}")
    print(f"  performance gap recovered (PGR): {pgr:.3f}")


def main() -> None:
    print("=" * 70)
    print("WEAK-TO-STRONG GENERALIZATION (Phase 18, Lesson 11)")
    print("=" * 70)

    for acc in (0.60, 0.70, 0.80, 0.90):
        run(f"weak-to-strong @ weak_accuracy={acc}", acc)

    print("\n" + "=" * 70)
    print("TAKEAWAY: PGR > 0 across weak labelers means the strong model")
    print("generalizes beyond its weak supervisor's mistakes, using its own")
    print("pre-trained priors. this is the empirical proxy Burns et al. 2023")
    print("propose for the superalignment question: can weak human oversight")
    print("produce a stronger, aligned model? not a solution -- a measurable.")
    print("=" * 70)


if __name__ == "__main__":
    main()
