"""Managed LLM platform comparator — stdlib Python.

Models three platforms (Bedrock on-demand, Azure PTU, Vertex on-demand) on the
same synthetic workload. Reports per-day cost, TTFT median / P99, and attribution
fidelity. Pedagogical: prices and latencies are 2026 public-domain approximations.
"""

from __future__ import annotations

from dataclasses import dataclass
import random
import statistics


@dataclass
class Platform:
    name: str
    per_mtok_input: float        # $/M input tokens on-demand
    per_mtok_output: float       # $/M output tokens on-demand
    ptu_hourly: float | None     # $/hour for one reservation unit (None = not offered)
    ptu_tokens_per_hour: int     # tokens/hour a single PTU delivers
    ttft_median_ms: float        # median TTFT on shared capacity
    ttft_p99_ms: float           # P99 TTFT on shared capacity
    ttft_median_ptu_ms: float    # median TTFT on dedicated PTU
    attribution: str             # qualitative FinOps surface grade


PLATFORMS = [
    Platform("Bedrock on-demand",    3.00, 15.00, 21.0, 1_200_000, 75, 180, 55, "A (Application Inference Profiles)"),
    Platform("Azure OpenAI (PTU)",    2.50, 10.00, 10.0, 2_000_000, 50, 140, 38, "B (scopes + tags + PTU obj)"),
    Platform("Vertex AI Gemini",     1.25,  5.00, None,          0, 60, 160,  0, "B+ (BQ billing export)"),
]


def simulate(tokens_in_per_day: int, tokens_out_per_day: int, sla_ttft_ms: float, use_ptu: bool) -> None:
    print(f"\nWorkload: {tokens_in_per_day/1e6:.1f}M input, {tokens_out_per_day/1e6:.1f}M output per day")
    print(f"SLA: TTFT P99 < {sla_ttft_ms:.0f} ms   |   PTU path: {'enabled' if use_ptu else 'off'}\n")
    header = f"{'Platform':25}  {'$/day':>9}  {'TTFT P50':>10}  {'TTFT P99':>10}  {'SLA':>6}  Attribution"
    print(header)
    print("-" * len(header))

    for p in PLATFORMS:
        cost_ondemand = (tokens_in_per_day / 1e6) * p.per_mtok_input + \
                        (tokens_out_per_day / 1e6) * p.per_mtok_output

        if use_ptu and p.ptu_hourly is not None:
            total_tokens = tokens_in_per_day + tokens_out_per_day
            daily_capacity_per_ptu = p.ptu_tokens_per_hour * 24
            ptu_count = max(1, (total_tokens + daily_capacity_per_ptu - 1) // daily_capacity_per_ptu)
            cost_ptu = ptu_count * p.ptu_hourly * 24
            cost = min(cost_ondemand, cost_ptu)
            ttft_p50 = p.ttft_median_ptu_ms if cost == cost_ptu else p.ttft_median_ms
            ttft_p99 = ttft_p50 * 1.5 if cost == cost_ptu else p.ttft_p99_ms
            path = "PTU" if cost == cost_ptu else "on-demand"
        else:
            cost = cost_ondemand
            ttft_p50 = p.ttft_median_ms
            ttft_p99 = p.ttft_p99_ms
            path = "on-demand"

        sla_ok = "PASS" if ttft_p99 < sla_ttft_ms else "FAIL"
        print(f"{p.name:25}  ${cost:8.2f}  {ttft_p50:7.0f} ms  {ttft_p99:7.0f} ms  {sla_ok:>6}  {p.attribution}  [{path}]")


def break_even_demo() -> None:
    print("\n" + "=" * 80)
    print("PTU BREAK-EVEN SWEEP — Azure OpenAI, GPT-4o class")
    print("=" * 80)
    p = PLATFORMS[1]  # Azure
    print(f"On-demand rate: ${p.per_mtok_output:.2f}/M output  |  PTU: ${p.ptu_hourly:.0f}/hr, {p.ptu_tokens_per_hour/1e6:.1f}M tok/hr\n")
    print(f"{'Util %':>8}  {'On-demand $/day':>18}  {'PTU $/day':>12}  Winner")
    for util_pct in (10, 20, 30, 40, 50, 60, 70, 80, 90, 100):
        tokens_per_day = int(p.ptu_tokens_per_hour * 24 * (util_pct / 100.0))
        ondemand = (tokens_per_day / 1e6) * p.per_mtok_output
        ptu = 24 * p.ptu_hourly
        winner = "PTU" if ptu < ondemand else "on-demand"
        print(f"{util_pct:>7}%  ${ondemand:>16.2f}  ${ptu:>10.2f}  {winner}")


def lock_in_cost() -> None:
    print("\n" + "=" * 80)
    print("TWO-PROVIDER MINIMUM — cost uplift for redundancy")
    print("=" * 80)
    tokens_per_day = 5_000_000
    primary_cost = (tokens_per_day / 1e6) * 10.00
    gateway_overhead_pct = 3.0
    failover_headroom_pct = 10.0
    uplift = primary_cost * (gateway_overhead_pct + failover_headroom_pct) / 100
    print(f"Primary daily spend: ${primary_cost:.2f}")
    print(f"Gateway overhead ({gateway_overhead_pct:.0f}%): ${primary_cost * gateway_overhead_pct / 100:.2f}/day")
    print(f"Idle secondary headroom ({failover_headroom_pct:.0f}%): ${primary_cost * failover_headroom_pct / 100:.2f}/day")
    print(f"Total uplift: ${uplift:.2f}/day")
    print(f"Monthly uplift: ${uplift * 30:.2f}")
    print(f"Cost of one multi-hour regional outage without redundancy: customer churn, SLA credits, war-room time")


def main() -> None:
    print("=" * 80)
    print("MANAGED LLM PLATFORM COMPARATOR — 2026 approximations")
    print("=" * 80)

    simulate(tokens_in_per_day=3_000_000, tokens_out_per_day=1_000_000, sla_ttft_ms=200, use_ptu=False)
    simulate(tokens_in_per_day=30_000_000, tokens_out_per_day=15_000_000, sla_ttft_ms=100, use_ptu=True)

    break_even_demo()
    lock_in_cost()


if __name__ == "__main__":
    main()
