# AI のための複素数

> `-1` の平方根は「空想」ではありません。回転、周波数、そして信号処理の大部分を理解する鍵です。

**種類:** Learn
**言語:** Python
**前提:** Phase 1, Lessons 01-04 (linear algebra, calculus)
**時間:** 約60分

## 学習目標

- 直交形式と極形式の両方で複素数の加算、乗算、除算、共役を扱う
- Euler's formula を使って複素指数関数と三角関数を変換する
- 複素数の 1 の根を使って Discrete Fourier Transform を実装する
- transformers の RoPE と sinusoidal positional encodings の背後にある複素回転を説明する

## 問題

Fourier transform の論文を開くと `i` が至るところに出てきます。transformer の positional encodings では、異なる周波数の `sin` と `cos` が複素指数関数の実部と虚部として現れます。量子計算では、ほぼすべてが複素ベクトル空間で表されます。

複素数は抽象的に見えますが、数学的なトリックではありません。回転と振動の自然な言語です。何かが回る、振動する、周期的に変化するなら、複素数が適切な道具になります。

複素数を理解しないと、DFT、FFT、RoPE、元祖 Transformer の sinusoidal positional encodings を深く理解できません。このレッスンでは、複素演算をゼロから作り、幾何と ML への接続を確認します。

## 概念

### 複素数とは

複素数は実部と虚部を持ちます。

```
z = a + bi

where:
  a is the real part
  b is the imaginary part
  i is the imaginary unit, defined by i^2 = -1
```

数直線を平面に拡張したものだと考えると自然です。横軸が実軸、縦軸が虚軸です。

### 複素演算

加算は実部同士、虚部同士を足します。乗算は分配法則を使い、`i^2 = -1` を代入します。共役は虚部の符号を反転します。除算は分母の共役を掛け、分母を実数にします。

```
(a + bi) + (c + di) = (a + c) + (b + d)i
(a + bi)(c + di) = (ac - bd) + (ad + bc)i
conjugate of (a + bi) = a - bi
(a + bi)(a - bi) = a^2 + b^2
```

### 複素平面と極形式

複素数は原点からのベクトルでもあります。距離と角度で表すと極形式になります。

```
z = r * (cos(theta) + i*sin(theta))

where:
  r = |z| = sqrt(a^2 + b^2)     (magnitude, or modulus)
  theta = atan2(b, a)             (phase, or argument)
```

直交形式 `a + bi` は加算に便利で、極形式 `r * e^(i*theta)` は乗算に便利です。乗算では大きさを掛け、角度を足します。大きさ 1 の複素数を掛けることは純粋な回転です。

### Euler's formula

```
e^(i*theta) = cos(theta) + i*sin(theta)
```

これはこのレッスンで最重要の式です。`theta` が変わると `e^(i*theta)` は単位円を回ります。`theta = pi` では `e^(i*pi) + 1 = 0` となり、`e`, `i`, `pi`, `1`, `0` が一つの式で結ばれます。

### 2D 回転との関係

点 `(x, y)` を角度 `theta` 回転することは、複素数 `(x + yi)` に `e^(i*theta)` を掛けることと同じです。

```
Rotation via complex multiplication:
  (x + yi) * (cos(theta) + i*sin(theta))
  = (x*cos(theta) - y*sin(theta)) + (x*sin(theta) + y*cos(theta))i

Rotation via matrix multiplication:
  [cos(theta)  -sin(theta)] [x]   [x*cos(theta) - y*sin(theta)]
  [sin(theta)   cos(theta)] [y] = [x*sin(theta) + y*cos(theta)]
```

複素乗算は 2D 回転です。回転行列は、同じ操作を行列記法で書いたものです。

### Phasors、1 の根、DFT

`e^(i*omega*t)` は単位円上を角周波数 `omega` で回る点です。実部は `cos(omega*t)`、虚部は `sin(omega*t)` です。正弦波は、回転する複素数の影だと見なせます。

`N` 乗して 1 になる複素数、つまり `N`-th roots of unity は単位円上に等間隔に並びます。

```
w_k = e^(2*pi*i*k/N)    for k = 0, 1, 2, ..., N-1
```

DFT は、信号をこの等間隔の複素正弦波との相関に分解します。

```
X[k] = sum_{n=0}^{N-1} x[n] * e^(-2*pi*i*k*n/N)
```

### transformer との接続

元祖 Transformer の sinusoidal positional encodings は次の形です。

```
PE(pos, 2i) = sin(pos / 10000^(2i/d))
PE(pos, 2i+1) = cos(pos / 10000^(2i/d))
```

`sin` と `cos` のペアは、異なる周波数の複素指数関数の虚部と実部です。RoPE (Rotary Position Embedding) はさらに直接的に、query/key ベクトルを複素回転で回します。二つの token の相対位置は回転角として表され、attention は複素乗算を通じて相対位置に敏感になります。

