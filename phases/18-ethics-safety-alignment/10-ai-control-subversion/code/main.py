"""AI Control protocol simulation — stdlib Python。

toy backdoor task 上の 4 protocols:
  baseline   : U の output をそのまま ship する。
  upfront    : すべての output を H で audit する (budget-limited)。
  untrusted  : 2 つ目の U が outputs を score する (collusion-risk)。
  trusted_ed : T がすべての output を edit し、low-confidence T flags で H を呼ぶ。

outcomes: backdoor-ship rate (safety-inverted) と useful-output rate。

Usage: python3 code/main.py
"""

from __future__ import annotations

import random


random.seed(23)


def u_produce(backdoor_rate: float) -> tuple[str, bool]:
    """U が output を生成します。(output, is_backdoored) を返します。"""
    is_backdoor = random.random() < backdoor_rate
    return ("useful" if not is_backdoor else "backdoor"), is_backdoor


def t_edit(output: str, is_backdoor: bool, t_skill: float,
           overreject: float = 0.05) -> tuple[str, bool, bool]:
    """T が edit します。(edited, still_backdoored, t_low_confidence) を返します。

    T は t_skill の確率で backdoors の除去に成功します。T は benign outputs の
    一部も reject します (overreject)。
    """
    if is_backdoor:
        if random.random() < t_skill:
            return ("useful", False, False)
        return ("backdoor", True, True)
    # benign input: T はある確率で over-reject する
    if random.random() < overreject:
        return ("rejected", False, True)
    return ("useful", False, False)


def untrusted_monitor(is_backdoor: bool, collusion: float) -> bool:
    """2 つ目の U instance が score します。collude すると backdoors を通します。

    collusion = monitor が producer と collude する確率。
    monitor が output を flag する (つまり catch する) なら True を返します。
    """
    if not is_backdoor:
        # monitor は benign を高い確率で正しく pass する
        return random.random() < 0.05
    # 通常 monitor は flag するが、collusion はその signal を suppress する。
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
    print(f"\n{name:>12s}  usefulness={useful/n:.3f}  backdoor={shipped_backdoor/n:.3f}"
          f"  H used={used_h/n:.3f}")


def main() -> None:
    print("=" * 70)
    print("AI CONTROL PROTOCOL SIMULATION (Phase 18, Lesson 10)")
    print("=" * 70)

    for br in (0.05, 0.10, 0.20):
        print(f"\n-- backdoor-rate = {br}, H budget = 0.10, n = 1000 --")
        for proto in ("baseline", "upfront", "untrusted", "trusted_ed"):
            run_protocol(proto, backdoor_rate=br, h_budget=0.10, n=1000)

    print("\n-- untrusted monitoring の collusion sweep (backdoor_rate=0.10) --")
    for col in (0.0, 0.20, 0.50, 0.80):
        print(f"\ncollusion={col}")
        run_protocol("untrusted", backdoor_rate=0.10, h_budget=0.10, n=1000,
                     collusion=col)

    print("\n" + "=" * 70)
    print("要点: この toy task では trusted editing が untrusted monitoring を")
    print("Pareto-dominate します。2 つの U instances 間の collusion は")
    print("untrusted monitoring の safety signal を侵食します。trusted editing には")
    print("collusion risk がありません。T は仮定上 adversarial ではないからです。")
    print("代償として、T の editing signal は T の capability に bound されます。")
    print("U-T capability gap が大きくなると control は最終的に失敗します。")
    print("Greenblatt 2023 を参照してください。")
    print("=" * 70)


if __name__ == "__main__":
    main()
