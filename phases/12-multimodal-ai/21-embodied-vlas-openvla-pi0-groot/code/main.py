"""Embodied VLA action format toys — stdlib.

Three mini-implementations:
  1. Discrete-bin action tokenization (RT-2 / OpenVLA).
  2. A FAST-style DCT-quantize compressor.
  3. Token-count comparison across (discrete, FAST, continuous flow).
"""

from __future__ import annotations

import math
from dataclasses import dataclass


def discretize(action: list[float], bins: int = 256) -> list[int]:
    """Map a [-1,1]^D action to D integer bins."""
    tokens = []
    for a in action:
        idx = int((a + 1) / 2 * (bins - 1))
        idx = max(0, min(bins - 1, idx))
        tokens.append(idx)
    return tokens


def undiscretize(tokens: list[int], bins: int = 256) -> list[float]:
    return [(2 * t / (bins - 1)) - 1 for t in tokens]


def dct(x: list[float]) -> list[float]:
    """Naive type-II DCT."""
    n = len(x)
    out = []
    for k in range(n):
        s = 0.0
        for i in range(n):
            s += x[i] * math.cos(math.pi / n * (i + 0.5) * k)
        out.append(s)
    return out


def fast_compress(trajectory: list[list[float]], keep_coeff: int = 4,
                  bins: int = 32) -> list[int]:
    """FAST-style tokenizer: per-dim DCT + keep low-freq + quantize.
    trajectory: list of actions (list of floats), shape (T, D).
    Returns a flat integer token list."""
    if not trajectory:
        return []
    D = len(trajectory[0])
    tokens = []
    for d in range(D):
        series = [step[d] for step in trajectory]
        coeffs = dct(series)[:keep_coeff]
        for c in coeffs:
            c_norm = max(-1.0, min(1.0, c / len(series)))
            idx = int((c_norm + 1) / 2 * (bins - 1))
            tokens.append(idx)
    return tokens


def compare_formats() -> None:
    T = 30
    D = 10
    trajectory = [[math.sin(0.1 * t + 0.3 * d) for d in range(D)] for t in range(T)]

    print("\nACTION TOKEN COUNTS (30-step trajectory, 10-DOF)")
    print("-" * 60)
    per_step_discrete = len(discretize(trajectory[0]))
    total_discrete = per_step_discrete * T
    fast_tokens = fast_compress(trajectory, keep_coeff=4)
    total_fast = len(fast_tokens)
    continuous_flow_count = 1
    rows = [
        ("discrete 256-bin (RT-2)",   total_discrete, "per-step autoregressive"),
        ("FAST 4-coeff per dim",      total_fast,     "sequence compressor"),
        ("flow-matching (pi0)",       continuous_flow_count, "single head output"),
    ]
    for name, count, note in rows:
        print(f"  {name:<28}  {count:>6} tokens   ({note})")
    print(f"\n  speedup: FAST ~{total_discrete / total_fast:.1f}x vs discrete bin")


def round_trip_demo() -> None:
    print("\nROUND-TRIP: 10-DOF action through discretize + undiscretize")
    print("-" * 60)
    action = [0.1, -0.5, 0.25, -0.75, 0.9, -0.1, 0.0, 0.33, -0.67, 0.5]
    tokens = discretize(action, bins=256)
    recovered = undiscretize(tokens, bins=256)
    print(f"  original  : {[round(a, 3) for a in action]}")
    print(f"  tokens    : {tokens}")
    print(f"  recovered : {[round(r, 3) for r in recovered]}")
    max_err = max(abs(a - r) for a, r in zip(action, recovered))
    print(f"  max abs error: {max_err:.4f}  (bin width = 2/255 ~ 0.0078)")


def lineage_table() -> None:
    print("\nVLA LINEAGE")
    print("-" * 60)
    rows = [
        ("RT-2",       "2023", "PaLM-X + discrete bin",  "closed"),
        ("OpenVLA",    "2024", "Llama 7B + discrete bin", "open"),
        ("Octo",       "2024", "small diffusion head",   "open"),
        ("pi0",        "2024", "flow-matching head",     "open"),
        ("pi0-FAST",   "2025", "flow + FAST tokenizer",  "open"),
        ("GR00T N1",   "2025", "dual-system humanoid",   "open"),
        ("GR00T N1.7", "2025", "sim-to-real data scale", "open"),
    ]
    print(f"  {'model':<12}{'year':<6}{'pattern':<28}{'open/closed'}")
    for r in rows:
        print(f"  {r[0]:<12}{r[1]:<6}{r[2]:<28}{r[3]}")


def main() -> None:
    print("=" * 60)
    print("EMBODIED VLAS (Phase 12, Lesson 21)")
    print("=" * 60)

    round_trip_demo()
    compare_formats()
    lineage_table()

    print("\nCO-FINE-TUNING RATIO (web VQA : robot trajectories)")
    print("-" * 60)
    print("  RT-2       : ~1:1")
    print("  OpenVLA    : ~0.5:1 web-to-robot")
    print("  pi0        : similar balance")
    print("  too much VQA -> forgets actions; too much robot -> loses language")


if __name__ == "__main__":
    main()
