A vector search finds the documents whose embeddings point in the same direction as a query embedding. Cosine similarity measures that direction and ignores the length of the vectors. The retrieval step of a RAG system starts with this search.

## Task

Write three functions.

1. `normalize_rows(X)` returns a copy of `X` with each row divided by its L2 norm.
2. `cosine_similarity_matrix(Q, D)` returns the cosine similarity of each query row against each document row.
3. `top_k(Q, D, k)` returns, for each query, the indices of the `k` documents with the highest cosine similarity.

The cosine similarity of vectors $q$ and $d$ is $\frac{q \cdot d}{\lVert q \rVert \, \lVert d \rVert}$.

Zero vector rule: a row with norm 0 has no direction. `normalize_rows` leaves it as a row of zeros. Its cosine similarity with any vector is `0.0`.

Tie rule: `top_k` sorts the scores from high to low. When two documents have the same score, the document with the lower index comes first.

## Input and output

| Name | Type | Shape | Meaning |
|---|---|---|---|
| `X` | float array | `(n, dim)` | any matrix of row vectors |
| `Q` | float array | `(n_queries, dim)` | one query embedding in each row |
| `D` | float array | `(n_docs, dim)` | one document embedding in each row |
| `k` | int | scalar | the number of documents to return for each query |

- `normalize_rows` returns a new float array of shape `(n, dim)`.
- `cosine_similarity_matrix` returns a float array of shape `(n_queries, n_docs)`. Entry `(i, j)` is the score of query `i` against document `j`.
- `top_k` returns an int array of shape `(n_queries, k)`. Row `i` holds document indices, best first.

## Constraints

- `1 <= n_queries <= 64`, `1 <= n_docs <= 1000` and `1 <= dim <= 1024`.
- `1 <= k <= n_docs`.
- Rows of `Q` and `D` can be zero vectors.
- Do not change the input arrays.
- Use numpy only.

## Examples

```python
normalize_rows(np.array([[3.0, 4.0], [0.0, 0.0], [0.0, -2.0]]))
```

```text
[[ 0.6  0.8]
 [ 0.   0. ]
 [ 0.  -1. ]]
```

```python
Q = np.array([[1.0, 0.0], [1.0, 1.0]])
D = np.array([[2.0, 0.0], [0.0, 3.0], [1.0, 1.0], [-1.0, 0.0]])
cosine_similarity_matrix(Q, D)
```

```text
[[ 1.          0.          0.70710678 -1.        ]
 [ 0.70710678  0.70710678  1.         -0.70710678]]
```

```python
top_k(Q, D, 2)
```

```text
[[0 2]
 [2 0]]
```

For the second query, documents 0 and 1 have the same score. The tie rule puts document 0 first.
