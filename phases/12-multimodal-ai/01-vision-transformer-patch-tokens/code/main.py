"""Vision transformer patch tokenizer and geometry calculator — stdlib Python.

Given a ViT config (patch size, resolution, hidden dim, depth, heads), computes:
  - grid shape and sequence length after patch tokenization
  - per-component parameter count (patch embed, pos, blocks, LN)
  - FLOPs per forward (dominated by attention + MLP)
  - comparison table across canonical 2026 encoders

Also walks a toy 8x8 grayscale image through the patch-flatten-project pipeline
so the primitive is concrete. No numpy, no torch — just ints and lists.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ViTConfig:
    name: str
    image_size: int
    patch_size: int
    hidden: int
    depth: int
    heads: int
    registers: int = 0
    cls_token: bool = True


ZOO = [
    ViTConfig("ViT-B/16 @ 224", 224, 16, 768, 12, 12),
    ViTConfig("ViT-L/14 @ 336 (CLIP)", 336, 14, 1024, 24, 16),
    ViTConfig("DINOv2 ViT-g/14 @ 224", 224, 14, 1536, 40, 24, registers=4),
    ViTConfig("SigLIP SO400m/14 @ 378", 378, 14, 1152, 27, 16, registers=4,
              cls_token=False),
    ViTConfig("Qwen2.5-VL ViT @ 896x896", 896, 14, 1280, 32, 16),
]


def grid_shape(image_size: int, patch_size: int) -> tuple[int, int]:
    if image_size <= 0 or patch_size <= 0:
        raise ValueError(f"image_size and patch_size must be positive, got {image_size=} {patch_size=}")
    if image_size % patch_size != 0:
        raise ValueError(f"image_size ({image_size}) must be divisible by patch_size ({patch_size})")
    g = image_size // patch_size
    return (g, g)


def seq_length(cfg: ViTConfig) -> int:
    h, w = grid_shape(cfg.image_size, cfg.patch_size)
    extra = (1 if cfg.cls_token else 0) + cfg.registers
    return h * w + extra


def patch_embed_params(cfg: ViTConfig) -> int:
    p = cfg.patch_size
    return 3 * p * p * cfg.hidden + cfg.hidden


def pos_embed_params(cfg: ViTConfig) -> int:
    return seq_length(cfg) * cfg.hidden


def cls_register_params(cfg: ViTConfig) -> int:
    n = (1 if cfg.cls_token else 0) + cfg.registers
    return n * cfg.hidden


def block_params(cfg: ViTConfig) -> int:
    d = cfg.hidden
    qkvo = 4 * d * d + 4 * d
    mlp = 2 * d * 4 * d + d + 4 * d
    ln = 2 * 2 * d
    return qkvo + mlp + ln


def total_params(cfg: ViTConfig) -> dict:
    pe = patch_embed_params(cfg)
    po = pos_embed_params(cfg)
    cr = cls_register_params(cfg)
    bl = block_params(cfg) * cfg.depth
    fl = 2 * cfg.hidden
    total = pe + po + cr + bl + fl
    return {"patch_embed": pe, "position": po, "cls+reg": cr,
            "blocks": bl, "final_ln": fl, "total": total}


def flops_per_forward(cfg: ViTConfig) -> int:
    n = seq_length(cfg)
    d = cfg.hidden
    attn = 4 * n * d * d + 2 * n * n * d
    mlp = 2 * n * d * 4 * d * 2
    return cfg.depth * (attn + mlp)


def fmt(n: int) -> str:
    if n >= 1_000_000_000:
        return f"{n / 1e9:.2f}B"
    if n >= 1_000_000:
        return f"{n / 1e6:.1f}M"
    if n >= 1_000:
        return f"{n / 1e3:.1f}K"
    return str(n)


def patch_toy_image() -> None:
    """Walk an 8x8 grayscale image through patch-tokenize with P=4.
    Grid is 2x2 → 4 tokens. Each patch is 4x4=16 pixels flat."""
    print("\nToy image patch tokenization (8x8 grayscale, patch_size=4)")
    print("-" * 60)
    img = [[(r * 8 + c) % 256 for c in range(8)] for r in range(8)]
    print("pixel grid (row 0..7):")
    for row in img:
        print("  " + " ".join(f"{v:3d}" for v in row))

    P = 4
    patches = []
    for pr in range(0, 8, P):
        for pc in range(0, 8, P):
            patch = []
            for dr in range(P):
                for dc in range(P):
                    patch.append(img[pr + dr][pc + dc])
            patches.append(patch)

    print(f"\npatches ({len(patches)} total, each length {P*P}):")
    for i, p in enumerate(patches):
        print(f"  patch {i}: {p}")

    fake_W = [[((i + j) % 5) - 2 for j in range(P * P)] for i in range(4)]
    embeddings = []
    for patch in patches:
        emb = []
        for row in fake_W:
            s = sum(r * v for r, v in zip(row, patch, strict=True))
            emb.append(s)
        embeddings.append(emb)

    print("\nlinear projection (P*P=16 -> hidden=4):")
    for i, emb in enumerate(embeddings):
        print(f"  token {i}: {emb}")
    print("→ 4 tokens of dim 4 ready for the transformer.")


def print_config(cfg: ViTConfig) -> None:
    params = total_params(cfg)
    seq = seq_length(cfg)
    gh, gw = grid_shape(cfg.image_size, cfg.patch_size)
    fl = flops_per_forward(cfg)
    print(f"\n{cfg.name}")
    print("-" * 60)
    print(f"  image            : {cfg.image_size}x{cfg.image_size}")
    print(f"  patch size       : {cfg.patch_size}")
    print(f"  grid             : {gh}x{gw}")
    print(f"  seq length       : {seq} (incl {'CLS' if cfg.cls_token else 'no CLS'},"
          f" {cfg.registers} registers)")
    print(f"  hidden / depth   : {cfg.hidden} / {cfg.depth}")
    print(f"  patch embed      : {fmt(params['patch_embed'])}")
    print(f"  position embed   : {fmt(params['position'])}")
    print(f"  blocks total     : {fmt(params['blocks'])}")
    print(f"  ** total params **: {fmt(params['total'])}")
    print(f"  flops / forward  : {fmt(fl)}")


def main() -> None:
    print("=" * 60)
    print("VIT PATCH-TOKEN GEOMETRY CALCULATOR (Phase 12, Lesson 01)")
    print("=" * 60)

    patch_toy_image()

    for cfg in ZOO:
        print_config(cfg)

    print("\n" + "=" * 60)
    print("KEY RATIOS")
    print("-" * 60)
    vit_b = ZOO[0]
    qwen = ZOO[-1]
    print(f"  ViT-B/16 @ 224    seq length: {seq_length(vit_b)}")
    print(f"  Qwen2.5-VL @ 896  seq length: {seq_length(qwen)}")
    print(f"  ratio: {seq_length(qwen) / seq_length(vit_b):.1f}x more tokens")
    print("  That is why high-resolution VLMs need token-merging or pooling.")


if __name__ == "__main__":
    main()
