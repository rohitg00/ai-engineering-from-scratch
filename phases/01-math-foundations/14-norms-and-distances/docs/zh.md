# 范数与距离（Norms and Distances）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 距离函数定义了「相似」的含义。选错了，下游的一切都会崩。

**Type:** Build
**Language:** Python
**Prerequisites:** Phase 1, Lessons 01 (Linear Algebra Intuition), 02 (Vectors, Matrices & Operations)
**Time:** ~90 minutes

## 学习目标（Learning Objectives）

- 从零实现 L1、L2、cosine、Mahalanobis、Jaccard 以及编辑距离函数
- 为给定的 ML 任务选择合适的距离度量，并解释为什么其他选项会失败
- 把 L1、L2 范数与 LASSO、Ridge 正则化以及它们的几何约束区域联系起来
- 演示同一个数据集在不同度量下会得到不同的最近邻

## 问题（The Problem）

你有两个向量。也许它们是 word embedding，也许是用户画像，也许是像素数组。你需要知道：它们有多接近？

答案完全取决于你挑哪个距离函数。两个数据点在某个度量下可能是最近邻，在另一个度量下却天差地远。你的 KNN 分类器、推荐引擎、向量数据库（vector database）、聚类算法、损失函数——全都依赖这个选择。选错了，模型就会朝错误的目标优化。

不存在「通用最佳距离」。L2 适合空间数据；cosine similarity 在 NLP 里独霸天下；Jaccard 处理集合；编辑距离处理字符串；Mahalanobis 考虑相关性；Wasserstein 搬运概率质量。每一个都编码了对「相似」的不同假设。

本课从零构建每一个主要的距离函数，告诉你什么时候用哪个，并演示同一份数据在不同度量下会得到完全不同的最近邻。

## 概念（The Concept）

### 范数：度量向量的大小（Norms: measuring vector magnitude）

范数衡量一个向量的「大小」。两个向量之间的任何距离函数都可以写成它们之差的范数：d(a, b) = ||a - b||。所以理解范数就是理解距离。

### L1 范数（Manhattan distance）

L1 范数对所有分量的绝对值求和。

```
||x||_1 = |x_1| + |x_2| + ... + |x_n|
```

它叫 Manhattan distance（曼哈顿距离），因为它度量的是在城市方格街区上、只能沿坐标轴方向走、不许走对角线时的步数。

```
Point A = (1, 1)
Point B = (4, 5)

L1 distance = |4-1| + |5-1| = 3 + 4 = 7

在方格上，你向东走 3 个街区，向北走 4 个街区。
```

什么时候用 L1：
- 高维稀疏数据（文本特征、one-hot 编码）
- 想要对离群点（outlier）鲁棒（一个超大差异不会主导结果）
- 特征选择问题（L1 正则化会促进稀疏性）

与 L1 正则化（Lasso）的联系：把 ||w||_1 加到损失函数里，会惩罚权重绝对值之和。这会把小的权重精确地压到 0，从而自动完成特征选择。L1 惩罚在权重空间里产生菱形约束区域，菱形的角落正好落在某些权重为 0 的坐标轴上。

与损失函数的联系：Mean Absolute Error（MAE，平均绝对误差）就是预测值和目标值之间的平均 L1 距离。它对所有误差线性惩罚，相比 MSE 对离群点更鲁棒。

### L2 范数（Euclidean distance）

L2 范数就是直线距离。各分量平方和的平方根。

```
||x||_2 = sqrt(x_1^2 + x_2^2 + ... + x_n^2)
```

这就是你在几何课上学过的距离。n 维空间里的勾股定理。

```
Point A = (1, 1)
Point B = (4, 5)

L2 distance = sqrt((4-1)^2 + (5-1)^2) = sqrt(9 + 16) = sqrt(25) = 5.0

那条直线，斜着穿过方格。
```

什么时候用 L2：
- 低到中维度的连续数据
- 各特征尺度可比时
- 物理距离（空间数据、传感器读数）
- 像素层面的图像相似度

