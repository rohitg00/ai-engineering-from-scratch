# Fourier Transform

> すべての信号は正弦波の和です。Fourier transform は、どの正弦波がどれだけ含まれているかを教えてくれます。

**種類:** Build
**言語:** Python
**前提:** Phase 1, Lessons 01-04, 19 (complex numbers)
**時間:** 約90分

## 学習目標

- DFT をゼロから実装し、`O(N log N)` の Cooley-Tukey FFT と照合する
- 周波数係数から amplitude、phase、power spectrum を読み取る
- convolution theorem を使い、FFT の積で convolution を実行する
- Fourier 的な周波数分解を transformer positional encodings や CNN convolution layers に結びつける

## 問題

音声は時間に沿った圧力測定、株価は日ごとの値、画像は空間上のピクセル強度です。これらは時間領域または空間領域のデータで、あるインデックスに沿って値が変化して見えます。

しかし多くのパターンは時間領域では見えません。音は単音か和音か、株価に週周期があるか、画像に繰り返しテクスチャがあるか。これらは周波数成分の問題です。

Fourier transform は信号を時間領域から周波数領域へ変換し、異なる周波数の正弦波に分解します。各正弦波には amplitude と phase があり、変換はその両方を返します。

ML でも周波数領域の考え方は頻出します。CNN の convolution は周波数領域では乗算です。Transformer positional encodings は周波数分解で位置を表します。音声モデルは spectrogram を入力にします。時系列モデルは周期性を探します。

## 概念

### DFT の定義

`N` 個のサンプル `x[0], ..., x[N-1]` から、DFT は `N` 個の周波数係数 `X[0], ..., X[N-1]` を作ります。

```
X[k] = sum_{n=0}^{N-1} x[n] * e^(-2*pi*i*k*n/N)

for k = 0, 1, ..., N-1
```

`X[k]` は複素数です。`|X[k]|` は周波数 `k` の amplitude、`angle(X[k])` は phase offset を表します。`e^(-2*pi*i*k*n/N)` は周波数 `k` で回転する phasor であり、DFT は信号と各周波数との相関を計算しています。

### 係数の意味

`X[0]` は DC component で、すべてのサンプルの和、つまり平均に比例するゼロ周波数成分です。`1 <= k <= N/2` は正の周波数です。`X[N/2]` は Nyquist frequency で、サンプル数 `N` で表せる最高周波数です。`N/2 < k < N` は負の周波数で、実数信号では正の周波数の鏡像になります。

### Inverse DFT

```
x[n] = (1/N) * sum_{k=0}^{N-1} X[k] * e^(2*pi*i*k*n/N)

for n = 0, 1, ..., N-1
```

符号が正になり、`1/N` で正規化する点だけが forward DFT と違います。DFT は基底変換なので、情報を失わずに元の信号へ戻せます。

### FFT

定義通りの DFT は `O(N^2)` です。`N = 1,000,000` なら約 `10^12` 回の演算になります。FFT は同じ結果を `O(N log N)` で計算します。

Cooley-Tukey FFT は偶数番目と奇数番目のサンプルに分け、半分サイズの DFT を再帰的に計算し、twiddle factors で結合します。

```
X[k] = E[k] + e^(-2*pi*i*k/N) * O[k]          for k = 0, ..., N/2 - 1
X[k + N/2] = E[k] - e^(-2*pi*i*k/N) * O[k]    for k = 0, ..., N/2 - 1

where E = DFT of even-indexed samples
      O = DFT of odd-indexed samples
```

実務では長さを 2 のべきにゼロパディングして FFT 効率を上げます。

### スペクトル解析

power spectrum は `|X[k]|^2` で、各周波数にどれだけエネルギーがあるかを表します。phase spectrum は `angle(X[k])` です。多くの解析では power spectrum を重視し、phase は無視します。

```
Power at frequency k:  P[k] = |X[k]|^2 = X[k].real^2 + X[k].imag^2
Phase at frequency k:  phi[k] = atan2(X[k].imag, X[k].real)
```

周波数分解能はサンプル数 `N` とサンプリングレート `fs` で決まります。

```
Frequency of bin k:      f_k = k * fs / N
Frequency resolution:    delta_f = fs / N
Maximum frequency:       f_max = fs / 2  (Nyquist)
```

### Convolution theorem

**時間領域の convolution は、周波数領域の点ごとの乗算です。**

```
x * h = IFFT(FFT(x) . FFT(h))

where * is convolution and . is element-wise multiplication
```

直接 convolution は `O(N*M)` ですが、FFT-based convolution は大きな kernel では `O(N log N)` で済みます。DFT は circular convolution を計算するため、linear convolution には長さ `N + M - 1` へゼロパディングします。

### Windowing、aliasing、zero-padding

DFT は `N` サンプルが周期的に繰り返すと仮定します。開始値と終了値がつながらないと境界に不連続ができ、spurious high-frequency content が現れます。これを spectral leakage と呼びます。Hann、Hamming、Blackman などの window を掛けると leakage を減らせます。

Nyquist frequency `fs/2` より高い周波数を含む信号をサンプリングすると aliasing が起こります。たとえば 100 Hz でサンプリングした 90 Hz の正弦波は、10 Hz の信号と同じサンプル列に見えます。

Zero-padding は見かけのビン密度を上げますが、真の周波数分解能は上げません。真の分解能は観測時間 `T = N / fs` で決まります。

### positional encodings と CNN への接続

Transformer の sinusoidal positional encodings は、各次元ペアに異なる周波数の `sin` と `cos` を割り当てます。高周波は細かい位置、低周波は粗い位置を表し、組み合わせで位置ごとの固有の指紋を作ります。

