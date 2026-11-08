## Hint 1

Use `np.argmax(np.abs(v))` to find the index for the sign rule. `np.argmax` returns the first index in a tie.

## Hint 2

Normalize `v0` before the loop. Without it, the dot product in the first stop test is not a cosine and the loop can stop too early.

## Hint 3

Count the iterations inside the loop. Increase the counter at the start of each pass, so that a stop in the first pass gives `iters = 1`.

## Hint 4

Use `np.abs(np.dot(v_new, v))` in the stop test. For the eigenvalue, use `v @ M @ v` and not the norm of `M v`. The norm is never negative, so it loses the sign of a negative eigenvalue.