与 L2 正则化（Ridge）的联系：把 ||w||_2^2 加到损失函数里会惩罚大的权重。和 L1 不同，它不会把权重压到 0，而是把所有权重按比例缩向 0。L2 惩罚产生圆形的约束区域，所以坐标轴上没有「角」。权重会变小，但很少精确地等于 0。

与损失函数的联系：Mean Squared Error（MSE，均方误差）是 L2 距离平方的平均。平方让大误差受到比小误差更重的惩罚。

```
MAE (L1 loss):  |y - y_hat|         线性惩罚。对离群点鲁棒。
MSE (L2 loss):  (y - y_hat)^2       二次惩罚。对离群点敏感。
```

### Lp 范数：通用家族（Lp Norms: the general family）

L1 和 L2 都是 Lp 范数的特例：

```
||x||_p = (|x_1|^p + |x_2|^p + ... + |x_n|^p)^(1/p)
```

不同的 p 值会产生不同形状的「单位球」（所有距离原点为 1 的点的集合）：

```
p=1:    菱形            （角落在坐标轴上）
p=2:    圆 / 球面        （日常的圆球）
p=3:    超椭圆           （圆角方形）
p=inf:  正方形 / 超立方体（沿坐标轴的平直边）
```

### L 无穷范数（Chebyshev distance）

当 p 趋向无穷时，Lp 范数收敛到分量绝对值的最大值。

```
||x||_inf = max(|x_1|, |x_2|, ..., |x_n|)
```

两点之间的距离由它们差异最大的那一个维度决定。其他维度全部忽略。

```
Point A = (1, 1)
Point B = (4, 5)

L-inf distance = max(|4-1|, |5-1|) = max(3, 4) = 4
```

什么时候用 L 无穷：
- 当任何单一维度上的最坏偏差才重要时
- 棋盘类游戏（国际象棋里的王走的就是 L 无穷：朝任何方向走一步代价都是 1）
- 制造业的公差控制（每个维度都必须在规格内）

### 余弦相似度与余弦距离（Cosine Similarity and Cosine Distance）

cosine similarity 度量两个向量之间的夹角，忽略它们的大小。

```
cos_sim(a, b) = (a . b) / (||a||_2 * ||b||_2)
```

取值范围从 -1（方向相反）到 +1（方向相同）。垂直向量的 cosine similarity 为 0。

cosine distance 把它转成距离：cosine_distance = 1 - cosine_similarity。范围从 0（方向相同）到 2（方向相反）。

```
a = (1, 0)    b = (1, 1)

cos_sim = (1*1 + 0*1) / (1 * sqrt(2)) = 1/sqrt(2) = 0.707
cos_dist = 1 - 0.707 = 0.293
```

为什么 cosine 在 NLP 和 embedding 里独霸天下：在文本里，文档长度不应影响相似度。一篇关于猫的文档比另一篇关于猫的长一倍，它们也应该是「相似」的。cosine similarity 忽略大小（长度），只看方向。两个词分布相同但长度不同的文档指向同一个方向，cosine similarity 为 1.0。

什么时候用 cosine similarity：
- 文本相似度（TF-IDF 向量、word embedding、句子 embedding）
- 任何「大小是噪声、方向才是信号」的领域
- 推荐系统（用户偏好向量）
- embedding 检索（向量数据库几乎清一色用 cosine 或点积）

### 点积相似度 vs 余弦相似度（Dot Product Similarity vs Cosine Similarity）

两个向量的点积是：

```
a . b = a_1*b_1 + a_2*b_2 + ... + a_n*b_n
      = ||a|| * ||b|| * cos(angle)
```

cosine similarity 就是点积按两边大小归一化的结果。当两个向量都已经单位归一化（大小 = 1）时，点积和 cosine similarity 完全相同。

```
若 ||a|| = 1 且 ||b|| = 1:
    a . b = cos(a 与 b 的夹角)
```

