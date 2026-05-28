"""toy token-watermark (SynthID-text-style) — stdlib Python.

Vocabulary: integers 0..N-1。各 decoding step は直前 k tokens を hash し、
modulo N で vocabulary を green (even hash) と red (odd hash) に分割する。
Sampling は green に bias される。Detector は green-token z-score を計算し、
1000 tokens で報告する。

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
    """Vocabulary を green (半分) に pseudorandom に分割する。"""
    seed = ",".join(str(t) for t in prev_tokens[-K:])
    digest = hashlib.sha256(seed.encode()).hexdigest()
    h = int(digest, 16)
    # partition: (token + h) mod 2 == 0 なら token は green。
    return {t for t in range(VOCAB) if (t + h) % 2 == 0}


def unwatermarked_sample(n: int, seed_prefix: list[int]) -> list[int]:
    out = list(seed_prefix)
    for _ in range(n):
        out.append(random.randrange(VOCAB))
    return out


def watermarked_sample(n: int, seed_prefix: list[int], bias: float = 0.9) -> list[int]:
    """Bias = green set から sample する確率。"""
    out = list(seed_prefix)
    for _ in range(n):
        greens = green_set(out)
        use_green = random.random() < bias
        pool = list(greens) if use_green else list(set(range(VOCAB)) - greens)
        out.append(random.choice(pool))
    return out


def detect(tokens: list[int]) -> float:
    """z-score を返す: (green count - expected) / sqrt(expected * p(1-p))。"""
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
    """tokens の ratio 分を random tokens に置き換える。"""
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
    print("(z >= 4 は watermark の非常に強い evidence である。)")

    # Paraphrase attack
    para = paraphrase(watermarked, ratio=0.3)
    print(f"30% paraphrase 後         : {detect(para):.2f}")
    para2 = paraphrase(watermarked, ratio=0.6)
    print(f"60% paraphrase 後         : {detect(para2):.2f}")

    # human-text 上の FPR
    fprs = [detect(unwatermarked_sample(1000, seed)) for _ in range(100)]
    fpr_above_4 = sum(1 for z in fprs if z >= 4) / len(fprs)
    print(f"\nhuman draws 100回での FPR (z >= 4) : {fpr_above_4:.3f}")

    print("\n" + "=" * 70)
    print("TAKEAWAY: text watermark は >=1000 tokens で strong z-score により")
    print("detect でき、z=4 では FPR <1% である。30% paraphrase は signal を弱め、")
    print("60% はそれを壊す。text watermarks は paraphrase に耐えない。")
    print("C2PA metadata + watermark が deployment combination である。watermark は")
    print("compression に耐え、metadata は削除されない限り残る。")
    print("=" * 70)


if __name__ == "__main__":
    main()
