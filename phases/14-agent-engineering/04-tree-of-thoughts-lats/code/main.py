"""Toy Tree-of-Thoughts BFS and LATS MCTS on a stylized arithmetic search.

Lesson: phases/14-agent-engineering/04-tree-of-thoughts-lats/docs/en.md
Task: make 24 from [4, 6, 4, 1] with + - * / (Game of 24, Yao et al. 2023).
ToT is BFS with a value function; LATS is MCTS over the same space (Zhou et
al. 2023). Also runs Exercises 1-3: UCT c, noisy values, budgeted beam ToT.
"""

from __future__ import annotations

import itertools
import math
import random
import statistics
from dataclasses import dataclass, field
from typing import Callable


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


ValueFn = Callable[[Node], float]


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


def simulate(node: Node, depth: int, rng: random.Random,
             value_fn: ValueFn = value) -> float:
    current = node
    for _ in range(depth):
        options = expand(current)
        if not options:
            break
        current = rng.choice(options)
    return value_fn(current)


def backprop(path: list[Node], reward: float) -> None:
    for n in path:
        n.visits += 1
        n.value_sum += reward


def mcts(root: Node, iterations: int, rng: random.Random,
         c: float = 1.4, value_fn: ValueFn = value) -> tuple[Node, int]:
    expansions = 0
    for _ in range(iterations):
        path = [root]
        cur = root
        while cur.children:
            cur = max(cur.children, key=lambda ch: uct(cur, ch, c))
            path.append(cur)
        if cur.visits > 0 and len(cur.state) > 1:
            cur.children = expand(cur)
            expansions += len(cur.children)
            if cur.children:
                cur = cur.children[0]
                path.append(cur)
        reward = simulate(cur, depth=max(0, 3 - len(cur.trace)), rng=rng,
                          value_fn=value_fn)
        backprop(path, reward)
    best_leaf = max(_all_leaves(root), key=value_fn, default=root)
    return best_leaf, expansions


def _all_leaves(node: Node) -> list[Node]:
    if not node.children:
        return [node]
    out: list[Node] = []
    for ch in node.children:
        out.extend(_all_leaves(ch))
    return out


def make_root() -> Node:
    return Node(state=tuple(sorted(NUMBERS, reverse=True)), trace=[])


def depth3_leaves() -> list[Node]:
    level = [make_root()]
    for _ in range(3):
        level = [c for n in level for c in expand(n)]
    return level


def run_lats(seed: int, c: float, iterations: int = 80, value_fn=value):
    root = make_root()
    root.children = expand(root)
    best, _ = mcts(root, iterations, random.Random(seed), c=c, value_fn=value_fn)
    return root, best


def visit_entropy(root: Node) -> float:
    """Shannon entropy (bits) of root-child visit counts. High = spread out."""
    total = sum(ch.visits for ch in root.children)
    if total == 0:
        return 0.0
    probs = [ch.visits / total for ch in root.children if ch.visits]
    return -sum(p * math.log2(p) for p in probs)


def exercise_1(seeds: range = range(20)) -> list[dict]:
    rows = []
    for c in (0.1, 0.5, 1.4, 2.0, 5.0):
        ent, top, reached, vals = [], [], [], []
        for s in seeds:
            root, best = run_lats(s, c)
            total = sum(ch.visits for ch in root.children)
            ent.append(visit_entropy(root))
            top.append(max(ch.visits for ch in root.children) / total)
            reached.append(sum(1 for ch in root.children if ch.visits > 1))
            vals.append(value(best))
        rows.append({
            "c": c,
            "entropy_bits": statistics.mean(ent),
            "top_child_share": statistics.mean(top),
            "root_children_revisited": statistics.mean(reached),
            "mean_best_value": statistics.mean(vals),
        })
    return rows


def noisy(sigma: float, rng: random.Random):
    def fn(node: Node) -> float:
        return value(node) + rng.gauss(0.0, sigma)
    return fn


def exercise_2(seeds: range = range(30)) -> list[dict]:
    leaves = depth3_leaves()
    true_vals = [value(n) for n in leaves]
    signal = statistics.pstdev(true_vals)
    rows = []
    for sigma in (0.0, 0.01, 0.03, 0.1, 0.3, 1.0):
        hits, found = 0, []
        for s in seeds:
            fn = noisy(sigma, random.Random(1000 + s))
            _, best = run_lats(s, c=1.4, iterations=400, value_fn=fn)
            found.append(value(best))
            hits += value(best) > 0.99
        rows.append({
            "sigma": sigma,
            "snr": signal / sigma if sigma else float("inf"),
            "solve_rate": hits / len(seeds),
            "mean_true_value": statistics.mean(found),
        })
    return rows


def tot_search(root: Node, width: int | None, budget: int,
               max_depth: int = 3) -> tuple[Node | None, int]:
    """Level-by-level ToT. width=None keeps every child (BFS); else top-k (beam).

    Each child scored costs one expansion. Stops when the budget is spent, so a
    wide search can run out before reaching a leaf. Returns the best finished
    leaf if any, otherwise the best node seen, plus expansions spent.
    """
    frontier = [root]
    spent = 0
    best: Node | None = None
    for _ in range(max_depth):
        scored: list[tuple[float, Node]] = []
        for node in frontier:
            for child in expand(node):
                if spent >= budget:
                    return _pick(best, scored), spent
                spent += 1
                v = value(child)
                scored.append((v, child))
                if v > 0.99:
                    return child, spent
        scored.sort(key=lambda p: p[0], reverse=True)
        kept = scored if width is None else scored[:width]
        frontier = [n for _, n in kept]
        best = _pick(best, kept)
    return best, spent


def _pick(best: Node | None, scored: list[tuple[float, Node]]) -> Node | None:
    cands = [n for _, n in scored] + ([best] if best else [])
    return max(cands, key=value) if cands else None


def exercise_3() -> list[dict]:
    rows = []
    for budget in (150, 300, 460, 1200):
        for label, width in (("bfs", None), ("beam-8", 8), ("beam-32", 32), ("beam-64", 64)):
            node, spent = tot_search(make_root(), width, budget)
            rows.append({
                "budget": budget,
                "strategy": label,
                "spent": spent,
                "best_value": value(node) if node else float("nan"),
                "solved": bool(node and value(node) > 0.99),
                "depth": len(node.trace) if node else 0,
            })
    return rows


def _table(rows: list[dict]) -> None:
    keys = list(rows[0])
    print("  " + "  ".join(f"{k:>22}" for k in keys))
    for r in rows:
        print("  " + "  ".join(
            f"{r[k]:>22.3f}" if isinstance(r[k], float) else f"{r[k]!s:>22}" for k in keys))


def _table(rows: list[dict]) -> None:
    keys = list(rows[0])
    print("  " + "  ".join(f"{k:>22}" for k in keys))
    for r in rows:
        print("  " + "  ".join(
            f"{r[k]:>22.3f}" if isinstance(r[k], float) else f"{r[k]!s:>22}" for k in keys))


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

    print("\nExercise 1: UCT c sweep (20 seeds, 80 iterations)")
    _table(exercise_1())
    print("\nExercise 2: noisy value function (30 seeds, c=1.4, 400 iterations)")
    _table(exercise_2())
    print("\nExercise 3: BFS vs beam under an expansion budget")
    _table(exercise_3())


if __name__ == "__main__":
    main()