它们的差别在哪里：点积包含了大小信息。模长更大的向量得到的点积分数更高。这在某些检索系统里有用——你希望「热门」物品排得更靠前。模长此时充当了一种隐式的质量或重要性信号。

```
a = (3, 0)    b = (1, 0)    c = (0, 1)

dot(a, b) = 3     dot(a, c) = 0
cos(a, b) = 1.0   cos(a, c) = 0.0

两者都同意方向，但点积还反映了模长。
```

实践中：
- 想要纯粹的方向相似度时用 cosine similarity
- 模长携带有意义信息时用点积
- 很多向量数据库（Pinecone、Weaviate、Qdrant）让你自由选择
- 如果你的 embedding 都做了 L2 归一化，那两者无所谓

### Mahalanobis 距离（Mahalanobis Distance）

Euclidean distance 把所有维度一视同仁。但如果你的特征相关或量纲不同，L2 给出的结果会误导人。

Mahalanobis distance 考虑了数据的协方差结构。

```
d_M(x, y) = sqrt((x - y)^T * S^(-1) * (x - y))
```

其中 S 是数据的协方差矩阵。

直观理解：Mahalanobis distance 先把数据去相关并归一化（whitening，白化），再在变换后的空间里计算 L2 距离。如果 S 是单位矩阵（特征不相关、单位方差），Mahalanobis distance 就退化成 Euclidean distance。

```
例子：身高和体重是相关的。
身高 6'2"、体重 180 lbs 的人并不少见。
身高 5'0"、体重 180 lbs 的人就不寻常了。

Euclidean distance 可能说他们离均值一样远。
Mahalanobis distance 会正确地把第二个识别为离群点，
因为它考虑了身高—体重的相关性。
```

什么时候用 Mahalanobis distance：
- 离群点检测（离均值的 Mahalanobis distance 很大的点就是离群点）
- 当特征量纲与相关性不同的分类任务
- 当你有足够数据估计可靠的协方差矩阵时
- 制造业的质量控制（多变量过程监控）

### Jaccard 相似度（Jaccard Similarity，针对集合）

Jaccard 相似度衡量两个集合的重叠程度。

```
J(A, B) = |A intersect B| / |A union B|
```

范围从 0（无重叠）到 1（完全相同）。Jaccard distance = 1 - Jaccard similarity。

```
A = {cat, dog, fish}
B = {cat, bird, fish, snake}

交集 = {cat, fish}                  大小 = 2
并集 = {cat, dog, fish, bird, snake} 大小 = 5

Jaccard 相似度 = 2/5 = 0.4
Jaccard 距离 = 0.6
```

什么时候用 Jaccard：
- 比较标签、类目或特征的集合
- 基于词存在性（不是频次）的文档相似度
- 近似去重（MinHash 是 Jaccard 的近似）
- 比较二值特征向量（存在 / 不存在数据）
- 评估分割模型（Intersection over Union = Jaccard）

### 编辑距离（Edit Distance / Levenshtein Distance）

编辑距离统计把一个字符串变成另一个所需的最少单字符操作数。操作有：插入、删除、替换。

```
"kitten" -> "sitting"

kitten -> sitten  (替换 k -> s)
sitten -> sittin  (替换 e -> i)
sittin -> sitting (插入 g)

编辑距离 = 3
```

用动态规划计算。填一个矩阵，其中 (i, j) 项表示字符串 A 的前 i 个字符与字符串 B 的前 j 个字符之间的编辑距离。

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

什么时候用编辑距离：
- 拼写检查与纠错
- DNA 序列比对（带加权的操作）
- 模糊字符串匹配
- 杂乱文本数据的去重

### KL 散度（不是距离，却被当成距离用）

KL 散度衡量一个概率分布与另一个的差异。Lesson 09 详细讲过，但它属于这场讨论，因为人们老把它当「距离」用——尽管它根本不是。

```
D_KL(P || Q) = sum(p(x) * log(p(x) / q(x)))
```

