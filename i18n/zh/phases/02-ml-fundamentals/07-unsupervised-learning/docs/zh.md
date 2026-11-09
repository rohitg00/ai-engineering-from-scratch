# 没有监督的学习

> 没有标签,没有老师.算法可以自行找到结构.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1 (Norms & Distances, Probability & Distributions), Phase 2 Lessons 1-6
**Time:** ~90 minutes

## 学习目标

- 从零开始实现K-Means,DBSCAN和高斯混合模型,并比较它们的集群行为
- 通过模具分数和肘部方法评估集群质量,以选择最佳K
- 解释DBSCAN在何时超过K-Means,并确定哪个算法处理非球状集群和异常值
- 通过集群方法建立一个异常检测管道,将偏离正常模式的标记点进行标记

## 问题

在现实世界中,标签是昂贵的. 一个医院有数百万病人的记录,但没有人手动标记每一个病例. 电子商务网站有数百万用户, 警方有网络记录,但没有人标记了每一个异常.

没有监督的学习会发现模式,而没有被告知要寻找什么.它集结类似的数据点,发现隐藏的结构,并表面上发现异常.如果监督的学习是从一本有答案键的教科书中学习,那么没有监督的学习会着原始数据,直到模式显示出来.

没有标签,你不能直接测量"正确"或"错误".

## 概念

### 集群: 集群相似的东西

集群将每个数据点分配给一个组 (集群),使同一组内的点比其他组中的点更相似.问题总是:"相似"意味着什么?

```mermaid
flowchart LR
    A[Raw Data] --> B{Choose Method}
    B --> C[K-Means]
    B --> D[DBSCAN]
    B --> E[Hierarchical]
    B --> F[GMM]
    C --> G[Flat, spherical clusters]
    D --> H[Arbitrary shapes, noise detection]
    E --> I[Tree of nested clusters]
    F --> J[Soft assignments, elliptical clusters]
```

### 工作马

基-指数分为K集群,每个集群都有一个中心位 (其质量中心),每个点都属于最近的中心位.

劳埃德的算法:

1. 选择K随机点作为初始中心点
2. 分配每个数据点到最近的中心位
3. 计算每个中心位作为其分配点的平均值
4. 重复步骤2-3,直到任务停止改变

客观函数 (惰性) 测量从每个点到其分配的中心点的总平方距离.K-Means 减少这一点,但只找到一个本地最小值.不同的初始化可以产生不同的结果.

### 选择K

两种标准方法:

**Elbow method:**运行K-Means$K = 1, 2, 3, \ldots, n$曲的惰性与K. 寻找"肘部",其中添加更多的集群停止显著减少惰性.

