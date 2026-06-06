"""Vision-language pretraining: contrastive InfoNCE plus language modeling.

The model combines a small ViT encoder (lesson 59), a two-layer projection
(lesson 60), and a cross-attention decoder (lesson 61). Training runs for 50
steps over a synthetic 200-pair mock corpus. Both contrastive and LM losses
share gradients through the encoder and projection.

Run with: python3 main.py
"""

from __future__ import annotations

import importlib.util
import math
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

THIS_DIR = Path(__file__).resolve().parent
LESSON_59 = THIS_DIR.parent.parent / "59-vit-transformer" / "code"
LESSON_60 = THIS_DIR.parent.parent / "60-projection-layer-modality-align" / "code"
LESSON_61 = THIS_DIR.parent.parent / "61-cross-attention-fusion" / "code"


def _load_module(name: str, path: Path):
    if name in sys.modules:
        return sys.modules[name]
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"could not load {path}")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


_encoder_mod = _load_module("vit_encoder_lesson59", LESSON_59 / "main.py")
_align_mod = _load_module("align_lesson60", LESSON_60 / "main.py")
_dec_mod = _load_module("decoder_lesson61", LESSON_61 / "main.py")

ViTConfig = _encoder_mod.ViTConfig
VisionEncoder = _encoder_mod.VisionEncoder
synthesize_image = _encoder_mod.synthesize_image
MLPProjector = _align_mod.MLPProjector
DecoderConfig = _dec_mod.DecoderConfig
VisionLanguageDecoder = _dec_mod.VisionLanguageDecoder


PAD_ID = 0


@dataclass(frozen=True)
class PretrainConfig:
    vision_hidden: int = 128
    projection_hidden: int = 256
    embed_dim: int = 128
    text_vocab: int = 512
    max_text_len: int = 16
    n_pairs: int = 200
    batch_size: int = 16
    steps: int = 50
    lr: float = 5e-4
    lm_weight: float = 1.0
    init_log_tau: float = math.log(1.0 / 0.07)
    seed: int = 0


