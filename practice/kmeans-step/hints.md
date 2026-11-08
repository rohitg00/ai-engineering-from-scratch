## Hint 1

Broadcast to get every difference at the same time. `X[:, None, :] - centroids[None, :, :]` has shape `(n, k, d)`.

## Hint 2

Sum the squared differences over the last axis to get a distance matrix of shape `(n, k)`. `np.argmin(..., axis=1)` returns the first index of the smallest value, so it follows the tie rule.

## Hint 3

In `update`, start from a float copy of the old centroids. Then replace centroid `j` with `X[assignments == j].mean(axis=0)` only when that selection has at least one row.

## Hint 4

In `kmeans`, keep the old assignments in a variable. Compare them with the new ones with `np.array_equal`. The counter is the number of update steps, so a stop after the first update gives 1.
