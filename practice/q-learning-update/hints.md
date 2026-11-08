## Hint 1

Start each update with a copy of the table, for example with `np.array(Q, dtype=float)`. Then change the copy and return it.

## Hint 2

Compute the target before you change `Q[s, a]`. When `s_next` equals `s`, the target must read the old row.

## Hint 3

At a terminal step the next state has no future reward. Use 0 in place of the next value, so that the target is `r`.

## Hint 4

`np.argmax` returns the first index of the largest value, so it gives the lowest index on a tie. Draw `rng.random()` first, and call `rng.integers` only in the random branch.
