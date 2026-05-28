"""Weak-to-Strong Generalization simulator — stdlib Python.

タスク: 合成 3-feature 問題の binary classification。
弱い labeler: accuracy 0.70、誤りは sub-class に集中する。
強いモデル: gold labels 上で 0.95 ceiling (linear separator)。

手順: 弱いラベルで強いモデルを fine-tune し、PGR を測る。

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
    """弱い labeler: x[0] だけへの単純な threshold と、target accuracy に
    合わせるための noise。x[1] と x[2] の signal を見落とす。"""
    base = 1 if x[0] > 0 else 0
    if random.random() < accuracy:
        return base
    return 1 - base


def train_strong(data: list[tuple[list[float], int]], steps: int = 200,
                 lr: float = 0.05) -> list[float]:
    """3-feature linear classifier を SGD で fit する。"""
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

    # gold labels 上の strong ceiling
    strong_gold = train_strong(train_data)
    ceiling = accuracy(strong_gold, eval_data)

    # weak-to-strong: 弱いラベルで強いモデルを訓練する
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
    print("要点: 弱い labeler 全体で PGR > 0 なら、強いモデルは自分の")
    print("pre-trained priors を使い、弱い監督者の誤りを超えて汎化している。")
    print("これは Burns et al. 2023 が superalignment の問い、つまり弱い")
    print("人間の監督でより強く aligned なモデルを作れるか、に対して提案した")
    print("経験的 proxy である。解ではなく、測定可能な量である。")
    print("=" * 70)


if __name__ == "__main__":
    main()
