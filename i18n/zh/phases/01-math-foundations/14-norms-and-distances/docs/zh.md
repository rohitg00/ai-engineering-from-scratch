# 范数与距离

> 你的距离函数定义了“相似”的含义。选错了，后面的一切都会崩坏。

**Type:** Build
**Language:** Python
**Prerequisites:** Phase 1, Lessons 01（线性代数直觉）、02（向量、矩阵与运算）
**Time:** ~90 minutes

## 学习目标

- 从零实现 L1、L2、余弦、马氏、Jaccard 和编辑距离函数
- 为给定的 ML 任务选择合适的距离度量，并解释其他选择为何失败
- 将 L1 和 L2 范数与 LASSO、Ridge 正则化及其几何约束区域联系起来
- 演示同一数据集在不同度量下如何产生不同的最近邻

## 问题

你有两个向量。也许是词嵌入，也许是用户画像，也许是像素数组。你需要知道：它们有多接近？

答案完全取决于你选择哪个距离函数。两个数据点在一种度量下是最近邻，在另一种度量下可能相距甚远。你的 KNN 分类器、推荐引擎、向量数据库、聚类算法、损失函数——全都依赖这个选择。选错了，模型就会优化错误的目标。

不存在普适的最优距离。L2 适用于空间数据。余弦相似度在 NLP 中占主导。Jaccard 处理集合。编辑距离处理字符串。马氏距离考虑相关性。Wasserstein 移动概率质量。每一种都编码了对“相似”含义的不同假设。

本课从零构建所有主要距离函数，展示每种函数何时是正确的工具，并演示相同数据在不同度量下会产生完全不同的最近邻。

## 概念

### 范数：度量向量的大小

范数度量向量的“大小”。两个向量之间的任何距离函数都可以写成它们之差的范数：d(a, b) = ||a - b||。因此理解范数就是理解距离。

### L1 范数（曼哈顿距离）

L1 范数对所有分量的绝对值求和。

```
||x||_1 = |x_1| + |x_2| + ... + |x_n|
```

它被称为曼哈顿距离，因为它度量的是在只能沿轴移动的城市网格中行走的距离。没有对角线。

```
Point A = (1, 1)
Point B = (4, 5)

L1 distance = |4-1| + |5-1| = 3 + 4 = 7

On a grid, you walk 3 blocks east and 4 blocks north.
```

何时使用 L1：
- 高维稀疏数据（文本特征、one-hot 编码）
- 需要对异常值的鲁棒性时（单个巨大的差异不会主导结果）
- 特征选择问题（L1 正则化促进稀疏性）

与 L1 正则化（Lasso）的联系：在损失函数中加入 ||w||_1 惩罚权重绝对值之和。这会把小权重精确推到零，实现自动特征选择。L1 惩罚在权重空间中形成菱形约束区域，而菱形的角位于某些权重为零的坐标轴上。

与损失函数的联系：平均绝对误差（MAE）是预测值与目标之间的平均 L1 距离。它对所有误差线性惩罚，因此与 MSE 相比对异常值更鲁棒。

### L2 范数（欧几里得距离）

L2 范数是直线距离。分量平方和的平方根。

```
||x||_2 = sqrt(x_1^2 + x_2^2 + ... + x_n^2)
```

这是你在几何课上学到的距离。n 维空间中的毕达哥拉斯定理。

```
Point A = (1, 1)
Point B = (4, 5)

L2 distance = sqrt((4-1)^2 + (5-1)^2) = sqrt(9 + 16) = sqrt(25) = 5.0

The straight line, cutting diagonally through the grid.
```

何时使用 L2：
- 低到中等维度的连续数据
- 特征尺度相近时
- 物理距离（空间数据、传感器读数）
- 像素级别的图像相似度

与 L2 正则化（Ridge）的联系：在损失函数中加入 ||w||_2^2 惩罚大权重。与 L1 不同，它不会把权重推到零，而是按比例将所有权重向零收缩。L2 惩罚形成圆形约束区域，因此在坐标轴上没有角。权重会变小，但很少精确为零。

与损失函数的联系：均方误差（MSE）是 L2 距离平方的平均值。平方使得大误差受到比小误差重得多的惩罚。

