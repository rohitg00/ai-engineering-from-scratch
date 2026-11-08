## Hint 1

Compute the squared norm of each row first. For `A` this is a vector of shape `(N,)`. For `B` it is a vector of shape `(M,)`.

## Hint 2

Reshape the two norm vectors to `(N, 1)` and `(1, M)`. Their sum broadcasts to `(N, M)`. The matrix `A @ B.T` has shape `(N, M)` and holds every dot product $a_i \cdot b_j$.

## Hint 3

Rounding error can make a squared distance such as `-1e-7`. The square root of a negative number is NaN. Use `np.maximum(sq, 0.0)` before `np.sqrt`.

## Hint 4

For cosine, divide the dot products by the outer product of the row norms. Where that product is 0, return 0. Replace the zero denominators with 1 before the division, then put 0 in those places with `np.where`.
