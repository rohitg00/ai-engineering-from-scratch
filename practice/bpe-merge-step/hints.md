## Hint 1

Loop over the words and over the positions `i` from 0 to `len(symbols) - 2`. The pair at position `i` is `(symbols[i], symbols[i + 1])`. Add the word frequency to its count.

## Hint 2

For the tie rule, first find the highest count. Then collect every pair with that count and take the smallest one. Python compares tuples element by element, so `min` or `sorted` gives the smallest pair.

## Hint 3

Write `apply_merge` with a `while` loop and an index `i`. On a match, append `new_id` and add 2 to `i`. Otherwise append the symbol and add 1. A `for` loop cannot skip the second symbol of a match.

## Hint 4

In `train`, build a new dict for each step. Two words can become the same tuple after a merge, so add their frequencies. Check the best count before the merge, and stop when it is less than 2.
