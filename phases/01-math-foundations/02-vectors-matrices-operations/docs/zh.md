# 02 · 向量、矩阵与运算

> 每一个神经网络本质上都是矩阵乘法，外加一些额外步骤。

**类型：** 实战构建
**语言：** Python、Julia
**前置：** 第 1 阶段，第 01 课（线性代数直觉）
**时长：** 约 60 分钟

## 学习目标

- 构建一个 Matrix 类，支持逐元素运算、矩阵乘法、转置、行列式与求逆
- 区分「逐元素乘法（element-wise multiplication）」与「矩阵乘法（matrix multiplication）」，并解释各自的适用场景
- 仅用从零实现的 Matrix 类，实现单个全连接神经网络层（`relu(W @ x + b)`）
- 解释「广播（broadcasting）」规则，以及偏置加法在神经网络框架中的工作原理

## 问题所在

你想构建一个神经网络。你阅读代码，看到这样一行：

```
output = activation(weights @ input + bias)
```

那个 `@` 就是矩阵乘法。`weights` 是一个矩阵，`input` 是一个向量。如果你不知道这些运算在做什么，这一行就是魔法。如果你知道，它就是一个网络层前向传播的全部——三个运算搞定。

你的模型处理的每一张图像，都是一个由像素值构成的矩阵。每一个词嵌入（word embedding）都是一个向量。每一个神经网络的每一层，都是一次矩阵变换。不精通矩阵运算就无法构建 AI 系统，正如不理解变量就无法编写代码一样。

本课将从零开始建立这种熟练度。

## 核心概念

### 向量：有序的数字列表

向量是带有方向和大小的数字列表。在 AI 中，向量用于表示数据点、特征或参数。

```
v = [3, 4]        -- 一个二维向量
w = [1, 0, -2]    -- 一个三维向量
```

二维向量 `[3, 4]` 指向平面上的坐标 (3, 4)。它的长度（大小）为 5（即 3-4-5 直角三角形）。

### 矩阵：数字组成的网格

矩阵是一个二维网格，由行和列构成。一个 m x n 矩阵有 m 行 n 列。

```
A = | 1  2  3 |     -- 2x3 矩阵（2 行，3 列）
    | 4  5  6 |
```

在神经网络中，权重矩阵将输入向量变换为输出向量。一个有 784 个输入、128 个输出的网络层，使用一个 128x784 的权重矩阵。

### 为什么形状很重要

矩阵乘法有一条严格的规则：`(m x n) @ (n x p) = (m x p)`。内侧维度必须匹配。

```
(128 x 784) @ (784 x 1) = (128 x 1)
  weights       input       output

内侧维度：784 = 784  -- 合法
```

如果你在 PyTorch 中遇到形状不匹配的报错，原因就在于此。

### 运算对照表

| 运算 | 作用 | 神经网络中的用途 |
|-----------|-------------|-------------------|
| 加法 | 逐元素相加 | 给输出加上偏置 |
| 标量乘法 | 缩放每个元素 | 学习率 * 梯度 |
| 矩阵乘法 | 变换向量 | 网络层前向传播 |
| 转置 | 翻转行与列 | 反向传播 |
| 行列式 | 单个数值概括 | 判断可逆性 |
| 求逆 | 撤销一次变换 | 求解线性方程组 |
| 单位矩阵 | 什么都不做的矩阵 | 初始化、残差连接 |

### 逐元素乘法 vs 矩阵乘法

这个区别经常把初学者绊倒。

逐元素乘法：相同位置相乘。两个矩阵必须形状相同。

```
| 1  2 |   | 5  6 |   | 5  12 |
| 3  4 | * | 7  8 | = | 21 32 |
```

矩阵乘法：行与列的点积。内侧维度必须匹配。

```
| 1  2 |   | 5  6 |   | 1*5+2*7  1*6+2*8 |   | 19  22 |
| 3  4 | @ | 7  8 | = | 3*5+4*7  3*6+4*8 | = | 43  50 |
```

不同的运算、不同的结果、不同的规则。

### 广播

当你给一个输出矩阵加上一个偏置向量时，二者的形状并不匹配。广播会将较小的数组拉伸以适配。

```
| 1  2  3 |   +   [10, 20, 30]
| 4  5  6 |

广播将该向量沿各行拉伸：

| 1  2  3 |   | 10  20  30 |   | 11  22  33 |
| 4  5  6 | + | 10  20  30 | = | 14  25  36 |
```

