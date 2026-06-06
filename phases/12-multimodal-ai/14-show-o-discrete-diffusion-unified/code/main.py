"""Show-o masked-discrete-diffusion sampler — stdlib.

16 tokens, K=8 vocab, T=8 steps, cosine schedule. Mock "transformer" logits so
the sampling loop is the focus, not the model. Prints the mask evolution.
"""

from __future__ import annotations

import math
import random

random.seed(2)

VOCAB = 8
SEQ_LEN = 16
MASK = -1


def cosine_schedule(T: int) -> list[float]:
    """Mask ratio at step t, in [0, 1]. Goes 1.0 -> 0.0."""
    return [math.cos(math.pi * (t + 1) / (2 * T)) for t in range(T)]


def mock_logits(tokens: list[int], prompt_seed: int = 0) -> list[list[float]]:
    """Pretend-transformer: bias toward specific tokens based on prompt + position."""
    logits = []
    for i, t in enumerate(tokens):
        base = [random.gauss(0, 0.3) for _ in range(VOCAB)]
        bias = (prompt_seed + i) % VOCAB
        base[bias] += 2.5
        if t != MASK:
            base[t] += 3.0
        logits.append(base)
    return logits


def softmax(xs: list[float]) -> list[float]:
    m = max(xs)
    e = [math.exp(x - m) for x in xs]
    z = sum(e)
    return [x / z for x in e]


def step_unmask(tokens: list[int], prompt_seed: int, keep_ratio: float) -> list[int]:
    """Predict all masked tokens; keep top keep_ratio of them confident."""
    logits = mock_logits(tokens, prompt_seed)
    preds = []
    confs = []
    for i, t in enumerate(tokens):
        if t == MASK:
            probs = softmax(logits[i])
            top = max(range(VOCAB), key=lambda k: probs[k])
            preds.append((i, top, probs[top]))
        else:
            preds.append((i, t, 1.0))
        confs.append(preds[-1][2])
    masked_indices = [i for i, t in enumerate(tokens) if t == MASK]
    masked_indices.sort(key=lambda i: -preds[i][2])
    n_to_keep = max(1, int(len(masked_indices) * keep_ratio))
    new_tokens = list(tokens)
    for idx in masked_indices[:n_to_keep]:
        new_tokens[idx] = preds[idx][1]
    return new_tokens


def sample(prompt_seed: int, T: int = 8) -> list[list[int]]:
    tokens = [MASK] * SEQ_LEN
    traces = [list(tokens)]
    ratios = cosine_schedule(T)
    for step in range(T):
        remaining = sum(1 for t in tokens if t == MASK)
        if remaining == 0:
            break
        keep_ratio = max(0.15, 1 - ratios[step])
        tokens = step_unmask(tokens, prompt_seed, keep_ratio)
        traces.append(list(tokens))
    while any(t == MASK for t in tokens):
        tokens = step_unmask(tokens, prompt_seed, 1.0)
        traces.append(list(tokens))
    return traces


def render(tokens: list[int]) -> str:
    return " ".join(f"{t:>2}" if t != MASK else " ." for t in tokens)


def main() -> None:
    print("=" * 60)
    print("SHOW-O MASKED-DISCRETE-DIFFUSION SAMPLER (Phase 12, Lesson 14)")
    print("=" * 60)

    T = 8
    print(f"\nSchedule (cosine, T={T} steps)")
    print("-" * 60)
    for t, r in enumerate(cosine_schedule(T)):
        print(f"  step {t:>2}  mask_ratio = {r:.3f}")

    print("\nSAMPLING TRACE (prompt_seed=3)")
    print("-" * 60)
    traces = sample(prompt_seed=3, T=T)
    for i, tr in enumerate(traces):
        n_mask = sum(1 for x in tr if x == MASK)
        print(f"  step {i:>2}  masked={n_mask:>2}  | {render(tr)}")

    print("\nFOUR TASKS, ONE CHECKPOINT")
    print("-" * 60)
    print("  1. text gen : standard NTP on text tokens")
    print("  2. VQA      : image in -> text out (causal NTP on text)")
    print("  3. T2I      : text in -> masked image + diffusion sampler")
    print("  4. inpaint  : partially-masked image -> fill in via same loop")


if __name__ == "__main__":
    main()