def info_nce_loss(image_emb: torch.Tensor, text_emb: torch.Tensor,
                  log_tau: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
    """Bidirectional InfoNCE used in CLIP and friends.

    Returns (loss, similarity_matrix). image_emb and text_emb must have the
    same shape (N, D). The similarity matrix is symmetric in semantics but not
    in values (rows are images, columns are texts).
    """
    if image_emb.shape != text_emb.shape:
        raise ValueError(
            f"shape mismatch image {tuple(image_emb.shape)} vs text {tuple(text_emb.shape)}"
        )
    n = image_emb.shape[0]
    img_n = F.normalize(image_emb, dim=-1)
    txt_n = F.normalize(text_emb, dim=-1)

    scale = log_tau.exp().clamp(min=1e-3, max=100.0)
    sim = (img_n @ txt_n.T) * scale

    targets = torch.arange(n, device=sim.device)
    loss_i2t = F.cross_entropy(sim, targets)
    loss_t2i = F.cross_entropy(sim.T, targets)
    return (loss_i2t + loss_t2i) * 0.5, sim


def lm_loss(logits: torch.Tensor, target_ids: torch.Tensor,
            padding_id: int = PAD_ID) -> torch.Tensor:
    """Next-token cross-entropy with padding masked.

    `logits` shape is (B, L, V). `target_ids` shape is (B, L). The shift is
    applied outside this function so the caller controls which positions are
    predictions and which are inputs.
    """
    if logits.dim() != 3 or target_ids.dim() != 2:
        raise ValueError(f"logits must be 3D and targets 2D, got {logits.shape} {target_ids.shape}")
    b, l, v = logits.shape
    flat_logits = logits.reshape(b * l, v)
    flat_target = target_ids.reshape(b * l)
    return F.cross_entropy(flat_logits, flat_target, ignore_index=padding_id)


class TextSideEncoder(nn.Module):
    """Tiny text encoder: embedding lookup + mean pool over non-padding tokens."""

    def __init__(self, vocab_size: int, embed_dim: int) -> None:
        super().__init__()
        self.embed = nn.Embedding(vocab_size, embed_dim, padding_idx=PAD_ID)

    def forward(self, ids: torch.Tensor) -> torch.Tensor:
        if ids.dim() != 2:
            raise ValueError(f"expected (B, L), got {tuple(ids.shape)}")
        x = self.embed(ids)
        mask = (ids != PAD_ID).float().unsqueeze(-1)
        denom = mask.sum(dim=1).clamp(min=1.0)
        return (x * mask).sum(dim=1) / denom


class MultimodalModel(nn.Module):
    """Encoder + projection + text side + cross-attention decoder, all trainable."""

    def __init__(self, cfg: PretrainConfig) -> None:
        super().__init__()
        self.cfg = cfg

        vit_cfg = ViTConfig(
            image_size=32,
            patch_size=16,
            hidden=cfg.vision_hidden,
            depth=2,
            heads=4,
            mlp_ratio=2.0,
        )
        self.encoder = VisionEncoder(vit_cfg)
        self.projector = MLPProjector(cfg.vision_hidden, cfg.projection_hidden, cfg.embed_dim)
        self.text_encoder = TextSideEncoder(cfg.text_vocab, cfg.embed_dim)

        dec_cfg = DecoderConfig(
            hidden=cfg.embed_dim,
            heads=4,
            depth=2,
            mlp_ratio=2.0,
            text_vocab=cfg.text_vocab,
            max_text_len=cfg.max_text_len,
            vision_dim=cfg.vision_hidden,
            vision_tokens=(32 // 16) ** 2 + 1,
        )
        self.decoder = VisionLanguageDecoder(dec_cfg)

        self.log_tau = nn.Parameter(torch.tensor(cfg.init_log_tau))

    def encode_image(self, images: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        tokens, cls = self.encoder(images)
        return tokens, self.projector(cls)

    def caption_logits(self, memory: torch.Tensor, text_ids: torch.Tensor) -> torch.Tensor:
        return self.decoder(text_ids, memory)

    def forward(self, images: torch.Tensor, text_ids: torch.Tensor
                ) -> tuple[torch.Tensor, torch.Tensor, dict]:
        memory, image_emb = self.encode_image(images)
        text_emb = self.text_encoder(text_ids)

        contrast, sim = info_nce_loss(image_emb, text_emb, self.log_tau)

        b, l = text_ids.shape
        inputs = text_ids[:, :-1]
        targets = text_ids[:, 1:]
        if inputs.shape[1] == 0:
            lm = torch.tensor(0.0, device=images.device)
        else:
            logits = self.caption_logits(memory, inputs)
            lm = lm_loss(logits, targets, padding_id=PAD_ID)

        diag = sim.diag().mean().item()
        offdiag = (sim.sum() - sim.diag().sum()).item() / max(1, b * b - b)
        stats = {"diag": diag, "off_diag": offdiag, "tau": self.log_tau.exp().item()}
        return contrast, lm, stats


def make_mock_corpus(seed: int, n_pairs: int, vocab_size: int, max_len: int
                     ) -> list[tuple[torch.Tensor, torch.Tensor]]:
    """Build a deterministic mock corpus of n_pairs synthetic image-caption pairs.

    Caption tokens are correlated with the image seed so the model has a small
    amount of learnable signal across the contrastive batch. Token id 0 is
    reserved for padding.
    """
    if vocab_size <= 50:
        raise ValueError(f"vocab_size must be > 50, got {vocab_size}")
    pairs = []
    rng = np.random.default_rng(seed)
    for i in range(n_pairs):
        img_seed = seed * 100 + i
        rng_i = np.random.default_rng(img_seed)
        noise = rng_i.standard_normal((3, 32, 32)).astype("float32") * 0.2
        gx, gy = np.meshgrid(np.linspace(0.0, 1.0, 32), np.linspace(0.0, 1.0, 32))
        bias = (i % 7) / 7.0
        img = np.clip(noise + bias, -1.0, 1.0).astype("float32")
        img = torch.from_numpy(img).unsqueeze(0)

        length = min(6 + (i % 8), max_len)
        ids = np.zeros((max_len,), dtype=np.int64)
        base = (i * 17) % (vocab_size - 50)
        for j in range(length):
            ids[j] = 1 + (base + j * 3 + (i % 5)) % (vocab_size - 1)
        pairs.append((img, torch.from_numpy(ids).unsqueeze(0)))
    return pairs


def sample_batch(pairs: list[tuple[torch.Tensor, torch.Tensor]], indices: list[int]
                 ) -> tuple[torch.Tensor, torch.Tensor]:
    imgs = torch.cat([pairs[i][0] for i in indices], dim=0)
    ids = torch.cat([pairs[i][1] for i in indices], dim=0)
    return imgs, ids


def train(cfg: PretrainConfig) -> dict:
    torch.manual_seed(cfg.seed)
    model = MultimodalModel(cfg).train()
    opt = torch.optim.Adam(model.parameters(), lr=cfg.lr)
    corpus = make_mock_corpus(cfg.seed + 1, cfg.n_pairs, cfg.text_vocab, cfg.max_text_len)
    if cfg.batch_size > len(corpus):
        raise ValueError(
            f"batch_size ({cfg.batch_size}) cannot exceed corpus size ({len(corpus)}) "
            "with replace=False"
        )

    rng = np.random.default_rng(cfg.seed + 2)
    history = {"contrast": [], "lm": [], "total": []}

    for step in range(cfg.steps):
        idx = rng.choice(len(corpus), size=cfg.batch_size, replace=False).tolist()
        imgs, ids = sample_batch(corpus, idx)
        contrast, lm, stats = model(imgs, ids)
        total = contrast + cfg.lm_weight * lm
        opt.zero_grad(set_to_none=True)
        total.backward()
        opt.step()

        history["contrast"].append(contrast.item())
        history["lm"].append(lm.item())
        history["total"].append(total.item())

        if step % 5 == 0 or step == cfg.steps - 1:
            print(f"  step {step:3d}  contrast {contrast.item():.4f}  "
                  f"lm {lm.item():.4f}  tau {stats['tau']:.3f}  "
                  f"diag {stats['diag']:+.3f}  off {stats['off_diag']:+.3f}")
    return history


def main() -> None:
    print("=" * 60)
    print("VISION-LANGUAGE PRETRAINING")
    print("=" * 60)

    cfg = PretrainConfig()
    print(f"  text vocab     : {cfg.text_vocab}")
    print(f"  max text length: {cfg.max_text_len}")
    print(f"  embed dim      : {cfg.embed_dim}")
    print(f"  n pairs        : {cfg.n_pairs}")
    print(f"  batch size     : {cfg.batch_size}")
    print(f"  steps          : {cfg.steps}")
    print(f"  lm weight      : {cfg.lm_weight}")
    print(f"  initial tau    : {math.exp(cfg.init_log_tau):.3f}")

    print("\ntraining:")
    hist = train(cfg)

    init_contrast = hist["contrast"][0]
    final_contrast = hist["contrast"][-1]
    init_lm = hist["lm"][0]
    final_lm = hist["lm"][-1]
    print(f"\ncontrast loss : {init_contrast:.4f} -> {final_contrast:.4f}"
          f"  (drop {init_contrast - final_contrast:+.4f})")
    print(f"lm loss       : {init_lm:.4f} -> {final_lm:.4f}"
          f"  (drop {init_lm - final_lm:+.4f})")

    if final_contrast < init_contrast and final_lm < init_lm:
        print("ok: both losses decreased")
    elif final_contrast < init_contrast or final_lm < init_lm:
        print("partial: at least one loss decreased")
    else:
        print("FAIL: neither loss decreased")

    print("\ndone.")


if __name__ == "__main__":
    main()
