Focal loss is cross-entropy with a weight that makes easy examples count less. A detector sees many easy background regions and few objects. With plain cross-entropy, the easy examples give most of the loss. Focal loss multiplies each term by $(1 - p_t)^\gamma$, so the model learns more from the hard examples.

## Task

Write three functions.

1. `binary_focal_loss(logits, targets, gamma, alpha)` returns the mean binary focal loss.
2. `binary_focal_grad(logits, targets, gamma, alpha)` returns the gradient of that mean loss with respect to the logits.
3. `focal_loss(logits, targets, gamma, alpha)` returns the mean multi-class focal loss.

For one example, $p_t$ is the predicted probability of the true class and

$$\mathrm{FL}(p_t) = -\alpha_t \, (1 - p_t)^\gamma \log p_t.$$

In the binary case, the logit is $x$ and the target is $y \in \{0, 1\}$. Then $p_t = \sigma(x)$ when $y = 1$ and $p_t = 1 - \sigma(x)$ when $y = 0$, with $\sigma(x) = 1 / (1 + e^{-x})$. With a float `alpha`, $\alpha_t = \alpha$ when $y = 1$ and $\alpha_t = 1 - \alpha$ when $y = 0$.

In the multi-class case, $p_t$ is the softmax probability of the target class over the row of logits. With an array `alpha` of size $C$, $\alpha_t$ is `alpha[target]`.

When `alpha` is `None`, $\alpha_t = 1$. Each loss is the mean of $\mathrm{FL}$ over the batch. With $\gamma = 0$ and no alpha, both losses are the ordinary cross-entropy.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `logits` (binary) | float array | `(N,)` | one logit for each example |
| `targets` (binary) | float array | `(N,)` | 0 or 1 for each example |
| `logits` (multi-class) | float array | `(N, C)` | one row of logits for each example |
| `targets` (multi-class) | int array | `(N,)` | the class index of each example, from 0 to `C - 1` |
| `gamma` | float | | the focusing exponent, 0 or more |
| `alpha` | float, float array or `None` | `()` or `(C,)` | the class weight: a float in the binary case, an array of size `C` in the multi-class case |

- `binary_focal_loss` and `focal_loss` return a Python float.
- `binary_focal_grad` returns a float array of shape `(N,)`.

## Constraints

- `1 <= N <= 1000`, `2 <= C <= 100`, `0 <= gamma <= 5` and `0 < alpha < 1` in the binary case.
- Logits can be as large as 1000 in absolute value. The loss and the gradient must stay finite.
- Do not change the input arrays.
- Use numpy only.

## Examples

```python
logits = np.array([2.0, -1.0, 0.5, -3.0])
targets = np.array([1.0, 1.0, 0.0, 0.0])
binary_focal_loss(logits, targets, 0.0)
binary_focal_loss(logits, targets, 2.0)
binary_focal_loss(logits, targets, 2.0, 0.25)
binary_focal_grad(logits, targets, 2.0, 0.25)
```

```text
0.6157135085787611
0.270298187607633
0.1147646574248966
[-3.04433762e-04 -4.80146702e-02  9.86534666e-02  5.90384712e-05]
```

```python
logits = np.array([[2.0, 1.0, 0.1], [0.5, 2.5, 0.3]])
targets = np.array([0, 1])
focal_loss(logits, targets, 0.0)
focal_loss(logits, targets, 2.0)
focal_loss(logits, targets, 2.0, np.array([0.5, 1.0, 2.0]))
```

```text
0.31853976964918573
0.02853873533647399
0.016415649484550623
```
