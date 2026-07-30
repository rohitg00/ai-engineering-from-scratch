# 向量、矩陣與運算

> 每個神經網路說到底就是矩陣乘法，外加幾道手續。

**類型：** 實作
**程式語言：** Python, Julia
**先修單元：** 階段 1 · 01（線性代數的直覺）
**時間：** 約 60 分鐘

## 學習目標

- 實作一個 Matrix 類別，支援逐元素運算、矩陣乘法、轉置、行列式與反矩陣
- 分辨逐元素乘法與矩陣乘法，並說明各自適用的場合
- 只用自己從零寫的 Matrix 類別，實作一層全連接神經網路（`relu(W @ x + b)`）
- 說明廣播規則，以及神經網路框架裡加上偏權值（bias）是怎麼運作的

## 問題所在

你想動手做一個神經網路。翻開程式碼，看到這一行：

```
output = activation(weights @ input + bias)
```

那個 `@` 是矩陣乘法。`weights` 是一個矩陣，`input` 是一個向量。如果你不知道這些運算在做什麼，這行就是魔法；如果你知道，這行就是一層的完整前向傳播，只用了三個運算。

模型處理的每一張圖片，都是一個由像素值組成的矩陣。每個詞嵌入都是一個向量。每個神經網路的每一層都是一次矩陣變換。你沒辦法在不熟悉矩陣運算的情況下打造 AI 系統，就像你沒辦法在不懂變數的情況下寫程式。

這個單元就從零開始，把這份熟練度練出來。

## 核心概念

### 向量：有序的數字清單

向量是一串數字，帶有方向與大小。在 AI 裡，向量用來表示資料點、特徵或參數。

```
v = [3, 4]        -- a 2D vector
w = [1, 0, -2]    -- a 3D vector
```

二維向量 `[3, 4]` 指向平面上的座標 (3, 4)。它的長度（大小）是 5，也就是 3-4-5 直角三角形。

### 矩陣：數字排成的格子

矩陣是一個二維格子，有列（rows）也有欄（columns）。一個 m x n 矩陣有 m 列、n 欄。

```
A = | 1  2  3 |     -- 2x3 matrix (2 rows, 3 columns)
    | 4  5  6 |
```

在神經網路裡，權重矩陣把輸入向量變換成輸出向量。一層有 784 個輸入、128 個輸出，用的就是一個 128x784 的權重矩陣。

### 形狀為什麼重要

矩陣乘法有一條硬規則：`(m x n) @ (n x p) = (m x p)`。內側的維度必須相符。

```
(128 x 784) @ (784 x 1) = (128 x 1)
  weights       input       output

Inner dimensions: 784 = 784  -- valid
```

你在 PyTorch 裡遇到形狀不符的錯誤，原因就在這裡。

### 運算對照表

| 運算 | 做什麼 | 在神經網路裡的用途 |
|-----------|-------------|-------------------|
| 相加 | 逐元素合併 | 為輸出加上偏權值 |
| 純量乘法 | 縮放每一個元素 | 學習率 * 梯度 |
| 矩陣乘法 | 變換向量 | 一層的前向傳播 |
| 轉置 | 列欄互換 | 反向傳播 |
| 行列式 | 濃縮成單一數字 | 檢查是否可逆 |
| 反矩陣 | 還原一次變換 | 解線性方程組 |
| 單位矩陣 | 什麼都不做的矩陣 | 初始化、殘差連接 |

### 逐元素乘法與矩陣乘法

這個區別是初學者最常摔跤的地方。

逐元素：把位置相同的元素相乘。兩個矩陣的形狀必須一樣。

```
| 1  2 |   | 5  6 |   | 5  12 |
| 3  4 | * | 7  8 | = | 21 32 |
```

矩陣乘法：列與欄做內積。內側維度必須相符。

```
| 1  2 |   | 5  6 |   | 1*5+2*7  1*6+2*8 |   | 19  22 |
| 3  4 | @ | 7  8 | = | 3*5+4*7  3*6+4*8 | = | 43  50 |
```

不同的運算、不同的結果、不同的規則。

### 廣播

當你把一個偏權值向量加到一整批輸出的矩陣上時，形狀是不相符的。廣播會把較小的那個陣列拉開，撐到對得上為止。

