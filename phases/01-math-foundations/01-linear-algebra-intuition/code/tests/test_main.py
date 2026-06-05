"""Tests for linear algebra from scratch (Phase 01, Lesson 01).

Run from repo root:
    python -m pytest phases/01-math-foundations/01-linear-algebra-intuition/code/tests/
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import vectors


class TestVector:
    def test_add(self) -> None:
        v = vectors.Vector([1, 2, 3]) + vectors.Vector([4, 5, 6])
        assert v.components == [5, 7, 9]

    def test_sub(self) -> None:
        v = vectors.Vector([5, 7, 9]) - vectors.Vector([1, 2, 3])
        for a, b in zip(v.components, [4.0, 5.0, 6.0]):
            assert abs(a - b) < 1e-10

    def test_scalar_mul(self) -> None:
        v = vectors.Vector([1, 2, 3]) * 3
        assert v.components == [3, 6, 9]

    def test_dot_product(self) -> None:
        result = vectors.Vector([1, 0, 0]).dot(vectors.Vector([0, 1, 0]))
        assert result == 0
        result = vectors.Vector([1, 2, 3]).dot(vectors.Vector([4, 5, 6]))
        assert result == 32  # 1*4 + 2*5 + 3*6

    def test_magnitude(self) -> None:
        assert vectors.Vector([3, 4]).magnitude() == 5.0
        assert vectors.Vector([1, 0, 0]).magnitude() == 1.0

    def test_normalize(self) -> None:
        n = vectors.Vector([3, 4]).normalize()
        assert abs(n.magnitude() - 1.0) < 1e-10
        assert abs(n.components[0] - 0.6) < 1e-10
        assert abs(n.components[1] - 0.8) < 1e-10

    def test_cosine_similarity_identical(self) -> None:
        v = vectors.Vector([1, 2, 3])
        assert abs(v.cosine_similarity(v) - 1.0) < 1e-10

    def test_cosine_similarity_orthogonal(self) -> None:
        sim = vectors.Vector([1, 0]).cosine_similarity(vectors.Vector([0, 1]))
        assert abs(sim - 0.0) < 1e-10

    def test_cosine_similarity_opposite(self) -> None:
        sim = vectors.Vector([1, 0]).cosine_similarity(vectors.Vector([-1, 0]))
        assert abs(sim + 1.0) < 1e-10

    def test_angle_between(self) -> None:
        angle = vectors.Vector([1, 0]).angle_between(vectors.Vector([0, 1]))
        assert abs(angle - 90.0) < 1e-10

    def test_project_onto(self) -> None:
        proj = vectors.Vector([3, 0]).project_onto(vectors.Vector([1, 0]))
        assert abs(proj.components[0] - 3.0) < 1e-10
        assert abs(proj.components[1] - 0.0) < 1e-10

    def test_repr(self) -> None:
        assert repr(vectors.Vector([1.0, 2.0])) == "Vector([1.0, 2.0])"


class TestMatrix:
    def test_shape(self) -> None:
        m = vectors.Matrix([[1, 2], [3, 4], [5, 6]])
        assert m.shape == (3, 2)

    def test_matmul_vector(self) -> None:
        m = vectors.Matrix([[1, 0], [0, 1]])
        v = vectors.Vector([3, 4])
        result = m @ v
        assert result.components == [3, 4]

    def test_matmul_matrix(self) -> None:
        a = vectors.Matrix([[1, 2], [3, 4]])
        b = vectors.Matrix([[5, 6], [7, 8]])
        c = a @ b
        assert c.shape == (2, 2)
        # [[1*5+2*7, 1*6+2*8], [3*5+4*7, 3*6+4*8]]
        assert c.rows == [[19, 22], [43, 50]]

    def test_transpose(self) -> None:
        m = vectors.Matrix([[1, 2, 3], [4, 5, 6]])
        t = m.transpose()
        assert t.shape == (3, 2)
        assert t.rows == [[1, 4], [2, 5], [3, 6]]

    def test_rank_full(self) -> None:
        m = vectors.Matrix([[1, 0], [0, 1]])
        assert m.rank() == 2

    def test_rank_deficient(self) -> None:
        m = vectors.Matrix([[1, 2], [2, 4]])
        assert m.rank() == 1

    def test_rank_zero(self) -> None:
        m = vectors.Matrix([[0, 0], [0, 0]])
        assert m.rank() == 0


class TestIsIndependent:
    def test_independent(self) -> None:
        v1 = vectors.Vector([1, 0])
        v2 = vectors.Vector([0, 1])
        assert vectors.is_independent([v1, v2]) is True

    def test_dependent(self) -> None:
        v1 = vectors.Vector([1, 2])
        v2 = vectors.Vector([2, 4])
        assert vectors.is_independent([v1, v2]) is False

    def test_empty(self) -> None:
        assert vectors.is_independent([]) is True

    def test_single(self) -> None:
        assert vectors.is_independent([vectors.Vector([1, 2])]) is True


class TestGramSchmidt:
    def test_two_vectors(self) -> None:
        v1 = vectors.Vector([1, 0])
        v2 = vectors.Vector([1, 1])
        result = vectors.gram_schmidt([v1, v2])
        assert len(result) == 2
        # First should be normalized v1
        assert abs(result[0].components[0] - 1.0) < 1e-10
        assert abs(result[0].components[1] - 0.0) < 1e-10
        # Both should be unit length
        for v in result:
            assert abs(v.magnitude() - 1.0) < 1e-10
        # Should be orthogonal
        assert abs(result[0].dot(result[1])) < 1e-10

    def test_already_orthonormal(self) -> None:
        v1 = vectors.Vector([1, 0, 0])
        v2 = vectors.Vector([0, 1, 0])
        result = vectors.gram_schmidt([v1, v2])
        assert len(result) == 2
        assert abs(result[0].dot(result[1])) < 1e-10

    def test_dependent_dropped(self) -> None:
        v1 = vectors.Vector([1, 0])
        v2 = vectors.Vector([2, 0])  # collinear with v1
        result = vectors.gram_schmidt([v1, v2])
        assert len(result) == 1