```
MAE (L1 loss):  |y - y_hat|         Linear penalty. Robust to outliers.
MSE (L2 loss):  (y - y_hat)^2       Quadratic penalty. Sensitive to outliers.
```

### Lp 范数：一般化家族

L1 和 L2 是 Lp 范数的特例：

```
||x||_p = (|x_1|^p + |x_2|^p + ... + |x_n|^p)^(1/p)
```

不同的 p 值产生不同形状的“单位球”（到原点距离为 1 的所有点的集合）：

```
p=1:    Diamond shape      (corners on axes)
p=2:    Circle/sphere      (the usual round ball)
p=3:    Superellipse       (rounded square)
p=inf:  Square/hypercube   (flat sides along axes)
```

### L-无穷范数（切比雪夫距离）

当 p 趋于无穷时，Lp 范数收敛到最大绝对分量。

```
||x||_inf = max(|x_1|, |x_2|, ..., |x_n|)
```

两点之间的距离由它们差异最大的那一个维度决定。所有其他维度都被忽略。

```
Point A = (1, 1)
Point B = (4, 5)

L-inf distance = max(|4-1|, |5-1|) = max(3, 4) = 4
```

何时使用 L-无穷范数：
- 当任一维度上的最坏偏差很重要时
- 游戏棋盘（国际象棋中的国王按 L-无穷移动：任意方向一步的代价都是 1）
- 制造公差（每个维度都必须在规格范围内）

### 余弦相似度与余弦距离

余弦相似度度量两个向量之间的夹角，忽略它们的大小。

```
cos_sim(a, b) = (a . b) / (||a||_2 * ||b||_2)
```

取值范围为 -1（方向相反）到 +1（方向相同）。垂直向量的余弦相似度为 0。

余弦距离将其转换为距离：cosine_distance = 1 - cosine_similarity。取值范围为 0（方向相同）到 2（方向相反）。

```
a = (1, 0)    b = (1, 1)

cos_sim = (1*1 + 0*1) / (1 * sqrt(2)) = 1/sqrt(2) = 0.707
cos_dist = 1 - 0.707 = 0.293
```

为什么余弦在 NLP 和嵌入中占主导：在文本中，文档长度不应影响相似度。一篇关于猫的文档即使比另一篇长一倍，也应该被视为“相似”。余弦相似度忽略大小（长度），只关心方向。两篇词分布相同但长度不同的文档指向同一方向，余弦相似度为 1.0。

何时使用余弦相似度：
- 文本相似度（TF-IDF 向量、词嵌入、句子嵌入）
- 任何大小是噪声、方向是信号的领域
- 推荐系统（用户偏好向量）
- 嵌入搜索（向量数据库几乎总是使用余弦或点积）

### 点积相似度 vs 余弦相似度

两个向量的点积为：

```
a . b = a_1*b_1 + a_2*b_2 + ... + a_n*b_n
      = ||a|| * ||b|| * cos(angle)
```

余弦相似度是由两个模长归一化的点积。当两个向量已单位归一化（模长 = 1）时，点积与余弦相似度完全相同。

```
If ||a|| = 1 and ||b|| = 1:
    a . b = cos(angle between a and b)
```

两者的区别：点积包含大小信息。模长较大的向量会得到更高的点积得分。这在某些检索系统中很重要，因为你希望“热门”项目排名更高。此时模长充当隐式的质量或重要性信号。

```
a = (3, 0)    b = (1, 0)    c = (0, 1)

dot(a, b) = 3     dot(a, c) = 0
cos(a, b) = 1.0   cos(a, c) = 0.0

Both agree on direction, but dot product also reflects magnitude.
```

在实践中：
- 需要纯方向相似度时使用余弦相似度
- 大小携带有意义信息时使用点积
- 许多向量数据库（Pinecone、Weaviate、Qdrant）允许你在这两者之间选择
- 如果你的嵌入已做 L2 归一化，这个选择无关紧要

### 马氏距离

欧几里得距离对所有维度一视同仁。但如果你的特征相关或尺度不同，L2 会给出误导性结果。

马氏距离考虑了数据的协方差结构。

