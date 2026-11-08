## Hint 1

Every statistic is over the batch axis. Use `axis=0`. The mean and the variance then have shape `(D,)` and broadcast against `(N, D)`.

## Hint 2

Keep $\hat{x}$, $1 / \sqrt{\sigma^2 + \epsilon}$ and `gamma` in the cache. The backward pass needs all three.

## Hint 3

`dbeta` is the sum of `grad_output` over the batch axis. `dgamma` is the sum of `grad_output * x_hat` over the batch axis. The gradient with respect to $\hat{x}$ is `grad_output * gamma`.

## Hint 4

Each $x_{ij}$ changes $\hat{x}_{ij}$ directly and also changes $\mu_j$ and $\sigma^2_j$. With $g = \partial L / \partial \hat{x}$ and $s = 1 / \sqrt{\sigma^2 + \epsilon}$, the full result is $dx = \frac{s}{N} \left( N g - \sum_i g - \hat{x} \sum_i g \hat{x} \right)$, where each sum is over the batch axis.
