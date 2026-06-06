"""Tests for the classifier fine-tuning lesson."""

from __future__ import annotations

import os
import sys
import unittest

import torch

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    ByteTokenizer,
    Classifier,
    ClassificationDataset,
    Config,
    DataLoader,
    LMBody,
    Metrics,
    build_model,
    evaluate,
    freeze_body,
    make_dataset,
    mean_pool,
    precision_recall_f1,
    run_demo,
    stratified_split,
    train_classifier,
    trainable_params,
    unfreeze_body,
)


class TokenizerTests(unittest.TestCase):
    def test_pads_to_max_len(self) -> None:
        tok = ByteTokenizer()
        ids, mask = tok.encode("hi", max_len=8)
        self.assertEqual(len(ids), 8)
        self.assertEqual(len(mask), 8)
        self.assertEqual(mask[:2], [1, 1])
        self.assertEqual(mask[2:], [0, 0, 0, 0, 0, 0])
        self.assertEqual(ids[2], ByteTokenizer.PAD_ID)

    def test_truncates_long_input(self) -> None:
        tok = ByteTokenizer()
        text = "abcdefghij"
        ids, mask = tok.encode(text, max_len=4)
        self.assertEqual(len(ids), 4)
        self.assertEqual(mask, [1, 1, 1, 1])

    def test_decode_skips_pad(self) -> None:
        tok = ByteTokenizer()
        ids, _ = tok.encode("ok", max_len=8)
        self.assertEqual(tok.decode(ids), "ok")


class DatasetTests(unittest.TestCase):
    def test_make_dataset_balanced(self) -> None:
        texts, labels = make_dataset(n_per_class=50, seed=1)
        self.assertEqual(len(texts), 100)
        self.assertEqual(labels.count(0), 50)
        self.assertEqual(labels.count(1), 50)

    def test_stratified_split_preserves_balance(self) -> None:
        texts, labels = make_dataset(n_per_class=100, seed=2)
        tr_t, _tr_y, te_t, te_y = stratified_split(texts, labels, test_frac=0.2, seed=2)
        self.assertEqual(len(tr_t) + len(te_t), 200)
        # 20 percent of each class lands in the test split.
        self.assertEqual(te_y.count(0), 20)
        self.assertEqual(te_y.count(1), 20)


class MetricsTests(unittest.TestCase):
    def test_perfect_classifier(self) -> None:
        p, r, f1 = precision_recall_f1(tp=50, fp=0, fn=0)
        self.assertEqual(p, 1.0)
        self.assertEqual(r, 1.0)
        self.assertEqual(f1, 1.0)

    def test_all_false_positive(self) -> None:
        p, r, f1 = precision_recall_f1(tp=0, fp=10, fn=10)
        self.assertEqual(p, 0.0)
        self.assertEqual(r, 0.0)
        self.assertEqual(f1, 0.0)

    def test_f1_is_harmonic_mean(self) -> None:
        p, r, f1 = precision_recall_f1(tp=8, fp=2, fn=2)
        self.assertAlmostEqual(p, 0.8, places=6)
        self.assertAlmostEqual(r, 0.8, places=6)
        self.assertAlmostEqual(f1, 0.8, places=6)


class FreezeTests(unittest.TestCase):
    def test_freeze_zeros_grad_flags_on_body_only(self) -> None:
        cfg = Config(hidden=16, depth=1, heads=2, max_len=8)
        model = build_model(cfg)
        before = trainable_params(model)
        freeze_body(model)
        after = trainable_params(model)
        self.assertLess(after, before)
        # Head must still be trainable.
        self.assertGreater(after, 0)
        for p in model.body.parameters():
            self.assertFalse(p.requires_grad)
        for p in model.head.parameters():
            self.assertTrue(p.requires_grad)

    def test_unfreeze_restores(self) -> None:
        cfg = Config(hidden=16, depth=1, heads=2, max_len=8)
        model = build_model(cfg)
        freeze_body(model)
        unfreeze_body(model)
        for p in model.parameters():
            self.assertTrue(p.requires_grad)


