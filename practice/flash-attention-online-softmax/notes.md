## Why the result is exact

Softmax does not change when you subtract a constant from every score in a row. The step keeps $l$ and $a$ relative to the current max. When the max changes from $m$ to $m'$, the factor $e^{m - m'}$ moves every earlier term to the new reference. After the last block, $l$ is the exact softmax denominator relative to the final max, and $a / l$ is the exact output. The only difference from standard attention is the order of the floating point additions.

## Why it is fast

The full score matrix has $T_q T_k$ entries. On a GPU it does not fit in the fast on-chip memory, so standard attention writes it to slow memory and reads it back. The tiled form keeps one block of scores on the chip at a time. The memory for the scores falls from $O(T^2)$ to $O(T)$, and the kernel reads the slow memory far less often. The paper calls this IO awareness.

## The log-sum-exp

The kernel also stores $m + \log l$ for each row. The backward pass uses it to compute the softmax again, block by block, in place of a stored matrix of probabilities.

## A difference from the paper

The first version of the paper keeps the output divided by $l$ after every block. The second version keeps the accumulator unscaled and divides once at the end, as you did here. This form uses fewer operations. Both forms give the same result.

## Where this goes next

The KV cache lesson runs the same loop with one query at a time. Paged attention reads the blocks of keys and values from pages of memory that are not next to each other.