```
| 1  2  3 |   +   [10, 20, 30]
| 4  5  6 |

Broadcasting stretches the vector across rows:

| 1  2  3 |   | 10  20  30 |   | 11  22  33 |
| 4  5  6 | + | 10  20  30 | = | 14  25  36 |
```

每一套現代框架都會自動做這件事。搞懂它，你就不會在形狀看起來明顯不對、程式卻照樣跑得動的時候感到困惑。

```figure
vector-projection
```

## 動手實作

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

### 步驟 2：帶核心運算的 Matrix 類別

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

### 步驟 3：跑起來看看

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

### 步驟 4：接回神經網路

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

這就是一層全連接層：`output = relu(W @ x + b)`。每個神經網路裡的每一層全連接層，做的就是這件事，一模一樣。

## 框架應用

NumPy 用更少的程式碼做完上面所有事，而且快上好幾個數量級。

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

Python 裡的 `@` 運算子會呼叫 `__matmul__`。NumPy 用 C 與 Fortran 寫成的最佳化 BLAS 常式來實作它。同樣的數學，快 100 倍。

NumPy 裡的廣播：

```python
matrix = np.array([[1, 2, 3], [4, 5, 6]])
bias = np.array([10, 20, 30])
print(matrix + bias)
```

NumPy 自動把一維的 bias 廣播到兩列上。每一套神經網路框架加偏權值，都是這樣運作的。

## 產出交付

這個單元會產出一份提示詞，用幾何直覺來教矩陣運算。請看 `outputs/prompt-matrix-operations.md`。

這裡建好的 Matrix 類別，是階段 3、單元 10 那個迷你神經網路框架的基礎。

## 練習

1. **驗證反矩陣。** 計算 `A @ A.inverse_2x2()`，確認你拿到的是單位矩陣。換三個不同的 2x2 矩陣各試一次。行列式為零的時候會發生什麼事？

2. **實作 3x3 反矩陣。** 擴充 Matrix 類別，用伴隨矩陣（adjugate）法計算 3x3 矩陣的反矩陣。拿 NumPy 的 `np.linalg.inv` 來對答案。

3. **做一個兩層網路。** 只用你自己的 Matrix 類別（不用 NumPy），建一個兩層神經網路：輸入 (3) -> 隱藏 (4) -> 輸出 (2)。隨機初始化權重，跑一次前向傳播，並確認所有形狀都正確。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|----------------|----------------------|
| 向量 | 「一支箭頭」 | 一串有序的數字。在 AI 裡：高維空間中的一個點。 |
| 矩陣 | 「一張數字表格」 | 一次線性變換。它把向量從一個空間映射到另一個空間。 |
| 矩陣乘法 | 「就是把數字乘一乘」 | 第一個矩陣的每一列，與第二個矩陣的每一欄做內積。順序有差。 |
| 轉置 | 「翻過來」 | 列欄互換。把 m x n 矩陣變成 n x m。在反向傳播裡至關重要。 |
| 行列式 | 「從矩陣算出來的某個數」 | 衡量矩陣把面積（2D）或體積（3D）放大縮小了多少。為零表示這次變換把某個維度壓扁了。 |
| 反矩陣 | 「把矩陣還原」 | 能反轉該變換的矩陣。只有在行列式不為零時才存在。 |
| 單位矩陣 | 「最無聊的那個矩陣」 | 矩陣版的「乘以 1」。用在殘差連接（ResNets）裡。 |
| 廣播 | 「神奇地把形狀修好」 | 沿著缺少的維度重複，把較小的陣列拉開來對上較大的那個。 |
| 逐元素 | 「普通的乘法」 | 把位置相同的元素相乘。兩個陣列的形狀必須相同（或可廣播）。 |

## 延伸閱讀

- [3Blue1Brown: Essence of Linear Algebra](https://www.3blue1brown.com/topics/linear-algebra) —— 本單元每個運算的視覺直覺。
- [NumPy documentation on broadcasting](https://numpy.org/doc/stable/user/basics.broadcasting.html) —— NumPy 遵循的確切規則。
- [Stanford CS229 Linear Algebra Review](http://cs229.stanford.edu/section/cs229-linalg.pdf) —— ML 專用線性代數的簡明參考。
