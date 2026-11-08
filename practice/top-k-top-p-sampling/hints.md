## Hint 1

Start with a softmax that subtracts the maximum before `np.exp`. `np.exp(-np.inf)` is 0, so the same softmax works on filtered logits.

## Hint 2

`np.argsort(-logits, kind="stable")` gives the indices from the largest logit to the smallest. A stable sort keeps equal values in index order, so the lower index comes first.

## Hint 3

For top-p, take the cumulative sum of the sorted probabilities. Find the first position where the sum is at least `p`. Keep the tokens up to and including that position.

## Hint 4

Build the result as a new array full of `-np.inf` and copy the kept logits into it. Then the input array does not change. For the draw, compare one `u = rng.random()` with the cumulative sum of the final probabilities in vocabulary order.
