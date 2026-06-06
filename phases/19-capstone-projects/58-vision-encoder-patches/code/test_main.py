"""Unit tests for the vision encoder front end."""

from __future__ import annotations

import unittest

import torch

from main import (
    FrontEndConfig,
    PatchEmbed,
    VisionFrontEnd,
    sinusoidal_2d,
    synthesize_image,
    unfold_then_linear,
)


class TestPatchEmbed(unittest.TestCase):
    def test_patch_count_matches_grid(self) -> None:
        cfg = FrontEndConfig(image_size=224, patch_size=16, hidden=64)
        self.assertEqual(cfg.num_patches, 14 * 14)
        cfg2 = FrontEndConfig(image_size=96, patch_size=16, hidden=64)
        self.assertEqual(cfg2.num_patches, 6 * 6)

    def test_output_shape_includes_cls(self) -> None:
        cfg = FrontEndConfig(image_size=64, patch_size=16, hidden=32)
        model = VisionFrontEnd(cfg).eval()
        img = torch.randn(2, 3, 64, 64)
        with torch.no_grad():
            out = model(img)
        self.assertEqual(out.shape, (2, cfg.num_patches + 1, cfg.hidden))

    def test_conv2d_matches_unfold_reference(self) -> None:
        cfg = FrontEndConfig(image_size=64, patch_size=16, hidden=32)
        torch.manual_seed(11)
        patch = PatchEmbed(cfg).eval()
        img = torch.randn(1, 3, 64, 64)
        weight = patch.proj.weight.detach()
        bias = patch.proj.bias.detach()
        with torch.no_grad():
            ref = unfold_then_linear(img, weight, bias, cfg.patch_size)
            conv = patch(img)
        self.assertTrue(torch.allclose(ref, conv, atol=1e-5))


class TestPositionEmbedding(unittest.TestCase):
    def test_sinusoidal_deterministic(self) -> None:
        a = sinusoidal_2d(7, 7, 64)
        b = sinusoidal_2d(7, 7, 64)
        self.assertTrue(torch.equal(a, b))

    def test_sinusoidal_shape(self) -> None:
        table = sinusoidal_2d(14, 14, 64)
        self.assertEqual(table.shape, (196, 64))

    def test_sinusoidal_requires_div_by_four(self) -> None:
        with self.assertRaises(ValueError):
            sinusoidal_2d(4, 4, 30)


class TestVisionFrontEnd(unittest.TestCase):
    def test_cls_token_broadcasts_without_leakage(self) -> None:
        cfg = FrontEndConfig(image_size=32, patch_size=16, hidden=32)
        model = VisionFrontEnd(cfg).eval()
        img = torch.randn(3, 3, 32, 32)
        with torch.no_grad():
            out = model(img)
        cls_norms = out[:, 0].norm(dim=-1)
        self.assertTrue(torch.all(cls_norms > 0))
        diffs = (out[:, 0] - out[0:1, 0]).abs()
        self.assertTrue(diffs.max().item() < 1e-3)

    def test_rejects_wrong_spatial_size(self) -> None:
        cfg = FrontEndConfig(image_size=32, patch_size=16, hidden=32)
        model = VisionFrontEnd(cfg).eval()
        with self.assertRaises(ValueError):
            model(torch.randn(1, 3, 48, 48))

    def test_synthesize_image_is_deterministic(self) -> None:
        a = synthesize_image(seed=7)
        b = synthesize_image(seed=7)
        self.assertTrue(torch.equal(a, b))
        self.assertEqual(a.shape, (1, 3, 224, 224))


if __name__ == "__main__":
    unittest.main()
