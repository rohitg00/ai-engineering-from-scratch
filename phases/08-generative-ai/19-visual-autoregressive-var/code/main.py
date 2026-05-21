"""Toy Visual Autoregressive (VAR) model: next-scale prediction over a pyramid.

A minimal numpy implementation of the VAR mechanism described in
docs/en.md. Three pieces:

1. A multi-scale residual VQ tokenizer over tiny 8x8 "images" (a small
   library of patterns: solid, gradient, ring, checker, cross). Tokens at
   scale k encode the residual left by scales 1..k-1. The decoder is the
   sum of upsampled scale embeddings.
2. A scale-conditioned next-scale predictor (a logistic / softmax mini-LM
   over the small vocab). The "transformer" is approximated by per-scale
   conditional histograms; the geometry the lesson teaches is the
   scale-ordered conditioning and the parallel-within-scale prediction,
   not deep attention.
3. A generation loop that runs K transformer passes (one per scale) and
   samples every position at the current scale in parallel from the
   conditional. Decoded sums of scale embeddings reconstruct an image.

The point is to exercise the scale-ordered training data, the parallel-
within-scale sampling, and the residual-VQ reconstruction. A real VAR
swaps the histogram for a transformer and the pattern library for an
image dataset; the harness around them stays the same.

Stdlib + numpy only.

Run:
    python main.py
"""

from __future__ import annotations

import numpy as np


IMG = 8
SCALES = (1, 2, 4, 8)
CODEBOOK = 16


def make_patterns(rng: np.random.Generator, n: int) -> np.ndarray:
    """Return n grayscale 8x8 patterns drawn from a tiny library."""
    out = np.zeros((n, IMG, IMG), dtype=np.float32)
    yy, xx = np.mgrid[0:IMG, 0:IMG].astype(np.float32)
    for i in range(n):
        kind = int(rng.integers(0, 5))
        if kind == 0:
            out[i] = rng.uniform(0.1, 0.9)
        elif kind == 1:
            out[i] = (xx + yy) / (2 * (IMG - 1))
        elif kind == 2:
            cx, cy = IMG / 2 - 0.5, IMG / 2 - 0.5
            r = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
            out[i] = np.clip(1.0 - r / (IMG / 2), 0.0, 1.0)
        elif kind == 3:
            out[i] = ((xx.astype(int) + yy.astype(int)) % 2).astype(np.float32)
        else:
            mid = IMG // 2
            cross = ((xx == mid) | (yy == mid)).astype(np.float32)
            out[i] = cross * 0.9 + 0.05
    return out


def fit_codebook(samples: np.ndarray, k: int, iters: int = 30,
                 seed: int = 0) -> np.ndarray:
    """k-means on scalar samples; returns codebook of length k."""
    rng = np.random.default_rng(seed)
    flat = samples.reshape(-1)
    idx = rng.choice(flat.size, size=k, replace=False)
    centers = flat[idx].astype(np.float32)
    for _ in range(iters):
        dists = (flat[:, None] - centers[None, :]) ** 2
        assign = dists.argmin(axis=1)
        for j in range(k):
            mask = assign == j
            if mask.any():
                centers[j] = flat[mask].mean()
    return np.sort(centers)


def encode(values: np.ndarray, codebook: np.ndarray) -> np.ndarray:
    """Snap each value to the nearest code; return integer tokens."""
    dists = (values[..., None] - codebook[None, None, :]) ** 2
    return dists.argmin(axis=-1).astype(np.int32)


def downsample(img: np.ndarray, target: int) -> np.ndarray:
    """Average-pool an HxW image down to target x target."""
    h, w = img.shape
    if target == h:
        return img.copy()
    factor = h // target
    return img.reshape(target, factor, target, factor).mean(axis=(1, 3))


def upsample(grid: np.ndarray, target: int) -> np.ndarray:
    """Nearest-neighbor upsample a HxW grid up to target x target."""
    h, w = grid.shape
    if target == h:
        return grid.copy()
    factor = target // h
    return grid.repeat(factor, axis=0).repeat(factor, axis=1)


def tokenize_multiscale(img: np.ndarray, codebooks: list[np.ndarray]
                        ) -> list[np.ndarray]:
    """Residual VQ: each scale tokenizes what previous scales missed."""
    residual = img.copy()
    tokens: list[np.ndarray] = []
    for scale, book in zip(SCALES, codebooks):
        coarse = downsample(residual, scale)
        tok = encode(coarse, book)
        recon = book[tok]
        residual = residual - upsample(recon, IMG)
        tokens.append(tok)
    return tokens