每一个现代框架都会自动完成这一步。理解它能避免在形状看似有误、代码却照常运行时产生困惑。

## 动手构建

### 步骤 1：Vector 类

```python
class Vector:
    def __init__(self, data):
        self.data = list(data)
        self.size = len(self.data)

    def __repr__(self):
        return f"Vector({self.data})"

    def __add__(self, other):
        return Vector([a + b for a, b in zip(self.data, other.data)])

    def __sub__(self, other):
        return Vector([a - b for a, b in zip(self.data, other.data)])

    def __mul__(self, scalar):
        return Vector([x * scalar for x in self.data])

    def dot(self, other):
        return sum(a * b for a, b in zip(self.data, other.data))

    def magnitude(self):
        return sum(x ** 2 for x in self.data) ** 0.5
```

### 步骤 2：带核心运算的 Matrix 类

```python
class Matrix:
    def __init__(self, data):
        self.data = [list(row) for row in data]
        self.rows = len(self.data)
        self.cols = len(self.data[0])
        self.shape = (self.rows, self.cols)

    def __repr__(self):
        rows_str = "\n  ".join(str(row) for row in self.data)
        return f"Matrix({self.shape}):\n  {rows_str}"

    def __add__(self, other):
        return Matrix([
            [self.data[i][j] + other.data[i][j] for j in range(self.cols)]
            for i in range(self.rows)
        ])

    def __sub__(self, other):
        return Matrix([
            [self.data[i][j] - other.data[i][j] for j in range(self.cols)]
            for i in range(self.rows)
        ])

    def scalar_multiply(self, scalar):
        return Matrix([
            [self.data[i][j] * scalar for j in range(self.cols)]
            for i in range(self.rows)
        ])

    def element_wise_multiply(self, other):
        return Matrix([
            [self.data[i][j] * other.data[i][j] for j in range(self.cols)]
            for i in range(self.rows)
        ])

    def matmul(self, other):
        return Matrix([
            [
                sum(self.data[i][k] * other.data[k][j] for k in range(self.cols))
                for j in range(other.cols)
            ]
            for i in range(self.rows)
        ])

    def transpose(self):
        return Matrix([
            [self.data[j][i] for j in range(self.rows)]
            for i in range(self.cols)
        ])

    def determinant(self):
        if self.shape == (1, 1):
            return self.data[0][0]
        if self.shape == (2, 2):
            return self.data[0][0] * self.data[1][1] - self.data[0][1] * self.data[1][0]
        det = 0
        for j in range(self.cols):
            minor = Matrix([
                [self.data[i][k] for k in range(self.cols) if k != j]
                for i in range(1, self.rows)
            ])
            det += ((-1) ** j) * self.data[0][j] * minor.determinant()
        return det

    def inverse_2x2(self):
        det = self.determinant()
        if det == 0:
            raise ValueError("Matrix is singular, no inverse exists")
        return Matrix([
            [self.data[1][1] / det, -self.data[0][1] / det],
            [-self.data[1][0] / det, self.data[0][0] / det]
        ])

    @staticmethod
    def identity(n):
        return Matrix([
            [1 if i == j else 0 for j in range(n)]
            for i in range(n)
        ])
```

### 步骤 3：让它跑起来

```python
A = Matrix([[1, 2], [3, 4]])
B = Matrix([[5, 6], [7, 8]])

print("A + B =", (A + B).data)
print("A @ B =", A.matmul(B).data)
print("A^T =", A.transpose().data)
print("det(A) =", A.determinant())
print("A^-1 =", A.inverse_2x2().data)

I = Matrix.identity(2)
print("A @ A^-1 =", A.matmul(A.inverse_2x2()).data)
```

### 步骤 4：与神经网络建立联系

```python
import random

inputs = Matrix([[0.5], [0.8], [0.2]])
weights = Matrix([
    [random.uniform(-1, 1) for _ in range(3)]
    for _ in range(2)
])
bias = Matrix([[0.1], [0.1]])

def relu_matrix(m):
    return Matrix([[max(0, val) for val in row] for row in m.data])

pre_activation = weights.matmul(inputs) + bias
output = relu_matrix(pre_activation)

print(f"Input shape: {inputs.shape}")
print(f"Weight shape: {weights.shape}")
print(f"Output shape: {output.shape}")
print(f"Output: {output.data}")
```

