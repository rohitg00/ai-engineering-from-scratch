## Hint 1

To give one time to each row, reshape `t` to `(B, 1, ...)` with one 1 for each axis of `x0` after the first. A scalar `t` needs no reshape.

## Hint 2

For the loss, compute the error array first. Reshape it to `(B, -1)`, sum the squares over axis 1, and take the mean of the `B` values.

## Hint 3

The time of step $k$ is the start of the step, $k / n$, not its end. Use `np.full(B, k / n)` for the time array.

## Hint 4

Start the sampler from a new float array, for example `np.array(x0, dtype=float)`. Then write `x = x + dt * v`, so the array of the caller does not change.