```
d_M(x, y) = sqrt((x - y)^T * S^(-1) * (x - y))
```

其中 S 是数据的协方差矩阵。

直观理解：马氏距离先对数据去相关并归一化（白化），然后在变换后的空间中计算 L2 距离。如果 S 是单位矩阵（不相关、单位方差的特征），马氏距离就退化为欧几里得距离。

```
Example: height and weight are correlated.
Someone 6'2" and 180 lbs is not unusual.
Someone 5'0" and 180 lbs is unusual.

Euclidean distance might say they are equally far from the mean.
Mahalanobis distance correctly identifies the second as an outlier
because it accounts for the height-weight correlation.
```

何时使用马氏距离：
- 异常值检测（与均值马氏距离大的点是异常值）
- 特征具有不同尺度和相关性的分类任务
- 有足够数据估计可靠协方差矩阵时
- 制造业质量控制（多变量过程监控）

### Jaccard 相似度（用于集合）

Jaccard 相似度度量两个集合之间的重叠程度。

```
J(A, B) = |A intersect B| / |A union B|
```

取值范围为 0（无重叠）到 1（完全相同的集合）。Jaccard 距离 = 1 - Jaccard 相似度。

```
A = {cat, dog, fish}
B = {cat, bird, fish, snake}

Intersection = {cat, fish}         size = 2
Union = {cat, dog, fish, bird, snake}  size = 5

Jaccard similarity = 2/5 = 0.4
Jaccard distance = 0.6
```

何时使用 Jaccard：
- 比较标签、类别或特征的集合
- 基于词是否出现（而非词频）的文档相似度
- 近重复检测（用 MinHash 近似 Jaccard）
- 比较二值特征向量（存在/缺失数据）
- 评估分割模型（交并比 IoU = Jaccard）

### 编辑距离（Levenshtein 距离）

编辑距离计算将一个字符串转换为另一个字符串所需的最少单字符操作数。操作包括：插入、删除或替换。

```
"kitten" -> "sitting"

kitten -> sitten  (substitute k -> s)
sitten -> sittin  (substitute e -> i)
sittin -> sitting (insert g)

Edit distance = 3
```

使用动态规划计算。填充一个矩阵，其中条目 (i, j) 是字符串 A 的前 i 个字符与字符串 B 的前 j 个字符之间的编辑距离。

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

何时使用编辑距离：
- 拼写检查与纠错
- DNA 序列比对（带权重的操作）
- 模糊字符串匹配
- 混乱文本数据的去重

### KL 散度（不是距离，但常被当作距离使用）

KL 散度度量一个概率分布与另一个分布的差异程度。它将在第 09 课中介绍，但之所以纳入本讨论，是因为尽管它不是距离，人们却常把它当作“距离”来用。

```
D_KL(P || Q) = sum(p(x) * log(p(x) / q(x)))
```

关键性质：KL 散度不是对称的。

```
D_KL(P || Q) != D_KL(Q || P)
```

这意味着它不满足距离度量的基本要求。它也不满足三角不等式。它是散度，不是距离。

前向 KL（D_KL(P || Q)）是“寻均”的：Q 试图覆盖 P 的所有模态。
反向 KL（D_KL(Q || P)）是“寻模”的：Q 只关注 P 的单个模态。

你会见到 KL 散度的地方：
- VAE（ELBO 中的 KL 项将潜在分布推向先验）
- 知识蒸馏（学生模型试图匹配教师模型的分布）
- RLHF（KL 惩罚使微调模型接近基础模型）
- 策略梯度方法（约束策略更新）

### Wasserstein 距离（推土机距离）

Wasserstein 距离度量将一个概率分布变换为另一个分布所需的最小“功”。可以这么想：如果一个分布是一堆土，另一个是一个坑，你需要运多少土、运多远？

```
W(P, Q) = inf over all transport plans gamma of E[d(x, y)]
```

对于一维分布，它简化为累积分布函数之差的绝对值的积分：

```
W_1(P, Q) = integral |CDF_P(x) - CDF_Q(x)| dx
```

为什么 Wasserstein 重要：
- 它是真正的度量（对称，满足三角不等式）
- 即使分布不重叠也能提供梯度（KL 散度会趋于无穷）
- 这一性质使其成为 Wasserstein GAN（WGAN）的核心，解决了原始 GAN 的训练不稳定问题

