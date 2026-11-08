# Evidence: cheatsheets/unsupervised-anomaly.md

Abbreviations: L07 = phases/02-ml-fundamentals/07-unsupervised-learning, L16 = phases/02-ml-fundamentals/16-anomaly-detection, L10 = phases/01-math-foundations/10-dimensionality-reduction. d = docs/en.md. CL = L07/code/clustering.py, AD = L16/code/anomaly_detection.py, DR = L10/code/dim_reduction.py.

## Three jobs without labels (architecture, 7 nodes, 7 edges)
- Raw data, no labels: L07/d:19-21
- PCA, keep 90-95% variance: L10/d:89
- Clustering K-Means, DBSCAN, GMM: L07/d:31-42
- Detector Isolation Forest, LOF: L16/d:123, 166
- Reconstruction error, high error is an outlier: L10/d:193
- Anomaly score, rank then threshold: L16/d:207-209, 223-224
- Flagged points to human review: L16/d:225

## From-scratch calls (task-table, 8)
- kmeans(data, k=3): CL:343
- find_best_k(data, max_k=6), inertia and silhouette: CL:349, CL:93
- dbscan(data, eps=1.5, min_samples=5), noise label -1: CL:352, L07/d:252, 272
- gmm(data, k=3): CL:358
- PCA(n_components=2) and fit_transform: DR:4, 35, L10/d:255-256
- kernel_pca(X, n_components, kernel="rbf", gamma=1.0): DR:197
- zscore_detect(X, threshold=3.0): AD:4
- iqr_detect(X, factor=1.5): AD:14

## The same in sklearn (annotated-code, 10 lines)
- KMeans, DBSCAN, GaussianMixture calls: L07/d:466-469
- SklearnPCA(n_components=2), explained_variance_ratio_: L10/d:288, 292
- TSNE(n_components=2, perplexity=30, random_state=42): L10/d:297
- UMAP(n_components=2, n_neighbors=15, min_dist=0.1, random_state=42): L10/d:308
- IsolationForest(n_estimators=100, contamination=0.05, random_state=42) and iso.fit(X_train): L16/d:340-341
- fit on normal data: L16/d:59
- LocalOutlierFactor(n_neighbors=20, contamination=0.05, novelty=True): L16/d:344
- OneClassSVM(kernel="rbf", gamma="auto", nu=0.05): L16/d:371

## Formulas (concepts, 8)
- inertia: L07/d:490
- silhouette, -1 to +1: L07/d:63
- z-score and threshold: L16/d:87-90, 451
- IQR fences: L16/d:106-113
- isolation score, near 1 anomaly, near 0.5 normal: L16/d:151-155
- c(n) = 2 * H(n-1) - 2*(n-1)/n: L16/d:320
- explained ratio: L10/d:184-186
- fraction lost: L10/d:174-180

## Clustering: use X when (command-table, 5)
- K-Means: L07/d:113
- DBSCAN: L07/d:114, noise detection: L07/d:39, 80
- Hierarchical O(n^2) memory: L07/d:115
- GMM: L07/d:116, 107
- Ward linkage: L07/d:96

## Reduce and detect: use X when (command-table, 8)
- PCA preprocessing and compression: L10/d:122, 129
- t-SNE local neighborhoods, < 10k samples: L10/d:124
- UMAP at scale, local + some global: L10/d:125
- Kernel PCA nonlinear manifold, n x n kernel matrix: L10/d:155, 158
- Z-score / IQR per feature, very fast: L16/d:191-192
- Isolation Forest no assumptions, high dims: L16/d:157, 193
- LOF local anomalies, different densities, slow: L16/d:183-185, 194
- One-Class SVM small to medium, quadratic kernel matrix: L16/d:376

## Anomaly detection pipeline (flow, 7 steps)
1. baseline data: L16/d:220
2. feature engineering, rolling statistics, time features, ratios: L16/d:221
3. train on baseline: L16/d:222
4. score new data: L16/d:223
5. threshold is a business decision: L16/d:224
6. alert and investigate, human review: L16/d:225
7. feedback collection, tune threshold: L16/d:226

## Defaults and numbers (defaults, 8)
- Z-score threshold 3.0, 99.7%: L16/d:92, AD:4
- IQR factor 1.5, 3.0 more conservative: L16/d:115, 121
- n_estimators 100: L16/d:162, AD:91
- max_samples 256: L16/d:163, AD:91
- predict threshold 0.5: AD:130
- contamination 0.05, threshold only: L16/d:164, 340, 355
- t-SNE perplexity 30, typical 5-50: L10/d:297, 102
- variance kept 0.95 or 0.90: L10/d:83, 190

## Failures and fixes (troubleshooting, 8)
- K-Means on moons, not spherical, DBSCAN eps=0.3: L07/d:430, 435-439
- K-Means local minimum, K-Means++ initialization: L07/d:55, 472
- Z-score fails on multimodal data and outliers in training: L16/d:96, 100
- joint-space anomalies missed by IQR, Isolation Forest catches: L16/d:119, L16/d:434
- 0.1% anomalies, 99.9% accuracy useless, Precision@k and AUPRC: L16/d:200-202
- alert fatigue, start with a high threshold: L16/d:400
- median score drifts upward, data changing or model stale: L16/d:427, 425
- t-SNE distances between clusters not meaningful: L10/d:103

## Abbreviations (glossary, 8)
- DBSCAN core, border, noise: L07/d:65, 73-76
- GMM soft assignments: L07/d:98-100
- EM E-step and M-step: L07/d:102-105
- PCA maximum variance: L10/d:47
- t-SNE preserves neighbors: L10/d:95
- UMAP faster, better global structure: L10/d:108-110
- LOF > 1.0 lower density: L16/d:176-178
- AUPRC better than AUROC: L16/d:455

## Questions (qa, 6)
- elbow and silhouette for K: L07/d:61-63
- model normal data, novel types: L16/d:25, 62, 76
- semi-supervised strongest: L16/d:59
- labeled anomalies for evaluation: L16/d:60
- Isolation Forest subsample: L16/d:157, 163
- distances converge in high dimensions: L10/d:31
