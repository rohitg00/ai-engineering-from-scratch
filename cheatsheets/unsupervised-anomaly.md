---
id: unsupervised-anomaly
title: Clustering, Dimensionality Reduction and Anomalies
code: CD
subtitle: Cluster, reduce and flag outliers without labels. K-Means, DBSCAN, GMM, PCA, Isolation Forest, LOF.
hue: 280
sources: phases/02-ml-fundamentals/07-unsupervised-learning, phases/02-ml-fundamentals/16-anomaly-detection, phases/01-math-foundations/10-dimensionality-reduction
source_hash: 3ccb116dd003a31f
---

## Three jobs without labels
type: architecture
from: phases/02-ml-fundamentals/07-unsupervised-learning/docs/en.md, phases/02-ml-fundamentals/16-anomaly-detection/docs/en.md, phases/01-math-foundations/10-dimensionality-reduction/docs/en.md

```arch
node | raw | 1,2 | Raw data | no labels
node | pca | 2,1 | PCA | keep 90-95% variance
node | clu | 3,1 | Clustering | K-Means, DBSCAN, GMM
node | det | 2,3 | Detector | Isolation Forest, LOF
node | rec | 3,2 | Reconstruction error | high error is an outlier
node | score | 3,3 | Anomaly score | rank, then threshold
node | flag | 4,2 | Flagged points | human review
edge | raw | pca |
edge | pca | clu | reduced
edge | pca | rec |
edge | raw | det |
edge | det | score |
edge | rec | flag |
edge | score | flag |
```

## From-scratch calls
type: task-table
from: phases/02-ml-fundamentals/07-unsupervised-learning/code/clustering.py, phases/01-math-foundations/10-dimensionality-reduction/code/dim_reduction.py, phases/02-ml-fundamentals/16-anomaly-detection/code/anomaly_detection.py

| Task | Code |
|---|---|
| K clusters, hard labels | `kmeans(data, k=3)` |
| Inertia and silhouette per K | `find_best_k(data, max_k=6)` |
| Dense regions, noise is -1 | `dbscan(data, eps=1.5, min_samples=5)` |
| Soft labels with EM | `gmm(data, k=3)` |
| Project to 2 axes | `PCA(n_components=2).fit_transform(X)` |
| Separate rings | `kernel_pca(X, n_components, kernel="rbf", gamma=1.0)` |
| Flag by standard deviations | `zscore_detect(X, threshold=3.0)` |
| Flag outside the fences | `iqr_detect(X, factor=1.5)` |

## The same in sklearn
type: annotated-code
lang: python
from: phases/02-ml-fundamentals/07-unsupervised-learning/docs/en.md, phases/02-ml-fundamentals/16-anomaly-detection/docs/en.md, phases/01-math-foundations/10-dimensionality-reduction/docs/en.md

```python
km = KMeans(n_clusters=3, random_state=42).fit(data)
db = DBSCAN(eps=1.5, min_samples=5).fit(data)
gmm_model = GaussianMixture(n_components=3, random_state=42).fit(data)
sklearn_pca = SklearnPCA(n_components=2)          # explained_variance_ratio_
tsne = TSNE(n_components=2, perplexity=30, random_state=42)
reducer = UMAP(n_components=2, n_neighbors=15, min_dist=0.1, random_state=42)
iso = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
iso.fit(X_train)                                  # fit on normal data
lof = LocalOutlierFactor(n_neighbors=20, contamination=0.05, novelty=True)
oc_svm = OneClassSVM(kernel="rbf", gamma="auto", nu=0.05)
```

## Formulas
type: concepts
from: phases/02-ml-fundamentals/07-unsupervised-learning/docs/en.md, phases/02-ml-fundamentals/16-anomaly-detection/docs/en.md, phases/01-math-foundations/10-dimensionality-reduction/docs/en.md

- **Inertia**: sum of squared distances from each point to its centroid. Lower is tighter.
- **Silhouette**: $(b - a) / \max(a, b)$, from -1 (wrong cluster) to +1.
- **Z-score**: $(x - \text{mean}) / \text{std}$. Flag when the absolute value passes the threshold.
- **IQR fences**: $Q1 - \text{factor} \cdot IQR$ and $Q3 + \text{factor} \cdot IQR$, with $IQR = Q3 - Q1$.
- **Isolation score**: $2^{-\text{average\_path\_length}(x) / c(n)}$. Near 1 is an anomaly, near 0.5 is normal.
- **c(n)**: `2 * H(n-1) - 2*(n-1)/n`, expected path length of a failed search.
- **Explained ratio**: $\text{eigenvalue}_k / \sum \text{all eigenvalues}$
- **PCA fraction lost**: dropped eigenvalues over all eigenvalues.

## Clustering: use X when
type: command-table
from: phases/02-ml-fundamentals/07-unsupervised-learning/docs/en.md

| Command | What it does |
|---|---|
| K-Means | Large data, spherical clusters, known K. Hurt by outliers |
| DBSCAN | Unknown K, any shape, finds noise. Fails on varying density |
| Hierarchical | Small data, needs a dendrogram. $O(n^2)$ memory |
| GMM | Overlapping, elliptical clusters, soft assignments |
| Ward linkage | Merge with the smallest rise in within-cluster variance |

