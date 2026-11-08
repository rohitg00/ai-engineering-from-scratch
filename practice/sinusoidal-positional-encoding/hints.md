## Hint 1

Start with a zero array of shape `(max_len, d_model)`. The zeros give the last column for an odd `d_model`.

## Hint 2

Make a column of positions with shape `(max_len, 1)` and a row of pair indices with shape `(1, d_model // 2)`. Broadcasting gives the angle table of shape `(max_len, d_model // 2)`.

## Hint 3

The exponent is `2 * i / d_model`. Divide by `d_model`, also when it is odd.

## Hint 4

Write the sines into the columns `0, 2, 4, ...` and the cosines into the columns `1, 3, 5, ...`. With `half = d_model // 2`, the slices `0:2 * half:2` and `1:2 * half:2` select exactly these columns.
