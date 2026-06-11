# 规范与距离

> 您的距离函数定义了“相似”的含义。选择错误，下游一切都会崩溃。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 第1阶段，课程01（线性代数直觉）、02（载体、矩阵和运算）
** 时间：** ~90分钟

## 学习目标

- 实现L1、L2、cos、Mahalanobis、Jaccard并从头开始编辑距离函数
- 为给定ML任务选择适当的距离指标并解释替代方案失败的原因
- 将L1和L2范数连接到LASSO和Ridge正则化及其几何约束区域
- 演示同一数据集如何在不同指标下产生不同的最近邻居

## 问题

你有两个载体。也许它们是文字嵌入。也许它们是用户资料。也许它们是像素阵列。你需要知道：他们有多近？

答案完全取决于你选择的距离函数。两个数据点在一个度量下可以是最近的邻居，而在另一个度量下可以相距很远。你的KNN分类器，你的推荐引擎，你的向量数据库，你的聚类算法，你的损失函数--它们都依赖于这个选择。如果做错了，你的模型就会针对错误的事情进行优化。

没有普遍的最佳距离。L2适用于空间数据。余弦相似性支配着NLP。杰卡德负责布景编辑距离手柄字符串。马哈拉诺比斯解释了相关性。沃瑟斯坦移动了概率质量。每一个都编码了关于“相似”含义的不同假设。

本课从头开始构建每个主要距离函数，向您展示每个函数何时都是正确的工具，并演示相同的数据如何根据您使用的指标产生完全不同的最近邻居。

## 概念

### 规范：测量载体幅度

规范衡量的是一个载体的“大小”。两个载体之间的每个距离函数都可以写成它们的差的规范：d（a，b）=|| a - B||.因此，理解规范就是理解距离。

### L1正常（曼哈顿距离）

L1规范将所有分量的绝对值相加。

```
||x||_1 = |x_1| + |x_2| + ... + |x_n|
```

它被称为曼哈顿距离，因为它测量您在只能沿着轴移动的城市网格上走了多远。没有对角线。

```
Point A = (1, 1)
Point B = (4, 5)

L1 distance = |4-1| + |5-1| = 3 + 4 = 7

On a grid, you walk 3 blocks east and 4 blocks north.
```

何时使用L1：
- 多维稀疏数据（文本要素、一热编码）
- 当你想要对离群值的鲁棒性时（单个巨大的差异不会占主导地位）
- 特征选择问题（L1正规化促进稀疏性）

与L1正规化（Lasso）的连接：添加||W||_1到您的损失函数惩罚绝对权重值的总和。这将小权重推到恰好为零，从而执行自动特征选择。L1罚分在权重空间中创建钻石形约束区域，并且钻石的角位于某些权重为零的轴上。

与损失函数的连接：平均绝对误差（MAE）是预测和目标之间的平均L1距离。它线性地惩罚所有错误，使其对离群值的鲁棒性与SSE相比。

### L2规范（欧几里得距离）

L2规范是直线距离。分量平方和的平方根。

```
||x||_2 = sqrt(x_1^2 + x_2^2 + ... + x_n^2)
```

这是你在几何课上学到的距离。n维中的毕达哥拉斯。

```
Point A = (1, 1)
Point B = (4, 5)

L2 distance = sqrt((4-1)^2 + (5-1)^2) = sqrt(9 + 16) = sqrt(25) = 5.0

The straight line, cutting diagonally through the grid.
```

何时使用L2：
- 中低维连续数据
- 当要素比例相当时
- 物理距离（空间数据、传感器读数）
- 像素级的图像相似性

与L2正规化（Ridge）的连接：添加||W||_2 ' 2到您的损失函数会惩罚较大的权重。与L1不同，它不会将权重推至零。它将所有权重按比例缩小到零。L2罚分会创建圆形约束区域，因此轴上没有角。重量变得很小，但很少完全为零。

与损失函数的连接：均方误差（SSE）是L2距离平方的平均值。平方法对大错误的惩罚比小错误更严重。

