## Hint 1

Compute the errors once: `predict(X, w, b) - y`. The cost and both gradients use this vector of shape `(n,)`.

## Hint 2

`X.T @ errors` gives one sum for each feature. Each sum is the error of a sample times the value of that feature, added over all samples. Multiply by `2 / n` to get `dw`.

## Hint 3

The bias acts like a feature that is always 1. So `db` is `2 / n` times the plain sum of the errors.

## Hint 4

In `fit`, compute both gradients before you change `w` or `b`. If you update `w` first and then compute `db`, the bias step uses the wrong point. Append the cost only after both updates.