关键性质：KL 散度不对称。

```
D_KL(P || Q) != D_KL(Q || P)
```

这意味着它不满足距离度量的基本要求。它也不满足三角不等式。它是一种散度（divergence），不是距离。

正向 KL（D_KL(P || Q)）是「均值寻找型」：Q 试图覆盖 P 的所有模态。
反向 KL（D_KL(Q || P)）是「模态寻找型」：Q 聚焦于 P 的某一个模态。

什么时候你会遇到 KL 散度：
- VAE（ELBO 中的 KL 项把 latent 分布推向先验）
- 知识蒸馏（学生试图匹配老师的分布）
- RLHF（KL 惩罚让微调后的模型贴近基础模型）
- 策略梯度方法（约束策略更新）

### Wasserstein 距离（Earth Mover's Distance）

Wasserstein 距离衡量把一个概率分布变换成另一个所需的最小「功」。可以这样想：如果一个分布是一堆土，另一个是一个坑，你需要搬多少土、搬多远？

```
W(P, Q) = inf over all transport plans gamma of E[d(x, y)]
```

对一维分布，它简化为累积分布函数之差绝对值的积分：

```
W_1(P, Q) = integral |CDF_P(x) - CDF_Q(x)| dx
```

为什么 Wasserstein 重要：
- 它是真正的度量（对称、满足三角不等式）
- 即使分布没有重叠它也能给出梯度（KL 散度此时会变成无穷）
- 这一性质让它成为 Wasserstein GAN（WGAN）的核心，解决了原始 GAN 的训练不稳定性

```
没有重叠的分布：

P: [1, 0, 0, 0, 0]    Q: [0, 0, 0, 0, 1]

KL 散度：无穷（log 0）
Wasserstein：4（把所有质量搬 4 格）

Wasserstein 给出有意义的梯度。KL 不行。
```

什么时候用 Wasserstein：
- GAN 训练（WGAN、WGAN-GP）
- 比较可能不重叠的分布
- 最优运输问题
- 图像检索（比较颜色直方图）

### 为什么不同任务需要不同的距离

| 任务 | 最佳距离 | 原因 |
|------|--------------|-----|
| 文本相似度 | Cosine | 模长是噪声，方向才是含义 |
| 图像像素比较 | L2 | 空间关系重要，特征量纲可比 |
| 稀疏高维特征 | L1 | 鲁棒，不会放大罕见的大差异 |
| 集合重叠（标签、类目） | Jaccard | 数据天然是集合，不是向量 |
| 字符串匹配 | 编辑距离 | 操作直接对应人类编辑直觉 |
| 离群点检测 | Mahalanobis | 考虑特征间相关性与量纲 |
| 比较分布 | KL 散度 | 衡量用 Q 替代 P 时丢失的信息 |
| GAN 训练 | Wasserstein | 即便分布不重叠也能给梯度 |
| Embedding（向量数据库） | Cosine 或点积 | embedding 训练目标就是把含义编码到方向 |
| 推荐 | 点积 | 模长能编码热门程度或置信度 |
| DNA 序列 | 加权编辑距离 | 不同核苷酸对的替换代价不同 |
| 制造业 QC | L 无穷 | 任何维度上的最坏偏差才重要 |

### 与损失函数的联系（Connection to Loss Functions）

损失函数其实就是把距离函数应用到预测和目标上。

```
损失函数            它使用的距离          行为
MSE                 L2 平方               重罚大误差
MAE                 L1                    所有误差等价
Huber loss          大误差用 L1，         两者兼得：对离群点鲁棒，
                    小误差用 L2           零附近梯度平滑
Cross-entropy       KL 散度               衡量分布差异
Hinge loss          max(0, margin - d)    只惩罚 margin 之内的
Triplet loss        通常 L2               把正例拉近，把负例推远
Contrastive loss    L2                    相似对靠近，不相似对超过 margin
```

### 与正则化的联系（Connection to Regularization）

