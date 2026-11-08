The learning rate decides if gradient descent converges, crawls or blows up. A rate sweep is the first experiment on any new model: train with each rate, keep the final loss, and pick the rate. In this lab you run the sweep on a small linear regression and compare the result with the bound that theory gives.

`support.py` gives the data, the grid of rates and the trainer. `make_regression(seed)` returns `X` of shape `(64, 4)` and `y` of shape `(64,)`. `train(X, y, lr, steps)` runs full batch gradient descent on the mean squared error from $w = 0$. It returns the loss before each step and after the last step, an array of `steps + 1` values. When the loss passes `1e10`, the trainer stops and fills the rest of the curve with `inf`.

## Task

Write five helper functions and `answers()`.

1. `run_sweep(X, y, lrs, steps=STEPS)` returns a float array of shape `(len(lrs), steps + 1)`. Row $i$ is `train(X, y, lrs[i], steps)`.
2. `is_diverged(losses)` returns `True` when the final loss is not finite or is larger than the first loss. Otherwise it returns `False`.
3. `best_lr(lrs, curves)` returns the rate with the lowest final loss among the runs that did not diverge. If two runs have the same final loss, return the smaller rate. If every run diverged, return `None`.
4. `smallest_diverging_lr(lrs, curves)` returns the smallest rate, by value, whose run diverged. If no run diverged, return `None`.
5. `stability_bound(X)` returns $2 / \lambda_{max}$, where $\lambda_{max}$ is the largest eigenvalue of the Hessian $H = \frac{2}{n} X^T X$ of the mean squared error.

Then do the experiment in `answers()`.

1. Make the data with `make_regression(seed=0)`.
2. Change the learning rate over `LEARNING_RATES`. Train each rate for `STEPS` steps.
3. Measure the final loss of each run. Report the best rate as `best_lr` and its final loss as `best_final_loss`.
4. Report the smallest rate that diverged as `smallest_diverging_lr`.
5. Compute the theory bound on the same `X`. Report it as `stability_bound`.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `X` | float array | `(n, d)` | the inputs, one row for each example |
| `y` | float array | `(n,)` | the targets |
| `lrs` | list of floats | `(k,)` | the learning rates, in any order |
| `steps` | int | scalar | the number of gradient steps |
| `losses` | float array | `(steps + 1,)` | one loss curve |
| `curves` | float array | `(k, steps + 1)` | one loss curve for each rate, in the order of `lrs` |

- `run_sweep` returns a float array of shape `(k, steps + 1)`.
- `is_diverged` returns a bool.
- `best_lr` and `smallest_diverging_lr` return one element of `lrs` or `None`.
- `stability_bound` returns a float.
- `answers()` returns a dict with the four keys above. Each value is a Python `float`.

## Constraints

- A curve can hold `inf` or `nan`.
- Do not change the input arrays.
- Do not round the answers. The checks accept a relative difference of `1e-6` from the reference run.
- Use numpy and the standard library only.

## Examples

```python
is_diverged(np.array([1.0, 2.0, 3.0]))
```

```text
True
```

```python
best_lr([0.1, 0.2, 0.3], np.array([[1.0, 0.5], [1.0, 0.2], [1.0, np.inf]]))
```

```text
0.2
```

```python
stability_bound(np.array([[1.0, 0.0], [0.0, 2.0]]))
```

```text
0.5
```

```python
X, y = make_regression(0)
train(X, y, 0.1, 3)
```

```text
[3.95117454 0.8025197  0.6543398  0.57749216]
```
