## Hint 1

Compare `rng.random(x.shape)` with `p`. The result is a bool array with the shape of `x`. An entry is kept when the random number is at least `p`.

## Hint 2

Multiply `x` by the mask. numpy treats `True` as 1 and `False` as 0. Then divide by `1 - p`, not by `p`.

## Hint 3

The backward pass applies the same operation to the gradient: the same mask and the same scale. Do not draw a new mask.

## Hint 4

In inference mode return early, before any call to `rng`. Use `x.copy()` so that the caller gets a new array.
