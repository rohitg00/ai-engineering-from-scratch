## Hint 1

Write a softmax over the last axis first. Use `axis=-1` and `keepdims=True`, so that it works for any number of leading axes.

## Hint 2

`K.T` reverses every axis of a 3D array. Use `np.swapaxes(K, -1, -2)` to transpose only the last two axes. The `@` operator then treats the leading axes as a batch.

## Hint 3

Apply the mask to the scores before the softmax. Put minus infinity at each blocked position with `np.where`. The exponential of minus infinity is exactly 0.

## Hint 4

Subtract the maximum of each row before `np.exp`. Each row has at least one allowed key, so the maximum is finite. `np.triu` with `k=1` gives the causal mask.