正则化在损失函数里加上权重的范数惩罚。

```
L1 regularization (Lasso):   loss + lambda * ||w||_1
  -> 稀疏权重。一些权重变成精确的 0。
  -> 自动特征选择。
  -> 解有「角」（在 0 处不可微）。

L2 regularization (Ridge):   loss + lambda * ||w||_2^2
  -> 小权重。所有权重缩向 0。
  -> 没有特征选择（没有谁会精确到 0）。
  -> 解处处光滑。

Elastic Net:                  loss + lambda_1 * ||w||_1 + lambda_2 * ||w||_2^2
  -> 把 L1 的稀疏性与 L2 的稳定性结合。
  -> 相关特征组会被一起保留或一起丢弃。
```

为什么 L1 产生稀疏而 L2 不会：想象 2D 权重空间中的约束区域。L1 是菱形，L2 是圆。损失函数的等高线（椭圆）最有可能在菱形的角落处碰到边界，而那里某个权重恰好为 0。在圆上则会碰到光滑点，两个权重都非 0。

### 最近邻搜索（Nearest Neighbor Search）

每一个距离函数都隐含一个最近邻搜索问题：给定查询点，在数据集里找最近的点。

精确最近邻搜索在 n 个点、d 维的数据集里每次查询 O(n * d)。对大数据集来说太慢。

近似最近邻（Approximate Nearest Neighbor，ANN）算法用一点点精度换取大幅加速：

```
算法              思路                          被谁使用
KD-trees          坐标轴对齐空间划分            scikit-learn (低维)
Ball trees        嵌套超球                      scikit-learn (中维)
LSH               随机哈希投影                  近似去重
HNSW              分层可导航小世界图            FAISS、Qdrant、Weaviate
IVF               基于倒排文件、聚类的检索      FAISS（十亿级别）
Product quant.    压缩向量并在压缩空间检索      FAISS（内存受限场景）
```

HNSW（Hierarchical Navigable Small World，分层可导航小世界）是现代向量数据库的主流算法。它构建一个多层图，每个节点连接它的近似最近邻。搜索从顶层（稀疏、长跳）开始，向下降到底层（密集、短跳）。

## 动手实现（Build It）

### Step 1：所有范数与距离函数

完整实现见 `code/distances.py`。每个函数都是从零搭建，只用基础的 Python 数学。

### Step 2：同样的数据，不同的距离，不同的邻居

`distances.py` 里的演示创建一个数据集、挑一个查询点，展示最近邻如何随距离度量变化。在 L1 下「最近」的那个点，在 L2 或 cosine 下未必最近。

### Step 3：embedding 相似度搜索

代码里还包含一个模拟的 embedding 相似度搜索：用 cosine similarity 与 L2 距离分别为查询找最相似的「文档」，展示排名可以如何不同。

## 用起来（Use It）

最常见的实际用途：在向量数据库里找相似项。

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

当你调用 `model.encode(text)` 然后去向量数据库搜索时，底层做的就是这件事。embedding 模型把文本映射成向量。向量数据库在你的查询向量与每个存储向量之间计算 cosine similarity（或点积），并用 ANN 算法避免逐个比较。

## 练习（Exercises）

1. 计算 (1, 2, 3) 与 (4, 0, 6) 之间的 L1、L2 与 L 无穷距离。验证对任意两点 L-inf <= L2 <= L1 总成立。证明这个序关系为什么必然成立。

2. 构造两个向量，使 cosine similarity 很高（> 0.9）但 L2 距离很大（> 10）。从几何上解释发生了什么。然后再构造两个向量，使 cosine similarity 很低（< 0.3）但 L2 距离很小（< 0.5）。

3. 实现一个函数，输入一个数据集和一个查询点，分别返回 L1、L2、cosine、Mahalanobis 距离下的最近邻。找一个数据集，让这四种度量对最近邻的判断全都不同。

