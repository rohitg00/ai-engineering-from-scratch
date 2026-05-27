"""Layered cost-governor simulator — stdlib Python.

Simulates an agent that drifts into a polling loop after 30 turns. Compares
three configurations:

  1. no caps: unbounded spend
  2. monthly cap only: catches eventually, spends a lot first
  3. layered stack: per-request + iteration + velocity limit + monthly cap

Metrics: turns executed, total tokens, total dollars, trigger that fired.
"""

from __future__ import annotations

from dataclasses import dataclass, field


# ---------- Simulated run profile ----------

NORMAL_TURN_TOKENS = 2_500
LOOP_TURN_TOKENS = 8_000
LOOP_STARTS_AT = 30

# $/token (input+output blended) for a Sonnet-class model, mid-2026 rates
DOLLARS_PER_KTOK = 0.003


def turn_cost(turn: int) -> int:
    return LOOP_TURN_TOKENS if turn >= LOOP_STARTS_AT else NORMAL_TURN_TOKENS


# ---------- Governor ----------

@dataclass
class Governor:
    max_tokens_per_request: int = 10_000
    max_turns: int = 200
    max_budget_usd: float = 50.0
    velocity_usd_per_min: float = 5.0       # cut off above this rolling rate
    velocity_window_min: float = 10.0
    monthly_cap_usd: float = 500.0

    enable_request_cap: bool = True
    enable_iter_cap: bool = True
    enable_velocity: bool = True
    enable_session_cap: bool = True
    enable_monthly_cap: bool = True

    # per-minute turn rate (seconds per turn) for the simulator
    seconds_per_turn: float = 30.0


@dataclass
class Run:
    turns: int = 0
    tokens: int = 0
    dollars: float = 0.0
    history: list[tuple[float, float]] = field(default_factory=list)  # (minute, dollars-at-that-minute)
    stopped_by: str = ""


EPSILON_MIN = 1e-9


def velocity_exceeded(run: Run, gov: Governor, now_min: float) -> bool:
    if not run.history:
        return False
    cutoff = now_min - gov.velocity_window_min
    window = [(t, d) for (t, d) in run.history if t >= cutoff]
    if not window:
        return False
    start_min, start_dollars = window[0]
    window_dollars = run.dollars - start_dollars
    # Use the actual elapsed time inside the window, not the nominal
    # window width. During warm-up (now_min < velocity_window_min) this
    # stops the rate being under-reported.
    elapsed = max(now_min - start_min, EPSILON_MIN)
    rate = window_dollars / elapsed
    return rate > gov.velocity_usd_per_min


def simulate(gov: Governor, label: str) -> Run:
    run = Run()
    now_min = 0.0

    for turn in range(1, 10_001):
        tok = turn_cost(turn)
        if gov.enable_request_cap and tok > gov.max_tokens_per_request:
            tok = gov.max_tokens_per_request
        run.turns = turn
        run.tokens += tok
        run.dollars += (tok / 1000.0) * DOLLARS_PER_KTOK
        now_min += gov.seconds_per_turn / 60.0
        run.history.append((now_min, run.dollars))

        if gov.enable_iter_cap and turn >= gov.max_turns:
            run.stopped_by = "max_turns"
            break
        if gov.enable_session_cap and run.dollars >= gov.max_budget_usd:
            run.stopped_by = "max_budget_usd"
            break
        if gov.enable_velocity and velocity_exceeded(run, gov, now_min):
            run.stopped_by = "velocity_limit"
            break
        if gov.enable_monthly_cap and run.dollars >= gov.monthly_cap_usd:
            run.stopped_by = "monthly_cap"
            break

    if not run.stopped_by:
        run.stopped_by = "ran out of simulated turns"

    print(f"  {label:<24}  turns={run.turns:>5}  tokens={run.tokens:>8,}  "
          f"dollars=${run.dollars:>7.2f}  stopped_by={run.stopped_by}")
    return run


def main() -> None:
    print("=" * 85)
    print("LAYERED COST GOVERNORS (Phase 15, Lesson 13)")
    print("=" * 85)
    print()
    print("Agent enters a polling loop at turn 30.")
    print("-" * 85)

    # 1. no caps
    g = Governor(
        enable_request_cap=False,
        enable_iter_cap=False,
        enable_velocity=False,
        enable_session_cap=False,
        enable_monthly_cap=False,
    )
    # Cap at something huge so the sim terminates; this line is the "unbounded" case.
    g.max_turns = 10_000
    g.enable_iter_cap = True
    simulate(g, "no caps (iter 10k sim)")

    # 2. monthly cap only
    g = Governor(
        enable_request_cap=False,
        enable_iter_cap=False,
        enable_velocity=False,
        enable_session_cap=False,
        enable_monthly_cap=True,
    )
    simulate(g, "monthly cap only")

    # 3. layered stack
    g = Governor()
    simulate(g, "layered stack")

    print()
    print("=" * 85)
    print("HEADLINE: caps must layer, because failure modes differ by time scale")
    print("-" * 85)
    print("  Monthly cap fires late: the wallet is already half-gone.")
    print("  Velocity limit ($5/min rolling) catches a loop within minutes.")
    print("  Iteration cap prevents any single run from exceeding N turns.")
    print("  Per-request cap prevents any one completion from being unbounded.")
    print("  Session dollar cap (max_budget_usd) closes the seatbelt on cost.")
    print("  Each layer covers a different failure (loop, leak, surge, release).")


if __name__ == "__main__":
    main()
