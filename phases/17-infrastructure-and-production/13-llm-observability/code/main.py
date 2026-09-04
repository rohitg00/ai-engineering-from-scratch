"""Observability sampling and cost simulator — stdlib Python.

Simulates a 1M-trace day across retention strategies. Reports storage cost
and what's lost under each. Pedagogical: costs are 2026 approximations.
"""

from __future__ import annotations

from dataclasses import dataclass
import random


BYTES_PER_TRACE = 4_500            # prompt + response + metadata
COST_PER_GB_MONTH = 0.023          # S3 standard
OBSERVABILITY_INGEST_PER_GB = 0.50 # e.g. Datadog-class
ARIZE_AX_PER_GB = 0.005            # zero-copy claim


@dataclass
class Strategy:
    name: str
    sample_rate: float
    keep_errors: bool
    keep_highcost: bool


STRATEGIES = [
    Strategy("100% retain",                1.00, True, True),
    Strategy("10% random sample",          0.10, False, False),
    Strategy("5% success + 100% errors",   0.05, True, False),
    Strategy("5% success + errors + $$$",  0.05, True, True),
    Strategy("1% aggregates only",         0.01, True, True),
]


def simulate_day(strategy: Strategy, traces_per_day: int = 1_000_000) -> dict:
    rng = random.Random(7)
    retained = 0
    lost = 0
    for i in range(traces_per_day):
        is_error = rng.random() < 0.02
        is_highcost = rng.random() < 0.01
        keep = rng.random() < strategy.sample_rate
        if strategy.keep_errors and is_error:
            keep = True
        if strategy.keep_highcost and is_highcost:
            keep = True
        if keep:
            retained += 1
        else:
            lost += 1
    bytes_retained = retained * BYTES_PER_TRACE
    gb = bytes_retained / 1e9
    return {
        "name": strategy.name,
        "retained": retained,
        "lost": lost,
        "gb_per_day": gb,
        "s3_month": gb * 30 * COST_PER_GB_MONTH,
        "monolithic_month": gb * 30 * OBSERVABILITY_INGEST_PER_GB,
        "arize_month": gb * 30 * ARIZE_AX_PER_GB,
    }


def report(row: dict) -> None:
    print(f"{row['name']:30}  retained={row['retained']:7}  "
          f"lost={row['lost']:7}  {row['gb_per_day']:6.2f} GB/day  "
          f"mono=${row['monolithic_month']:8.2f}  "
          f"arize=${row['arize_month']:6.2f}  "
          f"s3=${row['s3_month']:5.2f}")


def main() -> None:
    print("=" * 120)
    print("OBSERVABILITY SAMPLING — 1M traces/day, 2026 price approximations")
    print("=" * 120)
    for s in STRATEGIES:
        report(simulate_day(s))

    print()
    print("Read: 100% retention on Datadog-class costs hundreds of $/day.")
    print("5% success + 100% errors + high-cost keeps signal, cuts 90% of bill.")
    print("Arize AX zero-copy pattern wins at scale when you already have a data lake.")


if __name__ == "__main__":
    main()
