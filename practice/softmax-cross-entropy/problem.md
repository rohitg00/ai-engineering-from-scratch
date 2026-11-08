A classifier gives one row of logits for each example. Softmax turns each row into probabilities. Cross-entropy measures how much probability the model gives to the correct class. Its gradient with respect to the logits is the signal that trains every classifier in the course.

## Task

Write three functions.

1. `softmax(logits)` returns the softmax of each row.
2. `cross_entropy(logits, targets)` returns the mean cross-entropy loss over the batch.
3. `cross_entropy_grad(logits, targets)` returns the gradient of that mean loss with respect to `logits`.

The softmax of a row $z$ is $p_i = e^{z_i} / \sum_j e^{z_j}$. The loss of one example with the correct class $y$ is $-\log p_y$. The batch loss is the mean of the example losses.

Large logits overflow `np.exp`. Your softmax must give correct probabilities for logits such as `1000.0`.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `logits` | float array | `(N, C)` | one row of scores for each of the `N` examples, `C` classes |
| `targets` | int array | `(N,)` | the correct class of each example, from `0` to `C - 1` |

- `softmax` returns a float array of shape `(N, C)`.
- `cross_entropy` returns a Python `float`.
- `cross_entropy_grad` returns a float array of shape `(N, C)`.

## Constraints

- `1 <= N <= 512` and `2 <= C <= 1000`.
- Logits can be any finite float, also values larger than 700.
- Do not change the input arrays.
- Use numpy only.

## Examples

```python
logits = np.array([[1.0, 2.0, 3.0]])
softmax(logits)
```

```text
[[0.09003057 0.24472847 0.66524096]]
```

```python
logits = np.array([[2.0, 1.0, 0.1], [0.5, 2.5, 0.3]])
targets = np.array([0, 1])
cross_entropy(logits, targets)
```

```text
0.31853977
```

The gradient of the same batch has one row for each example. Each row sums to 0.
