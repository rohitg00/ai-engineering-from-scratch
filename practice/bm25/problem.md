BM25 is the standard ranking function for keyword search. It gives a high score to a document that contains rare query terms many times, and it corrects for the length of the document. Hybrid retrieval pipelines run BM25 next to a dense vector search.

## Task

Write three functions. The documents and the query are lists of tokens that are already tokenized.

1. `idf(corpus, term)` returns the inverse document frequency of one term.
2. `bm25_scores(corpus, query, k1=1.5, b=0.75)` returns the BM25 score of each document for the query.
3. `rank(corpus, query, top_k, k1=1.5, b=0.75)` returns the indices of the `top_k` documents with the highest scores.

Let $N$ be the number of documents. Let $n(t)$ be the number of documents that contain the term $t$ at least once. Use this idf:

$$\mathrm{idf}(t) = \ln\left(1 + \frac{N - n(t) + 0.5}{n(t) + 0.5}\right)$$

Let $f(t, d)$ be the number of times $t$ occurs in document $d$. Let $|d|$ be the number of tokens in $d$, and $\mathrm{avgdl}$ the mean of $|d|$ over all documents. The score of document $d$ is

$$\mathrm{score}(d) = \sum_{t \in \text{query}} \mathrm{idf}(t) \cdot \frac{f(t, d)\,(k_1 + 1)}{f(t, d) + k_1 \left(1 - b + b \frac{|d|}{\mathrm{avgdl}}\right)}$$

The sum runs over the query list. A term that occurs twice in the query adds its weight twice. A term with $f(t, d) = 0$ adds nothing.

Tie rule: `rank` sorts the scores from high to low. When two documents have the same score, the document with the lower index comes first.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `corpus` | list of lists of str | `N` documents | the tokens of each document |
| `query` | list of str | any length | the query tokens, repeats allowed |
| `term` | str | scalar | one token |
| `k1` | float | scalar | the term frequency saturation, default `1.5` |
| `b` | float | scalar | the length normalization weight from 0 to 1, default `0.75` |
| `top_k` | int | scalar | the number of indices to return |

- `idf` returns a Python `float`.
- `bm25_scores` returns a float array of shape `(N,)`. Entry `i` is the score of document `i`.
- `rank` returns a list of `top_k` int document indices, best first.

## Constraints

- `1 <= N <= 200` and each document has at most 200 tokens.
- A document can be empty, but at least one document has a token.
- `0 <= b <= 1`, `k1 > 0` and `1 <= top_k <= N`.
- Do not change the corpus or the query.
- Use Python and numpy only.

## Examples

```python
corpus = [
    ["the", "cat", "sat"],
    ["the", "dog", "sat", "on", "the", "mat"],
    ["cat", "cat", "food"],
    ["dogs", "and", "cats"],
]
idf(corpus, "cat"), idf(corpus, "zebra")
```

```text
(0.6931471805599453, 2.302585092994046)
```

```python
bm25_scores(corpus, ["cat", "sat"])
```

```text
[1.5234004  0.54578518 1.05823997 0.        ]
```

```python
rank(corpus, ["cat", "sat"], 3)
```

```text
[0, 2, 1]
```

Document 3 contains `cats`, not `cat`. Tokens must match exactly, so its score is 0.