CNN の convolution layer は入力に kernel を滑らせる演算です。convolution theorem により、これは周波数領域で入力と kernel を掛けることに対応します。小さな `3x3` kernel では直接 convolution が速いことが多いですが、大きな kernel や global convolution では FFT-based approaches が有利です。

### Spectrogram と STFT

一回の FFT は信号全体の周波数成分を返しますが、それらがいつ現れたかは分かりません。Short-Time Fourier Transform (STFT) は重なり合う窓ごとに FFT を計算し、時間 x 周波数の 2D 表現である spectrogram を作ります。音声 ML モデルでは mel-spectrogram が標準的な入力表現です。

## 実装

### Step 1: DFT from scratch

```python
import math

class Complex:
    ...

def dft(x):
    N = len(x)
    result = []
    for k in range(N):
        total = Complex(0, 0)
        for n in range(N):
            angle = -2 * math.pi * k * n / N
            w = Complex(math.cos(angle), math.sin(angle))
            xn = x[n] if isinstance(x[n], Complex) else Complex(x[n])
            total = total + xn * w
        result.append(total)
    return result
```

### Step 2: Inverse DFT

```python
def idft(X):
    N = len(X)
    result = []
    for n in range(N):
        total = Complex(0, 0)
        for k in range(N):
            angle = 2 * math.pi * k * n / N
            w = Complex(math.cos(angle), math.sin(angle))
            total = total + X[k] * w
        result.append(Complex(total.real / N, total.imag / N))
    return result
```

### Step 3: FFT (Cooley-Tukey)

```python
def fft(x):
    N = len(x)
    if N <= 1:
        return [x[0] if isinstance(x[0], Complex) else Complex(x[0])]
    if N % 2 != 0:
        return dft(x)

    even = fft([x[i] for i in range(0, N, 2)])
    odd = fft([x[i] for i in range(1, N, 2)])

    result = [Complex(0)] * N
    for k in range(N // 2):
        angle = -2 * math.pi * k / N
        twiddle = Complex(math.cos(angle), math.sin(angle))
        t = twiddle * odd[k]
        result[k] = even[k] + t
        result[k + N // 2] = even[k] - t
    return result
```

### Step 4: FFT convolution

```python
def convolve_fft(x, h):
    N = len(x) + len(h) - 1
    padded_N = 1
    while padded_N < N:
        padded_N *= 2

    x_padded = x + [0.0] * (padded_N - len(x))
    h_padded = h + [0.0] * (padded_N - len(h))

    X = fft(x_padded)
    H = fft(h_padded)
    Y = [xk * hk for xk, hk in zip(X, H)]
    y = idft(Y)
    return [y[n].real for n in range(N)]
```

## Use It

実務では、高度に最適化された `numpy` と `scipy` の FFT を使います。

```python
import numpy as np

signal = np.sin(2 * np.pi * 5 * np.arange(256) / 256)
spectrum = np.fft.fft(signal)
freqs = np.fft.fftfreq(256, d=1/256)

power = np.abs(spectrum) ** 2
```

## Ship It

`code/fourier.py` を実行して `outputs/prompt-spectral-analyzer.md` を生成します。

## 演習

1. 128 Hz で 1 秒サンプリングした未知周波数の単一正弦波を作り、DFT で周波数を特定してください。ノイズを加えて再実験してください。
2. 長さ 64 のランダム信号で DFT と FFT の係数が `1e-10` 以内で一致することを確認し、長さを変えて速度を比較してください。
3. circular convolution を直接計算と FFT 経由で計算し、一致を確認してください。zero-padding で linear convolution も試してください。
4. 10 Hz と 12 Hz の正弦波を足した信号で、window なし、Hann、Hamming の power spectrum を比較してください。
5. `d_model = 128`, `max_pos = 512` の sinusoidal positional encodings を生成し、内積が絶対位置ではなく距離に依存することを確認してください。

## 重要用語

| 用語 | 意味 |
|------|------|
| DFT | 時間領域サンプルを周波数係数に変換する |
| FFT | DFT を `O(N log N)` で計算するアルゴリズム |
| Inverse DFT | 周波数係数から時間領域信号を復元する |
| Frequency bin | DFT 出力の各 index が表す離散周波数 |
| DC component | `X[0]`。ゼロ周波数、平均に比例 |
| Nyquist frequency | `fs/2`。表現可能な最大周波数 |
| Power spectrum | `|X[k]|^2`。各周波数のエネルギー |
| Spectral leakage | 非周期信号を周期信号として扱うことで出る偽の周波数成分 |
| Window function | DFT 前に端をなだらかにする関数 |
| Twiddle factor | FFT の結合で使う複素指数関数 |
| Convolution theorem | 時間領域の convolution が周波数領域の点ごとの乗算になる定理 |
| Aliasing | 高周波が低周波として見えてしまう現象 |

## 参考資料

- [Cooley & Tukey: An Algorithm for the Machine Calculation of Complex Fourier Series (1965)](https://www.ams.org/journals/mcom/1965-19-090/S0025-5718-1965-0178586-1/) - FFT の原典
- [3Blue1Brown: But what is the Fourier Transform?](https://www.youtube.com/watch?v=spUNpyF58BY) - Fourier transform の視覚的入門
- [Lee-Thorp et al.: FNet: Mixing Tokens with Fourier Transforms (2021)](https://arxiv.org/abs/2105.03824) - attention を FFT で置き換える transformer
- [Smith: The Scientist and Engineer's Guide to Digital Signal Processing](http://www.dspguide.com/) - FFT と spectral analysis の無料教科書
- [Vaswani et al.: Attention Is All You Need (2017)](https://arxiv.org/abs/1706.03762) - sinusoidal positional encodings
- [Radford et al.: Whisper (2022)](https://arxiv.org/abs/2212.04356) - mel-spectrogram を使う音声認識
