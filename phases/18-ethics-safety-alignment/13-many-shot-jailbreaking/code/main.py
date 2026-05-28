"""Many-shot jailbreaking toy — stdlib Python.

target: context 内の compliance pairs 数に応じて refusal probability が
power law で減衰する filter。モデルを訓練せずに Anil et al. 2024
Figure 2 の形を再現する。

Usage: python3 code/main.py
"""

from __future__ import annotations

import math
import random


random.seed(41)


def target_asr(n_shots: int, alpha: float = 0.5, a0: float = 0.02) -> float:
    """shot count の関数としての target の attack-success-rate。
    power-law shape: ASR(n) = min(1, a0 + c * n^alpha)。

    これは Anil et al. 2024 が観察した経験的 pattern。5 shots では
    信頼できる形で失敗し、32 あたりで成功し始め、256 あたりで飽和する。
    """
    if n_shots <= 0:
        return 0.0
    c = 0.03
    return min(1.0, a0 + c * (n_shots ** alpha))


def defense_adjusted(n_shots: int, alpha: float = 0.5) -> float:
    """単純な defense: classifier が many-shot pattern を検出し、
    effective shot count を 16 に cap する。ASR curve は 16-shot 値で飽和する。"""
    eff = min(n_shots, 16)
    return target_asr(eff, alpha)


def simulate(n_shots: int, asr_fn, trials: int = 500) -> float:
    p = asr_fn(n_shots)
    hits = sum(1 for _ in range(trials) if random.random() < p)
    return hits / trials


def fit_power_law(shots: list[int], asrs: list[float]) -> tuple[float, float]:
    """単純な log-log linear regression: log(ASR) = log(c) + alpha * log(n)。"""
    xs = [math.log(s) for s in shots if s > 0]
    ys = [math.log(max(a, 1e-4)) for a in asrs]
    n = len(xs)
    mx = sum(xs) / n
    my = sum(ys) / n
    num = sum((xi - mx) * (yi - my) for xi, yi in zip(xs, ys))
    den = sum((xi - mx) ** 2 for xi in xs)
    alpha = num / den
    logc = my - alpha * mx
    return alpha, math.exp(logc)


def main() -> None:
    print("=" * 70)
    print("MANY-SHOT JAILBREAKING TOY (Phase 18, Lesson 13)")
    print("=" * 70)

    shots = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512]

    print("\n-- 防御なし target (power-law ASR curve) --")
    undef = []
    for s in shots:
        rate = simulate(s, target_asr)
        undef.append(rate)
        print(f"  shots={s:4d}   ASR={rate:.3f}")
    alpha, c = fit_power_law(shots, undef)
    print(f"\n  fitted power law: ASR ~= {c:.3f} * n^{alpha:.3f}")

    print("\n-- classifier で防御した target (effective shots を 16 に cap) --")
    for s in shots:
        rate = simulate(s, defense_adjusted)
        print(f"  shots={s:4d}   ASR={rate:.3f}")

    print("\n" + "=" * 70)
    print("要点: ASR は shot count に対して power-law で伸びる。defense は")
    print("effective shots 数を cap する。benign ICL を保ちながら harmful ICL を")
    print("抑えるには、context level で両者を区別する classifier が必要である。")
    print("これが classifier-based prompt modification (Anthropic 2024) が")
    print("ICL を壊さず 61%->2% の低下を報告した理由である。")
    print("=" * 70)


if __name__ == "__main__":
    main()
