# 向量、矩阵与运算（Vectors, Matrices & Operations）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 每一个神经网络，本质上都只是矩阵乘法外加一些花活。

**Type:** Build
**Languages:** Python, Julia
**Prerequisites:** Phase 1, Lesson 01 (Linear Algebra Intuition)
**Time:** ~60 minutes

## 学习目标（Learning Objectives）

- 实现一个 Matrix 类，支持逐元素运算、矩阵乘法、转置、行列式和逆矩阵
- 区分逐元素乘法和矩阵乘法，并解释各自适用的场景
- 仅用从零写出的 Matrix 类实现一个稠密神经网络层（`relu(W @ x + b)`）
- 解释广播（broadcasting）规则，以及神经网络框架里偏置（bias）相加是怎么工作的

## 问题（Problem）

你想搭一个神经网络。打开代码，看到这么一行：

```
output = activation(weights @ input + bias)
```

那个 `@` 是矩阵乘法。`weights` 是一个矩阵。`input` 是一个向量。如果你不懂这些运算在做什么，这一行就是魔法；如果你懂，它就是一个层（layer）的整个前向传播——三个运算搞定。

你的模型处理的每张图，都是一个像素值矩阵。每个词的 embedding（嵌入）都是一个向量。每个神经网络的每一层，都是一个矩阵变换。不熟悉矩阵运算就想搭 AI 系统，就跟不懂变量就想写代码一样——不可能。

这节课就从零把这个手感练出来。

## 概念（Concept）

### 向量：有序的数字列表

向量就是一个有方向、有大小（magnitude）的数字列表。在 AI 里，向量用来表示数据点、特征（feature）或参数。

```
v = [3, 4]        -- a 2D vector
w = [1, 0, -2]    -- a 3D vector
```

二维向量 `[3, 4]` 指向平面上的坐标 (3, 4)。它的长度（模）是 5——经典的 3-4-5 三角形。

### 矩阵：数字的网格

矩阵是一个二维网格，有行有列。一个 m x n 矩阵就是 m 行 n 列。

```
A = | 1  2  3 |     -- 2x3 matrix (2 rows, 3 columns)
    | 4  5  6 |
```

在神经网络里，权重（weight）矩阵把输入向量变换成输出向量。一个 784 输入、128 输出的层用的是 128x784 的权重矩阵。

### 形状（shape）为什么重要

矩阵乘法有一条铁律：`(m x n) @ (n x p) = (m x p)`。内层维度必须相等。

```
(128 x 784) @ (784 x 1) = (128 x 1)
  weights       input       output

Inner dimensions: 784 = 784  -- valid
```

你在 PyTorch 里碰到 shape mismatch 报错，原因就是它。

### 运算速查表

| 运算 | 作用 | 在神经网络中的用途 |
|-----------|-------------|-------------------|
| 加法 | 逐元素相加 | 给输出加偏置（bias） |
| 标量乘法 | 缩放每个元素 | 学习率 × 梯度（gradient） |
| 矩阵乘法 | 变换向量 | 层的前向传播 |
| 转置 | 行列互换 | 反向传播 |
| 行列式（determinant） | 用一个数概括矩阵 | 判断是否可逆 |
| 逆矩阵 | 撤销一次变换 | 解线性方程组 |
| 单位矩阵（identity） | 什么都不做的矩阵 | 初始化、残差连接 |

### 逐元素乘法 vs 矩阵乘法

这块新手最容易栽跟头。

逐元素：对应位置相乘，两个矩阵形状必须完全相同。

```
| 1  2 |   | 5  6 |   | 5  12 |
| 3  4 | * | 7  8 | = | 21 32 |
```

矩阵乘法：第一个矩阵的每行和第二个矩阵的每列做点积，内层维度必须匹配。

```
| 1  2 |   | 5  6 |   | 1*5+2*7  1*6+2*8 |   | 19  22 |
| 3  4 | @ | 7  8 | = | 3*5+4*7  3*6+4*8 | = | 43  50 |
```

不同运算、不同结果、不同规则。

### 广播（Broadcasting）

往一个输出矩阵上加偏置向量时，形状对不上。广播会把小的那个数组「拉伸」到合适的形状。

