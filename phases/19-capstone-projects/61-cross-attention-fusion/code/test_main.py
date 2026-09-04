"""Unit tests for cross-attention fusion."""

from __future__ import annotations

import unittest

import torch

from main import (
    CausalSelfAttention,
    CrossAttention,
    DecoderBlock,
    DecoderConfig,
    VisionLanguageDecoder,
    causal_mask,
    synth_memory,
    synth_text,
)


def small_cfg() -> DecoderConfig:
    return DecoderConfig(
        hidden=64,
        heads=4,
        depth=2,
        mlp_ratio=2.0,
        text_vocab=128,
        max_text_len=16,
        vision_dim=64,
        vision_tokens=20,
    )


class TestCausalMask(unittest.TestCase):
    def test_shape(self) -> None:
        m = causal_mask(7)
        self.assertEqual(m.shape, (7, 7))
        self.assertEqual(m.dtype, torch.bool)

    def test_lower_triangular(self) -> None:
        m = causal_mask(5).int()
        expected = torch.tril(torch.ones(5, 5, dtype=torch.int32))
        self.assertTrue(torch.equal(m, expected))


class TestCrossAttention(unittest.TestCase):
    def test_output_shape_independent_of_key_length(self) -> None:
        cfg = small_cfg()
        cross = CrossAttention(cfg)
        text = torch.randn(2, 6, cfg.hidden)
        mem_short = torch.randn(2, 10, cfg.vision_dim)
        mem_long = torch.randn(2, 50, cfg.vision_dim)
        out_short = cross(text, mem_short)
        out_long = cross(text, mem_long)
        self.assertEqual(out_short.shape, (2, 6, cfg.hidden))
        self.assertEqual(out_long.shape, (2, 6, cfg.hidden))

    def test_kv_cache_matches_uncached(self) -> None:
        cfg = small_cfg()
        torch.manual_seed(11)
        cross = CrossAttention(cfg).eval()
        text = torch.randn(2, 4, cfg.hidden)
        memory = torch.randn(2, 12, cfg.vision_dim)
        with torch.no_grad():
            ref = cross(text, memory)
            cache = cross.project_memory(memory)
            cached = cross(text, memory, kv_cache=cache)
        self.assertTrue(torch.allclose(ref, cached, atol=1e-5))

    def test_batch_mismatch_raises(self) -> None:
        cfg = small_cfg()
        cross = CrossAttention(cfg)
        text = torch.randn(2, 4, cfg.hidden)
        memory = torch.randn(3, 12, cfg.vision_dim)
        with self.assertRaises(ValueError):
            cross(text, memory)


class TestSelfAttention(unittest.TestCase):
    def test_rejects_wrong_mask_shape(self) -> None:
        cfg = small_cfg()
        attn = CausalSelfAttention(cfg)
        x = torch.randn(1, 5, cfg.hidden)
        bad = torch.ones(4, 4, dtype=torch.bool)
        with self.assertRaises(ValueError):
            attn(x, mask=bad)


class TestDecoder(unittest.TestCase):
    def test_forward_shape(self) -> None:
        cfg = small_cfg()
        dec = VisionLanguageDecoder(cfg).eval()
        ids = synth_text(2, 8, cfg.text_vocab, seed=0)
        memory = synth_memory(2, cfg.vision_tokens, cfg.vision_dim, seed=1)
        with torch.no_grad():
            logits = dec(ids, memory)
        self.assertEqual(logits.shape, (2, 8, cfg.text_vocab))

    def test_cache_path_matches(self) -> None:
        cfg = small_cfg()
        torch.manual_seed(0)
        dec = VisionLanguageDecoder(cfg).eval()
        ids = synth_text(2, 6, cfg.text_vocab, seed=0)
        memory = synth_memory(2, cfg.vision_tokens, cfg.vision_dim, seed=1)
        with torch.no_grad():
            a = dec(ids, memory, use_cache=False)
            b = dec(ids, memory, use_cache=True)
        self.assertTrue(torch.allclose(a, b, atol=1e-5))

    def test_rejects_too_long_input(self) -> None:
        cfg = small_cfg()
        dec = VisionLanguageDecoder(cfg)
        ids = torch.zeros(1, cfg.max_text_len + 1, dtype=torch.long)
        memory = synth_memory(1, cfg.vision_tokens, cfg.vision_dim, seed=0)
        with self.assertRaises(ValueError):
            dec(ids, memory)


if __name__ == "__main__":
    unittest.main()
