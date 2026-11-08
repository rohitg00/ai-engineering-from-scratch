## Hint 1

`np.max(np.abs(tensor), axis=1, keepdims=True)` gives the largest magnitude of each row with shape `(rows, 1)`. It broadcasts against the matrix.

## Hint 2

Use `np.where(abs_max > 0, abs_max / qmax, 1.0)` so that a zero row never divides 0 by 0.

## Hint 3

In `dequantize`, reshape a 1D scale array to `(rows, 1)` before you multiply. A plain multiply broadcasts it along the columns.

## Hint 4

The outlier rows are only six of 64. With one scale for each row, the other 58 rows get a step set by their own weights, about ten times smaller than the step that the outlier sets.
