# 向量、矩陣與運算

> 每個神經網路（neural network）都只是矩陣乘法加上一些額外步驟。

**Type:** Build
**Languages:** Python, Julia
**Prerequisites:** Phase 1, Lesson 01 (Linear Algebra Intuition)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 建立具備逐元素（element-wise）運算、矩陣乘法（matrix multiplication）、轉置（transpose）、行列式（determinant）和反矩陣（inverse）的 Matrix 類別（class）
- 區分逐元素乘法與矩陣乘法，並說明各自適用的時機
- 只用從零打造的 Matrix 類別（class），實作單一個密集層（dense layer）：`relu(W @ x + b)`
- 說明廣播（broadcasting）規則，以及神經網路框架（framework）中偏置相加的運作方式

## The Problem｜問題

你想打造一個神經網路。讀程式碼（code）時看到這行：

```
output = activation(weights @ input + bias)
```

那個 `@` 是矩陣乘法。`weights` 是一個矩陣，`input` 是一個向量（vector）。如果你不知道這些運算在做什麼，這行就是魔法；如果你知道，它就是一層的整個前向傳遞（forward pass），只用三個運算。

模型（model）處理的每張影像都是一個像素（pixel）值矩陣（matrix）。每個詞 embedding 都是一個向量。每個神經網路的每一層都是一次矩陣變換（matrix transformation）。不精通矩陣運算就無法打造 AI 系統，就像不懂變數就無法寫程式一樣。

本課從零建立這種熟練度。

## The Concept｜核心概念

### 向量：有序的數字列表

向量是有方向和大小的數字列表。在 AI 中，向量用來表示資料點（data point）、特徵（feature）或參數（parameter）。

```
v = [3, 4]        -- a 2D vector
w = [1, 0, -2]    -- a 3D vector
```

二維向量 `[3, 4]` 指向平面上的座標 (3, 4)。它的長度（magnitude）是 5（3-4-5 三角形）。

### 矩陣：數字的網格

矩陣是一個二維網格，有列（row）和欄（column）。一個 m x n 矩陣有 m 列、n 欄。

```
A = | 1  2  3 |     -- 2x3 matrix (2 rows, 3 columns)
    | 4  5  6 |
```

在神經網路中，權重矩陣（weight matrix）把輸入向量變換成輸出向量。一個有 784 個輸入、128 個輸出的層，使用 128x784 的權重矩陣。

### 為什麼形狀很重要

矩陣乘法有一條嚴格規則：`(m x n) @ (n x p) = (m x p)`。內側維度（dimension）必須相同。

```
(128 x 784) @ (784 x 1) = (128 x 1)
  weights       input       output

Inner dimensions: 784 = 784  -- valid
```

如果你在 PyTorch 看到形狀不相符（shape mismatch）的錯誤，原因就在這裡。

### 運算對照表

| 運算 | 作用 | 神經網路中的用途 |
|-----------|-------------|-------------------|
| 加法 | 逐元素相加 | 把偏置加進輸出 |
| 純量（scalar）乘法 | 縮放每個元素 | 學習率（learning rate）× 梯度 |
| 矩陣乘法 | 變換向量 | 層的前向傳遞 |
| 轉置 | 交換列與欄 | 反向傳播（backpropagation） |
| 行列式 | 單一數字摘要 | 檢查是否可逆 |
| 反矩陣 | 復原一個變換 | 解線性方程組 |
| 單位矩陣（identity matrix） | 什麼都不做的矩陣 | 初始化（initialization）、殘差連接（residual connection） |

### 逐元素乘法 vs 矩陣乘法

這個區別常讓初學者搞混。

逐元素乘法：對相同位置的元素相乘。兩個矩陣必須是相同形狀。

```
| 1  2 |   | 5  6 |   | 5  12 |
| 3  4 | * | 7  8 | = | 21 32 |
```

矩陣乘法：列與欄的內積（dot product）。內側維度（dimension）必須相同。

```
| 1  2 |   | 5  6 |   | 1*5+2*7  1*6+2*8 |   | 19  22 |
| 3  4 | @ | 7  8 | = | 3*5+4*7  3*6+4*8 | = | 43  50 |
```

不同的運算、不同的結果、不同的規則。

### 廣播

當你把偏置向量（bias vector）加進一個輸出矩陣時，兩邊形狀並不相同。廣播會把較小的陣列延展成相符的形狀。

