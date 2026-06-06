"""Unit tests for the queue-mesh collectives. Run with: python3 -m unittest discover tests"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "code"))

import torch  # noqa: E402

from main import (  # noqa: E402
    PRIMITIVES,
    gloo_reference,
    run_mesh,
)


class TestCollectives(unittest.TestCase):
    def test_allreduce_matches_gloo(self):
        torch.manual_seed(1)
        ws = 4
        n = 32
        inputs = [torch.randn(n) for _ in range(ws)]
        mesh_out, _ = run_mesh("allreduce", ws, inputs)
        gloo_out = gloo_reference("allreduce", ws, inputs)
        for r in range(ws):
            self.assertTrue(torch.allclose(mesh_out[r], gloo_out[r], atol=1e-5))

    def test_broadcast_matches_gloo(self):
        torch.manual_seed(2)
        ws = 4
        n = 16
        seed = torch.randn(n)
        inputs = [seed.clone() if r == 0 else torch.zeros(n) for r in range(ws)]
        mesh_out, _ = run_mesh("broadcast", ws, inputs, src=0)
        gloo_out = gloo_reference("broadcast", ws, inputs)
        for r in range(ws):
            self.assertTrue(torch.allclose(mesh_out[r], gloo_out[r], atol=1e-6))
            self.assertTrue(torch.allclose(mesh_out[r], seed, atol=1e-6))

    def test_allgather_matches_gloo(self):
        torch.manual_seed(3)
        ws = 4
        n = 8
        inputs = [torch.randn(n) for _ in range(ws)]
        mesh_out, _ = run_mesh("allgather", ws, inputs)
        gloo_out = gloo_reference("allgather", ws, inputs)
        for r in range(ws):
            self.assertEqual(mesh_out[r].numel(), n * ws)
            self.assertTrue(torch.allclose(mesh_out[r], gloo_out[r], atol=1e-6))

    def test_reduce_scatter_matches_gloo(self):
        torch.manual_seed(4)
        ws = 4
        per_chunk = 8
        inputs = [torch.randn(per_chunk * ws) for _ in range(ws)]
        mesh_out, _ = run_mesh("reduce_scatter", ws, inputs)
        gloo_out = gloo_reference("reduce_scatter", ws, inputs)
        for r in range(ws):
            self.assertEqual(mesh_out[r].numel(), per_chunk)
            self.assertTrue(torch.allclose(mesh_out[r], gloo_out[r], atol=1e-5))

    def test_allreduce_byte_count_matches_formula(self):
        """Ring allreduce per-rank bytes = 2 * T * (N - 1) / N."""
        torch.manual_seed(5)
        ws = 4
        n = 64
        inputs = [torch.randn(n) for _ in range(ws)]
        _, total_bytes = run_mesh("allreduce", ws, inputs)
        per_rank_bytes = total_bytes / ws
        expected = 2 * (ws - 1) * (n // ws) * 4
        self.assertEqual(per_rank_bytes, expected)

    def test_allreduce_world_size_two(self):
        """Smallest non-trivial world size still produces correct sum."""
        ws = 2
        inputs = [torch.ones(8) * (r + 1) for r in range(ws)]
        mesh_out, _ = run_mesh("allreduce", ws, inputs)
        expected = sum(inputs)
        for r in range(ws):
            self.assertTrue(torch.allclose(mesh_out[r], expected, atol=1e-6))

    def test_primitive_names(self):
        """The exported PRIMITIVES list is the contract for downstream lessons."""
        self.assertEqual(set(PRIMITIVES),
                         {"allreduce", "broadcast", "allgather", "reduce_scatter"})


if __name__ == "__main__":
    unittest.main(verbosity=2)
