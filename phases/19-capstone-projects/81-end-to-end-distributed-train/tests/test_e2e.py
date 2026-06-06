"""Unit tests for the end-to-end distributed training composition."""

from __future__ import annotations

import os
import shutil
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "code"))

import torch  # noqa: E402

from main import (  # noqa: E402
    CHECKPOINT_STEP,
    MiniGPT,
    WORLD_SIZE,
    flat_param_numel,
    load_sharded,
    run_e2e,
    verify_resume,
)


class TestEndToEnd(unittest.TestCase):
    def setUp(self):
        self.out = run_e2e(world_size=WORLD_SIZE, steps=20)
        self.results = self.out["results"]
        self.ckpt_dir = self.out["ckpt_dir"]

    def tearDown(self):
        if "workdir" in self.out:
            shutil.rmtree(self.out["workdir"], ignore_errors=True)

    def test_all_ranks_end_with_same_param_norm(self):
        norms = [self.results[r]["norm"] for r in range(WORLD_SIZE)]
        first = norms[0]
        for r, n in enumerate(norms):
            self.assertAlmostEqual(first, n, places=4,
                                   msg=f"rank {r} norm differs after composition")

    def test_zero_shard_memory_matches_formula(self):
        total = flat_param_numel(MiniGPT())
        pad = (-total) % WORLD_SIZE
        chunk = (total + pad) // WORLD_SIZE
        expected = chunk * 4 * 3
        for r in range(WORLD_SIZE):
            self.assertEqual(self.results[r]["shard_bytes"], expected)

    def test_checkpoint_round_trips_byte_equal(self):
        masters = [self.results[r]["master_at_ckpt"] for r in range(WORLD_SIZE)]
        self.assertTrue(verify_resume(self.ckpt_dir, WORLD_SIZE, masters))

    def test_loss_log_has_one_per_step(self):
        losses = self.results[0]["losses"]
        self.assertEqual(len(losses), 20)

    def test_manifest_present_at_checkpoint_step(self):
        loaded = load_sharded(self.ckpt_dir, expected_world_size=WORLD_SIZE)
        self.assertEqual(len(loaded), WORLD_SIZE)
        for r in range(WORLD_SIZE):
            self.assertIn("model_state", loaded[r])
            self.assertIn("optim_state", loaded[r])

    def test_loss_finite_and_no_nan(self):
        losses = self.results[0]["losses"]
        for s, loss in enumerate(losses):
            self.assertFalse(loss != loss, msg=f"NaN at step {s}")
            self.assertFalse(loss == float("inf"), msg=f"inf at step {s}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
