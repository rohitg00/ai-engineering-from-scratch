## Hint 1

First reshape `(B, T, D)` to `(B, T, H, d_head)`. This reshape cuts the last axis into `H` blocks of `d_head` neighbor columns, which is what the task asks for.

## Hint 2

The head axis must come before the token axis. Swap axes 1 and 2 with `transpose(0, 2, 1, 3)`. A direct reshape to `(B, H, T, d_head)` has the right shape but puts the wrong numbers in each head.

## Hint 3

`merge_heads` does the two steps in the opposite order: first move the head axis back next to the feature axis, then reshape.

## Hint 4

After the split, the attention is the same as single-head attention with two batch axes. Use `np.swapaxes(k, -1, -2)` for the transpose and divide by `sqrt(d_head)`, not by `sqrt(D)`.
