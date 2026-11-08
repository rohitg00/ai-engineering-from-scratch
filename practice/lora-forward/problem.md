LoRA fine-tunes a large model without a change to its weights. It keeps the weight $W$ of a linear layer frozen and adds a small trainable path through two low rank matrices $A$ and $B$. After training, you can merge the path into $W$, so inference costs the same as the base model.

## Task

Write three functions.

1. `lora_forward(x, W, b, A, B, alpha)` returns the output of the layer with the adapter.
2. `merge_lora(W, A, B, alpha)` returns the merged weight.
3. `count_trainable(in_features, out_features, rank)` returns the number of trainable values in $A$ and $B$.

The rank $r$ is the number of rows of $A$. The output of the layer is

$$y = x W^T + b + \frac{\alpha}{r} \, x A^T B^T.$$

The merged weight is $W' = W + \frac{\alpha}{r} B A$. With the merged weight, $x W'^T + b$ equals the output of `lora_forward`.

Only $A$ and $B$ train. $W$ and $b$ are frozen and do not count.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `x` | float array | `(N, in_features)` | one input row for each of the `N` examples |
| `W` | float array | `(out_features, in_features)` | the frozen weight |
| `b` | float array | `(out_features,)` | the frozen bias |
| `A` | float array | `(r, in_features)` | the down projection of the adapter |
| `B` | float array | `(out_features, r)` | the up projection of the adapter |
| `alpha` | float | scalar | the LoRA scale numerator |
| `in_features`, `out_features`, `rank` | int | scalar | the layer sizes and the rank |

- `lora_forward` returns a float array of shape `(N, out_features)`.
- `merge_lora` returns a new float array of shape `(out_features, in_features)`.
- `count_trainable` returns a Python `int`.

## Constraints

- `1 <= N <= 64`, `1 <= in_features, out_features <= 4096` and `1 <= r <= 64`.
- The rank can be larger than `in_features` or `out_features`.
- `alpha > 0`.
- Do not change the input arrays.
- Use numpy only.

## Examples

```python
x = np.array([[1.0, 2.0, 0.0], [0.0, -1.0, 1.0]])
W = np.array([[0.5, -0.5, 1.0], [1.0, 0.0, 0.0]])
b = np.array([0.1, -0.2])
A = np.array([[1.0, 0.0, 1.0], [0.0, 1.0, 0.0]])
B = np.array([[1.0, 0.5], [-1.0, 0.0]])
lora_forward(x, W, b, A, B, 4.0)
```

```text
[[ 3.6 -1.2]
 [ 2.6 -2.2]]
```

With `B = np.zeros((2, 2))`, the same call returns the base output `[[-0.4, 0.8], [1.6, -0.2]]`.

```python
merge_lora(W, A, B, 4.0)
```

```text
[[ 2.5  0.5  3. ]
 [-1.   0.  -2. ]]
```

```python
count_trainable(4096, 4096, 8)
```

```text
65536
```
