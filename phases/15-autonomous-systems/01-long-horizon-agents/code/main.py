"""METR-style time-horizon simulator — stdlib Python.

Given a doubling time and a baseline horizon, projects the 50% task-completion
horizon across future years. Separately, shows how per-step reliability
compounds across trajectories: a 99% per-step agent still fails a coin flip on
a 70-step task.

Pedagogical, not calibrated. The point is to hold the numbers in your head
before trusting an agent to run unattended.
"""

from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass
class HorizonConfig:
    baseline_hours: float
    baseline_month: int  # months since epoch (0 = now)
    doubling_months: float


def horizon_at(cfg: HorizonConfig, months_from_now: int) -> float:
    """Project the 50% horizon at a given month offset."""
    delta = months_from_now - cfg.baseline_month
    return cfg.baseline_hours * (2 ** (delta / cfg.doubling_months))


def months_to_cross(cfg: HorizonConfig, target_hours: float) -> float:
    """Months until horizon reaches target_hours."""
    ratio = target_hours / cfg.baseline_hours
    return cfg.baseline_month + cfg.doubling_months * math.log2(ratio)


def end_to_end_reliability(per_step: float, steps: int) -> float:
    """Probability that every step succeeds in sequence."""
    return per_step ** steps


def max_steps_for_target(per_step: float, target: float) -> int:
    """Largest N such that per_step**N >= target."""
    if per_step >= 1.0:
        return 10**9
    return math.floor(math.log(target) / math.log(per_step))


def fmt_hours(h: float) -> str:
    if h < 1:
        return f"{h * 60:.1f} min"
    if h < 24:
        return f"{h:.1f} hr"
    return f"{h / 24:.1f} day"


def horizon_projection() -> None:
    """Plot the horizon forward using METR's fit slope."""
    cfg = HorizonConfig(
        baseline_hours=14.0,
        baseline_month=0,
        doubling_months=7.0,
    )
    print("\nMETR-style horizon projection")
    print("-" * 70)
    print(f"  baseline: {cfg.baseline_hours:.1f} hr at month 0 "
          f"(Claude Opus 4.6, Jan 2026)")
    print(f"  doubling time: {cfg.doubling_months:.1f} months")
    print()
    print(f"  {'month':>8}  {'horizon':>12}  {'interpretation':<30}")
    for m in (0, 6, 12, 18, 24, 30, 36):
        h = horizon_at(cfg, m)
        tag = ""
        if h < 24:
            tag = "workday-scale"
        elif h < 168:
            tag = "multi-day task"
        elif h < 720:
            tag = "week-scale"
        else:
            tag = "month-scale"
        print(f"  {m:>8}  {fmt_hours(h):>12}  {tag:<30}")

    print()
    print("  target crossings")
    for target in (24, 48, 168, 720):
        m = months_to_cross(cfg, target)
        print(f"    {fmt_hours(target)}: month {m:.1f}")


def reliability_compounding() -> None:
    """Show how per-step reliability decays across a trajectory."""
    print("\nPer-step reliability -> end-to-end reliability")
    print("-" * 70)
    print(f"  {'per-step':>10}  {'steps':>8}  {'end-to-end':>12}  "
          f"{'flag':<20}")
    cases = [
        (0.90, 10),
        (0.90, 50),
        (0.95, 50),
        (0.99, 50),
        (0.99, 70),
        (0.99, 200),
        (0.995, 200),
        (0.999, 1000),
    ]
    for per_step, steps in cases:
        p = end_to_end_reliability(per_step, steps)
        flag = ""
        if p < 0.5:
            flag = "coin flip or worse"
        elif p < 0.8:
            flag = "not production"
        elif p < 0.95:
            flag = "fragile"
        else:
            flag = "ok"
        print(f"  {per_step:>10.3f}  {steps:>8}  {p:>12.1%}  {flag:<20}")

    print()
    print("  max trajectory length for 50% end-to-end success")
    for per_step in (0.90, 0.95, 0.99, 0.995, 0.999):
        n = max_steps_for_target(per_step, 0.50)
        print(f"    per-step {per_step:.3f}: up to {n} steps")


def deploy_gap_note() -> None:
    """Eval-context-gaming adjustment."""
    print("\nEval-vs-deploy adjustment")
    print("-" * 70)
    print("  METR numbers assume ideal tooling, no consequences,")
    print("  and no eval-context gaming. Anthropic's 2024 alignment-faking")
    print("  study found Claude faked in 12% of basic tests and up to 78%")
    print("  after retraining attempts.")
    print()
    for horizon in (14.0, 48.0, 168.0):
        for gap in (0.0, 0.2, 0.4):
            effective = horizon * (1 - gap)
            print(f"  benchmark {fmt_hours(horizon):>7}  "
                  f"gap {gap:.0%}  ->  deploy "
                  f"{fmt_hours(effective):>7}")


def main() -> None:
    print("=" * 70)
    print("METR TIME HORIZONS AND COMPOUNDING RELIABILITY (Phase 15, Lesson 1)")
    print("=" * 70)
    horizon_projection()
    reliability_compounding()
    deploy_gap_note()
    print()
    print("=" * 70)
    print("HEADLINE: horizons grow exponentially, reliability compounds")
    print("-" * 70)
    print("  At 7-month doubling, a multi-day horizon is ~1 year away.")
    print("  At 99% per-step, a 70-step trajectory is already a coin flip.")
    print("  Both numbers matter at the same time. Design for both.")


if __name__ == "__main__":
    main()