class PoolingTests(unittest.TestCase):
    def test_mask_excludes_pads_from_pool(self) -> None:
        torch.manual_seed(0)
        hidden = torch.tensor(
            [
                [[1.0, 0.0], [2.0, 0.0], [99.0, 99.0]],
            ]
        )
        mask = torch.tensor([[1, 1, 0]])
        pooled = mean_pool(hidden, mask)
        self.assertTrue(torch.allclose(pooled, torch.tensor([[1.5, 0.0]])))

    def test_empty_mask_does_not_divide_by_zero(self) -> None:
        hidden = torch.tensor([[[1.0, 1.0]]])
        mask = torch.tensor([[0]])
        pooled = mean_pool(hidden, mask)
        self.assertFalse(torch.isnan(pooled).any())


class ForwardTests(unittest.TestCase):
    def test_forward_shape_is_batch_by_num_classes(self) -> None:
        cfg = Config(hidden=16, depth=1, heads=2, max_len=8)
        model = build_model(cfg)
        ids = torch.randint(0, ByteTokenizer.VOCAB, (3, cfg.max_len))
        mask = torch.ones_like(ids)
        out = model(ids, mask)
        self.assertEqual(out.shape, (3, 2))

    def test_pad_tokens_do_not_change_pooled_output(self) -> None:
        cfg = Config(hidden=16, depth=1, heads=2, max_len=8, seed=42)
        model = build_model(cfg)
        model.eval()
        tok = ByteTokenizer()
        ids1, mask1 = tok.encode("hello", max_len=cfg.max_len)
        # Perturb only masked (pad) positions; pooled output must stay unchanged.
        ids2 = list(ids1)
        mask2 = list(mask1)
        for i, m in enumerate(mask2):
            if m == 0:
                ids2[i] = (ids2[i] + 1) % ByteTokenizer.VOCAB
        a = model(torch.tensor([ids1]), torch.tensor([mask1]))
        b = model(torch.tensor([ids2]), torch.tensor([mask2]))
        self.assertTrue(torch.allclose(a, b))


class TrainingTests(unittest.TestCase):
    def test_head_only_reduces_loss(self) -> None:
        cfg = Config(hidden=32, depth=1, heads=2, max_len=16, head_only_epochs=8)
        tok = ByteTokenizer()
        texts, labels = make_dataset(n_per_class=64, seed=cfg.seed)
        ds = ClassificationDataset(texts, labels, tok, cfg.max_len)
        dl = DataLoader(ds, batch_size=cfg.batch_size, shuffle=True)
        model = build_model(cfg)
        freeze_body(model)
        rep = train_classifier(model, dl, epochs=cfg.head_only_epochs, lr=cfg.head_lr, seed=cfg.seed)
        self.assertLess(rep.final_loss, rep.losses[0])
        self.assertEqual(rep.trainable, trainable_params(model))


class EvaluateTests(unittest.TestCase):
    def test_evaluate_on_trained_model_is_above_random(self) -> None:
        cfg = Config(hidden=32, depth=1, heads=2, max_len=16, head_only_epochs=10)
        tok = ByteTokenizer()
        texts, labels = make_dataset(n_per_class=64, seed=cfg.seed)
        tr_t, tr_y, te_t, te_y = stratified_split(texts, labels, test_frac=0.25, seed=cfg.seed)
        train_ds = ClassificationDataset(tr_t, tr_y, tok, cfg.max_len)
        test_ds = ClassificationDataset(te_t, te_y, tok, cfg.max_len)
        train_dl = DataLoader(train_ds, batch_size=cfg.batch_size, shuffle=True)
        test_dl = DataLoader(test_ds, batch_size=cfg.batch_size, shuffle=False)
        model = build_model(cfg)
        freeze_body(model)
        train_classifier(model, train_dl, epochs=cfg.head_only_epochs, lr=cfg.head_lr, seed=cfg.seed)
        metrics = evaluate(model, test_dl)
        self.assertIsInstance(metrics, Metrics)
        self.assertGreater(metrics.f1, 0.5)
        # Sanity: TP + FP + FN + TN must equal the test set size.
        self.assertEqual(metrics.tp + metrics.fp + metrics.fn + metrics.tn, len(test_ds))


if __name__ == "__main__":
    unittest.main()
