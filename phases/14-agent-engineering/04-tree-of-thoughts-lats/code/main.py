"""Toy Tree-of-Thoughts BFS and LATS MCTS on a stylized arithmetic search.

Task: given integers [4, 6, 4, 1], find an expression using +, -, *, / that
evaluates to 24. This mirrors the Game of 24 benchmark from Yao et al.

ToT is a BFS with a prompted value function. LATS is MCTS over the same
search space with UCT selection.

Stdlib only; no LLM. Value function is symbolic (distance from 24).
"""

from __future__ import annotations

import itertools
import math
import random
from dataclasses import dataclass, field


NUMBERS = [4, 6, 4, 1]
TARGET = 24
OPS = ["+", "-", "*", "/"]


@dataclass
class Node:
    state: tuple[float, ...]
    trace: list[str]
    visits: int = 0
    value_sum: float = 0.0
    children: list["Node"] = field(default_factory=list)

    @property
    def q(self) -> float:
        return self.value_sum / self.visits if self.visits else 0.0


def evaluate(a: float, op: str, b: float) -> float | None:
    if op == "+":
        return a + b
    if op == "-":
        return a - b
    if op == "*":
        return a * b
    if op == "/":
        return a / b if b != 0 else None
    return None


def expand(node: Node) -> list[Node]:
    children: list[Node] = []
    state = node.state
    if len(state) < 2:
        return children
    for i, j in itertools.combinations(range(len(state)), 2):
        for op in OPS:
            a, b = state[i], state[j]
            v = evaluate(a, op, b)
            if v is None:
                continue
            remaining = [s for k, s in enumerate(state) if k not in (i, j)]
            new_state = tuple(sorted(remaining + [v], reverse=True))
            step = f"{a}{op}{b}={v}"
            children.append(Node(state=new_state, trace=node.trace + [step]))
    return children


def value(node: Node) -> float:
    if len(node.state) == 1:
        result = node.state[0]
        return 1.0 if abs(result - TARGET) < 1e-6 else -abs(result - TARGET) / 100.0
    best_distance = min(abs(v - TARGET) for v in node.state)
    return -best_distance / 100.0


def tot_bfs(root: Node, max_expansions_per_level: int = 8,
            max_depth: int = 3) -> tuple[Node | None, int]:
    frontier = [root]
    expansions = 0
    for _ in range(max_depth):
        scored: list[tuple[float, Node]] = []
        for node in frontier:
            for child in expand(node):
                expansions += 1
                scored.append((value(child), child))
                if value(child) > 0.99:
                    return child, expansions
        scored.sort(key=lambda p: p[0], reverse=True)
        frontier = [n for _, n in scored[:max_expansions_per_level]]
    best = max(frontier, key=value) if frontier else None
    return best, expansions


def uct(parent: Node, child: Node, c: float = 1.4) -> float:
    if child.visits == 0:
        return float("inf")
    return child.q + c * math.sqrt(math.log(parent.visits) / child.visits)


def select(node: Node) -> Node:
    while node.children:
        node = max(node.children, key=lambda ch: uct(node, ch))
    return node


def simulate(node: Node, depth: int, rng: random.Random) -> float:
    current = node
    for _ in range(depth):
        options = expand(current)
        if not options:
            break
        current = rng.choice(options)
    return value(current)


def backprop(path: list[Node], reward: float) -> None:
    for n in path:
        n.visits += 1
        n.value_sum += reward


def mcts(root: Node, iterations: int, rng: random.Random) -> tuple[Node, int]:
    expansions = 0
    for _ in range(iterations):
        path = [root]
        cur = root
        while cur.children:
            cur = max(cur.children, key=lambda ch: uct(cur, ch))
            path.append(cur)
        if cur.visits > 0 and len(cur.state) > 1:
            cur.children = expand(cur)
            expansions += len(cur.children)
            if cur.children:
                cur = cur.children[0]
                path.append(cur)
        reward = simulate(cur, depth=max(0, 3 - len(cur.trace)), rng=rng)
        backprop(path, reward)
    best_leaf = max(_all_leaves(root), key=value, default=root)
    return best_leaf, expansions


def _all_leaves(node: Node) -> list[Node]:
    if not node.children:
        return [node]
    out: list[Node] = []
    for ch in node.children:
        out.extend(_all_leaves(ch))
    return out


def main() -> None:
    print("=" * 70)
    print("TREE OF THOUGHTS + LATS — Phase 14, Lesson 04")
    print("=" * 70)
    print(f"numbers: {NUMBERS}  target: {TARGET}")

    root_tot = Node(state=tuple(sorted(NUMBERS, reverse=True)), trace=[])
    best_tot, n_tot = tot_bfs(root_tot)
    print("\nToT BFS")
    print("-" * 60)
    if best_tot is not None:
        print(f"  best trace: {best_tot.trace}")
        print(f"  final state: {best_tot.state}  value: {value(best_tot):.3f}")
    print(f"  expansions: {n_tot}")

    rng = random.Random(7)
    root_lats = Node(state=tuple(sorted(NUMBERS, reverse=True)), trace=[])
    root_lats.children = expand(root_lats)
    for ch in root_lats.children:
        ch.visits = 0
    best_lats, n_lats = mcts(root_lats, iterations=80, rng=rng)
    print("\nLATS MCTS")
    print("-" * 60)
    print(f"  best trace: {best_lats.trace}")
    print(f"  final state: {best_lats.state}  value: {value(best_lats):.3f}")
    print(f"  node expansions: {n_lats}")

    print()
    print("Paper headlines (for reference):")
    print("  ToT Game-of-24:  GPT-4 CoT 4%  -> ToT 74%")
    print("  LATS HumanEval:  pass@1 92.7% with GPT-4 (SOTA at paper time)")
    print("  Cost: ToT uses 100-1000x the tokens of CoT. Use with intent.")


if __name__ == "__main__":
    main()
