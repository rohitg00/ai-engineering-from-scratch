A transformer normalizes the vector of each token before attention and before the feed forward block. LayerNorm centers each vector and divides it by its standard deviation. RMSNorm skips the centering and divides by the root mean square. Modern LLMs use RMSNorm because it is cheaper and works as well.

## Task

Write two functions.

1. `layer_norm(x, gamma, beta, eps=1e-5)` returns LayerNorm of `x` over the last axis.
2. `rms_norm(x, weight, eps=1e-6)` returns RMSNorm of `x` over the last axis.

For each vector $x$ of length $D$ along the last axis:

$$\mu = \frac{1}{D} \sum_j x_j, \quad \sigma^2 = \frac{1}{D} \sum_j (x_j - \mu)^2, \quad \text{LayerNorm}(x)_j = \gamma_j \frac{x_j - \mu}{\sqrt{\sigma^2 + \epsilon}} + \beta_j$$

$$\text{RMSNorm}(x)_j = w_j \frac{x_j}{\sqrt{\frac{1}{D} \sum_k x_k^2 + \epsilon}}$$

The variance is the biased variance. It divides by $D$, not by $D - 1$. The `eps` goes inside the square root in both functions.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `x` | float array | `(..., D)` | the vectors to normalize, with zero or more leading axes |
| `gamma` | float array | `(D,)` | the LayerNorm scale of each feature |
| `beta` | float array | `(D,)` | the LayerNorm shift of each feature |
| `weight` | float array | `(D,)` | the RMSNorm scale of each feature |
| `eps` | float | | the small number added inside the square root |

- Both functions return a float array with the shape of `x`.

## Constraints

- `x` has 1 to 4 axes. `1 <= D <= 1024`.
- A vector can be constant or all zeros. The output must not contain NaN.
- Do not change the input arrays.
- Use numpy only.

## Examples

```python
x = np.array([[1.0, 2.0, 3.0, 4.0], [2.0, -2.0, 0.0, 4.0]])
gamma = np.array([1.0, 1.0, 2.0, 0.5])
beta = np.array([0.0, 0.5, 0.0, -1.0])
layer_norm(x, gamma, beta)
```

```text
[[-1.34163542  0.05278819  0.89442361 -0.32918229]
 [ 0.44721315 -0.84163944 -0.8944263  -0.32918028]]
```

```python
rms_norm(x, gamma)
```

```text
[[ 0.36514835  0.73029669  2.19089008  0.73029669]
 [ 0.81649651 -0.81649651  0.          0.81649651]]
```
