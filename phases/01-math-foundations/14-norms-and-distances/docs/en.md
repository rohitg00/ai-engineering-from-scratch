# Norms and Distances

> Your distance function defines what "similar" means. Choose wrong and everything downstream breaks.

**Type:** Build
**Language:** Python
**Prerequisites:** Phase 1, Lessons 01 (Linear Algebra Intuition), 02 (Vectors, Matrices & Operations)
**Time:** ~90 minutes

## Learning Objectives

- Implement L1, L2, cosine, Mahalanobis, Jaccard, and edit distance functions from scratch
- Select the appropriate distance metric for a given ML task and explain why alternatives fail
- Connect L1 and L2 norms to LASSO and Ridge regularization and their geometric constraint regions
- Demonstrate how the same dataset produces different nearest neighbors under different metrics

## The Problem

You have two vectors. Maybe they are word embeddings. Maybe they are user profiles. Maybe they are pixel arrays. You need to know: how close are they?

The answer depends entirely on which distance function you pick. Two data points can be nearest neighbors under one metric and far apart under another. Your KNN classifier, your recommendation engine, your vector database, your clustering algorithm, your loss function -- they all depend on this choice. Get it wrong and your model optimizes for the wrong thing.

There is no universal best distance. L2 works for spatial data. Cosine similarity dominates NLP. Jaccard handles sets. Edit distance handles strings. Mahalanobis accounts for correlations. Wasserstein moves probability mass. Each one encodes a different assumption about what "similar" means.

This lesson builds every major distance function from scratch, shows you when each one is the right tool, and demonstrates how the same data produces completely different nearest neighbors depending on which metric you use.

## The Concept

### Norms: measuring vector magnitude

A norm measures the "size" of a vector. Every distance function between two vectors can be written as the norm of their difference: d(a, b) = ||a - b||. So understanding norms is understanding distances.

### L1 Norm (Manhattan distance)

The L1 norm sums the absolute values of all components.

```
||x||_1 = |x_1| + |x_2| + ... + |x_n|
```

It is called Manhattan distance because it measures how far you walk on a city grid where you can only move along axes. No diagonals.

```
Point A = (1, 1)
Point B = (4, 5)

L1 distance = |4-1| + |5-1| = 3 + 4 = 7

On a grid, you walk 3 blocks east and 4 blocks north.
```

When to use L1:
- High-dimensional sparse data (text features, one-hot encodings)
- When you want robustness to outliers (a single huge difference does not dominate)
- Feature selection problems (L1 regularization promotes sparsity)

Connection to L1 regularization (Lasso): adding ||w||_1 to your loss function penalizes the sum of absolute weight values. This pushes small weights to exactly zero, performing automatic feature selection. The L1 penalty creates diamond-shaped constraint regions in weight space, and the corners of diamonds lie on the axes where some weights are zero.

Connection to loss functions: Mean Absolute Error (MAE) is the average L1 distance between predictions and targets. It penalizes all errors linearly, making it robust to outliers compared to MSE.

### L2 Norm (Euclidean distance)

The L2 norm is the straight-line distance. Square root of the sum of squared components.

```
||x||_2 = sqrt(x_1^2 + x_2^2 + ... + x_n^2)
```

This is the distance you learned in geometry class. Pythagoras in n dimensions.

```
Point A = (1, 1)
Point B = (4, 5)

L2 distance = sqrt((4-1)^2 + (5-1)^2) = sqrt(9 + 16) = sqrt(25) = 5.0

The straight line, cutting diagonally through the grid.
```

When to use L2:
- Low-to-medium dimensional continuous data
- When the feature scales are comparable
- Physical distances (spatial data, sensor readings)
- Image similarity at the pixel level

Connection to L2 regularization (Ridge): adding ||w||_2^2 to your loss function penalizes large weights. Unlike L1, it does not push weights to zero. It shrinks all weights toward zero proportionally. The L2 penalty creates circular constraint regions, so there are no corners on axes. Weights get small but rarely exactly zero.

Connection to loss functions: Mean Squared Error (MSE) is the average of L2 distances squared. Squaring penalizes large errors more heavily than small ones.

```
MAE (L1 loss):  |y - y_hat|         Linear penalty. Robust to outliers.
MSE (L2 loss):  (y - y_hat)^2       Quadratic penalty. Sensitive to outliers.
```

### Lp Norms: the general family

L1 and L2 are special cases of the Lp norm:

```
||x||_p = (|x_1|^p + |x_2|^p + ... + |x_n|^p)^(1/p)
```