```
MAE (L1 loss):  |y - y_hat|         Linear penalty. Robust to outliers.
MSE (L2 loss):  (y - y_hat)^2       Quadratic penalty. Sensitive to outliers.
```

### LP规范：一般家庭

L1和L2是LP规范的特殊情况：

```
||x||_p = (|x_1|^p + |x_2|^p + ... + |x_n|^p)^(1/p)
```

p的不同值产生不同形状的“单位球”（距离原点距离1处的所有点的集合）：

```
p=1:    Diamond shape      (corners on axes)
p=2:    Circle/sphere      (the usual round ball)
p=3:    Superellipse       (rounded square)
p=inf:  Square/hypercube   (flat sides along axes)
```

### L无限规范（切比雪夫距离）

当p接近无穷大时，LP规范收敛到最大绝对分量。

```
||x||_inf = max(|x_1|, |x_2|, ..., |x_n|)
```

两点之间的距离由差异最大的一维确定。所有其他维度都被忽略。

```
Point A = (1, 1)
Point B = (4, 5)

L-inf distance = max(|4-1|, |5-1|) = max(3, 4) = 4
```

何时使用L-infinity：
- 当任何单一维度的最坏情况偏差很重要时
- 游戏棋盘（国际象棋之王在L无限移动：任何方向上一步费用1）
- 制造公差（每个尺寸必须符合规格）

### Cosine相似性和Cosine距离

Cosine相似度测量两个载体之间的角度，忽略它们的大小。

```
cos_sim(a, b) = (a . b) / (||a||_2 * ||b||_2)
```

范围从-1（相反方向）到+1（相同方向）。垂直向量的cos相似度为0。

cos距离将其转换为距离：cos_distance = 1 -cos_similarity。其范围从0（相同方向）到2（相反方向）。

```
a = (1, 0)    b = (1, 1)

cos_sim = (1*1 + 0*1) / (1 * sqrt(2)) = 1/sqrt(2) = 0.707
cos_dist = 1 - 0.707 = 0.293
```

为什么cos在NLP和嵌入中占据主导地位：在文本中，文档长度不应影响相似性。一份关于猫的文件长度是另一份关于猫的文件两倍的文件仍然应该“相似”。“Cosine相似性忽略了幅度（长度），只关心方向。单词分布相同但长度不同的两个文档指向相同的方向，并获得cos相似度1.0。

何时使用cos相似性：
- 文本相似性（TF-IDF载体、单词嵌入、句子嵌入）
- 任何幅度是噪音、方向是信号的域
- 推荐系统（用户偏好载体）
- 嵌入搜索（载体数据库几乎总是使用cos或点积）

### 点产品相似性与Cosine相似性

两个载体的点积是：

```
a . b = a_1*b_1 + a_2*b_2 + ... + a_n*b_n
      = ||a|| * ||b|| * cos(angle)
```

Cosine相似度是用两个幅度标准化的点积。当两个载体都已单位规格化（幅度= 1）时，点积和cos相似性相同。

```
If ||a|| = 1 and ||b|| = 1:
    a . b = cos(angle between a and b)
```

当它们不同时：点积包括幅度信息。幅度越大的载体获得越高的点积分数。这在某些您希望“流行”项目排名更高的检索系统中很重要。幅度充当隐含的质量或重要性信号。

```
a = (3, 0)    b = (1, 0)    c = (0, 1)

dot(a, b) = 3     dot(a, c) = 0
cos(a, b) = 1.0   cos(a, c) = 0.0

Both agree on direction, but dot product also reflects magnitude.
```

实践中：
- 当您想要纯粹的方向相似性时，请使用cos相似性
- 当量级携带有意义的信息时使用点积
- 许多载体数据库（Pinecone、Weaviate、Qdrant）允许您在其中进行选择
- 如果您的嵌入是L2规格化的，那么选择并不重要

### 马氏距离

欧几里得距离平等对待所有维度。但如果您的特征相关或具有不同的尺度，L2就会给出误导性的结果。

Mahalanobis距离解释了数据的协方差结构。

