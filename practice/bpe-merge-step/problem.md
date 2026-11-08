Byte-Pair Encoding builds a tokenizer vocabulary from a corpus. It counts how often each pair of adjacent symbols occurs. It merges the most frequent pair into a new symbol. Then it repeats. The merge list that this loop makes is the tokenizer that a language model reads its text with.

## Task

The corpus is a dict. Each key is a word as a tuple of integer symbol ids. Each value is the number of times the word occurs.

Write four functions.

1. `count_pairs(units)` returns a dict from each adjacent pair `(a, b)` to its count. A pair in a word adds the frequency of the word. Pairs do not cross from one word to the next.
2. `best_pair(pairs)` returns the pair with the highest count. When two or more pairs have the highest count, return the smallest pair in tuple order. For example, `(2, 9)` is smaller than `(5, 1)`. When `pairs` is empty, return `None`.
3. `apply_merge(symbols, pair, new_id)` returns a tuple in which each occurrence of `pair` is replaced by `new_id`. Scan from left to right. After a match, continue after the second symbol of the match, so two matches never share a symbol.
4. `train(units, num_merges, first_id=256)` runs up to `num_merges` merge steps. Each step counts the pairs, picks the best pair and merges it in every word. Merge number $i$, from 0, gets the id `first_id + i`. Stop early when there are no pairs or when the best pair has a count less than 2.

`train` returns a tuple `(merges, units)`. `merges` is a list of `(pair, new_id)` tuples in training order. `units` is the merged corpus as a new dict.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `units` | dict of tuple of int to int | any number of words | each word as a tuple of symbol ids, mapped to its frequency |
| `pairs` | dict of tuple to int | any size | pair counts, as `count_pairs` returns them |
| `symbols` | tuple of int | length 0 or more | one word |
| `pair` | tuple of two int | `(a, b)` | the pair to merge |
| `new_id` | int | scalar | the id of the merged symbol |
| `num_merges` | int | scalar | the largest number of merges, 0 or more |
| `first_id` | int | scalar | the id of the first merge |

- `count_pairs` returns a dict from pair tuples to int.
- `best_pair` returns a tuple of two int, or `None`.
- `apply_merge` returns a tuple of int.
- `train` returns a tuple `(list of (pair, int), dict)`.

## Constraints

- Up to 100 words, each of length 0 to 20. Frequencies are 1 or more.
- `new_id` and the ids from `first_id` do not occur in the corpus before the merge.
- Do not change the input dict or the input tuples.
- Use Python and the standard library. numpy is available.

## Examples

```python
units = {(1, 2, 3): 5, (1, 2): 3, (2, 3, 2, 3): 2}
count_pairs(units)
```

```text
{(1, 2): 8, (2, 3): 9, (3, 2): 2}
```

```python
apply_merge((7, 7, 7), (7, 7), 300)
```

```text
(300, 7)
```

```python
words = {tuple(b"low"): 5, tuple(b"lower"): 2, tuple(b"newest"): 6, tuple(b"widest"): 3}
train(words, 4)
```

```text
([((101, 115), 256), ((256, 116), 257), ((108, 111), 258), ((258, 119), 259)],
 {(259,): 5, (259, 101, 114): 2, (110, 101, 119, 257): 6, (119, 105, 100, 257): 3})
```

In the first step, `(101, 115)` and `(115, 116)` both have count 9. The smaller pair `(101, 115)` wins the tie.