Different values of p produce different shaped "unit balls" (the set of all points at distance 1 from the origin):

```
p=1:    Diamond shape      (corners on axes)
p=2:    Circle/sphere      (the usual round ball)
p=3:    Superellipse       (rounded square)
p=inf:  Square/hypercube   (flat sides along axes)
```

### L-infinity Norm (Chebyshev distance)

As p approaches infinity, the Lp norm converges to the maximum absolute component.

```
||x||_inf = max(|x_1|, |x_2|, ..., |x_n|)
```

The distance between two points is determined by the single dimension where they differ the most. All other dimensions are ignored.

```
Point A = (1, 1)
Point B = (4, 5)

L-inf distance = max(|4-1|, |5-1|) = max(3, 4) = 4
```

When to use L-infinity:
- When the worst-case deviation in any single dimension matters
- Game boards (a king in chess moves in L-infinity: one step in any direction costs 1)
- Manufacturing tolerances (every dimension must be within spec)

### Cosine Similarity and Cosine Distance

Cosine similarity measures the angle between two vectors, ignoring their magnitudes.

```
cos_sim(a, b) = (a . b) / (||a||_2 * ||b||_2)
```

It ranges from -1 (opposite directions) to +1 (same direction). Perpendicular vectors have cosine similarity 0.

Cosine distance converts it to a distance: cosine_distance = 1 - cosine_similarity. This ranges from 0 (identical direction) to 2 (opposite direction).

```
a = (1, 0)    b = (1, 1)

cos_sim = (1*1 + 0*1) / (1 * sqrt(2)) = 1/sqrt(2) = 0.707
cos_dist = 1 - 0.707 = 0.293
```

Why cosine dominates NLP and embeddings: in text, document length should not affect similarity. A document about cats that is twice as long as another document about cats should still be "similar." Cosine similarity ignores magnitude (length) and only cares about direction. Two documents with the same word distribution but different lengths point in the same direction and get cosine similarity 1.0.

When to use cosine similarity:
- Text similarity (TF-IDF vectors, word embeddings, sentence embeddings)
- Any domain where magnitude is noise and direction is signal
- Recommendation systems (user preference vectors)
- Embedding search (vector databases almost always use cosine or dot product)

### Dot Product Similarity vs Cosine Similarity

The dot product of two vectors is:

```
a . b = a_1*b_1 + a_2*b_2 + ... + a_n*b_n
      = ||a|| * ||b|| * cos(angle)
```

Cosine similarity is the dot product normalized by both magnitudes. When both vectors are already unit-normalized (magnitude = 1), dot product and cosine similarity are identical.

```
If ||a|| = 1 and ||b|| = 1:
    a . b = cos(angle between a and b)
```

When they differ: dot product includes magnitude information. A vector with larger magnitude gets a higher dot product score. This matters in some retrieval systems where you want "popular" items to rank higher. The magnitude acts as an implicit quality or importance signal.

```
a = (3, 0)    b = (1, 0)    c = (0, 1)

dot(a, b) = 3     dot(a, c) = 0
cos(a, b) = 1.0   cos(a, c) = 0.0

Both agree on direction, but dot product also reflects magnitude.
```

In practice:
- Use cosine similarity when you want pure directional similarity
- Use dot product when magnitudes carry meaningful information
- Many vector databases (Pinecone, Weaviate, Qdrant) let you choose between them
- If your embeddings are L2-normalized, the choice does not matter

### Mahalanobis Distance

Euclidean distance treats all dimensions equally. But if your features are correlated or have different scales, L2 gives misleading results.

Mahalanobis distance accounts for the covariance structure of the data.

```
d_M(x, y) = sqrt((x - y)^T * S^(-1) * (x - y))
```

where S is the covariance matrix of the data.

Intuitively: Mahalanobis distance first decorrelates and normalizes the data (whitening), then computes L2 distance in that transformed space. If S is the identity matrix (uncorrelated, unit variance features), Mahalanobis distance reduces to Euclidean distance.

```
Example: height and weight are correlated.
Someone 6'2" and 180 lbs is not unusual.
Someone 5'0" and 180 lbs is unusual.

Euclidean distance might say they are equally far from the mean.
Mahalanobis distance correctly identifies the second as an outlier
because it accounts for the height-weight correlation.
```

When to use Mahalanobis distance:
- Outlier detection (points with large Mahalanobis distance from the mean are outliers)
- Classification when features have different scales and correlations
- When you have enough data to estimate a reliable covariance matrix
- Quality control in manufacturing (multivariate process monitoring)

### Jaccard Similarity (for sets)

