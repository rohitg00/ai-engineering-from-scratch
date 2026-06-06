"""Unit tests for ZeRO-1 sharding. Run: python3 -m unittest discover tests"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "code"))

import torch  # noqa: E402

from main import (  # noqa: E402
    MiniMLP,
    ZeroOptimizer,
    flat_param_numel,
    gather_flat_params,
    memory_table,
    run_zero,
    scatter_flat_to_params,
    shard_bounds,
)


class TestZero(unittest.TestCase):
    def test_shard_bounds_evenly_divides(self):
        s0 = shard_bounds(16, 4, 0)
        s3 = shard_bounds(16, 4, 3)
        self.assertEqual(s0, (0, 4, 4))
        self.assertEqual(s3, (12, 16, 4))

    def test_shard_bounds_handles_padding(self):
        s0 = shard_bounds(17, 4, 0)
        s3 = shard_bounds(17, 4, 3)
        self.assertEqual(s0[2], 5)
        self.assertLessEqual(s3[1], 17)

    def test_flatten_roundtrip_preserves_params(self):
        m = MiniMLP()
        flat = gather_flat_params(m)
        flat += 0  # ensure independent storage
        before = [p.clone() for p in m.parameters()]
        scatter_flat_to_params(m, flat)
        for a, b in zip(before, m.parameters()):
            self.assertTrue(torch.allclose(a, b, atol=1e-6))

    def test_all_ranks_end_with_same_param_norm(self):
        res = run_zero(world_size=4, steps=5)
        norms = [res[r][1] for r in range(4)]
        first = norms[0]
        for r, n in enumerate(norms):
            self.assertAlmostEqual(first, n, places=4,
                                   msg=f"rank {r} norm differs")

    def test_loss_converges_under_zero(self):
        res = run_zero(world_size=4, steps=20)
        losses, _, _ = res[0]
        self.assertLess(losses[-1], losses[0])

    def test_shard_bytes_smaller_than_full_optim_state(self):
        m = MiniMLP()
        total = flat_param_numel(m)
        per_rank_full_fp32 = total * 4 * 3
        res = run_zero(world_size=4, steps=2)
        shard_bytes = res[0][2]
        self.assertLess(shard_bytes, per_rank_full_fp32)

    def test_memory_table_reports_zero_drop(self):
        out = memory_table(p_params=1_000_000, world_size=8)
        self.assertIn("vanilla DDP", out)
        self.assertIn("ZeRO-1", out)
        self.assertIn("drop:", out)


if __name__ == "__main__":
    unittest.main(verbosity=2)