```
Distributions with no overlap:

P: [1, 0, 0, 0, 0]    Q: [0, 0, 0, 0, 1]

KL divergence: infinity (log of zero)
Wasserstein: 4 (move all mass 4 bins)

Wasserstein gives a meaningful gradient. KL does not.
```

何时使用 Wasserstein：
- GAN 训练（WGAN、WGAN-GP）
- 比较可能不重叠的分布
- 最优传输问题
- 图像检索（比较颜色直方图）

### 为什么不同任务需要不同的距离

| 任务 | 最佳距离 | 原因 |
|------|--------------|-----|
| 文本相似度 | 余弦 | 大小是噪声，方向是语义 |
| 图像像素比较 | L2 | 空间关系重要，特征尺度可比 |
| 稀疏高维特征 | L1 | 鲁棒，不会放大罕见的大差异 |
| 集合重叠（标签、类别） | Jaccard | 数据天然是集合，不是向量 |
| 字符串匹配 | 编辑距离 | 操作对应人类的编辑直觉 |
| 异常值检测 | 马氏距离 | 考虑特征相关性和尺度 |
| 比较分布 | KL 散度 | 度量用 Q 代替 P 损失的信息 |
| GAN 训练 | Wasserstein | 即使分布不重叠也能提供梯度 |
| 嵌入（向量数据库） | 余弦或点积 | 嵌入被训练为将语义编码在方向中 |
| 推荐 | 点积 | 大小可以编码流行度或置信度 |
| DNA 序列 | 加权编辑距离 | 替换代价因核苷酸对而异 |
| 制造业质控 | L-无穷 | 任一维度的最坏偏差都重要 |

### 与损失函数的联系

损失函数是应用于预测值与目标值之间的距离函数。

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

### 与正则化的联系

正则化在损失函数中加入权重的范数惩罚。

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

为什么 L1 产生稀疏性而 L2 不会：想象二维权重空间中的约束区域。L1 是菱形，L2 是圆形。损失函数的等高线（椭圆）最有可能与菱形在角上相切，此时有一个权重为零。而它们与圆形在光滑点相切，此时两个权重都非零。

### 最近邻搜索

每个距离函数都隐含一个最近邻搜索问题：给定查询点，找到数据集中最接近的点。

在包含 n 个点、d 个维度的数据集中，精确最近邻搜索每次查询的复杂度为 O(n * d)。对于大型数据集，这太慢了。

近似最近邻（ANN）算法用少量精度换取巨大的速度提升：

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

HNSW（分层可导航小世界图）是现代向量数据库中的主流算法。它构建一个多层图，每个节点连接到其近似最近邻。搜索从顶层开始（稀疏、长跳）并逐层下降到底层（稠密、短跳）。

```figure
norm-unit-balls
```

## 动手构建

### 步骤 1：所有范数和距离函数

完整实现见 `code/distances.py`。每个函数都只使用基础 Python 数学从零构建。

### 步骤 2：相同数据，不同距离，不同近邻

`distances.py` 中的演示创建一个数据集，选取一个查询点，并展示最近邻如何随距离度量而变化。在 L1 下“最近”的点，在 L2 或余弦下未必最近。

### 步骤 3：嵌入相似度搜索

代码包含一个模拟嵌入相似度搜索，使用余弦相似度 vs L2 距离查找与查询最相似的“文档”，展示排名可能不同。

## 使用

最常见的实际用途：在向量数据库中查找相似项。

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

当你调用 `model.encode(text)` 然后在向量数据库中搜索时，底层就是这样的流程。嵌入模型将文本映射为向量。向量数据库使用 ANN 算法（避免逐一检查）计算你的查询向量与每个存储向量之间的余弦相似度（或点积）。

## 练习

1. 计算 (1, 2, 3) 和 (4, 0, 6) 之间的 L1、L2 和 L-无穷距离。验证 L-inf <= L2 <= L1 对任意点对都成立。证明为什么这个排序是有保证的。

