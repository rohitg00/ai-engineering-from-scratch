K-means groups points into `k` clusters. It repeats two steps. The assignment step sends each point to its nearest centroid. The update step moves each centroid to the mean of its points. The run stops when no point changes its cluster.

## Task

Write three functions.

1. `assign(X, centroids)` returns the index of the nearest centroid for each point, by squared Euclidean distance.
2. `update(X, assignments, centroids)` returns the new centroids. Centroid $j$ is the mean of the points with assignment $j$.
3. `kmeans(X, init_centroids, max_iterations=100)` runs the two steps from the given centroids and returns `(centroids, assignments, iterations)`.

Use these rules.

- Tie rule: when two or more centroids are at the same distance from a point, the point goes to the lowest index.
- Empty cluster rule: when no point has assignment $j$, centroid $j$ keeps its old value.

`kmeans` does these steps.

1. Compute the assignments for the initial centroids.
2. Repeat for $t = 1, 2, \ldots,$ `max_iterations`:
    - Update the centroids with the current assignments.
    - Compute the new assignments for the new centroids.
    - When the new assignments are equal to the old ones, stop and return the new centroids, the assignments and $t$.
3. When no stop occurs, return the centroids and assignments of the last pass and `max_iterations`.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `X` | float array | `(n, d)` | one point in each row |
| `centroids` | float array | `(k, d)` | one centroid in each row |
| `assignments` | int array | `(n,)` | the cluster of each point, from `0` to `k - 1` |
| `init_centroids` | float array | `(k, d)` | the start centroids for `kmeans` |
| `max_iterations` | int | scalar | the largest number of update steps |

- `assign` returns an int array of shape `(n,)`.
- `update` returns a new float array of shape `(k, d)`.
- `kmeans` returns a float array of shape `(k, d)`, an int array of shape `(n,)` and an `int`.

## Constraints

- `1 <= n <= 2000`, `1 <= k <= 20` and `1 <= d <= 20`.
- Do not change the input arrays.
- Use numpy only. Do not use random numbers. The start centroids are given.

## Examples

```python
X = np.array([[0.0, 0.0], [1.0, 0.0], [0.0, 1.0], [5.0, 5.0], [6.0, 5.0], [5.0, 6.0]])
C = np.array([[0.0, 0.0], [1.0, 1.0]])
assign(X, C)
```

```text
[0 0 0 1 1 1]
```

The points `[1, 0]` and `[0, 1]` are at the same distance from both centroids. The tie rule sends them to cluster 0.

```python
update(X, np.array([0, 0, 0, 1, 1, 1]), C)
```

```text
[[0.33333333 0.33333333]
 [5.33333333 5.33333333]]
```

```python
X = np.array([[0.0], [1.0], [2.0], [10.0], [11.0], [12.0], [20.0]])
kmeans(X, np.array([[0.0], [1.0], [2.0]]))
```

```text
(array([[ 0.  ],
       [ 1.5 ],
       [13.25]]), array([0, 1, 1, 2, 2, 2, 2]), 2)
```
