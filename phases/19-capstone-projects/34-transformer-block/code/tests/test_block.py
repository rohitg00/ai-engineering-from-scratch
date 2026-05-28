"""transformer block components のユニットテスト。"""

from __future__ import annotations

import math
import sys
import unittest
from pathlib import Path

import torch

HERE = Path(__file__).resolve()
CODE_DIR = HERE.parent.parent
sys.path.insert(0, str(CODE_DIR))

from main import (
    BlockConfig,
    BlockStack,
    FeedForward,
    LayerNorm,
    MultiHeadAttention,
    TransformerBlock,
    gradient_norm_at_embedding,
)


def _cfg(**overrides) -> BlockConfig:
    base = dict(
        d_model=64,
        num_heads=4,
        context_length=32,
        attn_dropout=0.0,
        residual_dropout=0.0,
    )
    base.update(overrides)
    return BlockConfig(**base)


class LayerNormTests(unittest.TestCase):
    def test_output_shape_matches_input(self):
        ln = LayerNorm(64)
        x = torch.randn(2, 16, 64)
        out = ln(x)
        self.assertEqual(out.shape, x.shape)

    def test_normalizes_last_dim_to_zero_mean_unit_var(self):
        ln = LayerNorm(64)
        x = torch.randn(2, 16, 64) * 5.0 + 3.0
        out = ln(x)
        mean = out.mean(dim=-1)
        std = out.std(dim=-1)
        self.assertTrue(torch.allclose(mean, torch.zeros_like(mean), atol=1e-5))
        self.assertTrue(torch.allclose(std, torch.ones_like(std), atol=1e-2))


class MultiHeadAttentionTests(unittest.TestCase):
    def test_invalid_head_count_raises(self):
        with self.assertRaises(ValueError):
            MultiHeadAttention(_cfg(d_model=64, num_heads=5))

    def test_causal_mask_blocks_future_tokens(self):
        cfg = _cfg(d_model=32, num_heads=4, context_length=8)
        mha = MultiHeadAttention(cfg)
        mha.eval()

        x = torch.randn(1, 8, 32)
        baseline = mha(x).clone()

        x_perturbed = x.clone()
        x_perturbed[:, 5:, :] = torch.randn_like(x_perturbed[:, 5:, :])

        out = mha(x_perturbed)
        self.assertTrue(torch.allclose(out[:, :5, :], baseline[:, :5, :], atol=1e-5))
        self.assertFalse(torch.allclose(out[:, 5:, :], baseline[:, 5:, :], atol=1e-5))

    def test_sequence_longer_than_context_raises(self):
        cfg = _cfg(d_model=32, num_heads=4, context_length=8)
        mha = MultiHeadAttention(cfg)
        with self.assertRaises(ValueError):
            mha(torch.randn(1, 16, 32))


class FeedForwardTests(unittest.TestCase):
    def test_expansion_width_is_four_d_model(self):
        cfg = _cfg(d_model=32)
        mlp = FeedForward(cfg)
        self.assertEqual(mlp.fc1.out_features, 4 * cfg.d_model)
        self.assertEqual(mlp.fc2.in_features, 4 * cfg.d_model)
        self.assertEqual(mlp.fc2.out_features, cfg.d_model)


class TransformerBlockTests(unittest.TestCase):
    def test_output_shape_matches_input(self):
        cfg = _cfg()
        block = TransformerBlock(cfg)
        block.eval()
        x = torch.randn(2, 16, cfg.d_model)
        out = block(x)
        self.assertEqual(out.shape, x.shape)

    def test_pre_ln_and_post_ln_differ(self):
        torch.manual_seed(0)
        cfg_pre = _cfg(pre_ln=True)
        cfg_post = _cfg(pre_ln=False)
        block_pre = TransformerBlock(cfg_pre)
        block_post = TransformerBlock(cfg_post)
        block_post.load_state_dict(block_pre.state_dict())
        block_pre.eval()
        block_post.eval()
        x = torch.randn(2, 16, cfg_pre.d_model)
        with torch.no_grad():
            out_pre = block_pre(x)
            out_post = block_post(x)
        self.assertEqual(out_pre.shape, out_post.shape)
        self.assertFalse(torch.allclose(out_pre, out_post, atol=1e-3))


class GradientFlowTests(unittest.TestCase):
    def test_embedding_gradient_is_nonzero_for_pre_ln_stack(self):
        torch.manual_seed(0)
        cfg = _cfg(pre_ln=True)
        stack = BlockStack(cfg, depth=4)
        stack.eval()
        tokens = torch.randint(0, 128, (2, 16))
        grad = gradient_norm_at_embedding(stack, tokens)
        self.assertGreater(grad, 0.0)
        self.assertFalse(math.isnan(grad))
        self.assertFalse(math.isinf(grad))

    def test_both_variants_run_forward_without_error(self):
        for pre_ln in (True, False):
            cfg = _cfg(pre_ln=pre_ln)
            stack = BlockStack(cfg, depth=3)
            stack.eval()
            tokens = torch.randint(0, 128, (1, 8))
            with torch.no_grad():
                out = stack(tokens)
            self.assertEqual(out.shape, (1, 8, cfg.d_model))


if __name__ == "__main__":
    unittest.main()
