"""safetensors loader、name mapper、shape check のユニットテスト。"""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

import torch
from safetensors import safe_open
from safetensors.torch import save_file

HERE = Path(__file__).resolve()
CODE_DIR = HERE.parent.parent
sys.path.insert(0, str(CODE_DIR))

from main import (
    CONV1D_SUFFIXES,
    GPTModel,
    ModelConfig,
    _needs_transpose,
    _state_fingerprint,
    load_safetensors,
    make_pretrained_to_local,
    make_stub_safetensors,
    quick_generate,
)


def _tiny_cfg(**overrides) -> ModelConfig:
    base = dict(
        vocab_size=64,
        context_length=16,
        d_model=32,
        num_heads=4,
        num_layers=2,
        mlp_expansion=4,
        dropout=0.0,
    )
    base.update(overrides)
    return ModelConfig(**base)


class NameMapTests(unittest.TestCase):
    def test_expands_per_layer_keys(self):
        mapping = make_pretrained_to_local(num_layers=2)
        self.assertIn("h.0.attn.c_attn.weight", mapping)
        self.assertIn("h.1.attn.c_attn.weight", mapping)
        self.assertEqual(mapping["h.0.attn.c_attn.weight"], "blocks.0.attn.qkv.weight")
        self.assertEqual(mapping["wte.weight"], "tok_embed.weight")
        self.assertEqual(mapping["ln_f.weight"], "final_ln.scale")
        self.assertEqual(mapping["ln_f.bias"], "final_ln.shift")

    def test_no_layers_outside_range(self):
        mapping = make_pretrained_to_local(num_layers=2)
        self.assertNotIn("h.2.attn.c_attn.weight", mapping)

    def test_layer_norm_weight_maps_to_scale_and_bias_to_shift(self):
        mapping = make_pretrained_to_local(num_layers=1)
        self.assertEqual(mapping["h.0.ln_1.weight"], "blocks.0.ln1.scale")
        self.assertEqual(mapping["h.0.ln_1.bias"], "blocks.0.ln1.shift")


class TransposeTests(unittest.TestCase):
    def test_only_conv1d_suffixes_transpose(self):
        for suffix in CONV1D_SUFFIXES:
            self.assertTrue(_needs_transpose(f"h.0.{suffix}"))
        self.assertFalse(_needs_transpose("h.0.attn.c_attn.bias"))
        self.assertFalse(_needs_transpose("h.0.ln_1.weight"))
        self.assertFalse(_needs_transpose("wte.weight"))


class LoaderTests(unittest.TestCase):
    def test_load_changes_state_fingerprint(self):
        cfg = _tiny_cfg()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "stub.safetensors"
            make_stub_safetensors(path, cfg, seed=1)
            model = GPTModel(cfg)
            before = _state_fingerprint(model)
            report = load_safetensors(model, path, verbose=False)
            after = _state_fingerprint(model)
            self.assertTrue(report.ok(), report.summary())
            self.assertNotAlmostEqual(before, after, places=4)

    def test_lm_head_remains_tied_after_load(self):
        cfg = _tiny_cfg()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "stub.safetensors"
            make_stub_safetensors(path, cfg, seed=1)
            model = GPTModel(cfg)
            load_safetensors(model, path, verbose=False)
            self.assertEqual(
                model.lm_head.weight.data_ptr(),
                model.tok_embed.weight.data_ptr(),
            )

    def test_shape_mismatch_is_recorded_not_assigned(self):
        cfg = _tiny_cfg()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "stub.safetensors"
            make_stub_safetensors(path, cfg, seed=1)
            with safe_open(str(path), framework="pt") as reader:
                tensors = {name: reader.get_tensor(name) for name in reader.keys()}
            tensors["wte.weight"] = torch.randn(cfg.vocab_size, cfg.d_model + 1)
            bad = Path(tmp) / "bad.safetensors"
            save_file(tensors, str(bad))

            model = GPTModel(cfg)
            original = model.tok_embed.weight.clone()
            report = load_safetensors(model, bad, verbose=False)
            self.assertGreater(len(report.shape_mismatch), 0)
            self.assertTrue(torch.allclose(model.tok_embed.weight, original))

    def test_unknown_tensor_goes_to_unexpected(self):
        cfg = _tiny_cfg()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "stub.safetensors"
            make_stub_safetensors(path, cfg, seed=1)
            with safe_open(str(path), framework="pt") as reader:
                tensors = {name: reader.get_tensor(name) for name in reader.keys()}
            tensors["something.unknown.weight"] = torch.zeros(8)
            polluted = Path(tmp) / "polluted.safetensors"
            save_file(tensors, str(polluted))

            model = GPTModel(cfg)
            report = load_safetensors(model, polluted, verbose=False)
            self.assertIn("something.unknown.weight", report.unexpected)

    def test_missing_file_raises(self):
        cfg = _tiny_cfg()
        model = GPTModel(cfg)
        with self.assertRaises(FileNotFoundError):
            load_safetensors(model, Path("/nonexistent/path.safetensors"), verbose=False)


class StubFixtureTests(unittest.TestCase):
    def test_stub_writes_expected_tensor_count(self):
        cfg = _tiny_cfg(num_layers=3)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "stub.safetensors"
            make_stub_safetensors(path, cfg, seed=1)
            with safe_open(str(path), framework="pt") as reader:
                names = list(reader.keys())
        per_layer = 12
        expected = 4 + per_layer * cfg.num_layers
        self.assertEqual(len(names), expected)


class GenerationConsistencyTests(unittest.TestCase):
    def test_loaded_model_generates_different_tokens_from_random_init(self):
        cfg = _tiny_cfg()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "stub.safetensors"
            make_stub_safetensors(path, cfg, seed=7)
            model = GPTModel(cfg)
            prompt = torch.tensor([[1, 2, 3]], dtype=torch.long)
            before = quick_generate(model, prompt, n=5, seed=0)
            load_safetensors(model, path, verbose=False)
            after = quick_generate(model, prompt, n=5, seed=0)
            self.assertNotEqual(before, after)


if __name__ == "__main__":
    unittest.main()
