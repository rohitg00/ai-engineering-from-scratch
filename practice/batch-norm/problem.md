Batch normalization normalizes each feature over the examples of a mini-batch. Then it scales and shifts each feature with two learned vectors. In training, it uses the statistics of the batch and updates running averages. In inference, it uses only the running averages. You write the forward pass for both modes and the backward pass for training mode.

## Task

Write two functions.

1. `batchnorm_forward(x, gamma, beta, running_mean, running_var, momentum=0.1, eps=1e-5, training=True)` returns `(out, cache, new_running_mean, new_running_var)`.
2. `batchnorm_backward(grad_output, cache)` returns `(dx, dgamma, dbeta)`.

In training mode, compute for each feature column $j$ over the batch of $N$ rows:

$$\mu_j = \frac{1}{N} \sum_i x_{ij}, \quad \sigma^2_j = \frac{1}{N} \sum_i (x_{ij} - \mu_j)^2$$

$$\hat{x}_{ij} = \frac{x_{ij} - \mu_j}{\sqrt{\sigma^2_j + \epsilon}}, \quad \text{out}_{ij} = \gamma_j \hat{x}_{ij} + \beta_j$$

The variance is the biased variance. It divides by $N$, not by $N - 1$. The running statistics also use this biased variance:

$$\text{new mean} = (1 - m) \cdot \text{running mean} + m \cdot \mu, \quad \text{new var} = (1 - m) \cdot \text{running var} + m \cdot \sigma^2$$

Here $m$ is `momentum`.

In inference mode (`training=False`), use `running_mean` and `running_var` in place of $\mu$ and $\sigma^2$. Return copies of the running statistics without a change. The cache in inference mode can be `None`.

`batchnorm_backward` gets the gradient of the loss with respect to `out` and the cache from a training mode call. It returns the gradients of the loss with respect to `x`, `gamma` and `beta`. The gradient `dx` must include the effect of `x` on $\mu$ and on $\sigma^2$.

The cache is your own choice. The checks pass the cache from your forward pass to your backward pass and do not read it.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `x` | float array | `(N, D)` | the batch, one row for each example, one column for each feature |
| `gamma` | float array | `(D,)` | the scale of each feature |
| `beta` | float array | `(D,)` | the shift of each feature |
| `running_mean` | float array | `(D,)` | the running mean before this call |
| `running_var` | float array | `(D,)` | the running variance before this call |
| `momentum` | float | | the weight of the batch statistics, from 0 to 1 |
| `eps` | float | | the small number added to the variance inside the square root |
| `training` | bool | | `True` for training mode, `False` for inference mode |
| `grad_output` | float array | `(N, D)` | the gradient of the loss with respect to `out` |

- `batchnorm_forward` returns a tuple `(out, cache, new_running_mean, new_running_var)`. `out` has shape `(N, D)`. The two running arrays have shape `(D,)`.
- `batchnorm_backward` returns a tuple `(dx, dgamma, dbeta)` with shapes `(N, D)`, `(D,)` and `(D,)`.

## Constraints

- `1 <= N <= 64` and `1 <= D <= 32`.
- A column can be constant. Its variance is then 0.
- Do not change any input array. Return new arrays for the running statistics.
- Use numpy only.

## Examples

```python
x = np.array([[1.0, 2.0], [3.0, 6.0], [5.0, 10.0]])
gamma = np.array([1.0, 0.5])
beta = np.array([0.0, 1.0])
out, cache, mean, var = batchnorm_forward(x, gamma, beta, np.zeros(2), np.ones(2))
dx, dgamma, dbeta = batchnorm_backward(np.array([[1.0, 0.0], [0.0, 1.0], [1.0, 1.0]]), cache)
```

```text
out
[[-1.22474258  0.38762785]
 [ 0.          1.        ]
 [ 1.22474258  1.61237215]]
mean
[0.3 0.6]
var
[1.16666667 1.96666667]
dx
[[ 0.20412376 -0.02551558]
 [-0.40824753  0.05103101]
 [ 0.20412376 -0.02551543]]
dgamma
[0.        1.2247443]
dbeta
[2. 2.]
```

```python
out, cache, mean, var = batchnorm_forward(np.array([[2.0, 4.0]]), gamma, beta, np.array([0.3, 0.6]), np.array([1.16666667, 1.96666667]), training=False)
```

```text
out
[[1.57388742 2.21222277]]
cache
None
```
