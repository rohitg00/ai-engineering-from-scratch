import contextlib
import io
import math
import random
import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import (
    clip_like,
    covariance,
    elo_update,
    fid,
    inverse,
    jacobi_sqrt,
    main,
    make_features,
    matmul,
    mean_vec,
    trace,
)


class EvaluationMetricTests(unittest.TestCase):
    def assertMatrixAlmostEqual(self, actual, expected, places=7):
        self.assertEqual(len(expected), len(actual))
        for actual_row, expected_row in zip(actual, expected):
            self.assertEqual(len(expected_row), len(actual_row))
            for actual_value, expected_value in zip(actual_row, expected_row):
                self.assertAlmostEqual(expected_value, actual_value, places=places)

    def test_mean_and_sample_covariance_capture_feature_statistics(self):
        features = [[1.0, 2.0], [3.0, 6.0], [5.0, 10.0]]

        mean = mean_vec(features)
        sample_covariance = covariance(features, mean)

        self.assertEqual([3.0, 6.0], mean)
        self.assertEqual([[4.0, 8.0], [8.0, 16.0]], sample_covariance)

    def test_matrix_helpers_invert_a_matrix_that_requires_a_pivot_swap(self):
        matrix = [[0.0, 2.0], [1.0, 3.0]]

        product = matmul(matrix, inverse(matrix))

        self.assertMatrixAlmostEqual(product, [[1.0, 0.0], [0.0, 1.0]])
        self.assertAlmostEqual(3.0, trace([[1.0, 4.0], [-2.0, 2.0]]))

    def test_matrix_square_root_recovers_a_positive_diagonal_matrix(self):
        matrix = [[4.0, 0.0], [0.0, 9.0]]

        root = jacobi_sqrt(matrix)

        self.assertMatrixAlmostEqual(root, [[2.0, 0.0], [0.0, 3.0]])
        self.assertMatrixAlmostEqual(matmul(root, root), matrix)

    def test_fid_is_zero_for_identical_features(self):
        features = [
            [-1.0, -1.0],
            [-1.0, 1.0],
            [1.0, -1.0],
            [1.0, 1.0],
        ]

        self.assertAlmostEqual(0.0, fid(features, features), places=7)

    def test_fid_measures_a_pure_mean_shift_when_covariances_match(self):
        real = [
            [-1.0, -1.0],
            [-1.0, 1.0],
            [1.0, -1.0],
            [1.0, 1.0],
        ]
        generated = [[x + 2.0, y - 3.0] for x, y in real]

        self.assertAlmostEqual(13.0, fid(real, generated), places=7)

    def test_fid_is_zero_for_identical_constant_singletons(self):
        self.assertEqual(0.0, fid([[0.0]], [[0.0]]))

    def test_fid_handles_singular_low_rank_covariances(self):
        real = [[-1.0, -2.0], [0.0, 0.0], [1.0, 2.0]]
        shifted = [[x + 3.0, y - 1.0] for x, y in real]
        orthogonal = [[0.0, -1.0], [0.0, 0.0], [0.0, 1.0]]
        horizontal = [[-1.0, 0.0], [0.0, 0.0], [1.0, 0.0]]

        self.assertEqual(0.0, fid(real, real))
        self.assertAlmostEqual(10.0, fid(real, shifted), places=7)
        self.assertAlmostEqual(2.0, fid(horizontal, orthogonal), places=7)
        self.assertGreaterEqual(fid(horizontal, orthogonal), 0.0)

    def test_clip_like_reports_aligned_orthogonal_and_opposed_vectors(self):
        anchor = [3.0, 4.0]

        self.assertAlmostEqual(1.0, clip_like(anchor, [6.0, 8.0]))
        self.assertAlmostEqual(0.0, clip_like(anchor, [-4.0, 3.0]))
        self.assertAlmostEqual(-1.0, clip_like(anchor, [-3.0, -4.0]))
        self.assertEqual(0.0, clip_like(anchor, [0.0, 0.0]))

    def test_clip_like_rejects_empty_or_mismatched_embeddings(self):
        for image, text in (([], []), ([1.0], [1.0, 2.0])):
            with self.subTest(image=image, text=text):
                with self.assertRaises(ValueError):
                    clip_like(image, text)

    def test_clip_like_rejects_nonfinite_embeddings(self):
        for image, text in (([math.nan], [1.0]), ([1.0], [math.inf])):
            with self.subTest(image=image, text=text):
                with self.assertRaises(ValueError):
                    clip_like(image, text)

    def test_elo_update_moves_equal_ratings_by_half_k_and_conserves_points(self):
        rating_a, rating_b = elo_update(1000.0, 1000.0, "a", k=32)

        self.assertEqual((1016.0, 984.0), (rating_a, rating_b))
        self.assertEqual(2000.0, rating_a + rating_b)

    def test_seeded_feature_generation_is_reproducible(self):
        first = make_features(0.25, 4, 3, random.Random(29), scale=0.4)
        second = make_features(0.25, 4, 3, random.Random(29), scale=0.4)

        self.assertEqual(first, second)
        constant_features = make_features(
            0.25, 1, 2, random.Random(1), scale=0.0
        )
        self.assertEqual([[0.25, 0.25]], constant_features)

    def test_demo_is_deterministic_and_reaches_the_takeaway(self):
        first_output = io.StringIO()
        second_output = io.StringIO()

        with contextlib.redirect_stdout(first_output):
            main()
        with contextlib.redirect_stdout(second_output):
            main()

        self.assertEqual(first_output.getvalue(), second_output.getvalue())
        self.assertIn("N=   50: FID", first_output.getvalue())
        self.assertIn("after 200 pairs", first_output.getvalue())
        self.assertTrue(
            first_output.getvalue().rstrip().endswith("qualitative failure audits.")
        )


if __name__ == "__main__":
    unittest.main()
