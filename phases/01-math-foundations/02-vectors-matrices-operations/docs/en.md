# ベクトル、行列、演算

> すべてのニューラルネットワークは、追加の手順が付いた行列積にすぎません。

**種別:** 構築
**言語:** Python, Julia
**前提条件:** Phase 1, Lesson 01 (Linear Algebra Intuition)
**所要時間:** 約60分

## 学習目標

- 要素ごとの演算、行列積、転置、行列式、逆行列を備えたMatrixクラスを作る
- 要素ごとの積と行列積を区別し、それぞれをいつ使うか説明する
- スクラッチ実装したMatrixクラスだけを使って、単一の密結合ニューラルネットワーク層（`relu(W @ x + b)`）を実装する
- ブロードキャスト規則と、ニューラルネットワークフレームワークでバイアス加算がどう動くかを説明する

## 問題

ニューラルネットワークを作りたいとします。コードを読むと、次の行が出てきます。

```
output = activation(weights @ input + bias)
```

この `@` は行列積です。`weights` は行列です。`input` はベクトルです。これらの演算が何をするかを知らなければ、この1行は魔法に見えます。知っていれば、これは層の順伝播全体を3つの演算で書いたものだと分かります。

モデルが処理するすべての画像は、ピクセル値の行列です。すべての単語埋め込みはベクトルです。すべてのニューラルネットワークのすべての層は行列変換です。変数を理解せずにコードを書けないのと同じように、行列演算に慣れずにAIシステムを作ることはできません。

このレッスンでは、その慣れをスクラッチから作ります。

## 概念

### ベクトル: 順序付きの数値リスト

ベクトルは、方向と大きさを持つ数値のリストです。AIでは、ベクトルはデータ点、特徴量、パラメータを表します。

```
v = [3, 4]        -- 2Dベクトル
w = [1, 0, -2]    -- 3Dベクトル
```

2Dベクトル `[3, 4]` は、平面上の座標 (3, 4) を指します。その長さ（大きさ）は5です（3-4-5の三角形）。

### 行列: 数値の格子

行列は2Dの格子です。行と列があります。m x n 行列は、m行n列を持ちます。

```
A = | 1  2  3 |     -- 2x3行列 (2行, 3列)
    | 4  5  6 |
```

ニューラルネットワークでは、重み行列が入力ベクトルを出力ベクトルへ変換します。784個の入力と128個の出力を持つ層は、128x784の重み行列を使います。

### shapeが重要な理由

行列積には厳密な規則があります。`(m x n) @ (n x p) = (m x p)` です。内側の次元が一致していなければなりません。

```
(128 x 784) @ (784 x 1) = (128 x 1)
  weights       input       output

内側の次元: 784 = 784  -- 有効
```

PyTorchでshape mismatchエラーが出る理由はこれです。

### 演算マップ

| 演算 | 何をするか | ニューラルネットワークでの用途 |
|-----------|-------------|-------------------|
| 加算 | 要素ごとに結合する | 出力にバイアスを加える |
| スカラー倍 | すべての要素をスケーリングする | 学習率 * 勾配 |
| 行列積 | ベクトルを変換する | 層の順伝播 |
| 転置 | 行と列を入れ替える | 誤差逆伝播 |
| 行列式 | 単一の数値による要約 | 可逆性の確認 |
| 逆行列 | 変換を元に戻す | 線形方程式系を解く |
| 単位行列 | 何もしない行列 | 初期化、残差接続 |

### 要素ごとの積と行列積

この違いは初心者が頻繁につまずく点です。

要素ごとの積: 対応する位置同士を掛けます。両方の行列は同じshapeでなければなりません。

```
| 1  2 |   | 5  6 |   | 5  12 |
| 3  4 | * | 7  8 | = | 21 32 |
```

行列積: 行と列の内積です。内側の次元が一致していなければなりません。

```
| 1  2 |   | 5  6 |   | 1*5+2*7  1*6+2*8 |   | 19  22 |
| 3  4 | @ | 7  8 | = | 3*5+4*7  3*6+4*8 | = | 43  50 |
```

別の演算であり、別の結果を生み、別の規則に従います。

### ブロードキャスト

出力の行列にバイアスベクトルを足すとき、shapeは一致しません。ブロードキャストは、小さい配列を合うように引き伸ばします。

