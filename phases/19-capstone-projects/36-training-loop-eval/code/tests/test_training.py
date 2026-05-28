"""training loop、evaluation、schedule、decay split のユニットテスト。"""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

import torch

HERE = Path(__file__).resolve()
CODE_DIR = HERE.parent.parent
sys.path.insert(0, str(CODE_DIR))

from main import (
    GPTModel,
    ModelConfig,
    TrainConfig,
    build_param_groups,
    calc_loss_batch,
    cosine_with_warmup,
    evaluate_model,
    generate_and_print_sample,
    make_batches,
    train,
    _synthetic_byte_tokens,
)


def _model_cfg(**overrides) -> ModelConfig:
    base = dict(
        vocab_size=128,
        context_length=16,
        d_model=32,
        num_heads=4,
        num_layers=2,
        dropout=0.0,
    )
    base.update(overrides)
    return ModelConfig(**base)


class BatchTests(unittest.TestCase):
    def test_target_is_input_shifted_by_one(self):
        tokens = torch.arange(200, dtype=torch.long)
        loader = make_batches(tokens, batch_size=2, context_length=8, seed=0)
        inputs, targets = next(loader)
        self.assertEqual(inputs.shape, (2, 8))
        self.assertEqual(targets.shape, (2, 8))
        for row in range(inputs.shape[0]):
            for col in range(inputs.shape[1] - 1):
                self.assertEqual(
                    int(targets[row, col].item()),
                    int(inputs[row, col + 1].item()),
                )

    def test_rejects_short_token_stream(self):
        with self.assertRaises(ValueError):
            next(make_batches(torch.arange(5), batch_size=1, context_length=8))

    def test_seed_makes_batches_reproducible(self):
        tokens = torch.arange(200, dtype=torch.long)
        a = next(make_batches(tokens, 4, 8, seed=42))
        b = next(make_batches(tokens, 4, 8, seed=42))
        self.assertTrue(torch.equal(a[0], b[0]))
        self.assertTrue(torch.equal(a[1], b[1]))


class LossTests(unittest.TestCase):
    def test_loss_returns_scalar(self):
        cfg = _model_cfg()
        model = GPTModel(cfg)
        inputs = torch.randint(0, cfg.vocab_size, (2, 8))
        targets = torch.randint(0, cfg.vocab_size, (2, 8))
        loss = calc_loss_batch(model, inputs, targets)
        self.assertEqual(loss.shape, torch.Size([]))
        self.assertGreater(float(loss.item()), 0.0)


class EvalTests(unittest.TestCase):
    def test_evaluate_returns_positive_loss_and_restores_training_mode(self):
        cfg = _model_cfg(dropout=0.5)
        model = GPTModel(cfg)
        tokens = torch.arange(500, dtype=torch.long) % cfg.vocab_size
        model.train()
        loader = make_batches(tokens, 2, 8, seed=0)
        loss = evaluate_model(model, loader, max_batches=3)
        self.assertGreater(loss, 0.0)
        self.assertTrue(model.training)

    def test_evaluate_keeps_model_in_eval_when_called_during_eval(self):
        cfg = _model_cfg(dropout=0.5)
        model = GPTModel(cfg)
        tokens = torch.arange(500, dtype=torch.long) % cfg.vocab_size
        model.eval()
        loader = make_batches(tokens, 2, 8, seed=0)
        _ = evaluate_model(model, loader, max_batches=2)
        self.assertFalse(model.training)


class ParamGroupTests(unittest.TestCase):
    def test_layer_norm_scale_and_shift_in_no_decay_group(self):
        cfg = _model_cfg()
        model = GPTModel(cfg)
        groups = build_param_groups(model, weight_decay=0.1)
        decay_ids = {id(p) for p in groups[0]["params"]}
        no_decay_ids = {id(p) for p in groups[1]["params"]}

        ln_scale = model.blocks[0].ln1.scale
        ln_shift = model.blocks[0].ln1.shift
        self.assertIn(id(ln_scale), no_decay_ids)
        self.assertIn(id(ln_shift), no_decay_ids)
        self.assertNotIn(id(ln_scale), decay_ids)

    def test_linear_weights_in_decay_group(self):
        cfg = _model_cfg()
        model = GPTModel(cfg)
        groups = build_param_groups(model, weight_decay=0.1)
        decay_ids = {id(p) for p in groups[0]["params"]}
        mlp_w = model.blocks[0].mlp.fc1.weight
        self.assertIn(id(mlp_w), decay_ids)

    def test_biases_in_no_decay_group(self):
        cfg = _model_cfg(use_bias=True)
        model = GPTModel(cfg)
        groups = build_param_groups(model, weight_decay=0.1)
        no_decay_ids = {id(p) for p in groups[1]["params"]}
        bias = model.blocks[0].mlp.fc1.bias
        self.assertIn(id(bias), no_decay_ids)


class ScheduleTests(unittest.TestCase):
    def test_warmup_starts_below_max(self):
        lr0 = cosine_with_warmup(0, warmup_steps=10, total_steps=100, max_lr=1.0, min_lr=0.1)
        self.assertLess(lr0, 1.0)
        self.assertGreater(lr0, 0.0)

    def test_peak_at_warmup_end(self):
        lr_peak = cosine_with_warmup(9, warmup_steps=10, total_steps=100, max_lr=1.0, min_lr=0.1)
        self.assertAlmostEqual(lr_peak, 1.0, places=5)

    def test_decay_reaches_min_lr_at_end(self):
        lr_end = cosine_with_warmup(100, warmup_steps=10, total_steps=100, max_lr=1.0, min_lr=0.1)
        self.assertAlmostEqual(lr_end, 0.1, places=5)


class TrainingLoopTests(unittest.TestCase):
    def test_short_run_writes_jsonl_and_reduces_loss(self):
        torch.manual_seed(0)
        train_cfg = TrainConfig(
            batch_size=4,
            context_length=16,
            num_steps=30,
            eval_every=15,
            eval_batches=2,
            max_lr=3e-3,
            min_lr=3e-4,
            warmup_steps=5,
            sample_max_new_tokens=4,
        )
        mcfg = _model_cfg(context_length=train_cfg.context_length)
        model = GPTModel(mcfg)
        train_tokens = _synthetic_byte_tokens(2048, mcfg.vocab_size, seed=1)
        val_tokens = _synthetic_byte_tokens(512, mcfg.vocab_size, seed=2)
        prompt = torch.tensor([[1, 2, 3, 4]], dtype=torch.long)

        with tempfile.TemporaryDirectory() as tmp:
            log_path = Path(tmp) / "losses.jsonl"
            records = train(model, train_tokens, val_tokens, train_cfg, prompt, log_path=log_path)
            self.assertTrue(log_path.exists())

            with log_path.open() as fh:
                lines = [json.loads(line) for line in fh if line.strip()]
            self.assertEqual(len(lines), train_cfg.num_steps)
            self.assertEqual(lines[0]["step"], 0)
            self.assertIn("val_loss", lines[-1])

        first_loss = records[0]["train_loss"]
        last_loss = records[-1]["train_loss"]
        self.assertLess(last_loss, first_loss)


class GenerationProbeTests(unittest.TestCase):
    def test_sample_returns_prompt_plus_new_tokens(self):
        cfg = _model_cfg()
        model = GPTModel(cfg)
        prompt = torch.tensor([[1, 2, 3]], dtype=torch.long)
        tokens = generate_and_print_sample(model, prompt, max_new_tokens=4, seed=0)
        self.assertEqual(len(tokens), 7)


if __name__ == "__main__":
    unittest.main()
