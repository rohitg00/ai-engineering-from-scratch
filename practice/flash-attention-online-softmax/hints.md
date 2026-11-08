## Hint 1

Write the step first and test it by hand. Start each row with $m = -\infty$, $l = 0$ and an accumulator of zeros.

## Hint 2

The old sum and the old accumulator were computed relative to the old max. When the max grows, multiply both by $e^{m - m'}$ to move them to the new max. Forget this factor on one of them and the output is wrong.

## Hint 3

`np.exp(-np.inf)` is exactly 0, but `-np.inf - (-np.inf)` is NaN. Use `np.where(np.isneginf(m_new), 0.0, m_new)` as the max inside the exponentials.

## Hint 4

Loop with `range(0, Tk, block_size)` and slice `K[start:stop]` with `stop = min(start + block_size, Tk)`. For the causal mask, compare `np.arange(start, stop)` with the query indices `np.arange(Tq)`.
