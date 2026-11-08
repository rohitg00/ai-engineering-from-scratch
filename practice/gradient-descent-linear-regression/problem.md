Linear regression predicts a number as a weighted sum of the features plus a bias. Gradient descent finds the weights. It computes the gradient of the mean squared error and takes a small step against it, again and again. The same loop trains every model later in the course.

## Task

Write four functions.

1. `predict(X, w, b)` returns the prediction $\hat{y} = Xw + b$ for each row of `X`.
2. `compute_cost(X, y, w, b)` returns the mean squared error $J = \frac{1}{n} \sum_i (\hat{y}_i - y_i)^2$.
3. `compute_gradients(X, y, w, b)` returns the pair `(dw, db)`. Here $dw = \frac{2}{n} X^\top (\hat{y} - y)$ and $db = \frac{2}{n} \sum_i (\hat{y}_i - y_i)$.
4. `fit(X, y, learning_rate, epochs)` runs batch gradient descent and returns `(w, b, cost_history)`.

The rules for `fit`:

- Start with `w` as a vector of zeros and `b = 0.0`.
- In each epoch, compute `dw` and `db` from the current `w` and `b`. Then update both: $w \leftarrow w - \eta \, dw$ and $b \leftarrow b - \eta \, db$, where $\eta$ is `learning_rate`.
- After the update, append the cost of the new `w` and `b` to `cost_history`.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `X` | float array | `(n, d)` | one row of `d` features for each of the `n` samples |
| `y` | float array | `(n,)` | the target of each sample |
| `w` | float array | `(d,)` | the weights |
| `b` | float | scalar | the bias |
| `learning_rate` | float | scalar | the step size $\eta$, 0 or more |
| `epochs` | int | scalar | the number of updates, 0 or more |

- `predict` returns a float array of shape `(n,)`.
- `compute_cost` returns a Python `float`.
- `compute_gradients` returns a tuple: a float array `dw` of shape `(d,)` and a float `db`.
- `fit` returns a tuple: a float array `w` of shape `(d,)`, a float `b` and a list of `epochs` floats.

## Constraints

- `1 <= n <= 1000` and `1 <= d <= 50`.
- `0 <= epochs <= 5000`.
- Do not change the input arrays.
- Use numpy only. Do not use a closed form solution such as `np.linalg.lstsq` in `fit`.

## Examples

```python
X = np.array([[1.0], [2.0], [3.0], [4.0]])
y = np.array([3.0, 5.0, 7.0, 9.0])
compute_cost(X, y, np.zeros(1), 0.0)
compute_gradients(X, y, np.zeros(1), 0.0)
```

```text
41.0
(array([-35.]), -12.0)
```

```python
w, b, cost_history = fit(X, y, 0.05, 500)
w, b, len(cost_history), cost_history[0]
```

```text
(array([2.00005173]), 0.9998479052895004, 500, 1.1287500000000006)
```

The data lies on the line $y = 2x + 1$, so `w` moves close to 2 and `b` moves close to 1.