**Silhouette score:**对于每个点,测量它与自己的集群有多相似 ($a$) 与最近的其他集群相比 ($b$图形系数是$(b - a) / \max(a, b)$平均值在所有点中,为全球分数.

### 基于密度的聚合物

据 K-Means 假设集群是圆形的,需要你先选择 K. DBSCAN 没有任何假设.它发现集群是密集区域,由稀疏区域分开.

两个参数:
- **eps**:一个邻居的半径
- **min_samples**: 形成密集区域所需的最低点数

三个类型的点:
- **Core point**: 在eps距离内至少有min_sample点
- **Border point**:在一个核心点的eps内,但本身不是核心点
- **Noise point**它们是异常值的.

光电缆系统将位于一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个离一个.

强度:找到任何形状的集群,自动确定集群数量,识别异常值. 弱点:与不同密度的集群斗争.

### 层次性集群

树木 (形图) 形成了嵌套的群体.

聚合物 (下至上):
1. 开始每个点作为自己的集群
2. 合并两个最接近的集群
3. 重复直到剩下只有一个集群
4. 切割子图在所需水平,以获得K集群

集群之间的"接近"可以以以下方式测量:
- **Single linkage**: 两组任何两个点之间的最小距离
- **Complete linkage**:任何两个点之间的最大距离
- **Average linkage**:所有对之间的平均距离
- **Ward's method**: 集团内部总差异最小的增长

### 盖斯混合物模型 (GMM)

基准指数给出硬项:每个点属于一个集群.GMM给出软项:每个点都有属于每个集群的可能性.

根据GMM的假设,数据是由K高斯分布的混合物生成的,每个分布都有其平均值和共变值.预期最大化 (EM) 算法在以下之间交替:

- **E-step**:计算每个点属于每个高斯的概率
- **M-step**更新每一个高斯的平均值,变量和混合重量,以最大限度地提高数据的可能性

GMM可以模拟圆团 (不仅像K-Means这样的球形) 并自然处理重叠的团.

### 什么时候使用

| Method | Best for | Avoid when |
|--------|----------|------------|
| K-Means | Large datasets, spherical clusters, known K | Irregular shapes, outliers present |
| DBSCAN | Unknown K, arbitrary shapes, outlier detection | Varying densities, very high dimensions |
| Hierarchical | Small datasets, need dendrogram, unknown K | Large datasets ($O(n^2)$ memory) |
| GMM | Overlapping clusters, soft assignments needed | Very large datasets, too many dimensions |

### 集的异常检测

集群自然支持异常检测:
- **K-Means**距离任何心脏部位的点都是异常
- **DBSCAN**噪音点是定义上异常
- **GMM**根据所有高斯人,低概率的点都是异常.

```figure
kmeans-step
```

## 建立它

### 步骤1:K-从零开始

```python
import math
import random


def euclidean_distance(a, b):
    return math.sqrt(sum((ai - bi) ** 2 for ai, bi in zip(a, b)))


def kmeans(data, k, max_iterations=100, seed=42):
    random.seed(seed)
    n_features = len(data[0])

    centroids = random.sample(data, k)

    for iteration in range(max_iterations):
        clusters = [[] for _ in range(k)]
        assignments = []

        for point in data:
            distances = [euclidean_distance(point, c) for c in centroids]
            nearest = distances.index(min(distances))
            clusters[nearest].append(point)
            assignments.append(nearest)

        new_centroids = []
        for cluster in clusters:
            if len(cluster) == 0:
                new_centroids.append(random.choice(data))
                continue
            centroid = [
                sum(point[j] for point in cluster) / len(cluster)
                for j in range(n_features)
            ]
            new_centroids.append(centroid)

        if all(
            euclidean_distance(old, new) < 1e-6
            for old, new in zip(centroids, new_centroids)
        ):
            print(f"  Converged at iteration {iteration + 1}")
            break

        centroids = new_centroids

    return assignments, centroids
```

### 步骤2:肘部方法和模具分数

```python
def compute_inertia(data, assignments, centroids):
    total = 0.0
    for point, cluster_id in zip(data, assignments):
        total += euclidean_distance(point, centroids[cluster_id]) ** 2
    return total


def silhouette_score(data, assignments):
    n = len(data)
    if n < 2:
        return 0.0

    clusters = {}
    for i, c in enumerate(assignments):
        clusters.setdefault(c, []).append(i)

    if len(clusters) < 2:
        return 0.0

    scores = []
    for i in range(n):
        own_cluster = assignments[i]
        own_members = [j for j in clusters[own_cluster] if j != i]

        if len(own_members) == 0:
            scores.append(0.0)
            continue

        a = sum(euclidean_distance(data[i], data[j]) for j in own_members) / len(own_members)

        b = float("inf")
        for cluster_id, members in clusters.items():
            if cluster_id == own_cluster:
                continue
            avg_dist = sum(euclidean_distance(data[i], data[j]) for j in members) / len(members)
            b = min(b, avg_dist)

        if max(a, b) == 0:
            scores.append(0.0)
        else:
            scores.append((b - a) / max(a, b))

    return sum(scores) / len(scores)


def find_best_k(data, max_k=10):
    print("Elbow method:")
    inertias = []
    for k in range(1, max_k + 1):
        assignments, centroids = kmeans(data, k)
        inertia = compute_inertia(data, assignments, centroids)
        inertias.append(inertia)
        print(f"  K={k}: inertia={inertia:.2f}")

    print("\nSilhouette scores:")
    for k in range(2, max_k + 1):
        assignments, centroids = kmeans(data, k)
        score = silhouette_score(data, assignments)
        print(f"  K={k}: silhouette={score:.4f}")

    return inertias
```

### 步骤3:从零开始 DBSCAN

```python
def dbscan(data, eps, min_samples):
    n = len(data)
    labels = [-1] * n
    cluster_id = 0

    def region_query(point_idx):
        neighbors = []
        for i in range(n):
            if euclidean_distance(data[point_idx], data[i]) <= eps:
                neighbors.append(i)
        return neighbors

    visited = [False] * n

    for i in range(n):
        if visited[i]:
            continue
        visited[i] = True

        neighbors = region_query(i)

        if len(neighbors) < min_samples:
            labels[i] = -1
            continue

        labels[i] = cluster_id
        seed_set = list(neighbors)
        seed_set.remove(i)

        j = 0
        while j < len(seed_set):
            q = seed_set[j]

            if not visited[q]:
                visited[q] = True
                q_neighbors = region_query(q)
                if len(q_neighbors) >= min_samples:
                    for nb in q_neighbors:
                        if nb not in seed_set:
                            seed_set.append(nb)

            if labels[q] == -1:
                labels[q] = cluster_id

            j += 1

        cluster_id += 1

    return labels
```

### 步骤4:高斯混合物模型 (EM算法)

```python
def gmm(data, k, max_iterations=100, seed=42):
    random.seed(seed)
    n = len(data)
    d = len(data[0])

    indices = random.sample(range(n), k)
    means = [list(data[i]) for i in indices]
    variances = [1.0] * k
    weights = [1.0 / k] * k

    def gaussian_pdf(x, mean, variance):
        d = len(x)
        coeff = 1.0 / ((2 * math.pi * variance) ** (d / 2))
        exponent = -sum((xi - mi) ** 2 for xi, mi in zip(x, mean)) / (2 * variance)
        return coeff * math.exp(max(exponent, -500))

    for iteration in range(max_iterations):
        responsibilities = []
        for i in range(n):
            probs = []
            for j in range(k):
                probs.append(weights[j] * gaussian_pdf(data[i], means[j], variances[j]))
            total = sum(probs)
            if total == 0:
                total = 1e-300
            responsibilities.append([p / total for p in probs])

        old_means = [list(m) for m in means]

        for j in range(k):
            r_sum = sum(responsibilities[i][j] for i in range(n))
            if r_sum < 1e-10:
                continue

            weights[j] = r_sum / n

            for dim in range(d):
                means[j][dim] = sum(
                    responsibilities[i][j] * data[i][dim] for i in range(n)
                ) / r_sum

            variances[j] = sum(
                responsibilities[i][j]
                * sum((data[i][dim] - means[j][dim]) ** 2 for dim in range(d))
                for i in range(n)
            ) / (r_sum * d)
            variances[j] = max(variances[j], 1e-6)

        shift = sum(
            euclidean_distance(old_means[j], means[j]) for j in range(k)
        )
        if shift < 1e-6:
            print(f"  GMM converged at iteration {iteration + 1}")
            break

    assignments = []
    for i in range(n):
        assignments.append(responsibilities[i].index(max(responsibilities[i])))

    return assignments, means, weights, responsibilities
```

### 步骤5:生成测试数据并运行所有

```python
def make_blobs(centers, n_per_cluster=50, spread=0.5, seed=42):
    random.seed(seed)
    data = []
    true_labels = []
    for label, (cx, cy) in enumerate(centers):
        for _ in range(n_per_cluster):
            x = cx + random.gauss(0, spread)
            y = cy + random.gauss(0, spread)
            data.append([x, y])
            true_labels.append(label)
    return data, true_labels


def make_moons(n_samples=200, noise=0.1, seed=42):
    random.seed(seed)
    data = []
    labels = []
    n_half = n_samples // 2
    for i in range(n_half):
        angle = math.pi * i / n_half
        x = math.cos(angle) + random.gauss(0, noise)
        y = math.sin(angle) + random.gauss(0, noise)
        data.append([x, y])
        labels.append(0)
    for i in range(n_half):
        angle = math.pi * i / n_half
        x = 1 - math.cos(angle) + random.gauss(0, noise)
        y = 1 - math.sin(angle) - 0.5 + random.gauss(0, noise)
        data.append([x, y])
        labels.append(1)
    return data, labels


if __name__ == "__main__":
    centers = [[2, 2], [8, 3], [5, 8]]
    data, true_labels = make_blobs(centers, n_per_cluster=50, spread=0.8)

    print("=== K-Means on 3 blobs ===")
    assignments, centroids = kmeans(data, k=3)
    print(f"  Centroids: {[[round(c, 2) for c in cent] for cent in centroids]}")
    sil = silhouette_score(data, assignments)
    print(f"  Silhouette score: {sil:.4f}")

    print("\n=== Elbow Method ===")
    find_best_k(data, max_k=6)

    print("\n=== DBSCAN on 3 blobs ===")
    db_labels = dbscan(data, eps=1.5, min_samples=5)
    n_clusters = len(set(db_labels) - {-1})
    n_noise = db_labels.count(-1)
    print(f"  Found {n_clusters} clusters, {n_noise} noise points")

    print("\n=== GMM on 3 blobs ===")
    gmm_assignments, gmm_means, gmm_weights, _ = gmm(data, k=3)
    print(f"  Means: {[[round(m, 2) for m in mean] for mean in gmm_means]}")
    print(f"  Weights: {[round(w, 3) for w in gmm_weights]}")
    gmm_sil = silhouette_score(data, gmm_assignments)
    print(f"  Silhouette score: {gmm_sil:.4f}")

    print("\n=== DBSCAN on moons (non-spherical clusters) ===")
    moon_data, moon_labels = make_moons(n_samples=200, noise=0.1)
    moon_db = dbscan(moon_data, eps=0.3, min_samples=5)
    n_moon_clusters = len(set(moon_db) - {-1})
    n_moon_noise = moon_db.count(-1)
    print(f"  Found {n_moon_clusters} clusters, {n_moon_noise} noise points")

    print("\n=== K-Means on moons (will fail to separate) ===")
    moon_km, moon_centroids = kmeans(moon_data, k=2)
    moon_sil = silhouette_score(moon_data, moon_km)
    print(f"  Silhouette score: {moon_sil:.4f}")
    print("  K-Means splits moons poorly because they are not spherical")

    print("\n=== Anomaly detection with DBSCAN ===")
    anomaly_data = list(data)
    anomaly_data.append([20.0, 20.0])
    anomaly_data.append([-5.0, -5.0])
    anomaly_data.append([15.0, 0.0])
    anomaly_labels = dbscan(anomaly_data, eps=1.5, min_samples=5)
    anomalies = [
        anomaly_data[i]
        for i in range(len(anomaly_labels))
        if anomaly_labels[i] == -1
    ]
    print(f"  Detected {len(anomalies)} anomalies")
    for a in anomalies[-3:]:
        print(f"    Point {[round(v, 2) for v in a]}")
```

## 用它

通过Skit-learn,相同的算法是单行:

```python
from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering
from sklearn.mixture import GaussianMixture
from sklearn.metrics import silhouette_score as sklearn_silhouette

km = KMeans(n_clusters=3, random_state=42).fit(data)
db = DBSCAN(eps=1.5, min_samples=5).fit(data)
agg = AgglomerativeClustering(n_clusters=3).fit(data)
gmm_model = GaussianMixture(n_components=3, random_state=42).fit(data)
```

从零开始的版本显示了这些库计算的内容.K-Means在分配和重新计算之间进行反复计算.DBSCAN从密集种子中成长集群.GMM在期望和最大化之间交替.图书馆版本增加了数值稳定性,更智能的初始化 (K-Means++),以及GPU加速,但核心逻辑是相同的.

## 运送它

这一课程从零开始产生了K-Means,DBSCAN和GMM的工作实现.集群代码可以重新作为更先进的未监督方法的基础.

## 运动

1. 实现K-Means++初始化:而不是随机选择中位数,先随机选择第一个中位数,然后选择每一个后续的中位数,概率均等于距离最近的现有中位数的平方.比较接近速度和随机初始化.
2. 添加等级聚合集成到代码中. 实现Ward的链接并生成一个子图 (作为一个嵌套的合并列表). 切割它在不同的层次和比较K-Means结果.
3. 建立一个简单的异常检测管道:运行DBSCAN和GMM在相同的数据上,两种方法一致的标志点都是异常值 (DBSCAN中的噪音,GMM中的概率低).测量重叠,讨论方法不同时.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Clustering | "Grouping similar things" | Partitioning data into subsets where within-group similarity exceeds between-group similarity, measured by a specific distance metric |
| Centroid | "The center of a cluster" | The mean of all points assigned to a cluster; used by K-Means as the cluster representative |
| Inertia | "How tight the clusters are" | Sum of squared distances from each point to its assigned centroid; lower is tighter |
| Silhouette score | "How well-separated clusters are" | For each point, $(b - a) / \max(a, b)$ where $a$ is mean intra-cluster distance and $b$ is mean nearest-cluster distance |
| Core point | "A point in a dense region" | A point with at least min_samples neighbors within eps distance, in DBSCAN |
| EM algorithm | "Soft K-Means" | Expectation-Maximization: iteratively compute membership probabilities (E-step) and update distribution parameters (M-step) |
| Dendrogram | "A tree of clusters" | A tree diagram showing the order and distance at which clusters were merged in hierarchical clustering |
| Anomaly | "An outlier" | A data point that does not conform to the expected pattern, identified as noise by DBSCAN or low-probability by GMM |

## 进一步阅读

- [Stanford CS229 - Unsupervised Learning](https://cs229.stanford.edu/notes2022fall/main_notes.pdf)- 关于集群和电脑的安德鲁·恩格的讲座笔记
- [scikit-learn Clustering Guide](https://scikit-learn.org/stable/modules/clustering.html)- 实际比较所有集群算法与视觉示例
- [DBSCAN original paper (Ester et al., 1996)](https://www.aaai.org/Papers/KDD/1996/KDD96-037.pdf)- 引入基于密度的集群的论文
