"""Minimal AlphaEvolve-like evolutionary loop — stdlib Python.

Toy symbolic regression. The "LLM" proposes a small mutation to a candidate
expression (change a constant, change an operator, add a term). The
"evaluator" scores the expression on training and held-out test points.

MAP-elites grid keeps diverse candidates: cell keyed by (expression depth,
constant magnitude bucket). Without a held-out split the loop overfits
aggressively; with one the best candidate generalizes.
"""

from __future__ import annotations

import argparse
import math
import random
from dataclasses import dataclass


DEFAULT_SEED = 1


# Target function the loop tries to rediscover.
def target(x: float) -> float:
    return 2.0 * x * x + 3.0 * x - 1.0


Expr = tuple  # recursive: ("num", v) | ("x",) | ("add", a, b) | ("mul", a, b)


def evaluate_expr(e: Expr, x: float) -> float:
    tag = e[0]
    if tag == "num":
        return float(e[1])
    if tag == "x":
        return x
    if tag == "add":
        return evaluate_expr(e[1], x) + evaluate_expr(e[2], x)
    if tag == "mul":
        return evaluate_expr(e[1], x) * evaluate_expr(e[2], x)
    raise ValueError(tag)


def depth(e: Expr) -> int:
    tag = e[0]
    if tag in ("num", "x"):
        return 1
    return 1 + max(depth(e[1]), depth(e[2]))


def max_const(e: Expr) -> float:
    tag = e[0]
    if tag == "num":
        return abs(e[1])
    if tag == "x":
        return 0.0
    return max(max_const(e[1]), max_const(e[2]))


def mutate(e: Expr) -> Expr:
    """Stand-in for the LLM's targeted edit."""
    choice = random.random()
    if choice < 0.25:
        return random_leaf()
    if choice < 0.5:
        return ("add", e, random_leaf())
    if choice < 0.75:
        return ("mul", e, random_leaf())
    # perturb a constant somewhere
    return perturb(e)


def perturb(e: Expr) -> Expr:
    tag = e[0]
    if tag == "num":
        return ("num", e[1] + random.choice([-1.0, -0.5, 0.5, 1.0]))
    if tag == "x":
        return e
    return (tag, perturb(e[1]), e[2]) if random.random() < 0.5 else (tag, e[1], perturb(e[2]))


def random_leaf() -> Expr:
    if random.random() < 0.5:
        return ("x",)
    return ("num", float(random.choice([-2, -1, 0, 1, 2, 3])))


def render(e: Expr) -> str:
    tag = e[0]
    if tag == "num":
        return f"{e[1]:g}"
    if tag == "x":
        return "x"
    op = "+" if tag == "add" else "*"
    return f"({render(e[1])} {op} {render(e[2])})"


def mse(e: Expr, xs: list[float]) -> float:
    total = 0.0
    for x in xs:
        try:
            y = evaluate_expr(e, x)
        except (OverflowError, ValueError):
            return float("inf")
        total += (y - target(x)) ** 2
    return total / max(1, len(xs))


@dataclass
class Candidate:
    expr: Expr
    train_score: float
    test_score: float
    generation: int


def cell_key(e: Expr) -> tuple[int, int]:
    d = min(depth(e), 6)
    c = min(int(max_const(e) / 2), 4)
    return (d, c)


def seed_candidate(test_xs: list[float], train_xs: list[float], gen: int) -> Candidate:
    e = random_leaf()
    return Candidate(e, mse(e, train_xs), mse(e, test_xs), gen)


def run_loop(
    generations: int,
    pop: int,
    use_holdout: bool,
    seed: int | None = None,
) -> tuple[Candidate, list[float], list[float]]:
    if seed is not None:
        random.seed(seed)
    train_xs = [-2.0, -1.0, 0.0, 1.0, 2.0, 3.0]
    test_xs = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 3.5]

    def signal_of(c: Candidate) -> float:
        return 0.5 * (c.train_score + c.test_score) if use_holdout else c.train_score

    archive: dict[tuple[int, int], Candidate] = {}
    for _ in range(pop):
        c = seed_candidate(test_xs, train_xs, 0)
        key = cell_key(c.expr)
        incumbent = archive.get(key)
        if incumbent is None or signal_of(c) < signal_of(incumbent):
            archive[key] = c

    best_trace: list[float] = []
    test_trace: list[float] = []
    for g in range(1, generations + 1):
        parent = random.choice(list(archive.values()))
        child_expr = mutate(parent.expr)
        tr = mse(child_expr, train_xs)
        te = mse(child_expr, test_xs)
        child = Candidate(child_expr, tr, te, g)
        key = cell_key(child_expr)
        incumbent = archive.get(key)
        if incumbent is None or signal_of(child) < signal_of(incumbent):
            archive[key] = child

        best = min(archive.values(), key=lambda c: c.train_score)
        best_trace.append(best.train_score)
        test_trace.append(best.test_score)

    # Final selection must use the same signal as the search: using the
    # held-out test here when use_holdout=False would silently leak the
    # holdout back into Run B and mask the overfitting the lesson shows.
    best = min(archive.values(), key=signal_of)
    return best, best_trace, test_trace


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--no-holdout",
        action="store_true",
        help="skip the held-out test evaluator (Run B only; forces reward-hacking demo)",
    )
    args = parser.parse_args()

    print("=" * 70)
    print("ALPHAEVOLVE-STYLE LOOP (Phase 15, Lesson 3)")
    print("=" * 70)
    print("target: 2x^2 + 3x - 1")

    if not args.no_holdout:
        print("\nRun A: held-out test included in evaluator signal")
        best, train_trace, _ = run_loop(
            generations=1500, pop=20, use_holdout=True, seed=DEFAULT_SEED
        )
        print(f"  best expr : {render(best.expr)}")
        print(f"  train MSE : {best.train_score:.4f}")
        print(f"  test  MSE : {best.test_score:.4f}")
        print(f"  generation: {best.generation}")
        print("  progress  : gen 100 train={:.3f} gen 500 train={:.3f} gen 1500 train={:.3f}".format(
            train_trace[99], train_trace[499], train_trace[-1]))

    print("\nRun B: no held-out test (train-only evaluator -> reward hacking risk)")
    best, _train_trace, _test_trace = run_loop(
        generations=1500, pop=20, use_holdout=False, seed=DEFAULT_SEED
    )
    print(f"  best expr : {render(best.expr)}")
    print(f"  train MSE : {best.train_score:.4f}")
    print(f"  test  MSE : {best.test_score:.4f}")
    print(f"  generation: {best.generation}")
    gap = best.test_score - best.train_score
    print(f"  train-to-test gap: {gap:+.4f}  (large gap = overfit/reward hacking proxy)")

    print()
    print("=" * 70)
    print("HEADLINE: the evaluator is the architecture")
    print("-" * 70)
    print("  Run A converges to low train AND low test MSE.")
    print("  Run B converges to low train MSE; test MSE stays loose or worse.")
    print("  A held-out evaluator is the difference between discovery and")
    print("  reward hacking. AlphaEvolve's wins are in domains where such an")
    print("  evaluator exists. Picking those domains is the hard part.")


if __name__ == "__main__":
    main()
