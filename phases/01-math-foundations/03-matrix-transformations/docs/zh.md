# 矩阵变换（Matrix Transformations）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 矩阵就是一台改造空间形状的机器。搞清楚它对每个点做了什么，你就理解了整个变换。

**Type:** Build
**Languages:** Python, Julia
**Prerequisites:** Phase 1, Lessons 01-02（线性代数直觉、向量与矩阵运算）
**Time:** ~75 minutes

## 学习目标（Learning Objectives）

- 构造旋转、缩放、剪切、反射矩阵，并把它们应用到 2D 和 3D 点上
- 通过矩阵乘法组合多个变换，并验证顺序确实重要
- 通过特征方程（characteristic equation）求解 2x2 矩阵的特征值和特征向量
- 解释为什么特征值决定了 PCA 的方向、RNN 的稳定性以及谱聚类（spectral clustering）的行为

## 问题（The Problem）

你看 PCA 的资料，看到「求协方差矩阵的特征向量」。你看模型稳定性的资料，看到「检查所有特征值的模是否小于 1」。你看数据增强的资料，看到「应用一次随机旋转」。在你从几何角度理解矩阵对空间做了什么之前，这些都说不通。

矩阵不只是一堆数字组成的网格，它们是空间机器。旋转矩阵让点旋转，缩放矩阵让点拉伸，剪切矩阵让点倾斜。神经网络对数据做的每一次变换，都是这些操作之一，或它们的组合。本节课会把这些操作落到实处。

## 概念（The Concept）

### 把变换写成矩阵（Transformations as matrices）

二维里的每个线性变换都可以写成一个 2x2 矩阵。这个矩阵精确告诉你基向量 `[1, 0]` 和 `[0, 1]` 最终去了哪里，剩下的一切都顺势而出。

```mermaid
graph LR
    subgraph Before["标准基"]
        e1["e1 = [1, 0]（沿 x 轴）"]
        e2["e2 = [0, 1]（沿 y 轴）"]
    end
    subgraph Transform["矩阵 M"]
        M["M = 各列是新的基向量"]
    end
    subgraph After["经过变换 M 之后"]
        e1p["e1' = 新的 x 基"]
        e2p["e2' = 新的 y 基"]
    end
    e1 --> M --> e1p
    e2 --> M --> e2p
```

### 旋转（Rotation）

二维里以角度 theta 做旋转会保持距离和角度不变，每个点沿圆弧移动。

```mermaid
graph LR
    subgraph Before["旋转前"]
        A["A(2, 1)"]
        B["B(0, 2)"]
    end
    subgraph Rot["旋转 45 度"]
        R["R(θ) = [[cos θ, -sin θ], [sin θ, cos θ]]"]
    end
    subgraph After["旋转后"]
        Ap["A'(0.71, 2.12)"]
        Bp["B'(-1.41, 1.41)"]
    end
    A --> R --> Ap
    B --> R --> Bp
```

在三维里你绕一根轴旋转，每根轴有自己的旋转矩阵：

```
Rz(theta) = | cos  -sin  0 |     Rotate around z-axis
            | sin   cos  0 |     (x-y plane spins, z stays)
            |  0     0   1 |

Rx(theta) = | 1   0     0    |   Rotate around x-axis
            | 0  cos  -sin   |   (y-z plane spins, x stays)
            | 0  sin   cos   |

Ry(theta) = |  cos  0  sin |     Rotate around y-axis
            |   0   1   0  |     (x-z plane spins, y stays)
            | -sin  0  cos |
```

### 缩放（Scaling）

缩放沿每根轴独立地拉伸或压缩。

```mermaid
graph LR
    subgraph Before["缩放前"]
        A["A(2, 1)"]
        B["B(0, 2)"]
    end
    subgraph Scale["缩放 sx=2, sy=0.5"]
        S["S = [[2, 0], [0, 0.5]]"]
    end
    subgraph After["缩放后"]
        Ap["A'(4, 0.5)"]
        Bp["B'(0, 1)"]
    end
    A --> S --> Ap
    B --> S --> Bp
```

### 剪切（Shearing）

剪切让一根轴倾斜，另一根保持不动。它把矩形变成平行四边形。

```mermaid
graph LR
    subgraph Before["剪切前"]
        A["A(1, 0)"]
        B["B(0, 1)"]
    end
    subgraph Shear["沿 x 剪切, k=1"]
        Sh["Shx = [[1, k], [0, 1]]"]
    end
    subgraph After["剪切后"]
        Ap["A(1, 0) 不变"]
        Bp["B'(1, 1) 已偏移"]
    end
    A --> Sh --> Ap
    B --> Sh --> Bp
```

剪切矩阵：
- `Shx = [[1, k], [0, 1]]` 把 x 偏移 `k * y`
- `Shy = [[1, 0], [k, 1]]` 把 y 偏移 `k * x`

