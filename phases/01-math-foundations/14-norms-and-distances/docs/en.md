# ノルムと距離

> 距離関数は「似ている」の意味を定義します。選び方を間違えると、その先のすべてが壊れます。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 1, Lessons 01 (Linear Algebra Intuition), 02 (Vectors, Matrices & Operations)
**所要時間:** 約90分

## 学習目標

- L1、L2、cosine、Mahalanobis、Jaccard、edit distance を一から実装する
- ML task に適した distance metric を選び、代替案が失敗する理由を説明する
- L1/L2 norms と LASSO/Ridge regularization、および幾何的な constraint regions を結びつける
- 同じ dataset でも metric によって nearest neighbors が変わることを示す

## 問題

2 つの vectors があるとします。word embeddings、user profiles、pixel arrays のどれかかもしれません。知りたいのは「どれくらい近いか」です。

答えは、どの distance function を選ぶかに完全に依存します。同じ 2 点が、ある metric では nearest neighbors になり、別の metric では遠く離れることがあります。KNN classifier、recommendation engine、vector database、clustering algorithm、loss function はすべてこの選択に依存します。

万能の距離はありません。L2 は spatial data に強く、cosine は NLP で支配的です。Jaccard は sets、edit distance は strings、Mahalanobis は correlations、Wasserstein は probability mass の移動を扱います。それぞれが「似ている」の異なる仮定を符号化します。

## 概念

### Norms: ベクトルの大きさを測る

norm は vector の「大きさ」を測ります。2 つの vectors の distance は、差の norm として書けます。

```text
d(a, b) = ||a - b||
```

### L1 Norm（Manhattan distance）

L1 norm は全 components の absolute values を足します。

```text
||x||_1 = |x_1| + |x_2| + ... + |x_n|
```

grid 上で軸方向にしか移動できない都市の距離に対応するため Manhattan distance と呼ばれます。

```text
Point A = (1, 1)
Point B = (4, 5)
L1 distance = |4-1| + |5-1| = 7
```

使う場面:
- high-dimensional sparse data（text features、one-hot encodings）
- 外れ値に頑健でありたい場合
- feature selection（L1 regularization は sparsity を促す）

LASSO は loss に `||w||_1` を足します。diamond-shaped constraint の corners が axes 上にあるため、一部の weights が正確に zero になりやすくなります。MAE は predictions と targets の average L1 distance です。

### L2 Norm（Euclidean distance）

L2 norm は直線距離です。

```text
||x||_2 = sqrt(x_1^2 + x_2^2 + ... + x_n^2)
```

```text
Point A = (1, 1)
Point B = (4, 5)
L2 distance = sqrt((4-1)^2 + (5-1)^2) = 5.0
```

使う場面:
- low-to-medium dimensional continuous data
- feature scales が比較可能な場合
- physical distances、sensor readings、pixel-level image similarity

Ridge は loss に `||w||_2^2` を足し、大きな weights を抑えます。L1 と違って weights を exactly zero にはしにくく、全体を比例的に縮めます。MSE は squared L2 error の平均です。

### Lp Norm と L-infinity

L1 と L2 は Lp norm の特殊例です。

```text
||x||_p = (|x_1|^p + |x_2|^p + ... + |x_n|^p)^(1/p)
```

`p -> infinity` では最大 component だけを見る L-infinity（Chebyshev distance）になります。

```text
||x||_inf = max(|x_1|, |x_2|, ..., |x_n|)
```

worst-case deviation が重要な manufacturing tolerances や、chess の king の移動のような grid movement に向きます。

### Cosine Similarity と Cosine Distance

Cosine similarity は vectors の大きさを無視し、方向の角度を測ります。

```text
cos_sim(a, b) = (a . b) / (||a||_2 * ||b||_2)
cosine_distance = 1 - cosine_similarity
```

text では document length が similarity に影響すべきではないため、cosine がよく使われます。同じ word distribution を持つ短い文書と長い文書は同じ方向を向きます。

使う場面:
- TF-IDF、word embeddings、sentence embeddings
- magnitude が noise で direction が signal の domain
- recommendation systems、embedding search、vector databases

### Dot Product vs Cosine

```text
a . b = ||a|| * ||b|| * cos(angle)
```

vectors が unit-normalized なら dot product と cosine similarity は同じです。違いは magnitude を含むかどうかです。retrieval system で item popularity や confidence を magnitude に持たせたい場合、dot product が意味を持ちます。

### Mahalanobis Distance

Euclidean distance は全 dimensions を同等に扱います。features が correlated だったり scales が異なったりすると誤解を招きます。

```text
d_M(x, y) = sqrt((x - y)^T * S^(-1) * (x - y))
```

S は data の covariance matrix です。Mahalanobis は data を whitening（decorrelate と normalize）してから L2 distance を測るものと考えられます。outlier detection、classification、quality control に使います。信頼できる covariance matrix を推定する十分な data が必要です。

### Jaccard Similarity

Jaccard は 2 つの sets の重なりを測ります。

```text
J(A, B) = |A intersect B| / |A union B|
Jaccard distance = 1 - Jaccard similarity
```

tags、categories、binary feature vectors、near-duplicate detection、segmentation の Intersection over Union に向きます。frequency ではなく presence/absence を見るときに自然です。

### Edit Distance（Levenshtein Distance）

edit distance は、一方の string をもう一方に変換するために必要な insert、delete、substitute の最小回数です。

```text
"kitten" -> "sitting"
kitten -> sitten  (substitute k -> s)
sitten -> sittin  (substitute e -> i)
sittin -> sitting (insert g)
Edit distance = 3
```

