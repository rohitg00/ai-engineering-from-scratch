"""Cold-start mitigation path simulator — stdlib Python.

Models a 70B model cold-start with different mitigation stacks:
  RAW              : no mitigations (nominal baseline)
  PRE_SEEDED       : + Bottlerocket pre-seeded node image
  STREAMER         : + NVIDIA Run:ai Model Streamer
  GPU_SNAPSHOT     : + Modal-style GPU snapshots
  WARM_POOL        : min_workers=1 (no cold start at all on warm path)

Reports per-layer seconds and totals. Also computes warm-pool break-even.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Phase:
    name: str
    raw_sec: float
    pre_seeded_sec: float    # 0 if eliminated
    streamer_sec: float      # replaces raw if streamer active
    snapshot_sec: float      # replaces all if snapshot active


PHASES_70B = [
    Phase("node provision",   50.0, 50.0,  50.0,  0.5),
    Phase("image pull",      180.0,  0.0, 180.0,  0.0),
    Phase("weights to HBM",   75.0, 75.0,  35.0,  0.0),
    Phase("engine init",      20.0, 20.0,  20.0,  2.0),
    Phase("first forward",     3.0,  3.0,   3.0,  0.5),
]


def total_for_stack(stack: set[str]) -> float:
    seconds = 0.0
    for phase in PHASES_70B:
        if "gpu_snapshot" in stack:
            seconds += phase.snapshot_sec
        elif "streamer" in stack and "pre_seeded" in stack:
            used = phase.pre_seeded_sec
            if phase.name == "weights to HBM":
                used = phase.streamer_sec
            seconds += used
        elif "pre_seeded" in stack:
            seconds += phase.pre_seeded_sec
        elif "streamer" in stack:
            seconds += phase.streamer_sec if phase.name == "weights to HBM" else phase.raw_sec
        else:
            seconds += phase.raw_sec
    return seconds


def report_stack(label: str, stack: set[str]) -> None:
    total = total_for_stack(stack)
    mins = total / 60
    print(f"{label:20}  {total:6.1f} s  ({mins:4.1f} min)  stack={sorted(stack) if stack else '{baseline}'}")


def warm_pool_break_even(gpu_hourly: float, cold_seconds: float, sla_tolerated_drops_per_day: int) -> None:
    print("\n" + "=" * 80)
    print("WARM POOL BREAK-EVEN")
    print("=" * 80)
    print(f"GPU cost: ${gpu_hourly:.2f}/hr  |  cold start: {cold_seconds:.0f}s  |  drop budget: {sla_tolerated_drops_per_day}/day\n")
    warm_monthly = gpu_hourly * 24 * 30
    print(f"Warm pool (min_workers=1) monthly cost: ${warm_monthly:.2f}")
    print()
    print(f"{'Req/hr':>8}  {'Expected cold starts/day':>24}  {'Drops over budget':>20}  {'Warm better?':>15}")
    for rate in (1, 5, 10, 25, 50, 100, 250):
        cold_starts_per_day = 24 / max(rate, 1) if rate < 1 else 1
        cold_starts_per_day = min(20, max(1, int(24 * 3600 / (rate * 3600))))
        drops = cold_starts_per_day
        warm_better = "yes" if drops > sla_tolerated_drops_per_day else "no"
        print(f"{rate:>8}  {cold_starts_per_day:>24}  {max(0, drops - sla_tolerated_drops_per_day):>20}  {warm_better:>15}")


def main() -> None:
    print("=" * 80)
    print("COLD START MITIGATION — 70B model on fresh H100 node")
    print("=" * 80)
    print(f"{'Stack':20}  {'Total':>8}             Stack composition")
    print("-" * 80)

    report_stack("RAW",                      set())
    report_stack("+ PRE_SEEDED",             {"pre_seeded"})
    report_stack("+ STREAMER",               {"streamer"})
    report_stack("+ PRE_SEEDED + STREAMER",  {"pre_seeded", "streamer"})
    report_stack("+ GPU_SNAPSHOT",           {"gpu_snapshot"})

    print("\n(WARM_POOL avoids cold start entirely on the warm path; cost is 24x7 GPU rental)")

    warm_pool_break_even(gpu_hourly=4.50, cold_seconds=328, sla_tolerated_drops_per_day=5)


if __name__ == "__main__":
    main()
