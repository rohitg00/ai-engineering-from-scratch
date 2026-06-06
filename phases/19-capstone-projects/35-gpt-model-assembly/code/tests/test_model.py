"""Unit tests for the assembled GPT model and generation pipeline."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

import torch

HERE = Path(__file__).resolve()
CODE_DIR = HERE.parent.parent
sys.path.insert(0, str(CODE_DIR))

from main import GPTConfig, GPTModel, count_parameters, generate, top_k_filter


def _tiny_cfg(**overrides) -> GPTConfig:
    base = dict(
        vocab_size=128,
        context_length=32,
        d_model=64,
        num_heads=4,
        num_layers=2,
        dropout=0.0,
    )
    base.update(overrides)
    return GPTConfig(**base)


class ShapeTests(unittest.TestCase):
    def test_forward_returns_vocab_logits(self):
        cfg = _tiny_cfg()
        model = GPTModel(cfg)
        model.eval()
        tokens = torch.randint(0, cfg.vocab_size, (2, 16))
        with torch.no_grad():
            logits = model(tokens)
        self.assertEqual(logits.shape, (2, 16, cfg.vocab_size))

    def test_sequence_overflow_raises(self):
        cfg = _tiny_cfg(context_length=8)
        model = GPTModel(cfg)
        with self.assertRaises(ValueError):
            model(torch.randint(0, cfg.vocab_size, (1, 16)))


class WeightTyingTests(unittest.TestCase):
    def test_tied_model_shares_storage(self):
        cfg = _tiny_cfg(weight_tying=True)
        model = GPTModel(cfg)
        self.assertEqual(
            model.lm_head.weight.data_ptr(),
            model.tok_embed.weight.data_ptr(),
        )

    def test_untied_model_does_not_share_storage(self):
        cfg = _tiny_cfg(weight_tying=False)
        model = GPTModel(cfg)
        self.assertNotEqual(
            model.lm_head.weight.data_ptr(),
            model.tok_embed.weight.data_ptr(),
        )

    def test_untie_increases_parameter_count_by_vocab_times_dmodel(self):
        tied_cfg = _tiny_cfg(weight_tying=True)
        untied_cfg = _tiny_cfg(weight_tying=False)
        tied = count_parameters(GPTModel(tied_cfg))
        untied = count_parameters(GPTModel(untied_cfg))
        expected = tied_cfg.vocab_size * tied_cfg.d_model
        self.assertEqual(untied - tied, expected)


class GenerationTests(unittest.TestCase):
    def test_generate_appends_requested_tokens(self):
        cfg = _tiny_cfg()
        model = GPTModel(cfg)
        prompt = torch.tensor([[1, 2, 3]], dtype=torch.long)
        out = generate(model, prompt, max_new_tokens=5, temperature=1.0, top_k=10, seed=0)
        self.assertEqual(out.shape, (1, prompt.shape[1] + 5))

    def test_top_k_filter_keeps_exactly_k(self):
        logits = torch.tensor([[1.0, 5.0, 2.0, 4.0, 3.0]])
        filtered = top_k_filter(logits, top_k=2)
        finite = torch.isfinite(filtered).sum(dim=-1).item()
        self.assertEqual(finite, 2)
        kept_values = filtered[torch.isfinite(filtered)]
        self.assertIn(5.0, kept_values.tolist())
        self.assertIn(4.0, kept_values.tolist())

    def test_temperature_must_be_positive(self):
        cfg = _tiny_cfg()
        model = GPTModel(cfg)
        with self.assertRaises(ValueError):
            generate(model, torch.tensor([[1, 2]]), max_new_tokens=1, temperature=0.0)

    def test_sliding_window_handles_long_prompt(self):
        cfg = _tiny_cfg(context_length=16)
        model = GPTModel(cfg)
        prompt = torch.randint(0, cfg.vocab_size, (1, 40))
        out = generate(model, prompt, max_new_tokens=4, temperature=1.0, top_k=8, seed=0)
        self.assertEqual(out.shape, (1, prompt.shape[1] + 4))

    def test_seeded_generation_is_reproducible(self):
        cfg = _tiny_cfg()
        model = GPTModel(cfg)
        prompt = torch.tensor([[1, 2, 3]], dtype=torch.long)
        a = generate(model, prompt, max_new_tokens=4, temperature=0.9, top_k=20, seed=123)
        b = generate(model, prompt, max_new_tokens=4, temperature=0.9, top_k=20, seed=123)
        self.assertTrue(torch.equal(a, b))


class ParameterCountTests(unittest.TestCase):
    def test_124m_reference_parameter_count_in_range(self):
        cfg = GPTConfig()
        model = GPTModel(cfg)
        n = count_parameters(model)
        self.assertGreater(n, 120_000_000)
        self.assertLess(n, 130_000_000)


if __name__ == "__main__":
    unittest.main()
