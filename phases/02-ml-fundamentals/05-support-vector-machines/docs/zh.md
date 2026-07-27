# 支持向量机

> 在两个类别之间找到最宽的街道。这就是整个思想。

**类型：** 构建
**语言：** Python
**前置要求：** 第一阶段（第8课 优化、第14课 范数与距离、第18课 凸优化）
**时间：** ~90分钟

## 学习目标

- 使用 hinge loss 和原始形式的梯度下降从头实现线性 SVM
- 解释最大间隔原理，并从一个训练好的模型中识别支持向量（support vectors）
- 比较线性、多项式和高斯核（RBF），并解释核技巧如何避免显式的高维映射
- 评估 C 参数在间隔宽度和分类错误之间的权衡

## 问题

你有两类数据点，需要画一条线（或超平面）来分隔它们。有无穷多条线都有可能。你应该选择哪一条？

选择间隔最大的那条。间隔是决策边界与两侧最近数据点之间的距离。更大的间隔意味着分类器更自信，且对未见数据的泛化能力更好。

这一直觉导致了支持向量机（SVM），这是 ML 中数学上最优雅的算法之一。在深度学习出现之前，SVM 是主导的分类方法，并且对于小数据集、高维数据以及需要具有理论保证的原则性、良好理解的模型的问题，SVM 仍然是最佳选择。

SVM 直接连接到第一阶段：优化是凸的（第18课），间隔用范数衡量（第14课），核技巧利用点积来处理非线性边界，而无需在高维空间中进行计算。

## 概念

### 最大间隔分类器

给定线性可分的数据，标签 y_i ∈ {-1, +1}，特征向量 x_i，我们想要一个超平面 w^T x + b = 0 来分隔类别。

从点 x_i 到超平面的距离为：

```
distance = |w^T x_i + b| / ||w||
```

对于一个正确分类的点：y_i * (w^T x_i + b) > 0。间隔是超平面到任一侧最近点距离的两倍。

```mermaid
graph LR
    subgraph 间隔
        direction TB
        A["w^T x + b = +1"] ~~~ B["w^T x + b = 0"] ~~~ C["w^T x + b = -1"]
    end
    D["+ 类别的点"] --> A
    E["- 类别的点"] --> C
    B --- F["决策边界"]
```

优化问题：

```
最大化    2 / ||w||     （间隔宽度）
约束     y_i * (w^T x_i + b) >= 1  对所有 i
```

等价地（最小化 ||w||^2 更容易优化）：

```
最小化    (1/2) ||w||^2
约束     y_i * (w^T x_i + b) >= 1  对所有 i
```

这是一个凸二次规划问题。它具有唯一的全局解。恰好位于间隔边界上的数据点（即 y_i * (w^T x_i + b) = 1）就是支持向量（support vectors）。它们是唯一决定决策边界的点。移动或移除任何非支持向量的点，决策边界不会改变。

### 支持向量：关键的少数

```mermaid
graph TD
    subgraph 分类
        SV1["支持向量（+ 类）<br>y(w'x+b) = 1"] --- DB["决策边界<br>w'x+b = 0"]
        DB --- SV2["支持向量（- 类）<br>y(w'x+b) = 1"]
    end
    O1["其他 + 类点<br>（不影响边界）"] -.-> SV1
    O2["其他 - 类点<br>（不影响边界）"] -.-> SV2
```

大多数训练点是无关的。只有支持向量才重要。这就是为什么 SVM 在预测时内存效率高：你只需要存储支持向量，而不是整个训练集。

支持向量的数量也给出了泛化误差的一个上界。相对于数据集大小的支持向量越少，意味着泛化能力越好。

### 软间隔：用 C 参数处理噪声

现实数据很少完美可分。一些点可能位于边界的错误一侧，或位于间隔内部。软间隔公式通过引入松弛变量来允许违规。

```
最小化    (1/2) ||w||^2 + C * sum(xi_i)
约束     y_i * (w^T x_i + b) >= 1 - xi_i
         xi_i >= 0  对所有 i
```

松弛变量 xi_i 衡量点 i 违反间隔的程度。C 控制权衡：

