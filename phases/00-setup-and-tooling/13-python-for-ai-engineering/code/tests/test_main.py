"""Tests for the Python for AI engineering toolkit."""

from __future__ import annotations

import math
import os
import statistics
import sys
import tempfile
import unittest
from pathlib import Path

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from main import (
    Record,
    accuracy,
    batches,
    best_time,
    column_stats,
    dot,
    dot_index_loop,
    dot_map,
    fit_centroids,
    format_report,
    load_records,
    make_dataset,
    make_standardizer,
    mean,
    peak_bytes,
    predict,
    run_demo,
    save_records,
    std,
    sum_squares_generator,
    sum_squares_list,
    train_test_split,
)


class LoaderTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_csv_and_json_round_trip_exactly(self) -> None:
        records = make_dataset(30, seed=1)
        for name in ("data.csv", "data.json"):
            with self.subTest(file=name):
                self.assertEqual(load_records(save_records(records, self.dir / name)), records)

    def test_csv_strings_become_floats_and_int_label(self) -> None:
        path = self.dir / "tiny.csv"
        path.write_text("height,weight,label\n1.5,60,1\n1.8,82.5,0\n", encoding="utf-8")
        records = load_records(path)
        self.assertEqual(records[0], Record((1.5, 60.0), 1))
        self.assertIsInstance(records[1].features[1], float)
        self.assertIsInstance(records[1].label, int)

    def test_custom_label_field(self) -> None:
        path = self.dir / "rows.json"
        path.write_text('[{"a": 1, "b": 2, "y": 3}]', encoding="utf-8")
        self.assertEqual(load_records(path, label_field="y"), [Record((1.0, 2.0), 3)])

    def test_missing_label_raises(self) -> None:
        path = self.dir / "rows.json"
        path.write_text('[{"a": 1, "b": 2}]', encoding="utf-8")
        with self.assertRaises(ValueError):
            load_records(path)

    def test_json_rows_are_read_in_the_first_row_order(self) -> None:
        path = self.dir / "rows.json"
        path.write_text('[{"a": 1, "b": 2, "label": 0}, {"b": 4, "label": 1, "a": 3}]', encoding="utf-8")
        self.assertEqual(load_records(path), [Record((1.0, 2.0), 0), Record((3.0, 4.0), 1)])

    def test_missing_or_extra_feature_raises(self) -> None:
        for rows in ('[{"a": 1, "b": 2, "label": 0}, {"a": 3, "label": 1}]',
                     '[{"a": 1, "label": 0}, {"a": 3, "c": 5, "label": 1}]'):
            with self.subTest(rows=rows):
                path = self.dir / "rows.json"
                path.write_text(rows, encoding="utf-8")
                with self.assertRaises(ValueError):
                    load_records(path)

    def test_unknown_suffix_raises(self) -> None:
        with self.assertRaises(ValueError):
            load_records(self.dir / "data.parquet")
        with self.assertRaises(ValueError):
            save_records(make_dataset(2), self.dir / "data.txt")


class SplitTests(unittest.TestCase):
    def test_sizes_and_disjoint_cover(self) -> None:
        items = list(range(100))
        train, test = train_test_split(items, test_fraction=0.25, seed=3)
        self.assertEqual((len(train), len(test)), (75, 25))
        self.assertEqual(set(train) & set(test), set())
        self.assertEqual(sorted(train + test), items)

    def test_both_sides_keep_at_least_one_item(self) -> None:
        self.assertEqual([len(part) for part in train_test_split([1, 2], test_fraction=0.2)], [1, 1])
        self.assertEqual([len(part) for part in train_test_split([1, 2, 3], test_fraction=0.9)], [1, 2])
        with self.assertRaises(ValueError):
            train_test_split([1])

    def test_same_seed_gives_same_split(self) -> None:
        items = list(range(50))
        self.assertEqual(train_test_split(items, seed=11), train_test_split(items, seed=11))

    def test_different_seed_gives_different_split(self) -> None:
        items = list(range(50))
        self.assertNotEqual(train_test_split(items, seed=1), train_test_split(items, seed=2))

    def test_input_is_not_modified(self) -> None:
        items = list(range(20))
        train_test_split(items, seed=5)
        self.assertEqual(items, list(range(20)))

    def test_bad_fraction_raises(self) -> None:
        for fraction in (0.0, 1.0, -0.2, 1.5):
            with self.subTest(fraction=fraction), self.assertRaises(ValueError):
                train_test_split([1, 2, 3], test_fraction=fraction)


