---
name: skill-svd
description: Apply SVD to real problems including compression, denoising, recommendations, and least-squares solving
phase: 1
lesson: 11
---

You are an expert at applying Singular Value Decomposition to practical engineering problems. When given a task involving matrices, data compression, noise, missing data, or linear systems, determine whether SVD is the right tool and how to apply it.

## Decision Framework

### Step 1: Identify the problem type

- **Data compression / dimensionality reduction**: Use truncated SVD. Keep top k singular values. Choose k by energy threshold (95% is a common target) or by downstream task performance.
- **Noise reduction**: Compute full SVD. Look for a gap in the singular value spectrum. Truncate below the gap. The gap separates signal from noise.
- **Missing data / recommendations**: Fill missing entries (row means or zeros), compute SVD, reconstruct with low rank. In production, use ALS or incremental SVD that handle missing data natively.
- **Least-squares / pseudoinverse**: Compute SVD. Invert non-zero singular values. Multiply V Sigma+ U^T by the target vector. More stable than normal equations.
- **Text similarity / topic modeling**: Build term-document matrix. Apply SVD (this is LSA/LSI). Project documents and terms into the low-rank space. Use cosine similarity for comparisons.
- **Numerical rank determination**: Compute SVD. Count singular values above a threshold (relative to the largest). This is more reliable than row reduction.
- **Matrix norm computation**: Spectral norm = largest singular value. Frobenius norm = sqrt(sum of squared singular values). Nuclear norm = sum of singular values.
- **Condition number**: sigma_max / sigma_min. Tells you how sensitive the system is to perturbations.

### Step 2: Choose the right variant

| Situation | Method | Why |
|-----------|--------|-----|
| Dense matrix, full decomposition needed | `np.linalg.svd(A)` / `svd(A)` in Julia | Standard algorithm, numerically stable |
| Only top k components needed | `scipy.sparse.linalg.svds(A, k)` | Faster than full SVD when k is small |
| Sparse matrix | `scipy.sparse.linalg.svds` | Handles sparse storage efficiently |
| Streaming data | Incremental SVD / online SVD | Updates decomposition without recomputing from scratch |
| Missing data (recommendations) | ALS, Funk SVD, or NMF | Standard SVD requires a complete matrix |
| Very large matrix (millions of rows) | Randomized SVD (`sklearn.utils.extmath.randomized_svd`) | O(mn log k) instead of O(mn min(m,n)) |
| PCA on centered data | SVD of centered data matrix | Equivalent to eigendecomposition of covariance, but more stable |

### Step 3: Choose the rank k

- **Energy threshold**: Compute cumulative energy = sum(sigma_1^2 ... sigma_k^2) / sum(all sigma^2). Stop when energy exceeds 0.95 (or 0.99 for high-fidelity tasks).
- **Gap detection**: Plot singular values. Look for a sharp drop. The gap indicates the boundary between signal and noise.
- **Cross-validation**: For downstream tasks, sweep k and measure performance on held-out data.
- **Elbow method**: Plot reconstruction error vs k. The elbow is where adding more components stops helping.
- **Domain knowledge**: If you know the data has d underlying factors, use k = d.

### Step 4: Validate results

- **Reconstruction error**: Compute ||A - A_k|| / ||A||. Should be small if the truncation is meaningful.
- **Explained variance**: For PCA/compression, report the fraction of total variance (energy) captured.
- **Downstream task performance**: If SVD is a preprocessing step, measure the end-to-end metric.
- **Visual inspection**: For images, compare original and reconstructed visually. For recommendations, check predictions against known ratings.

## Common Mistakes

- Computing SVD via eigendecomposition of A^T A. This squares the condition number and loses numerical precision. Use a dedicated SVD routine.
- Using full SVD when only the top k components are needed. For large matrices, use truncated or randomized SVD.
- Applying SVD directly to a matrix with missing entries. Standard SVD requires a complete matrix. Use matrix completion methods (ALS, Funk SVD) instead.
- Ignoring centering. For PCA, the data must be centered (mean subtracted) before SVD. Without centering, the first component captures the mean, not the variance.
- Over-truncating. If you keep too few singular values, you lose signal. If you keep too many, you keep noise. Use energy thresholds or cross-validation.
- Confusing SVD with eigendecomposition. SVD works on any matrix (any shape, any rank). Eigendecomposition requires a square matrix with a full set of eigenvectors. For symmetric positive semi-definite matrices they are the same.

## Code Patterns

### Quick compression
```python
U, S, Vt = np.linalg.svd(A, full_matrices=False)
k = np.searchsorted(np.cumsum(S**2) / np.sum(S**2), 0.95) + 1
A_compressed = U[:, :k] @ np.diag(S[:k]) @ Vt[:k, :]
```

### Pseudoinverse for least squares
```python
U, S, Vt = np.linalg.svd(A, full_matrices=False)
S_inv = np.array([1/s if s > 1e-10 else 0 for s in S])
x = Vt.T @ np.diag(S_inv) @ U.T @ b
```

### Denoising
```python
U, S, Vt = np.linalg.svd(noisy_data, full_matrices=False)
k = find_gap(S)
clean_data = U[:, :k] @ np.diag(S[:k]) @ Vt[:k, :]
```

### Large-scale PCA
```python
from sklearn.utils.extmath import randomized_svd
U, S, Vt = randomized_svd(X_centered, n_components=50, random_state=42)
explained_variance = S**2 / (n_samples - 1)
```

## When NOT to use SVD

- The matrix is very sparse and you only need a few components. Use sparse eigensolvers directly.
- You need non-negative factors (topic modeling, spectral unmixing). Use NMF instead.
- The data has strong non-linear structure that linear methods cannot capture. Use autoencoders or manifold learning.
- You need real-time updates on streaming data and the matrix changes constantly. Use incremental/online SVD or approximate methods.
- The matrix fits in memory but is so large that even randomized SVD is too slow. Consider sketching methods or sampling-based approaches.

## Computational Cost

| Method | Time | Space |
|--------|------|-------|
| Full SVD of m x n matrix | O(mn min(m,n)) | O(mn) |
| Truncated SVD (top k) | O(mnk) | O((m+n)k) |
| Randomized SVD (top k) | O(mn log k) | O((m+n)k) |
| Power iteration (1 vector) | O(mn * iters) | O(m+n) |

For a 10000 x 5000 matrix:
- Full SVD: ~250 billion operations
- Truncated SVD (k=50): ~2.5 billion operations
- Randomized SVD (k=50): ~500 million operations

Choose the method that matches your scale and accuracy requirements.
