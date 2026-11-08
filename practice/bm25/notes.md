## What k1 does

The term weight $f (k_1 + 1) / (f + k_1)$ grows with $f$ but never passes $k_1 + 1$. The tenth occurrence of a term adds much less than the first. A small $k_1$ saturates fast. A large $k_1$ acts more like raw term frequency.

## What b does

With $b = 1$, a document twice the mean length needs about twice the term count for the same weight. With $b = 0$, length has no effect. The default $b = 0.75$ sits between the two.

## Why the 1 + in the idf

The classic Robertson idf $\ln((N - n + 0.5) / (n + 0.5))$ is negative when a term occurs in more than half of the documents. A negative weight lets a common word push a good document down. The 1 + keeps every idf above 0. Lucene uses the same form.

## Tie rule

The lesson sorts `(score, index)` tuples with `reverse=True`, so equal scores put the higher index first. This problem fixes the lower index first, to match the other retrieval problems. Ties are common in BM25, because every document without a query term scores exactly 0.

## Where this goes next

The hybrid retrieval capstone runs this index next to a dense search and merges the two lists with reciprocal rank fusion.
