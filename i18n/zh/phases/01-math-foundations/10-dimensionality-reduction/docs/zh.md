# 降维

> 高维数据是有结构的。从正确的角度看，你就能发现它。

**Type:** Build
**Language:** Python
**Prerequisites:** 阶段 1, 第 01 课（线性代数直觉）、第 02 课（向量、矩阵与运算）、第 03 课（特征值与特征向量）、第 06 课（概率与分布）
**Time:** 约 90 分钟

## 学习目标

- 从零实现 PCA：中心化数据、计算协方差矩阵、特征分解并投影
- 使用解释方差比和肘部法选择主成分的数量
- 比较 PCA、t-SNE 和 UMAP 在将 MNIST 数字可视化到 2D 时的表现，并解释它们的权衡
- 使用带 RBF 核的 kernel PCA 分离标准 PCA 无法处理的非线性数据结构

## 问题

你有一个每个样本包含 784 个特征的数据集。可能是手写数字的像素值，可能是基因表达水平，也可能是用户行为信号。你无法可视化 784 维。你无法把它们画出来，甚至无法在脑海中构想它们。

但这 784 个特征中大部分是冗余的。真正的信息分布在一个小得多的曲面上。一个手写的"7"并不需要 784 个独立的数字来描述，只需要少数几个：笔画的倾角、横杠的长度、倾斜的程度。其余的都是噪声。

降维就是找到那个更小的曲面。它把你的 784 维数据压缩到 2 维、10 维或 50 维，同时保留重要的结构。

## 概念

### 维度灾难

高维空间是反直觉的。随着维度增长，有三件事会出问题。

**距离失去意义。** 在高维空间中，任意两个随机点之间的距离趋于相同的值。如果每个点到其他所有点的距离都大致相等，最近邻搜索就失效了。

```
Dimension    Avg distance ratio (max/min between random points)
2            ~5.0
10           ~1.8
100          ~1.2
1000         ~1.02
```

**体积集中在角落。** d 维的单位超立方体有 2^d 个角。在 100 维中，几乎所有的体积都在角落里，远离中心。数据点散布到边缘，而你的模型在内部区域缺乏数据。

**你需要指数级更多的数据。** 为了在空间中维持相同的样本密度，从 2D 到 20D 意味着需要 10^18 倍的数据。你永远不会有那么多数据。降维能把数据密度恢复到可用的水平。

### PCA：找到重要的方向

主成分分析（PCA）找出数据方差最大的轴。它旋转你的坐标系，使第一个轴捕获最大的方差，第二个轴捕获次大的方差，依此类推。

算法：

```
1. Center the data        (subtract the mean from each feature)
2. Compute covariance     (how features move together)
3. Eigendecomposition     (find the principal directions)
4. Sort by eigenvalue     (biggest variance first)
5. Project               (keep top k eigenvectors, drop the rest)
```

为什么用特征分解？协方差矩阵是对称的半正定矩阵。它的特征向量是特征空间中的正交方向。特征值告诉你每个方向捕获了多少方差。最大特征值对应的特征向量指向方差最大的方向。

```mermaid
graph LR
    A["Original data (2D)\nData spread in both\nx and y directions"] -->|"PCA rotation"| B["After PCA\nPC1 captures the elongated spread\nPC2 captures the narrow spread\nDrop PC2 and you lose little info"]
```

- **PCA 之前：** 数据云沿 x 轴和 y 轴对角分布
- **PCA 之后：** 坐标系被旋转，使 PC1 对齐方差最大的方向（拉长的分布），PC2 对齐方差最小的方向（狭窄的分布）
- **降维：** 丢弃 PC2 会把数据投影到 PC1 上，损失极少的信息

### 解释方差比

每个主成分捕获总方差的一部分。解释方差比告诉你捕获了多少。

```
Component    Eigenvalue    Explained ratio    Cumulative
PC1          4.73          0.473              0.473
PC2          2.51          0.251              0.724
PC3          1.12          0.112              0.836
PC4          0.89          0.089              0.925
...
```

当累积解释方差达到 0.95 时，你就知道这些成分捕获了 95% 的信息。之后的部分大多是噪声。

### 选择成分数量

三种策略：

1. **阈值法。** 保留足够解释 90-95% 方差的成分数量。
2. **肘部法。** 绘制每个成分的解释方差，寻找急剧下降的位置。
3. **下游性能。** 将 PCA 作为预处理，扫描 k 并测量模型的准确率。最佳的 k 就是准确率趋于平稳的位置。

