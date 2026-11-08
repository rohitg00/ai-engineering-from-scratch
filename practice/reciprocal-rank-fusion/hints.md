## Hint 1

Keep a dict from doc id to score. A `collections.defaultdict(float)` starts each new id at 0.

## Hint 2

Ranks start at 1. `enumerate(ranking, start=1)` gives the rank of each id.

## Hint 3

Pair each list with its weight with `zip`. Check the length of `weights` first, because `zip` stops at the shorter input without an error.

## Hint 4

Sort the `(doc_id, score)` pairs with the key `(-score, doc_id)`. The minus sign gives high scores first, and the doc id breaks ties.
