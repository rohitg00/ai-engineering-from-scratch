"""Unit tests for the sharded checkpoint module."""

from __future__ import annotations

import os
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "code"))

import torch  # noqa: E402

from main import (  # noqa: E402
    CheckpointError,
    ShardManifest,
    load_sharded,
    make_demo_state,
    rotate_checkpoints,
    save_sharded,
)


class TestCheckpoint(unittest.TestCase):
    def setUp(self):
        self.workdir = tempfile.mkdtemp(prefix="aie_test_ckpt_")
        self.world_size = 4
        self.states = [make_demo_state(r, self.world_size) for r in range(self.world_size)]

    def tearDown(self):
        shutil.rmtree(self.workdir, ignore_errors=True)

    def test_round_trip_is_byte_equal(self):
        step_dir = os.path.join(self.workdir, "step_0001")
        save_sharded(self.states, step_dir, step=1)
        _, loaded = load_sharded(step_dir, expected_world_size=self.world_size)
        for r in range(self.world_size):
            self.assertTrue(torch.equal(self.states[r]["param_shard"], loaded[r]["param_shard"]))

    def test_wrong_world_size_rejected(self):
        step_dir = os.path.join(self.workdir, "step_0002")
        save_sharded(self.states, step_dir, step=2)
        with self.assertRaises(CheckpointError) as ctx:
            load_sharded(step_dir, expected_world_size=8)
        self.assertIn("world_size mismatch", str(ctx.exception))

    def test_sha256_catches_tamper(self):
        step_dir = os.path.join(self.workdir, "step_0003")
        save_sharded(self.states, step_dir, step=3)
        target = Path(step_dir) / "rank2.bin"
        target.write_bytes(target.read_bytes() + b"x")
        with self.assertRaises(CheckpointError) as ctx:
            load_sharded(step_dir, expected_world_size=self.world_size)
        self.assertIn("sha256 mismatch", str(ctx.exception))

    def test_atomic_write_leaves_no_tmp_files(self):
        step_dir = os.path.join(self.workdir, "step_0004")
        save_sharded(self.states, step_dir, step=4)
        for entry in Path(step_dir).iterdir():
            self.assertFalse(entry.name.endswith(".tmp"))

    def test_manifest_json_roundtrip(self):
        step_dir = os.path.join(self.workdir, "step_0005")
        m = save_sharded(self.states, step_dir, step=5, wall_clock_seconds=12.5)
        restored = ShardManifest.from_json(m.to_json())
        self.assertEqual(restored.world_size, m.world_size)
        self.assertEqual(restored.step, m.step)
        self.assertEqual(restored.wall_clock_seconds, m.wall_clock_seconds)
        self.assertEqual(len(restored.shards), len(m.shards))

    def test_rotation_keeps_last_k(self):
        for s in range(7):
            sd = os.path.join(self.workdir, f"step_{s:04d}")
            save_sharded(self.states, sd, step=s)
        deleted = rotate_checkpoints(self.workdir, keep_last=3)
        self.assertEqual(len(deleted), 4)
        remaining = sorted([p.name for p in Path(self.workdir).iterdir() if p.is_dir()])
        self.assertEqual(remaining, ["step_0004", "step_0005", "step_0006"])

    def test_missing_manifest_raises(self):
        with self.assertRaises(CheckpointError):
            load_sharded(self.workdir, expected_world_size=self.world_size)


if __name__ == "__main__":
    unittest.main(verbosity=2)
