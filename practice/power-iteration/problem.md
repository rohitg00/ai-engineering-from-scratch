Power iteration finds the top eigenvector of a matrix with only matrix products. Multiply a vector by the matrix again and again, and the vector turns toward the eigenvector with the largest absolute eigenvalue. The SVD lesson uses it on $A^T A$ to find each singular value. PCA uses it to find the first principal component.

## Task

Write two functions.

1. `fix_sign(v)` returns a copy of `v` with a fixed sign. Find the index of the entry with the largest absolute value. In a tie, use the first such index. When that entry is negative, return `-v`. Otherwise return a copy of `v`.
2. `power_iteration(M, v0, num_iters=200, tol=1e-10)` returns `(eigenvalue, vector, iters)` for the eigenvalue of `M` with the largest absolute value.

Do these steps in `power_iteration`.

1. Set $v = v_0 / \|v_0\|$.
2. Repeat for $k = 1, 2, \ldots,$ `num_iters`:
    - Compute $w = M v$.
    - When $\|w\| <$ `tol`, stop and return `(0.0, fix_sign(v), k)`.
    - Set $v_{new} = w / \|w\|$.
    - When $|v_{new} \cdot v| > 1 -$ `tol`, set $v = v_{new}$ and stop.
    - Otherwise set $v = v_{new}$.
3. `iters` is the value of $k$ at the stop. When no stop occurs, `iters` is `num_iters`.
4. The eigenvalue is the Rayleigh quotient $v^T M v$ of the final $v$.
5. Return `(eigenvalue, fix_sign(v), iters)`.

The test uses the absolute value of the dot product. A negative top eigenvalue flips the sign of $v$ at each step, and the test must still stop.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `v` | float array | `(n,)` | the vector for `fix_sign` |
| `M` | float array | `(n, n)` | a symmetric matrix |
| `v0` | float array | `(n,)` | the start vector, not all zero |
| `num_iters` | int | scalar | the largest number of iterations |
| `tol` | float | scalar | the tolerance for the two stop tests |

- `fix_sign` returns a float array of shape `(n,)`.
- `power_iteration` returns a tuple: a Python `float`, a float array of shape `(n,)` with length 1, and an `int`.

## Constraints

- `1 <= n <= 50` and `1 <= num_iters <= 5000`.
- `M` is symmetric. Its top eigenvalue by absolute value has a gap to the next one.
- Do not change the input arrays.
- Use numpy only. Do not call `np.linalg.eig` or `np.linalg.eigh`.

## Examples

```python
fix_sign(np.array([0.1, -0.9, 0.3]))
```

```text
[-0.1  0.9 -0.3]
```

```python
M = np.array([[4.0, 1.0, 0.0], [1.0, 3.0, 1.0], [0.0, 1.0, 2.0]])
power_iteration(M, np.array([0.0, 0.0, -1.0]))
```

```text
(4.732050806909286, array([0.78866387, 0.57736154, 0.21133613]), 26)
```

```python
power_iteration(M, np.array([1.0, 1.0, 1.0]), num_iters=3)
```

```text
(4.71702331523475, array([0.73272722, 0.62549884, 0.26807093]), 3)
```

The start vector in the second example is negative. The sign rule makes the largest entry of the result positive.
