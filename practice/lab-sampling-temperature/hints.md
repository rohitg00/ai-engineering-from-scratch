## Hint 1

Divide the logits by the temperature first. Then subtract the maximum of the scaled logits before `np.exp`. A small temperature makes the scaled logits large.

## Hint 2

In `entropy_bits`, keep only the entries above 0 with `probs[probs > 0]`. Then `np.log2` never sees a 0.

## Hint 3

The entropy rises with the temperature. So when the entropy at `mid` is too low, the answer is above `mid`, and `lo` moves up.

## Hint 4

For `kept_count`, use `np.sort(probs)[::-1]` and `np.cumsum`. The first index where the cumulative sum reaches `p` gives the count, plus 1.
