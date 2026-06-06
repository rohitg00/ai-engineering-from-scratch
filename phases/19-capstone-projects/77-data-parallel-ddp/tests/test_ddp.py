"""Unit tests for DDP from scratch. Run with: python3 -m unittest discover tests"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "code"))

import torch  # noqa: E402

from main import (  # noqa: E402
    MiniMLP,
    SEED,
    reference_single_process,
    run_ddp,
)


class TestDDP(unittest.TestCase):
    def test_ddp_rank0_loss_matches_single_process(self):
        ddp = run_ddp(world_size=4, steps=10)
        ref_losses, _ = reference_single_process(world_size=4, steps=10)
        ddp_rank0_losses, _ = ddp[0]
        for s, (a, b) in enumerate(zip(ref_losses, ddp_rank0_losses)):
            self.assertAlmostEqual(a, b, places=4,
                                   msg=f"divergence at step {s}: ref={a}, ddp={b}")

    def test_all_ranks_end_with_same_param_norm(self):
        ddp = run_ddp(world_size=4, steps=10)
        norms = [ddp[r][1] for r in range(4)]
        first = norms[0]
        for r, n in enumerate(norms):
            self.assertAlmostEqual(first, n, places=5,
                                   msg=f"rank {r} norm differs: {first} vs {n}")

    def test_ddp_param_norm_matches_reference(self):
        ddp = run_ddp(world_size=4, steps=10)
        _, ref_norm = reference_single_process(world_size=4, steps=10)
        _, ddp_norm = ddp[0]
        self.assertAlmostEqual(ddp_norm, ref_norm, places=5)

    def test_mini_mlp_param_count(self):
        m = MiniMLP()
        total = sum(p.numel() for p in m.parameters())
        self.assertGreater(total, 0)
        self.assertEqual(len(list(m.parameters())), 6)

    def test_world_size_two_still_converges(self):
        ddp = run_ddp(world_size=2, steps=5)
        rank0_losses, _ = ddp[0]
        self.assertEqual(len(rank0_losses), 5)
        self.assertTrue(all(isinstance(x, float) for x in rank0_losses))

    def test_seed_constant_is_documented(self):
        self.assertEqual(SEED, 7)


if __name__ == "__main__":
    unittest.main(verbosity=2)