class BatchTests(unittest.TestCase):
    def test_last_batch_is_partial(self) -> None:
        self.assertEqual([len(b) for b in batches(range(10), 4)], [4, 4, 2])

    def test_drop_last_removes_partial_batch(self) -> None:
        self.assertEqual(list(batches(range(10), 4, drop_last=True)), [[0, 1, 2, 3], [4, 5, 6, 7]])

    def test_works_on_a_one_pass_generator(self) -> None:
        source = (i * i for i in range(5))
        self.assertEqual(list(batches(source, 2)), [[0, 1], [4, 9], [16]])

    def test_is_lazy(self) -> None:
        pulled = []

        def source():
            for i in range(100):
                pulled.append(i)
                yield i

        first = next(batches(source(), 3))
        self.assertEqual(first, [0, 1, 2])
        self.assertEqual(pulled, [0, 1, 2])

    def test_bad_size_raises_at_call_time(self) -> None:
        with self.assertRaises(ValueError):
            batches([1, 2, 3], 0)


class VectorMathTests(unittest.TestCase):
    def test_dot(self) -> None:
        self.assertEqual(dot([1.0, 2.0, 3.0], [4.0, 5.0, 6.0]), 32.0)

    def test_dot_length_mismatch_raises(self) -> None:
        with self.assertRaises(ValueError):
            dot([1.0, 2.0], [1.0])

    def test_mean_and_std_match_statistics_module(self) -> None:
        values = [2.0, 4.0, 4.0, 4.0, 5.0, 5.0, 7.0, 9.0]
        self.assertAlmostEqual(mean(values), statistics.fmean(values))
        self.assertAlmostEqual(std(values), statistics.pstdev(values))
        self.assertAlmostEqual(std(values), 2.0)

    def test_mean_of_empty_raises(self) -> None:
        with self.assertRaises(ValueError):
            mean([])

    def test_dot_variants_agree(self) -> None:
        a = [0.5, -1.0, 2.0, 3.5]
        b = [1.0, 2.0, -0.5, 4.0]
        self.assertTrue(math.isclose(dot(a, b), dot_index_loop(a, b)))
        self.assertTrue(math.isclose(dot(a, b), dot_map(a, b)))


class StandardizerTests(unittest.TestCase):
    def test_closure_gives_zero_mean_unit_std(self) -> None:
        rows = [(1.0, 100.0), (2.0, 300.0), (3.0, 500.0)]
        standardize = make_standardizer(rows)
        means, stds = column_stats([standardize(r) for r in rows])
        for m, s in zip(means, stds):
            self.assertAlmostEqual(m, 0.0)
            self.assertAlmostEqual(s, 1.0)

    def test_closure_keeps_training_statistics(self) -> None:
        standardize = make_standardizer([(0.0,), (2.0,)])
        self.assertEqual(standardize((4.0,)), [3.0])

    def test_constant_column_does_not_divide_by_zero(self) -> None:
        standardize = make_standardizer([(5.0, 1.0), (5.0, 3.0)])
        self.assertEqual(standardize((5.0, 2.0)), [0.0, 0.0])


class ModelTests(unittest.TestCase):
    def test_batched_centroids_equal_full_pass(self) -> None:
        pairs = [((float(i), float(2 * i)), i % 2) for i in range(11)]
        whole = fit_centroids([pairs])
        batched = fit_centroids(batches(pairs, 3))
        self.assertEqual(whole.keys(), batched.keys())
        for label in whole:
            for w, b in zip(whole[label], batched[label]):
                self.assertAlmostEqual(w, b)

    def test_predict_picks_nearest_centroid(self) -> None:
        centroids = {0: [0.0, 0.0], 1: [10.0, 10.0]}
        self.assertEqual(predict(centroids, [1.0, 2.0]), 0)
        self.assertEqual(predict(centroids, [9.0, 7.0]), 1)
        self.assertEqual(accuracy(centroids, [([1.0, 1.0], 0), ([9.0, 9.0], 0)]), 0.5)


class MeasurementTests(unittest.TestCase):
    def test_best_time_is_positive(self) -> None:
        self.assertGreater(best_time(sum, list(range(1000)), repeat=3), 0.0)

    def test_list_holds_far_more_memory_than_generator(self) -> None:
        self.assertEqual(sum_squares_list(50_000), sum_squares_generator(50_000))
        as_list = peak_bytes(lambda: sum_squares_list(50_000))
        as_generator = peak_bytes(lambda: sum_squares_generator(50_000))
        self.assertGreater(as_list, 50 * as_generator)


class DemoTests(unittest.TestCase):
    def test_demo_summary_and_report(self) -> None:
        summary = run_demo(n=200, seed=3, batch_size=32, vector_size=2_000)
        self.assertTrue(summary["roundtrip_equal"])
        self.assertEqual((summary["n_train"], summary["n_test"]), (160, 40))
        self.assertEqual(summary["overlap"], 0)
        self.assertEqual(summary["batch_sizes"], [32, 32, 32, 32, 32])
        self.assertEqual(summary["scaled_means"], [0.0, 0.0])
        self.assertGreaterEqual(summary["accuracy_scaled"], 0.8)
        report = format_report(summary)
        self.assertIn("records in both: 0", report)
        self.assertIn("zip generator", report)


if __name__ == "__main__":
    unittest.main()
