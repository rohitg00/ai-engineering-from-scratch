"""Unit tests for multimodal evaluation metrics."""

from __future__ import annotations

import unittest

import torch

from main import (
    EvalSuite,
    bleu4,
    build_eval_suite,
    recall_at_k,
    vqa_exact_match,
)


class TestRecallAtK(unittest.TestCase):
    def test_perfect_identity_matrix(self) -> None:
        n = 10
        sim = torch.eye(n) * 10.0
        i2t, t2i = recall_at_k(sim, 1)
        self.assertAlmostEqual(i2t, 1.0)
        self.assertAlmostEqual(t2i, 1.0)

    def test_flipped_matrix_below_top(self) -> None:
        n = 6
        sim = torch.full((n, n), 10.0)
        sim.fill_diagonal_(0.0)
        i2t, _ = recall_at_k(sim, 1)
        self.assertAlmostEqual(i2t, 0.0)

    def test_rejects_invalid_k(self) -> None:
        sim = torch.eye(4)
        with self.assertRaises(ValueError):
            recall_at_k(sim, 0)
        with self.assertRaises(ValueError):
            recall_at_k(sim, 5)


class TestVQAExactMatch(unittest.TestCase):
    def test_all_correct(self) -> None:
        em = vqa_exact_match([1, 2, 3], [1, 2, 3])
        self.assertAlmostEqual(em, 1.0)

    def test_half_correct(self) -> None:
        em = vqa_exact_match([1, 2, 3, 4], [1, 0, 3, 0])
        self.assertAlmostEqual(em, 0.5)

    def test_length_mismatch_raises(self) -> None:
        with self.assertRaises(ValueError):
            vqa_exact_match([1], [1, 2])


class TestBLEU(unittest.TestCase):
    def test_exact_match_returns_one(self) -> None:
        gen = [3, 1, 4, 1, 5, 9, 2, 6, 5]
        score = bleu4(gen, [gen], smoothing=True)
        self.assertGreater(score, 0.99)

    def test_disjoint_vocab_returns_zero_without_smoothing(self) -> None:
        gen = [1, 1, 1, 1, 1, 1, 1, 1]
        refs = [[2, 2, 2, 2, 2, 2, 2, 2]]
        score = bleu4(gen, refs, smoothing=False)
        self.assertEqual(score, 0.0)

    def test_disjoint_vocab_smoothed_is_below_match(self) -> None:
        gen = [1, 1, 1, 1, 1, 1, 1, 1]
        refs = [[2, 2, 2, 2, 2, 2, 2, 2]]
        smoothed = bleu4(gen, refs, smoothing=True)
        exact = bleu4(gen, [gen], smoothing=True)
        self.assertLess(smoothed, exact)

    def test_brevity_penalty_applies_when_generated_short(self) -> None:
        gen = [1, 2, 3, 4]
        refs = [[1, 2, 3, 4, 5, 6, 7, 8]]
        score = bleu4(gen, refs, smoothing=True)
        self.assertLess(score, 1.0)


class TestEvalSuite(unittest.TestCase):
    def test_build_shapes(self) -> None:
        suite = build_eval_suite(seed=11, n_samples=8, vocab_size=64, max_len=8)
        self.assertEqual(len(suite.retrieval), 8)
        self.assertEqual(len(suite.vqa), 8)
        self.assertEqual(len(suite.caps), 8)
        for pair in suite.retrieval:
            self.assertEqual(pair.caption_ids.shape, (1, 8))


if __name__ == "__main__":
    unittest.main()
