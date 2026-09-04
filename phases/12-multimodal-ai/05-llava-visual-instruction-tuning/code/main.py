"""LLaVA 2-layer MLP projector + prompt builder — stdlib Python.

Walks the LLaVA forward pass:
  - toy ViT emits 16 patch tokens of dim 16
  - 2-layer MLP projects each patch to dim 24 (the 'LLM' dim)
  - build a LLaVA-format prompt with <image> placeholder replaced by the 16
    projected tokens
  - report context budget at 2k / 32k / 128k LLM windows

No numpy, no torch. Linear layers and GELU implemented by hand.
"""

from __future__ import annotations

import math
import random

rng = random.Random(11)

PATCH_COUNT = 16
PATCH_DIM = 16
HIDDEN_DIM = 32
LLM_DIM = 24


def vec(n: int) -> list[float]:
    return [rng.gauss(0, 0.3) for _ in range(n)]


def mat(rows: int, cols: int) -> list[list[float]]:
    return [vec(cols) for _ in range(rows)]


def linear(W: list[list[float]], b: list[float], x: list[float]) -> list[float]:
    return [sum(r * v for r, v in zip(row, x)) + bi
            for row, bi in zip(W, b)]


def gelu(x: float) -> float:
    return 0.5 * x * (1.0 + math.tanh(math.sqrt(2.0 / math.pi) * (x + 0.044715 * x * x * x)))


def gelu_vec(v: list[float]) -> list[float]:
    return [gelu(x) for x in v]


class MLPProjector:
    def __init__(self, in_dim: int, hidden: int, out_dim: int):
        self.W1 = mat(hidden, in_dim)
        self.b1 = [0.0] * hidden
        self.W2 = mat(out_dim, hidden)
        self.b2 = [0.0] * out_dim

    def forward(self, x: list[float]) -> list[float]:
        h = gelu_vec(linear(self.W1, self.b1, x))
        return linear(self.W2, self.b2, h)

    def num_params(self) -> int:
        return (len(self.W1) * len(self.W1[0]) + len(self.b1)
                + len(self.W2) * len(self.W2[0]) + len(self.b2))


def fake_vit_output() -> list[list[float]]:
    return [vec(PATCH_DIM) for _ in range(PATCH_COUNT)]


def build_llava_prompt(system: str, user: str, image_tokens: int) -> dict:
    placeholder = "<image>"
    template = (
        f"SYSTEM: {system}\n"
        f"USER: {placeholder} {user}\n"
        f"ASSISTANT: "
    )
    return {
        "raw_prompt": template,
        "placeholder": placeholder,
        "image_tokens": image_tokens,
        "text_token_estimate": len(template.split()) + 10,
    }


def visualize_context(num_image_tokens: int, text_tokens: int) -> None:
    print("\ncontext budget at different LLM windows")
    print("-" * 60)
    totals = (2048, 8192, 32768, 131072)
    for t in totals:
        used = num_image_tokens + text_tokens
        remain = t - used
        pct_image = 100 * num_image_tokens / t
        print(f"  window {t:>6d}: image {pct_image:5.1f}% | "
              f"text {100*text_tokens/t:4.1f}% | remain {max(remain, 0):>6d} tokens")


def demo_projector() -> None:
    print("\nDEMO 1: 2-layer MLP projector forward pass")
    print("-" * 60)
    patches = fake_vit_output()
    proj = MLPProjector(PATCH_DIM, HIDDEN_DIM, LLM_DIM)

    print(f"  ViT out: {PATCH_COUNT} patches of dim {PATCH_DIM}")
    print(f"  MLP:     {PATCH_DIM} -> {HIDDEN_DIM} -> {LLM_DIM}")
    print(f"  params:  {proj.num_params():,}")

    visual_tokens = [proj.forward(p) for p in patches]
    print(f"  output:  {len(visual_tokens)} visual tokens of dim "
          f"{len(visual_tokens[0])}")
    print(f"  token 0 sample: {[round(x, 3) for x in visual_tokens[0][:6]]}")


def demo_prompt() -> None:
    print("\nDEMO 2: LLaVA prompt template")
    print("-" * 60)
    system = ("A chat between a curious human and an artificial intelligence "
              "assistant.")
    user = "Describe what you see in this image in detail."
    prompt = build_llava_prompt(system, user, image_tokens=576)

    print("  raw prompt (LLM receives this after image-token replacement):")
    print("  " + "-" * 56)
    for line in prompt["raw_prompt"].split("\n"):
        print(f"    {line}")
    print(f"  <image> placeholder -> replaced with {prompt['image_tokens']} "
          "visual tokens")
    print(f"  text token estimate: ~{prompt['text_token_estimate']} tokens")
    visualize_context(prompt["image_tokens"], prompt["text_token_estimate"])


def demo_anyres() -> None:
    print("\nDEMO 3: LLaVA-NeXT AnyRes token cost")
    print("-" * 60)
    tile_tokens = 576
    configs = [
        ("336x336 (base)", 1, 0),
        ("672x336 (1x2)", 2, 1),
        ("672x672 (2x2)", 4, 1),
        ("1344x672 (2x4)", 8, 1),
        ("1344x1344 (4x4)", 16, 1),
    ]
    for name, tiles, thumb in configs:
        total = tiles * tile_tokens + thumb * tile_tokens
        print(f"  {name:20s}: {tiles:2d} tiles + {thumb} thumbnail "
              f"= {total:5d} tokens")


def main() -> None:
    print("=" * 60)
    print("LLAVA VISUAL INSTRUCTION TUNING (Phase 12, Lesson 05)")
    print("=" * 60)
    demo_projector()
    demo_prompt()
    demo_anyres()
    print("\n" + "=" * 60)
    print("TAKEAWAYS")
    print("-" * 60)
    print("  · 2-layer MLP projector: 22M params (trivial next to the 7B LLM)")
    print("  · <image> placeholder -> replace with N projected visual tokens")
    print("  · base LLaVA: 576 tokens per image (30% of 2k context)")
    print("  · AnyRes: up to 2880 tokens for high-res OCR / chart inputs")
    print("  · stage 1: train projector alone (hours)")
    print("  · stage 2: train projector + LLM on 158k GPT-4 instructions")


if __name__ == "__main__":
    main()
