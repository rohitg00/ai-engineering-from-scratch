"""Tests for the from-scratch DDP wrapper and FSDP sharding sketch.

The collective tests spawn worker processes through torch.multiprocessing
on the gloo backend; this works on CPU and does not require CUDA.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

import torch

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))

import main as ddp


class HelperTests(unittest.TestCase):
    def test_shard_for_rank_partitions_evenly(self):
        x = torch.arange(20)
        all_slices = []
        for rank in range(4):
            sl = ddp.shard_for_rank(x, rank, 4)
            all_slices.append(sl)
        merged = torch.cat(all_slices)
        self.assertTrue(torch.equal(merged, x))
        sizes = [s.shape[0] for s in all_slices]
        self.assertLessEqual(max(sizes) - min(sizes), 1)

    def test_shard_for_rank_handles_remainder(self):
        x = torch.arange(11)
        sizes = [ddp.shard_for_rank(x, r, 3).shape[0] for r in range(3)]
        self.assertEqual(sum(sizes), 11)
        self.assertLessEqual(max(sizes) - min(sizes), 1)


class GradNormTests(unittest.TestCase):
    def test_grad_norm_zero_when_no_grads(self):
        model = ddp.make_model(4, 6, 3)
        norm = ddp._grad_norm(model)
        self.assertEqual(norm, 0.0)

    def test_grad_norm_matches_manual_calc(self):
        model = ddp.make_model(4, 6, 3)
        x = torch.randn(2, 4)
        y = torch.randint(low=0, high=3, size=(2,))
        loss = torch.nn.CrossEntropyLoss()(model(x), y)
        loss.backward()
        norm = ddp._grad_norm(model)
        expected = sum(float(p.grad.data.pow(2).sum().item()) for p in model.parameters()) ** 0.5
        self.assertAlmostEqual(norm, expected, places=6)


class DistributedDemoTests(unittest.TestCase):
    def setUp(self):
        if not torch.distributed.is_available():
            self.skipTest("torch.distributed not available")
        if not torch.distributed.is_gloo_available():
            self.skipTest("gloo backend not available")

    def test_two_rank_param_sums_match(self):
        result = ddp.run_distributed_demo(
            world_size=2,
            in_dim=16,
            hidden=12,
            out_dim=3,
            batch_size=4,
            num_steps=3,
            seed=11,
        )
        self.assertEqual(result["world_size"], 2)
        self.assertLess(result["param_sum_spread"], 1e-3)
        self.assertTrue(result["fsdp_round_trip_all_ranks_ok"])
        self.assertLess(result["manual_all_reduce_max_diff_vs_single_process"], 1e-3)

    def test_three_rank_param_sums_match(self):
        result = ddp.run_distributed_demo(
            world_size=3,
            in_dim=12,
            hidden=10,
            out_dim=3,
            batch_size=4,
            num_steps=2,
            seed=5,
        )
        self.assertEqual(result["world_size"], 3)
        self.assertLess(result["param_sum_spread"], 1e-3)
        self.assertTrue(result["fsdp_round_trip_all_ranks_ok"])


class OutputTests(unittest.TestCase):
    def test_write_demo_round_trip(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "demo.json"
            ddp.write_demo({"world_size": 2}, target)
            data = json.loads(target.read_text())
            self.assertEqual(data["schema"], "ddp-demo.v1")
            self.assertEqual(data["world_size"], 2)


if __name__ == "__main__":
    unittest.main()
