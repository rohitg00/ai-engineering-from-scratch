## Hint 1

The scale uses the magnitude. Take `np.max(np.abs(tensor))`, not `np.max(tensor)`. A tensor with a large negative value must still fit in the range.

## Hint 2

Divide by the scale, round with `np.round`, clip to `[-127, 127]`, and only then cast with `.astype(np.int8)`. A cast without the round cuts off the fraction.

## Hint 3

For the per-row case, take the maximum over `axis=1` with `keepdims=True`. The scales then have shape `(R, 1)` and broadcast against the `(R, C)` tensor.

## Hint 4

Use `np.where` to put `1.0` in place of the scale of a row whose maximum is 0. Return the scales with `reshape(-1)`, so that one row gives shape `(1,)` and not a scalar.
