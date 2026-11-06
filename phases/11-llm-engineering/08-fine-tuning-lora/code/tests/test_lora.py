"""Unit tests for the pickle-free LoRA adapter save/load path in lora.py."""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np
import torch

HERE = Path(__file__).resolve()
CODE_DIR = HERE.parent.parent
sys.path.insert(0, str(CODE_DIR))

from lora import (
    LoRALayer,
    create_demo_model,
    inject_lora,
    load_lora_adapter,
    save_lora_adapter,
)


def _tiny_model(base_weights=None):
    model = create_demo_model(d_model=8, hidden=16, n_classes=4)
    if base_weights is not None:
        model.load_state_dict(base_weights)
    inject_lora(model, target_modules=["0", "2"], rank=4, alpha=8)
    return model


def _lora_layers(model):
    return [m for _, m in model.named_modules() if isinstance(m, LoRALayer)]


class SaveLoadRoundTripTests(unittest.TestCase):
    def test_round_trip_preserves_values(self):
        base_weights = create_demo_model(d_model=8, hidden=16, n_classes=4).state_dict()
        model_a = _tiny_model(base_weights)
        model_b = _tiny_model(base_weights)

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "adapter.npz"
            save_lora_adapter(model_a, path)
            load_lora_adapter(model_b, path)

        test_in = torch.randn(5, 8)
        out_a = model_a(test_in).detach()
        out_b = model_b(test_in).detach()
        self.assertTrue(torch.allclose(out_a, out_b, atol=1e-6))

    def test_save_preserves_requested_path_without_appending_npz(self):
        model = _tiny_model()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "adapter.pt"
            save_lora_adapter(model, path)

            self.assertTrue(path.exists())
            self.assertFalse((Path(tmp) / "adapter.pt.npz").exists())

            model_b = _tiny_model()
            load_lora_adapter(model_b, path)  # must not raise FileNotFoundError


class SecurityRegressionTests(unittest.TestCase):
    def test_loader_rejects_object_arrays_and_never_executes_pickle(self):
        with tempfile.TemporaryDirectory() as tmp:
            marker = Path(tmp) / "pwned"

            class Malicious:
                def __reduce__(self):
                    return (open, (str(marker), "w"))

            malicious_path = Path(tmp) / "malicious.npz"
            # np.savez defaults allow_pickle=True on the write side, so building
            # this fixture is still possible - the property under test is that
            # load_lora_adapter (which loads with allow_pickle=False) refuses to
            # read it back, rather than unpickling and executing Malicious.
            np.savez(
                malicious_path,
                **{
                    "0.lora.A": np.array(Malicious(), dtype=object),
                    "0.lora.B": np.zeros((1, 1), dtype=np.float32),
                },
            )

            model = _tiny_model()
            with self.assertRaises(ValueError):
                load_lora_adapter(model, malicious_path)

            self.assertFalse(marker.exists())


class ShapeValidationTests(unittest.TestCase):
    def test_shape_mismatch_raises_and_does_not_mutate_model(self):
        model = _tiny_model()
        layer = _lora_layers(model)[0]
        name = next(n for n, m in model.named_modules() if m is layer)
        original_a = layer.A.detach().clone()
        original_b = layer.B.detach().clone()

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "adapter.npz"
            np.savez(
                path,
                **{
                    f"{name}.A": np.zeros((1, 1), dtype=np.float32),
                    f"{name}.B": layer.B.detach().numpy(),
                },
            )

            with self.assertRaises(ValueError):
                load_lora_adapter(model, path)

        self.assertTrue(torch.equal(layer.A, original_a))
        self.assertTrue(torch.equal(layer.B, original_b))


class DtypeDevicePreservationTests(unittest.TestCase):
    def test_load_casts_into_destination_dtype_instead_of_replacing_it(self):
        model_a = _tiny_model()
        model_b = _tiny_model()
        for layer in _lora_layers(model_b):
            layer.A.data = layer.A.data.double()
            layer.B.data = layer.B.data.double()

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "adapter.npz"
            save_lora_adapter(model_a, path)  # fp32 archive
            load_lora_adapter(model_b, path)  # fp64 destination parameters

        for layer_a, layer_b in zip(_lora_layers(model_a), _lora_layers(model_b)):
            self.assertEqual(layer_b.A.dtype, torch.float64)
            self.assertEqual(layer_b.B.dtype, torch.float64)
            self.assertTrue(torch.allclose(layer_a.A.double(), layer_b.A, atol=1e-6))

    def test_bfloat16_round_trips_losslessly(self):
        model_a = _tiny_model()
        model_b = _tiny_model()
        for layer in _lora_layers(model_a) + _lora_layers(model_b):
            layer.A.data = layer.A.data.bfloat16()
            layer.B.data = layer.B.data.bfloat16()

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "adapter.npz"
            save_lora_adapter(model_a, path)  # must not raise on bf16 input
            load_lora_adapter(model_b, path)

        for layer_a, layer_b in zip(_lora_layers(model_a), _lora_layers(model_b)):
            self.assertEqual(layer_b.A.dtype, torch.bfloat16)
            self.assertEqual(layer_b.B.dtype, torch.bfloat16)
            self.assertTrue(torch.equal(layer_a.A, layer_b.A))
            self.assertTrue(torch.equal(layer_a.B, layer_b.B))


if __name__ == "__main__":
    unittest.main()