### 反射（Reflection）

反射沿某根轴或某条直线把点做镜像。

```mermaid
graph LR
    subgraph Before["反射前"]
        A["A(2, 1)"]
    end
    subgraph Reflect["沿 y 轴反射"]
        R["[[-1, 0], [0, 1]]"]
    end
    subgraph After["反射后"]
        Ap["A'(-2, 1)"]
    end
    A --> R --> Ap
```

反射矩阵：
- 沿 y 轴反射：`[[-1, 0], [0, 1]]`
- 沿 x 轴反射：`[[1, 0], [0, -1]]`

### 组合：把变换串起来（Composition: chaining transformations）

先做变换 A 再做变换 B，等价于把它们的矩阵相乘：`result = B @ A @ point`。顺序很重要。先旋转再缩放，跟先缩放再旋转，结果不一样。

```mermaid
graph LR
    subgraph Path1["先旋转 90 再缩放 (2, 0.5)"]
        P1["(1, 0)"] -->|"旋转 90"| P2["(0, 1)"] -->|"缩放"| P3["(0, 0.5)"]
    end
```

合成结果：`S @ R = [[0, -2], [0.5, 0]]`

```mermaid
graph LR
    subgraph Path2["先缩放 (2, 0.5) 再旋转 90"]
        Q1["(1, 0)"] -->|"缩放"| Q2["(2, 0)"] -->|"旋转 90"| Q3["(0, 2)"]
    end
```

合成结果：`R @ S = [[0, -0.5], [2, 0]]`

结果不同。矩阵乘法不满足交换律。

### 特征值与特征向量（Eigenvalues and eigenvectors）

大多数向量被矩阵作用后会改变方向。特征向量很特别：矩阵只会缩放它们，不会旋转它们。这个缩放因子就是特征值。

```
A @ v = lambda * v

v is the eigenvector (direction that survives)
lambda is the eigenvalue (how much it stretches)

Example: A = | 2  1 |
             | 1  2 |

Eigenvector [1, 1] with eigenvalue 3:
  A @ [1,1] = [3, 3] = 3 * [1, 1]     (same direction, scaled by 3)

Eigenvector [1, -1] with eigenvalue 1:
  A @ [1,-1] = [1, -1] = 1 * [1, -1]  (same direction, unchanged)
```

这个矩阵把空间沿 `[1, 1]` 拉伸 3 倍，而保持 `[1, -1]` 方向不变。其他任何方向都是这两者的混合。

### 特征分解（Eigendecomposition）

如果一个矩阵有 n 个线性无关的特征向量，它就可以被分解为：

```
A = V @ D @ V^(-1)

V = matrix whose columns are eigenvectors
D = diagonal matrix of eigenvalues
V^(-1) = inverse of V

This says: rotate into eigenvector coordinates, scale along each axis, rotate back.
```

### 为什么特征值重要（Why eigenvalues matter）

**PCA。** 协方差矩阵的特征向量就是主成分（principal components），特征值告诉你每个分量捕获了多少方差。按特征值排序，保留前 k 个，你就完成了降维。

**稳定性。** 在循环网络和动力系统里，模大于 1 的特征值会让输出爆炸，模小于 1 的会让它消失。这就是用一句话说清的梯度消失/爆炸问题。

**谱方法。** 图神经网络用邻接矩阵的特征值，谱聚类用拉普拉斯矩阵的特征值。这些特征向量揭示了图的结构。

### 行列式作为体积缩放因子（Determinant as volume scaling factor）

变换矩阵的行列式（determinant）告诉你它把面积（2D）或体积（3D）缩放了多少。

```
det = 1:   area preserved (rotation)
det = 2:   area doubled
det = 0:   space crushed to lower dimension (singular)
det = -1:  area preserved but orientation flipped (reflection)

| det(Rotation) | = 1        (always)
| det(Scale sx, sy) | = sx * sy
| det(Shear) | = 1           (area preserved)
| det(Reflection) | = -1     (orientation flipped)
```

## 动手实现（Build It）

### Step 1: Transformation matrices from scratch (Python)

