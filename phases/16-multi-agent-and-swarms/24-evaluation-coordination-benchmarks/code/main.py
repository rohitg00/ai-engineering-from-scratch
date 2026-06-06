"""Multi-agent benchmark scorecard generator, stdlib only.

Simulates 3 multi-agent systems on a toy task set. Computes MARBLE-style
milestone metrics, random baseline delta, cost-per-milestone, and a
contamination check by splitting seen/unseen tasks.
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field


@dataclass
class SystemSim:
    name: str
    base_accuracy: float
    cost_per_task: float
    milestone_completion_rate: float
    training_contamination: float = 0.0  # extra accuracy on seen tasks
    variance: float = 0.1


@dataclass
class TaskResult:
    task_id: str
    seen_in_training: bool
    accuracy: float
    milestones: int
    cost: float


SYSTEMS = [
    SystemSim("system-A", base_accuracy=0.70, cost_per_task=0.30,
              milestone_completion_rate=0.80, training_contamination=0.20),
    SystemSim("system-B", base_accuracy=0.64, cost_per_task=0.12,
              milestone_completion_rate=0.55, training_contamination=0.0),
    SystemSim("system-C", base_accuracy=0.55, cost_per_task=0.25,
              milestone_completion_rate=0.70, training_contamination=0.0),
]


def run_task(system: SystemSim, task_id: str, seen: bool, rng: random.Random) -> TaskResult:
    base = system.base_accuracy
    if seen:
        base += system.training_contamination
    base = max(0.0, min(1.0, base + rng.uniform(-system.variance, system.variance)))
    success = rng.random() < base
    milestones = 4 if success else int(4 * system.milestone_completion_rate * rng.random())
    return TaskResult(
        task_id=task_id,
        seen_in_training=seen,
        accuracy=1.0 if success else 0.0,
        milestones=milestones,
        cost=system.cost_per_task,
    )


def random_baseline(rng: random.Random) -> float:
    return 0.15  # random routing accuracy on this task family


def run_bench(system: SystemSim, n_seen: int, n_held: int, seed: int = 0) -> dict:
    rng = random.Random(seed)
    results_seen: list[TaskResult] = []
    results_held: list[TaskResult] = []
    for i in range(n_seen):
        results_seen.append(run_task(system, f"seen-{i}", True, rng))
    for i in range(n_held):
        results_held.append(run_task(system, f"held-{i}", False, rng))
    return {
        "name": system.name,
        "accuracy_seen": sum(r.accuracy for r in results_seen) / len(results_seen),
        "accuracy_held": sum(r.accuracy for r in results_held) / len(results_held),
        "milestone_rate_seen": sum(r.milestones for r in results_seen) / (len(results_seen) * 4),
        "milestone_rate_held": sum(r.milestones for r in results_held) / (len(results_held) * 4),
        "cost_per_task": system.cost_per_task,
        "cost_per_milestone_held":
            system.cost_per_task / max(0.01, sum(r.milestones for r in results_held) / len(results_held) / 4),
    }


def format_scorecard() -> None:
    print("=" * 78)
    print("BENCHMARK SCORECARD — MARBLE-style milestone + contamination check")
    print("  contamination check: accuracy_seen - accuracy_held (delta > 0.1 = suspect)")
    print("=" * 78)
    print(f"{'system':10s} {'acc(seen)':>10s} {'acc(held)':>10s} {'Δ':>6s} "
          f"{'mile(held)':>12s} {'cost/t':>8s} {'cost/mil':>10s} {'vs random':>12s}")

    rng = random.Random(0)
    rand_baseline = random_baseline(rng)
    for sys in SYSTEMS:
        r = run_bench(sys, n_seen=40, n_held=160, seed=17)
        delta = r["accuracy_seen"] - r["accuracy_held"]
        contam_flag = "*" if delta > 0.1 else " "
        vs_random = r["accuracy_held"] - rand_baseline
        print(f"{r['name']:10s} {r['accuracy_seen']:>10.3f} {r['accuracy_held']:>10.3f} "
              f"{delta:>5.2f}{contam_flag} {r['milestone_rate_held']:>12.3f} "
              f"${r['cost_per_task']:>7.2f} ${r['cost_per_milestone_held']:>9.3f} "
              f"+{vs_random:>10.3f}")

    print("\n  * = contamination flag; held-set accuracy is the canonical number")
    print(f"  random baseline accuracy: {rand_baseline:.3f}")


def print_claim_scorecard() -> None:
    print("\n" + "=" * 78)
    print("CLAIM CHECKLIST — read this before accepting any multi-agent result")
    print("=" * 78)
    checklist = [
        "Which benchmark + split? Pro vs Verified is a 40-point gap for frontier models.",
        "Contamination check: is the benchmark post-training-cutoff?",
        "Baseline comparison: vs single-LLM, vs random, vs prior multi-agent?",
        "Statistical significance: N trials, p-value, confidence interval?",
        "Task diversity: single task or many? Generalization beyond one domain?",
        "Cost disclosure: tokens per task, wall-clock per task?",
    ]
    for i, item in enumerate(checklist, 1):
        print(f"  [{i}] {item}")


def main() -> None:
    format_scorecard()
    print_claim_scorecard()
    print("\nTakeaways:")
    print("  system-A scores highest on seen tasks but has contamination signal (large delta).")
    print("  system-B is cheapest per milestone; lowest raw accuracy but transparent.")
    print("  system-C sits in the middle but without contamination flag — trustworthy.")
    print("  the ranking by 'raw accuracy' vs 'cost per milestone (held)' can differ sharply.")


if __name__ == "__main__":
    main()
