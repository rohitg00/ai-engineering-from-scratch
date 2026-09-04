"""Unit tests for vision-language pretraining."""

from __future__ import annotations

import math
import unittest

import torch

from main import (
    MultimodalModel,
    PAD_ID,
    PretrainConfig,
    info_nce_loss,
    lm_loss,
    make_mock_corpus,
    sample_batch,
)


def small_cfg(steps: int = 5) -> PretrainConfig:
    return PretrainConfig(
        vision_hidden=32,
        projection_hidden=64,
        embed_dim=32,
        text_vocab=64,
        max_text_len=8,
        n_pairs=16,
        batch_size=4,
        steps=steps,
        lr=1e-3,
        seed=0,
    )


class TestInfoNCE(unittest.TestCase):
    def test_zero_loss_on_perfect_diagonal(self) -> None:
        n, d = 4, 8
        emb = torch.eye(n, d)
        log_tau = torch.tensor(math.log(100.0))
        loss, sim = info_nce_loss(emb, emb, log_tau)
        self.assertLess(loss.item(), 1e-3)
        self.assertEqual(sim.shape, (n, n))

    def test_symmetric_across_directions(self) -> None:
        torch.manual_seed(0)
        n, d = 5, 7
        img = torch.randn(n, d)
        txt = torch.randn(n, d)
        log_tau = torch.tensor(0.0)
        loss_a, _ = info_nce_loss(img, txt, log_tau)
        loss_b, _ = info_nce_loss(txt, img, log_tau)
        self.assertAlmostEqual(loss_a.item(), loss_b.item(), places=4)

    def test_shape_mismatch_raises(self) -> None:
        with self.assertRaises(ValueError):
            info_nce_loss(torch.randn(3, 4), torch.randn(5, 4), torch.tensor(0.0))


class TestLMLoss(unittest.TestCase):
    def test_pad_positions_excluded(self) -> None:
        v = 6
        logits = torch.zeros(1, 4, v)
        logits[0, 0, 1] = 10.0
        logits[0, 1, 2] = 10.0
        targets_with_pad = torch.tensor([[1, 2, PAD_ID, PAD_ID]])
        targets_no_pad = torch.tensor([[1, 2, 0, 0]])
        loss_a = lm_loss(logits, targets_with_pad, padding_id=PAD_ID)
        loss_b = lm_loss(logits[:, :2], torch.tensor([[1, 2]]), padding_id=PAD_ID)
        self.assertAlmostEqual(loss_a.item(), loss_b.item(), places=4)


class TestModel(unittest.TestCase):
    def test_forward_returns_two_losses(self) -> None:
        cfg = small_cfg()
        model = MultimodalModel(cfg).train()
        imgs = torch.randn(cfg.batch_size, 3, 32, 32)
        ids = torch.randint(1, cfg.text_vocab, (cfg.batch_size, cfg.max_text_len))
        contrast, lm, stats = model(imgs, ids)
        self.assertTrue(torch.isfinite(contrast).item())
        self.assertTrue(torch.isfinite(lm).item())
        self.assertIn("tau", stats)

    def test_training_reduces_total_loss(self) -> None:
        cfg = small_cfg(steps=10)
        model = MultimodalModel(cfg).train()
        opt = torch.optim.Adam(model.parameters(), lr=cfg.lr)

        corpus = make_mock_corpus(cfg.seed + 1, cfg.n_pairs, cfg.text_vocab, cfg.max_text_len)

        first_total = None
        last_total = None
        for step in range(cfg.steps):
            idx = list(range(step % len(corpus),
                             step % len(corpus) + cfg.batch_size))
            idx = [i % len(corpus) for i in idx]
            imgs, ids = sample_batch(corpus, idx)
            contrast, lm, _ = model(imgs, ids)
            total = contrast + lm
            opt.zero_grad(set_to_none=True)
            total.backward()
            opt.step()
            if step == 0:
                first_total = total.item()
            if step == cfg.steps - 1:
                last_total = total.item()

        self.assertIsNotNone(first_total)
        self.assertIsNotNone(last_total)
        self.assertLess(last_total, first_total + 1e-3)


class TestCorpus(unittest.TestCase):
    def test_make_mock_corpus_shapes(self) -> None:
        pairs = make_mock_corpus(seed=3, n_pairs=8, vocab_size=64, max_len=10)
        self.assertEqual(len(pairs), 8)
        for img, ids in pairs:
            self.assertEqual(img.shape, (1, 3, 32, 32))
            self.assertEqual(ids.shape, (1, 10))
            self.assertTrue((ids >= 0).all().item())
            self.assertTrue((ids < 64).all().item())


if __name__ == "__main__":
    unittest.main()
