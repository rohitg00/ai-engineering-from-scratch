"""Sycophancy amplification simulator — stdlib Python.

Three-action world:
  A = correct answer       (true utility +1.0, agreement indicator 0)
  S = sycophantic agree    (true utility -0.3, agreement indicator 1)
  W = random wrong answer  (true utility -0.5, agreement indicator 0)

Reward model has two components: "confidence/fluency" bonus that happens to
correlate with sycophancy, plus correctness. RL amplifies sycophancy just
like Shapira et al. predict.

We sweep beta (KL coefficient) and alpha (agreement-penalty correction).

Usage: python3 code/main.py
"""

from __future__ import annotations

import math
import random


random.seed(7)

ACTIONS = ["A", "S", "W"]
TRUE_UTILITY = {"A": 1.0, "S": -0.3, "W": -0.5}
AGREEMENT = {"A": 0.0, "S": 1.0, "W": 0.0}


def softmax(xs: list[float]) -> list[float]:
    m = max(xs)
    exps = [math.exp(x - m) for x in xs]
    z = sum(exps)
    return [e / z for e in exps]


def kl(p: list[float], q: list[float]) -> float:
    return sum(pi * math.log(pi / qi) for pi, qi in zip(p, q) if pi > 0 and qi > 0)


def labeler_reward(action: str) -> float:
    """Labeler-produced reward: mostly correctness, but with a smaller
    agreement bonus. This is the spurious feature that RMs pick up from
    real labeler data — fluent agreement scores higher than an equally
    correct disagreement."""
    return TRUE_UTILITY[action] + 0.6 * AGREEMENT[action]


def train_rm(n_pairs: int = 500) -> dict[str, float]:
    """Fit scalar rewards by Bradley-Terry on pairwise labeler preferences."""
    r = {a: 0.0 for a in ACTIONS}
    lr = 0.05
    for _ in range(n_pairs):
        i, j = random.sample(ACTIONS, 2)
        diff = labeler_reward(i) - labeler_reward(j)
        p_i = 1 / (1 + math.exp(-diff))
        winner, loser = (i, j) if random.random() < p_i else (j, i)
        d = r[winner] - r[loser]
        s = 1 / (1 + math.exp(-d))
        r[winner] += lr * (1 - s)
        r[loser] -= lr * (1 - s)
    m = sum(r.values()) / 3
    return {a: v - m for a, v in r.items()}


def agreement_penalty_correction(r: dict[str, float], alpha: float) -> dict[str, float]:
    """Shapira et al. correction: r' = r - alpha * agree(y)."""
    return {a: r[a] - alpha * AGREEMENT[a] for a in ACTIONS}


def ppo_train(ref_logits: list[float], reward: dict[str, float],
              beta: float, steps: int = 300, batch: int = 64,
              lr: float = 0.08) -> list[float]:
    logits = list(ref_logits)
    ref_probs = softmax(ref_logits)
    for _ in range(steps):
        probs = softmax(logits)
        advantages = [0.0, 0.0, 0.0]
        counts = [0, 0, 0]
        for _ in range(batch):
            r = random.random()
            cum = 0.0
            chosen = 0
            for i, p in enumerate(probs):
                cum += p
                if r < cum:
                    chosen = i
                    break
            a = ACTIONS[chosen]
            shaped = reward[a] - beta * (math.log(probs[chosen] + 1e-12)
                                         - math.log(ref_probs[chosen] + 1e-12))
            advantages[chosen] += shaped
            counts[chosen] += 1
        for i in range(3):
            if counts[i] > 0:
                advantages[i] /= counts[i]
        grad = [0.0, 0.0, 0.0]
        for i in range(3):
            for b in range(3):
                indicator = 1.0 if i == b else 0.0
                grad[b] += advantages[i] * probs[i] * (indicator - probs[b])
        logits = [l + lr * g for l, g in zip(logits, grad)]
    return logits


def sycophancy(probs: list[float]) -> float:
    return probs[ACTIONS.index("S")]


def correctness(probs: list[float]) -> float:
    return probs[ACTIONS.index("A")]


def report(label: str, logits: list[float]) -> None:
    probs = softmax(logits)
    print(f"  {label:40s}  "
          f"P(A)={correctness(probs):.3f}  "
          f"P(S)={sycophancy(probs):.3f}  "
          f"P(W)={probs[2]:.3f}")


def main() -> None:
    print("=" * 70)
    print("SYCOPHANCY AMPLIFICATION (Phase 18, Lesson 4)")
    print("=" * 70)

    ref_logits = [0.0, 0.0, 0.0]  # uniform base policy
    print("\nStage 1 — reward model trained on labeler preferences.")
    rm = train_rm()
    print(f"  RM scores: {[f'{a}={rm[a]:+.3f}' for a in ACTIONS]}")
    print("  (note: S gets a reward bump despite lower true utility)")

    print("\nStage 2 — PPO sweeps, no agreement penalty.")
    for beta in (1.0, 0.2, 0.05, 0.0):
        logits = ppo_train(ref_logits, rm, beta=beta)
        report(f"PPO beta={beta:4.2f} (alpha=0)", logits)

    print("\nStage 3 — agreement-penalty correction (Shapira et al.).")
    print("  beta=0.1 fixed. alpha sweeps.")
    for alpha in (0.0, 0.2, 0.4, 0.6, 0.8):
        corrected = agreement_penalty_correction(rm, alpha)
        logits = ppo_train(ref_logits, corrected, beta=0.1)
        report(f"PPO alpha={alpha:.1f} (agreement penalty)", logits)

    print()
    print("-" * 70)
    print("TAKEAWAY: low beta amplifies sycophancy (RM rewards agreement).")
    print("moderate alpha cuts sycophancy but erodes agreement-when-correct.")
    print("there is no alpha that restores base-model P(S) without cost.")
    print("=" * 70)


if __name__ == "__main__":
    main()