Jaccard similarity measures overlap between two sets.

```
J(A, B) = |A intersect B| / |A union B|
```

It ranges from 0 (no overlap) to 1 (identical sets). Jaccard distance = 1 - Jaccard similarity.

```
A = {cat, dog, fish}
B = {cat, bird, fish, snake}

Intersection = {cat, fish}         size = 2
Union = {cat, dog, fish, bird, snake}  size = 5

Jaccard similarity = 2/5 = 0.4
Jaccard distance = 0.6
```

When to use Jaccard:
- Comparing sets of tags, categories, or features
- Document similarity based on word presence (not frequency)
- Near-duplicate detection (MinHash approximation of Jaccard)
- Comparing binary feature vectors (presence/absence data)
- Evaluating segmentation models (Intersection over Union = Jaccard)

### Edit Distance (Levenshtein Distance)

Edit distance counts the minimum number of single-character operations needed to transform one string into another. The operations are: insert, delete, or substitute.

```
"kitten" -> "sitting"

kitten -> sitten  (substitute k -> s)
sitten -> sittin  (substitute e -> i)
sittin -> sitting (insert g)

Edit distance = 3
```

Computed using dynamic programming. Fill a matrix where entry (i, j) is the edit distance between the first i characters of string A and the first j characters of string B.

```
        ""  s  i  t  t  i  n  g
    ""   0  1  2  3  4  5  6  7
    k    1  1  2  3  4  5  6  7
    i    2  2  1  2  3  4  5  6
    t    3  3  2  1  2  3  4  5
    t    4  4  3  2  1  2  3  4
    e    5  5  4  3  2  2  3  4
    n    6  6  5  4  3  3  2  3
```

When to use edit distance:
- Spell checking and correction
- DNA sequence alignment (with weighted operations)
- Fuzzy string matching
- Deduplication of messy text data

### KL Divergence (not a distance, but used like one)

KL divergence measures how one probability distribution differs from another. Covered in Lesson 09, but it belongs in this discussion because people use it as a "distance" despite it not being one.

```
D_KL(P || Q) = sum(p(x) * log(p(x) / q(x)))
```

Critical property: KL divergence is NOT symmetric.

```
D_KL(P || Q) != D_KL(Q || P)
```

This means it fails the basic requirement of a distance metric. It also does not satisfy the triangle inequality. It is a divergence, not a distance.

Forward KL (D_KL(P || Q)) is "mean-seeking": Q tries to cover all modes of P.
Reverse KL (D_KL(Q || P)) is "mode-seeking": Q focuses on a single mode of P.

