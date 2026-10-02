"""Tests for the open model architecture calculator."""

from __future__ import annotations

import contextlib
import io
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))

import main as calc


def with_fields(name: str, **fields) -> dict:
    config = dict(calc.CONFIGS[name])
    config.update(fields)
    return config


class ParameterCountTests(unittest.TestCase):
    def test_dense_totals_match_published_counts(self):
        expected = {
            "llama3-8b": 8_030_261_248,
            "gemma2-9b": 9_241_705_984,
            "spark-x2.5-4b": 4_112_079_360,
        }
        for name, total in expected.items():
            with self.subTest(name=name):
                self.assertEqual(calc.analyze(name, calc.CONFIGS[name]).total_params, total)

    def test_explicit_head_dim_overrides_hidden_over_heads(self):
        gemma = calc.CONFIGS["gemma2-9b"]
        self.assertEqual(calc.head_dim(gemma), 256)
        self.assertEqual(calc.head_dim(calc.CONFIGS["llama3-8b"]), 128)
        # Q and O project 3584 <-> 16 * 256, K and V to 8 * 256.
        self.assertEqual(
            calc.attention_params_per_layer(gemma),
            2 * 3584 * 4096 + 2 * 3584 * 2048,
        )

    def test_headwise_output_gate_adds_one_weight_per_head(self):
        spark = calc.CONFIGS["spark-x2.5-4b"]
        ungated = dict(spark)
        del ungated["attn_output_gate"]
        self.assertEqual(
            calc.attention_params_per_layer(spark) - calc.attention_params_per_layer(ungated),
            2560 * 16,
        )

    def test_untied_lm_head_is_counted_once_more(self):
        tied = calc.analyze("tied", with_fields("llama3-8b", tie_word_embeddings=True))
        untied = calc.analyze("untied", calc.CONFIGS["llama3-8b"])
        self.assertEqual(untied.total_params - tied.total_params, 128256 * 4096)

    def test_geglu_counts_gate_up_and_down(self):
        self.assertEqual(calc.mlp_params(3584, 14336, "geglu"), 3 * 3584 * 14336)
        self.assertEqual(calc.mlp_params(768, 3072, "gelu"), 2 * 768 * 3072)


class KVCacheTests(unittest.TestCase):
    def test_all_full_attention_model(self):
        llama = calc.analyze("llama3-8b", calc.CONFIGS["llama3-8b"])
        self.assertEqual(llama.kv_cache_bytes_bf16, 2 * 32 * 8 * 128 * 131072 * 2)
        self.assertEqual(llama.kv_cache_bytes_bf16, llama.kv_cache_all_full_bytes_bf16)
        self.assertEqual(llama.full_attention_layers, 32)

    def test_hybrid_sliding_window_model(self):
        spark = calc.analyze("spark-x2.5-4b", calc.CONFIGS["spark-x2.5-4b"])
        per_token = 2 * 4 * 256 * 2
        self.assertEqual(spark.full_attention_layers, 9)
        self.assertEqual(spark.kv_cache_bytes_bf16, per_token * (9 * 1048576 + 27 * 512))
        self.assertEqual(spark.kv_cache_bytes_bf16, 38_711_328_768)
        self.assertEqual(spark.kv_cache_all_full_bytes_bf16, 154_618_822_656)

    def test_window_larger_than_context_caps_at_context(self):
        config = with_fields("gemma2-9b", sliding_window=100_000)
        self.assertEqual(set(calc.cached_tokens_per_layer(config)), {8192})


class LayerTypesValidationTests(unittest.TestCase):
    def test_missing_layer_types_means_every_layer_is_full(self):
        self.assertEqual(
            calc.layer_types(calc.CONFIGS["llama3-8b"]), ["full_attention"] * 32
        )

    def test_rejects_fewer_entries_than_layers(self):
        config = with_fields("llama3-8b", layer_types=["full_attention"])
        with self.assertRaisesRegex(ValueError, "1 entries but num_hidden_layers is 32"):
            calc.analyze("llama3-8b", config)

    def test_rejects_more_entries_than_layers(self):
        config = with_fields("llama3-8b", layer_types=["full_attention"] * 33)
        with self.assertRaises(ValueError):
            calc.analyze("llama3-8b", config)

    def test_rejects_unknown_layer_type(self):
        config = with_fields("llama3-8b", layer_types=["linear_attention"] * 32)
        with self.assertRaisesRegex(ValueError, "linear_attention"):
            calc.analyze("llama3-8b", config)

    def test_rejects_sliding_layers_without_a_window(self):
        config = with_fields(
            "llama3-8b", layer_types=["sliding_attention", "full_attention"] * 16
        )
        with self.assertRaisesRegex(ValueError, "no sliding_window"):
            calc.analyze("llama3-8b", config)


class FormattingTests(unittest.TestCase):
    def test_fmt_bytes_uses_decimal_units(self):
        self.assertEqual(calc.fmt_bytes(17_179_869_184), "17.2GB")
        self.assertEqual(calc.fmt_bytes(38_711_328_768), "38.7GB")
        self.assertEqual(calc.fmt_bytes(999), "999.0B")

    def test_main_prints_every_bundled_config(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            calc.main()
        for name in calc.CONFIGS:
            self.assertIn(name, out.getvalue())
        self.assertIn("if all full     : 154.6GB", out.getvalue())


if __name__ == "__main__":
    unittest.main()
