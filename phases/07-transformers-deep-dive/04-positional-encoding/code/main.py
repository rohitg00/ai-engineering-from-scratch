"""Positional encoding — sinusoidal, RoPE, ALiBi.

Pure stdlib. Each encoding scheme shipped as a small reusable function.
Demos the relative-distance property of RoPE numerically.
"""

import math
import random


def sinusoidal_pe(n, d, base=10000.0):
    pe = [[0.0] * d for _ in range(n)]
    for pos in range(n):
        for i in range(d // 2):
            theta = pos / (base ** (2 * i / d))
            pe[pos][2 * i] = math.sin(theta)
            pe[pos][2 * i + 1] = math.cos(theta)
    return pe


def apply_rope(x, pos, base=10000.0):
    """Rotate even/odd pairs of x by angle pos * theta_i."""
    d = len(x)
    out = list(x)
    for i in range(d // 2):
        theta = pos / (base ** (2 * i / d))
        c = math.cos(theta)
        s = math.sin(theta)
        a = x[2 * i]
        b = x[2 * i + 1]
        out[2 * i] = a * c - b * s
        out[2 * i + 1] = a * s + b * c
    return out


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def alibi_slopes(n_heads):
    return [2 ** (-8 * (h + 1) / n_heads) for h in range(n_heads)]


def alibi_bias(n_heads, seq_len, causal=True):
    slopes = alibi_slopes(n_heads)
    out = []
    for m in slopes:
        head_bias = []
        for i in range(seq_len):
            row = []
            for j in range(seq_len):
                if causal and j > i:
                    row.append(float("-inf"))
                else:
                    row.append(-m * abs(i - j))
            head_bias.append(row)
        out.append(head_bias)
    return out


def demo_sinusoidal():
    print("=== sinusoidal positional encoding ===")
    pe = sinusoidal_pe(n=8, d=8)
    print("first 4 positions, first 4 dims:")
    for pos in range(4):
        print(f"  pos={pos}: " + "  ".join(f"{v:+.3f}" for v in pe[pos][:4]))
    print()


def demo_rope_relative():
    print("=== RoPE: dot product depends only on relative distance ===")
    rng = random.Random(0)
    d = 16
    q = [rng.gauss(0, 1) for _ in range(d)]
    k = [rng.gauss(0, 1) for _ in range(d)]

    pairs = [(3, 5), (7, 9), (100, 102), (1024, 1026)]
    print(f"{'pos_q':>6}  {'pos_k':>6}  {'gap':>4}  {'<q_rot, k_rot>':>18}")
    for pq, pk in pairs:
        q_rot = apply_rope(q, pq)
        k_rot = apply_rope(k, pk)
        d_prod = dot(q_rot, k_rot)
        print(f"{pq:>6}  {pk:>6}  {pk - pq:>4}  {d_prod:>18.6f}")
    print("all rows with gap=2 should have matching dot products.")
    print()


def demo_rope_base_scaling():
    print("=== RoPE base scaling (NTK-aware for long context) ===")
    rng = random.Random(1)
    d = 8
    q = [rng.gauss(0, 1) for _ in range(d)]
    k = [rng.gauss(0, 1) for _ in range(d)]

    for base in [10000, 100000, 1_000_000]:
        q_rot = apply_rope(q, pos=4096, base=base)
        k_rot = apply_rope(k, pos=4098, base=base)
        print(f"  base={base:>8d}  score={dot(q_rot, k_rot):+.6f}")
    print("larger base = slower rotation = longer context without phase wrap.")
    print()


def demo_alibi():
    print("=== ALiBi bias matrix ===")
    n_heads = 4
    slopes = alibi_slopes(n_heads)
    print(f"slopes for {n_heads} heads: " + ", ".join(f"{s:.4f}" for s in slopes))
    bias = alibi_bias(n_heads, seq_len=6, causal=False)
    print(f"head 0 bias (closer tokens get smaller penalty):")
    for row in bias[0]:
        print("  " + "  ".join(f"{v:+6.2f}" for v in row))
    print()


def main():
    demo_sinusoidal()
    demo_rope_relative()
    demo_rope_base_scaling()
    demo_alibi()
    print("takeaway: RoPE encodes relative position in the dot product itself.")
    print("ALiBi skips embeddings entirely. sinusoidal is a footnote by 2026.")


if __name__ == "__main__":
    main()
