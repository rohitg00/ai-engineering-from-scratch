"""Tests for SlidingWindowDataset and make_dataloader."""

from __future__ import annotations

import os
import sys
import unittest

import torch

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (  # noqa: E402
    MiniBPE,
    SlidingWindowDataset,
    _encode_corpus_to_ids,
    make_dataloader,
)


SMALL_CORPUS = (
    "the quick brown fox jumps over the lazy dog\n"
    "the brown fox runs across the meadow at dawn\n"
    "small daily actions compound into large outcomes\n"
) * 30


def _build_ids(target_vocab: int = 300) -> list[int]:
    tokenizer = MiniBPE()
    return _encode_corpus_to_ids(tokenizer, SMALL_CORPUS, target_vocab)


class TestCountWindows(unittest.TestCase):
    def test_count_with_stride_equal_to_context(self) -> None:
        n = SlidingWindowDataset.count_windows(num_ids=33, context_length=8, stride=8)
        self.assertEqual(n, 1 + (33 - 9) // 8)

    def test_count_with_half_stride_doubles(self) -> None:
        a = SlidingWindowDataset.count_windows(num_ids=200, context_length=16, stride=16)
        b = SlidingWindowDataset.count_windows(num_ids=200, context_length=16, stride=8)
        self.assertGreater(b, a)

    def test_count_zero_when_corpus_too_short(self) -> None:
        n = SlidingWindowDataset.count_windows(num_ids=4, context_length=16, stride=16)
        self.assertEqual(n, 0)

    def test_count_one_when_exact_fit(self) -> None:
        n = SlidingWindowDataset.count_windows(num_ids=9, context_length=8, stride=8)
        self.assertEqual(n, 1)


class TestDatasetShape(unittest.TestCase):
    def setUp(self) -> None:
        self.ids = _build_ids()
        self.context_length = 12
        self.stride = 6
        self.dataset = SlidingWindowDataset(
            self.ids, context_length=self.context_length, stride=self.stride
        )

    def test_len_matches_count_windows(self) -> None:
        expected = SlidingWindowDataset.count_windows(
            len(self.ids), self.context_length, self.stride
        )
        self.assertEqual(len(self.dataset), expected)

    def test_getitem_returns_long_tensors_of_T(self) -> None:
        inputs, targets = self.dataset[0]
        self.assertEqual(inputs.dtype, torch.long)
        self.assertEqual(targets.dtype, torch.long)
        self.assertEqual(inputs.shape, (self.context_length,))
        self.assertEqual(targets.shape, (self.context_length,))

    def test_target_is_input_shifted_by_one(self) -> None:
        inputs, targets = self.dataset[3]
        self.assertTrue(torch.equal(inputs[1:], targets[:-1]))

    def test_window_endpoints_match_id_stream(self) -> None:
        inputs, _ = self.dataset[2]
        start = 2 * self.stride
        expected = torch.tensor(self.ids[start : start + self.context_length], dtype=torch.long)
        self.assertTrue(torch.equal(inputs, expected))

    def test_negative_index_supported(self) -> None:
        last_pos = self.dataset[-1]
        last_explicit = self.dataset[len(self.dataset) - 1]
        self.assertTrue(torch.equal(last_pos[0], last_explicit[0]))
        self.assertTrue(torch.equal(last_pos[1], last_explicit[1]))

    def test_out_of_range_raises(self) -> None:
        with self.assertRaises(IndexError):
            _ = self.dataset[len(self.dataset)]


class TestDatasetGuards(unittest.TestCase):
    def test_zero_context_length_rejected(self) -> None:
        with self.assertRaises(ValueError):
            SlidingWindowDataset([1, 2, 3, 4, 5], context_length=0)

    def test_zero_stride_rejected(self) -> None:
        with self.assertRaises(ValueError):
            SlidingWindowDataset([1, 2, 3, 4, 5], context_length=2, stride=0)

    def test_empty_ids_rejected(self) -> None:
        with self.assertRaises(ValueError):
            SlidingWindowDataset([], context_length=4)


class TestDataLoaderDeterminism(unittest.TestCase):
    def setUp(self) -> None:
        ids = _build_ids()
        self.dataset = SlidingWindowDataset(ids, context_length=8, stride=4)

    def test_same_seed_same_first_batch(self) -> None:
        loader_a = make_dataloader(self.dataset, batch_size=4, base_seed=42, epoch=0)
        loader_b = make_dataloader(self.dataset, batch_size=4, base_seed=42, epoch=0)
        inputs_a, _ = next(iter(loader_a))
        inputs_b, _ = next(iter(loader_b))
        self.assertTrue(torch.equal(inputs_a, inputs_b))

    def test_different_epoch_changes_order(self) -> None:
        loader_a = make_dataloader(self.dataset, batch_size=4, base_seed=42, epoch=0)
        loader_b = make_dataloader(self.dataset, batch_size=4, base_seed=42, epoch=1)
        inputs_a, _ = next(iter(loader_a))
        inputs_b, _ = next(iter(loader_b))
        self.assertFalse(torch.equal(inputs_a, inputs_b))

    def test_no_shuffle_preserves_index_order(self) -> None:
        loader = make_dataloader(
            self.dataset, batch_size=4, shuffle=False, base_seed=0, epoch=0
        )
        inputs, _ = next(iter(loader))
        expected_first = self.dataset[0][0]
        self.assertTrue(torch.equal(inputs[0], expected_first))


class TestBatchShape(unittest.TestCase):
    def test_batch_shape_matches_contract(self) -> None:
        ids = _build_ids()
        ds = SlidingWindowDataset(ids, context_length=16, stride=16)
        loader = make_dataloader(ds, batch_size=3, base_seed=0, epoch=0)
        inputs, targets = next(iter(loader))
        self.assertEqual(inputs.shape, (3, 16))
        self.assertEqual(targets.shape, (3, 16))
        self.assertTrue(torch.equal(inputs[:, 1:], targets[:, :-1]))


if __name__ == "__main__":
    unittest.main()
