## Why ranks and not scores

BM25 scores have no upper bound and change with the corpus. Cosine similarities are from -1 to 1. A weighted sum of the two raw scores needs a new weight for each corpus. RRF uses only ranks, so it needs no tuning to merge two retrievers.

## What k does

With $k = 60$, rank 1 adds $1/61$ and rank 10 adds $1/70$. The values fall slowly, so a document deep in one list still counts. A small $k$ gives most of the weight to the top ranks. The value 60 comes from the 2009 paper that introduced RRF.

## A document in only one list

A document that one retriever misses gets no score from that list. It can still rank high when the other list puts it near the top. This is the main gain of hybrid search: each retriever covers queries that the other misses.

## Tie rule

The lesson code sorts by score only. Python's sort is stable, so ties keep the order in which the ids first appear. This problem fixes the lower doc id first, so the output does not depend on the order of the lists.

## Where this goes next

The capstone sends the top documents of the fused list to a reranker. The evaluation lesson then measures the recall of the fused list against each retriever alone.