```
| 1  2  3 |   +   [10, 20, 30]
| 4  5  6 |

ブロードキャストはベクトルを行方向に広げる:

| 1  2  3 |   | 10  20  30 |   | 11  22  33 |
| 4  5  6 | + | 10  20  30 | = | 14  25  36 |
```

すべての現代的なフレームワークは、これを自動で行います。理解しておくと、shapeが合わないように見えるのにコードが動く場面で混乱しなくなります。

## 作ってみる

### ステップ 1: Vectorクラス

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

### ステップ 2: 中核演算を持つMatrixクラス

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

### ステップ 3: 動かしてみる

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

### ステップ 4: ニューラルネットワークへつなげる

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

これは単一の密結合層です。`output = relu(W @ x + b)`。すべてのニューラルネットワークのすべての密結合層は、まさにこれを行っています。

## 使ってみる

NumPyは上で行ったことを、より少ない行数で、桁違いに高速に実行します。

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

Pythonの `@` 演算子は `__matmul__` を呼び出します。NumPyは、CとFortranで書かれた最適化済みBLASルーチンでこれを実装しています。同じ数学で、100倍高速です。

NumPyでのブロードキャスト:

```python
matrix = np.array([[1, 2, 3], [4, 5, 6]])
bias = np.array([10, 20, 30])
print(matrix + bias)
```

NumPyは1Dのバイアスを両方の行へ自動的にブロードキャストします。これが、すべてのニューラルネットワークフレームワークでバイアス加算が動く仕組みです。

## 成果物

このレッスンでは、幾何学的な直感を通じて行列演算を教えるためのプロンプトを作ります。`outputs/prompt-matrix-operations.md` を参照してください。

ここで作るMatrixクラスは、Phase 3, Lesson 10で作るミニニューラルネットワークフレームワークの土台です。

## 演習

1. **逆行列を検証する。** `A @ A.inverse_2x2()` を掛けて、単位行列が得られることを確認してください。3つの異なる2x2行列で試してください。行列式が0の場合は何が起きますか？

2. **3x3の逆行列を実装する。** 余因子行列を使う方法で、Matrixクラスを3x3行列の逆行列計算に対応させてください。NumPyの `np.linalg.inv` と比較してテストしてください。

3. **2層ネットワークを作る。** 自分のMatrixクラスだけを使い（NumPyなし）、2層ニューラルネットワークを作ってください: 入力 (3) -> 隠れ層 (4) -> 出力 (2)。ランダムな重みで初期化し、順伝播を実行し、すべてのshapeが正しいことを検証してください。

## 重要用語

| 用語 | よくある言い方 | 実際の意味 |
|------|----------------|----------------------|
| ベクトル | 「矢印」 | 順序付きの数値リスト。AIでは、高次元空間の点。 |
| 行列 | 「数値の表」 | 線形変換。ベクトルをある空間から別の空間へ写す。 |
| 行列積 | 「ただ数を掛けるだけ」 | 最初の行列の各行と、2番目の行列の各列との内積。順序が重要。 |
| 転置 | 「ひっくり返す」 | 行と列を入れ替える。m x n 行列を n x m にする。誤差逆伝播で重要。 |
| 行列式 | 「行列から出る何かの数」 | 行列が面積（2D）または体積（3D）をどれだけ拡大縮小するかを測る。0なら変換が次元をつぶす。 |
| 逆行列 | 「行列を元に戻す」 | 変換を反転する行列。行列式が0でないときだけ存在する。 |
| 単位行列 | 「退屈な行列」 | 数値に1を掛けることに相当する行列。残差接続（ResNets）で使われる。 |
| ブロードキャスト | 「魔法のshape修正」 | 小さい配列を、欠けている次元に沿って繰り返すことで大きい配列に合わせること。 |
| 要素ごと | 「普通の掛け算」 | 対応する位置同士を掛ける。両方の配列は同じshape（またはブロードキャスト可能）でなければならない。 |

## 参考資料

- [3Blue1Brown: Essence of Linear Algebra](https://www.3blue1brown.com/topics/linear-algebra) - このレッスンで扱うすべての演算の視覚的な直感
- [NumPy documentation on broadcasting](https://numpy.org/doc/stable/user/basics.broadcasting.html) - NumPyが従う正確な規則
- [Stanford CS229 Linear Algebra Review](http://cs229.stanford.edu/section/cs229-linalg.pdf) - 機械学習向け線形代数の簡潔なリファレンス
