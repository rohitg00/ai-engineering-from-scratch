"""Speculative decoding (Leviathan 2023) with N-token drafts and KV rollback.

Implements the full production speculative-decoding loop:
  - draft N tokens from p (cheap)
  - verify N positions in one parallel q forward
  - rejection rule: accept with min(1, q(d)/p(d))
  - residual sampling on rejection: (q - p)_+ renormalized
  - bonus token on full acceptance
  - KV cache rollback bookkeeping

Stdlib only. Numbers match what Phase 7 · 16 proved mathematically and what
Phase 10 · 12 described operationally. Here we stitch both together.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from typing import List


def sample(probs: List[float], rng: random.Random) -> int:
    u = rng.random()
    acc = 0.0
    for i, p in enumerate(probs):
        acc += p
        if u < acc:
            return i
    return len(probs) - 1


def residual(q: List[float], p: List[float]) -> List[float]:
    raw = [max(0.0, qi - pi) for qi, pi in zip(q, p)]
    s = sum(raw)
    if s == 0.0:
        return list(q)
    return [r / s for r in raw]


def kl(q: List[float], p: List[float]) -> float:
    total = 0.0
    for qi, pi in zip(q, p):
        if qi > 0 and pi > 0:
            total += qi * math.log(qi / pi)
    return total


@dataclass
class KVBuffer:
    """Tracks logical cache length for verifier. Physical bytes are notional."""
    length: int = 0

    def extend(self, n: int) -> None:
        self.length += n

    def truncate_to(self, n: int) -> None:
        self.length = n


def spec_step(q: List[float], p: List[float], N: int, kv: KVBuffer,
              rng: random.Random) -> tuple[List[int], int]:
    """One speculative step: draft N tokens from p, verify with q.

    Returns (tokens_emitted, verifier_forwards_used). verifier_forwards_used
    is always 1 here — that is the point. tokens_emitted is between 1 and N+1.

    For pedagogical simplicity q and p are context-free distributions shared
    across positions. The math extends to position-dependent q_i, p_i without
    changing the loop.
    """
    prefix_len = kv.length
    drafts: List[int] = []
    p_probs: List[float] = []
    for _ in range(N):
        d = sample(p, rng)
        drafts.append(d)
        p_probs.append(p[d])

    emitted: List[int] = []
    for i, d in enumerate(drafts):
        u = rng.random()
        q_prob = q[d]
        p_prob = p_probs[i]
        ratio = q_prob / p_prob if p_prob > 0 else float("inf")
        if u < min(1.0, ratio):
            emitted.append(d)
            kv.extend(1)
        else:
            correction = sample(residual(q, p), rng)
            emitted.append(correction)
            kv.truncate_to(prefix_len + len(emitted))
            return emitted, 1

    bonus = sample(q, rng)
    emitted.append(bonus)
    kv.extend(1)
    return emitted, 1


def direct_sample(q: List[float], n: int, rng: random.Random) -> List[int]:
    return [sample(q, rng) for _ in range(n)]


def distribution_check(q: List[float], p: List[float], n_steps: int,
                       rng: random.Random) -> tuple[List[int], List[int]]:
    """Check that the FIRST emitted token (the Leviathan-sampled one) is
    distributed as q. On accept that is the draft; on reject it is the
    residual correction. The bonus token that follows on full acceptance is
    also distributed as q but is a second draw and should not be mixed in
    here."""
    spec_counts = [0] * len(q)
    direct_counts = [0] * len(q)
    for _ in range(n_steps):
        kv = KVBuffer()
        tokens, _ = spec_step(q, p, N=1, kv=kv, rng=rng)
        spec_counts[tokens[0]] += 1
        direct_counts[sample(q, rng)] += 1
    return spec_counts, direct_counts


def chi_square(observed: List[int], expected: List[int]) -> float:
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


def measure_alpha(q: List[float], p: List[float], n_samples: int,
                  rng: random.Random) -> float:
    hits = 0
    for _ in range(n_samples):
        d = sample(p, rng)
        u = rng.random()
        q_prob = q[d]
        p_prob = p[d]
        if p_prob > 0 and u < min(1.0, q_prob / p_prob):
            hits += 1
    return hits / n_samples


def expected_tokens_per_verify(alpha: float, N: int) -> float:
    if alpha >= 1.0:
        return N + 1
    if alpha <= 0.0:
        return 1.0
    return (1.0 - alpha ** (N + 1)) / (1.0 - alpha)


def wall_time_per_token(alpha: float, N: int, c: float) -> float:
    """Draft cost is c per token relative to the verifier (cost 1.0).

    Each verifier call costs 1.0 plus N * c for the draft. Expected tokens
    emitted is (1 - alpha^(N+1)) / (1 - alpha).
    """
    return (1.0 + N * c) / expected_tokens_per_verify(alpha, N)


def perturb(q: List[float], amount: float, rng: random.Random) -> List[float]:
    p = [max(1e-6, qi + amount * rng.gauss(0, 1)) for qi in q]
    s = sum(p)
    return [pi / s for pi in p]


def main() -> None:
    rng = random.Random(42)

    q = [0.30, 0.22, 0.15, 0.10, 0.08, 0.07, 0.05, 0.03]
    p_eagle3 = perturb(q, amount=0.005, rng=random.Random(1))
    p_eagle1 = perturb(q, amount=0.02, rng=random.Random(2))
    p_vanilla = perturb(q, amount=0.08, rng=random.Random(3))

    print("=" * 70)
    print("SPECULATIVE DECODING AND EAGLE-3 (Phase 10, Lesson 15)")
    print("=" * 70)
    print()
    print("verifier q:  " + " ".join(f"{qi:.3f}" for qi in q))
    print()

    print("-" * 70)
    print("Step 1: Leviathan distribution-equivalence check (N=1, 50000 trials)")
    print("-" * 70)
    spec_c, direct_c = distribution_check(q, p_eagle1, 50000, rng)
    chi = chi_square(spec_c, direct_c)
    print(f"  spec   counts: {spec_c}")
    print(f"  direct counts: {direct_c}")
    print(f"  chi^2 = {chi:.2f}  (df={len(q) - 1}; 95% crit ~14.07)")
    verdict = "PASS" if chi < 14.07 else "CHECK"
    print(f"  verdict: {verdict}  (spec-decoded distribution matches verifier)")
    print()

    print("-" * 70)
    print("Step 2: measured acceptance rate alpha per draft quality")
    print("-" * 70)
    print(f"  {'draft':<12} {'KL(q||p)':>10} {'alpha':>8}")
    for name, p in [("vanilla", p_vanilla), ("eagle-1", p_eagle1),
                    ("eagle-3", p_eagle3)]:
        a = measure_alpha(q, p, 20000, random.Random(7))
        print(f"  {name:<12} {kl(q, p):>10.4f} {a:>8.3f}")
    print()

    print("-" * 70)
    print("Step 3: expected tokens per verifier call (theory)")
    print("-" * 70)
    Ns = [1, 3, 5, 7, 10]
    alphas = [0.55, 0.70, 0.80, 0.90, 0.95]
    print(f"  {'alpha':>6}  " + "".join(f"{f'N={N}':>8}" for N in Ns))
    for a in alphas:
        row = f"  {a:>6.2f}  " + "".join(
            f"{expected_tokens_per_verify(a, N):>8.2f}" for N in Ns
        )
        print(row)
    print()

    print("-" * 70)
    print("Step 4: wall time per token at c=0.04 (EAGLE-3-class draft cost)")
    print("-" * 70)
    print(f"  {'alpha':>6}  " + "".join(f"{f'N={N}':>8}" for N in Ns))
    for a in alphas:
        row = f"  {a:>6.2f}  " + "".join(
            f"{wall_time_per_token(a, N, c=0.04):>8.3f}" for N in Ns
        )
        print(row)
    print("  (lower = faster. baseline no-spec-decode = 1.000 per token)")
    print()

    print("-" * 70)
    print("Step 5: end-to-end simulated run, N=5, draft=eagle-3, 1000 rounds")
    print("-" * 70)
    kv = KVBuffer()
    total_tokens = 0
    total_forwards = 0
    accepted_per_round: List[int] = []
    for _ in range(1000):
        tokens, forwards = spec_step(q, p_eagle3, N=5, kv=kv, rng=rng)
        total_tokens += len(tokens)
        total_forwards += forwards
        accepted_per_round.append(len(tokens))
    mean_tokens = total_tokens / 1000
    print(f"  total tokens emitted : {total_tokens}")
    print(f"  verifier forwards    : {total_forwards}")
    print(f"  mean tokens / forward: {mean_tokens:.2f}")
    print(f"  kv logical length    : {kv.length}   (tracks accepted prefix)")
    print(f"  expected at alpha=0.95, N=5: "
          f"{expected_tokens_per_verify(0.95, 5):.2f}")
    print()

    print("takeaway: EAGLE-3 class draft quality (alpha~0.9) at N=5 delivers")
    print("          ~4-5 tokens per verifier forward. The 3-6.5x EAGLE-3 paper")
    print("          number is that ratio plus tree-search and TTT gains.")


if __name__ == "__main__":
    main()
