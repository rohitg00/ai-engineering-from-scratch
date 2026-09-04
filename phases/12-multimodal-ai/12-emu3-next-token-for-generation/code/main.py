"""Emu3 token-count + CFG-sampling toys — stdlib.

Two mini-tools:
  1. Token-count calculator for images + video at various resolutions and FPS.
  2. Autoregressive sampler with classifier-free guidance (CFG).
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass

random.seed(0)


@dataclass
class TokCost:
    label: str
    resolution: int
    reduction: int
    video_seconds: float = 0.0
    fps: float = 0.0
    time_reduction: int = 1

    def tokens(self) -> int:
        spatial_per_frame = (self.resolution // self.reduction) ** 2
        if self.video_seconds == 0:
            return spatial_per_frame
        frames = int(self.video_seconds * self.fps)
        frames_reduced = max(1, frames // self.time_reduction)
        return spatial_per_frame * frames_reduced


def token_table() -> None:
    print("\nEMU3 TOKEN COUNTS (at recommended tokenizer reductions)")
    print("-" * 60)
    configs = [
        TokCost("image 256x256",  256, 8),
        TokCost("image 512x512",  512, 8),
        TokCost("image 1024x1024", 1024, 8),
        TokCost("image 2048x2048", 2048, 8),
        TokCost("video 4s @8fps 256x256", 256, 4, 4.0, 8, 4),
        TokCost("video 10s @8fps 256x256", 256, 4, 10.0, 8, 4),
        TokCost("video 4s @8fps 512x512", 512, 4, 4.0, 8, 4),
    ]
    print(f"{'config':<32}{'tokens':>12}{'seconds @30tps':>18}")
    for c in configs:
        t = c.tokens()
        latency = t / 30.0
        print(f"  {c.label:<30}{t:>12}{latency:>16.1f}s")


def softmax(xs: list[float], temperature: float = 1.0) -> list[float]:
    m = max(xs)
    exps = [math.exp((x - m) / temperature) for x in xs]
    z = sum(exps)
    return [e / z for e in exps]


def cfg_mix(cond_logits: list[float], uncond_logits: list[float],
            gamma: float) -> list[float]:
    """Classifier-free guidance: mixed = uncond + gamma * (cond - uncond)."""
    return [u + gamma * (c - u) for c, u in zip(cond_logits, uncond_logits)]


def sample(probs: list[float]) -> int:
    r = random.random()
    acc = 0
    for i, p in enumerate(probs):
        acc += p
        if r <= acc:
            return i
    return len(probs) - 1


def demo_cfg() -> None:
    print("\nCLASSIFIER-FREE GUIDANCE — effect on logit shape")
    print("-" * 60)
    cond = [2.0, 4.0, 1.0, 3.5, 0.5]
    uncond = [1.0, 2.0, 1.5, 1.8, 1.2]
    for gamma in [0.0, 1.0, 3.0, 5.0, 7.0]:
        mixed = cfg_mix(cond, uncond, gamma)
        probs = softmax(mixed)
        top = probs.index(max(probs))
        print(f"  gamma={gamma:>4.1f}  logits={[round(x,2) for x in mixed]}")
        print(f"            probs ={[round(p,3) for p in probs]}  top={top}")
    print("\n  higher gamma -> sharper distribution -> higher-fidelity gen")
    print("  Emu3 recommends gamma = 3.0 for image gen, 7.0 for strong adherence")


def sample_tokens(cond: list[list[float]], uncond: list[list[float]],
                  gamma: float = 3.0, temp: float = 0.8) -> list[int]:
    """Sample a sequence of length len(cond) with CFG + temperature."""
    out = []
    for c, u in zip(cond, uncond):
        mixed = cfg_mix(c, u, gamma)
        probs = softmax(mixed, temperature=temp)
        out.append(sample(probs))
    return out


def demo_sampling() -> None:
    print("\nAUTOREGRESSIVE IMAGE-TOKEN SAMPLING (toy, K=16 codebook)")
    print("-" * 60)
    K = 16
    steps = 8
    cond = [[random.gauss(0, 2) for _ in range(K)] for _ in range(steps)]
    uncond = [[random.gauss(0, 1) for _ in range(K)] for _ in range(steps)]
    tokens_no_cfg = sample_tokens(cond, uncond, gamma=1.0, temp=1.0)
    tokens_cfg3 = sample_tokens(cond, uncond, gamma=3.0, temp=0.8)
    tokens_cfg7 = sample_tokens(cond, uncond, gamma=7.0, temp=0.8)
    print(f"  no CFG      : {tokens_no_cfg}")
    print(f"  CFG gamma=3 : {tokens_cfg3}")
    print(f"  CFG gamma=7 : {tokens_cfg7}")
    print("  higher gamma converges on the conditional modes;"
          " same pattern at scale.")


def main() -> None:
    print("=" * 60)
    print("EMU3 — NEXT-TOKEN PREDICTION FOR IMAGE + VIDEO (Phase 12, Lesson 12)")
    print("=" * 60)

    token_table()
    demo_cfg()
    demo_sampling()

    print("\n" + "=" * 60)
    print("EMU3 vs SDXL — high-level compute picture")
    print("-" * 60)
    print("  training    : comparable (~300B tokens / ~300M image-steps)")
    print("  inference   : Emu3 slow (~2min per 512x512 at 30 tps)")
    print("                SDXL fast (~2-5s per 512x512)")
    print("  quality     : Emu3 matches or beats on FID/GenEval")
    print("  flexibility : Emu3 also does perception + video; SDXL cannot")


if __name__ == "__main__":
    main()