```python
import math

def rotation_2d(theta):
    c, s = math.cos(theta), math.sin(theta)
    return [[c, -s], [s, c]]

def scaling_2d(sx, sy):
    return [[sx, 0], [0, sy]]

def shearing_2d(kx, ky):
    return [[1, kx], [ky, 1]]

def reflection_x():
    return [[1, 0], [0, -1]]

def reflection_y():
    return [[-1, 0], [0, 1]]

def mat_vec_mul(matrix, vector):
    return [
        sum(matrix[i][j] * vector[j] for j in range(len(vector)))
        for i in range(len(matrix))
    ]

def mat_mul(a, b):
    rows_a, cols_b = len(a), len(b[0])
    cols_a = len(a[0])
    return [
        [sum(a[i][k] * b[k][j] for k in range(cols_a)) for j in range(cols_b)]
        for i in range(rows_a)
    ]

point = [1.0, 0.0]
angle = math.pi / 4

rotated = mat_vec_mul(rotation_2d(angle), point)
print(f"Rotate (1,0) by 45 deg: ({rotated[0]:.4f}, {rotated[1]:.4f})")

scaled = mat_vec_mul(scaling_2d(2, 3), [1.0, 1.0])
print(f"Scale (1,1) by (2,3): ({scaled[0]:.1f}, {scaled[1]:.1f})")

sheared = mat_vec_mul(shearing_2d(1, 0), [1.0, 1.0])
print(f"Shear (1,1) kx=1: ({sheared[0]:.1f}, {sheared[1]:.1f})")

reflected = mat_vec_mul(reflection_y(), [2.0, 1.0])
print(f"Reflect (2,1) across y: ({reflected[0]:.1f}, {reflected[1]:.1f})")
```

### Step 2: Composition of transformations

```python
R = rotation_2d(math.pi / 2)
S = scaling_2d(2, 0.5)

rotate_then_scale = mat_mul(S, R)
scale_then_rotate = mat_mul(R, S)

point = [1.0, 0.0]
result1 = mat_vec_mul(rotate_then_scale, point)
result2 = mat_vec_mul(scale_then_rotate, point)

print(f"Rotate 90 then scale: ({result1[0]:.2f}, {result1[1]:.2f})")
print(f"Scale then rotate 90: ({result2[0]:.2f}, {result2[1]:.2f})")
print(f"Same? {result1 == result2}")
```

### Step 3: Eigenvalues from scratch (2x2)

对 2x2 矩阵 `[[a, b], [c, d]]`，特征值满足特征方程：`lambda^2 - (a+d)*lambda + (ad - bc) = 0`。

```python
def eigenvalues_2x2(matrix):
    a, b = matrix[0]
    c, d = matrix[1]
    trace = a + d
    det = a * d - b * c
    discriminant = trace ** 2 - 4 * det
    if discriminant < 0:
        real = trace / 2
        imag = (-discriminant) ** 0.5 / 2
        return (complex(real, imag), complex(real, -imag))
    sqrt_disc = discriminant ** 0.5
    return ((trace + sqrt_disc) / 2, (trace - sqrt_disc) / 2)

def eigenvector_2x2(matrix, eigenvalue):
    a, b = matrix[0]
    c, d = matrix[1]
    if abs(b) > 1e-10:
        v = [b, eigenvalue - a]
    elif abs(c) > 1e-10:
        v = [eigenvalue - d, c]
    else:
        if abs(a - eigenvalue) < 1e-10:
            v = [1, 0]
        else:
            v = [0, 1]
    mag = (v[0] ** 2 + v[1] ** 2) ** 0.5
    return [v[0] / mag, v[1] / mag]

A = [[2, 1], [1, 2]]
vals = eigenvalues_2x2(A)
print(f"Matrix: {A}")
print(f"Eigenvalues: {vals[0]:.4f}, {vals[1]:.4f}")

for val in vals:
    vec = eigenvector_2x2(A, val)
    result = mat_vec_mul(A, vec)
    scaled = [val * vec[0], val * vec[1]]
    print(f"  lambda={val:.1f}, v={[round(x,4) for x in vec]}")
    print(f"    A@v = {[round(x,4) for x in result]}")
    print(f"    l*v = {[round(x,4) for x in scaled]}")
```

### Step 4: Determinant as volume scaling factor

```python
def det_2x2(matrix):
    return matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0]

print(f"det(rotation 45) = {det_2x2(rotation_2d(math.pi/4)):.4f}")
print(f"det(scale 2,3)   = {det_2x2(scaling_2d(2, 3)):.1f}")
print(f"det(shear kx=1)  = {det_2x2(shearing_2d(1, 0)):.1f}")
print(f"det(reflect y)   = {det_2x2(reflection_y()):.1f}")

singular = [[1, 2], [2, 4]]
print(f"det(singular)     = {det_2x2(singular):.1f}")
print("Singular: columns are proportional, space collapses to a line.")
```

## 用起来（Use It）

NumPy 用优化过的例程把这一切都搞定了。

