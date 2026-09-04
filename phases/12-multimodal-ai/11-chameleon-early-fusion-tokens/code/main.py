"""Chameleon-style early-fusion: toy VQ quantizer + shared-vocab autoregressive decoder.

End-to-end pipeline:
  1. VQ-VAE-ish quantizer: 8x8 grayscale patch -> integer codebook index, K=16.
  2. Shared vocab: text ids 0..31, image ids 32..47, separators 48 (<image>), 49 (</image>).
  3. Bigram decoder trained on synthetic (text + <image> codes </image>) pairs.
  4. Sampling loop that emits mixed-modality output.

Stdlib only. The transformer is a bigram count table — the point is to see the
shared-vocabulary loop in miniature, not to get image quality.
"""

from __future__ import annotations

import math
import random
from collections import defaultdict

random.seed(42)

VOCAB_TEXT = 32
VOCAB_IMG = 16
IMG_OFFSET = VOCAB_TEXT
SEP_OPEN = VOCAB_TEXT + VOCAB_IMG
SEP_CLOSE = SEP_OPEN + 1
VOCAB_SIZE = SEP_CLOSE + 1


CODEBOOK = [[(i * 7 + 3 * j) % 8 for j in range(4)] for i in range(VOCAB_IMG)]


def quantize_patch(patch: list[int]) -> int:
    """Nearest-codebook lookup by L2 distance."""
    best = 0
    best_d = float("inf")
    for k, code in enumerate(CODEBOOK):
        d = sum((p - c) ** 2 for p, c in zip(patch, code))
        if d < best_d:
            best_d = d
            best = k
    return best + IMG_OFFSET


def image_to_tokens(img: list[list[int]]) -> list[int]:
    """8x8 grayscale -> 4 patches of 4 floats (downsampled). Return token IDs."""
    patches = []
    for pr in range(0, 8, 4):
        for pc in range(0, 8, 4):
            flat = []
            for r in range(2):
                for c in range(2):
                    s = 0
                    for dr in range(2):
                        for dc in range(2):
                            s += img[pr + 2 * r + dr][pc + 2 * c + dc]
                    flat.append(s // 4)
            patches.append(flat)
    return [quantize_patch(p) for p in patches]


def synthesize_caption(kind: str) -> list[int]:
    """Pick a short synthetic text token sequence."""
    if kind == "red":
        return [1, 5, 3, 7]
    if kind == "blue":
        return [2, 5, 3, 8]
    if kind == "green":
        return [1, 5, 3, 9]
    return [1, 5, 3, 10]


def synth_image(kind: str) -> list[list[int]]:
    shade = {"red": 7, "blue": 2, "green": 4, "gray": 5}[kind]
    return [[(shade + (r + c) % 3) for c in range(8)] for r in range(8)]


def make_dataset(n: int = 40) -> list[list[int]]:
    kinds = ["red", "blue", "green", "gray"]
    corpus = []
    for _ in range(n):
        k = random.choice(kinds)
        tokens = synthesize_caption(k) + [SEP_OPEN] + image_to_tokens(synth_image(k)) + [SEP_CLOSE]
        if random.random() < 0.4:
            tokens = [SEP_OPEN] + image_to_tokens(synth_image(k)) + [SEP_CLOSE] + synthesize_caption(k)
        corpus.append(tokens)
    return corpus


def train_bigram(corpus: list[list[int]]) -> dict:
    counts: dict = defaultdict(lambda: defaultdict(int))
    for seq in corpus:
        for a, b in zip(seq, seq[1:]):
            counts[a][b] += 1
    return counts


def sample_next(bigram: dict, prev: int) -> int:
    dist = bigram.get(prev, {})
    if not dist:
        return random.randrange(VOCAB_SIZE)
    total = sum(dist.values())
    r = random.random() * total
    acc = 0
    for tok, c in dist.items():
        acc += c
        if r <= acc:
            return tok
    return next(iter(dist))


def generate(bigram: dict, prompt: list[int], max_len: int = 40) -> list[int]:
    out = list(prompt)
    while len(out) < max_len:
        nxt = sample_next(bigram, out[-1])
        out.append(nxt)
        if nxt == SEP_CLOSE and any(t < VOCAB_TEXT for t in out):
            break
    return out


def render(tokens: list[int]) -> str:
    parts = []
    for t in tokens:
        if t == SEP_OPEN:
            parts.append("<image>")
        elif t == SEP_CLOSE:
            parts.append("</image>")
        elif t < VOCAB_TEXT:
            parts.append(f"w{t}")
        else:
            parts.append(f"i{t - IMG_OFFSET}")
    return " ".join(parts)


def main() -> None:
    print("=" * 60)
    print("CHAMELEON EARLY-FUSION TOY (Phase 12, Lesson 11)")
    print("=" * 60)

    print("\n1. VQ tokenizer — 8x8 grayscale -> 4 patches -> 4 image tokens")
    print("-" * 60)
    for kind in ["red", "blue", "green", "gray"]:
        img = synth_image(kind)
        codes = image_to_tokens(img)
        print(f"  {kind:<6} -> codes {codes}")

    print("\n2. Shared vocabulary layout")
    print("-" * 60)
    print(f"  text tokens   : 0..{VOCAB_TEXT - 1}")
    print(f"  image tokens  : {IMG_OFFSET}..{IMG_OFFSET + VOCAB_IMG - 1}")
    print(f"  <image>       : {SEP_OPEN}")
    print(f"  </image>      : {SEP_CLOSE}")
    print(f"  vocab total   : {VOCAB_SIZE}")

    print("\n3. Dataset (40 sequences of interleaved text + image tokens)")
    print("-" * 60)
    corpus = make_dataset(40)
    for seq in corpus[:4]:
        print("  " + render(seq))

    print("\n4. Train bigram, sample mixed-modality output")
    print("-" * 60)
    bigram = train_bigram(corpus)
    for _ in range(3):
        out = generate(bigram, [1, 5], max_len=30)
        print("  " + render(out))

    print("\nTAKEAWAY")
    print("-" * 60)
    print("  one model, one vocab, one loss -> mixed-modality output for free")
    print("  tokenizer quality caps image fidelity (lesson 12.12 on Emu3)")
    print("  at scale you need QK-Norm + careful dropout for stable training")


if __name__ == "__main__":
    main()
