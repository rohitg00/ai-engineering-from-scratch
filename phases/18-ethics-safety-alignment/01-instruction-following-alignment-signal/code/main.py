"""Toy three-stage RLHF pipeline — stdlib Python.

Simulates InstructGPT's SFT + RM + PPO loop on a bandit with three actions.
Watch reward climb, KL divergence grow, and the policy drift. Turn off the
KL penalty to see reward hacking appear. Pedagogical toy — no torch.

Usage: python3 code/main.py
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field


random.seed(0)

ACTIONS = ["A", "B", "C"]


def softmax(logits: list[float]) -> list[float]:
    m = max(logits)
    exps = [math.exp(x - m) for x in logits]
    z = sum(exps)
    return [e / z for e in exps]


def kl(p: list[float], q: list[float]) -> float:
    return sum(pi * math.log(pi / qi) for pi, qi in zip(p, q) if pi > 0 and qi > 0)


@dataclass
class Policy:
    """Softmax policy over 3 actions. Logits are the trainable parameters."""
    logits: list[float] = field(default_factory=lambda: [0.0, 0.0, 0.0])

    def probs(self) -> list[float]:
        return softmax(self.logits)

    def sample(self) -> int:
        r = random.random()
        cum = 0.0
        for i, p in enumerate(self.probs()):
            cum += p
            if r < cum:
                return i
        return len(self.logits) - 1

    def logprob(self, a: int) -> float:
        return math.log(self.probs()[a] + 1e-12)

    def copy(self) -> "Policy":
        return Policy(logits=list(self.logits))


def labeler_true_utility() -> list[float]:
    """The 'human' rater prefers B, is neutral on A, slightly against C."""
    return [0.0, 1.0, -0.3]


def stage1_sft(n_demos: int = 200) -> Policy:
    """Imitation learning from labeler demonstrations.

    Labeler samples actions with probabilities softmax(utility). SFT maximum-
    likelihood estimates this distribution with a single-step gradient move.
    """
    utility = labeler_true_utility()
    target = softmax(utility)
    demos = []
    for _ in range(n_demos):
        r = random.random()
        cum = 0.0
        for i, p in enumerate(target):
            cum += p
            if r < cum:
                demos.append(i)
                break
    # closed-form MLE for categorical: log count frequencies
    counts = [0.0, 0.0, 0.0]
    for a in demos:
        counts[a] += 1
    total = sum(counts)
    logits = [math.log(c / total + 1e-6) for c in counts]
    # center for numerical stability
    m = sum(logits) / 3
    logits = [x - m for x in logits]
    return Policy(logits=logits)


def stage2_reward_model(n_pairs: int = 500, bias: list[float] | None = None) -> list[float]:
    """Bradley-Terry fit of a scalar reward over actions.

    Labeler prefers action with higher true utility. We fit one scalar per
    action by SGD on pairwise cross-entropy. Optional `bias` injects a
    reward-model bug (used in Exercise 2).
    """
    utility = labeler_true_utility()
    r = [0.0, 0.0, 0.0]
    lr = 0.05
    for _ in range(n_pairs):
        i, j = random.sample(range(3), 2)
        p_prefer_i = 1 / (1 + math.exp(-(utility[i] - utility[j])))
        winner = i if random.random() < p_prefer_i else j
        loser = j if winner == i else i
        # BT gradient: dL/dr_w = -(1 - sigmoid(r_w - r_l))
        diff = r[winner] - r[loser]
        s = 1 / (1 + math.exp(-diff))
        r[winner] += lr * (1 - s)
        r[loser] -= lr * (1 - s)
    if bias:
        r = [ri + bi for ri, bi in zip(r, bias)]
    # center reward (RL is invariant to constant shifts)
    m = sum(r) / 3
    return [x - m for x in r]


def stage3_ppo(sft: Policy, reward: list[float], beta: float,
               steps: int = 300, batch: int = 32,
               lr: float = 0.1) -> tuple[Policy, list[float], list[float]]:
    """Toy REINFORCE-with-KL (a stripped-down PPO).

    For each step: sample a batch from current policy, take a policy-gradient
    step on `r(a) - beta * log(pi / pi_sft)`. Tracks mean reward and KL.
    """
    pi = sft.copy()
    reward_traj: list[float] = []
    kl_traj: list[float] = []
    sft_probs = sft.probs()
    for _ in range(steps):
        advantages = [0.0, 0.0, 0.0]
        counts = [0, 0, 0]
        total_r = 0.0
        for _ in range(batch):
            a = pi.sample()
            r_a = reward[a]
            # KL-shaped per-sample reward
            penalty = beta * (math.log(pi.probs()[a] + 1e-12)
                              - math.log(sft_probs[a] + 1e-12))
            shaped = r_a - penalty
            advantages[a] += shaped
            counts[a] += 1
            total_r += r_a
        for a in range(3):
            if counts[a] > 0:
                advantages[a] /= counts[a]
        # softmax policy gradient: grad logit_a = (1_{a} - pi_a) * advantage
        probs = pi.probs()
        grad = [0.0, 0.0, 0.0]
        for a in range(3):
            for b in range(3):
                indicator = 1.0 if a == b else 0.0
                grad[b] += advantages[a] * probs[a] * (indicator - probs[b])
        pi.logits = [l + lr * g for l, g in zip(pi.logits, grad)]
        reward_traj.append(total_r / batch)
        kl_traj.append(kl(pi.probs(), sft_probs))
    return pi, reward_traj, kl_traj


def report(name: str, sft: Policy, rlhf: Policy, reward: list[float],
           r_traj: list[float], kl_traj: list[float]) -> None:
    print(f"\n{name}")
    print("-" * 60)
    print(f"  SFT probs     : {[f'{p:.3f}' for p in sft.probs()]}")
    print(f"  RLHF probs    : {[f'{p:.3f}' for p in rlhf.probs()]}")
    print(f"  Reward model  : {[f'{r:+.3f}' for r in reward]}")
    print(f"  Final reward  : {r_traj[-1]:+.3f}")
    print(f"  Final KL      : {kl_traj[-1]:.3f} nats")
    print(f"  Max reward    : {max(r_traj):+.3f} at step {r_traj.index(max(r_traj))}")


def main() -> None:
    print("=" * 60)
    print("INSTRUCTGPT TOY PIPELINE (Phase 18, Lesson 1)")
    print("=" * 60)

    sft = stage1_sft()
    print("\nStage 1 SFT complete.")
    print(f"  SFT policy: {[f'{p:.3f}' for p in sft.probs()]}")

    rm = stage2_reward_model()
    print("\nStage 2 RM complete.")
    print(f"  Reward per action: {[f'{r:+.3f}' for r in rm]}")

    # Standard RLHF: small-beta KL keeps us near SFT.
    rlhf, r_traj, kl_traj = stage3_ppo(sft, rm, beta=0.1)
    report("Run 1: beta = 0.10 (standard InstructGPT)", sft, rlhf, rm, r_traj, kl_traj)

    # Reward hacking: kill the KL.
    rlhf2, r2, kl2 = stage3_ppo(sft, rm, beta=0.0)
    report("Run 2: beta = 0.00 (no KL — reward hacking shows up)",
           sft, rlhf2, rm, r2, kl2)

    # RM bug: +0.5 bias on action A. With KL on, partial exploitation.
    rm_buggy = stage2_reward_model(bias=[0.5, 0.0, 0.0])
    rlhf3, r3, kl3 = stage3_ppo(sft, rm_buggy, beta=0.1)
    report("Run 3: buggy RM (+0.5 on action A), beta = 0.10",
           sft, rlhf3, rm_buggy, r3, kl3)

    print("\n" + "=" * 60)
    print("TAKEAWAY: KL penalty trades reward for faithfulness. beta is the")
    print("single most important RLHF hyperparameter. beta = 0 is not PPO;")
    print("it is adversarial optimization against an imperfect proxy.")
    print("=" * 60)


if __name__ == "__main__":
    main()
