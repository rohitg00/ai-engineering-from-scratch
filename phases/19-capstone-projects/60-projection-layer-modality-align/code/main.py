"""Two-layer MLP projection from vision-token space to text embedding space.

The vision encoder (lessons 58 and 59) stays frozen. A frozen mock text
embedding table provides target vectors for synthetic captions. Only the
projector trains. The objective is per-pair cosine alignment.

Run with: python3 main.py
"""

from __future__ import annotations

import importlib.util
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

THIS_DIR = Path(__file__).resolve().parent
LESSON_59 = THIS_DIR.parent.parent / "59-vit-transformer" / "code"


def _load_module(name: str, path: Path):
    if name in sys.modules:
        return sys.modules[name]
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"could not load {path}")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    try:
        spec.loader.exec_module(mod)
    except Exception:
        sys.modules.pop(name, None)
        raise
    return mod


_encoder_mod = _load_module("vit_encoder_lesson59", LESSON_59 / "main.py")
ViTConfig = _encoder_mod.ViTConfig
VisionEncoder = _encoder_mod.VisionEncoder
synthesize_image = _encoder_mod.synthesize_image


@dataclass(frozen=True)
class AlignConfig:
    vision_hidden: int = 768
    projection_hidden: int = 1024
    text_hidden: int = 512
    vocab_size: int = 4096
    max_caption_len: int = 16
    pairs: int = 32
    steps: int = 200
    lr: float = 3e-4
    seed: int = 0


