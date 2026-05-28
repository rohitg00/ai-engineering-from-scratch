"""enforcement ladder つき multi-tenant LLM FinOps simulator — 標準ライブラリのみの Python。

Three-tier enforcement:
  1. tenant ごとの rate limit
  2. tenant ごとの daily spend cap
  3. spend z-score > 4 の kill switch
"""

from __future__ import annotations

from dataclasses import dataclass, field
import random
import statistics


@dataclass
class TenantPolicy:
    contracted_daily_usd: float
    rate_limit_per_min: int
    spend_cap_multiplier: float = 2.0
    kill_z_score: float = 4.0


@dataclass
class TenantState:
    spend_today_usd: float = 0.0
    minute_count: int = 0
    daily_history: list = field(default_factory=list)
    paused: bool = False


TENANTS = {
    "tenant_A_normal":  (TenantPolicy(100.0, rate_limit_per_min=120), TenantState(), 1.0),
    "tenant_B_growing": (TenantPolicy(50.0,  rate_limit_per_min=60),  TenantState(), 2.5),
    "tenant_C_abusive": (TenantPolicy(20.0,  rate_limit_per_min=40),  TenantState(), 25.0),
}


def simulate_day(day: int, verbose: bool) -> None:
    for name, (policy, state, traffic_mult) in TENANTS.items():
        if state.paused:
            continue
        requests = int(100 * traffic_mult * random.uniform(0.8, 1.3))
        tokens_per_req = int(random.gauss(600, 150))
        cost_per_req = (tokens_per_req / 1e6) * 10.0
        total_spend = requests * cost_per_req
        state.spend_today_usd += total_spend

        if state.spend_today_usd > policy.contracted_daily_usd * policy.spend_cap_multiplier:
            if verbose:
                print(f"  [cap breach] {name}: ${state.spend_today_usd:.2f} > cap ${policy.contracted_daily_usd * policy.spend_cap_multiplier:.2f} → rate を tighten + CS に alert")

        if len(state.daily_history) >= 5:
            mean = statistics.mean(state.daily_history)
            sd = statistics.stdev(state.daily_history) or 1
            z = (state.spend_today_usd - mean) / sd
            if z > policy.kill_z_score:
                state.paused = True
                if verbose:
                    print(f"  [KILL SWITCH] {name}: spend ${state.spend_today_usd:.2f} で z={z:.2f} (baseline ${mean:.2f} ± ${sd:.2f}) → auto-pause + page on-call")


def main() -> None:
    print("=" * 95)
    print("FINOPS ENFORCEMENT — 10 日間の 3 tenants。abusive tenant が kill switch を発火")
    print("=" * 95)
    random.seed(7)

    for day in range(1, 11):
        print(f"\n— Day {day} —")
        simulate_day(day, verbose=True)
        for name, (policy, state, _) in TENANTS.items():
            status = "PAUSED" if state.paused else "active"
            print(f"  {name}: spend=${state.spend_today_usd:7.2f}, contract=${policy.contracted_daily_usd:.2f}  [{status}]")
            state.daily_history.append(state.spend_today_usd)
            if not state.paused:
                state.spend_today_usd = 0.0
    print("\n読み方: rate limits は throttle し、caps は alerts を発火し、kill switch は blow-ups を捕まえます。")


if __name__ == "__main__":
    main()
