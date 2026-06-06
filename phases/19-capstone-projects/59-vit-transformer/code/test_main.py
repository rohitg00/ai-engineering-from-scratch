"""Unit tests for the Vision Transformer encoder."""

from __future__ import annotations

import unittest

import torch

from main import (
    Block,
    FeedForward,
    MultiHeadSelfAttention,
    ViT,
    ViTConfig,
    VisionEncoder,
)


def small_cfg() -> ViTConfig:
    return ViTConfig(image_size=32, patch_size=16, hidden=64, depth=2, heads=4, mlp_ratio=2.0)


class TestSubLayers(unittest.TestCase):
    def test_attention_preserves_shape(self) -> None:
        cfg = small_cfg()
        attn = MultiHeadSelfAttention(cfg)
        x = torch.randn(2, 5, cfg.hidden)
        out = attn(x)
        self.assertEqual(out.shape, x.shape)

    def test_attention_rows_sum_to_one(self) -> None:
        cfg = small_cfg()
        attn = MultiHeadSelfAttention(cfg)
        x = torch.randn(1, 5, cfg.hidden)
        _ = attn(x, store_attn=True)
        scores = attn.last_attn
        self.assertIsNotNone(scores)
        row_sums = scores.sum(dim=-1)
        self.assertTrue(torch.allclose(row_sums, torch.ones_like(row_sums), atol=1e-5))

    def test_feed_forward_expansion(self) -> None:
        cfg = small_cfg()
        ffn = FeedForward(cfg)
        self.assertEqual(ffn.fc1.out_features, int(cfg.hidden * cfg.mlp_ratio))
        self.assertEqual(ffn.fc2.out_features, cfg.hidden)


class TestBlock(unittest.TestCase):
    def test_block_residual_wired(self) -> None:
        cfg = small_cfg()
        torch.manual_seed(3)
        block = Block(cfg)
        x = torch.randn(2, 5, cfg.hidden)
        out = block(x)
        delta = (out - x).abs().mean().item()
        self.assertGreater(delta, 0.0)
        self.assertEqual(out.shape, x.shape)


class TestViTStack(unittest.TestCase):
    def test_full_stack_shape(self) -> None:
        cfg = ViTConfig(image_size=32, patch_size=16, hidden=64, depth=4, heads=4, mlp_ratio=2.0)
        torch.manual_seed(0)
        enc = VisionEncoder(cfg).eval()
        img = torch.randn(3, 3, 32, 32)
        with torch.no_grad():
            tokens, cls = enc(img)
        self.assertEqual(tokens.shape, (3, 5, cfg.hidden))
        self.assertEqual(cls.shape, (3, cfg.hidden))

    def test_gradient_reaches_patch_projection(self) -> None:
        cfg = small_cfg()
        torch.manual_seed(1)
        enc = VisionEncoder(cfg)
        img = torch.randn(1, 3, cfg.image_size, cfg.image_size)
        _, cls = enc(img)
        cls.sum().backward()
        grad = enc.front.patch.proj.weight.grad
        self.assertIsNotNone(grad)
        self.assertGreater(grad.norm().item(), 0.0)


class TestEncoderConfig(unittest.TestCase):
    def test_head_dim_divides(self) -> None:
        cfg = ViTConfig(image_size=32, patch_size=16, hidden=64, depth=1, heads=4)
        self.assertEqual(cfg.head_dim, 16)

    def test_invalid_head_dim_rejected(self) -> None:
        with self.assertRaises(ValueError):
            _ = ViTConfig(image_size=32, patch_size=16, hidden=65, depth=1, heads=4).head_dim


if __name__ == "__main__":
    unittest.main()
