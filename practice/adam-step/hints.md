## Hint 1

Read `m`, `v` and `t` from the old state. Compute new values with whole array expressions. Return them in a new dict.

## Hint 2

Add 1 to `t` before you compute the bias correction. At the first step $1 - \beta_1^1 = 0.1$, so $\hat m$ is exactly the gradient.

## Hint 3

Put `epsilon` after the square root: `np.sqrt(v_hat) + epsilon`. Inside the square root it is much larger than a small $\hat v$ and the step becomes too small.

## Hint 4

For AdamW, do not add `weight_decay * params` to the gradient. Multiply the old parameters by `1 - weight_decay * lr`, then subtract the Adam update.
