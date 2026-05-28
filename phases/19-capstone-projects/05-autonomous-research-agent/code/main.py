"""Autonomous research agent — plan/execute/verify tree search scaffold。

難しい architectural primitive は experiment node 上の best-first tree search
です。budgeted expansion、per-node sandboxed execution、novelty × quality ×
budget scoring function を備えます。LLM planner と実際の PyTorch experiment は
stub されているため、real compute なしで tree-search skeleton を end to end に
観測できます。

Run:  python main.py
"""

from __future__ import annotations

import heapq
import random
from dataclasses import dataclass, field
from typing import Iterable


# ---------------------------------------------------------------------------
# experiment node  --  (hypothesis, config, result) tuple
# ---------------------------------------------------------------------------

@dataclass
class Node:
    node_id: int
    parent: int | None
    hypothesis: str
    config: dict[str, object]
    result: dict[str, float] = field(default_factory=dict)
    cost_usd: float = 0.0
    novelty: float = 0.5
    quality: float = 0.0
    failure: str | None = None

    def score(self, remaining_budget: float) -> float:
        budget_weight = min(1.0, remaining_budget / 10.0)
        return self.novelty * 0.4 + self.quality * 0.5 + budget_weight * 0.1


# ---------------------------------------------------------------------------
# stub planner  --  small-edit expansion で child node を提案する
# ---------------------------------------------------------------------------

def expand(node: Node, next_id: int) -> list[Node]:
    """config dimension を一度に1つ変えて child を提案する。"""
    children: list[Node] = []
    base_cfg = node.config
    # sparsity を変える
    for sp in (4, 8, 16):
        cfg = dict(base_cfg, sparsity_top=sp)
        children.append(Node(node_id=next_id, parent=node.node_id,
                             hypothesis=f"sparsity top-{sp}",
                             config=cfg))
        next_id += 1
    # learning rate を変える
    for lr in (3e-4, 1e-3):
        cfg = dict(base_cfg, lr=lr)
        children.append(Node(node_id=next_id, parent=node.node_id,
                             hypothesis=f"lr={lr}",
                             config=cfg))
        next_id += 1
    return children


# ---------------------------------------------------------------------------
# sandbox execution  --  stub。fake だが reproducible な metric を返す
# ---------------------------------------------------------------------------

def run_experiment(node: Node, rng: random.Random) -> None:
    """sandboxed container 内で experiment を実行する simulation。
    real build では次を shell out する:
      docker run --network=none --memory=8g --cpus=2 --read-only ...
    そして mounted output volume から stdout と metrics files を capture する。"""
    sp = node.config.get("sparsity_top", 8)
    lr = node.config.get("lr", 3e-4)
    # hyperparam に基づいて loss を生成する (小さい sparsity はある程度まで良い)
    ideal_sp = 8
    loss = 3.0 - 0.3 * (1 - abs(sp - ideal_sp) / 16) + rng.gauss(0, 0.05)
    loss += 0.0001 * abs(lr - 3e-4) * 1000
    node.result = {"loss": round(loss, 3), "sparsity_top": sp, "lr": lr}
    node.cost_usd = 1.2 + rng.uniform(0, 0.4)
    node.quality = max(0.0, 1.0 - (loss - 2.5) / 1.5)
    node.novelty = 0.5 + rng.uniform(-0.1, 0.2)
    # ときどき failure を simulate する
    if rng.random() < 0.1:
        node.failure = "oom_killed_by_cgroup"
        node.quality = 0.0


# ---------------------------------------------------------------------------
# verify step  --  scoring 前に result を sanity check する
# ---------------------------------------------------------------------------

def verify(node: Node) -> bool:
    if node.failure:
        return False
    if node.result.get("loss", 99) > 4.0:
        node.failure = "loss_diverged"
        return False
    return True


# ---------------------------------------------------------------------------
# tree search  --  budget と max depth 付き best-first
# ---------------------------------------------------------------------------

@dataclass
class Tree:
    root: Node
    nodes: dict[int, Node] = field(default_factory=dict)
    frontier: list = field(default_factory=list)  # (neg_score, counter, node_id)
    counter: int = 0
    budget: float = 30.0
    spent: float = 0.0
    max_nodes: int = 24

    def push(self, node: Node) -> None:
        self.nodes[node.node_id] = node
        self.counter += 1
        remaining = self.budget - self.spent
        heapq.heappush(self.frontier, (-node.score(remaining), self.counter, node.node_id))

    def pop(self) -> Node | None:
        while self.frontier:
            _, _, nid = heapq.heappop(self.frontier)
            return self.nodes[nid]
        return None


def tree_search(seed: str, rng: random.Random) -> Tree:
    root = Node(node_id=0, parent=None, hypothesis=seed, config={"sparsity_top": 8, "lr": 3e-4})
    root.novelty = 1.0
    root.quality = 0.5
    tree = Tree(root=root)
    tree.push(root)

    next_id = 1
    while tree.frontier and len(tree.nodes) < tree.max_nodes:
        cur = tree.pop()
        if cur is None:
            break
        if tree.spent >= tree.budget:
            print(f"    BUDGET を使い切りました: ${tree.spent:.2f}")
            break
        if cur.node_id != 0:
            run_experiment(cur, rng)
            tree.spent += cur.cost_usd
            ok = verify(cur)
            flag = "ok " if ok else "FAIL"
            print(f"    [{flag}] node #{cur.node_id:02d}  hypo='{cur.hypothesis}'  "
                  f"loss={cur.result.get('loss','?'):>5}  "
                  f"$={cur.cost_usd:.2f}  cum=${tree.spent:.2f}")
            if not ok:
                continue
        # promising な node を expand する
        children = expand(cur, next_id)
        next_id += len(children)
        for ch in children:
            tree.push(ch)

    return tree


# ---------------------------------------------------------------------------
# best-branch selection と write-up stub
# ---------------------------------------------------------------------------

def best_branch(tree: Tree) -> list[Node]:
    done = [n for n in tree.nodes.values() if n.result and not n.failure]
    if not done:
        return []
    best = max(done, key=lambda n: n.quality)
    # root まで戻る
    chain = [best]
    while chain[-1].parent is not None:
        chain.append(tree.nodes[chain[-1].parent])
    return list(reversed(chain))


def main() -> None:
    print("=== autonomous research agent: tree search (budget $30) ===")
    rng = random.Random(7)
    seed = "sub-1B transformer の attention map における sparsity pattern を調べる"
    tree = tree_search(seed, rng)
    print()
    print(f"探索した nodes : {len(tree.nodes)}")
    print(f"使用 budget    : ${tree.spent:.2f} / ${tree.budget:.2f}")
    print(f"失敗 nodes     : {sum(1 for n in tree.nodes.values() if n.failure)}")

    branch = best_branch(tree)
    print(f"\nbest branch (長さ {len(branch)}):")
    for n in branch:
        print(f"  #{n.node_id:02d} {n.hypothesis}   q={n.quality:.2f}  loss={n.result.get('loss','?')}")

    print("\n(writer + reviewer + red-team step はここで走る想定です。"
          "scaffold では stub しています)")


if __name__ == "__main__":
    main()
