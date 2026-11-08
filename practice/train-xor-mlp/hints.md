## Hint 1

Keep the weights in numpy arrays: `W1` of shape `(2, 4)`, `b1` of shape `(4,)`, `W2` of shape `(4, 1)` and `b2` of shape `(1,)`. Draw `W1` and `W2` from `rng`. Do not start all weights at zero. Equal weights give equal hidden units, and equal units cannot split the plane in two ways.

## Hint 2

The forward pass for the whole batch is two matrix products. `h = sigmoid(X @ W1 + b1)` and `p = sigmoid(h @ W2 + b2)`. Reshape `y` to `(N, 1)` so that `p - t` has the shape of `p`.

## Hint 3

For the mean squared error, the gradient at the output before the sigmoid is `2 * (p - t) / N * p * (1 - p)`. Send it back with `@ W2.T` and multiply by `h * (1 - h)`, the derivative of the hidden sigmoid.

## Hint 4

The weight gradient of a layer is its input transposed times the gradient after the layer, for example `h.T @ dz2`. The bias gradient is the sum over the rows. Subtract the learning rate times each gradient. A learning rate near 2 reaches the target well inside 2000 steps.
