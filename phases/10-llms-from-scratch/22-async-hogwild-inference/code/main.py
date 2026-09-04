"""Hogwild! Inference toy simulator — stdlib Python.

Two workers run concurrently against a shared token cache. Each worker reads
the cache and decides whether to add a work-token to category A or B, using
a simple coordination heuristic: if the other worker already produced enough
tokens in a category, switch.

Outputs:
  - total work-tokens produced in fixed step budget
  - wall-time speedup vs a single-worker baseline
  - a trace of which worker wrote which token and what category
  - a coordination-weight sweep showing the effect of poor coordination

Not a faithful LLM simulation. The point is to demonstrate emergent work
division driven by shared-cache reads.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import List, Literal


Category = Literal["A", "B", "noise", "coord"]


@dataclass
class SharedCache:
    tokens: List[tuple[int, Category]] = field(default_factory=list)

    def counts(self) -> dict:
        c = {"A": 0, "B": 0, "noise": 0, "coord": 0}
        for _, cat in self.tokens:
            c[cat] += 1
        return c


@dataclass
class Worker:
    id: int
    intended: Category
    coordination_weight: float
    rng: random.Random


def decide_next_category(worker: Worker, cache: SharedCache,
                         target_per_category: int) -> Category:
    """Read the shared cache. With probability coordination_weight, switch
    to the least-filled work category (noticing redundancy). Otherwise stay
    on the worker's intended category. coordination_weight = 0 models
    workers that cannot coordinate (full redundancy). weight = 1 models
    ideal reasoning-model coordination.
    """
    if worker.rng.random() < 0.05:
        return "noise"

    counts = cache.counts()
    base = worker.intended

    if worker.rng.random() < worker.coordination_weight:
        candidates = sorted(("A", "B"), key=lambda c: counts[c])
        return candidates[0]

    if worker.rng.random() < 0.1:
        return "coord"

    return base


def run_hogwild(n_workers: int, step_budget: int, target_per_category: int,
                coordination_weight: float, seed: int = 42) -> dict:
    """All workers default to category A. Coordination makes them diverge.
    Without coordination, redundant tokens (same category from multiple
    workers) are counted once. With coordination, workers pick different
    categories so each token is unique and contributes to total progress."""
    cache = SharedCache()
    workers = []
    for i in range(n_workers):
        workers.append(Worker(
            id=i, intended="A",
            coordination_weight=coordination_weight,
            rng=random.Random(seed + i),
        ))

    trace: List[tuple[int, Category, str]] = []
    step = 0
    progress = 0
    while step < step_budget:
        this_step_categories: List[tuple[int, Category]] = []
        for w in workers:
            cat = decide_next_category(w, cache, target_per_category)
            cache.tokens.append((w.id, cat))
            this_step_categories.append((w.id, cat))

        seen_work_categories = set()
        for w_id, cat in this_step_categories:
            tag = "redundant"
            if cat in ("A", "B") and cat not in seen_work_categories:
                seen_work_categories.add(cat)
                progress += 1
                tag = "unique"
            trace.append((w_id, cat, tag))
        step += 1

    counts = cache.counts()
    work_tokens = counts["A"] + counts["B"]
    return {
        "workers": n_workers,
        "step_budget": step_budget,
        "tokens_emitted": len(cache.tokens),
        "work_tokens": work_tokens,
        "unique_progress": progress,
        "category_counts": counts,
        "coord_tokens": counts["coord"],
        "noise_tokens": counts["noise"],
        "tokens_per_step": len(cache.tokens) / step_budget,
        "work_per_step": work_tokens / step_budget,
        "progress_per_step": progress / step_budget,
        "sample_trace": trace[:12],
    }


def expected_speedup(T_serial: int, p: float, c: int, N: int,
                     steps_per_worker: int) -> float:
    parallel = T_serial * ((1 - p) + p / N) + c * N
    return T_serial / parallel


def main() -> None:
    print("=" * 70)
    print("HOGWILD! INFERENCE TOY SIMULATOR (Phase 10, Lesson 22)")
    print("=" * 70)
    print()

    print("-" * 70)
    print("Step 1: baseline — single worker, 200 steps")
    print("-" * 70)
    r_1 = run_hogwild(n_workers=1, step_budget=200, target_per_category=100,
                      coordination_weight=0.8)
    print(f"  tokens emitted    : {r_1['tokens_emitted']}")
    print(f"  work-tokens       : {r_1['work_tokens']}  ({r_1['work_per_step']:.2f} / step)")
    print(f"  unique progress   : {r_1['unique_progress']}  ({r_1['progress_per_step']:.2f} / step)")
    print(f"  category counts   : {r_1['category_counts']}")
    print()

    print("-" * 70)
    print("Step 2: Hogwild — 2 workers, shared cache, strong coordination")
    print("-" * 70)
    r_2 = run_hogwild(n_workers=2, step_budget=200, target_per_category=100,
                      coordination_weight=0.8)
    print(f"  tokens emitted    : {r_2['tokens_emitted']}  ({r_2['tokens_per_step']:.2f} / step)")
    print(f"  work-tokens       : {r_2['work_tokens']}  ({r_2['work_per_step']:.2f} / step)")
    print(f"  unique progress   : {r_2['unique_progress']}  ({r_2['progress_per_step']:.2f} / step)")
    print(f"  category counts   : {r_2['category_counts']}")
    print(f"  speedup vs N=1    : {r_2['unique_progress'] / r_1['unique_progress']:.2f}x")
    print()

    print("-" * 70)
    print("Step 3: coordination-weight sweep (N=2, same step budget)")
    print("-" * 70)
    print(f"  {'coord weight':>14}  {'progress':>10}  {'speedup vs N=1':>15}")
    for cw in (0.0, 0.2, 0.5, 0.8, 1.0):
        r = run_hogwild(n_workers=2, step_budget=200, target_per_category=100,
                        coordination_weight=cw)
        speedup = r["unique_progress"] / r_1["unique_progress"]
        print(f"  {cw:>14.2f}  {r['unique_progress']:>10}  {speedup:>15.2f}x")
    print("  (coord weight 0.0 = both workers stay in category A = full redundancy)")
    print()

    print("-" * 70)
    print("Step 4: Amdahl-style theoretical speedup")
    print("-" * 70)
    T_serial = 10_000
    print(f"  reasoning task = 10000 decode tokens")
    print(f"  c = coordination overhead per worker")
    print(f"  {'p':>5}  " + "".join(
        f"{f'N={N}':>10}" for N in (2, 4, 8)))
    for p in (0.3, 0.5, 0.7, 0.9):
        row = f"  {p:>5.2f}  "
        for N in (2, 4, 8):
            s = expected_speedup(T_serial=T_serial, p=p, c=200, N=N,
                                 steps_per_worker=T_serial // N)
            row += f"{s:>9.2f}x"
        print(row)
    print("  (values: Hogwild! speedup over serial single-worker)")
    print()

    print("-" * 70)
    print("Step 5: worst case (short task, weak coordination)")
    print("-" * 70)
    print(f"  {'p':>5}  " + "".join(
        f"{f'N={N}':>10}" for N in (2, 4, 8)))
    for p in (0.1, 0.3, 0.5):
        row = f"  {p:>5.2f}  "
        for N in (2, 4, 8):
            s = expected_speedup(T_serial=1000, p=p, c=150, N=N,
                                 steps_per_worker=1000 // N)
            row += f"{s:>9.2f}x"
        print(row)
    print("  (short 1000-token task, 150-token coordination overhead)")
    print("  values below 1.0 mean parallel inference is SLOWER than serial")
    print()

    print("takeaway: Hogwild! speedup depends on parallelizable fraction p and")
    print("          coordination overhead c. Reasoning tasks with p > 0.5 and")
    print("          low per-step overhead are the sweet spot. Short chat with")
    print("          c comparable to T_serial is the wrong place to use it.")


if __name__ == "__main__":
    main()
