# 向量、矩阵与运算

> 每个神经网络无非就是多了几步的矩阵乘法。

**类型：** 构建
**语言：** Python, Julia
**前置知识：** 第一阶段，第01课（线性代数直觉）
**时长：** 约60分钟

## 学习目标

- 构建一个支持逐元素运算、矩阵乘法、转置、行列式和逆的矩阵类
- 区分逐元素乘法与矩阵乘法，并解释各自的适用场景
- 仅使用从头实现的矩阵类实现一个单层全连接神经网络层（`relu(W @ x + b)`）
- 解释广播规则以及神经网络框架中偏置加法的工作原理

## 问题

你想构建一个神经网络。你读到这样的代码：

```
output = activation(weights @ input + bias)
```

这里的 `@` 是矩阵乘法。`weights` 是一个矩阵。`input` 是一个向量。如果你不知道这些操作的含义，这一行代码就是魔法；如果你知道，它就是一个层前向传播的全部——仅需三个操作。

你模型处理的每张图像都是像素值构成的矩阵。每个词嵌入都是一个向量。每个神经网络的每一层都是矩阵变换。如果你不熟练掌握矩阵运算，就无法构建AI系统——就像你无法在不理解变量的情况下编写代码一样。

本课将从零开始培养这种熟练度。

## 核心概念

### 向量：数字的有序列表

向量是一个具有方向和大小的数字列表。在AI中，向量表示数据点、特征或参数。

```
v = [3, 4]        -- 一个二维向量
w = [1, 0, -2]    -- 一个三维向量
```

二维向量 `[3, 4]` 指向平面上的坐标 (3, 4)。它的长度（大小）为5（3-4-5三角形）。

### 矩阵：数字的网格

矩阵是一个二维网格。有行和列。一个 m×n 矩阵有 m 行和 n 列。

```
A = | 1  2  3 |     -- 2×3矩阵（2行，3列）
    | 4  5  6 |
```

在神经网络中，权重矩阵将输入向量变换为输出向量。一个具有784个输入和128个输出的层使用一个128×784的权重矩阵。

### 为什么形状很重要

矩阵乘法有一个严格规则：`(m×n) @ (n×p) = (m×p)`。内部维度必须匹配。

```
(128×784) @ (784×1) = (128×1)
 权重矩阵     输入      输出

内部维度：784 = 784  -- 有效
```

如果PyTorch中出现形状不匹配错误，原因就在这里。

### 操作映射

| 运算 | 作用 | 神经网络中的用途 |
|------|------|------------------|
| 加法 | 逐元素合并 | 将偏置加到输出 |
| 标量乘法 | 缩放每个元素 | 学习率 × 梯度 |
| 矩阵乘法 | 变换向量 | 层的前向传播 |
| 转置 | 翻转行和列 | 反向传播（Backpropagation） |
| 行列式 | 单一数值总结 | 检查可逆性 |
| 逆 | 撤销变换 | 解线性方程组 |
| 单位矩阵 | 不做任何操作 | 初始化、残差连接（Residual Connections） |

### 逐元素乘法 vs 矩阵乘法

这个区别常常困扰初学者。

逐元素乘法：对应位置相乘。两个矩阵必须具有相同的形状。

```
| 1  2 |   | 5  6 |   | 5  12 |
| 3  4 | * | 7  8 | = | 21 32 |
```

矩阵乘法：行与列的点积。内部维度必须匹配。

```
| 1  2 |   | 5  6 |   | 1*5+2*7  1*6+2*8 |   | 19  22 |
| 3  4 | @ | 7  8 | = | 3*5+4*7  3*6+4*8 | = | 43  50 |
```

不同的运算，不同的结果，不同的规则。

### 广播（Broadcasting）

当你将一个偏置向量加到输出矩阵上时，形状可能不匹配。广播会拉伸较小的数组以匹配较大的数组。

```
| 1  2  3 |   +   [10, 20, 30]
| 4  5  6 |

广播将向量沿行方向拉伸：

| 1  2  3 |   | 10  20  30 |   | 11  22  33 |
| 4  5  6 | + | 10  20  30 | = | 14  25  36 |
```

每个现代框架都会自动执行此操作。理解它有助于防止当形状看似错误但代码仍能运行时产生的困惑。

## 动手构建

### 第一步：向量类

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

