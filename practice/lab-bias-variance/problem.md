A model can miss the truth in two ways. It can be too simple and miss on every training set: that is bias. It can be too flexible and change a lot from one training set to the next: that is variance. In this lab you fit polynomials of degree 1 to 12 to many resampled training sets and measure both parts of the error.

`support.py` gives the true function $f(x) = \sin(1.5x) + 0.5x$, the data generator, a least squares polynomial fit and the test points `X_TEST`, 100 points from $-2.5$ to $2.5$. `generate_data(n_samples, noise_std, seed)` draws $x$ uniform in $[-3, 3]$ and $y = f(x) + \epsilon$ with $\epsilon \sim N(0, \sigma^2)$.

## Task

Write five helper functions and `answers()`. Let `predictions` have one row for each training round $b = 1 \dots B$ and one column for each test point $t = 1 \dots T$. Let $\bar p_t$ be the mean of column $t$.

1. `decompose(predictions, y_true)` returns the tuple `(bias_sq, variance)`.
   - $\text{bias}^2 = \frac{1}{T} \sum_t (\bar p_t - f_t)^2$.
   - $\text{variance} = \frac{1}{T} \sum_t \frac{1}{B} \sum_b (p_{bt} - \bar p_t)^2$. Divide by $B$, not by $B - 1$.
2. `expected_test_error(predictions, y_true, noise_std)` returns $\frac{1}{BT} \sum_{b,t} (p_{bt} - f_t)^2 + \sigma^2$.
3. `sweep_degrees(degrees, n_rounds, n_train, noise_std, seed=0)` returns a dict. Each key is a degree. Each value is a dict with the keys `"bias_sq"`, `"variance"` and `"test_error"`. For each degree and each round `b` from `0` to `n_rounds - 1`:
   1. Draw a training set with `generate_data(n_train, noise_std, seed=seed + b)`. Every degree uses the same training sets.
   2. Fit it with `fit_polynomial` and predict `X_TEST` with `predict_polynomial`.
   3. Compare the predictions with `true_function(X_TEST)`.
4. `best_degree(results)` returns the degree with the lowest `test_error`. If two degrees tie, return the lower degree.
5. `crossover_degree(results)` returns the lowest degree whose `variance` is greater than or equal to its `bias_sq`. If no degree meets this rule, return `None`.

Then do the experiment in `answers()`.

1. Change the degree over `DEGREES`, from 1 to 12. Use `N_ROUNDS`, `N_TRAIN`, `NOISE_STD` and `seed=0`.
2. Measure the bias squared, the variance and the test error at each degree.
3. Report `best_degree` and its test error as `best_test_error`.
4. Report `crossover_degree`.
5. Report the bias squared at degree 1 as `bias_sq_degree_1` and the variance at degree 12 as `variance_degree_12`.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `predictions` | float array | `(B, T)` | one row of test predictions for each training round |
| `y_true` | float array | `(T,)` | the true function at the test points, without noise |
| `noise_std` | float | scalar | the noise standard deviation $\sigma$ |
| `degrees` | list of ints | `(k,)` | the polynomial degrees to fit |
| `n_rounds` | int | scalar | the number of training sets $B$ |
| `n_train` | int | scalar | the number of points in each training set |
| `results` | dict | `k` keys | the output of `sweep_degrees` |

- `decompose` returns a tuple of two floats.
- `expected_test_error` returns a float.
- `best_degree` and `crossover_degree` return an int from the keys of `results`. `crossover_degree` can return `None`.
- `answers()` returns a dict with the five keys above. Each value is a Python `float`.

## Constraints

- `1 <= B <= 200` and `1 <= T <= 200`.
- Do not change the input arrays.
- Do not round the answers. The checks accept a relative difference of `1e-6` from the reference run.
- Use numpy and the standard library only.

## Examples

```python
P = np.array([[1.0, 2.0, 3.0], [3.0, 2.0, 1.0]])
Y = np.array([1.5, 2.0, 2.0])
decompose(P, Y)
```

```text
(0.08333333333333333, 0.6666666666666666)
```

```python
expected_test_error(P, Y, 0.5)
```

```text
1.0
```

The error is the sum $0.0833 + 0.6667 + 0.25$.

```python
result = sweep_degrees([1, 3], n_rounds=5, n_train=20)
result[3]
```

```text
{'bias_sq': 0.06179704932177359, 'variance': 0.052499400227697696, 'test_error': 0.3642964495494713}
```
