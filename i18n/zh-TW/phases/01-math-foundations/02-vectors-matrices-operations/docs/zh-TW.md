# 向量、矩陣與運算

> 每個神經網路，說穿了都是多了幾道手續的矩陣乘法。

**Type:** Build
**Languages:** Python, Julia
**Prerequisites:** Phase 1, Lesson 01 (Linear Algebra Intuition)
**Time:** ~60 minutes

## 學習目標

- 建立 Matrix 類別，實作逐元素運算、矩陣乘法、轉置、行列式與反矩陣
- 分辨逐元素乘法與矩陣乘法，並說明各自的適用情境
- 只使用自行實作的 Matrix 類別，完成單層全連接神經網路（`relu(W @ x + b)`）
- 說明廣播規則，以及神經網路框架如何將偏差項加到輸出上

## The Problem｜問題

你想打造一個神經網路，讀到程式碼中的這一行：

```text
output = activation(weights @ input + bias)
```

`@` 代表矩陣乘法；`weights` 是矩陣，`input` 是向量。如果不了解這些運算，這行程式看起來就像魔法；了解之後，你會發現它用三個運算就完成了一層的整個前向傳播。

模型處理的每張影像，都是像素值組成的矩陣；每個詞嵌入都是一個向量；每個神經網路的每一層，都是矩陣轉換。就像寫程式得先懂變數一樣，要打造 AI 系統，也得熟悉矩陣運算。

這一課會從零開始，帶你建立這份熟悉度。

## The Concept｜核心概念

### 向量：有順序的數字清單

向量是帶有方向和大小的一串數字。在 AI 中，向量可以表示資料點、特徵或參數。

```text
v = [3, 4]        -- 二維向量
w = [1, 0, -2]    -- 三維向量
```

二維向量 `[3, 4]` 指向平面上的座標 (3, 4)，長度（大小）為 5，也就是 3-4-5 直角三角形的斜邊長度。

### 矩陣：數字組成的格狀排列

矩陣是由列和欄組成的二維格狀排列。`m x n` 矩陣有 `m` 列、`n` 欄。

```text
A = | 1  2  3 |     -- 2x3 矩陣（2 列、3 欄）
    | 4  5  6 |
```

在神經網路中，權重矩陣會把輸入向量轉換成輸出向量。輸入維度為 784、輸出維度為 128 的一層，會使用 128x784 的權重矩陣。

### 為什麼形狀很重要

矩陣乘法有嚴格規則：`(m x n) @ (n x p) = (m x p)`。兩個矩陣相乘時，內側維度必須相同。

```text
(128 x 784) @ (784 x 1) = (128 x 1)
  權重         輸入       輸出

內側維度：784 = 784  -- 符合規則
```

在 PyTorch 中遇到形狀不符的錯誤，原因就在這裡。

### 運算一覽

| 運算 | 作用 | 在神經網路中的用途 |
|-----------|-------------|-------------------|
| 加法 | 逐元素相加 | 將偏差項加到輸出 |
| 純量乘法 | 將每個元素按比例縮放 | 學習率乘上梯度 |
| 矩陣乘法 | 轉換向量 | 層的前向傳播 |
| 轉置 | 對調列與欄 | 反向傳播 |
| 行列式 | 用一個數值概括矩陣特性 | 判斷矩陣是否可逆 |
| 反矩陣 | 還原轉換 | 求解線性系統 |
| 單位矩陣 | 不改變輸入的矩陣 | 初始化、殘差連接 |

### 逐元素乘法與矩陣乘法

初學者常常會把這兩種運算搞混。

逐元素乘法：相同位置的元素彼此相乘。兩個矩陣的形狀必須相同。

```text
| 1  2 |   | 5  6 |   | 5  12 |
| 3  4 | * | 7  8 | = | 21 32 |
```

矩陣乘法：將一個矩陣的列與另一個矩陣的欄做點積。兩者的內側維度必須相同。

```text
| 1  2 |   | 5  6 |   | 1*5+2*7  1*6+2*8 |   | 19  22 |
| 3  4 | @ | 7  8 | = | 3*5+4*7  3*6+4*8 | = | 43  50 |
```

這是兩種不同的運算，結果和規則也都不同。

### 廣播

將偏差向量加到輸出矩陣時，兩者的形狀並不相同。廣播會延展較小的陣列，讓它符合另一個陣列的形狀。

