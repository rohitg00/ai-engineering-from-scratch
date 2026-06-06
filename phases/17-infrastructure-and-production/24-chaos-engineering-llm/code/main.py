"""Chaos engineering runner with safety plane gates — stdlib Python.

Runs three LLM-specific experiments and applies burn-rate + blast-radius safety gates.
"""

from __future__ import annotations

from dataclasses import dataclass


ERROR_BUDGET_PER_DAY = 0.001   # 99.9% SLO
EXPECTED_ERROR_RATE = 0.0005


@dataclass
class Experiment:
    name: str
    duration_min: int
    induced_error_rate: float
    blast_radius_pct: float


EXPERIMENTS = [
    Experiment("pod kill (1 decode replica)",     5, 0.002, 0.05),
    Experiment("provider 429 fallback",           5, 0.015, 0.30),
    Experiment("malformed prompt tokenizer stall",3, 0.040, 0.10),
]


def run_experiment(e: Experiment) -> dict:
    burn_rate = e.induced_error_rate / max(EXPECTED_ERROR_RATE, 0.0001)
    paused = burn_rate > 2.0 and e.blast_radius_pct > 0.2
    return {
        "experiment": e.name,
        "duration": e.duration_min,
        "error_rate": e.induced_error_rate,
        "burn_rate_x": burn_rate,
        "blast_radius": e.blast_radius_pct,
        "paused_by_safety_plane": paused,
        "status": "ABORTED (burn-rate guard)" if paused else "COMPLETED",
    }


def main() -> None:
    print("=" * 90)
    print("CHAOS EXPERIMENT RUNNER — safety plane gates burn-rate × blast-radius")
    print("=" * 90)
    print(f"SLO error budget: {ERROR_BUDGET_PER_DAY*100:.2f}%/day")
    print(f"Expected baseline error rate: {EXPECTED_ERROR_RATE*100:.3f}%")
    print(f"Burn-rate gate: > 2.0x expected AND blast radius > 20%\n")

    header = f"{'Experiment':38}  {'mins':>4}  {'err %':>6}  {'burn×':>6}  {'blast':>6}  Status"
    print(header)
    print("-" * len(header))
    for e in EXPERIMENTS:
        r = run_experiment(e)
        print(f"{r['experiment']:38}  {r['duration']:>4}  "
              f"{r['error_rate']*100:>5.2f}%  "
              f"{r['burn_rate_x']:>5.1f}x  "
              f"{r['blast_radius']*100:>5.0f}%  "
              f"{r['status']}")

    print("\nRead: small-blast-radius experiments run to completion even at high burn rate.")
    print("Large-blast-radius + high burn → abort. Suppression windows + trace-ID tags")
    print("required to dedupe alerts during experiments.")


if __name__ == "__main__":
    main()
