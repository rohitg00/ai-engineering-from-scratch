# 载体、矩阵和操作

> 每个神经网络都只是带有额外步骤的矩阵相乘。

** 类型：** 构建
** 语言：** Python，Julia
** 预科：** 第1阶段，第01课（线性代数直觉）
** 时间：** ~60分钟

## 学习目标

- 构建一个Matrix类，其中包含元素操作、矩阵乘法、转置、行列式和求逆
- 区分逐元素相乘与矩阵相乘，并解释每种相乘何时适用
- 仅使用从头开始的Matrix类实现单个密集神经网络层（' relu（W @ x + b）'）
- 解释广播规则以及偏差添加如何在神经网络框架中工作

## 问题

你想构建一个神经网络。您阅读代码并看到以下内容：

```
output = activation(weights @ input + bias)
```

那个'@'是矩阵相乘。“权重”是一个矩阵。“输入”是一个载体。如果您不知道这些操作是做什么的，那么这句话就是魔法。如果您知道的话，这是一个层的整个向前传递，需要三个操作。

您的模型处理的每个图像都是像素值矩阵。每个词嵌入都是一个载体。每个神经网络的每一层都是一个矩阵变换。如果不精通矩阵运算，你就无法构建人工智能系统，就像如果不了解变量就无法编写代码一样。

本课从头开始建立流利度。

## 概念

### Vectors：有序的数字列表

载体是具有方向和大小的数字列表。在人工智能中，载体代表数据点、特征或参数。

```
v = [3, 4]        -- a 2D vector
w = [1, 0, -2]    -- a 3D vector
```

2D载体“[3，4]”指向平面上的坐标（3，4）。它的长度（星等）是5（3-4-5三角形）。

### 矩阵：数字网格

矩阵是一个2D网格。收件箱和列。m x n矩阵有m行和n列。

```
A = | 1  2  3 |     -- 2x3 matrix (2 rows, 3 columns)
    | 4  5  6 |
```

在神经网络中，权重矩阵将输入载体转换为输出载体。具有784个输入和128个输出的层使用128 x784的权重矩阵。

### 为什么形状很重要

矩阵相乘有一个严格的规则：“（m x n）@（n x p）=（m x p）”。内部维度必须匹配。

```
(128 x 784) @ (784 x 1) = (128 x 1)
  weights       input       output

Inner dimensions: 784 = 784  -- valid
```

如果您在PyTorch中出现形状不匹配错误，这就是原因。

### 操作地图

| 操作 | 它所做的 | 神经网络的使用 |
|-----------|-------------|-------------------|
| 此外 | 元素组合 | 增加产出偏见 |
| 纯量乘 | 扩展每个元素 | 学习率 * 梯度 |
| 矩阵乘法 | 变换向量 | 分层向前传球 |
| 转置 | 翻转行和列 | 反向传播 |
| 决定因素 | 单数摘要 | 检查可逆性 |
| 逆 | 撤消转换 | 求解线性系统 |
| 身份 | 无所作为矩阵 | 、剩余连接 |

### 元素与矩阵相乘

这种区别不断地让初学者绊倒。

元素方面：乘以匹配位置。两个矩阵的形状必须相同。

```
| 1  2 |   | 5  6 |   | 5  12 |
| 3  4 | * | 7  8 | = | 21 32 |
```

矩阵相乘：行和列的点积。内部维度必须匹配。

```
| 1  2 |   | 5  6 |   | 1*5+2*7  1*6+2*8 |   | 19  22 |
| 3  4 | @ | 7  8 | = | 3*5+4*7  3*6+4*8 | = | 43  50 |
```

不同的操作，不同的结果，不同的规则。

### 广播

当您向输出矩阵添加偏置载体时，形状不匹配。广播扩展了较小的阵列以适应。

```
| 1  2  3 |   +   [10, 20, 30]
| 4  5  6 |

Broadcasting stretches the vector across rows:

| 1  2  3 |   | 10  20  30 |   | 11  22  33 |
| 4  5  6 | + | 10  20  30 | = | 14  25  36 |
```

每个现代框架都会自动做到这一点。理解它可以防止形状似乎错误但代码运行时出现混乱。

## 建设党

### 第1步：载体类

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

### 第2步：具有核心运营的矩阵类

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

### 第3步：确保它有效

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

### 步骤4：连接到神经网络

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

这是一个单一的密集层：“输出= relu（W @ x + b）”。每个神经网络中的每个密集层正是这样做的。

## 使用它

NumPy以更少的行和更快的数量级完成上述所有工作。

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

Python中的“@”操作符调用“__matmul__'。NumPy通过用C和PSO编写的优化BLAS例程来实现它。同样的数学，快了100倍。

NumPy广播：

```python
matrix = np.array([[1, 2, 3], [4, 5, 6]])
bias = np.array([10, 20, 30])
print(matrix + bias)
```

NumPy自动在两行中广播1D偏差。这就是偏差添加在每个神经网络框架中的工作原理。

## 把它运

本课提示通过几何直觉教授矩阵运算。请参阅“输出/prompt-matrix-operations.md”。

这里构建的Matrix类是我们在第3阶段第10课中构建的迷你神经网络框架的基础。

## 演习

1. ** 验证相反的情况。**乘以“A@A.inverse_2x2（）”并确认获得单位矩阵。尝试使用三个不同的2x 2矩阵。当决定因素为零时会发生什么？

2. ** 实现3x 3逆。**扩展Matrix类以使用adjate方法计算3x 3矩阵的逆。使用NumPy的“NP. linalg.inv”进行测试。

3. ** 构建两层网络。**仅使用Matrix类（没有NumPy）创建一个两层神经网络：输入（3）->隐藏（4）->输出（2）。初始化随机权重，运行向前传递，并验证所有形状是否正确。

## 关键术语

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|----------------|----------------------|
| 向量 | “一支箭” | 有序的数字列表。在人工智能中：多维空间中的一个点。 |
| 矩阵 | “数字表” | 线性变换。它将载体从一个空间映射到另一个空间。 |
| 矩阵乘法 | “只需乘以数字” | 第一个矩阵的每一行与第二个矩阵的每一列之间的点积。秩序很重要。 |
| 转置 | “翻转它” | 交换行和列。将m x n矩阵变成n x m。反向传播至关重要。 |
| 决定因素 | “矩阵中的一些数字” | 测量矩阵缩放面积（2D）或体积（3D）的程度。零意味着转换粉碎了一个维度。 |
| 逆 | “撤销矩阵” | 逆转转换的矩阵。仅当决定因素不为零时才存在。 |
| 单位矩阵 | “无聊的矩阵” | 乘以1的矩阵等效。用于剩余连接（ResNets）。 |
| 广播 | “神奇形状修复” | 通过沿着缺失的维度重复来扩展较小的阵列以匹配较大的阵列。 |
| 逐元素 | “常规相乘” | 乘以匹配位置。两个数组必须具有相同的形状（或可广播）。 |

## 进一步阅读

- [3Blue 1Brown：线性代数的本质]（https：//www.3blue1brown.com/topics/linear-algebra）-此处涵盖的每个操作的视觉直觉
- [NumPy关于广播的文档]（https：//numpy.org/doc/stable/user/basics.broadcasting.html）-NumPy遵循的确切规则
- [斯坦福CS 229线性代数评论]（http：//cs229.stanford.edu/section/cs229-linalg.pdf）-ML特定线性代数的简明参考
