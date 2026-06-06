"""Native Sparse Attention (DeepSeek NSA) in stdlib Python.

Implements the three parallel branches from Yuan et al. 2025:
  - compressed branch: coarse-grained attention over block-averaged keys
  - selected branch: fine-grained attention over top-k uncompressed blocks
  - sliding-window branch: attention over the last W tokens

Combines them with a gate and prints the per-query key count for each branch
vs. full attention. Scales the key-count report to 64k and 128k contexts to
show the long-sequence savings NSA targets.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from typing import List


def dot(a: List[float], b: List[float]) -> float:
    return sum(ai * bi for ai, bi in zip(a, b))


def softmax(row: List[float]) -> List[float]:
    m = max(row)
    exps = [math.exp(x - m) for x in row]
    s = sum(exps)
    return [e / s for e in exps]


def attention(q: List[float], K: List[List[float]],
              V: List[List[float]]) -> tuple[List[float], List[float]]:
    """Returns (weights, output)."""
    d = len(q)
    scale = math.sqrt(d)
    scores = [dot(q, k) / scale for k in K]
    w = softmax(scores)
    d_v = len(V[0])
    out = [sum(w[j] * V[j][c] for j in range(len(V))) for c in range(d_v)]
    return w, out


def compress_mean(K: List[List[float]], l: int) -> List[List[float]]:
    """Collapse every l consecutive keys into their mean. Real NSA uses a
    learned MLP here — mean-pool is the pedagogical baseline."""
    n = len(K)
    d = len(K[0])
    n_blocks = (n + l - 1) // l
    out = []
    for b in range(n_blocks):
        start, end = b * l, min((b + 1) * l, n)
        block = K[start:end]
        summary = [sum(row[c] for row in block) / len(block) for c in range(d)]
        out.append(summary)
    return out


def top_k_blocks(scores: List[float], k: int) -> List[int]:
    indexed = sorted(range(len(scores)), key=lambda i: -scores[i])
    return sorted(indexed[:k])


def fine_grained_keys(K: List[List[float]], V: List[List[float]], l: int,
                      block_indices: List[int]) -> tuple[List[List[float]], List[List[float]]]:
    """Load the raw (uncompressed) tokens from the selected blocks."""
    k_out, v_out = [], []
    for b in block_indices:
        start, end = b * l, min((b + 1) * l, len(K))
        k_out.extend(K[start:end])
        v_out.extend(V[start:end])
    return k_out, v_out


def sliding_window(K: List[List[float]], V: List[List[float]],
                   W: int) -> tuple[List[List[float]], List[List[float]]]:
    n = len(K)
    start = max(0, n - W)
    return K[start:], V[start:]


def gate(q: List[float], Wg: List[List[float]]) -> List[float]:
    """Gate MLP: 1-layer linear + sigmoid, produces 3 branch weights."""
    logits = [dot(q, Wg[i]) for i in range(3)]
    return [1.0 / (1.0 + math.exp(-x)) for x in logits]


@dataclass
class NSAConfig:
    l: int
    k: int
    W: int


def nsa_step(q: List[float], K: List[List[float]], V: List[List[float]],
             Wg: List[List[float]], cfg: NSAConfig) -> tuple[List[float], dict]:
    K_cmp = compress_mean(K, cfg.l)
    V_cmp = compress_mean(V, cfg.l)
    cmp_w, cmp_out = attention(q, K_cmp, V_cmp)

    picks = top_k_blocks(cmp_w, cfg.k)
    K_sel, V_sel = fine_grained_keys(K, V, cfg.l, picks)
    if K_sel:
        _, sel_out = attention(q, K_sel, V_sel)
    else:
        sel_out = [0.0] * len(q)

    K_win, V_win = sliding_window(K, V, cfg.W)
    _, win_out = attention(q, K_win, V_win)

    g = gate(q, Wg)
    combined = [g[0] * cmp_out[i] + g[1] * sel_out[i] + g[2] * win_out[i]
                for i in range(len(cmp_out))]

    info = {
        "cmp_keys": len(K_cmp),
        "sel_keys": len(K_sel),
        "win_keys": len(K_win),
        "total_keys": len(K_cmp) + len(K_sel) + len(K_win),
        "full_keys": len(K),
        "selected_blocks": picks,
        "gates": g,
    }
    return combined, info


def synthesize_sequence(n: int, d: int, signal_blocks: List[int], l: int,
                        rng: random.Random) -> tuple[List[List[float]], List[List[float]], List[float]]:
    """Build K, V where `signal_blocks` carry a shared pattern and the query
    is aligned to that pattern. The rest is Gaussian noise."""
    pattern = [rng.gauss(0, 1) for _ in range(d)]
    norm = math.sqrt(sum(x * x for x in pattern))
    pattern = [x / norm for x in pattern]
    K = [[rng.gauss(0, 0.3) for _ in range(d)] for _ in range(n)]
    V = [[rng.gauss(0, 1) for _ in range(d)] for _ in range(n)]
    for b in signal_blocks:
        start, end = b * l, min((b + 1) * l, n)
        for i in range(start, end):
            K[i] = list(pattern)
    q = list(pattern)
    return K, V, q


def count_full_attention(N: int) -> int:
    return N


def count_nsa(N: int, l: int, k: int, W: int) -> int:
    return (N // l) + (k * l) + W


def main() -> None:
    rng = random.Random(11)
    print("=" * 70)
    print("NATIVE SPARSE ATTENTION — DeepSeek NSA (Phase 10, Lesson 17)")
    print("=" * 70)
    print()

    d = 16
    n = 1024
    l, k, W = 32, 4, 128
    signal_blocks = [3, 17, 28]

    print("-" * 70)
    print(f"Step 1: synthetic N={n}, d={d}, signal at blocks {signal_blocks}")
    print(f"        config: l={l} (compression block), k={k} (top-k), W={W} (sliding window)")
    print("-" * 70)

    K, V, q = synthesize_sequence(n=n, d=d, signal_blocks=signal_blocks, l=l, rng=rng)
    Wg = [[rng.gauss(0, 0.5) for _ in range(d)] for _ in range(3)]

    out, info = nsa_step(q, K, V, Wg, NSAConfig(l=l, k=k, W=W))

    print(f"  compressed branch keys : {info['cmp_keys']}")
    print(f"  selected branch keys   : {info['sel_keys']}  (blocks {info['selected_blocks']})")
    print(f"  sliding window keys    : {info['win_keys']}")
    print(f"  total keys attended    : {info['total_keys']}")
    print(f"  full-attention keys    : {info['full_keys']}  ({info['full_keys'] / info['total_keys']:.1f}x more)")
    print(f"  gate weights (cmp/sel/win): "
          f"{info['gates'][0]:.3f} / {info['gates'][1]:.3f} / {info['gates'][2]:.3f}")
    print()

    hit_signal = [b for b in info["selected_blocks"] if b in signal_blocks]
    miss_signal = [b for b in signal_blocks if b not in info["selected_blocks"]]
    print(f"  signal blocks retrieved: {hit_signal}  (missed: {miss_signal})")
    print()

    print("-" * 70)
    print("Step 2: compute savings at production context lengths")
    print("-" * 70)
    print(f"  {'N':>8} {'l':>4} {'k':>4} {'W':>5}  "
          f"{'NSA keys':>10}  {'full keys':>10}  {'savings':>9}")
    for N_prod, l_prod, k_prod, W_prod in [
        (4_096, 32, 8, 256),
        (16_384, 32, 16, 512),
        (32_768, 64, 16, 512),
        (65_536, 64, 16, 512),
        (131_072, 64, 16, 512),
        (262_144, 64, 16, 512),
    ]:
        nsa = count_nsa(N_prod, l_prod, k_prod, W_prod)
        full = count_full_attention(N_prod)
        print(f"  {N_prod:>8} {l_prod:>4} {k_prod:>4} {W_prod:>5}  "
              f"{nsa:>10,} {full:>10,}  {full/nsa:>8.1f}x")
    print()

    print("-" * 70)
    print("Step 3: block-size vs top-k sweep (cost at N=65536, W=512)")
    print("-" * 70)
    print(f"  {'l':>4} {'k':>4}  {'keys':>8}  {'vs full':>8}")
    for l_p in (32, 64, 128):
        for k_p in (8, 16, 32):
            cost = count_nsa(65_536, l_p, k_p, 512)
            print(f"  {l_p:>4} {k_p:>4}  {cost:>8,}  {65_536/cost:>7.1f}x")
    print()

    print("takeaway: NSA's 3-branch decomposition turns O(N^2) attention into")
    print("          O(N * (N/l + k*l + W)). At 64k-128k context, 25x-36x")
    print("          fewer keys per query. Gradient flows through the")
    print("          compressed-branch scores, so top-k selection is natively")
    print("          trainable.")


if __name__ == "__main__":
    main()
