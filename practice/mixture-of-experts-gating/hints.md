## Hint 1

Negate the logits and sort them with `np.argsort`. Use `kind="stable"` so that equal logits keep the order of their indices.

## Hint 2

`np.take_along_axis(logits, top_idx, axis=-1)` gives the logits of the chosen experts with shape `(T, k)`. Apply a softmax over the last axis of that array.

## Hint 3

Subtract the row maximum before `np.exp`. The gates do not change, and `np.exp` cannot overflow.

## Hint 4

For $f$, count each expert in the flattened `top_idx` with `np.bincount` and `minlength=E`. Divide the counts by $T k$. For $P$, take the mean over tokens of the full softmax. The loss is $E$ times the dot product of $f$ and $P$.