2. 构造两个余弦相似度高（> 0.9）但 L2 距离大（> 10）的向量。从几何上解释发生了什么。然后构造两个余弦相似度低（< 0.3）但 L2 距离小（< 0.5）的向量。

3. 实现一个函数，输入一个数据集和一个查询点，返回在 L1、L2、余弦和马氏距离下的最近邻。找到一个数据集，使得四种度量在哪个点最近上互不一致。

4. 用 CDF 方法手动计算 [0.5, 0.5, 0, 0] 和 [0, 0, 0.5, 0.5] 之间的 Wasserstein 距离。再计算 [0.25, 0.25, 0.25, 0.25] 和 [0, 0, 0.5, 0.5] 之间的距离。哪个更大，为什么？

5. 实现 MinHash 以近似 Jaccard 相似度。生成 100 个随机集合，计算所有配对的精确 Jaccard，并分别使用 50、100、200 个哈希函数与 MinHash 近似结果比较。绘制近似误差。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|----------------------|
| 范数 | “向量的大小” | 将向量映射为非负标量的函数，满足三角不等式、绝对齐次性，且仅零向量的范数为零 |
| L1 范数 | “曼哈顿距离” | 分量绝对值之和。在优化中产生稀疏性。对异常值鲁棒 |
| L2 范数 | “欧几里得距离” | 分量平方和的平方根。欧几里得空间中的直线距离 |
| Lp 范数 | “广义范数” | 分量绝对值的 p 次幂之和的 p 次方根。L1 和 L2 是特例 |
| L-无穷范数 | “最大范数”或“切比雪夫距离” | 最大绝对分量值。p 趋于无穷时 Lp 的极限 |
| 余弦相似度 | “向量之间的夹角” | 由两个模长归一化的点积。范围 -1 到 +1。忽略向量长度 |
| 余弦距离 | “1 减余弦相似度” | 将余弦相似度转换为距离。范围 0 到 2 |
| 点积 | “未归一化的余弦” | 分量逐项乘积之和。等于余弦相似度乘以两个模长 |
| 马氏距离 | “考虑相关性的距离” | 使用数据协方差矩阵进行白化（去相关并归一化）后的空间中的 L2 距离 |
| Jaccard 相似度 | “集合重叠” | 交集大小除以并集大小。用于集合，不是向量 |
| 编辑距离 | “Levenshtein 距离” | 将一个字符串转换为另一个所需的最少插入、删除和替换次数 |
| KL 散度 | “分布之间的距离” | 不是真正的距离（不对称）。度量用 Q 编码 P 所需的额外比特数 |
| Wasserstein 距离 | “推土机距离” | 将质量从一个分布运输到另一个所需的最小功。是真正的度量 |
| 近似最近邻 | “ANN 搜索” | 比精确搜索快得多地找到近似最近点的算法（HNSW、LSH、IVF） |
| HNSW | “向量数据库算法” | 分层可导航小世界图。用于快速近似最近邻搜索的多层图 |
| L1 正则化 | “Lasso” | 在损失中加入权重的 L1 范数。将权重推向零（稀疏性） |
| L2 正则化 | “Ridge”或“权重衰减” | 在损失中加入权重的 L2 范数平方。将权重向零收缩但不产生稀疏性 |
| Elastic Net | “L1 + L2” | 结合 L1 和 L2 正则化。处理相关特征组的效果优于单独任一种 |

## 延伸阅读

- [FAISS: A Library for Efficient Similarity Search](https://github.com/facebookresearch/faiss) - Meta 的十亿级 ANN 搜索库
- [Wasserstein GAN (Arjovsky et al., 2017)](https://arxiv.org/abs/1701.07875) - 将推土机距离引入 GAN 的论文
- [Locality-Sensitive Hashing (Indyk & Motwani, 1998)](https://dl.acm.org/doi/10.1145/276698.276876) - 奠基性的 ANN 算法
- [Efficient Estimation of Word Representations (Mikolov et al., 2013)](https://arxiv.org/abs/1301.3781) - Word2Vec，余弦相似度自此成为嵌入的默认选择
- [sklearn.neighbors documentation](https://scikit-learn.org/stable/modules/neighbors.html) - scikit-learn 中距离度量与近邻算法的实用指南