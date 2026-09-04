"""Residual Vector Quantization (RVQ) from scratch.

Builds a toy 1-D signal, quantizes it with a cascade of tiny codebooks,
measures reconstruction error as codebooks are added. Illustrates why
modern audio codecs use RVQ rather than a single huge codebook.

Stdlib only. Run: python3 code/main.py
"""

import math
import random


def generate_signal(n=1000, seed=0):
    rng = random.Random(seed)
    return [math.sin(2 * math.pi * i / 100) + 0.3 * rng.gauss(0, 1.0) for i in range(n)]


def learn_codebook(values, size, iterations=20, seed=0):
    rng = random.Random(seed)
    if not values:
        return [0.0] * size
    lo, hi = min(values), max(values)
    centroids = [lo + (hi - lo) * rng.random() for _ in range(size)]
    for _ in range(iterations):
        buckets = [[] for _ in range(size)]
        for v in values:
            idx = min(range(size), key=lambda i: abs(centroids[i] - v))
            buckets[idx].append(v)
        for i in range(size):
            if buckets[i]:
                centroids[i] = sum(buckets[i]) / len(buckets[i])
    return sorted(centroids)


def quantize_with_codebook(values, codebook):
    indices = []
    residuals = []
    for v in values:
        idx = min(range(len(codebook)), key=lambda i: abs(codebook[i] - v))
        indices.append(idx)
        residuals.append(v - codebook[idx])
    return indices, residuals


def rvq_encode(values, codebook_size=8, n_codebooks=4):
    residuals = list(values)
    codebooks = []
    all_indices = []
    for cb_i in range(n_codebooks):
        cb = learn_codebook(residuals, codebook_size, seed=cb_i)
        codebooks.append(cb)
        indices, residuals = quantize_with_codebook(residuals, cb)
        all_indices.append(indices)
    return all_indices, codebooks


def rvq_decode(all_indices, codebooks, length):
    out = [0.0] * length
    for indices, cb in zip(all_indices, codebooks):
        for i, idx in enumerate(indices):
            out[i] += cb[idx]
    return out


def mse(a, b):
    return sum((x - y) ** 2 for x, y in zip(a, b)) / len(a)


def main():
    print("=== Step 1: generate signal ===")
    sig = generate_signal(n=1000)
    print(f"  length: {len(sig)}   range: [{min(sig):.2f}, {max(sig):.2f}]   mean: {sum(sig)/len(sig):.3f}")

    print()
    print("=== Step 2: RVQ reconstruction error vs codebook count ===")
    print("  codebook_size = 8   values per codebook")
    print("  | # codebooks | bits/frame | MSE        | bitrate @ 50 fps |")

    for n_cb in [1, 2, 4, 8, 12]:
        indices, codebooks = rvq_encode(sig, codebook_size=8, n_codebooks=n_cb)
        recon = rvq_decode(indices, codebooks, length=len(sig))
        err = mse(sig, recon)
        bits_per_frame = n_cb * 3
        bitrate = bits_per_frame * 50
        print(f"  | {n_cb:>11} | {bits_per_frame:>10} | {err:.6f}   | {bitrate:>5} bps       |")

    print()
    print("=== Step 3: 2026 codec comparison (speech @ 6 kbps) ===")
    rows = [
        ("EnCodec-24k", "75 Hz",   "3.2 PESQ", "general audio, MusicGen"),
        ("DAC-44.1k",   "86 Hz",   "3.5 PESQ", "highest fidelity"),
        ("SNAC-24k",    "~12 Hz",  "3.3 PESQ", "multi-scale, AR-LM"),
        ("Mimi",        "12.5 Hz", "3.1 PESQ", "semantic+acoustic, Moshi"),
    ]
    print("  | codec        | frame rate | quality    | use case                 |")
    for name, fr, q, u in rows:
        print(f"  | {name:<12} | {fr:<10} | {q:<10} | {u:<24} |")

    print()
    print("=== Step 4: semantic vs acoustic tokens (Mimi, conceptually) ===")
    print("  codebook 0  →  distilled from WavLM  →  content (what was said)")
    print("  codebook 1-7 → acoustic residuals    →  timbre, speaker, noise")
    print()
    print("  LM generates codebook 0 first (text → semantic), then")
    print("  generates codebook 1-7 conditioned on semantic + speaker ref")
    print("  = factorized generation that cleanly supports voice cloning")

    print()
    print("takeaways:")
    print("  - RVQ: cascade of small codebooks > one giant codebook")
    print("  - semantic/acoustic split (Mimi, AudioLM) is the 2024-2026 shift")
    print("  - 12.5 Hz Mimi × 8 codebooks = 1000 tokens per 10 s clip")
    print("  - that's why transformer LM over audio finally works at 2026 scale")


if __name__ == "__main__":
    main()