When you see KL divergence:
- VAEs (the KL term in the ELBO pushes the latent distribution toward a prior)
- Knowledge distillation (student tries to match teacher's distribution)
- RLHF (the KL penalty keeps the fine-tuned model close to the base model)
- Policy gradient methods (constraining policy updates)

### Wasserstein Distance (Earth Mover's Distance)

Wasserstein distance measures the minimum "work" needed to transform one probability distribution into another. Think of it as: if one distribution is a pile of dirt and the other is a hole, how much dirt do you have to move and how far?

```
W(P, Q) = inf over all transport plans gamma of E[d(x, y)]
```

For 1D distributions, it simplifies to the integral of the absolute difference of the cumulative distribution functions:

```
W_1(P, Q) = integral |CDF_P(x) - CDF_Q(x)| dx
```

Why Wasserstein matters:
- It is a true metric (symmetric, satisfies triangle inequality)
- It provides gradients even when distributions do not overlap (KL divergence goes to infinity)
- This property made it central to Wasserstein GANs (WGANs), which solved the training instability of original GANs

```
Distributions with no overlap:

P: [1, 0, 0, 0, 0]    Q: [0, 0, 0, 0, 1]

KL divergence: infinity (log of zero)
Wasserstein: 4 (move all mass 4 bins)

Wasserstein gives a meaningful gradient. KL does not.
```

When to use Wasserstein:
- GAN training (WGAN, WGAN-GP)
- Comparing distributions that may not overlap
- Optimal transport problems
- Image retrieval (comparing color histograms)

### Why Different Tasks Need Different Distances

| Task | Best distance | Why |
|------|--------------|-----|
| Text similarity | Cosine | Magnitude is noise, direction is meaning |
| Image pixel comparison | L2 | Spatial relationships matter, features are comparable scale |
| Sparse high-dim features | L1 | Robust, does not amplify rare large differences |
| Set overlap (tags, categories) | Jaccard | Data is naturally set-valued, not vectorial |
| String matching | Edit distance | Operations map to human editing intuition |
| Outlier detection | Mahalanobis | Accounts for feature correlations and scales |
| Comparing distributions | KL divergence | Measures information lost by using Q instead of P |
| GAN training | Wasserstein | Provides gradients even when distributions do not overlap |
| Embeddings (vector DB) | Cosine or dot product | Embeddings are trained to encode meaning in direction |
| Recommendation | Dot product | Magnitude can encode popularity or confidence |
| DNA sequences | Weighted edit distance | Substitution costs vary by nucleotide pair |
| Manufacturing QC | L-infinity | Worst-case deviation in any dimension matters |

### Connection to Loss Functions

Loss functions are distance functions applied to predictions vs targets.

```
Loss function       Distance it uses       Behavior
MSE                 L2 squared             Penalizes large errors heavily
MAE                 L1                     Penalizes all errors equally
Huber loss          L1 for large errors,   Best of both: robust to outliers,
                    L2 for small errors    smooth gradient near zero
Cross-entropy       KL divergence          Measures distribution mismatch
Hinge loss          max(0, margin - d)     Only penalizes below margin
Triplet loss        L2 (typically)         Pulls positives close, pushes
                                           negatives away
Contrastive loss    L2                     Similar pairs close, dissimilar
                                           pairs beyond margin
```

### Connection to Regularization

Regularization adds a norm penalty on the weights to the loss function.

```
L1 regularization (Lasso):   loss + lambda * ||w||_1
  -> Sparse weights. Some weights become exactly zero.
  -> Automatic feature selection.
  -> Solution has corners (non-differentiable at zero).

L2 regularization (Ridge):   loss + lambda * ||w||_2^2
  -> Small weights. All weights shrink toward zero.
  -> No feature selection (nothing goes to exactly zero).
  -> Smooth solution everywhere.

Elastic Net:                  loss + lambda_1 * ||w||_1 + lambda_2 * ||w||_2^2
  -> Combines sparsity of L1 with stability of L2.
  -> Groups of correlated features are kept or dropped together.
```

Why L1 produces sparsity but L2 does not: picture the constraint region in 2D weight space. L1 is a diamond, L2 is a circle. The loss function's contours (ellipses) are most likely to touch the diamond at a corner, where one weight is zero. They touch the circle at a smooth point, where both weights are nonzero.

### Nearest Neighbor Search

Every distance function implies a nearest neighbor search problem: given a query point, find the closest points in a dataset.

Exact nearest neighbor search is O(n * d) per query in a dataset of n points with d dimensions. For large datasets, this is too slow.

Approximate Nearest Neighbor (ANN) algorithms trade a small amount of accuracy for massive speed gains:

```
Algorithm         Approach                      Used by
KD-trees          Axis-aligned space partition   scikit-learn (low-dim)
Ball trees        Nested hyperspheres            scikit-learn (medium-dim)
LSH               Random hash projections        Near-duplicate detection
HNSW              Hierarchical navigable         FAISS, Qdrant, Weaviate
                  small-world graph
IVF               Inverted file index with       FAISS (billion-scale)
                  cluster-based search
Product quant.    Compress vectors, search       FAISS (memory-constrained)
                  in compressed space
```

HNSW (Hierarchical Navigable Small World) is the dominant algorithm in modern vector databases. It builds a multi-layer graph where each node connects to its approximate nearest neighbors. Search starts at the top layer (sparse, long jumps) and descends to the bottom layer (dense, short jumps).

## Build It

### Step 1: All norm and distance functions

See `code/distances.py` for the complete implementation. Every function is built from scratch using only basic Python math.

### Step 2: Same data, different distances, different neighbors

The demo in `distances.py` creates a dataset, picks a query point, and shows how the nearest neighbor changes depending on the distance metric. The point that is "closest" under L1 may not be closest under L2 or cosine.

### Step 3: Embedding similarity search

The code includes a mock embedding similarity search that finds the most similar "documents" to a query using cosine similarity vs L2 distance, showing that the rankings can differ.

## Use It

The most common practical use: finding similar items in a vector database.

```python
import numpy as np

def cosine_similarity_matrix(X):
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1, norms)
    X_normalized = X / norms
    return X_normalized @ X_normalized.T

embeddings = np.random.randn(1000, 768)

sim_matrix = cosine_similarity_matrix(embeddings)

query_idx = 0
similarities = sim_matrix[query_idx]
top_k = np.argsort(similarities)[::-1][1:6]
print(f"Top 5 most similar to item 0: {top_k}")
print(f"Similarities: {similarities[top_k]}")
```

When you call `model.encode(text)` and then search a vector database, this is what happens under the hood. The embedding model maps text to vectors. The vector database computes cosine similarity (or dot product) between your query vector and every stored vector, using ANN algorithms to avoid checking all of them.

## Exercises

1. Compute L1, L2, and L-infinity distances between (1, 2, 3) and (4, 0, 6). Verify that L-inf <= L2 <= L1 always holds for any pair of points. Prove why this ordering is guaranteed.

2. Create two vectors where cosine similarity is high (> 0.9) but L2 distance is large (> 10). Explain geometrically what is happening. Then create two vectors where cosine similarity is low (< 0.3) but L2 distance is small (< 0.5).

3. Implement a function that takes a dataset and a query point and returns the nearest neighbor under L1, L2, cosine, and Mahalanobis distance. Find a dataset where all four disagree on which point is nearest.

4. Compute the Wasserstein distance between [0.5, 0.5, 0, 0] and [0, 0, 0.5, 0.5] by hand using the CDF method. Then compute it between [0.25, 0.25, 0.25, 0.25] and [0, 0, 0.5, 0.5]. Which is larger and why?

5. Implement MinHash for approximate Jaccard similarity. Generate 100 random sets, compute exact Jaccard for all pairs, and compare with MinHash approximation using 50, 100, and 200 hash functions. Plot the approximation error.

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Norm | "Size of a vector" | A function that maps a vector to a non-negative scalar, satisfying triangle inequality, absolute homogeneity, and zero only for the zero vector |
| L1 norm | "Manhattan distance" | Sum of absolute component values. Produces sparsity in optimization. Robust to outliers |
| L2 norm | "Euclidean distance" | Square root of sum of squared components. The straight-line distance in Euclidean space |
| Lp norm | "Generalized norm" | The p-th root of the sum of p-th powers of absolute components. L1 and L2 are special cases |
| L-infinity norm | "Max norm" or "Chebyshev distance" | The maximum absolute component value. The limit of Lp as p approaches infinity |
| Cosine similarity | "Angle between vectors" | Dot product normalized by both magnitudes. Ranges from -1 to +1. Ignores vector length |
| Cosine distance | "1 minus cosine similarity" | Converts cosine similarity to a distance. Ranges from 0 to 2 |
| Dot product | "Unnormalized cosine" | Sum of component-wise products. Equals cosine similarity times both magnitudes |
| Mahalanobis distance | "Correlation-aware distance" | L2 distance in a space that has been whitened (decorrelated and normalized) using the data covariance matrix |
| Jaccard similarity | "Set overlap" | Size of intersection divided by size of union. For sets, not vectors |
| Edit distance | "Levenshtein distance" | Minimum insertions, deletions, and substitutions to transform one string into another |
| KL divergence | "Distance between distributions" | Not a true distance (not symmetric). Measures extra bits from using Q to encode P |
| Wasserstein distance | "Earth mover's distance" | Minimum work to transport mass from one distribution to another. A true metric |
| Approximate nearest neighbor | "ANN search" | Algorithms (HNSW, LSH, IVF) that find approximately closest points much faster than exact search |
| HNSW | "The vector DB algorithm" | Hierarchical Navigable Small World graph. Multi-layer graph for fast approximate nearest neighbor search |
| L1 regularization | "Lasso" | Adding the L1 norm of weights to the loss. Drives weights to zero (sparsity) |
| L2 regularization | "Ridge" or "weight decay" | Adding the squared L2 norm of weights to the loss. Shrinks weights toward zero without sparsity |
| Elastic Net | "L1 + L2" | Combines L1 and L2 regularization. Handles correlated feature groups better than either alone |

## Further Reading

- [FAISS: A Library for Efficient Similarity Search](https://github.com/facebookresearch/faiss) - Meta's library for billion-scale ANN search
- [Wasserstein GAN (Arjovsky et al., 2017)](https://arxiv.org/abs/1701.07875) - the paper that introduced Earth Mover's distance to GANs
- [Locality-Sensitive Hashing (Indyk & Motwani, 1998)](https://dl.acm.org/doi/10.1145/276698.276876) - foundational ANN algorithm
- [Efficient Estimation of Word Representations (Mikolov et al., 2013)](https://arxiv.org/abs/1301.3781) - Word2Vec, where cosine similarity became the default for embeddings
- [sklearn.neighbors documentation](https://scikit-learn.org/stable/modules/neighbors.html) - practical guide to distance metrics and neighbor algorithms in scikit-learn
