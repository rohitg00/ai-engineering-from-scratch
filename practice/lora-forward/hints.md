## Hint 1

Compute the base output and the adapter output apart, then add them. The base output is `x @ W.T + b`.

## Hint 2

The rank is `A.shape[0]`. Do not read it from `W` or from `x`.

## Hint 3

The adapter path first projects `x` down to `r` values with `A`, then up to `out_features` values with `B`. Multiply that path by `alpha / r`.

## Hint 4

For the merge, `B @ A` has the shape of `W`. Return a new array. Do not add into `W` with `+=`. For the count, add the sizes of `A` and `B`.