```
d_M(x, y) = sqrt((x - y)^T * S^(-1) * (x - y))
```

其中S是数据的协方差矩阵。

直观：Mahalanobis距离首先对数据进行去相关和规范化（白化），然后在变换后的空间中计算L2距离。如果S是单位矩阵（不相关、单位方差特征），则Mahalanobis距离减少为欧几里得距离。

```
Example: height and weight are correlated.
Someone 6'2" and 180 lbs is not unusual.
Someone 5'0" and 180 lbs is unusual.

Euclidean distance might say they are equally far from the mean.
Mahalanobis distance correctly identifies the second as an outlier
because it accounts for the height-weight correlation.
```

何时使用Mahalanobis距离：
- 异常值检测（与平均值具有较大Mahalanobis距离的点为异常值）
- 当特征具有不同规模和相关性时进行分类
- 当您有足够的数据来估计可靠的协方差矩阵时
- 制造中的质量控制（多元过程监控）

### 贾卡德相似性（适用于套装）

Jaccard相似性度量在两个集合之间重叠。

```
J(A, B) = |A intersect B| / |A union B|
```

它的范围从0（没有重叠）到1（相同的集合）。贾卡德距离= 1 -贾卡德相似性。

```
A = {cat, dog, fish}
B = {cat, bird, fish, snake}

Intersection = {cat, fish}         size = 2
Union = {cat, dog, fish, bird, snake}  size = 5

Jaccard similarity = 2/5 = 0.4
Jaccard distance = 0.6
```

何时使用Jaccard：
- 比较标签、类别或功能集
- 基于单词存在（而不是频率）的文档相似性
- 接近重复检测（Jaccard的Min哈希逼近）
- 比较二进制特征载体（存在/不存在数据）
- 评估分割模型（Union上的交集= Jaccard）

### 编辑距离（Levenshtein距离）

编辑距离计算将一个字符串转换为另一个字符串所需的最小单字符操作数。操作包括：插入、删除或替换。

```
"kitten" -> "sitting"

kitten -> sitten  (substitute k -> s)
sitten -> sittin  (substitute e -> i)
sittin -> sitting (insert g)

Edit distance = 3
```

使用动态规划计算。填充一个矩阵，其中条目（i，j）是字符串A的前i个字符和字符串B的前j个字符之间的编辑距离。

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
- 拼写检查和纠正
- DNA序列比对（加权运算）
- 模糊字符串匹配
- 凌乱的文本数据副本

### KL Divergence（不是距离，但当作距离使用）

KL偏差衡量一种概率分布与另一种概率分布的差异。在第09课中涵盖，但它属于这次讨论，因为人们使用它作为“距离”，尽管它不是一个距离。

```
D_KL(P || Q) = sum(p(x) * log(p(x) / q(x)))
```

关键性质：KL分歧不对称。

```
D_KL(P || Q) != D_KL(Q || P)
```

这意味着它不符合距离度量的基本要求。它也不满足三角不等式。这是一种分歧，而不是距离。

向前KL（D_KL（P|| Q））是“寻求手段”：Q试图涵盖P的所有模式。
反向KL（D_KL（Q|| P））是“寻求模式”：Q专注于P的单一模式。

当您看到KL分歧时：
- VAE（ELBO中的KL项将潜在分布推向先验）
- 知识提炼（学生试图匹配老师的分布）
- RL HF（KL罚分使微调模型保持接近基本模型）
- 政策梯度方法（限制政策更新）

### 沃瑟斯坦距离（地球移动者的距离）

沃瑟斯坦距离衡量将一种概率分布转换为另一种概率分布所需的最小“功”。想象一下：如果一个分布是一堆泥土，另一个分布是一个洞，那么你必须移动多少泥土以及移动多远？

```
W(P, Q) = inf over all transport plans gamma of E[d(x, y)]
```

对于1D分布，它简化为累积分布函数绝对差的积分：

```
W_1(P, Q) = integral |CDF_P(x) - CDF_Q(x)| dx
```

