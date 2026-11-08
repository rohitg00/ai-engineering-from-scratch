## Why sines and cosines

Pair $i$ is a point on the unit circle at the angle $p \, \omega_i$, with $\omega_i = \text{base}^{-2i/d}$. A shift of $k$ positions turns each point by $k \, \omega_i$. This turn is the same for every $p$. So a linear map can move from the code of position $p$ to the code of position $p + k$. The model can learn relative offsets from absolute codes.

## Why many frequencies

The first pair turns once in about 6 positions. The last pairs turn very slowly. The fast pairs separate neighbours. The slow pairs separate positions that are far apart. Together the columns give each position a different code.

## The limit

The table is fixed and the model sees only the positions of its training data. At a longer length the model sees codes that it did not learn. RoPE puts the same sines and cosines into a rotation of the queries and keys, and the score then depends only on the gap. Most current models use RoPE for this reason.

## Where this goes next

The RoPE problem uses the same frequencies $\text{base}^{-2i/d}$. The full transformer lesson adds this table to the embeddings before the first block.
