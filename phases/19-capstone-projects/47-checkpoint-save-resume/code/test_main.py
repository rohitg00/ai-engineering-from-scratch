"""Tests for full checkpoint, atomic save, and sharded resume."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

import torch
from torch import nn

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))

import main as ckpt


def _build_components(total_steps: int = 10, lr: float = 0.01):
    model = ckpt.make_model(8, 12, 4)
    opt, sched = ckpt.make_optimizer_and_scheduler(model, lr=lr, total_steps=total_steps)
    return model, opt, sched


class AtomicSaveTests(unittest.TestCase):
    def test_atomic_save_creates_no_partial_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "ckpt.pt"
            payload = {"schema": "ckpt.v1", "value": torch.zeros(3)}
            ckpt.atomic_save(payload, target)
            self.assertTrue(target.exists())
            siblings = [p.name for p in Path(tmp).iterdir() if p.name != target.name]
            for name in siblings:
                self.assertFalse(name.endswith(".tmp"), f"orphan tmp file left: {name}")

    def test_atomic_write_json_round_trip(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "index.json"
            ckpt.atomic_write_json({"schema": "ckpt.v1", "n": 7}, target)
            payload = json.loads(target.read_text())
            self.assertEqual(payload["n"], 7)


class CheckpointResumeTests(unittest.TestCase):
    def test_single_file_round_trip_matches_state(self):
        with tempfile.TemporaryDirectory() as tmp:
            ckpt.seed_everything(0)
            model, opt, sched = _build_components(total_steps=4)
            state = ckpt.TrainState(step=3, epoch=1, batch_in_epoch=2, losses=[0.5, 0.4, 0.3])
            target = Path(tmp) / "ckpt.pt"
            ckpt.save_checkpoint(model, opt, sched, state, target)

            ckpt.seed_everything(99)
            model2, opt2, sched2 = _build_components(total_steps=4)
            for (_k, v1), (_, v2) in zip(
                model.state_dict().items(), model2.state_dict().items(), strict=True
            ):
                self.assertFalse(torch.allclose(v1, v2))

            restored = ckpt.load_checkpoint(target, model2, opt2, sched2)
            self.assertEqual(restored.step, 3)
            self.assertEqual(restored.epoch, 1)
            self.assertEqual(restored.batch_in_epoch, 2)
            self.assertEqual(restored.losses, [0.5, 0.4, 0.3])
            for (k, v1), (_, v2) in zip(
                model.state_dict().items(), model2.state_dict().items(), strict=True
            ):
                self.assertTrue(torch.allclose(v1, v2), f"param diverged: {k}")

    def test_mid_epoch_resume_continues_deterministically(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = ckpt.run_resume_demo(
                total_steps=14,
                interrupt_at=5,
                ckpt_dir=Path(tmp),
                sharded=False,
                seed=3,
            )
            self.assertLess(result["max_loss_diff_after_resume"], 1e-5)


class ShardedCheckpointTests(unittest.TestCase):
    def test_sharded_round_trip(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = ckpt.run_resume_demo(
                total_steps=12,
                interrupt_at=4,
                ckpt_dir=Path(tmp),
                sharded=True,
                num_shards=3,
                seed=5,
            )
            self.assertLess(result["max_loss_diff_after_resume"], 1e-5)
            index = json.loads((Path(tmp) / "index.json").read_text())
            self.assertEqual(index["num_shards"], 3)
            self.assertEqual(len(index["shards"]), 3)

    def test_sha_mismatch_is_detected(self):
        with tempfile.TemporaryDirectory() as tmp:
            ckpt.seed_everything(0)
            model, opt, sched = _build_components(total_steps=4)
            state = ckpt.TrainState(step=1, epoch=0, batch_in_epoch=1, losses=[0.9])
            ckpt.save_sharded_checkpoint(model, opt, sched, state, Path(tmp), num_shards=2)
            tampered = Path(tmp) / "model.shard-000.pt"
            data = tampered.read_bytes()
            tampered.write_bytes(data + b"\x00")
            model2, opt2, sched2 = _build_components(total_steps=4)
            with self.assertRaises(ValueError):
                ckpt.load_sharded_checkpoint(Path(tmp), model2, opt2, sched2)


class ShardLayoutTests(unittest.TestCase):
    def test_shard_layout_is_round_robin_and_complete(self):
        ckpt.seed_everything(0)
        model = ckpt.make_model(4, 6, 3)
        sd = model.state_dict()
        layout = ckpt.shard_keys_by_prefix(sd, 3)
        all_keys = sorted([k for v in layout.values() for k in v])
        self.assertEqual(all_keys, sorted(sd.keys()))
        sizes = [len(v) for v in layout.values()]
        self.assertLessEqual(max(sizes) - min(sizes), 1)


if __name__ == "__main__":
    unittest.main()
