"""Agent economies: Shapley attribution, second-price auction, reputation routing.

All stdlib. Shapley is exact for N<=6 and sampled otherwise. Second-price
auction demonstrates truthful bidding. Reputation routing compares
rep-weighted vs random assignment over 100 rounds.
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from itertools import permutations
from typing import Callable


# ---------- Shapley ----------

def shapley_exact(value_fn: Callable[[frozenset], float], agents: list[str]) -> dict[str, float]:
    n = len(agents)
    contribs = {a: 0.0 for a in agents}
    for order in permutations(agents):
        visited: set[str] = set()
        prev_value = value_fn(frozenset(visited))
        for a in order:
            visited.add(a)
            new_value = value_fn(frozenset(visited))
            contribs[a] += new_value - prev_value
            prev_value = new_value
    factorial = math.factorial(n)
    return {a: v / factorial for a, v in contribs.items()}


def shapley_sampled(value_fn: Callable[[frozenset], float], agents: list[str],
                    samples: int, rng: random.Random) -> dict[str, float]:
    contribs = {a: 0.0 for a in agents}
    for _ in range(samples):
        order = list(agents)
        rng.shuffle(order)
        visited: set[str] = set()
        prev_value = value_fn(frozenset(visited))
        for a in order:
            visited.add(a)
            new_value = value_fn(frozenset(visited))
            contribs[a] += new_value - prev_value
            prev_value = new_value
    return {a: v / samples for a, v in contribs.items()}


# ---------- Second-price auction ----------

@dataclass
class Bid:
    bidder: str
    value: float


def second_price(bids: list[Bid]) -> tuple[str, float] | None:
    if len(bids) < 2:
        return None
    sorted_bids = sorted(bids, key=lambda b: b.value, reverse=True)
    winner = sorted_bids[0].bidder
    payment = sorted_bids[1].value
    return winner, payment


# ---------- Reputation-weighted routing ----------

class Reputation:
    def __init__(self, alpha: float = 0.95, floor: float = 0.1) -> None:
        self.alpha = alpha
        self.floor = floor
        self.scores: dict[str, float] = {}

    def init(self, agents: list[str]) -> None:
        for a in agents:
            self.scores[a] = 1.0

    def update(self, agent: str, quality: float) -> None:
        current = self.scores.get(agent, 1.0)
        self.scores[agent] = max(self.floor, self.alpha * current + (1 - self.alpha) * quality)

    def weights(self, agents: list[str]) -> list[float]:
        return [self.scores.get(a, 1.0) for a in agents]


def weighted_choice(agents: list[str], weights: list[float], rng: random.Random) -> str:
    total = sum(weights)
    r = rng.random() * total
    upto = 0.0
    for a, w in zip(agents, weights):
        upto += w
        if r <= upto:
            return a
    return agents[-1]


# ---------- demos ----------

def demo_shapley() -> None:
    print("=" * 72)
    print("SHAPLEY ATTRIBUTION — 3 agents collaborate on a task")
    print("=" * 72)

    # Value function: coder alone = 0.5, researcher alone = 0.3, reviewer alone = 0.1,
    # pairs and trio gain superadditively.
    base = {
        frozenset(): 0.0,
        frozenset(["coder"]): 0.5,
        frozenset(["researcher"]): 0.3,
        frozenset(["reviewer"]): 0.1,
        frozenset(["coder", "researcher"]): 0.85,
        frozenset(["coder", "reviewer"]): 0.70,
        frozenset(["researcher", "reviewer"]): 0.55,
        frozenset(["coder", "researcher", "reviewer"]): 1.00,
    }
    value_fn = lambda s: base[s]
    agents = ["coder", "researcher", "reviewer"]

    exact = shapley_exact(value_fn, agents)
    print("  exact Shapley values:")
    for a, v in exact.items():
        print(f"    {a:11s} {v:.4f}")
    print(f"    sum = {sum(exact.values()):.4f} (should equal grand coalition value 1.0000)")

    rng = random.Random(0)
    sampled = shapley_sampled(value_fn, agents, samples=200, rng=rng)
    print("\n  sampled Shapley values (N=200):")
    for a, v in sampled.items():
        print(f"    {a:11s} {v:.4f}")


def demo_auction() -> None:
    print("\n" + "=" * 72)
    print("SECOND-PRICE AUCTION — 5 bidders compete for a task slot")
    print("=" * 72)
    bids = [
        Bid("agent-a", 0.82),
        Bid("agent-b", 0.60),
        Bid("agent-c", 0.95),
        Bid("agent-d", 0.45),
        Bid("agent-e", 0.77),
    ]
    for b in bids:
        print(f"  {b.bidder:10s} bids {b.value:.2f}")
    result = second_price(bids)
    if result:
        winner, payment = result
        print(f"\n  winner: {winner}  payment: {payment:.2f}")
        print("  (winner pays second-highest bid; this is truthful)")


def demo_reputation_routing() -> None:
    print("\n" + "=" * 72)
    print("REPUTATION-WEIGHTED ROUTING — 100 tasks, 4 agents, 50 warmup")
    print("=" * 72)
    agents = ["alpha", "beta", "gamma", "delta"]
    true_quality = {"alpha": 0.9, "beta": 0.5, "gamma": 0.75, "delta": 0.3}

    rng = random.Random(0)

    # Random baseline
    random_quality = 0.0
    for _ in range(100):
        a = rng.choice(agents)
        q = max(0.0, min(1.0, true_quality[a] + rng.uniform(-0.1, 0.1)))
        random_quality += q

    # Rep-weighted with 50 warmup
    rng = random.Random(0)
    rep = Reputation()
    rep.init(agents)
    rep_quality = 0.0
    for i in range(100):
        if i < 50:
            a = rng.choice(agents)  # warmup: learn everyone
        else:
            a = weighted_choice(agents, rep.weights(agents), rng)
        q = max(0.0, min(1.0, true_quality[a] + rng.uniform(-0.1, 0.1)))
        rep.update(a, q)
        rep_quality += q

    print(f"  random routing avg quality:   {random_quality / 100:.3f}")
    print(f"  rep-weighted routing:         {rep_quality / 100:.3f}")
    print(f"  improvement: {(rep_quality - random_quality) / random_quality * 100:+.1f}%")
    print("\n  final reputation scores:")
    for a in agents:
        print(f"    {a:8s} rep={rep.scores[a]:.3f}  true={true_quality[a]:.2f}")


def main() -> None:
    demo_shapley()
    demo_auction()
    demo_reputation_routing()
    print("\nTakeaways:")
    print("  Shapley is fair but expensive. Sample for N > 6.")
    print("  Second-price auctions are truthful under monotone aggregation (Google Research).")
    print("  Reputation capital closes the loop: good routing + decay + slashing.")


if __name__ == "__main__":
    main()