class MLPProjector(nn.Module):
    """Two-layer MLP, the canonical adapter shape used by LLaVA-style VLMs."""

    def __init__(self, in_dim: int, hidden_dim: int, out_dim: int) -> None:
        super().__init__()
        self.fc1 = nn.Linear(in_dim, hidden_dim)
        self.fc2 = nn.Linear(hidden_dim, out_dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.fc2(F.gelu(self.fc1(x)))


class MockTextEmbedding(nn.Module):
    """Frozen text table used as alignment targets.

    Captions are sequences of token ids; the caption embedding is the mean of
    the embedded ids. Deterministic given seed.
    """

    def __init__(self, vocab_size: int, dim: int, seed: int) -> None:
        super().__init__()
        gen = torch.Generator().manual_seed(seed)
        weight = torch.randn(vocab_size, dim, generator=gen) * (1.0 / dim ** 0.5)
        self.table = nn.Embedding(vocab_size, dim, _weight=weight)
        for p in self.table.parameters():
            p.requires_grad_(False)

    def forward(self, ids: torch.Tensor) -> torch.Tensor:
        if ids.dim() != 2:
            raise ValueError(f"expected (B, L) ids, got {tuple(ids.shape)}")
        embed = self.table(ids)
        mask = (ids != 0).float().unsqueeze(-1)
        denom = mask.sum(dim=1).clamp(min=1.0)
        pooled = (embed * mask).sum(dim=1) / denom
        return pooled


def make_pair(seed: int, vocab_size: int, max_len: int) -> tuple[torch.Tensor, torch.Tensor]:
    """One synthetic (image, caption_ids) pair.

    Image is the deterministic 224x224x3 fixture from lesson 58 with a per-pair
    seed. Caption is a length-`max_len` sequence of token ids, again
    deterministic in seed. Token id 0 is reserved as padding.
    """
    img = synthesize_image(seed=seed)
    rng = np.random.default_rng(seed + 10_000)
    length = int(rng.integers(4, max_len + 1))
    ids = np.zeros((max_len,), dtype=np.int64)
    ids[:length] = rng.integers(1, vocab_size, size=length)
    return img, torch.from_numpy(ids).unsqueeze(0)


def cosine_alignment_loss(image_emb: torch.Tensor, text_emb: torch.Tensor) -> torch.Tensor:
    if image_emb.shape != text_emb.shape:
        raise ValueError(
            f"shape mismatch image {tuple(image_emb.shape)} vs text {tuple(text_emb.shape)}"
        )
    img_n = F.normalize(image_emb, dim=-1)
    txt_n = F.normalize(text_emb, dim=-1)
    cos = (img_n * txt_n).sum(dim=-1)
    return (1.0 - cos).mean()


def freeze(module: nn.Module) -> None:
    for p in module.parameters():
        p.requires_grad_(False)


@dataclass
class TrainStats:
    initial_loss: float
    final_loss: float
    final_cos: float
    losses: list[float]


def train(cfg: AlignConfig) -> tuple[MLPProjector, TrainStats]:
    if cfg.pairs <= 0:
        raise ValueError(f"pairs must be > 0, got {cfg.pairs}")
    if cfg.steps <= 0:
        raise ValueError(f"steps must be > 0, got {cfg.steps}")
    if cfg.max_caption_len < 4:
        raise ValueError(
            f"max_caption_len must be >= 4 for make_pair(), got {cfg.max_caption_len}"
        )

    torch.manual_seed(cfg.seed)

    encoder_cfg = ViTConfig(image_size=224, patch_size=16, hidden=cfg.vision_hidden,
                            depth=4, heads=8, mlp_ratio=2.0)
    encoder = VisionEncoder(encoder_cfg).eval()
    freeze(encoder)

    text = MockTextEmbedding(cfg.vocab_size, cfg.text_hidden, seed=cfg.seed + 1)
    freeze(text)

    projector = MLPProjector(cfg.vision_hidden, cfg.projection_hidden, cfg.text_hidden)

    pairs = [make_pair(seed=cfg.seed + 1000 + i,
                       vocab_size=cfg.vocab_size,
                       max_len=cfg.max_caption_len) for i in range(cfg.pairs)]

    opt = torch.optim.Adam(projector.parameters(), lr=cfg.lr)
    losses: list[float] = []

    initial_loss = 0.0
    final_loss = 0.0
    final_cos = 0.0
    for step in range(cfg.steps):
        img, ids = pairs[step % cfg.pairs]
        with torch.no_grad():
            _, cls = encoder(img)
            text_emb = text(ids)

        image_emb = projector(cls)
        loss = cosine_alignment_loss(image_emb, text_emb)

        opt.zero_grad(set_to_none=True)
        loss.backward()
        opt.step()

        losses.append(loss.item())
        if step == 0:
            initial_loss = loss.item()
        if step % 25 == 0 or step == cfg.steps - 1:
            with torch.no_grad():
                cos = F.cosine_similarity(image_emb, text_emb).mean().item()
            print(f"  step {step:4d}  loss {loss.item():.4f}  cos {cos:+.4f}")
        if step == cfg.steps - 1:
            final_loss = loss.item()
            with torch.no_grad():
                final_cos = F.cosine_similarity(image_emb, text_emb).mean().item()

    return projector, TrainStats(
        initial_loss=initial_loss,
        final_loss=final_loss,
        final_cos=final_cos,
        losses=losses,
    )


def main() -> None:
    print("=" * 60)
    print("PROJECTION LAYER FOR MODALITY ALIGNMENT")
    print("=" * 60)

    cfg = AlignConfig()
    print(f"  vision hidden     : {cfg.vision_hidden}")
    print(f"  projection hidden : {cfg.projection_hidden}")
    print(f"  text hidden       : {cfg.text_hidden}")
    print(f"  vocab size        : {cfg.vocab_size}")
    print(f"  pairs             : {cfg.pairs}")
    print(f"  steps             : {cfg.steps}")
    print(f"  learning rate     : {cfg.lr}")

    print("\ntraining (vision encoder frozen, text table frozen, projector trains):")
    projector, stats = train(cfg)

    n_proj = sum(p.numel() for p in projector.parameters())
    print(f"\nprojector params  : {n_proj:,}")
    print(f"initial loss      : {stats.initial_loss:.4f}")
    print(f"final loss        : {stats.final_loss:.4f}")
    print(f"final cosine sim  : {stats.final_cos:+.4f}")
    drop = stats.initial_loss - stats.final_loss
    print(f"loss drop         : {drop:.4f}")
    if drop > 0.0:
        print("  ok: projector learned an alignment direction")
    else:
        print("  FAIL: loss did not decrease")

    print("\ndone.")


if __name__ == "__main__":
    main()