```
| 1  2  3 |   +   [10, 20, 30]
| 4  5  6 |

Broadcasting stretches the vector across rows:

| 1  2  3 |   | 10  20  30 |   | 11  22  33 |
| 4  5  6 | + | 10  20  30 | = | 14  25  36 |
```

每个现代框架都会自动这么干。理解它，就不会在「形状看起来不对、但代码跑得好好的」时一脸懵。

## 动手实现（Build It）

### Step 1: Vector class

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

### Step 2: Matrix class with core operations

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

### Step 3: See it work

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

### Step 4: Connect to neural networks

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

这就是一个稠密层（dense layer）：`output = relu(W @ x + b)`。所有神经网络里的每个稠密层，干的就是这件事。

## 用起来（Use It）

NumPy 把上面这一切用更少的代码、快几个数量级地干完。

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

Python 里的 `@` 运算符会调 `__matmul__`。NumPy 用 C 和 Fortran 写的优化版 BLAS 例程实现它。同样的数学，快 100 倍。

NumPy 里的广播：

```python
matrix = np.array([[1, 2, 3], [4, 5, 6]])
bias = np.array([10, 20, 30])
print(matrix + bias)
```

NumPy 会自动把这个一维的 bias 广播到两行上去。每个神经网络框架里 bias 相加，都是这么干的。

## 上线部署（Ship It）

这节课会产出一份用几何直觉教矩阵运算的 prompt，见 `outputs/prompt-matrix-operations.md`。

这里搭出来的 Matrix 类，就是 Phase 3 Lesson 10 那个迷你神经网络框架的地基。

## 练习（Exercises）

1. **验证逆矩阵。** 计算 `A @ A.inverse_2x2()`，确认结果是单位矩阵。换三个不同的 2x2 矩阵都试一遍。如果行列式是 0，会发生什么？

2. **实现 3x3 逆矩阵。** 扩展 Matrix 类，用伴随矩阵（adjugate）法计算 3x3 矩阵的逆。和 NumPy 的 `np.linalg.inv` 对一下结果。

3. **搭一个两层网络。** 只用你写的 Matrix 类（不许用 NumPy），搭一个两层神经网络：输入 (3) -> 隐藏层 (4) -> 输出 (2)。随机初始化权重，跑一次前向传播，确认所有形状都对。

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 它实际是什么 |
|------|----------------|----------------------|
| 向量（Vector） | 「一支箭」 | 一个有序的数字列表。在 AI 里：高维空间中的一个点。 |
| 矩阵（Matrix） | 「一张数字表」 | 一个线性变换。它把向量从一个空间映射到另一个空间。 |
| 矩阵乘法（Matrix multiply） | 「数字相乘嘛」 | 第一个矩阵每一行与第二个矩阵每一列做点积。顺序很重要。 |
| 转置（Transpose） | 「翻一下」 | 行列互换。把 m x n 矩阵变成 n x m。在反向传播里至关重要。 |
| 行列式（Determinant） | 「从矩阵里搞出来的某个数」 | 衡量矩阵把面积（2D）或体积（3D）放大多少。值为 0 意味着这次变换把某个维度压扁了。 |
| 逆矩阵（Inverse） | 「把矩阵撤销」 | 能反向撤销变换的那个矩阵。只有当行列式不为 0 时才存在。 |
| 单位矩阵（Identity matrix） | 「最无聊的矩阵」 | 矩阵世界里「乘以 1」的等价物。在残差连接（ResNet）里会用到。 |
| 广播（Broadcasting） | 「魔法对形状」 | 把较小的数组沿着缺失的维度重复一下，凑成较大数组的形状。 |
| 逐元素（Element-wise） | 「正常乘法」 | 对应位置相乘。两个数组形状必须相同（或可以广播）。 |

## 延伸阅读（Further Reading）

- [3Blue1Brown: Essence of Linear Algebra](https://www.3blue1brown.com/topics/linear-algebra) - 本课涉及的所有运算的可视化直觉
- [NumPy documentation on broadcasting](https://numpy.org/doc/stable/user/basics.broadcasting.html) - NumPy 遵循的广播规则原文
- [Stanford CS229 Linear Algebra Review](http://cs229.stanford.edu/section/cs229-linalg.pdf) - 面向 ML 的线性代数精炼参考