dynamic programming で計算します。spell checking、DNA sequence alignment、fuzzy string matching、messy text data の deduplication に使います。

### KL Divergence

KL divergence は probability distribution の違いを測りますが、true distance ではありません。

```text
D_KL(P || Q) = sum(p(x) * log(p(x) / q(x)))
D_KL(P || Q) != D_KL(Q || P)
```

asymmetric で triangle inequality も満たしません。VAEs、knowledge distillation、RLHF、policy gradient methods でよく使われます。direction を必ず明示します。

### Wasserstein Distance

Wasserstein distance（Earth Mover's Distance）は、片方の分布の mass をもう片方へ動かす最小 work を測ります。

```text
W(P, Q) = inf over all transport plans gamma of E[d(x, y)]
```

true metric で、分布が重ならなくても meaningful gradients を与えます。この性質により WGANs で重要になりました。

### タスク別の距離選択

| Task | Best distance | Why |
|------|--------------|-----|
| Text similarity | Cosine | magnitude は noise、direction が意味 |
| Image pixel comparison | L2 | features が比較可能な scale |
| Sparse high-dim features | L1 | rare large differences を増幅しにくい |
| Set overlap | Jaccard | data が自然に set-valued |
| String matching | Edit distance | 人間の編集操作に対応 |
| Outlier detection | Mahalanobis | correlations と scales を考慮 |
| Comparing distributions | KL divergence | Q で P を表す情報損失を測る |
| GAN training | Wasserstein | non-overlap でも gradients を提供 |
| Embeddings | Cosine or dot product | direction に意味が入る |
| Recommendation | Dot product | magnitude が popularity/confidence を持てる |

### Loss Functions と Regularization

loss functions は predictions と targets の間の distance functions です。

```text
MSE                 L2 squared
MAE                 L1
Huber loss          large errors は L1、small errors は L2
Cross-entropy       KL divergence
Triplet loss        L2（典型）
Contrastive loss    L2
```

regularization は weights に norm penalty を追加します。

```text
L1 regularization (Lasso):   loss + lambda * ||w||_1
L2 regularization (Ridge):   loss + lambda * ||w||_2^2
Elastic Net:                loss + lambda_1 * ||w||_1 + lambda_2 * ||w||_2^2
```

### Nearest Neighbor Search

exact nearest neighbor search は query ごとに O(n * d) です。large datasets では遅すぎるため、Approximate Nearest Neighbor（ANN）algorithms が使われます。

```text
KD-trees          low-dimensional data
Ball trees        medium-dimensional data
LSH               random hash projections
HNSW              vector databases の主要手法
IVF               billion-scale search
Product quant.    memory-constrained search
```

HNSW は multi-layer graph を構築し、上層の sparse long jumps から下層の dense short jumps へ降りながら探索します。

## 実装

完全な実装は `code/distances.py` を参照してください。L1、L2、L-infinity、cosine、dot product、Mahalanobis、Jaccard、edit distance、Wasserstein の基礎実装を扱います。

```python
import math

def l2_distance(a, b):
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))

def cosine_similarity(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb)
```

同じ dataset、同じ query point でも、L1、L2、cosine、Mahalanobis で nearest neighbor が変わることを確認します。

## Use It

実務でよくある用途は vector database で similar items を探すことです。embedding model が text を vectors に写像し、database が cosine similarity または dot product を ANN algorithms で高速に計算します。

```python
import numpy as np

def cosine_similarity_matrix(X):
    norms = np.linalg.norm(X, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1, norms)
    X_normalized = X / norms
    return X_normalized @ X_normalized.T
```

## Exercises

1. (1, 2, 3) と (4, 0, 6) の L1、L2、L-infinity distances を計算し、L-inf <= L2 <= L1 を確認する。
2. cosine similarity は高いが L2 distance が大きい vectors、cosine similarity は低いが L2 distance が小さい vectors を作る。
3. L1、L2、cosine、Mahalanobis のすべてで nearest neighbor が異なる dataset を作る。
4. CDF method で 1D Wasserstein distance を手計算する。
5. MinHash を実装し、exact Jaccard と approximation error を比較する。

## Key Terms

| Term | What it means |
|------|---------------|
| Norm | vector を non-negative scalar に写像する関数 |
| L1 norm | absolute components の合計。sparsity を促す |
| L2 norm | squared components の合計の平方根。直線距離 |
| L-infinity norm | 最大 absolute component |
| Cosine similarity | magnitudes で正規化した dot product |
| Dot product | component-wise products の合計。magnitude を含む |
| Mahalanobis distance | covariance で whitening した空間での L2 |
| Jaccard similarity | intersection / union |
| Edit distance | insert/delete/substitute の最小回数 |
| KL divergence | asymmetric な distribution divergence |
| Wasserstein distance | mass を動かす最小 work |
| HNSW | fast approximate nearest neighbor search の multi-layer graph |

## 参考文献

- [FAISS: A Library for Efficient Similarity Search](https://github.com/facebookresearch/faiss)
- [Wasserstein GAN (Arjovsky et al., 2017)](https://arxiv.org/abs/1701.07875)
- [Locality-Sensitive Hashing (Indyk & Motwani, 1998)](https://dl.acm.org/doi/10.1145/276698.276876)
- [Efficient Estimation of Word Representations (Mikolov et al., 2013)](https://arxiv.org/abs/1301.3781)
- [sklearn.neighbors documentation](https://scikit-learn.org/stable/modules/neighbors.html)
