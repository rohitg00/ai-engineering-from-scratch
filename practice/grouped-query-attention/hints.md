## Hint 1

Reuse the head split from multi-head attention: reshape `(B, T, D)` to `(B, T, H, d_head)` and move the head axis to position 1. Use the same split for `K` and `V`, with `G` heads.

## Hint 2

`np.repeat(kv, r, axis=1)` gives the order 0, 0, 1, 1 for `r = 2`. `np.tile` gives the order 0, 1, 0, 1, which is the wrong grouping.

## Hint 3

$d_{head}$ is the size of the last axis of one query head. It is not the size of the last axis of `x`.

## Hint 4

For the pooling, reshape `w` to `(D, G, r, d_head)` and take the mean over the axis of size `r`. Then reshape back to two axes.
