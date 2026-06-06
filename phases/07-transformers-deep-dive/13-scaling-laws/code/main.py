"""Scaling laws — Chinchilla loss equation, compute-optimal (N, D), over-training cost.

Pure stdlib. Validates the D/N ≈ 20 rule numerically by grid search.
"""

import math


A = 406.4
B_CONST = 410.7
ALPHA = 0.34
BETA = 0.28
E_CONST = 1.69


def chinchilla_loss(N, D, A=A, B=B_CONST, alpha=ALPHA, beta=BETA, E=E_CONST):
    return A / N ** alpha + B / D ** beta + E


def compute_optimal(C_flops, n_grid=200):
    """Find (N, D) minimizing loss subject to 6ND = C by grid search over log N."""
    # 6ND = C => D = C / (6N)
    log_N_min = math.log10(1e5)
    log_N_max = math.log10(1e13)
    best = (None, None, float("inf"))
    for i in range(n_grid):
        log_N = log_N_min + (log_N_max - log_N_min) * i / (n_grid - 1)
        N = 10 ** log_N
        D = C_flops / (6 * N)
        if D < 1e6:
            continue
        loss = chinchilla_loss(N, D)
        if loss < best[2]:
            best = (N, D, loss)
    return best


def pretty(n):
    """human-readable."""
    for unit, k in [("T", 1e12), ("B", 1e9), ("M", 1e6), ("K", 1e3)]:
        if n >= k:
            return f"{n / k:.1f}{unit}"
    return f"{n:.0f}"


def main():
    print("=== compute-optimal (N, D) across compute budgets ===")
    print(f"{'compute':>12}  {'N*':>10}  {'D*':>10}  {'D/N':>7}  {'loss':>7}")
    for C in [1e18, 1e19, 1e20, 1e21, 1e22, 1e23, 1e24, 1e25]:
        N, D, L = compute_optimal(C)
        print(f"  {C:>10.0e}   {pretty(N):>9}   {pretty(D):>9}   {D / N:>6.1f}   {L:>6.3f}")
    print()
    print("Hoffmann 2022 published D/N ≈ 20 as the headline. with the fitted")
    print("constants above (alpha=0.34, beta=0.28) the optimum D/N grows with C.")
    print("real scaling-law fits place optimum around 20 for the compute range")
    print("Chinchilla studied (~1e22 to 1e23 FLOPs); extrapolation drifts.")
    print()

    print("=== over-training cost (Llama-style) ===")
    # Take a compute budget, use 1/10 of optimal N and 10x of optimal D.
    C = 1e24
    N_opt, D_opt, L_opt = compute_optimal(C)
    N_under = N_opt / 10
    D_over = D_opt * 10
    L_over = chinchilla_loss(N_under, D_over)
    print(f"compute budget:                 {C:.0e} FLOPs")
    print(f"chinchilla optimal:             N={pretty(N_opt)}  D={pretty(D_opt)}  loss={L_opt:.3f}")
    print(f"over-trained  (N/10, D×10):     N={pretty(N_under)}  D={pretty(D_over)}  loss={L_over:.3f}")
    print(f"loss penalty (over-train):      {L_over - L_opt:+.3f}")
    print(f"inference FLOP savings (~N):    {N_opt / N_under:.0f}x cheaper at inference")
    print()

    print("=== real models vs predicted loss ===")
    models = [
        ("GPT-3 175B",          175e9,  300e9),
        ("Chinchilla 70B",       70e9, 1400e9),
        ("Llama 2 70B",          70e9, 2000e9),
        ("Llama 3 8B",            8e9, 15_000e9),
        ("Llama 3 70B",          70e9, 15_000e9),
        ("DeepSeek-V3 (active)", 37e9, 14_800e9),
        ("Qwen 2.5 72B",         72e9,  18_000e9),
    ]
    print(f"{'model':<24}  {'N':>8}  {'D':>8}  {'D/N':>7}  {'loss':>7}")
    for name, N, D in models:
        L = chinchilla_loss(N, D)
        print(f"  {name:<22}  {pretty(N):>7}  {pretty(D):>7}  {D / N:>6.1f}  {L:>6.3f}")
    print()
    print("many 2026 models are massively past chinchilla (D/N ≈ 20).")
    print("reason: inference cost scales with N; over-training saves inference")
    print("at the price of extra pretrain FLOPs.")


if __name__ == "__main__":
    main()