### 第二步：带核心运算的矩阵类

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
            raise ValueError("矩阵是奇异的，不存在逆矩阵")
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

### 第三步：查看运行效果

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

### 第四步：与神经网络关联

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

print(f"输入形状: {inputs.shape}")
print(f"权重形状: {weights.shape}")
print(f"输出形状: {output.shape}")
print(f"输出: {output.data}")
```

这就是一个稠密层：`output = relu(W @ x + b)`。每个神经网络中的每个稠密层都完全执行这个操作。

## 使用它

NumPy可以用更少的代码行数并以快几个数量级的速度完成上述所有操作。

```python
import numpy as np

A = np.array([[1, 2], [3, 4]])
B = np.array([[5, 6], [7, 8]])

print("A + B =\n", A + B)
print("A * B (逐元素乘法) =\n", A * B)
print("A @ B (矩阵乘法) =\n", A @ B)
print("A^T =\n", A.T)
print("det(A) =", np.linalg.det(A))
print("A^-1 =\n", np.linalg.inv(A))
print("I =\n", np.eye(2))

inputs = np.random.randn(3, 1)
weights = np.random.randn(2, 3)
bias = np.array([[0.1], [0.1]])
output = np.maximum(0, weights @ inputs + bias)

print(f"\n神经网络层: {weights.shape} @ {inputs.shape} = {output.shape}")
print(f"输出:\n{output}")
```

Python中的 `@` 运算符会调用 `__matmul__`。NumPy使用用C和Fortran编写的优化BLAS例程来实现它。相同的数学运算，速度提升100倍。

NumPy中的广播：

```python
matrix = np.array([[1, 2, 3], [4, 5, 6]])
bias = np.array([10, 20, 30])
print(matrix + bias)
```

NumPy自动将一维偏置广播到两行。这就是每个神经网络框架中偏置加法的工作方式。

## 交付

本课产生一个用于通过几何直觉教授矩阵运算的提示词。参见 `outputs/prompt-matrix-operations.md`。

这里构建的矩阵类是第三阶段第10课中我们构建的微型神经网络框架的基础。

## 练习

1. **验证逆矩阵。** 计算 `A @ A.inverse_2x2()` 并确认你得到了单位矩阵。用三个不同的2x2矩阵尝试。当行列式为0时会发生什么？

2. **实现3x3逆矩阵。** 扩展矩阵类，使用伴随矩阵法计算3x3矩阵的逆。用NumPy的 `np.linalg.inv` 测试你的实现。

3. **构建一个两层网络。** 仅使用你的矩阵类（不使用NumPy），创建一个两层神经网络：输入 (3) -> 隐藏层 (4) -> 输出 (2)。初始化随机权重，执行一次前向传播，并验证所有形状是否正确。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|------------|----------|
| 向量 | “一个箭头” | 数字的有序列表。在AI中：高维空间中的一个点。 |
| 矩阵 | “一个数字表格” | 线性变换。它将向量从一个空间映射到另一个空间。 |
| 矩阵乘法 | “就乘一下数字” | 第一个矩阵的每一行与第二个矩阵的每一列进行点积。顺序很重要。 |
| 转置 | “翻转一下” | 交换行和列。将m×n矩阵变为n×m。在反向传播中至关重要。 |
| 行列式 | “从矩阵中得到的某个数字” | 衡量矩阵缩放面积（2D）或体积（3D）的程度。为零表示该变换压碎了一个维度。 |
| 逆矩阵 | “撤销这个矩阵” | 能逆转变换的矩阵。仅当行列式不为零时存在。 |
| 单位矩阵 | “无聊的矩阵” | 相当于乘以1的矩阵。用于残差连接（ResNets）。 |
| 广播 | “神奇的形状修复” | 通过沿缺失维度重复来拉伸较小的数组以匹配较大的数组。 |
| 逐元素 | “普通乘法” | 对应位置相乘。两个数组必须具有相同形状（或可广播）。 |

## 扩展阅读

- [3Blue1Brown: 线性代数的本质](https://www.3blue1brown.com/topics/linear-algebra) - 对这里介绍的每个运算的视觉直觉
- [NumPy文档关于广播](https://numpy.org/doc/stable/user/basics.broadcasting.html) - NumPy遵循的精确规则
- [斯坦福CS229线性代数复习](http://cs229.stanford.edu/section/cs229-linalg.pdf) - 针对机器学习的线性代数简明参考