沃瑟斯坦为何重要：
- 它是一个真正的指标（对称，满足三角不等式）
- 即使分布不重叠，它也提供梯度（KL分歧走向无穷大）
- 这一属性使其成为Wasserstein GAN（WGAN）的核心，解决了原始GAN的训练不稳定性

```
Distributions with no overlap:

P: [1, 0, 0, 0, 0]    Q: [0, 0, 0, 0, 1]

KL divergence: infinity (log of zero)
Wasserstein: 4 (move all mass 4 bins)

Wasserstein gives a meaningful gradient. KL does not.
```

何时使用Wasserstein：
- GAN培训（WGAN，WGAN-GP）
- 比较可能不重叠的分布
- 最佳运输问题
- 图像检索（比较颜色矩形图）

### 为什么不同的任务需要不同的距离

| 任务 | 最佳距离 | 为什么 |
|------|--------------|-----|
| 文本相似度 | 余弦 | 大小就是噪音，方向就是意义 |
| 图像像素比较 | L2 | 空间关系很重要，要素具有可比比例 |
| 稀疏的高亮度特征 | L1 | 稳健，不会放大罕见的巨大差异 |
| 设置重叠（标签、类别） | Jaccard | 数据自然是设定值的，而不是载体的 |
| 串匹配 | 编辑距离 | 操作映射到人类编辑直觉 |
| 离群点检测 | 马氏 | 考虑要素相关性和尺度 |
| 比较分布 | KL散度 | 使用Q而不是P来衡量丢失的信息 |
| GAN训练 | Wasserstein | 即使分布不重叠，也提供梯度 |
| 嵌入（vector DB） | cos或圆点积 | 嵌入经过训练以编码方向的意义 |
| 建议 | 点积 | 幅度可以编码受欢迎程度或信心 |
| DNA序列 | 加权编辑距离 | 取代成本因碱基对而异 |
| 生产QC | L无限 | 任何尺寸的最差情况偏差都很重要 |

### 与损失功能的连接

损失函数是应用于预测与目标的距离函数。

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

### 与正规化的联系

正规化将权重的规范惩罚添加到损失函数。

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

为什么L1产生稀疏性而L2不产生稀疏性：在2D权重空间中描绘约束区域。L1是钻石，L2是圆。损失函数的轮廓（椭圆）最有可能在角处接触钻石，其中一个权重为零。它们在一个光滑的点接触圆，那里的两个权重都不为零。

### 最近邻搜索

每个距离函数都意味着最近邻搜索问题：给定一个查询点，在数据集中找到最近的点。

在d维n个点的数据集中，精确最近邻搜索是每个查询O（n * d）。对于大型数据集来说，这太慢了。

近似最近邻（NN）算法以少量的准确性换取巨大的速度收益：

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

HNSW（分层导航小世界）是现代载体数据库中的主导算法。它构建了一个多层图，其中每个节点都连接到其大约最近的邻居。搜索从顶层（稀疏、长跳跃）开始，并下降到底层（密集、短跳跃）。

## 建设党

### 第1步：所有规范和距离功能

请参阅`code/distances.py`了解完整的实现。每个函数都是使用基本的Python数学从头开始构建的。

### 第2步：相同的数据、不同的距离、不同的邻居

'距离. py '中的演示创建一个数据集、选择一个查询点，并显示最近邻居如何根据距离指标而变化。L1下“最接近”的点可能不是L2或cos下最接近的点。

### 第3步：嵌入相似性搜索

该代码包括一个模拟嵌入相似性搜索，该搜索使用cos相似性与L2距离来查找与查询最相似的“文档”，从而表明排名可能会有所不同。

## 使用它

最常见的实际用途：在矢量数据库中查找相似项。

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

当您调用“Model.encode（text）”并搜索一个载体数据库时，这就是引擎盖下发生的事情。嵌入模型将文本映射到载体。载体数据库使用NN算法来计算查询载体与每个存储的载体之间的cos相似度（或点积），以避免检查所有载体。

## 演习

1. 计算（1，2，3）和（4，0，6）之间的L1，L2和L-无穷距离。验证L-inf <= L2 <= L1对于任何一对点始终成立。证明为什么这个顺序是有保证的。