4. 用 CDF 法手算 [0.5, 0.5, 0, 0] 与 [0, 0, 0.5, 0.5] 之间的 Wasserstein 距离。再算 [0.25, 0.25, 0.25, 0.25] 与 [0, 0, 0.5, 0.5] 之间的。哪个更大，为什么？

5. 实现 MinHash 来近似 Jaccard 相似度。生成 100 个随机集合，计算所有点对的精确 Jaccard，再用 50、100、200 个 hash 函数的 MinHash 近似进行对比。把近似误差画出来。

## 关键术语（Key Terms）

| 术语 | 人们怎么说 | 它实际是什么 |
|------|----------------|----------------------|
| Norm（范数） | 「向量的大小」 | 把向量映到非负标量的函数，满足三角不等式、绝对齐次性，且只对零向量取 0 |
| L1 norm | 「Manhattan distance」 | 各分量绝对值之和。在优化中产生稀疏。对离群点鲁棒 |
| L2 norm | 「Euclidean distance」 | 各分量平方和的平方根。欧氏空间里的直线距离 |
| Lp norm | 「广义范数」 | 各分量绝对值 p 次方和的 p 次方根。L1、L2 是其特例 |
| L 无穷范数 | 「Max norm」或「Chebyshev distance」 | 分量绝对值的最大值。Lp 当 p 趋于无穷时的极限 |
| Cosine similarity | 「向量夹角」 | 点积按两边模长归一化。范围 -1 到 +1。忽略向量长度 |
| Cosine distance | 「1 减 cosine similarity」 | 把 cosine similarity 转成距离。范围 0 到 2 |
| 点积（Dot product） | 「未归一化的 cosine」 | 分量乘积之和。等于 cosine similarity 乘以两边模长 |
| Mahalanobis distance | 「考虑相关性的距离」 | 用数据协方差矩阵做白化（去相关并归一化）后的空间里的 L2 距离 |
| Jaccard similarity | 「集合重叠度」 | 交集大小除以并集大小。针对集合，不是向量 |
| Edit distance | 「Levenshtein distance」 | 把一个字符串变成另一个的最少插入、删除、替换次数 |
| KL 散度 | 「分布之间的距离」 | 不是真正的距离（不对称）。衡量用 Q 编码 P 的额外比特数 |
| Wasserstein distance | 「Earth mover's distance」 | 把质量从一个分布运到另一个的最小功。是真正的度量 |
| 近似最近邻 | 「ANN search」 | 找近似最近点的算法（HNSW、LSH、IVF），比精确搜索快得多 |
| HNSW | 「向量数据库算法」 | Hierarchical Navigable Small World 图。多层图结构用于快速近似最近邻搜索 |
| L1 regularization | 「Lasso」 | 把权重的 L1 范数加进损失。把权重压向 0（稀疏） |
| L2 regularization | 「Ridge」或「权重衰减」 | 把权重 L2 范数的平方加进损失。把权重缩向 0，但不产生稀疏 |
| Elastic Net | 「L1 + L2」 | L1 与 L2 正则化的结合。比单独用任一个更好地处理相关特征组 |

## 延伸阅读（Further Reading）

- [FAISS: A Library for Efficient Similarity Search](https://github.com/facebookresearch/faiss) - Meta 的十亿级 ANN 搜索库
- [Wasserstein GAN (Arjovsky et al., 2017)](https://arxiv.org/abs/1701.07875) - 把 Earth Mover's distance 引入 GAN 的论文
- [Locality-Sensitive Hashing (Indyk & Motwani, 1998)](https://dl.acm.org/doi/10.1145/276698.276876) - 基础性 ANN 算法
- [Efficient Estimation of Word Representations (Mikolov et al., 2013)](https://arxiv.org/abs/1301.3781) - Word2Vec，cosine similarity 成为 embedding 默认选择的起点
- [sklearn.neighbors documentation](https://scikit-learn.org/stable/modules/neighbors.html) - scikit-learn 中距离度量与近邻算法的实战指南
