## Hint 1

Keep six arrays: `W1` of shape `(2, 24)`, `b1`, `W2` of shape `(24, 24)`, `b2`, `W3` of shape `(24, 1)` and `b3`. Draw each weight matrix from `rng.normal` with the scale `sqrt(1 / fan_in)`. Start the biases at zero.

## Hint 2

The forward pass is `h1 = tanh(X @ W1 + b1)`, `h2 = tanh(h1 @ W2 + b2)` and `z = h2 @ W3 + b3`. For a sigmoid output with binary cross-entropy, the gradient of the mean loss with respect to `z` is `(p - t) / B` for a batch of `B` rows.

## Hint 3

The derivative of `tanh` is `1 - h ** 2`. Send the gradient back through each layer: multiply by the transposed weights, then by `1 - h ** 2` of that layer.

## Hint 4

Make a new order with `rng.permutation(N)` each time you reach the end of the data, and cut it into batches of 64. For Adam, keep `m` and `v` for each array, update them with the gradient, divide each by `1 - beta ** (step + 1)`, and subtract `lr * m_hat / (sqrt(v_hat) + eps)`.
