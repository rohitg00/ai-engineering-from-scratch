## Hint 1

Allocate two zero arrays in `__init__`, one of shape `(max_len, d_k)` and one of shape `(max_len, d_v)`. Keep a counter of the stored steps.

## Hint 2

`np.atleast_2d` turns a 1D step into an array with one row. Then every append has `n` rows.

## Hint 3

Do all the checks before you write anything. Raise `ValueError` first, then copy the rows into the arrays, then add `n` to the counter.

## Hint 4

`keys()` and `values()` return only the first `len(cache)` rows. The other rows are zeros, and attention over them gives wrong weights. `decode_step` is one row of scaled dot-product attention with the stable softmax.
