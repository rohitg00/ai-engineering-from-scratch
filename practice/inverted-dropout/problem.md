Dropout sets a random part of the activations to 0 during training. Inverted dropout also divides the kept activations by $1 - p$, so the expected value of each activation does not change. At inference time the layer then does nothing. You write the forward pass for both modes and the backward pass.

## Task

Write two functions.

1. `dropout_forward(x, p, rng, training=True)` returns `(out, mask)`.
2. `dropout_backward(grad_output, mask, p)` returns the gradient of the loss with respect to `x`.

In training mode, build the mask with exactly one call:

$$\text{mask} = (\texttt{rng.random(x.shape)} \geq p)$$

`True` in the mask means **kept**. Each entry is dropped with probability $p$. The output is

$$\text{out} = x \cdot \text{mask} / (1 - p)$$

In inference mode (`training=False`), return a copy of `x` and a mask that is `True` everywhere. Do not draw from `rng` in inference mode.

The backward pass uses the mask from the forward pass: $\partial L / \partial x = \text{grad\_output} \cdot \text{mask} / (1 - p)$.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `x` | float array | any shape | the activations |
| `p` | float | | the probability to drop an entry, `0 <= p < 1` |
| `rng` | `np.random.Generator` | | the random generator for the mask |
| `training` | bool | | `True` for training mode, `False` for inference mode |
| `grad_output` | float array | same as `x` | the gradient of the loss with respect to `out` |
| `mask` | bool array | same as `x` | the mask from `dropout_forward` |

- `dropout_forward` returns a tuple `(out, mask)`. `out` is a float array and `mask` is a bool array. Both have the shape of `x`.
- `dropout_backward` returns a float array with the shape of `x`.

## Constraints

- `x` has 1 to 4 axes and at most 40000 entries.
- `0 <= p < 1`.
- Do not change the input arrays.
- Use numpy only.

## Examples

```python
x = np.array([[1.0, 2.0, 3.0, 4.0], [5.0, 6.0, 7.0, 8.0]])
out, mask = dropout_forward(x, 0.5, np.random.default_rng(0))
grad = dropout_backward(np.ones((2, 4)), mask, 0.5)
```

```text
out
[[ 2.  0.  0.  0.]
 [10. 12. 14. 16.]]
mask
[[ True False False False]
 [ True  True  True  True]]
grad
[[2. 0. 0. 0.]
 [2. 2. 2. 2.]]
```

```python
out, mask = dropout_forward(x, 0.5, np.random.default_rng(0), training=False)
```

```text
out
[[1. 2. 3. 4.]
 [5. 6. 7. 8.]]
mask
[[ True  True  True  True]
 [ True  True  True  True]]
```
