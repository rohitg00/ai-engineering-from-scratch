## Hint 1

Work on whole arrays. `X @ w + b` gives the vector of all `n` logits. `sigmoid` of that vector gives all the probabilities.

## Hint 2

For a stable sigmoid, compute `e = np.exp(-np.abs(z))`. The value of `e` is never larger than 1. For `z >= 0` the sigmoid is `1 / (1 + e)`. For `z < 0` it is `e / (1 + e)`. Use `np.where` to pick the formula.

## Hint 3

`np.logaddexp(0.0, z)` computes $\log(1 + e^z)$ without overflow. The loss of one example is that value minus `y * z`.

## Hint 4

The gradient of the mean loss with respect to the logits is `(p - y) / n`. The chain rule through `z = X @ w + b` gives `X.T @ (p - y) / n` for `w` and the mean of `p - y` for `b`.
