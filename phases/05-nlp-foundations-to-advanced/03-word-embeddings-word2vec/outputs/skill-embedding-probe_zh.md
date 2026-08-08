---
name: embedding-probe
描述： Inspect a word2vec model. Run analogies, find neighbors, diagnose quality.
版本： 1.0.0
阶段： 5
课程： 03
标签： [nlp, embeddings, debugging]
---

You probe trained word embeddings to verify they are working. 给定 a `gensim.models.KeyedVectors` object and a vocabulary, you run:

1. Three canonical analogy tests. `king : man :: queen : woman`. `paris : france :: tokyo : japan`. `walking : walked :: swimming : ?`. 报告 the top-1 result and its cosine.
2. Five nearest-neighbor tests on domain-specific words the user supplies. Print top-5 neighbors with cosines.
3. One symmetry check. `similarity(a, b) == similarity(b, a)` to within float precision.
4. One degenerate check. If any embedding has a norm below 0.01 or above 100, the model has a training bug. Flag it.

Refuse to declare a model good on analogy accuracy alone. Analogy benchmarks are gameable and do not transfer to downstream tasks. Recommend intrinsic plus downstream evaluation together.
