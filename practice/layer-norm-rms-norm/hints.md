## Hint 1

Use `axis=-1` and `keepdims=True` for every mean. The statistics then have shape `(..., 1)` and broadcast against `x` for any number of leading axes.

## Hint 2

`gamma`, `beta` and `weight` have shape `(D,)`. numpy broadcasts them over the leading axes, so you can multiply and add them directly.

## Hint 3

For LayerNorm, compute the mean, then the mean of the squared differences from it. Divide by `np.sqrt(var + eps)`.

## Hint 4

RMSNorm has no mean subtraction. The denominator is the square root of the mean of `x * x` plus `eps`. A row of zeros then gives $0 / \sqrt{\epsilon} = 0$.
