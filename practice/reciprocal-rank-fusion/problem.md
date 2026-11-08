Reciprocal rank fusion (RRF) merges ranked lists from different retrievers into one list. It uses only the rank of each document, not the raw score. A BM25 score and a cosine similarity have different scales, but their ranks are comparable. Hybrid search uses RRF to merge keyword and vector results.

## Task

Write two functions.

1. `rrf_scores(rankings, k=60, weights=None)` returns the fused score of each document.
2. `fuse(rankings, k=60, weights=None)` returns the documents sorted by fused score.

Each ranking is a list of document ids, best first. The first document of a list has rank 1. The fused score of document $d$ is

$$\mathrm{RRF}(d) = \sum_{i} \frac{w_i}{k + \mathrm{rank}_i(d)}$$

The sum runs over the lists that contain $d$. A list that does not contain $d$ adds nothing. When `weights` is `None`, every $w_i$ is 1.

If `weights` is not `None` and its length is not the number of lists, raise `ValueError`.

Tie rule: `fuse` sorts from the highest score to the lowest. When two documents have the same score, the lower doc id comes first.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `rankings` | list of lists of int | `L` lists | each list holds distinct doc ids, best first |
| `k` | int | scalar | the RRF constant, default `60` |
| `weights` | list of float or `None` | `L` values | the weight of each list |

- `rrf_scores` returns a `dict` that maps each doc id in any list to its fused score as a `float`.
- `fuse` returns a `list` of `(doc_id, score)` tuples, best first. It holds every document of `rrf_scores`.

## Constraints

- `0 <= L <= 10` and each list has at most 1000 ids. A list can be empty.
- Doc ids are non negative ints. An id occurs at most once in one list.
- `k >= 1` and each weight is positive.
- Do not change the input lists.
- Use Python and numpy only.

## Examples

```python
bm25 = [3, 1, 4]
dense = [1, 5, 3]
fuse([bm25, dense])
```

```text
[(1, 0.03252247488101534), (3, 0.032266458495966696), (5, 0.016129032258064516), (4, 0.015873015873015872)]
```

Document 1 has ranks 2 and 1, so its score is $1/62 + 1/61$. Document 3 has ranks 1 and 3, so its score is $1/61 + 1/63$. Document 1 comes first.

```python
fuse([bm25, dense], weights=[2.0, 1.0])
```

```text
[(3, 0.04865990111891751), (1, 0.048651507139079855), (4, 0.031746031746031744), (5, 0.016129032258064516)]
```
