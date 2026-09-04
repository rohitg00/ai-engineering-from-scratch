"""Patch-n'-pack for variable-resolution vision transformer batches — stdlib.

Given a batch of (H, W) image sizes at patch P, computes:
  - per-image patch grid (H/P, W/P) and sequence length n_i = (H/P)(W/P)
  - packed total length N = sum(n_i)
  - block-diagonal attention mask (dense, N x N)
  - AnyRes tiling cost (tile + thumbnail) for comparison
  - square-resize cost (fixed sequence length) for comparison

Prints a budget table for a realistic workload: receipt, chart, screenshot, photo.
No numpy, no torch — bytes-per-cell math stays transparent.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Image:
    name: str
    h: int
    w: int

    def grid(self, p: int) -> tuple[int, int]:
        return (self.h // p, self.w // p)

    def seq(self, p: int) -> int:
        gh, gw = self.grid(p)
        return gh * gw


@dataclass
class PackResult:
    total_tokens: int
    per_image: list[int]
    mask_nonzero: int
    mask_size: int
    cu_seqlens: list[int] = field(default_factory=list)


def pack_batch(images: list[Image], patch: int) -> PackResult:
    lens = [img.seq(patch) for img in images]
    total = sum(lens)
    nz = sum(n * n for n in lens)
    offsets = [0]
    for n in lens:
        offsets.append(offsets[-1] + n)
    return PackResult(total, lens, nz, total * total, offsets)


def build_dense_mask(pack: PackResult) -> list[list[int]]:
    n = pack.total_tokens
    mask = [[0] * n for _ in range(n)]
    for b in range(len(pack.cu_seqlens) - 1):
        lo = pack.cu_seqlens[b]
        hi = pack.cu_seqlens[b + 1]
        for i in range(lo, hi):
            for j in range(lo, hi):
                mask[i][j] = 1
    return mask


def anyres_cost(img: Image, tile: int = 336, thumb: int = 336) -> dict:
    tile_grid = tile // 14
    thumb_grid = thumb // 14
    if img.h <= tile and img.w <= tile:
        grid_r, grid_c = 1, 1
    else:
        best = None
        for gr in range(1, 4):
            for gc in range(1, 4):
                if gr * gc > 6:
                    continue
                tile_h, tile_w = gr * tile, gc * tile
                ratio = img.h / img.w
                tile_ratio = tile_h / tile_w
                score = abs(ratio - tile_ratio) + 0.1 * (gr + gc)
                if best is None or score < best[0]:
                    best = (score, gr, gc)
        _, grid_r, grid_c = best
    tile_tokens = grid_r * grid_c * tile_grid * tile_grid
    thumb_tokens = thumb_grid * thumb_grid
    return {
        "grid": (grid_r, grid_c),
        "tile_tokens": tile_tokens,
        "thumb_tokens": thumb_tokens,
        "total": tile_tokens + thumb_tokens,
    }


def square_cost(img: Image, side: int = 336, patch: int = 14) -> int:
    g = side // patch
    return g * g


def fmt(n: int) -> str:
    if n >= 1_000_000:
        return f"{n / 1e6:.2f}M"
    if n >= 1_000:
        return f"{n / 1e3:.1f}K"
    return str(n)


def demo_toy_pack() -> None:
    print("\nToy batch: two images, patch 2")
    print("-" * 60)
    imgs = [Image("A", 6, 4), Image("B", 4, 8)]
    for img in imgs:
        gh, gw = img.grid(2)
        print(f"  {img.name}: {img.h}x{img.w} -> grid {gh}x{gw} = {img.seq(2)} tokens")
    pack = pack_batch(imgs, 2)
    print(f"packed total length: {pack.total_tokens}")
    print(f"cu_seqlens (FlashAttn varlen): {pack.cu_seqlens}")
    print(f"dense mask size: {pack.mask_size} cells, "
          f"non-zero: {pack.mask_nonzero} "
          f"({pack.mask_nonzero * 100 / pack.mask_size:.1f}%)")
    mask = build_dense_mask(pack)
    print("\nblock-diagonal mask (1=attend, .=mask):")
    for row in mask:
        print("  " + "".join("1" if v else "." for v in row))


def budget_table(workload: list[Image]) -> None:
    print("\n" + "=" * 72)
    print(f"{'image':<26}{'native':>10}{'square':>10}{'anyres':>14}{'grid':>10}")
    print("-" * 72)
    native_sum = 0
    square_sum = 0
    anyres_sum = 0
    for img in workload:
        nat = img.seq(14)
        sq = square_cost(img, 336, 14)
        ar = anyres_cost(img)
        native_sum += nat
        square_sum += sq
        anyres_sum += ar["total"]
        gr, gc = ar["grid"]
        print(f"{img.name:<26}{nat:>10}{sq:>10}{ar['total']:>14}   {gr}x{gc}")
    print("-" * 72)
    print(f"{'TOTAL':<26}{native_sum:>10}{square_sum:>10}{anyres_sum:>14}")
    print(f"\nnative vs square : {native_sum / square_sum:>6.2f}x tokens,"
          f" preserves OCR + layout detail")
    print(f"native vs anyres : {native_sum / anyres_sum:>6.2f}x tokens,"
          f" no tile + thumbnail blow-up past ~2 tiles")
    print(f"anyres vs square : {anyres_sum / square_sum:>6.2f}x tokens,"
          f" the middle ground when encoder is locked at 336")


def main() -> None:
    print("=" * 60)
    print("PATCH-N-PACK FOR ANY-RESOLUTION VLMS (Phase 12, Lesson 06)")
    print("=" * 60)

    demo_toy_pack()

    workload = [
        Image("receipt 600x1500 (1:2.5)", 600, 1500),
        Image("chart 1280x720 (16:9)", 1280, 720),
        Image("phone screen 1170x2532", 1170, 2532),
        Image("photo 2048x1536 (4:3)", 2048, 1536),
        Image("receipt 504x1260 (1:2.5)", 504, 1260),
    ]
    for img in workload:
        img.h -= img.h % 14
        img.w -= img.w % 14

    budget_table(workload)

    print("\n" + "=" * 60)
    print("WHEN TO USE EACH STRATEGY")
    print("-" * 60)
    print("  native-pack (NaViT / NaFlex / M-RoPE):")
    print("    multi-aspect batch, maximum fidelity, minimum tokens")
    print("  AnyRes (LLaVA-NeXT):")
    print("    encoder is frozen at 336x336, but you need detail")
    print("  square-resize:")
    print("    fast baseline, photo-only workloads, no OCR")


if __name__ == "__main__":
    main()