| C 值 | 行为 |
|---------|----------|
| 大 C | 严厉惩罚违规。窄间隔，更少误分类。过拟合 |
| 小 C | 允许更多违规。宽间隔，更多误分类。欠拟合 |

C 是正则化强度的倒数。大 C = 更少正则化。小 C = 更多正则化。

### Hinge Loss：SVM 损失函数

软间隔 SVM 可以重写为无约束优化：

```
最小化    (1/2) ||w||^2 + C * sum(max(0, 1 - y_i * (w^T x_i + b)))
```

术语 max(0, 1 - y_i * f(x_i)) 就是 hinge loss。当点被正确分类且超出间隔时为零。当点在间隔内或被错误分类时是线性的。

```
单个点的 Hinge loss：

损失
  |
  | \
  |  \
  |   \
  |    \
  |     \_______________
  |
  +-----|-----|-------->  y * f(x)
       0     1

当 y*f(x) >= 1（正确分类，在间隔外）时损失为零。
当 y*f(x) < 1 时线性惩罚。
```

与逻辑回归的逻辑损失比较：

```
Hinge：    max(0, 1 - y*f(x))          在间隔处硬截止
Logistic： log(1 + exp(-y*f(x)))       平滑，从不完全为零
```

Hinge loss 产生稀疏解（只有支持向量有非零贡献）。逻辑损失使用所有数据点。这使得 SVM 在预测时内存效率更高。

### 用梯度下降训练线性 SVM

你可以使用 hinge loss 加上 L2 正则化的梯度下降来训练线性 SVM，而无需求解约束 QP：

```
L(w, b) = (lambda/2) * ||w||^2 + (1/n) * sum(max(0, 1 - y_i * (w^T x_i + b)))

对 w 的梯度：
  如果 y_i * (w^T x_i + b) >= 1： dL/dw = lambda * w
  如果 y_i * (w^T x_i + b) < 1：  dL/dw = lambda * w - y_i * x_i

对 b 的梯度：
  如果 y_i * (w^T x_i + b) >= 1： dL/db = 0
  如果 y_i * (w^T x_i + b) < 1：  dL/db = -y_i
```

这被称为原始形式（primal formulation）。每轮复杂度为 O(n * d)，其中 n 是样本数，d 是特征数。对于大规模、稀疏、高维数据（文本分类），这很快。

### 对偶形式与核技巧

SVM 问题的拉格朗日对偶（来自第一阶段第18课，KKT 条件）是：

```
最大化    sum(alpha_i) - (1/2) * sum_ij(alpha_i * alpha_j * y_i * y_j * (x_i . x_j))
约束     0 <= alpha_i <= C
         sum(alpha_i * y_i) = 0
```

对偶形式只涉及数据点之间的点积 x_i . x_j。这是关键洞察。用核函数 K(x_i, x_j) 替换每个点积，SVM 可以在不显式计算变换的情况下学习非线性边界。

```
线性核（Linear kernel）：     K(x, z) = x . z
多项式核（Polynomial kernel）： K(x, z) = (x . z + c)^d
RBF 核（高斯核）：          K(x, z) = exp(-gamma * ||x - z||^2)
```

RBF 核将数据映射到无限维空间。在输入空间中接近的点，核值接近 1。相距很远的点，核值接近 0。它可以学习任何光滑的决策边界。

```mermaid
graph LR
    subgraph "输入空间（不可分）"
        A["2D 中的数据点<br>圆形边界"]
    end
    subgraph "特征空间（可分）"
        B["高维中的数据点<br>线性边界"]
    end
    A -->|"核技巧<br>K(x,z) = phi(x).phi(z)"| B
```

核技巧计算高维空间中的点积，而无需真正进入那个空间。对于 D 维中 d 次的多项式核，显式特征空间有 O(D^d) 维。但 K(x, z) 在 O(D) 时间内计算。

### 用于回归的 SVM（SVR）

支持向量回归（SVR）在数据周围拟合一个宽度为 epsilon 的管道。管道内的点损失为零。管道外的点受到线性惩罚。

