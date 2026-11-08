A decision tree grows by splitting a node into two children. At each node it tries every feature and every threshold. It keeps the split that gives the purest children. Gini impurity measures how mixed the labels in a node are. This search is the core of every tree, random forest and gradient boosted tree.

## Task

Write four functions.

1. `gini_impurity(labels)` returns $G = 1 - \sum_c p_c^2$, where $p_c$ is the fraction of the labels in class $c$. An empty set has $G = 0.0$.
2. `split_impurity(x, y, threshold)` returns the weighted impurity of the split of one feature. The left child has the examples with $x \le$ `threshold`. The right child has the examples with $x >$ `threshold`. The value is $\frac{n_L}{n} G(y_L) + \frac{n_R}{n} G(y_R)$.
3. `best_threshold(x, y)` returns `(threshold, impurity)` for the best threshold of one feature.
4. `best_split(X, y)` returns `(feature, threshold, impurity)` for the best split over all the features.

Use these rules.

- Candidates: sort the unique values of the feature. Each candidate threshold is the midpoint of two neighbors, $(v_i + v_{i+1}) / 2$.
- The best split has the lowest weighted impurity.
- Tie rule: test the thresholds from low to high and the features from index 0 up. A candidate replaces the current best only when its impurity is lower by more than `1e-12`. So in a tie, the lower threshold and the lower feature index win.
- A feature with only one unique value has no candidate. `best_threshold` returns `None` for it, and `best_split` skips it.
- When no feature has a candidate, `best_split` returns `None`.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `labels`, `y` | int array | `(n,)` | the class of each example, any integers |
| `x` | float array | `(n,)` | the values of one feature |
| `threshold` | float | scalar | the split point |
| `X` | float array | `(n, d)` | one example in each row, one feature in each column |

- `gini_impurity` and `split_impurity` return a Python `float`.
- `best_threshold` returns a tuple of two floats, or `None`.
- `best_split` returns a tuple of an `int` and two floats, or `None`.

## Constraints

- `1 <= n <= 200` and `1 <= d <= 20`.
- Features can have repeated values.
- Do not change the input arrays.
- Use numpy only.

## Examples

```python
gini_impurity(np.array([0, 0, 1, 1, 1, 2]))
```

```text
0.6111111111111112
```

```python
x = np.array([1.0, 2.0, 3.0, 4.0, 5.0, 6.0])
y = np.array([0, 0, 1, 0, 1, 1])
split_impurity(x, y, 2.5)
best_threshold(x, y)
```

```text
0.25
(2.5, 0.25)
```

The thresholds 2.5 and 4.5 both give 0.25. The tie rule keeps 2.5.

```python
X = np.array([[1.0, 1.0], [2.0, 2.0], [3.0, 9.0], [4.0, 3.0], [5.0, 8.0], [6.0, 7.0]])
best_split(X, y)
```

```text
(1, 5.0, 0.0)
```