```python
import numpy as np

theta = np.pi / 4
R = np.array([[np.cos(theta), -np.sin(theta)],
              [np.sin(theta),  np.cos(theta)]])

point = np.array([1.0, 0.0])
print(f"Rotate (1,0) by 45 deg: {R @ point}")

S = np.diag([2.0, 3.0])
composed = S @ R
print(f"Scale(2,3) after Rotate(45): {composed @ point}")

A = np.array([[2, 1], [1, 2]], dtype=float)
eigenvalues, eigenvectors = np.linalg.eig(A)
print(f"\nEigenvalues: {eigenvalues}")
print(f"Eigenvectors (columns):\n{eigenvectors}")

for i in range(len(eigenvalues)):
    v = eigenvectors[:, i]
    lam = eigenvalues[i]
    print(f"  A @ v{i} = {A @ v}, lambda * v{i} = {lam * v}")

print(f"\ndet(R) = {np.linalg.det(R):.4f}")
print(f"det(S) = {np.linalg.det(S):.1f}")

B = np.array([[3, 1], [0, 2]], dtype=float)
vals, vecs = np.linalg.eig(B)
D = np.diag(vals)
V = vecs
reconstructed = V @ D @ np.linalg.inv(V)
print(f"\nEigendecomposition A = V @ D @ V^-1:")
print(f"Original:\n{B}")
print(f"Reconstructed:\n{reconstructed}")
```

### 用 NumPy 做 3D 旋转（3D rotations with NumPy）

```python
def rotation_3d_z(theta):
    c, s = np.cos(theta), np.sin(theta)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])

def rotation_3d_x(theta):
    c, s = np.cos(theta), np.sin(theta)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])

point_3d = np.array([1.0, 0.0, 0.0])
rotated_z = rotation_3d_z(np.pi / 2) @ point_3d
rotated_x = rotation_3d_x(np.pi / 2) @ point_3d

print(f"\n3D point: {point_3d}")
print(f"Rotate 90 around z: {np.round(rotated_z, 4)}")
print(f"Rotate 90 around x: {np.round(rotated_x, 4)}")
```

## 上线部署（Ship It）

本节课为 PCA（Phase 2）和神经网络的权重分析打下了几何基础。这里手写的特征值/特征向量代码，跟生产 ML 系统里支撑降维、谱聚类、稳定性分析的算法是同一个。

## 练习（Exercises）

1. 把旋转、缩放、剪切应用到一个单位正方形（四个角分别是 `[0,0]`、`[1,0]`、`[1,1]`、`[0,1]`）。打印每种变换后的角点坐标。验证旋转保持了角点之间的距离。

2. 用特征方程手算矩阵 `[[4, 2], [1, 3]]` 的特征值。然后用你手写的函数和 NumPy 各验证一遍。

3. 构造一个三步组合变换（旋转 30 度、按 `[1.5, 0.8]` 缩放、用 `kx=0.3` 剪切），把它应用到环形排布的 8 个点上。打印变换前后的坐标。计算合成矩阵的行列式，并验证它等于各步行列式的乘积。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Rotation matrix（旋转矩阵） | 「让东西转起来」 | 一个正交矩阵，让点沿圆弧移动，同时保持距离和角度不变。行列式恒为 1。 |
| Scaling matrix（缩放矩阵） | 「让东西变大」 | 一个对角矩阵，沿每根轴独立地拉伸或压缩。行列式等于各个缩放因子的乘积。 |
| Shearing matrix（剪切矩阵） | 「让东西变斜」 | 一个矩阵，把某个坐标按比例偏移到另一个坐标，把矩形变成平行四边形。行列式为 1。 |
| Reflection（反射） | 「做镜像」 | 一个矩阵，把空间沿某根轴或某个面翻转。行列式为 -1。 |
| Composition（组合） | 「连做两件事」 | 把变换矩阵相乘以串联操作。顺序重要：`B @ A` 表示先做 A，再做 B。 |
| Eigenvector（特征向量） | 「特殊方向」 | 矩阵作用下只被缩放、不被旋转的方向。是这个变换的指纹。 |
| Eigenvalue（特征值） | 「拉伸了多少」 | 矩阵把对应特征向量缩放的标量因子。可以为负（翻转）或复数（旋转）。 |
| Eigendecomposition（特征分解） | 「把矩阵拆开」 | 把矩阵写成 `V @ D @ V^(-1)`，分离出它最本质的缩放方向和缩放幅度。 |
| Determinant（行列式） | 「从矩阵算出的一个数」 | 变换把面积（2D）或体积（3D）缩放的因子。为 0 表示该变换不可逆。 |
| Characteristic equation（特征方程） | 「特征值是从哪儿来的」 | `det(A - lambda * I) = 0`。它的根就是特征值的多项式。 |

## 延伸阅读（Further Reading）

- [3Blue1Brown: Linear Transformations](https://www.3blue1brown.com/lessons/linear-transformations) —— 关于矩阵如何重塑空间的可视化直觉
- [3Blue1Brown: Eigenvectors and Eigenvalues](https://www.3blue1brown.com/lessons/eigenvalues) —— 特征向量几何含义最棒的可视化讲解
- [MIT 18.06 Lecture 21: Eigenvalues and Eigenvectors](https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/) —— Gilbert Strang 的经典讲法
