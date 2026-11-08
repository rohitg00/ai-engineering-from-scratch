## Hint 1

`np.unique(labels, return_counts=True)` gives the count of each class. Divide the counts by `n` to get the fractions.

## Hint 2

`np.unique(x)` returns the unique values in sorted order. For `m` unique values there are `m - 1` midpoints. A feature with one unique value has no midpoint.

## Hint 3

Use a boolean mask for each child: `y[x <= threshold]` and `y[x > threshold]`. Weight the impurity of each child by its share of the examples. The plain mean of the two impurities gives a small child too much weight.

## Hint 4

Keep the best result in a variable that starts as `None`. Replace it only when the new impurity is lower than the best impurity minus `1e-12`. Do the same over the features in `best_split`. This keeps the first candidate in every tie.