def detokenize_multiscale(tokens: list[np.ndarray],
                          codebooks: list[np.ndarray]) -> np.ndarray:
    """Decoder: sum upsampled scale embeddings."""
    out = np.zeros((IMG, IMG), dtype=np.float32)
    for tok, book, scale in zip(tokens, codebooks, SCALES):
        out = out + upsample(book[tok], IMG)
    return out


def train_codebooks(images: np.ndarray) -> list[np.ndarray]:
    """Fit per-scale codebooks on residuals from a small image set."""
    residuals = images.copy()
    books: list[np.ndarray] = []
    for scale in SCALES:
        pooled = np.stack([downsample(r, scale) for r in residuals])
        book = fit_codebook(pooled, CODEBOOK)
        books.append(book)
        recon = np.stack([upsample(book[encode(p[None], book)[0]], IMG)
                          for p in pooled])
        residuals = residuals - recon
    return books


def context_key(prev_tokens: list[np.ndarray]) -> tuple:
    """Hashable summary of all previous scales' tokens."""
    return tuple(int(t.mean() * 1000) for t in prev_tokens) if prev_tokens else ()


def fit_predictor(token_streams: list[list[np.ndarray]]
                  ) -> list[dict[tuple, np.ndarray]]:
    """One conditional histogram per scale, keyed on previous-scale summary.

    This stands in for a transformer: at training time, count which tokens
    appear at scale k conditional on the coarsened summary of scales 1..k-1.
    """
    predictors: list[dict[tuple, np.ndarray]] = [
        {} for _ in SCALES
    ]
    for stream in token_streams:
        for k in range(len(SCALES)):
            ctx = context_key(stream[:k])
            table = predictors[k].setdefault(ctx, np.ones(CODEBOOK,
                                                          dtype=np.float64))
            for tok in stream[k].reshape(-1):
                table[int(tok)] += 1.0
    for table in predictors:
        for key, counts in table.items():
            table[key] = counts / counts.sum()
    return predictors


def sample_categorical(probs: np.ndarray, rng: np.random.Generator) -> int:
    return int(rng.choice(len(probs), p=probs))


def generate(predictors: list[dict[tuple, np.ndarray]],
             codebooks: list[np.ndarray],
             rng: np.random.Generator) -> tuple[np.ndarray, list[np.ndarray]]:
    """One VAR sample: K passes, parallel-within-scale, causal across scales."""
    drawn: list[np.ndarray] = []
    for k, scale in enumerate(SCALES):
        ctx = context_key(drawn[:k])
        table = predictors[k]
        probs = table.get(ctx)
        if probs is None:
            probs = np.ones(CODEBOOK) / CODEBOOK
        size = scale * scale
        flat = np.array([sample_categorical(probs, rng) for _ in range(size)],
                        dtype=np.int32)
        drawn.append(flat.reshape(scale, scale))
    image = detokenize_multiscale(drawn, codebooks)
    return image, drawn


def reconstruction_mse(images: np.ndarray,
                       codebooks: list[np.ndarray]) -> float:
    errs = []
    for img in images:
        toks = tokenize_multiscale(img, codebooks)
        recon = detokenize_multiscale(toks, codebooks)
        errs.append(float(np.mean((recon - img) ** 2)))
    return float(np.mean(errs))


def main() -> None:
    rng = np.random.default_rng(0)
    train_imgs = make_patterns(rng, 64)
    val_imgs = make_patterns(rng, 16)

    codebooks = train_codebooks(train_imgs)
    train_token_streams = [tokenize_multiscale(img, codebooks) for img in train_imgs]
    predictors = fit_predictor(train_token_streams)

    print(f"image size: {IMG}x{IMG}")
    print(f"scales: {SCALES}")
    print(f"codebook size per scale: {CODEBOOK}")
    print(f"reconstruction MSE on train: {reconstruction_mse(train_imgs, codebooks):.5f}")
    print(f"reconstruction MSE on val:   {reconstruction_mse(val_imgs, codebooks):.5f}")

    print()
    print("generation: 4 transformer passes, all positions parallel within a scale")
    for trial in range(3):
        img, toks = generate(predictors, codebooks, rng)
        shapes = [t.shape for t in toks]
        print(f"  trial {trial}: scales={shapes}  range=[{img.min():.2f}, {img.max():.2f}]")

    print()
    print("scale-ordered attention check: every scale k only sees scales 1..k-1")
    for k, scale in enumerate(SCALES):
        n_pos = scale * scale
        prior_seen = sum(s * s for s in SCALES[:k])
        print(f"  scale {k} (size {scale}x{scale}, {n_pos} tokens):"
              f" attends to {prior_seen} prior tokens")


if __name__ == "__main__":
    main()
