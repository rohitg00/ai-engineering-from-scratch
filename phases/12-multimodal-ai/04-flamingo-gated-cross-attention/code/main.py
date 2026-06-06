"""Flamingo gated cross-attention + Perceiver resampler toy — stdlib Python.

Demonstrates:
  - Perceiver resampler: variable-length patch tokens -> fixed-length latents
  - gated cross-attention: tanh(alpha) * cross + x residual
  - alpha=0 -> visual contribution is exactly zero (frozen LLM preserved)
  - interleaved-sequence attention mask for (img1, txt1, img2, txt2)

Pure Python. No numpy, no torch.
"""

from __future__ import annotations

import math
import random

rng = random.Random(7)


def vec(n: int) -> list[float]:
    return [rng.gauss(0, 0.3) for _ in range(n)]


def mat(rows: int, cols: int) -> list[list[float]]:
    return [vec(cols) for _ in range(rows)]


def matvec(M: list[list[float]], v: list[float]) -> list[float]:
    return [sum(r * x for r, x in zip(row, v)) for row in M]


def dot(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def softmax(xs: list[float]) -> list[float]:
    m = max(xs)
    exps = [math.exp(x - m) for x in xs]
    z = sum(exps)
    return [e / z for e in exps]


def add(a: list[float], b: list[float]) -> list[float]:
    return [x + y for x, y in zip(a, b)]


def scale(a: list[float], s: float) -> list[float]:
    return [x * s for x in a]


def cross_attention(queries: list[list[float]],
                    keys: list[list[float]],
                    values: list[list[float]]) -> list[list[float]]:
    d = len(queries[0])
    scale_f = 1.0 / math.sqrt(d)
    out = []
    for q in queries:
        logits = [dot(q, k) * scale_f for k in keys]
        w = softmax(logits)
        mixed = [0.0] * d
        for i, wi in enumerate(w):
            for j in range(d):
                mixed[j] += wi * values[i][j]
        out.append(mixed)
    return out


def perceiver_resampler(patches: list[list[float]], num_latents: int,
                        num_blocks: int = 2) -> list[list[float]]:
    """Variable patches -> fixed K latents via cross-attention."""
    dim = len(patches[0])
    latents = [vec(dim) for _ in range(num_latents)]
    for _ in range(num_blocks):
        attended = cross_attention(latents, patches, patches)
        latents = [add(lat, att) for lat, att in zip(latents, attended)]
    return latents


def gated_cross_attention_step(text_hidden: list[list[float]],
                               visual_tokens: list[list[float]],
                               alpha: float) -> list[list[float]]:
    """y = tanh(alpha) * cross_attn(text, visual) + text_hidden."""
    cross = cross_attention(text_hidden, visual_tokens, visual_tokens)
    gate = math.tanh(alpha)
    out = [add(t, scale(c, gate)) for t, c in zip(text_hidden, cross)]
    return out


def interleaved_mask(sequence: list[str]) -> list[list[bool]]:
    """Build a cross-attn mask where each text token attends only to the most
    recent preceding image.
    sequence: labels like ['IMG0', 'txt0a', 'txt0b', 'IMG1', 'txt1a', 'txt1b'].
    returns a mask over (text tokens) x (image tokens) with True = allowed.
    """
    text_positions = [i for i, s in enumerate(sequence) if not s.startswith("IMG")]
    image_positions = [i for i, s in enumerate(sequence) if s.startswith("IMG")]

    mask = [[False] * len(image_positions) for _ in text_positions]
    for ti, tpos in enumerate(text_positions):
        preceding = [i for i in image_positions if i < tpos]
        if not preceding:
            continue
        most_recent_img = preceding[-1]
        img_index = image_positions.index(most_recent_img)
        mask[ti][img_index] = True
    return mask


def demo_resampler() -> None:
    print("\nDEMO 1: Perceiver resampler")
    print("-" * 60)
    for num_patches in (36, 196, 900):
        patches = [vec(16) for _ in range(num_patches)]
        latents = perceiver_resampler(patches, num_latents=8, num_blocks=2)
        print(f"  {num_patches} patches in -> {len(latents)} latents of dim "
              f"{len(latents[0])} out  (fixed shape regardless of input)")


def demo_gate() -> None:
    print("\nDEMO 2: gated cross-attention")
    print("-" * 60)
    text_hidden = [vec(16) for _ in range(5)]
    visual = [vec(16) for _ in range(8)]

    out_closed = gated_cross_attention_step(text_hidden, visual, alpha=0.0)
    deltas = [max(abs(a - b) for a, b in zip(o, t))
              for o, t in zip(out_closed, text_hidden)]
    print(f"  alpha=0.0 (tanh=0.0): max delta vs input = {max(deltas):.6f}")
    print("  -> frozen LLM preserved exactly at init")

    out_open = gated_cross_attention_step(text_hidden, visual, alpha=2.0)
    deltas = [sum(abs(a - b) for a, b in zip(o, t)) / len(o)
              for o, t in zip(out_open, text_hidden)]
    print(f"  alpha=2.0 (tanh=0.96): avg delta vs input = {sum(deltas)/len(deltas):.4f}")
    print("  -> visual contribution mixed in")

    for a in (0.0, 0.5, 1.0, 2.0, 5.0):
        g = math.tanh(a)
        print(f"    alpha={a:4.1f}  tanh(alpha)={g:+.4f}")


def demo_interleaved_mask() -> None:
    print("\nDEMO 3: interleaved attention mask")
    print("-" * 60)
    seq = ["IMG0", "t0a", "t0b", "IMG1", "t1a", "t1b", "t1c", "IMG2", "t2a"]
    mask = interleaved_mask(seq)
    image_labels = [s for s in seq if s.startswith("IMG")]
    text_labels = [s for s in seq if not s.startswith("IMG")]

    header = "         " + "  ".join(f"{x:4s}" for x in image_labels)
    print(header)
    for i, tk in enumerate(text_labels):
        row = "  ".join(" ok " if mask[i][j] else "  . " for j in range(len(image_labels)))
        print(f"  {tk:5s}: {row}")
    print("  each text token only sees the most recent preceding image")


def main() -> None:
    print("=" * 60)
    print("FLAMINGO GATED CROSS-ATTENTION TOY (Phase 12, Lesson 04)")
    print("=" * 60)
    demo_resampler()
    demo_gate()
    demo_interleaved_mask()
    print("\n" + "=" * 60)
    print("TAKEAWAYS")
    print("-" * 60)
    print("  · Perceiver resampler: fixed K latents regardless of input size")
    print("  · tanh(alpha) gate with alpha=0 -> no-op; LLM preserved at init")
    print("  · interleaved mask lets text tokens attend to preceding image")
    print("  · Flamingo inserts gated cross-attn every 4 LLM layers")


if __name__ == "__main__":
    main()