2. 创建两个cos相似度高（> 0.9）但L2距离大（> 10）的变量。用几何学的方式解释正在发生的事情。然后创建两个cos相似度低（< 0.3）但L2距离小（< 0.5）的分量。

3. 实现一个函数，该函数获取数据集和查询点，并返回L1、L2、cos和Mahalanobis距离下的最近邻居。找到一个四个点最接近的数据集。

4. 使用EDF方法手工计算[0.5，0.5，0，0]和[0，0，0.5，0.5]之间的Wasserstein距离。然后在[0.25，0.25，0.25，0.25]和[0，0.5，0.5]之间计算它。哪个更大？为什么？

5. 实现Min哈希以获得大约的Jaccard相似度。生成100个随机集，计算所有对的精确Jaccard，并使用50、100和200个哈希函数与Min哈希逼近进行比较。绘制逼近误差。

## 关键术语

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|----------------|----------------------|
| 规范 | “载体的大小” | 将一个载体映射到一个非负纯量的函数，满足三角形不等式、绝对齐性和仅为零的载体 |
| L1范数 | “曼哈顿距离” | 绝对分量值的和。优化中产生稀疏性。对异常值稳健 |
| L2范数 | “欧几里得距离” | 分量平方和的平方根。欧几里得空间中的直线距离 |
| Lp范数 | “广义规范” | 绝对分量p次乘势之和的p次根。L1和L2是特殊情况 |
| L-无限规范 | “最大范数”或“切比雪夫距离” | 最大绝对分量值。当p接近无穷大时，LP的极限 |
| 余弦相似度 | “载体之间的角度” | 点积通过两个幅度进行标准化。范围从-1到+1。忽略载体长度 |
| 余弦距离 | “1减cos相似性” | 与距离的距离相似度。范围从0到2 |
| 点积 | “非正规化的cos” | 组件产品的总和。等于cos相似度乘以两个幅度 |
| 马氏距离 | “相关性感知距离” | 已使用数据协方差矩阵白化（去相关和规范化）的空间中的L2距离 |
| Jaccard相似性 | “设置重叠” | 交叉点的大小除以工会的大小。用于集合，而不是载体 |
| 编辑距离 | “Levenshtein距离” | 将一个字符串转换为另一个字符串的最少插入、删除和替换 |
| KL散度 | “分布之间的距离” | 不是真正的距离（不对称）。测量使用Q编码P时的额外位 |
| Wasserstein距离 | “推土机的距离” | 将质量从一个分配点运输到另一个分配点的最少工作量。真正的指标 |
| 近似最近邻 | “NN搜索” | 找到大约最近点的算法（HNSW、LSH、IVF）比精确搜索快得多 |
| HNSW | “载体DB算法” | 分层导航小世界图。用于快速逼近最近邻搜索的多层图 |
| L1规范化 | “套索” | 将L1规范的权重添加到损失中。将权重调至零（稀疏性） |
| L2正则化 | “山脊”或“重量衰变” | 将权重的平方L2规范添加到损失中。将权重缩小到零而不稀疏 |
| 弹性网络 | “L1 + L2” | 结合L1和L2正规化。比单独处理相关特征组更好 |

## 进一步阅读

- [FAISS：高效相似性搜索的图书馆]（https：//github.com/facebookresearch/faiss）- Meta的十亿规模NN搜索库
- [Wasserstein GAN（Arjovsky等人，2017）]（https：//arxiv.org/ab/1701.07875）-介绍地球移动者与GAN距离的论文
- [本地化敏感哈希（Indyk & Motwani，1998）]（https：//dl.acm.org/doi/10.1145/276698.276876）-基础NN算法
- [词表示的有效估计（Mikolov等人，2013）]（https：//arxiv.org/ab/1301.3781）-Word 2 Vec，其中cos相似性成为嵌入的默认值
- [sklearn.neighbors文档]（https：//scikit-learn.org/stable/modules/neighbors.html）-scikit-learn中距离指标和邻居算法的实用指南
