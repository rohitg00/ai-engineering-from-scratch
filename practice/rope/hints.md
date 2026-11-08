## Hint 1

Start with the frequencies. `np.arange(d // 2)` gives the pair index `i`. The exponent is `2 * i / d`, not `i / d`.

## Hint 2

Make a table of angles with shape `(T, d // 2)`. Each entry is a position times a frequency. Use `positions[:, None]` and the frequencies on a new first axis.

## Hint 3

The slice `0:2 * (d // 2):2` gives the first element of each pair. The slice `1:2 * (d // 2):2` gives the second element. These slices also work when `d` is odd.

## Hint 4

Make a copy of `x` first. Read `a` and `b` from `x`, then write the two rotated halves into the copy. The copy keeps the last coordinate when `d` is odd.
