## Why the transpose is necessary

numpy stores an array in row-major order. A reshape keeps that order and only changes how the numbers are grouped. The reshape of `(B, T, D)` to `(B, T, H, d_head)` is safe, because it only cuts the last axis into blocks. A direct reshape to `(B, H, T, d_head)` groups the numbers of several tokens into one head. The shape is correct, but each head then mixes tokens with features. The transpose moves the head axis without a change to any value.

## Why heads use neighbor columns

Any fixed assignment of columns to heads gives an equal model, because the projection matrices can learn any order. The block layout is the convention of the lesson and of most libraries. It matters when you load trained weights: a strided layout reads the trained weights in the wrong order.

## The cost of more heads

The number of parameters does not change with `H`. Each head has a smaller `d_head`, and the scale $\sqrt{d_{head}}$ changes with it. The weights tensor has shape `(B, H, T, T)`, so memory for the weights grows with the number of heads.

## Where this goes next

Grouped-query attention, in the same lesson, splits `K` and `V` into fewer heads than `Q` and repeats them. The KV cache lesson stores the split keys and values, one block per head.
