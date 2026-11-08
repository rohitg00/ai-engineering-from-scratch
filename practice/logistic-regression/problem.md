Logistic regression is a linear model with a sigmoid on the output. The output is the probability of class 1. Gradient descent on the binary cross-entropy loss trains it. The same loss and gradient return in every neural network classifier with two classes.

## Task

Write four functions.

1. `sigmoid(z)` returns $\sigma(z) = 1 / (1 + e^{-z})$ for each element of `z`.
2. `compute_loss(X, y, w, b)` returns the mean binary cross-entropy of the model $p = \sigma(X w + b)$.
3. `compute_gradients(X, y, w, b)` returns `(dw, db)`, the gradient of that mean loss with respect to `w` and `b`.
4. `fit(X, y, learning_rate, epochs)` trains the model with full batch gradient descent and returns `(w, b, loss_history)`.

The loss of one example is $-[y \log p + (1 - y) \log(1 - p)]$. With $z = x \cdot w + b$, the same value is $\log(1 + e^z) - y z$. The loss is the mean over the `n` examples.

The gradients are $dw = X^T (p - y) / n$ and $db = \frac{1}{n} \sum_i (p_i - y_i)$.

`fit` starts with `w` as a zero vector and `b = 0.0`. Each epoch does these steps:

1. Compute `(dw, db)` at the current `w` and `b`.
2. Move `w` and `b` one step against their gradients. The step is `learning_rate` times the gradient.
3. Append the loss at the new `w` and `b` to `loss_history`.

Large values of $|z|$ overflow `np.exp`. The sigmoid and the loss must be correct for any finite `z`. Do not clip the probabilities.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `z` | float array | any shape | the input of `sigmoid` |
| `X` | float array | `(n, d)` | one example in each row |
| `y` | float array | `(n,)` | the label of each example, 0.0 or 1.0 |
| `w` | float array | `(d,)` | the weights |
| `b` | float | scalar | the bias |
| `learning_rate` | float | scalar | the step size |
| `epochs` | int | scalar | the number of gradient steps, 0 or more |

- `sigmoid` returns a float array with the shape of `z`.
- `compute_loss` returns a Python `float`.
- `compute_gradients` returns a float array of shape `(d,)` and a Python `float`.
- `fit` returns a float array of shape `(d,)`, a Python `float` and a list of `epochs` floats.

## Constraints

- `1 <= n <= 1000` and `1 <= d <= 50`.
- `z` can be any finite float, also values such as `1000.0` and `-1000.0`.
- Do not change the input arrays.
- Use numpy only.

## Examples

```python
sigmoid(np.array([-2.0, 0.0, 2.0, 1000.0, -1000.0]))
```

```text
[0.11920292 0.5        0.88079708 1.         0.        ]
```

```python
X = np.array([[1.0, 2.0], [2.0, 1.0], [3.0, 4.0], [4.0, 3.0]])
y = np.array([0.0, 0.0, 1.0, 1.0])
w = np.array([0.5, -0.25])
compute_loss(X, y, w, 0.1)
compute_gradients(X, y, w, 0.1)
```

```text
0.6545645625913818
(array([ 0.00990023, -0.07111509]), 0.1663330660944403)
```

```python
fit(X, y, 0.1, 3)
```

```text
(array([0.10335357, 0.10335357]), -0.016102386795294854, [0.6521696016041545, 0.6346023820290841, 0.6258174296603579])
```
