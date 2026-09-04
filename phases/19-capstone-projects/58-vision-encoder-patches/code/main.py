"""Vision encoder front end: patch embedding plus 2D sinusoidal position.

Tokenizes a 224x224x3 image into a sequence of 196 patch tokens plus a CLS
token. The patch projection is a Conv2d with kernel and stride equal to the
patch size, which is numerically identical to flatten-then-linear. The
position signal is a fixed 2D sinusoidal table; half the embedding dim encodes
row position, the other half encodes column position, at multiple frequencies.

Run with: python3 main.py
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
import torch
import torch.nn as nn


@dataclass(frozen=True)
class FrontEndConfig:
    image_size: int = 224
    patch_size: int = 16
    in_channels: int = 3
    hidden: int = 768

    @property
    def grid_size(self) -> int:
        if self.image_size % self.patch_size != 0:
            raise ValueError(
                f"patch_size {self.patch_size} must divide image_size {self.image_size}"
            )
        return self.image_size // self.patch_size

    @property
    def num_patches(self) -> int:
        return self.grid_size * self.grid_size


def sinusoidal_2d(grid_h: int, grid_w: int, dim: int) -> torch.Tensor:
    """Build a deterministic 2D sinusoidal position table of shape (grid_h * grid_w, dim).

    Half of dim encodes row position, half encodes column position. Within each
    half, frequencies span the standard Transformer sin/cos band. Identical
    inputs always produce identical outputs, with no learned state.
    """
    if dim % 4 != 0:
        raise ValueError(f"sinusoidal_2d dim must be divisible by 4, got {dim}")
    half = dim // 2
    quarter = half // 2

    freq = torch.arange(quarter, dtype=torch.float32)
    inv = torch.exp(-math.log(10000.0) * freq / max(1, quarter))

    rows = torch.arange(grid_h, dtype=torch.float32).unsqueeze(1) * inv.unsqueeze(0)
    cols = torch.arange(grid_w, dtype=torch.float32).unsqueeze(1) * inv.unsqueeze(0)

    row_emb = torch.cat([torch.sin(rows), torch.cos(rows)], dim=1)
    col_emb = torch.cat([torch.sin(cols), torch.cos(cols)], dim=1)

    table = torch.zeros(grid_h, grid_w, dim)
    table[:, :, :half] = row_emb.unsqueeze(1).expand(-1, grid_w, -1)
    table[:, :, half:] = col_emb.unsqueeze(0).expand(grid_h, -1, -1)
    return table.reshape(grid_h * grid_w, dim)


class PatchEmbed(nn.Module):
    """Patch projection as a strided Conv2d.

    Output shape on a (B, C, H, W) input is (B, N, hidden) where
    N = (H / patch_size) * (W / patch_size).
    """

    def __init__(self, cfg: FrontEndConfig) -> None:
        super().__init__()
        self.cfg = cfg
        self.proj = nn.Conv2d(
            cfg.in_channels,
            cfg.hidden,
            kernel_size=cfg.patch_size,
            stride=cfg.patch_size,
            bias=True,
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if x.dim() != 4:
            raise ValueError(f"expected 4D input (B,C,H,W), got shape {tuple(x.shape)}")
        if x.shape[1] != self.cfg.in_channels:
            raise ValueError(
                f"channel mismatch: got {x.shape[1]}, expected {self.cfg.in_channels}"
            )
        if x.shape[2] != self.cfg.image_size or x.shape[3] != self.cfg.image_size:
            raise ValueError(
                f"spatial mismatch: got {tuple(x.shape[2:])}, expected "
                f"({self.cfg.image_size}, {self.cfg.image_size})"
            )
        out = self.proj(x)
        b = out.shape[0]
        out = out.flatten(2).transpose(1, 2)
        return out


class VisionFrontEnd(nn.Module):
    """Patch embed + CLS prepend + 2D sinusoidal position.

    Output shape: (B, num_patches + 1, hidden).
    """

    def __init__(self, cfg: FrontEndConfig) -> None:
        super().__init__()
        self.cfg = cfg
        self.patch = PatchEmbed(cfg)
        self.cls_token = nn.Parameter(torch.zeros(1, 1, cfg.hidden))
        nn.init.trunc_normal_(self.cls_token, std=0.02)

        pos = sinusoidal_2d(cfg.grid_size, cfg.grid_size, cfg.hidden)
        cls_pos = torch.zeros(1, cfg.hidden)
        full = torch.cat([cls_pos, pos], dim=0).unsqueeze(0)
        self.register_buffer("pos_embed", full, persistent=False)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        tokens = self.patch(x)
        b = tokens.shape[0]
        cls = self.cls_token.expand(b, -1, -1)
        tokens = torch.cat([cls, tokens], dim=1)
        tokens = tokens + self.pos_embed
        return tokens


def synthesize_image(seed: int, image_size: int = 224, channels: int = 3) -> torch.Tensor:
    """Build a deterministic 1x3x224x224 fixture from numpy.random.

    Values are in [0, 1] float32. Adding a smooth gradient on top of noise gives
    the patch projection something with both high and low frequency content to
    summarize.
    """
    rng = np.random.default_rng(seed)
    noise = rng.standard_normal((channels, image_size, image_size)).astype("float32") * 0.1
    y_coords = np.linspace(0.0, 1.0, image_size, dtype="float32")
    x_coords = np.linspace(0.0, 1.0, image_size, dtype="float32")
    gx, gy = np.meshgrid(x_coords, y_coords, indexing="xy")
    gradient = np.stack([gx, gy, (gx + gy) * 0.5], axis=0).astype("float32")
    img = np.clip(gradient + noise + 0.5, 0.0, 1.0)
    return torch.from_numpy(img).unsqueeze(0)


def unfold_then_linear(x: torch.Tensor, weight: torch.Tensor, bias: torch.Tensor, patch_size: int) -> torch.Tensor:
    """Reference implementation of patch projection via unfold + matmul.

    Used by the tests to assert that the Conv2d projection matches the
    flatten-then-linear math.
    """
    if x.dim() != 4:
        raise ValueError(f"expected 4D input, got {tuple(x.shape)}")
    patches = x.unfold(2, patch_size, patch_size).unfold(3, patch_size, patch_size)
    b, c, gh, gw, ph, pw = patches.shape
    flat = patches.permute(0, 2, 3, 1, 4, 5).reshape(b, gh * gw, c * ph * pw)
    w_flat = weight.reshape(weight.shape[0], -1)
    return flat @ w_flat.T + bias


def describe_token_norms(tokens: torch.Tensor, max_show: int = 8) -> str:
    """Print the L2 norm of the first few tokens for sanity inspection."""
    norms = tokens.detach().norm(dim=-1)[0].tolist()
    head = norms[:max_show]
    return ", ".join(f"{v:.3f}" for v in head)


def main() -> None:
    print("=" * 60)
    print("VISION ENCODER PATCHES")
    print("=" * 60)

    cfg = FrontEndConfig()
    print(f"  image size : {cfg.image_size}")
    print(f"  patch size : {cfg.patch_size}")
    print(f"  grid size  : {cfg.grid_size}x{cfg.grid_size}")
    print(f"  num patches: {cfg.num_patches}")
    print(f"  hidden     : {cfg.hidden}")
    print(f"  seq length : {cfg.num_patches + 1} (includes CLS)")

    torch.manual_seed(0)
    img = synthesize_image(seed=0)
    print(f"\nfixture image shape  : {tuple(img.shape)}")
    print(f"fixture image dtype  : {img.dtype}")
    print(f"fixture pixel range  : [{img.min().item():.3f}, {img.max().item():.3f}]")

    model = VisionFrontEnd(cfg).eval()
    n_params = sum(p.numel() for p in model.parameters())
    print(f"\nfront-end params     : {n_params:,}")

    with torch.no_grad():
        tokens = model(img)

    print(f"output token shape   : {tuple(tokens.shape)}")
    print(f"CLS token norm       : {tokens[0, 0].norm().item():.3f}")
    print(f"first 8 token norms  : {describe_token_norms(tokens)}")

    print("\nposition embedding row signature:")
    pos_row = model.pos_embed[0, 1, :8].tolist()
    print("  pos[1, :8] =", ", ".join(f"{v:+.3f}" for v in pos_row))

    print("\nbatch consistency check:")
    img_b4 = synthesize_image(seed=1).repeat(4, 1, 1, 1)
    with torch.no_grad():
        out_b4 = model(img_b4)
    print(f"  batch=4 output shape: {tuple(out_b4.shape)}")
    drift = (out_b4 - out_b4[0:1]).abs().max().item()
    print(f"  max drift across identical batch rows: {drift:.6f}")

    print("\nunfold reference vs Conv2d projection:")
    weight = model.patch.proj.weight.detach()
    bias = model.patch.proj.bias.detach()
    ref = unfold_then_linear(img, weight, bias, cfg.patch_size)
    conv = model.patch(img)
    diff = (ref - conv).abs().max().item()
    print(f"  max abs diff : {diff:.6e}")
    if diff < 1e-4:
        print("  ok: unfold reference matches Conv2d to float tolerance")
    else:
        print("  FAIL: projection drifts from reference")

    print("\ndone.")


if __name__ == "__main__":
    main()
