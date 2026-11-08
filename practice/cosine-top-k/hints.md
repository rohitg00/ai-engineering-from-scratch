## Hint 1

Use `np.linalg.norm(X, axis=1, keepdims=True)` to get one norm for each row, with shape `(n, 1)`.

## Hint 2

A zero norm gives a division by zero. Replace each zero norm with 1 before you divide. A zero row divided by 1 stays a zero row, so its scores are 0.

## Hint 3

After you normalize both matrices, one matrix product gives all the scores. The shape of the result is `(n_queries, n_docs)`.

## Hint 4

Sort the negated scores with `np.argsort(..., axis=1, kind="stable")`. A stable sort keeps equal scores in index order, so the lower index comes first. Then keep the first `k` columns.
