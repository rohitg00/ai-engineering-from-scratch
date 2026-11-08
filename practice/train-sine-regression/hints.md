## Hint 1

Reshape `x` and `y` to column vectors of shape `(N, 1)` with `reshape`. That makes a new view and keeps the caller's arrays as they are. Then `X @ W1` has shape `(N, 16)`.

## Hint 2

Draw `W1` from `rng.normal` with the scale 1, so that the 16 tanh units bend at different values of $x$. Draw `W2` with the scale `sqrt(1 / 16)`. Start the biases at zero. Zero weights give no gradient to the first layer.

## Hint 3

The gradient of the mean squared error at the output is `2 * (out - t) / N`. Send it back with `@ W2.T` and multiply by `1 - h ** 2`, the derivative of tanh.

## Hint 4

Use Adam on the four arrays: keep `m` and `v` for each, correct them with `1 - beta ** (step + 1)`, and step with `lr * m_hat / (sqrt(v_hat) + eps)`. The learning rate 0.01 reaches the target in about 1000 steps.
