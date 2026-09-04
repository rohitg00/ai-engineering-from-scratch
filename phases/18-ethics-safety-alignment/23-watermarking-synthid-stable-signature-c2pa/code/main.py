"""Toy token-watermark (SynthID-text-style) — stdlib Python.

Vocabulary: integers 0..N-1. Each decoding step hashes the previous k tokens
modulo N to partition the vocabulary into green (even hash) and red (odd
hash). Sampling is biased toward green. Detector computes green-token
z-score; reported at 1000 tokens.

Usage: python3 code/main.py
"""

from __future__ import annotations

import hashlib
import math
import random


random.seed(61)


VOCAB = 200
K = 4  # hash context length


def green_set(prev_tokens: list[int]) -> set[int]:
    """Pseudorandom partition of the vocabulary into green (half of it)."""
    seed = ",".join(str(t) for t in prev_tokens[-K:])
    digest = hashlib.sha256(seed.encode()).hexdigest()
    h = int(digest, 16)
    # partition: token is green iff (token + h) mod 2 == 0
    return {t for t in range(VOCAB) if (t + h) % 2 == 0}


def unwatermarked_sample(n: int, seed_prefix: list[int]) -> list[int]:
    out = list(seed_prefix)
    for _ in range(n):
        out.append(random.randrange(VOCAB))
    return out


def watermarked_sample(n: int, seed_prefix: list[int], bias: float = 0.9) -> list[int]:
    """Bias = probability of sampling from the green set."""
    out = list(seed_prefix)
    for _ in range(n):
        greens = green_set(out)
        use_green = random.random() < bias
        pool = list(greens) if use_green else list(set(range(VOCAB)) - greens)
        out.append(random.choice(pool))
    return out


def detect(tokens: list[int]) -> float:
    """Returns z-score: (green count - expected) / sqrt(expected * p(1-p))."""
    if len(tokens) <= K:
        return 0.0
    green_count = 0
    for i in range(K, len(tokens)):
        greens = green_set(tokens[:i])
        if tokens[i] in greens:
            green_count += 1
    n = len(tokens) - K
    expected = n * 0.5
    std = math.sqrt(n * 0.5 * 0.5)
    return (green_count - expected) / std


def paraphrase(tokens: list[int], ratio: float = 0.3) -> list[int]:
    """Replace ratio of tokens at random with random tokens."""
    out = list(tokens)
    for i in range(len(out)):
        if random.random() < ratio:
            out[i] = random.randrange(VOCAB)
    return out


def main() -> None:
    print("=" * 70)
    print("TOY TOKEN WATERMARK (Phase 18, Lesson 23)")
    print("=" * 70)

    seed = [random.randrange(VOCAB) for _ in range(K)]

    watermarked = watermarked_sample(1000, seed)
    plain = unwatermarked_sample(1000, seed)

    print(f"\nwatermarked z-score       : {detect(watermarked):.2f}")
    print(f"unwatermarked z-score     : {detect(plain):.2f}")
    print("(z >= 4 is very strong evidence of watermark.)")

    # Paraphrase attack
    para = paraphrase(watermarked, ratio=0.3)
    print(f"after 30% paraphrase      : {detect(para):.2f}")
    para2 = paraphrase(watermarked, ratio=0.6)
    print(f"after 60% paraphrase      : {detect(para2):.2f}")

    # FPR on human-text
    fprs = [detect(unwatermarked_sample(1000, seed)) for _ in range(100)]
    fpr_above_4 = sum(1 for z in fprs if z >= 4) / len(fprs)
    print(f"\nFPR (z >= 4) over 100 human draws : {fpr_above_4:.3f}")

    print("\n" + "=" * 70)
    print("TAKEAWAY: the text watermark is detectable at >=1000 tokens with")
    print("strong z-scores and <1% FPR at z=4. paraphrase of 30% weakens the")
    print("signal; 60% destroys it. text watermarks do not survive paraphrase.")
    print("C2PA metadata + watermark is the deployment combination: watermark")
    print("survives compression, metadata survives (as long as it is not stripped).")
    print("=" * 70)


if __name__ == "__main__":
    main()