这就是单个全连接层：`output = relu(W @ x + b)`。每一个神经网络中的每一个全连接层，做的正是这件事。

## 实际运用

NumPy 用更少的代码就能完成上面的所有操作，而且速度快上好几个数量级。

```python
import numpy as np

A = np.array([[1, 2], [3, 4]])
B = np.array([[5, 6], [7, 8]])

print("A + B =\n", A + B)
print("A * B (element-wise) =\n", A * B)
print("A @ B (matrix multiply) =\n", A @ B)
print("A^T =\n", A.T)
print("det(A) =", np.linalg.det(A))
print("A^-1 =\n", np.linalg.inv(A))
print("I =\n", np.eye(2))

inputs = np.random.randn(3, 1)
weights = np.random.randn(2, 3)
bias = np.array([[0.1], [0.1]])
output = np.maximum(0, weights @ inputs + bias)

print(f"\nNeural network layer: {weights.shape} @ {inputs.shape} = {output.shape}")
print(f"Output:\n{output}")
```

Python 中的 `@` 运算符会调用 `__matmul__`。NumPy 用优化过的、以 C 和 Fortran 编写的 BLAS 例程来实现它。同样的数学运算，速度却快 100 倍。

NumPy 中的广播：

```python
matrix = np.array([[1, 2, 3], [4, 5, 6]])
bias = np.array([10, 20, 30])
print(matrix + bias)
```

NumPy 会自动将这个一维偏置广播到两行上。这正是偏置加法在每一个神经网络框架中的工作方式。

## 交付成果

本课产出一个用于通过几何直觉讲解矩阵运算的提示词（prompt）。参见 `outputs/prompt-matrix-operations.md`。

这里构建的 Matrix 类，是我们在第 3 阶段第 10 课中构建的迷你神经网络框架的基础。

## 练习

1. **验证逆矩阵。** 计算 `A @ A.inverse_2x2()`，确认你得到的是单位矩阵。用三个不同的 2x2 矩阵分别试一试。当行列式为零时会发生什么？

2. **实现 3x3 求逆。** 扩展 Matrix 类，使用伴随矩阵（adjugate）方法计算 3x3 矩阵的逆。用 NumPy 的 `np.linalg.inv` 验证你的结果。

3. **构建一个双层网络。** 仅用你自己的 Matrix 类（不用 NumPy），创建一个双层神经网络：输入层（3）-> 隐藏层（4）-> 输出层（2）。初始化随机权重，运行一次前向传播，并验证所有形状都正确。

## 关键术语

| 术语 | 人们常说的 | 它实际的含义 |
|------|----------------|----------------------|
| 向量（Vector） | "一个箭头" | 一个有序的数字列表。在 AI 中：高维空间中的一个点。 |
| 矩阵（Matrix） | "一张数字表格" | 一次线性变换。它把向量从一个空间映射到另一个空间。 |
| 矩阵乘法（Matrix multiply） | "就是把数字乘一乘" | 第一个矩阵的每一行与第二个矩阵的每一列之间的点积。顺序很重要。 |
| 转置（Transpose） | "翻一下" | 交换行与列。把 m x n 矩阵变成 n x m。在反向传播中至关重要。 |
| 行列式（Determinant） | "矩阵算出来的某个数" | 衡量矩阵对面积（2D）或体积（3D）的缩放程度。为零意味着该变换把某个维度压扁了。 |
| 逆（Inverse） | "撤销这个矩阵" | 能逆转该变换的矩阵。仅当行列式不为零时存在。 |
| 单位矩阵（Identity matrix） | "那个没啥用的矩阵" | 相当于矩阵世界里的"乘以 1"。用于残差连接（ResNet）。 |
| 广播（Broadcasting） | "魔法般的形状修正" | 通过沿缺失维度重复，将较小的数组拉伸以匹配较大的数组。 |
| 逐元素（Element-wise） | "普通的乘法" | 相同位置相乘。两个数组必须形状相同（或可广播）。 |

## 延伸阅读

- [3Blue1Brown：线性代数的本质](https://www.3blue1brown.com/topics/linear-algebra) —— 为本课涉及的每一项运算提供可视化直觉
- [NumPy 广播文档](https://numpy.org/doc/stable/user/basics.broadcasting.html) —— NumPy 所遵循的确切规则
- [Stanford CS229 线性代数综述](http://cs229.stanford.edu/section/cs229-linalg.pdf) —— 面向机器学习的线性代数简明参考
