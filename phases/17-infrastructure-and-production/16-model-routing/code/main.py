"""Model routing simulator — stdlib Python.

同じ workload に3つの pattern を適用する:
  NO_ROUTE   : すべての request を frontier へ
  PRE_ROUTE  : 先頭 classifier が cheap または frontier へ route
  CASCADE    : cheap first、low confidence なら escalate

blended cost、quality loss、escalation rate を report する。
"""

from __future__ import annotations

from dataclasses import dataclass
import random


CHEAP_INPUT = 0.25
CHEAP_OUTPUT = 1.00
FRONTIER_INPUT = 3.00
FRONTIER_OUTPUT = 15.00


@dataclass
class Query:
    difficulty: str  # 'simple' | 'medium' | 'hard'
    prompt_tokens: int
    output_tokens: int


def make_workload(n: int = 1000, seed: int = 7) -> list[Query]:
    rng = random.Random(seed)
    reqs = []
    for _ in range(n):
        p = rng.random()
        if p < 0.6:
            reqs.append(Query("simple", rng.randint(200, 1000), rng.randint(50, 200)))
        elif p < 0.9:
            reqs.append(Query("medium", rng.randint(800, 3000), rng.randint(100, 400)))
        else:
            reqs.append(Query("hard", rng.randint(2000, 8000), rng.randint(200, 1500)))
    return reqs


def cost_of(route: str, q: Query) -> float:
    if route == "cheap":
        return (q.prompt_tokens / 1e6) * CHEAP_INPUT + (q.output_tokens / 1e6) * CHEAP_OUTPUT
    return (q.prompt_tokens / 1e6) * FRONTIER_INPUT + (q.output_tokens / 1e6) * FRONTIER_OUTPUT


def quality(route: str, q: Query) -> float:
    """difficulty と route ごとの toy quality score。"""
    if route == "frontier":
        return 1.0
    return {"simple": 0.99, "medium": 0.92, "hard": 0.75}[q.difficulty]


def simulate(pattern: str, reqs: list[Query]) -> dict:
    total_cost = 0.0
    total_q = 0.0
    escalated = 0
    rng = random.Random(11)

    for q in reqs:
        if pattern == "NO_ROUTE":
            total_cost += cost_of("frontier", q)
            total_q += 1.0
        elif pattern == "PRE_ROUTE":
            if q.difficulty == "simple":
                total_cost += cost_of("cheap", q)
                total_q += quality("cheap", q)
            else:
                total_cost += cost_of("frontier", q)
                total_q += 1.0
        elif pattern == "CASCADE":
            total_cost += cost_of("cheap", q)
            confident = (q.difficulty == "simple") or (q.difficulty == "medium" and rng.random() < 0.5)
            if confident:
                total_q += quality("cheap", q)
            else:
                escalated += 1
                total_cost += cost_of("frontier", q)
                total_q += 1.0

    return {
        "pattern": pattern,
        "cost": total_cost,
        "mean_quality": total_q / len(reqs),
        "escalated": escalated,
    }


def report(row: dict, baseline: float) -> None:
    save = (baseline - row["cost"]) / baseline * 100
    print(f"{row['pattern']:12}  cost=${row['cost']:7.2f}  saving={save:5.1f}%  "
          f"quality={row['mean_quality']*100:5.1f}%  escalated={row['escalated']:4}")


def main() -> None:
    print("=" * 80)
    print("MODEL ROUTING — 3 patterns、1000 requests、mixed difficulty")
    print("=" * 80)
    base = make_workload()
    baseline = simulate("NO_ROUTE", base)["cost"]
    for p in ("NO_ROUTE", "PRE_ROUTE", "CASCADE"):
        report(simulate(p, base), baseline)

    print("\n読み方: classifier が正確なら PRE_ROUTE は大きく節約する。CASCADE は")
    print("quality floor を保証するが、escalated requests では latency が増える。")


if __name__ == "__main__":
    main()
