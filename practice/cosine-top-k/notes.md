## Why normalize first

After normalization every nonzero row has length 1. The dot product of two unit vectors is the cosine of the angle between them. One matrix product then scores every query against every document. Many vector indexes store normalized embeddings for this reason and search with the dot product.

## The zero vector

A zero vector has no direction, so the cosine is not defined. The lesson function `cosine_similarity` returns 0 for this case. A zero embedding can come from an empty chunk or from a text with no known words. If you divide by its norm, you get NaN, and NaN breaks the sort.

## The tie rule

Exact ties occur more often than you expect. Duplicate chunks give the same score, and so do zero vectors. A stable sort on the negated scores keeps index order inside a tie. The lesson gets the same order from the Python sort with `reverse=True`, which is also stable.

## Where this goes next

The RAG lessons use this search as the first stage. A reranker or a fusion step with BM25 then reorders the top candidates.
