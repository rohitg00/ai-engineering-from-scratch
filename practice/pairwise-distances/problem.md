Nearest neighbor search, k-means and kernel methods need the distance from every point in one set to every point in another set. A double loop over the pairs is slow in Python. One matrix product computes all the cross terms at the same time. Cosine similarity gives the same kind of matrix for the angle between vectors.

## Task

Write three functions.

1. `pairwise_sq_distances(A, B)` returns the matrix of squared Euclidean distances. Entry $(i, j)$ is $\|a_i - b_j\|^2$.
2. `pairwise_distances(A, B)` returns the matrix of Euclidean distances $\|a_i - b_j\|$.
3. `cosine_similarity_matrix(A, B)` returns the matrix of cosine similarities. Entry $(i, j)$ is $a_i \cdot b_j / (\|a_i\| \|b_j\|)$.

Use the expansion $\|a - b\|^2 = \|a\|^2 + \|b\|^2 - 2 a \cdot b$. Compute all the dot products with one matrix product. Do not loop over the pairs.

Rounding can make the expansion a small negative number when two points are equal or very near. Clip each squared distance at 0. Then take the square root.

The zero rule: when $a_i$ or $b_j$ is the zero vector, entry $(i, j)$ of the cosine matrix is `0.0`.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `A` | float array | `(N, D)` | `N` points, one in each row |
| `B` | float array | `(M, D)` | `M` points with the same dimension `D` |

- `pairwise_sq_distances` returns a float array of shape `(N, M)`. Every value is 0 or more.
- `pairwise_distances` returns a float array of shape `(N, M)`.
- `cosine_similarity_matrix` returns a float array of shape `(N, M)`. Every value is from -1 to 1.

## Constraints

- `1 <= N, M <= 500` and `1 <= D <= 512`.
- Rows can be zero vectors. Values can be as large as `1e5`.
- Do not change the input arrays.
- Use numpy only.

## Examples

```python
A = np.array([[0.0, 0.0], [3.0, 4.0]])
B = np.array([[3.0, 0.0], [0.0, 4.0], [3.0, 4.0]])
pairwise_sq_distances(A, B)
```

```text
[[ 9. 16. 25.]
 [16.  9.  0.]]
```

```python
pairwise_distances(A, B)
```

```text
[[3. 4. 5.]
 [4. 3. 0.]]
```

```python
cosine_similarity_matrix(A, B)
```

```text
[[0.  0.  0. ]
 [0.6 0.8 1. ]]
```

The first row of `A` is the zero vector, so its row of similarities is all 0.
