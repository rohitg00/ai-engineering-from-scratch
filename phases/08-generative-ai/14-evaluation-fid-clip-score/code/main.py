# Educational implementation for ../docs/en.md.
# Builds FID, cosine similarity, and Elo updates from Python's standard library.
# FID follows Heusel et al. (2017), https://arxiv.org/abs/1706.08500.
# CLIP-style scoring follows Radford et al. (2021), https://arxiv.org/abs/2103.00020.
# The seeded demo is deterministic and terminates without external services.

import math
import random


def mean_vec(vectors):
    d = len(vectors[0])
    n = len(vectors)
    return [sum(v[i] for v in vectors) / n for i in range(d)]


def covariance(vectors, mu):
    d = len(mu)
    n = len(vectors)
    cov = [[0.0] * d for _ in range(d)]
    for v in vectors:
        for i in range(d):
            for j in range(d):
                cov[i][j] += (v[i] - mu[i]) * (v[j] - mu[j])
    return [[cov[i][j] / max(n - 1, 1) for j in range(d)] for i in range(d)]


def trace(M):
    return sum(M[i][i] for i in range(len(M)))


def matmul(A, B):
    n = len(A)
    p = len(B[0])
    m = len(B)
    out = [[0.0] * p for _ in range(n)]
    for i in range(n):
        for k in range(m):
            for j in range(p):
                out[i][j] += A[i][k] * B[k][j]
    return out


def symmetric_eigendecomposition(M, tolerance=1e-12, max_sweeps=50):
    """Return eigenvalues and column eigenvectors for a symmetric matrix."""
    n = len(M)
    if n == 0 or any(len(row) != n for row in M):
        raise ValueError("matrix must be non-empty and square")
    if any(not math.isfinite(value) for row in M for value in row):
        raise ValueError("matrix entries must be finite")

    scale = max(1.0, max(abs(value) for row in M for value in row))
    for i in range(n):
        for j in range(i + 1, n):
            if abs(M[i][j] - M[j][i]) > tolerance * scale:
                raise ValueError("matrix must be symmetric")

    A = [[(M[i][j] + M[j][i]) / 2.0 for j in range(n)] for i in range(n)]
    vectors = [[1.0 if i == j else 0.0 for j in range(n)] for i in range(n)]

    for _ in range(max_sweeps):
        largest = max(
            (abs(A[i][j]) for i in range(n) for j in range(i + 1, n)),
            default=0.0,
        )
        diagonal_scale = max(1.0, max(abs(A[i][i]) for i in range(n)))
        if largest <= tolerance * diagonal_scale:
            break

        for p in range(n - 1):
            for q in range(p + 1, n):
                if abs(A[p][q]) <= tolerance * diagonal_scale:
                    continue
                angle = 0.5 * math.atan2(2.0 * A[p][q], A[p][p] - A[q][q])
                cosine = math.cos(angle)
                sine = math.sin(angle)
                a_pp = A[p][p]
                a_qq = A[q][q]
                a_pq = A[p][q]

                A[p][p] = (
                    cosine * cosine * a_pp
                    + 2.0 * cosine * sine * a_pq
                    + sine * sine * a_qq
                )
                A[q][q] = (
                    sine * sine * a_pp
                    - 2.0 * cosine * sine * a_pq
                    + cosine * cosine * a_qq
                )
                A[p][q] = A[q][p] = 0.0

                for k in range(n):
                    if k in (p, q):
                        continue
                    a_kp = A[k][p]
                    a_kq = A[k][q]
                    A[k][p] = A[p][k] = cosine * a_kp + sine * a_kq
                    A[k][q] = A[q][k] = -sine * a_kp + cosine * a_kq

                for k in range(n):
                    v_kp = vectors[k][p]
                    v_kq = vectors[k][q]
                    vectors[k][p] = cosine * v_kp + sine * v_kq
                    vectors[k][q] = -sine * v_kp + cosine * v_kq
    else:
        raise ArithmeticError("Jacobi eigendecomposition did not converge")

    return [A[i][i] for i in range(n)], vectors


def jacobi_sqrt(M, iters=50):
    """Principal square root of a symmetric PSD matrix via Jacobi rotations."""
    eigenvalues, vectors = symmetric_eigendecomposition(M, max_sweeps=iters)
    spectral_scale = max(1.0, max(abs(value) for value in eigenvalues))
    if any(value < -1e-12 * spectral_scale for value in eigenvalues):
        raise ValueError("matrix must be positive semidefinite")
    roots = [math.sqrt(max(value, 0.0)) for value in eigenvalues]
    n = len(M)
    return [
        [sum(vectors[i][k] * roots[k] * vectors[j][k] for k in range(n)) for j in range(n)]
        for i in range(n)
    ]