### t-SNE：保留邻域关系

t 分布随机邻域嵌入（t-SNE）是为可视化设计的。它将高维数据映射到 2D（或 3D），同时保留哪些点彼此相近。

直觉：在原始空间中，根据点对的距离计算一个概率分布。距离近的点获得高概率，距离远的点获得低概率。然后找到一个 2D 排列，使得相同的概率分布成立。在 784 维中是邻居的点，在 2D 中仍然是邻居。

t-SNE 的关键特性：
- 非线性。它能展开 PCA 无法处理的复杂流形。
- 随机性。不同运行会产生不同的布局。
- 困惑度（perplexity）参数控制考虑多少个邻居（典型范围：5-50）。
- 输出中簇之间的距离没有意义，只有簇本身有意义。
- 在大型数据集上很慢，默认复杂度为 O(n^2)。

### UMAP：更快、更好的全局结构

均匀流形近似与投影（UMAP）的工作方式与 t-SNE 类似，但有两个优势：
- 更快。它使用近似最近邻图，而不是计算所有成对距离。
- 更好的全局结构。输出中簇的相对位置通常比 t-SNE 更有意义。

UMAP 在高维空间中构建一个加权图（"模糊拓扑表示"），然后找到一个尽可能保留该图的低维布局。

关键参数：
- `n_neighbors`：定义局部结构的邻居数量（类似困惑度）。值越高保留的全局结构越多。
- `min_dist`：点在输出中彼此靠近的紧密程度。值越低生成的簇越密集。

### 何时使用哪种方法

| 方法 | 使用场景 | 保留内容 | 速度 |
|--------|----------|-----------|-------|
| PCA | 训练前的预处理 | 全局方差 | 快（精确），可处理数百万样本 |
| PCA | 快速探索性可视化 | 线性结构 | 快 |
| t-SNE | 出版级 2D 图 | 局部邻域 | 慢（理想情况下 < 10k 样本） |
| UMAP | 大规模 2D 可视化 | 局部 + 部分全局结构 | 中等（可处理数百万样本） |
| PCA | 模型的特征降维 | 按方差排序的特征 | 快 |
| t-SNE / UMAP | 理解簇结构 | 簇的分离度 | 中等至慢 |

经验法则：用 PCA 做预处理和数据压缩。当需要在 2D 中可视化结构时，使用 t-SNE 或 UMAP。

### Kernel PCA

标准 PCA 找的是线性子空间。它旋转坐标系并丢弃轴。但如果数据位于非线性流形上呢？2D 中的一个圆无法被任何直线分开，标准 PCA 帮不上忙。

Kernel PCA 在由核函数诱导的高维特征空间中执行 PCA，而无需显式计算该空间中的坐标。这就是核技巧（kernel trick）——与 SVM 背后的思想相同。

算法：
1. 计算核矩阵 K，其中 K_ij = k(x_i, x_j)
2. 在特征空间中对核矩阵进行中心化
3. 对中心化后的核矩阵进行特征分解
4. 最大的特征向量（按 1/sqrt(特征值) 缩放）即为投影

常见的核函数：

| 核 | 公式 | 适用场景 |
|--------|---------|----------|
| RBF（高斯） | exp(-gamma * \|\|x - y\|\|^2) | 大多数非线性数据、平滑流形 |
| 多项式 | (x . y + c)^d | 多项式关系 |
| Sigmoid | tanh(alpha * x . y + c) | 类神经网络映射 |

何时使用 kernel PCA 与标准 PCA：

| 标准 | 标准 PCA | Kernel PCA |
|-----------|-------------|------------|
| 数据结构 | 线性子空间 | 非线性流形 |
| 速度 | O(min(n^2 d, d^2 n)) | O(n^2 d + n^3) |
| 可解释性 | 成分是特征的线性组合 | 成分缺乏直接的特征解释 |
| 可扩展性 | 可处理数百万样本 | 核矩阵为 n x n，受内存限制 |
| 重建 | 直接逆变换 | 需要预像（pre-image）近似 |

经典例子：2D 中的同心圆。两圈点，一圈在另一圈内部。标准 PCA 把两者投影到同一条直线上——对分类毫无用处。带 RBF 核的 kernel PCA 将内圈和外圈映射到不同区域，使它们线性可分。

### 重建误差

