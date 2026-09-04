"""Unit tests for the modality-alignment projection layer."""

from __future__ import annotations

import unittest

import torch
import torch.nn.functional as F

from main import (
    AlignConfig,
    MLPProjector,
    MockTextEmbedding,
    cosine_alignment_loss,
    make_pair,
    train,
)


class TestProjector(unittest.TestCase):
    def test_output_shape(self) -> None:
        proj = MLPProjector(in_dim=64, hidden_dim=128, out_dim=32)
        x = torch.randn(5, 64)
        out = proj(x)
        self.assertEqual(out.shape, (5, 32))

    def test_gradient_flows(self) -> None:
        proj = MLPProjector(in_dim=32, hidden_dim=64, out_dim=16)
        x = torch.randn(3, 32)
        target = torch.randn(3, 16)
        loss = cosine_alignment_loss(proj(x), target)
        loss.backward()
        self.assertIsNotNone(proj.fc1.weight.grad)
        self.assertGreater(proj.fc1.weight.grad.norm().item(), 0.0)


class TestTextTable(unittest.TestCase):
    def test_table_is_frozen(self) -> None:
        table = MockTextEmbedding(vocab_size=64, dim=16, seed=0)
        trainable = [p for p in table.parameters() if p.requires_grad]
        self.assertEqual(trainable, [])

    def test_pooling_ignores_padding(self) -> None:
        table = MockTextEmbedding(vocab_size=64, dim=8, seed=2)
        ids_full = torch.tensor([[1, 2, 3, 4]])
        ids_pad = torch.tensor([[1, 2, 3, 4, 0, 0]])
        out_full = table(ids_full)
        out_pad = table(ids_pad)
        self.assertTrue(torch.allclose(out_full, out_pad, atol=1e-5))


class TestCosineLoss(unittest.TestCase):
    def test_zero_loss_on_identical_vectors(self) -> None:
        v = torch.randn(4, 8)
        loss = cosine_alignment_loss(v, v)
        self.assertAlmostEqual(loss.item(), 0.0, places=5)

    def test_max_loss_on_antiparallel_vectors(self) -> None:
        v = torch.randn(4, 8)
        loss = cosine_alignment_loss(v, -v)
        self.assertAlmostEqual(loss.item(), 2.0, places=4)


class TestTrainingLoop(unittest.TestCase):
    def test_loss_drops_over_steps(self) -> None:
        cfg = AlignConfig(
            vision_hidden=64,
            projection_hidden=128,
            text_hidden=32,
            vocab_size=64,
            max_caption_len=4,
            pairs=4,
            steps=40,
            lr=1e-3,
            seed=7,
        )
        torch.manual_seed(cfg.seed)
        _, stats = _train_small(cfg)
        self.assertLess(stats.final_loss, stats.initial_loss)


def _train_small(cfg: AlignConfig):
    import importlib.util
    import sys
    from pathlib import Path

    THIS = Path(__file__).resolve().parent
    LESSON_59 = THIS.parent.parent / "59-vit-transformer" / "code"
    name = "vit_encoder_lesson59_test"
    if name in sys.modules:
        mod = sys.modules[name]
    else:
        spec = importlib.util.spec_from_file_location(name, LESSON_59 / "main.py")
        mod = importlib.util.module_from_spec(spec)
        sys.modules[name] = mod
        spec.loader.exec_module(mod)

    encoder_cfg = mod.ViTConfig(
        image_size=32, patch_size=16, hidden=cfg.vision_hidden,
        depth=2, heads=4, mlp_ratio=2.0,
    )
    encoder = mod.VisionEncoder(encoder_cfg).eval()
    for p in encoder.parameters():
        p.requires_grad_(False)

    text = MockTextEmbedding(cfg.vocab_size, cfg.text_hidden, seed=cfg.seed + 1)
    projector = MLPProjector(cfg.vision_hidden, cfg.projection_hidden, cfg.text_hidden)

    pairs = []
    for i in range(cfg.pairs):
        img = torch.randn(1, 3, 32, 32)
        ids = torch.randint(1, cfg.vocab_size, (1, cfg.max_caption_len))
        pairs.append((img, ids))

    opt = torch.optim.Adam(projector.parameters(), lr=cfg.lr)
    losses = []
    init = 0.0
    final = 0.0
    for step in range(cfg.steps):
        img, ids = pairs[step % cfg.pairs]
        with torch.no_grad():
            _, cls = encoder(img)
            text_emb = text(ids)
        loss = cosine_alignment_loss(projector(cls), text_emb)
        opt.zero_grad(set_to_none=True)
        loss.backward()
        opt.step()
        if step == 0:
            init = loss.item()
        if step == cfg.steps - 1:
            final = loss.item()
        losses.append(loss.item())

    class S:
        pass

    s = S()
    s.initial_loss = init
    s.final_loss = final
    s.final_cos = 0.0
    s.losses = losses
    return projector, s


class TestPairFixture(unittest.TestCase):
    def test_make_pair_shapes(self) -> None:
        img, ids = make_pair(seed=3, vocab_size=128, max_len=8)
        self.assertEqual(img.shape, (1, 3, 224, 224))
        self.assertEqual(ids.shape, (1, 8))
        self.assertTrue((ids >= 0).all().item())
        self.assertTrue((ids < 128).all().item())


if __name__ == "__main__":
    unittest.main()