| 操作 | 代数的形式 | 幾何学的意味 |
|-----------|---------------|-------------------|
| Addition | `(a+c) + (b+d)i` | 平面上のベクトル加算 |
| Multiplication | `(ac-bd) + (ad+bc)i` | 回転とスケーリング |
| Conjugate | `a - bi` | 実軸で反射 |
| Magnitude | `sqrt(a^2 + b^2)` | 原点からの距離 |
| Phase | `atan2(b, a)` | 正の実軸からの角度 |
| Division | multiply by conjugate | 回転を戻し、再スケール |

## 実装

### Step 1: Complex class

```python
import math

class Complex:
    def __init__(self, real, imag=0.0):
        self.real = real
        self.imag = imag

    def __add__(self, other):
        return Complex(self.real + other.real, self.imag + other.imag)

    def __mul__(self, other):
        r = self.real * other.real - self.imag * other.imag
        i = self.real * other.imag + self.imag * other.real
        return Complex(r, i)

    def __truediv__(self, other):
        denom = other.real ** 2 + other.imag ** 2
        r = (self.real * other.real + self.imag * other.imag) / denom
        i = (self.imag * other.real - self.real * other.imag) / denom
        return Complex(r, i)

    def magnitude(self):
        return math.sqrt(self.real ** 2 + self.imag ** 2)

    def phase(self):
        return math.atan2(self.imag, self.real)

    def conjugate(self):
        return Complex(self.real, -self.imag)
```

### Step 2: Polar conversion and Euler's formula

```python
def to_polar(z):
    return z.magnitude(), z.phase()

def from_polar(r, theta):
    return Complex(r * math.cos(theta), r * math.sin(theta))

def euler(theta):
    return Complex(math.cos(theta), math.sin(theta))
```

### Step 3: DFT from complex arithmetic

```python
def dft(signal):
    N = len(signal)
    result = []
    for k in range(N):
        total = Complex(0, 0)
        for n in range(N):
            angle = -2 * math.pi * k * n / N
            total = total + Complex(signal[n], 0) * euler(angle)
        result.append(total)
    return result
```

## Use It

Python では虚数単位に `j` を使います。`cmath` と `numpy` は複素数をネイティブに扱えます。

```python
z = 3 + 2j
w = 1 + 4j

print(z + w)
print(z * w)
print(abs(z))

import cmath
print(cmath.phase(z))
print(cmath.exp(1j * cmath.pi))
```

## Ship It

`code/complex_numbers.py` を実行して `outputs/skill-complex-arithmetic.md` を生成します。

## 演習

1. `(2 + 3i) * (4 - i)` と `(5 + 2i) / (1 - 3i)` を手計算し、コードで確認してください。
2. 点 `(1, 0)` から始め、`e^(i*pi/6)` を 12 回掛けて元に戻ることを確認してください。
3. 二つの正弦波を足した信号の DFT を計算し、周波数 3 と 7 にピークが出ることを確認してください。
4. 8th roots of unity を計算し、和がゼロになることを確認してください。
5. 複素乗算による回転と 2x2 回転行列による回転が一致することをランダム点で確認してください。

## 重要用語

| 用語 | 意味 |
|------|------|
| Complex number | `a + bi` の形の数。`i^2 = -1` |
| Imaginary unit | `i^2 = -1` を満たす数。幾何学的には 90 度回転演算子 |
| Complex plane | 実軸と虚軸からなる 2D 平面 |
| Magnitude | 原点からの距離 `sqrt(a^2 + b^2)` |
| Phase | 正の実軸からの角度 `atan2(b, a)` |
| Conjugate | 実軸に関する鏡映 `a - bi` |
| Polar form | `a + bi` ではなく `r * e^(i*theta)` で表す形式 |
| Euler's formula | `e^(i*theta) = cos(theta) + i*sin(theta)` |
| Roots of unity | 単位円上に等間隔に並ぶ `N` 個の複素数 |
| DFT | 信号を複素正弦波成分に分解する変換 |
| RoPE | 複素回転で相対位置を attention に埋め込む手法 |

## 参考資料

- [Visual Introduction to Euler's Formula](https://betterexplained.com/articles/intuitive-understanding-of-eulers-formula/) - 幾何学的直感を作る解説
- [Su et al.: RoFormer (2021)](https://arxiv.org/abs/2104.09864) - RoPE の論文
- [Vaswani et al.: Attention Is All You Need (2017)](https://arxiv.org/abs/1706.03762) - sinusoidal positional encodings を含む Transformer 論文
- [3Blue1Brown: Euler's formula with introductory group theory](https://www.youtube.com/watch?v=mvmuCPvRoWQ) - `e^(i*pi) = -1` の視覚的説明
- [Needham: Visual Complex Analysis](https://global.oup.com/academic/product/visual-complex-analysis-9780198534464) - 複素数の視覚的理解に優れた本