你的降维效果有多好？你把 784 维压缩到 50 维，损失了什么？

测量重建误差：
1. 将数据投影到 k 维：X_reduced = X @ W_k
2. 重建：X_hat = X_reduced @ W_k^T
3. 计算 MSE：mean((X - X_hat)^2)

对 PCA 而言，重建误差与解释方差有清晰的关系：

```
Reconstruction error = sum of eigenvalues NOT included
Total variance = sum of ALL eigenvalues
Fraction lost = (sum of dropped eigenvalues) / (sum of all eigenvalues)
```

每个成分的解释方差比为：

```
explained_ratio_k = eigenvalue_k / sum(all eigenvalues)
```

绘制累积解释方差随成分数量的变化，就得到"肘部"曲线。合适的成分数量位于：
- 曲线变平的地方（边际收益递减）
- 累积方差越过阈值的地方（通常为 0.90 或 0.95）
- 下游任务性能趋于平稳的地方

重建误差的用途不止于选择 k。你可以用它做异常检测：重建误差高的样本是不符合所学子空间的离群点。这是生产系统中基于 PCA 的异常检测的基础。

```figure
pca-axes
```

## 动手构建

### 步骤 1：从零实现 PCA

```python
import numpy as np

class PCA:
    def __init__(self, n_components):
        self.n_components = n_components
        self.components = None
        self.mean = None
        self.eigenvalues = None
        self.explained_variance_ratio_ = None

    def fit(self, X):
        self.mean = np.mean(X, axis=0)
        X_centered = X - self.mean

        cov_matrix = np.cov(X_centered, rowvar=False)

        eigenvalues, eigenvectors = np.linalg.eigh(cov_matrix)

        sorted_idx = np.argsort(eigenvalues)[::-1]
        eigenvalues = eigenvalues[sorted_idx]
        eigenvectors = eigenvectors[:, sorted_idx]

        self.components = eigenvectors[:, :self.n_components].T
        self.eigenvalues = eigenvalues[:self.n_components]
        total_var = np.sum(eigenvalues)
        self.explained_variance_ratio_ = self.eigenvalues / total_var

        return self

    def transform(self, X):
        X_centered = X - self.mean
        return X_centered @ self.components.T

    def fit_transform(self, X):
        self.fit(X)
        return self.transform(X)
```

### 步骤 2：在合成数据上测试

```python
np.random.seed(42)
n_samples = 500

t = np.random.uniform(0, 2 * np.pi, n_samples)
x1 = 3 * np.cos(t) + np.random.normal(0, 0.2, n_samples)
x2 = 3 * np.sin(t) + np.random.normal(0, 0.2, n_samples)
x3 = 0.5 * x1 + 0.3 * x2 + np.random.normal(0, 0.1, n_samples)

X_synthetic = np.column_stack([x1, x2, x3])

pca = PCA(n_components=2)
X_reduced = pca.fit_transform(X_synthetic)

print(f"Original shape: {X_synthetic.shape}")
print(f"Reduced shape:  {X_reduced.shape}")
print(f"Explained variance ratios: {pca.explained_variance_ratio_}")
print(f"Total variance captured: {sum(pca.explained_variance_ratio_):.4f}")
```

### 步骤 3：将 MNIST 数字映射到 2D

```python
from sklearn.datasets import fetch_openml

mnist = fetch_openml("mnist_784", version=1, as_frame=False, parser="auto")
X_mnist = mnist.data[:5000].astype(float)
y_mnist = mnist.target[:5000].astype(int)

pca_mnist = PCA(n_components=50)
X_pca50 = pca_mnist.fit_transform(X_mnist)
print(f"50 components capture {sum(pca_mnist.explained_variance_ratio_):.2%} of variance")

pca_2d = PCA(n_components=2)
X_pca2d = pca_2d.fit_transform(X_mnist)
print(f"2 components capture {sum(pca_2d.explained_variance_ratio_):.2%} of variance")
```

### 步骤 4：与 sklearn 比较

```python
from sklearn.decomposition import PCA as SklearnPCA
from sklearn.manifold import TSNE

sklearn_pca = SklearnPCA(n_components=2)
X_sklearn_pca = sklearn_pca.fit_transform(X_mnist)

print(f"\nOur PCA explained variance:     {pca_2d.explained_variance_ratio_}")
print(f"Sklearn PCA explained variance: {sklearn_pca.explained_variance_ratio_}")

diff = np.abs(np.abs(X_pca2d) - np.abs(X_sklearn_pca))
print(f"Max absolute difference: {diff.max():.10f}")

tsne = TSNE(n_components=2, perplexity=30, random_state=42)
X_tsne = tsne.fit_transform(X_mnist)
print(f"\nt-SNE output shape: {X_tsne.shape}")
```

