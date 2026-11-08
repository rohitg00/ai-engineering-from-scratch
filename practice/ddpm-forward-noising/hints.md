## Hint 1

`np.arange(T) / (T - 1)` goes from 0 to 1 in equal steps. Scale and shift it to get the betas. `np.cumprod` gives the running product for $\bar{\alpha}$.

## Hint 2

For an int `t`, `alpha_bars[t]` is a scalar and broadcasts over any shape. For an array `t`, `alpha_bars[t]` has shape `(B,)`. Reshape it to `(B, 1, ...)` with one 1 for each axis of `x0` after the first.

## Hint 3

The posterior needs $\bar{\alpha}_{t-1}$. Build an array of the previous values with a 1 in front: `[1, alpha_bars[0], ..., alpha_bars[T-2]]`. Then index it with `t` like the other arrays.

## Hint 4

At $t = 0$ the previous value is 1, so the coefficient of $x_t$ is 0 and the coefficient of $x_0$ is $\beta_0 / (1 - \bar{\alpha}_0) = 1$. Python reads `alpha_bars[-1]` as the last step, so a plain `t - 1` index gives a wrong answer at $t = 0$.