## Reduce and detect: use X when
type: command-table
from: phases/01-math-foundations/10-dimensionality-reduction/docs/en.md, phases/02-ml-fundamentals/16-anomaly-detection/docs/en.md

| Command | What it does |
|---|---|
| PCA | Preprocessing and compression. Fast, global variance |
| t-SNE | 2D plots of local neighborhoods. Below 10k samples |
| UMAP | 2D plots at scale. Some global structure |
| Kernel PCA | Nonlinear manifold. Kernel matrix is n by n |
| Z-score / IQR | One feature at a time. Very fast |
| Isolation Forest | No assumptions. Works in high dimensions |
| LOF | Local anomalies, clusters of different density. Slow |
| One-Class SVM | Small to medium data. Kernel matrix grows quadratically |

## Anomaly detection pipeline
type: flow
from: phases/02-ml-fundamentals/16-anomaly-detection/docs/en.md

1. **Baseline**: collect a period with no or very few anomalies.
2. **Features**: add rolling statistics, time features and ratios.
3. **Train**: fit the detector on the baseline. It learns normal.
4. **Score**: give each new observation an anomaly score.
5. **Threshold**: pick the cutoff from the cost of false alarms and misses.
6. **Alert**: send flagged points to human review.
7. **Feedback**: record true anomalies and false alarms. Tune the threshold.

## Defaults and numbers
type: defaults
from: phases/02-ml-fundamentals/16-anomaly-detection/docs/en.md, phases/02-ml-fundamentals/16-anomaly-detection/code/anomaly_detection.py, phases/01-math-foundations/10-dimensionality-reduction/docs/en.md

| Setting | Default | Note |
|---|---|---|
| Z-score `threshold` | 3.0 | 99.7% of Gaussian data is inside |
| IQR `factor` | 1.5 | 3.0 flags fewer points |
| `n_estimators` | 100 | Isolation trees. Usually enough |
| `max_samples` | 256 | Rows per tree, from the original paper |
| `predict` threshold | 0.5 | Score above it is an anomaly |
| `contamination` | 0.05 | Sets the cutoff only, not the scores |
| t-SNE perplexity | 30 | Typical range 5-50 |
| Variance kept | 0.95 | Or 0.90 for the PCA cutoff |

## Failures and fixes
type: troubleshooting
from: phases/02-ml-fundamentals/07-unsupervised-learning/docs/en.md, phases/02-ml-fundamentals/16-anomaly-detection/docs/en.md, phases/01-math-foundations/10-dimensionality-reduction/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| K-Means splits moons badly | Clusters are not spherical | Use DBSCAN with eps=0.3 |
| K-Means results change per run | Local minimum of inertia | Fix the seed or use K-Means++ |
| Z-score misses points | Multimodal data or outliers in training | Use IQR or Isolation Forest |
| Per-feature methods miss a point | Unusual only in the joint space | Use Isolation Forest |
| 99.9% accuracy, no catches | 0.1% anomalies, accuracy is useless | Precision@k and AUPRC |
| Operators ignore alerts | Too many false alarms | Start with a high threshold |
| Median score drifts up | Data changed or model is stale | Retrain on recent normal data |
| t-SNE cluster gaps differ | Distances between clusters mean nothing | Read only the clusters |

## Abbreviations
type: glossary
from: phases/02-ml-fundamentals/07-unsupervised-learning/docs/en.md, phases/02-ml-fundamentals/16-anomaly-detection/docs/en.md, phases/01-math-foundations/10-dimensionality-reduction/docs/en.md

- **DBSCAN**: density-based clustering. Core, border and noise points.
- **GMM**: Gaussian Mixture Model. K Gaussians with soft assignments.
- **EM**: Expectation-Maximization. E-step probabilities, M-step parameters.
- **PCA**: Principal Component Analysis. Axes of maximum variance.
- **t-SNE**: t-Distributed Stochastic Neighbor Embedding. Keeps neighbors.
- **UMAP**: Uniform Manifold Approximation and Projection. Faster, more global.
- **LOF**: Local Outlier Factor. Above 1.0 is lower density than neighbors.
- **AUPRC**: area under the precision-recall curve. Better than AUROC here.

## Questions
type: qa
from: phases/02-ml-fundamentals/07-unsupervised-learning/docs/en.md, phases/02-ml-fundamentals/16-anomaly-detection/docs/en.md, phases/01-math-foundations/10-dimensionality-reduction/docs/en.md

- **How do I pick K?** Find the elbow in inertia. Check the silhouette score.
- **Why model normal data?** Anomalies are rare and change. Deviations from normal include novel types.
- **What is the best training setup?** Semi-supervised: fit on a clean set of normal data only.
- **Few labeled anomalies?** Use them for evaluation, not training.
- **Why is Isolation Forest fast?** Each tree uses a small subsample.
- **Why reduce dimensions?** Distances converge in high dimensions. Nearest-neighbor search stops working.
