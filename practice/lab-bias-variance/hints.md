## Hint 1

`predictions.mean(axis=0)` gives the mean prediction at each test point. It has shape `(T,)`.

## Hint 2

`np.var` divides by $B$ by default. That choice makes the error split exactly into bias squared plus variance plus noise. Test the identity on your own random arrays.

## Hint 3

In `sweep_degrees`, fill an array of shape `(n_rounds, X_TEST.size)` for each degree. Use the seed `seed + b` for round `b`, so that every degree sees the same training sets.

## Hint 4

For the ties in `best_degree`, visit the degrees in increasing order and keep the first minimum.
