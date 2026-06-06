"""Speculative decoding: core algorithm and distribution equivalence.

Implements:
- Bernoulli accept / reject using min(1, q/p)
- Residual distribution (q - p)_+ for rejection fallback
- Bonus token on full acceptance
- Empirical check that the marginal distribution matches direct sampling
- Acceptance rate vs KL divergence sweep
"""

import math
import random


def sample(probs, rng):
    u = rng.random()
    c = 0.0
    for i, p in enumerate(probs):
        c += p
        if u < c:
            return i
    return len(probs) - 1


def residual(q, p):
    raw = [max(0.0, qi - pi) for qi, pi in zip(q, p)]
    s = sum(raw)
    if s == 0.0:
        return list(q)
    return [r / s for r in raw]


def kl(q, p):
    total = 0.0
    for qi, pi in zip(q, p):
        if qi > 0 and pi > 0:
            total += qi * math.log(qi / pi)
    return total


def spec_step_one_token(q, p, rng):
    """Draft 1 token from p, verify with q. Returns (accepted_token, was_accepted)."""
    d = sample(p, rng)
    p_prob = p[d]
    q_prob = q[d]
    u = rng.random()
    if u < min(1.0, q_prob / p_prob if p_prob > 0 else float("inf")):
        return d, True
    return sample(residual(q, p), rng), False


def spec_step_n(q, p, N, rng):
    """Draft N tokens (same context), then verify in one pass.
    Returns (final_token, n_accepted). Simplified: q and p are fixed per call.
    """
    accepted = 0
    for _ in range(N):
        d = sample(p, rng)
        p_prob = p[d]
        q_prob = q[d]
        u = rng.random()
        if u < min(1.0, q_prob / p_prob if p_prob > 0 else float("inf")):
            accepted += 1
        else:
            return sample(residual(q, p), rng), accepted
    bonus = sample(q, rng)
    return bonus, accepted + 1


def run_distribution_check(q, p, n_samples, rng):
    spec_counts = [0] * len(q)
    direct_counts = [0] * len(q)
    for _ in range(n_samples):
        d, _ = spec_step_one_token(q, p, rng)
        spec_counts[d] += 1
        direct_counts[sample(q, rng)] += 1
    return spec_counts, direct_counts


def chi_square(observed, expected):
    total_obs = sum(observed)
    total_exp = sum(expected)
    if total_obs == 0 or total_exp == 0:
        return 0.0
    result = 0.0
    for o, e in zip(observed, expected):
        e_norm = e * total_obs / total_exp
        if e_norm > 0:
            result += (o - e_norm) ** 2 / e_norm
    return result


def acceptance_rate(q, p, n_samples, rng):
    hits = 0
    for _ in range(n_samples):
        _, was = spec_step_one_token(q, p, rng)
        if was:
            hits += 1
    return hits / n_samples


def perturb(q, amount, rng):
    p = [max(1e-6, qi + amount * rng.gauss(0, 1)) for qi in q]
    s = sum(p)
    return [pi / s for pi in p]


def expected_tokens_per_verify(alpha, N):
    if alpha >= 1.0:
        return N + 1
    if alpha == 0:
        return 1
    return (1 - alpha ** (N + 1)) / (1 - alpha)


def main():
    rng = random.Random(7)
    V = 8
    q = [0.35, 0.20, 0.15, 0.10, 0.08, 0.06, 0.04, 0.02]
    p_good = perturb(q, amount=0.02, rng=rng)
    p_bad = perturb(q, amount=0.25, rng=rng)

    print("=== verifier distribution ===")
    print("  q: " + " ".join(f"{qi:.3f}" for qi in q))
    print()

    print("=== speculative vs direct sampling (distribution equivalence) ===")
    spec_c, direct_c = run_distribution_check(q, p_good, 50000, rng)
    chi = chi_square(spec_c, direct_c)
    print(f"  spec   counts (50000 samples): {spec_c}")
    print(f"  direct counts (50000 samples): {direct_c}")
    print(f"  chi^2 = {chi:.2f}   (V-1 = {V-1} df; large means distributions differ)")
    print(f"  {'PASS' if chi < 30 else 'FAIL'}: spec-decoded tokens match verifier distribution")
    print()

    print("=== acceptance rate vs KL(q || p) ===")
    print(f"  {'KL(q||p)':>10}  {'acceptance α':>14}")
    for noise in (0.005, 0.02, 0.05, 0.10, 0.25, 0.5):
        p = perturb(q, amount=noise, rng=random.Random(noise * 1000))
        alpha = acceptance_rate(q, p, 5000, rng)
        print(f"  {kl(q, p):>10.4f}  {alpha:>14.3f}")
    print()

    print("=== expected tokens per verifier call (theory) ===")
    print(f"  {'α':>5} " + "".join(f"  N={N:>2}" for N in (1, 3, 5, 7, 10)))
    for alpha in (0.3, 0.5, 0.7, 0.85, 0.95):
        row = f"  {alpha:>5.2f} " + "".join(
            f"  {expected_tokens_per_verify(alpha, N):>4.2f}" for N in (1, 3, 5, 7, 10)
        )
        print(row)
    print()

    print("takeaway: Leviathan's theorem holds — spec-decoded distribution = verifier's.")
    print("          At α=0.85 and N=5: ~4.1 tokens per verifier call ≈ 4x fewer big-model")
    print("          forwards (minus draft-model overhead).")


if __name__ == "__main__":
    main()