```
最小化    (1/2) ||w||^2 + C * sum(xi_i + xi_i*)
约束     y_i - (w^T x_i + b) <= epsilon + xi_i
         (w^T x_i + b) - y_i <= epsilon + xi_i*
         xi_i, xi_i* >= 0
```

epsilon 参数控制管道宽度。更宽的管道 = 更少的支持向量 = 更平滑的拟合。更窄的管道 = 更多的支持向量 = 更紧的拟合。

### 为什么 SVM 输给了深度学习（以及它们何时仍然胜出）

SVM 从 1990 年代末到 2010 年代初主导了 ML。深度学习因以下几个原因超越了它们：

| 因素 | SVM | 深度学习 |
|--------|------|---------------|
| 特征工程 | 需要 | 学习特征 |
| 可扩展性 | 核方法 O(n^2) 到 O(n^3) | SGD 每轮 O(n) |
| 图像/文本/音频 | 需要手工特征 | 从原始数据学习 |
| 大数据集（>10万） | 慢 | 扩展性好 |
| GPU 加速 | 收益有限 | 大幅加速 |

SVM 在以下情况下仍然胜出：
- 小数据集（几百到几千个样本）
- 高维稀疏数据（带有 TF-IDF 特征的文本）
- 当你需要数学保证（间隔界）时
- 当训练时间必须极短时（线性 SVM 非常快）
- 具有清晰间隔结构的二分类问题
- 异常检测（one-class SVM）

```figure
svm-margin
```

## 动手实现

### 第1步：Hinge loss 和梯度

基础。计算一批数据的 hinge loss 及其梯度。

```python
def hinge_loss(X, y, w, b):
    n = len(X)
    total_loss = 0.0
    for i in range(n):
        margin = y[i] * (dot(w, X[i]) + b)
        total_loss += max(0.0, 1.0 - margin)
    return total_loss / n
```

### 第2步：通过梯度下降训练线性 SVM

通过最小化正则化 hinge loss 进行训练。不需要 QP 求解器。

```python
class LinearSVM:
    def __init__(self, lr=0.001, lambda_param=0.01, n_epochs=1000):
        self.lr = lr
        self.lambda_param = lambda_param
        self.n_epochs = n_epochs
        self.w = None
        self.b = 0.0

    def fit(self, X, y):
        n_features = len(X[0])
        self.w = [0.0] * n_features
        self.b = 0.0

        for epoch in range(self.n_epochs):
            for i in range(len(X)):
                margin = y[i] * (dot(self.w, X[i]) + self.b)
                if margin >= 1:
                    self.w = [wj - self.lr * self.lambda_param * wj
                              for wj in self.w]
                else:
                    self.w = [wj - self.lr * (self.lambda_param * wj - y[i] * X[i][j])
                              for j, wj in enumerate(self.w)]
                    self.b -= self.lr * (-y[i])

    def predict(self, X):
        return [1 if dot(self.w, x) + self.b >= 0 else -1 for x in X]
```

### 第3步：核函数

实现线性、多项式和 RBF 核。

```python
def linear_kernel(x, z):
    return dot(x, z)

def polynomial_kernel(x, z, degree=3, c=1.0):
    return (dot(x, z) + c) ** degree

def rbf_kernel(x, z, gamma=0.5):
    diff = [xi - zi for xi, zi in zip(x, z)]
    return math.exp(-gamma * dot(diff, diff))
```

### 第4步：间隔和支持向量识别

训练后，识别哪些点是支持向量并计算间隔宽度。

```python
def find_support_vectors(X, y, w, b, tol=1e-3):
    support_vectors = []
    for i in range(len(X)):
        margin = y[i] * (dot(w, X[i]) + b)
        if abs(margin - 1.0) < tol:
            support_vectors.append(i)
    return support_vectors
```

完整实现见 `code/svm.py`，包含所有演示。

## 使用它

使用 scikit-learn：

```python
from sklearn.svm import SVC, LinearSVC, SVR
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

clf = Pipeline([
    ("scaler", StandardScaler()),
    ("svm", SVC(kernel="rbf", C=1.0, gamma="scale")),
])
clf.fit(X_train, y_train)
print(f"准确率：{clf.score(X_test, y_test):.4f}")
print(f"支持向量数：{clf['svm'].n_support_}")
```

