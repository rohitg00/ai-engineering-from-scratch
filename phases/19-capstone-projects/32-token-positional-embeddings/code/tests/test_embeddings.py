"""token embedding と positional embedding のテスト。"""

from __future__ import annotations

import math
import os
import sys
import unittest

import torch

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    EmbeddingComposer,
    LearnedPositionalEmbedding,
    SinusoidalPositionalEmbedding,
    TokenEmbedding,
    count_parameters,
    neighbour_cosine_curve,
)


class TestTokenEmbedding(unittest.TestCase):
    def test_output_shape(self) -> None:
        torch.manual_seed(0)
        emb = TokenEmbedding(vocab_size=100, d_model=8)
        ids = torch.randint(0, 100, (3, 7), dtype=torch.long)
        out = emb(ids)
        self.assertEqual(out.shape, (3, 7, 8))

    def test_long_dtype_required(self) -> None:
        emb = TokenEmbedding(vocab_size=10, d_model=4)
        ids = torch.zeros(2, 3, dtype=torch.float32)
        with self.assertRaises(TypeError):
            emb(ids)

    def test_rank_two_required(self) -> None:
        emb = TokenEmbedding(vocab_size=10, d_model=4)
        ids_1d = torch.zeros(5, dtype=torch.long)
        with self.assertRaises(ValueError):
            emb(ids_1d)

    def test_parameter_count(self) -> None:
        emb = TokenEmbedding(vocab_size=100, d_model=8)
        self.assertEqual(count_parameters(emb), 100 * 8)


class TestLearnedPositionalEmbedding(unittest.TestCase):
    def test_output_shape(self) -> None:
        torch.manual_seed(0)
        emb = LearnedPositionalEmbedding(max_context_length=64, d_model=16)
        out = emb(seq_len=10)
        self.assertEqual(out.shape, (10, 16))

    def test_parameter_count(self) -> None:
        emb = LearnedPositionalEmbedding(max_context_length=64, d_model=16)
        self.assertEqual(count_parameters(emb), 64 * 16)

    def test_rejects_seq_len_past_max(self) -> None:
        emb = LearnedPositionalEmbedding(max_context_length=16, d_model=4)
        with self.assertRaises(ValueError):
            emb(seq_len=17)

    def test_rejects_zero_seq_len(self) -> None:
        emb = LearnedPositionalEmbedding(max_context_length=16, d_model=4)
        with self.assertRaises(ValueError):
            emb(seq_len=0)


class TestSinusoidalPositionalEmbedding(unittest.TestCase):
    def test_output_shape(self) -> None:
        emb = SinusoidalPositionalEmbedding(max_context_length=64, d_model=16)
        out = emb(seq_len=10)
        self.assertEqual(out.shape, (10, 16))

    def test_zero_parameters(self) -> None:
        emb = SinusoidalPositionalEmbedding(max_context_length=64, d_model=16)
        self.assertEqual(count_parameters(emb), 0)

    def test_odd_d_model_rejected(self) -> None:
        with self.assertRaises(ValueError):
            SinusoidalPositionalEmbedding(max_context_length=8, d_model=5)

    def test_sin_cos_formula(self) -> None:
        d_model = 8
        base = 10000.0
        emb = SinusoidalPositionalEmbedding(max_context_length=16, d_model=d_model, base=base)
        table = emb(seq_len=4)
        for p in range(4):
            for k in range(d_model // 2):
                denom = base ** (2 * k / d_model)
                expected_sin = math.sin(p / denom)
                expected_cos = math.cos(p / denom)
                self.assertAlmostEqual(table[p, 2 * k].item(), expected_sin, places=5)
                self.assertAlmostEqual(table[p, 2 * k + 1].item(), expected_cos, places=5)

    def test_deterministic_across_constructions(self) -> None:
        a = SinusoidalPositionalEmbedding(max_context_length=32, d_model=16)
        b = SinusoidalPositionalEmbedding(max_context_length=32, d_model=16)
        self.assertTrue(torch.equal(a(seq_len=32), b(seq_len=32)))


class TestComposer(unittest.TestCase):
    def test_learned_composition_shape(self) -> None:
        torch.manual_seed(0)
        tok = TokenEmbedding(vocab_size=50, d_model=8)
        pos = LearnedPositionalEmbedding(max_context_length=32, d_model=8)
        c = EmbeddingComposer(tok, pos)
        ids = torch.randint(0, 50, (2, 5), dtype=torch.long)
        out = c(ids)
        self.assertEqual(out.shape, (2, 5, 8))

    def test_sinusoidal_composition_shape(self) -> None:
        torch.manual_seed(0)
        tok = TokenEmbedding(vocab_size=50, d_model=8)
        pos = SinusoidalPositionalEmbedding(max_context_length=32, d_model=8)
        c = EmbeddingComposer(tok, pos)
        ids = torch.randint(0, 50, (2, 5), dtype=torch.long)
        out = c(ids)
        self.assertEqual(out.shape, (2, 5, 8))

    def test_composer_sums_token_and_position(self) -> None:
        torch.manual_seed(0)
        tok = TokenEmbedding(vocab_size=10, d_model=4)
        pos = SinusoidalPositionalEmbedding(max_context_length=8, d_model=4)
        c = EmbeddingComposer(tok, pos)
        ids = torch.tensor([[1, 2, 3]], dtype=torch.long)
        expected = tok(ids) + pos(seq_len=3).unsqueeze(0)
        self.assertTrue(torch.allclose(c(ids), expected))

    def test_d_model_mismatch_rejected(self) -> None:
        tok = TokenEmbedding(vocab_size=10, d_model=4)
        pos = SinusoidalPositionalEmbedding(max_context_length=8, d_model=8)
        with self.assertRaises(ValueError):
            EmbeddingComposer(tok, pos)


class TestNeighbourCosine(unittest.TestCase):
    def test_curve_length(self) -> None:
        torch.manual_seed(0)
        table = torch.randn(20, 8)
        curve = neighbour_cosine_curve(table, max_offset=5)
        self.assertEqual(len(curve), 5)

    def test_sinusoidal_curve_decays(self) -> None:
        pos = SinusoidalPositionalEmbedding(max_context_length=128, d_model=64)
        curve = neighbour_cosine_curve(pos.pe, max_offset=6)
        self.assertGreater(curve[0], curve[5])


class TestGradientFlow(unittest.TestCase):
    def test_token_embedding_gradient_only_for_used_rows(self) -> None:
        torch.manual_seed(0)
        emb = TokenEmbedding(vocab_size=10, d_model=4)
        ids = torch.tensor([[1, 2]], dtype=torch.long)
        out = emb(ids).sum()
        out.backward()
        grads = emb.embedding.weight.grad
        self.assertIsNotNone(grads)
        self.assertGreater(grads[1].abs().sum().item(), 0.0)
        self.assertGreater(grads[2].abs().sum().item(), 0.0)
        self.assertEqual(grads[0].abs().sum().item(), 0.0)
        self.assertEqual(grads[7].abs().sum().item(), 0.0)

    def test_sinusoidal_has_no_grad(self) -> None:
        pos = SinusoidalPositionalEmbedding(max_context_length=16, d_model=8)
        params = list(pos.parameters())
        self.assertEqual(params, [])


if __name__ == "__main__":
    unittest.main()
