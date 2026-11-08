## Hint 1

Work on whole rows with numpy. `np.max(logits, axis=1, keepdims=True)` gives the maximum of each row with shape `(N, 1)`, so it broadcasts against `(N, C)`.

## Hint 2

Softmax does not change when you subtract the same number from every logit in a row. Subtract the row maximum before `np.exp`. The largest exponent is then 0, so `np.exp` cannot overflow.

## Hint 3

For the loss, compute the log of softmax directly: the shifted logit minus the log of the sum of the exponentials. Then pick the value of the correct class in each row with `log_probs[np.arange(N), targets]`.

## Hint 4

The gradient of one example is `softmax(z) - one_hot(y)`. The batch loss is a mean, so divide the gradient by `N`.
