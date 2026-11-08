## Hint 1

Compute `avgdl` once from the lengths of all documents. Count the tokens of each document with `collections.Counter`.

## Hint 2

For `n(t)`, count documents, not occurrences. A document that contains the term three times adds 1 to `n(t)`.

## Hint 3

Loop over the query list as it is. Do not turn it into a set, because a repeated query term must add its weight again.

## Hint 4

The length factor is `1 - b + b * dl / avgdl`. It equals 1 for a document of mean length. Multiply it by `k1` and add `f` to get the denominator. For the ranking, sort the indices by the key `(-score, index)`.
