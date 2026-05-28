"""MultiHeadSelfAttention のテスト。"""

from __future__ import annotations

import math
import os
import sys
import unittest

import torch
import torch.nn.functional as F

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    MultiHeadSelfAttention,
    TinyAttentionLM,
)


class TestConstruction(unittest.TestCase):
    def test_d_model_must_divide_n_heads(self) -> None:
        with self.assertRaises(ValueError):
            MultiHeadSelfAttention(d_model=10, n_heads=3, max_context_length=8)

    def test_zero_heads_rejected(self) -> None:
        with self.assertRaises(ValueError):
            MultiHeadSelfAttention(d_model=8, n_heads=0, max_context_length=8)

    def test_d_head_set_correctly(self) -> None:
        attn = MultiHeadSelfAttention(d_model=32, n_heads=4, max_context_length=8)
        self.assertEqual(attn.d_head, 8)
        self.assertEqual(attn.n_heads, 4)


class TestShape(unittest.TestCase):
    def test_output_shape_matches_input(self) -> None:
        torch.manual_seed(0)
        attn = MultiHeadSelfAttention(d_model=16, n_heads=4, max_context_length=10)
        x = torch.randn(2, 7, 16)
        out = attn(x)
        self.assertEqual(out.shape, x.shape)

    def test_weights_shape(self) -> None:
        torch.manual_seed(0)
        attn = MultiHeadSelfAttention(d_model=16, n_heads=4, max_context_length=10)
        x = torch.randn(2, 7, 16)
        out, weights = attn(x, return_weights=True)
        self.assertEqual(weights.shape, (2, 4, 7, 7))
        self.assertEqual(out.shape, (2, 7, 16))

    def test_rejects_wrong_feature_dim(self) -> None:
        attn = MultiHeadSelfAttention(d_model=16, n_heads=4, max_context_length=8)
        x = torch.randn(2, 5, 32)
        with self.assertRaises(ValueError):
            attn(x)

    def test_rejects_seq_len_past_max(self) -> None:
        attn = MultiHeadSelfAttention(d_model=8, n_heads=2, max_context_length=4)
        x = torch.randn(1, 5, 8)
        with self.assertRaises(ValueError):
            attn(x)


class TestCausalMask(unittest.TestCase):
    def setUp(self) -> None:
        torch.manual_seed(0)
        self.attn = MultiHeadSelfAttention(d_model=16, n_heads=4, max_context_length=12)

    def test_upper_triangle_has_zero_weight(self) -> None:
        x = torch.randn(2, 8, 16)
        _, weights = self.attn(x, return_weights=True)
        upper = torch.triu(torch.ones(8, 8), diagonal=1).bool()
        upper_sum = weights[:, :, upper].abs().sum().item()
        self.assertLess(upper_sum, 1e-5)

    def test_weight_rows_sum_to_one(self) -> None:
        x = torch.randn(2, 6, 16)
        _, weights = self.attn(x, return_weights=True)
        row_sums = weights.sum(dim=-1)
        ones = torch.ones_like(row_sums)
        self.assertTrue(torch.allclose(row_sums, ones, atol=1e-5))

    def test_future_tokens_do_not_change_past_output(self) -> None:
        x = torch.randn(1, 8, 16)
        out_full = self.attn(x)
        x_alt = x.clone()
        x_alt[:, 4:, :] = torch.randn_like(x_alt[:, 4:, :])
        out_alt = self.attn(x_alt)
        self.assertTrue(torch.allclose(out_full[:, :4, :], out_alt[:, :4, :], atol=1e-5))


class TestHeadSplit(unittest.TestCase):
    def test_split_then_merge_round_trip(self) -> None:
        torch.manual_seed(0)
        attn = MultiHeadSelfAttention(d_model=24, n_heads=6, max_context_length=8)
        x = torch.randn(2, 5, 24)
        split = attn._split_heads(x)
        self.assertEqual(split.shape, (2, 6, 5, 4))
        merged = attn._merge_heads(split)
        self.assertEqual(merged.shape, x.shape)
        self.assertTrue(torch.allclose(merged, x))

    def test_qkv_proj_outputs_3d(self) -> None:
        attn = MultiHeadSelfAttention(d_model=16, n_heads=4, max_context_length=8)
        x = torch.randn(1, 5, 16)
        qkv = attn.qkv_proj(x)
        self.assertEqual(qkv.shape, (1, 5, 48))


class TestScalingAndSoftmax(unittest.TestCase):
    def test_softmax_row_sums(self) -> None:
        torch.manual_seed(0)
        attn = MultiHeadSelfAttention(d_model=8, n_heads=2, max_context_length=6)
        x = torch.randn(3, 4, 8)
        _, weights = attn(x, return_weights=True)
        self.assertTrue(
            torch.allclose(weights.sum(dim=-1), torch.ones_like(weights.sum(dim=-1)), atol=1e-5)
        )

    def test_weights_non_negative(self) -> None:
        attn = MultiHeadSelfAttention(d_model=8, n_heads=2, max_context_length=6)
        x = torch.randn(2, 5, 8)
        _, weights = attn(x, return_weights=True)
        self.assertTrue((weights >= 0).all().item())


class TestGradientFlow(unittest.TestCase):
    def test_gradients_reach_qkv_and_out_proj(self) -> None:
        torch.manual_seed(0)
        attn = MultiHeadSelfAttention(d_model=8, n_heads=2, max_context_length=4)
        x = torch.randn(1, 4, 8, requires_grad=False)
        loss = attn(x).sum()
        loss.backward()
        self.assertGreater(attn.qkv_proj.weight.grad.abs().sum().item(), 0.0)
        self.assertGreater(attn.out_proj.weight.grad.abs().sum().item(), 0.0)


class TestTinyTraining(unittest.TestCase):
    def test_loss_drops_on_repeat_task(self) -> None:
        torch.manual_seed(123)
        vocab_size = 32
        seq_len = 10
        model = TinyAttentionLM(
            vocab_size=vocab_size,
            d_model=16,
            n_heads=4,
            max_context_length=seq_len,
        )
        optimizer = torch.optim.Adam(model.parameters(), lr=5e-3)
        gen = torch.Generator()
        gen.manual_seed(7)

        def step() -> float:
            base = torch.randint(0, vocab_size, (16, 1), generator=gen, dtype=torch.long)
            ids = base.expand(16, seq_len + 1).contiguous()
            inputs, targets = ids[:, :-1], ids[:, 1:]
            logits = model(inputs)
            loss = F.cross_entropy(logits.reshape(-1, vocab_size), targets.reshape(-1))
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            return loss.item()

        first = step()
        for _ in range(150):
            step()
        last = step()
        self.assertLess(last, first / 2)


if __name__ == "__main__":
    unittest.main()