def inverse(M):
    n = len(M)
    A = [row[:] + [1.0 if i == j else 0.0 for j in range(n)] for i, row in enumerate(M)]
    for col in range(n):
        pivot = col
        for r in range(col + 1, n):
            if abs(A[r][col]) > abs(A[pivot][col]):
                pivot = r
        A[col], A[pivot] = A[pivot], A[col]
        piv = A[col][col]
        if abs(piv) < 1e-12:
            piv = 1e-12
        for j in range(2 * n):
            A[col][j] /= piv
        for r in range(n):
            if r == col: continue
            factor = A[r][col]
            for j in range(2 * n):
                A[r][j] -= factor * A[col][j]
    return [row[n:] for row in A]


def fid(real_features, gen_features):
    _validate_feature_sets(real_features, gen_features)
    mu_r = mean_vec(real_features)
    mu_g = mean_vec(gen_features)
    cov_r = covariance(real_features, mu_r)
    cov_g = covariance(gen_features, mu_g)
    mean_sq = sum((a - b) ** 2 for a, b in zip(mu_r, mu_g))
    sqrt_cov_r = jacobi_sqrt(cov_r)
    covariance_sandwich = matmul(matmul(sqrt_cov_r, cov_g), sqrt_cov_r)
    sqrt_sandwich = jacobi_sqrt(covariance_sandwich)
    score = mean_sq + trace(cov_r) + trace(cov_g) - 2 * trace(sqrt_sandwich)
    return max(score, 0.0)


def _validate_feature_sets(real_features, gen_features):
    if not real_features or not gen_features:
        raise ValueError("feature sets must be non-empty")
    dimension = len(real_features[0])
    if dimension == 0:
        raise ValueError("feature vectors must be non-empty")
    for features in (real_features, gen_features):
        if any(len(vector) != dimension for vector in features):
            raise ValueError("all feature vectors must have the same dimension")
        if any(not math.isfinite(value) for vector in features for value in vector):
            raise ValueError("feature values must be finite")


def clip_like(a, b):
    if not a or not b:
        raise ValueError("embeddings must be non-empty")
    if len(a) != len(b):
        raise ValueError("embeddings must have the same dimension")
    if any(not math.isfinite(value) for embedding in (a, b) for value in embedding):
        raise ValueError("embedding values must be finite")
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / max(na * nb, 1e-8)


def elo_update(r_a, r_b, winner, k=32):
    expected_a = 1 / (1 + 10 ** ((r_b - r_a) / 400))
    actual_a = 1.0 if winner == "a" else 0.0
    delta = k * (actual_a - expected_a)
    return r_a + delta, r_b - delta


def make_features(center, n, d, rng, scale=0.4):
    return [[center + rng.gauss(0, scale) for _ in range(d)] for _ in range(n)]


def main():
    rng = random.Random(29)
    d = 4

    print("=== FID bias at small N ===")
    for n in [50, 200, 1000]:
        real = make_features(0.0, n, d, rng)
        gen = make_features(0.0, n, d, rng)  # same distribution
        score = fid(real, gen)
        print(f"  N={n:5d}: FID (identical distributions) = {score:.4f}  (lower = more similar)")

    print("  -> FID should be 0 for identical distributions but is biased up at small N")
    print()

    print("=== FID separates different distributions ===")
    real = make_features(0.0, 500, d, rng)
    for shift in [0.0, 0.2, 0.5, 1.0]:
        gen = make_features(shift, 500, d, rng)
        score = fid(real, gen)
        print(f"  shift={shift:.1f}: FID = {score:.3f}")

    print()
    print("=== CLIP-like cosine similarity ===")
    prompt = [1.0, 0.5, -0.2, 0.3]
    for image_center in [1.0, 0.5, 0.0, -0.5]:
        image = [image_center + rng.gauss(0, 0.1) for _ in range(d)]
        score = clip_like(image, prompt)
        print(f"  image center {image_center:+.1f}: CLIP-like score = {score:+.3f}")

    print()
    print("=== Elo from synthetic A/B preferences ===")
    r_a, r_b = 1000, 1000
    for i in range(200):
        # Suppose model A wins 70% of the time
        winner = "a" if rng.random() < 0.7 else "b"
        r_a, r_b = elo_update(r_a, r_b, winner)
    print(f"  after 200 pairs (A wins 70%): r_A = {r_a:.0f}, r_B = {r_b:.0f}")

    print()
    print("takeaway: FID is a distance; CLIP is an adherence score; Elo aggregates preferences.")
    print("          production evaluation uses all three plus qualitative failure audits.")


if __name__ == "__main__":
    main()
