"""Tests for gradient accumulation core paths."""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))

import main as accum


class EquivalenceTests(unittest.TestCase):
    def test_full_batch_matches_accumulated(self):
        diffs = accum.equivalence_check()
        self.assertLess(diffs["max_grad_diff"], 1e-4)
        self.assertLess(diffs["max_param_diff"], 1e-4)
        self.assertTrue(diffs["params_init_match"])

    def test_loss_scaled_for_accum_divides(self):
        import torch
        from torch import nn

        logits = torch.tensor([[2.0, 0.5, -1.0]])
        target = torch.tensor([0])
        fn = nn.CrossEntropyLoss()
        raw = fn(logits, target)
        scaled = accum.loss_scaled_for_accum(logits, target, 4, fn)
        self.assertAlmostEqual(float(scaled.item()), float(raw.item()) / 4.0, places=6)


class SweepTests(unittest.TestCase):
    def test_sweep_returns_one_point_per_accum(self):
        points = accum.sweep_effective_batches(
            micro_batch=2,
            accum_grid=[1, 2, 4],
            in_dim=16,
            hidden=24,
            out_dim=4,
            num_steps=5,
            lr=0.05,
        )
        self.assertEqual(len(points), 3)
        self.assertEqual([p.accum_steps for p in points], [1, 2, 4])
        self.assertEqual([p.effective_batch for p in points], [2, 4, 8])
        for p in points:
            self.assertGreater(p.samples_per_sec, 0.0)
            self.assertGreater(p.steps, 0)
            self.assertGreater(p.median_step_ms, 0.0)

    def test_sync_calls_equal_step_count(self):
        points = accum.sweep_effective_batches(
            micro_batch=2,
            accum_grid=[1, 4],
            in_dim=16,
            hidden=24,
            out_dim=4,
            num_steps=7,
            lr=0.05,
        )
        for p in points:
            self.assertEqual(p.sync_calls, p.steps)


class CurveOutputTests(unittest.TestCase):
    def test_write_curve_round_trip(self):
        import tempfile

        points = accum.sweep_effective_batches(
            micro_batch=2,
            accum_grid=[1, 2],
            in_dim=8,
            hidden=12,
            out_dim=3,
            num_steps=3,
            lr=0.05,
        )
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "curve.json"
            accum.write_curve(points, path)
            payload = json.loads(path.read_text())
            self.assertEqual(payload["schema"], "accum-curve.v1")
            self.assertEqual(len(payload["points"]), 2)
            self.assertIn("samples_per_sec", payload["points"][0])

    def test_effective_batch_must_divide_accum(self):
        with self.assertRaises(AssertionError):
            accum.run_config(
                effective_batch=5,
                accum_steps=2,
                in_dim=8,
                hidden=12,
                out_dim=3,
                num_steps=2,
                lr=0.05,
                seed=0,
            )


if __name__ == "__main__":
    unittest.main()
