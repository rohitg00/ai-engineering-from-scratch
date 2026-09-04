"""AI Control protocol simulation — stdlib Python.

Four protocols on a toy backdoor task:
  baseline   : ship U's output directly.
  upfront    : audit every output with H (budget-limited).
  untrusted  : second U scores outputs (collusion-risk).
  trusted_ed : T edits every output; H on low-confidence T flags.

Outcomes: backdoor-ship rate (safety-inverted) and useful-output rate.

Usage: python3 code/main.py
"""

from __future__ import annotations

import random


random.seed(23)


def u_produce(backdoor_rate: float) -> tuple[str, bool]:
    """U produces an output. Returns (output, is_backdoored)."""
    is_backdoor = random.random() < backdoor_rate
    return ("useful" if not is_backdoor else "backdoor"), is_backdoor


def t_edit(output: str, is_backdoor: bool, t_skill: float,
           overreject: float = 0.05) -> tuple[str, bool, bool]:
    """T edits. Returns (edited, still_backdoored, t_low_confidence).

    T succeeds at removing backdoors with probability t_skill. T also rejects
    a fraction of benign outputs (overreject).
    """
    if is_backdoor:
        if random.random() < t_skill:
            return ("useful", False, False)
        return ("backdoor", True, True)
    # benign input: T over-rejects with some probability
    if random.random() < overreject:
        return ("rejected", False, True)
    return ("useful", False, False)


def untrusted_monitor(is_backdoor: bool, collusion: float) -> bool:
    """Second U instance scores. If it colludes, it passes backdoors.

    collusion = probability the monitor colludes with the producer.
    Returns True if the monitor flags the output (i.e. catches it).
    """
    if not is_backdoor:
        # monitor correctly passes benign with high probability
        return random.random() < 0.05
    # monitor would normally flag; collusion suppresses that signal.
    if random.random() < collusion:
        return False
    return random.random() < 0.80


def run_protocol(name: str, backdoor_rate: float, h_budget: float,
                 n: int, t_skill: float = 0.7, collusion: float = 0.30) -> None:
    useful, shipped_backdoor, used_h = 0, 0, 0
    for _ in range(n):
        _, is_bd = u_produce(backdoor_rate)
        if name == "baseline":
            if not is_bd:
                useful += 1
            else:
                shipped_backdoor += 1
        elif name == "upfront":
            if used_h / n < h_budget:
                used_h += 1
                if not is_bd:
                    useful += 1
            else:
                if not is_bd:
                    useful += 1
                else:
                    shipped_backdoor += 1
        elif name == "untrusted":
            flagged = untrusted_monitor(is_bd, collusion)
            if flagged:
                if used_h / n < h_budget:
                    used_h += 1
                else:
                    if not is_bd:
                        useful += 1
                    else:
                        shipped_backdoor += 1
            else:
                if not is_bd:
                    useful += 1
                else:
                    shipped_backdoor += 1
        elif name == "trusted_ed":
            edited, still_bd, low_conf = t_edit("x", is_bd, t_skill)
            if low_conf and used_h / n < h_budget:
                used_h += 1
                if not is_bd:
                    useful += 1
            else:
                if edited == "useful":
                    useful += 1
                elif still_bd:
                    shipped_backdoor += 1
    print(f"\n{name:>12s}  useful={useful/n:.3f}  backdoor={shipped_backdoor/n:.3f}"
          f"  H used={used_h/n:.3f}")


def main() -> None:
    print("=" * 70)
    print("AI CONTROL PROTOCOL SIMULATION (Phase 18, Lesson 10)")
    print("=" * 70)

    for br in (0.05, 0.10, 0.20):
        print(f"\n-- backdoor-rate = {br}, H budget = 0.10, n = 1000 --")
        for proto in ("baseline", "upfront", "untrusted", "trusted_ed"):
            run_protocol(proto, backdoor_rate=br, h_budget=0.10, n=1000)

    print("\n-- collusion sweep on untrusted monitoring (backdoor_rate=0.10) --")
    for col in (0.0, 0.20, 0.50, 0.80):
        print(f"\ncollusion={col}")
        run_protocol("untrusted", backdoor_rate=0.10, h_budget=0.10, n=1000,
                     collusion=col)

    print("\n" + "=" * 70)
    print("TAKEAWAY: trusted editing Pareto-dominates untrusted monitoring on")
    print("this toy task. collusion between two U instances erodes untrusted")
    print("monitoring's safety signal. trusted editing has no collusion risk")
    print("because T is, by assumption, not adversarial. cost: T's editing")
    print("signal is bounded by T's capability; at larger U-T capability gaps")
    print("control eventually fails. see Greenblatt 2023.")
    print("=" * 70)


if __name__ == "__main__":
    main()