```text
| 1  2  3 |   +   [10, 20, 30]
| 4  5  6 |

廣播會將向量延展到每一列：

| 1  2  3 |   | 10  20  30 |   | 11  22  33 |
| 4  5  6 | + | 10  20  30 | = | 14  25  36 |
```

現代框架都會自動執行廣播。了解這項規則，就能避免看到形狀不一致、程式卻能執行時感到困惑。

```figure
vector-projection
```

## Build It｜動手打造

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

### 步驟 2：實作具備核心運算的 Matrix 類別

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

### 步驟 3：實際執行看看

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

### 步驟 4：連結到神經網路

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

這就是一個全連接層：`output = relu(W @ x + b)`。所有神經網路中的全連接層，做的都是這件事。

## Use It｜開始使用

使用 NumPy，只要更少的程式碼，速度也快上好幾個數量級。

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

Python 的 `@` 運算子會呼叫 `__matmul__`。NumPy 使用以 C 和 Fortran 撰寫、經過最佳化的 BLAS 函式來執行矩陣乘法。數學運算相同，速度卻快 100 倍。

NumPy 的廣播：

```python
matrix = np.array([[1, 2, 3], [4, 5, 6]])
bias = np.array([10, 20, 30])
print(matrix + bias)
```

NumPy 會自動將一維偏差向量廣播到兩列。所有神經網路框架都是用這種方式加上偏差項。

## Ship It｜交付成果

本課程會產出一份提示詞，透過幾何直覺教學矩陣運算。請參閱 `outputs/prompt-matrix-operations.md`。

本課程打造的 Matrix 類別，是 Phase 3 第 10 課中迷你神經網路框架的基礎。

## Exercises｜練習

1. **驗證反矩陣。** 計算 `A @ A.inverse_2x2()`，確認結果為單位矩陣。試試三個不同的 2x2 矩陣。當行列式為零時會發生什麼事？

2. **實作 3x3 反矩陣。** 擴充 Matrix 類別，使用伴隨矩陣法計算 3x3 矩陣的反矩陣，並與 NumPy 的 `np.linalg.inv` 比對。

3. **建立雙層網路。** 只使用你實作的 Matrix 類別（不使用 NumPy），建立一個雙層神經網路：輸入（3）→ 隱藏層（4）→ 輸出（2）。初始化隨機權重、執行前向傳播，並確認所有形狀都正確。

## Key Terms｜重要詞彙

| 詞彙 | 一般說法 | 實際意義 |
|------|----------------|----------------------|
| 向量 |「一支箭頭」| 有順序的一串數字。在 AI 中，代表高維空間中的一個點。 |
| 矩陣 |「數字表格」| 一種線性轉換，能將向量從一個空間映射到另一個空間。 |
| 矩陣乘法 |「把數字乘一乘」| 將第一個矩陣的每一列與第二個矩陣的每一欄做點積。運算順序很重要。 |
| 轉置 |「把它翻過來」| 對調列與欄，將 m x n 矩陣轉成 n x m 矩陣。這在反向傳播中很重要。 |
| 行列式 |「從矩陣算出來的某個數字」| 衡量矩陣對面積（2D）或體積（3D）的縮放程度。若行列式為零，表示轉換會把某個維度壓扁。 |
| 反矩陣 |「把矩陣還原」| 能反轉原轉換的矩陣。只有行列式不為零時才存在。 |
| 單位矩陣 |「沒什麼特別的矩陣」| 相當於乘以 1 的矩陣，會用在殘差連接（ResNet）中。 |
| 廣播 |「魔法般的形狀修正」| 沿著缺少的維度重複較小的陣列，使其符合較大陣列的形狀。 |
| 逐元素 |「一般的乘法」| 將相同位置的元素相乘。兩個陣列必須形狀相同，或能透過廣播相容。 |

## 延伸閱讀

- [3Blue1Brown：線性代數的本質](https://www.3blue1brown.com/topics/linear-algebra) — 本課程所介紹各種運算的視覺化直覺
- [NumPy 廣播文件](https://numpy.org/doc/stable/user/basics.broadcasting.html) — NumPy 實際採用的廣播規則
- [Stanford CS229 線性代數複習講義](http://cs229.stanford.edu/section/cs229-linalg.pdf) — 機器學習線性代數的精簡參考資料
