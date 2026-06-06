"""DP-SGD toy on binary logistic regression — stdlib Python.

Sweeps noise multiplier sigma, reports accuracy vs (epsilon, delta) budget.
Illustrates the privacy-utility tradeoff without a real privacy accountant;
the displayed epsilon is a Gaussian-mechanism analytical proxy.

Usage: python3 code/main.py
"""

from __future__ import annotations

import math
import random


random.seed(59)


def sigmoid(z: float) -> float:
    return 1.0 / (1.0 + math.exp(-z))


def gen(n: int) -> list[tuple[list[float], int]]:
    data = []
    for _ in range(n):
        x = [random.gauss(0.0, 1.0), random.gauss(0.0, 1.0)]
        y = 1 if 0.6 * x[0] - 0.4 * x[1] > 0 else 0
        data.append((x, y))
    return data


def clip(g: list[float], C: float) -> list[float]:
    n = math.sqrt(sum(x * x for x in g))
    if n <= C:
        return g
    return [x * C / n for x in g]


def dp_sgd(data, epochs: int, lr: float, sigma: float, C: float) -> list[float]:
    w = [0.0, 0.0]
    b = 0.0
    for _ in range(epochs):
        random.shuffle(data)
        for x, y in data:
            z = b + sum(wi * xi for wi, xi in zip(w, x))
            err = sigmoid(z) - y
            grad_w = [err * xi for xi in x]
            grad_b = err
            grad_w = clip(grad_w, C)
            grad_b = max(-C, min(C, grad_b))
            # add noise proportional to sigma * C.
            noise_w = [random.gauss(0.0, sigma * C) for _ in range(2)]
            noise_b = random.gauss(0.0, sigma * C)
            w = [wi - lr * (gi + ni) for wi, gi, ni in zip(w, grad_w, noise_w)]
            b -= lr * (grad_b + noise_b)
    return w + [b]


def accuracy(model, data) -> float:
    w, b = model[:2], model[2]
    correct = 0
    for x, y in data:
        z = b + sum(wi * xi for wi, xi in zip(w, x))
        if (1 if z > 0 else 0) == y:
            correct += 1
    return correct / len(data)


def analytical_epsilon(sigma: float, steps: int, delta: float = 1e-5) -> float:
    """Rough Gaussian-mechanism composition proxy.
    Each step contributes roughly 1/(2*sigma^2); composition bounds epsilon
    by sum. Real accountants (RDP, Moments) give tighter bounds."""
    return math.sqrt(2 * math.log(1.25 / delta)) * math.sqrt(steps) / sigma


def main() -> None:
    print("=" * 70)
    print("DP-SGD TOY (Phase 18, Lesson 22)")
    print("=" * 70)

    train_data = gen(500)
    test_data = gen(200)
    epochs = 10
    C = 1.0
    delta = 1e-5

    for sigma in (0.0, 0.5, 1.0, 2.0, 4.0):
        model = dp_sgd(train_data, epochs=epochs, lr=0.05, sigma=sigma, C=C)
        acc = accuracy(model, test_data)
        eps = analytical_epsilon(max(sigma, 0.01), steps=epochs * len(train_data), delta=delta)
        print(f"  sigma={sigma:4.1f}  approx-epsilon={eps:7.2f}  test-accuracy={acc:.3f}")

    print("\n" + "=" * 70)
    print("TAKEAWAY: sigma=0 is standard SGD with no privacy (infinite epsilon).")
    print("increasing sigma adds noise, shrinks epsilon, and costs accuracy.")
    print("real deployments target epsilon in [1, 10] via accountants like")
    print("Moments Accountant. Nasr et al. 2025 shows extraction-based threats")
    print("persist under moderate epsilon -- DP is necessary but not sufficient.")
    print("=" * 70)


if __name__ == "__main__":
    main()
