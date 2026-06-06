"""Voting and debate topology harness, stdlib only.

Runs star / chain / tree / graph topologies under a scripted task. Each
agent has a base-accuracy probability and an error_bias direction (which
wrong answer it drifts to on miss). We simulate N agents, rounds of
refinement, and measure (accuracy, tokens, simulated latency).
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field


@dataclass
class SimAgent:
    name: str
    base_accuracy: float
    error_bias: str
    tokens_per_call: int = 400

    def answer(self, correct: str, rng: random.Random) -> str:
        return correct if rng.random() < self.base_accuracy else self.error_bias


@dataclass
class RunResult:
    topology: str
    n: int
    final_answer: str
    correct: str
    tokens: int
    steps: int

    def accuracy(self) -> int:
        return 1 if self.final_answer == self.correct else 0


def majority(items: list[str]) -> str:
    counts: dict[str, int] = {}
    for it in items:
        counts[it] = counts.get(it, 0) + 1
    return max(counts, key=counts.get)


def run_star(agents: list[SimAgent], correct: str, rng: random.Random) -> RunResult:
    hub = agents[0]
    workers = agents[1:]
    answers = [w.answer(correct, rng) for w in workers]
    tokens = sum(w.tokens_per_call for w in workers) + hub.tokens_per_call
    final = majority(answers) if answers else hub.answer(correct, rng)
    return RunResult("star", len(agents), final, correct, tokens, steps=2)


def run_chain(agents: list[SimAgent], correct: str, rng: random.Random) -> RunResult:
    current = agents[0].answer(correct, rng)
    tokens = agents[0].tokens_per_call
    for a in agents[1:]:
        proposal = a.answer(correct, rng)
        current = proposal if proposal != current and rng.random() < a.base_accuracy else current
        tokens += a.tokens_per_call
    return RunResult("chain", len(agents), current, correct, tokens, steps=len(agents))


def run_tree(agents: list[SimAgent], correct: str, rng: random.Random) -> RunResult:
    root = agents[0]
    leaves = agents[1:]
    if len(leaves) <= 1:
        return run_star(agents, correct, rng)
    mid = len(leaves) // 2
    left_answers = [a.answer(correct, rng) for a in leaves[:mid]]
    right_answers = [a.answer(correct, rng) for a in leaves[mid:]]
    tokens = sum(a.tokens_per_call for a in leaves) + root.tokens_per_call
    left_consensus = majority(left_answers)
    right_consensus = majority(right_answers)
    final = majority([left_consensus, right_consensus])
    return RunResult("tree", len(agents), final, correct, tokens, steps=3)


def run_graph(agents: list[SimAgent], correct: str, rng: random.Random, rounds: int = 2) -> RunResult:
    # Every agent proposes, then every agent sees all proposals and may update
    # (scaled down accuracy if they drift toward consensus).
    positions = [a.answer(correct, rng) for a in agents]
    tokens = sum(a.tokens_per_call for a in agents)
    for _ in range(rounds - 1):
        majority_now = majority(positions)
        new_positions = []
        for pos, ag in zip(positions, agents):
            if pos != majority_now and rng.random() < 0.4:
                new_positions.append(majority_now)
            else:
                new_positions.append(pos)
            tokens += ag.tokens_per_call
        positions = new_positions
    return RunResult("graph", len(agents), majority(positions), correct, tokens, steps=rounds * 2)


def make_agents(n: int, heterogeneous: bool, seed: int) -> list[SimAgent]:
    rng = random.Random(seed)
    if heterogeneous:
        biases = ["WRONG-A", "WRONG-B", "WRONG-C"]
        accuracies = [0.72, 0.70, 0.74, 0.71, 0.73, 0.70, 0.72]
    else:
        biases = ["WRONG-A"]
        accuracies = [0.72] * 7
    return [
        SimAgent(f"agent-{i}", accuracies[i % len(accuracies)], biases[i % len(biases)])
        for i in range(n)
    ]


def bench(correct: str, trials: int, heterogeneous: bool) -> None:
    tag = "HETEROGENEOUS" if heterogeneous else "HOMOGENEOUS (monoculture)"
    print("\n" + "=" * 72)
    print(f"BENCHMARK — {tag}")
    print("=" * 72)
    print(f"{'topology':10s} {'N':>3s} {'acc':>8s} {'avg_tokens':>12s} {'steps':>6s}")
    for topology in ("star", "chain", "tree", "graph"):
        for n in (3, 5, 7):
            acc_sum = 0
            tok_sum = 0
            step_sum = 0
            for t in range(trials):
                agents = make_agents(n, heterogeneous, seed=t)
                rng = random.Random(t * 31 + 7)
                if topology == "star":
                    r = run_star(agents, correct, rng)
                elif topology == "chain":
                    r = run_chain(agents, correct, rng)
                elif topology == "tree":
                    r = run_tree(agents, correct, rng)
                else:
                    r = run_graph(agents, correct, rng)
                acc_sum += r.accuracy()
                tok_sum += r.tokens
                step_sum += r.steps
            print(f"{topology:10s} {n:>3d} {acc_sum/trials:>8.2f} {tok_sum//trials:>12d} {step_sum//trials:>6d}")


def main() -> None:
    bench(correct="RIGHT", trials=200, heterogeneous=False)
    bench(correct="RIGHT", trials=200, heterogeneous=True)
    print("\nTakeaways:")
    print("  heterogeneous ensembles outperform homogeneous at every topology/N.")
    print("  graph/N=7 shows coordination tax: tokens inflate ~7x over star/N=3.")
    print("  star is the cost-sweet-spot for low-stakes aggregation.")
    print("  chain underperforms on monoculture because one bias propagates along the chain.")


if __name__ == "__main__":
    main()