### 步骤 5：UMAP 比较

```python
try:
    from umap import UMAP

    reducer = UMAP(n_components=2, n_neighbors=15, min_dist=0.1, random_state=42)
    X_umap = reducer.fit_transform(X_mnist)
    print(f"UMAP output shape: {X_umap.shape}")
except ImportError:
    print("Install umap-learn: pip install umap-learn")
```

## 使用它

将 PCA 作为分类器之前的预处理：

```python
from sklearn.decomposition import PCA as SklearnPCA
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

X_train, X_test, y_train, y_test = train_test_split(
    X_mnist, y_mnist, test_size=0.2, random_state=42
)

results = {}
for k in [10, 30, 50, 100, 200]:
    pca_k = SklearnPCA(n_components=k)
    X_tr = pca_k.fit_transform(X_train)
    X_te = pca_k.transform(X_test)

    clf = LogisticRegression(max_iter=1000, random_state=42)
    clf.fit(X_tr, y_train)
    acc = accuracy_score(y_test, clf.predict(X_te))
    var_captured = sum(pca_k.explained_variance_ratio_)
    results[k] = (acc, var_captured)
    print(f"k={k:>3d}  accuracy={acc:.4f}  variance={var_captured:.4f}")
```

性能在远低于 784 维时就会趋于平稳。那个平稳点就是你的运行点。

## 交付它

本课产出：
- `outputs/skill-dimensionality-reduction.md` - 一项为给定任务选择合适降维技术的技能

## 练习

1. 修改 PCA 类以支持 `inverse_transform`。用 10、50 和 200 个成分重建 MNIST 数字，并打印各自的重建误差（与原始数据的均方差）。

2. 在同一 MNIST 子集上使用困惑度 5、30 和 100 运行 t-SNE。描述输出如何变化。为什么困惑度会影响簇的紧密程度？

3. 构造一个有 50 个特征、其中只有 5 个是信息特征的数据集（可用 `sklearn.datasets.make_classification` 生成）。应用 PCA，检查解释方差曲线能否正确识别出数据实际上是 5 维的。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|----------------------|
| 维度灾难 | "特征太多" | 随着维度增长，距离、体积和数据密度的行为都变得反直觉。模型需要指数级更多的数据来弥补。 |
| PCA | "降维" | 旋转坐标系使轴对齐方差最大的方向，然后丢弃低方差的轴。 |
| 主成分 | "一个重要的方向" | 协方差矩阵的特征向量，即特征空间中数据变化最大的方向。 |
| 解释方差比 | "这个成分包含多少信息" | 一个主成分捕获的总方差比例。将前 k 个比例求和，可看出 k 个成分保留了多少。 |
| 协方差矩阵 | "特征之间如何相关" | 一个对称矩阵，其中元素 (i,j) 度量特征 i 和特征 j 如何共同变化。对角元素是各自的方差。 |
| t-SNE | "那张簇图" | 一种非线性方法，通过保留成对邻域概率将高维数据映射到 2D。适合可视化，不适合预处理。 |
| UMAP | "更快的 t-SNE" | 一种基于拓扑数据分析的非线性方法。同时保留局部和部分全局结构。比 t-SNE 扩展性更好。 |
| 困惑度 | "t-SNE 的一个旋钮" | 控制每个点考虑的有效邻居数量。低困惑度聚焦于非常局部的结构，高困惑度捕获更宽泛的模式。 |
| 流形 | "数据所在的曲面" | 嵌入在高维空间中的低维曲面。一张在 3D 中被揉皱的纸就是一个 2D 流形。 |

## 延伸阅读

- [A Tutorial on Principal Component Analysis](https://arxiv.org/abs/1404.1100)（Shlens）——从零开始清晰推导 PCA
- [How to Use t-SNE Effectively](https://distill.pub/2016/misread-tsne/)（Wattenberg 等）——关于 t-SNE 陷阱与参数选择的交互式指南
- [UMAP 文档](https://umap-learn.readthedocs.io/)——来自 UMAP 作者的理论与实践指导