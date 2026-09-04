"""Many-shot jailbreaking toy — stdlib Python.

Target: a filter whose refusal probability decays as a power law in the
number of compliance pairs present in the context. Reproduces the shape of
Anil et al. 2024 Figure 2 without training a model.

Usage: python3 code/main.py
"""

from __future__ import annotations

import math
import random


random.seed(41)


def target_asr(n_shots: int, alpha: float = 0.5, a0: float = 0.02) -> float:
    """Target's attack-success-rate as a function of shot count.
    Power-law shape: ASR(n) = min(1, a0 + c * n^alpha).

    This is the empirical pattern Anil et al. 2024 observe: fails reliably
    at 5 shots, begins to succeed around 32, saturates around 256.
    """
    if n_shots <= 0:
        return 0.0
    c = 0.03
    return min(1.0, a0 + c * (n_shots ** alpha))


def defense_adjusted(n_shots: int, alpha: float = 0.5) -> float:
    """A simple defense: classifier detects the many-shot pattern and caps
    effective shot count at 16. ASR curve saturates at the 16-shot value."""
    eff = min(n_shots, 16)
    return target_asr(eff, alpha)


def simulate(n_shots: int, asr_fn, trials: int = 500) -> float:
    p = asr_fn(n_shots)
    hits = sum(1 for _ in range(trials) if random.random() < p)
    return hits / trials


def fit_power_law(shots: list[int], asrs: list[float]) -> tuple[float, float]:
    """Simple log-log linear regression: log(ASR) = log(c) + alpha * log(n)."""
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

    print("\n-- undefended target (power-law ASR curve) --")
    undef = []
    for s in shots:
        rate = simulate(s, target_asr)
        undef.append(rate)
        print(f"  shots={s:4d}   ASR={rate:.3f}")
    alpha, c = fit_power_law(shots, undef)
    print(f"\n  fitted power law: ASR ~= {c:.3f} * n^{alpha:.3f}")

    print("\n-- classifier-defended target (caps effective shots at 16) --")
    for s in shots:
        rate = simulate(s, defense_adjusted)
        print(f"  shots={s:4d}   ASR={rate:.3f}")

    print("\n" + "=" * 70)
    print("TAKEAWAY: ASR grows power-law in shot count. the defense caps the")
    print("effective number of shots. preserving benign ICL while suppressing")
    print("harmful ICL requires a classifier that distinguishes the two at the")
    print("context level -- which is why classifier-based prompt modification")
    print("(Anthropic 2024) reports 61%->2% reduction without breaking ICL.")
    print("=" * 70)


if __name__ == "__main__":
    main()
