"""Inference platform economics comparator — stdlib Python.

Models six providers (Fireworks, Together, Baseten, Modal, Replicate, Anyscale)
on the same synthetic workload. Normalizes per-token vs per-minute vs per-prediction
pricing so you can compare head-to-head.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Vendor:
    name: str
    model: str
    per_mtok_output: float | None   # $/M output tokens (None if not the model)
    per_minute: float | None        # $/minute for dedicated GPU (None if serverless)
    per_prediction: float | None    # $/prediction (None if per-token)
    tokens_per_minute: int          # effective tokens when GPU is saturated
    cold_start_sec: float
    notes: str
    min_reserved_minutes_per_day: int = 0  # reserved-minute floor for per-minute vendors (warm pool / minimum commitment)


VENDORS = [
    Vendor("Fireworks",    "Llama 70B",          0.90,  None,    None,  900_000, 1.5, "FireAttention, batch tier 50% off"),
    Vendor("Together",     "Llama 70B",          0.88,  None,    None,  850_000, 2.0, "200+ models, 50-70% below Replicate"),
    Vendor("Baseten",      "Custom Llama 70B",   None,  0.55,    None,  900_000, 5.0, "Truss, SOC2 HIPAA, per-min billing", 1440),
    Vendor("Modal",        "Custom Llama 70B",   None,  0.48,    None,  800_000, 2.5, "Python-native, per-sec billing, 60min warm-pool floor", 60),
    Vendor("Replicate",    "Llama 70B",          None,  None,    0.006, 750_000, 4.0, "Pay-per-prediction, multimodal"),
    Vendor("Anyscale",     "Llama 70B RayTurbo", None,  0.60,    None,  850_000, 3.0, "Ray-native, distributed Python", 1440),
]


def cost_per_day(v: Vendor, tokens_per_day: int, predictions_per_day: int) -> float:
    """Effective $/day given the vendor's pricing model.

    Per-minute vendors are billed for the maximum of saturated serving time and
    a reserved-minute floor (warm-pool minimum / reservation). This makes the
    per-minute model consistent across `run_scenario` and `utilization_breakeven`
    instead of assuming perfect scale-to-zero in one place and reserved 24h in
    the other.
    """
    if v.per_mtok_output is not None:
        return (tokens_per_day / 1e6) * v.per_mtok_output
    if v.per_minute is not None:
        saturated_minutes = tokens_per_day / v.tokens_per_minute
        minutes = max(saturated_minutes, v.min_reserved_minutes_per_day)
        return minutes * v.per_minute
    if v.per_prediction is not None:
        return predictions_per_day * v.per_prediction
    return 0.0


def effective_rate(v: Vendor, tokens_per_day: int, predictions_per_day: int) -> float:
    """Normalize to $/M tokens for cross-vendor comparison."""
    c = cost_per_day(v, tokens_per_day, predictions_per_day)
    return (c / (tokens_per_day / 1e6)) if tokens_per_day else 0


def run_scenario(label: str, tokens_per_day: int, predictions_per_day: int) -> None:
    print(f"\n{label}")
    print(f"Workload: {tokens_per_day/1e6:.1f}M output tokens/day  |  {predictions_per_day} predictions/day")
    header = f"{'Vendor':12}  {'Model':22}  {'$/day':>8}  {'$/M tok':>10}  Notes"
    print(header)
    print("-" * len(header))
    for v in VENDORS:
        cost = cost_per_day(v, tokens_per_day, predictions_per_day)
        rate = effective_rate(v, tokens_per_day, predictions_per_day)
        print(f"{v.name:12}  {v.model:22}  ${cost:7.2f}  ${rate:9.2f}  {v.notes}")


def utilization_breakeven() -> None:
    print("\n" + "=" * 80)
    print("PER-TOKEN vs PER-MINUTE BREAK-EVEN — Fireworks (per-token) vs Baseten (per-min)")
    print("=" * 80)
    fw = VENDORS[0]
    bt = VENDORS[2]
    print(f"Fireworks: ${fw.per_mtok_output:.2f}/M output  |  Baseten: ${bt.per_minute:.2f}/min, {bt.tokens_per_minute/1e3:.0f}k tok/min\n")
    print(f"{'Util %':>8}  {'Fireworks $/day':>16}  {'Baseten $/day':>14}  Winner")
    for util_pct in (5, 10, 15, 20, 25, 30, 35, 40, 50, 75, 100):
        tokens_per_day = int(bt.tokens_per_minute * 60 * 24 * util_pct / 100)
        fw_cost = cost_per_day(fw, tokens_per_day, 0)
        bt_cost = cost_per_day(bt, tokens_per_day, 0)
        winner = "Baseten" if bt_cost < fw_cost else "Fireworks"
        print(f"{util_pct:>7}%  ${fw_cost:>15.2f}  ${bt_cost:>13.2f}  {winner}")


def cold_start_penalty() -> None:
    print("\n" + "=" * 80)
    print("COLD START PENALTY — bursty workload")
    print("=" * 80)
    print(f"{'Vendor':12}  {'Cold start':>11}  Impact at 100 cold invocations/day")
    for v in VENDORS:
        impact_sec = v.cold_start_sec * 100
        print(f"{v.name:12}  {v.cold_start_sec:>8.1f} s   +{impact_sec:.0f} seconds/day of extra latency")


def main() -> None:
    print("=" * 80)
    print("INFERENCE PLATFORM ECONOMICS — 2026 approximations")
    print("=" * 80)

    run_scenario("Scenario A — startup-scale LLM product",
                 tokens_per_day=2_000_000, predictions_per_day=10_000)
    run_scenario("Scenario B — high-volume production",
                 tokens_per_day=100_000_000, predictions_per_day=500_000)

    utilization_breakeven()
    cold_start_penalty()

    print("\nRule of thumb: under reserved-minute billing, per-minute (Baseten, Modal) beats per-token")
    print("once GPU saturation stays above ~60-70% utilization; below that, per-token wins.")


if __name__ == "__main__":
    main()