```
| 1  2  3 |   +   [10, 20, 30]
| 4  5  6 |

Broadcasting stretches the vector across rows:

| 1  2  3 |   | 10  20  30 |   | 11  22  33 |
| 4  5  6 | + | 10  20  30 | = | 14  25  36 |
```

每個現代框架都會自動做這件事。理解它，才不會在形狀看起來不對、程式卻跑得動的時候感到困惑。

```figure
vector-projection
```

## Build It｜動手實作

### 步驟 1：Vector 類別

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

### 步驟 2：含核心運算的 Matrix 類別（class）

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

### 步驟 3：看看它怎麼跑

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

### 步驟 4：連到神經網路

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

這就是一個密集層：`output = relu(W @ x + b)`。每個神經網路的每個密集層做的正是這件事。

## Use It｜實際應用

NumPy 能用更少的行數完成上面所有事，而且快上好幾個數量級。

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

Python 的 `@` 運算子會呼叫 `__matmul__`。NumPy 用 C 和 Fortran 寫成的最佳化 BLAS 常式實作它。同樣的數學，快 100 倍。

NumPy 中的廣播：

```python
matrix = np.array([[1, 2, 3], [4, 5, 6]])
bias = np.array([10, 20, 30])
print(matrix + bias)
```

NumPy 會自動把一維的偏置廣播到兩列上。每個神經網路框架的偏置相加都是這樣運作的。

## Ship It｜交付成果

本課產出一份透過幾何直覺教矩陣運算的 prompt。見 `outputs/prompt-matrix-operations.md`。

這裡建立的 Matrix 類別（class），是我們在第 3 階段第 10 課打造迷你神經網路框架的基礎。

## Exercises｜練習

1. **驗證反矩陣。** 計算 `A @ A.inverse_2x2()`，確認得到單位矩陣。用三個不同的 2x2 矩陣試試看。行列式為零時會發生什麼事？

2. **實作 3x3 反矩陣。** 用伴隨矩陣法（adjugate method）擴充 Matrix 類別（class），計算 3x3 矩陣的反矩陣。對照 NumPy 的 `np.linalg.inv` 驗證。

3. **打造一個兩層網路。** 只用你的 Matrix 類別（class）（不用 NumPy），建立一個兩層神經網路：輸入（3）-> 隱藏層（4）-> 輸出（2）。隨機初始化權重，跑一次前向傳遞，驗證所有形狀正確。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|----------------------|
| 向量（vector） | 「一支箭」 | 有序的數字列表。在 AI 中：高維空間中的一個點。 |
| 矩陣（matrix） | 「數字表格」 | 一個線性變換，把向量從一個空間映射到另一個空間。 |
| 矩陣乘法（matrix multiply） | 「就是把數字乘起來」 | 第一個矩陣的每一列和第二個矩陣的每一欄做內積。順序很重要。 |
| 轉置（transpose） | 「翻過來」 | 交換列與欄，把 m x n 矩陣變成 n x m。在反向傳播中很關鍵。 |
| 行列式（determinant） | 「矩陣算出的某個數字」 | 衡量矩陣把面積（2D）或體積（3D）縮放了多少。為零代表這個變換壓垮了一個維度。 |
| 反矩陣（inverse） | 「把矩陣倒回去」 | 反轉變換的矩陣。只在行列式不為零時存在。 |
| 單位矩陣（identity matrix） | 「無聊的矩陣」 | 相當於乘以 1 的矩陣。用於殘差連接（residual connection，如 ResNet）。 |
| 廣播（broadcasting） | 「神奇的形狀修正」 | 沿著缺少的維度重複，把較小的陣列延展成較大的形狀。 |
| 逐元素（element-wise） | 「普通的乘法」 | 對相同位置的元素相乘。兩個陣列必須形狀相同（或可廣播）。 |

## Further Reading｜延伸閱讀

- [3Blue1Brown: Essence of Linear Algebra](https://www.3blue1brown.com/topics/linear-algebra) - 為本課涵蓋的每個運算提供視覺直覺
- [NumPy documentation on broadcasting](https://numpy.org/doc/stable/user/basics.broadcasting.html) - NumPy 遵循的確切規則
- [Stanford CS229 Linear Algebra Review](http://cs229.stanford.edu/section/cs229-linalg.pdf) - 針對 ML 的線性代數精簡參考