重要：在训练 SVM 之前，务必缩放你的特征。SVM 对特征的大小很敏感，因为间隔依赖于 ||w||，而未缩放的特征会扭曲几何形状。

对于大数据集，使用 `LinearSVC`（原始形式，每轮 O(n)）而不是 `SVC`（对偶形式，O(n^2) 到 O(n^3)）：

```python
from sklearn.svm import LinearSVC

clf = Pipeline([
    ("scaler", StandardScaler()),
    ("svm", LinearSVC(C=1.0, max_iter=10000)),
])
```

## 练习题

1. 生成一个2D线性可分数据集。训练你的 LinearSVM 并识别支持向量。验证支持向量是最接近决策边界的点。
2. 在一个带噪声的数据集上将 C 从 0.001 变化到 1000。为每个 C 值绘制决策边界。观察从宽间隔（欠拟合）到窄间隔（过拟合）的转变。
3. 创建一个类别边界为圆形（非线性）的数据集。证明线性 SVM 失败。计算 RBF 核矩阵，并证明类别在核诱导的特征空间中变得可分。
4. 在同一数据集上比较 hinge loss 与 logistic 损失。训练一个线性 SVM 和逻辑回归。计数有多少训练点对每个模型的决策边界有贡献（支持向量 vs 所有点）。
5. 实现 SVR（epsilon 不敏感损失）。拟合 y = sin(x) + 噪声。绘制预测周围的 epsilon 管道并突出显示支持向量（管道外的点）。

## 关键术语

| 术语 | 实际含义 |
|------|----------------------|
| 支持向量（Support vectors） | 最接近决策边界的训练点。唯一决定超平面的点 |
| 间隔（Margin） | 决策边界与最近支持向量之间的距离。SVM 最大化此距离 |
| Hinge loss | max(0, 1 - y*f(x))。正确分类且在间隔外时为零，否则线性惩罚 |
| C 参数 | 间隔宽度与分类错误之间的权衡。大 C = 窄间隔，小 C = 宽间隔 |
| 软间隔（Soft margin） | 通过松弛变量允许间隔违规的 SVM 公式。处理不可分数据 |
| 核技巧（Kernel trick） | 在高维特征空间中计算点积，而无需显式映射到该空间 |
| 线性核（Linear kernel） | K(x, z) = x . z。等同于标准点积。适用于线性可分数据 |
| RBF 核 | K(x, z) = exp(-gamma * \|\|x-z\|\|^2)。映射到无限维。学习任何光滑边界 |
| 多项式核（Polynomial kernel） | K(x, z) = (x . z + c)^d。映射到多项式组合的特征空间 |
| 对偶形式（Dual formulation） | 仅依赖于数据点之间点积的 SVM 问题重述。启用核方法 |
| SVR | 支持向量回归。在数据周围拟合 epsilon 管道。管道内的点损失为零 |
| 松弛变量（Slack variables） | xi_i：衡量点违反间隔的程度。对于正确分类且在间隔外的点为零 |
| 最大间隔（Maximum margin） | 选择使到每个类别最近点距离最大化的超平面的原则 |

## 延伸阅读

- [Vapnik: The Nature of Statistical Learning Theory (1995)](https://link.springer.com/book/10.1007/978-1-4757-3264-1) - SVM 和统计学习的基础著作
- [Cortes & Vapnik: Support-vector networks (1995)](https://link.springer.com/article/10.1007/BF00994018) - 原始 SVM 论文
- [Platt: Sequential Minimal Optimization (1998)](https://www.microsoft.com/en-us/research/publication/sequential-minimal-optimization-a-fast-algorithm-for-training-support-vector-machines/) - 使 SVM 训练实用的 SMO 算法
- [scikit-learn SVM documentation](https://scikit-learn.org/stable/modules/svm.html) - 附实现细节的实用指南
- [LIBSVM: A Library for Support Vector Machines](https://www.csie.ntu.edu.tw/~cjlin/libsvm/) - 大多数 SVM 实现背后的 C++ 库
