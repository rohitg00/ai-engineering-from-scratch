## Why the expansion is fast

The loop computes $N \cdot M$ differences of length $D$ in Python. The expansion moves all of that work into one matrix product `A @ B.T`. A matrix product runs in optimized compiled code. For a few hundred points, it is often 100 times faster than the loop.

## The numerical trap

The expansion subtracts two large numbers to get a small one. When $a$ and $b$ are equal and far from the origin, $\|a\|^2 + \|b\|^2$ and $2 a \cdot b$ are both large and almost equal. Rounding error in the last digits can give a result below 0. The square root of that value is NaN, and one NaN can break a whole k-means run. The clip at 0 removes the problem. When you need very exact small distances, compute $a - b$ directly for the near pairs.

## The zero rule

The cosine of a zero vector has no defined value, because its direction is not defined. The lesson returns 0.0 in that case. This rule gives "no similarity" and keeps the matrix finite.

## Where this goes next

The same matrix is the assignment step of k-means and the search step of k-nearest neighbors. Embedding search in the retrieval lessons uses the cosine matrix. When you normalize all the rows first, the cosine matrix is only `A @ B.T`.
