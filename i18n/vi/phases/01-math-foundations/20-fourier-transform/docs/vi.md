# Phong cách Fourier

> Mỗi tín hiệu là tổng số sóng âm đạo.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 01-04, 19 (complex numbers)
**Time:** ~90 minutes

## Mục tiêu học tập

- Thực hiện DFT từ đầu và xác minh nó so với $O(N \log N)$Cooley-Tukey FFT
- Giải thích các tỷ lệ tần số: lấy âm lượng, pha và quang phổ điện từ tín hiệu
- Sử dụng định lý convolution để thực hiện convolution thông qua nhân FFT
- Kết nối phân hủy tần số Fourier với các mã hóa vị trí biến đổi và các lớp convolution CNN

## Vấn đề

Một bản ghi âm là một chuỗi các phép đo áp suất theo thời gian. Giá cổ phiếu là một chuỗi các giá trị trong nhiều ngày. Một hình ảnh là một lưới cường độ pixel trên không gian. Tất cả những dữ liệu này là dữ liệu trong lĩnh vực thời gian (hoặc lĩnh vực không gian). Bạn thấy các giá trị thay đổi trên một số chỉ số.

Nhưng nhiều mô hình không thể nhìn thấy trong phạm vi thời gian. tín hiệu âm thanh này là một âm thanh tinh khiết hay một hợp âm? Giá cổ phiếu này có chu kỳ hàng tuần?

Chuyển đổi Fourier chuyển đổi dữ liệu từ miền thời gian sang miền tần số. Nó lấy một tín hiệu và phân hủy nó thành sóng âm của tần số khác nhau. Mỗi sóng âm có một cường độ (nhiều mạnh nó là) và một giai đoạn (nơi nó bắt đầu). Chuyển đổi Fourier cho bạn biết cả hai.

Điều này quan trọng đối với ML bởi vì tư duy về phạm vi tần số xuất hiện khắp nơi. Các mạng thần kinh hoóc tụng thực hiện hoóc tụng, đó là nhân trong lĩnh vực tần số. Các mã hóa vị trí biến đổi sử dụng phân hủy tần số để đại diện cho vị trí. Các mô hình âm thanh (tự nhận dạng giọng nói, phát âm) hoạt động trên quang phổ - đại diện tần số của âm thanh. Các mô hình chuỗi thời gian tìm kiếm các mô hình định kỳ. Hiểu được biến đổi Fourier cho bạn từ vựng để làm việc với tất cả những điều này.

## Khái niệm

### Định nghĩa DFT

Được cho $N$mẫu $x[0], x[1], \ldots, x[N-1]$, Transform Fourier Diễn biến phân biệt sản xuất$N$Tỷ lệ tần số $X[0], X[1], \ldots, X[N-1]$- Có thể là:

```math
X[k] = \sum_{n=0}^{N-1} x[n] \, e^{-2\pi i k n/N} \qquad \text{for } k = 0, 1, \ldots, N-1
```

Mỗi người$X[k]$là một số phức tạp.$\lvert X[k] \rvert$là tương xứng với độ tần số $k$Không có bình thường hóa, một âm âm thực sự của độ dồn.$A$Nó nằm ngay trên Bin.$k$cho $\lvert X[k] \rvert = AN/2$, vậy chia bằng $N/2$để đọc độ dồn.$\angle X[k]$cho bạn thấy sự thay đổi giai đoạn của tần số đó.

Những thông tin quan trọng:$e^{-2\pi i k n/N}$là một phasor quay ở tần số $k$DFT tính toán mối tương quan giữa tín hiệu và mỗi tín hiệu.$N$tần số không gian bằng nhau. Nếu tín hiệu chứa năng lượng ở tần số$k$Nếu không, nó gần bằng không.

### Điều gì mỗi hệ số có nghĩa là

**$X[0]$: the DC component.**Đây là tổng của tất cả các mẫu -- tương xứng với trung bình. Nó đại diện cho sự thay thế liên tục (tần số không) của tín hiệu.

```math
X[0] = \sum_{n=0}^{N-1} x[n] \, e^0 = \text{sum of all samples}
```

**$X[k]$ for $1 \le k \le N/2$: positive frequencies.** $X[k]$đại diện cho tần số $k$chu kỳ mỗi $N$mẫu. cao hơn $k$nghĩa là tần số cao hơn (sự dao động nhanh hơn).

**$X[N/2]$: the Nyquist frequency.**Tần số cao nhất mà bạn có thể đại diện với $N$trên đây, bạn có được các tên gọi -- tần số cao giả mạo là thấp.

**$X[k]$ for $N/2 < k < N$: negative frequencies.**Đối với tín hiệu có giá trị thực,$X[N-k] = \overline{X[k]}$Các tần số âm là hình ảnh gương của tần số tích cực.$N/2 + 1$các hệ số.

### DFT ngược

DFT ngược tái tạo tín hiệu ban đầu từ các hệ số tần số của nó:

```math
x[n] = \frac{1}{N} \sum_{k=0}^{N-1} X[k] \, e^{2\pi i k n/N} \qquad \text{for } n = 0, 1, \ldots, N-1
```

Những khác biệt duy nhất với DFT phía trước: dấu hiệu trong nhân tố là tích cực (không âm), và có một $1/N$yếu tố bình thường hóa.

DFT ngược là tái tạo hoàn hảo. Không có thông tin bị mất. Bạn có thể đi từ miền thời gian đến miền tần số và trở lại mà không có bất kỳ lỗi nào. DFT là một sự thay đổi cơ sở - nó tái thể hiện cùng một thông tin trong một hệ thống phối hợp khác.

### FFT: làm cho nó nhanh chóng

DFT như được định nghĩa ở trên là $O(N^2)$: cho mỗi $N$các hệ số sản xuất, bạn tổng hợp qua $N$mẫu đầu vào.$N$= 1 triệu, đó là $10^{12}$hoạt động.

Phương thức chuyển đổi Fourier nhanh (FFT) tính toán kết quả tương tự trong $O(N \log N)$- Vì $N$= 1 triệu, đó là khoảng 20 triệu hoạt động thay vì một nghìn tỷ.

Quá trình Cooley-Tukey (FFT phổ biến nhất) hoạt động bằng cách chia và chinh phục:

1. Chia tín hiệu thành các mẫu được lập chỉ số bằng và không cùng.
2. Xét DFT của mỗi nửa theo cách tái tạo.
3. Kết hợp hai DFT nửa kích thước bằng cách sử dụng "twivel factors" $e^{-2\pi i k/N}$- Tôi không biết.

```math
\begin{aligned}
X[k] &= E[k] + e^{-2\pi i k/N} \, O[k] && \text{for } k = 0, \ldots, N/2 - 1 \\
X[k + N/2] &= E[k] - e^{-2\pi i k/N} \, O[k] && \text{for } k = 0, \ldots, N/2 - 1 \\[6pt]
\text{where } E &= \text{DFT of even-indexed samples} \\
O &= \text{DFT of odd-indexed samples}
\end{aligned}
```

Sự đối xứng có nghĩa là mỗi cấp độ tái tạo có$O(N)$làm việc, và có $\log_2(N)$Tỷ lệ:$O(N \log N)$- Tôi không biết.

```mermaid
graph TD
    subgraph "8-point FFT (Cooley-Tukey)"
        X["x[0..7]<br/>8 samples"] -->|"split even/odd"| E["Even: x[0,2,4,6]"]
        X -->|"split even/odd"| O["Odd: x[1,3,5,7]"]
        E -->|"4-pt FFT"| EK["E[0..3]"]
        O -->|"4-pt FFT"| OK["O[0..3]"]
        EK -->|"combine with twiddle factors"| XK["X[0..7]"]
        OK -->|"combine with twiddle factors"| XK
    end
    subgraph "Complexity"
        C1["DFT: O(N^2) = 64 multiplications"]
        C2["FFT: O(N log N) = 24 multiplications"]
    end
```

Xây dựng ở đây là xích cực-2 FFT nhanh nhất khi chiều dài tín hiệu là một sức mạnh của 2. Bất cứ khi một phụ vấn đề có chiều dài lẻ, nó rơi lại với bình thường `dft`, vì vậy tín hiệu thường được đánh giá bằng không đến năng lượng tiếp theo của 2 cho tốc độ.`numpy.fft`xử lý bất kỳ chiều dài nào với thuật toán gốc hỗn hợp, nhưng chúng nhanh nhất trên chiều dài với các yếu tố nguyên tố nhỏ.

### Phân tích quang phổ

- **power spectrum**là $\lvert X[k] \rvert^2$-- kích thước vuông của mỗi hệ số tần số. Nó cho thấy có bao nhiêu năng lượng ở mỗi tần số.

- **phase spectrum**là $\angle X[k]$- sự thay đổi giai đoạn của mỗi tần số. Đối với hầu hết các nhiệm vụ phân tích, bạn quan tâm đến phổ năng lượng và bỏ qua giai đoạn.

```math
\begin{aligned}
\text{Power at frequency } k: \quad P[k] &= |X[k]|^2 = \mathop{\mathrm{Re}}(X[k])^2 + \mathop{\mathrm{Im}}(X[k])^2 \\
\text{Phase at frequency } k: \quad \phi[k] &= \mathop{\mathrm{atan2}}(\mathop{\mathrm{Im}}(X[k]), \mathop{\mathrm{Re}}(X[k]))
\end{aligned}
```

### Phân giải tần số

Độ phân giải tần số của DFT phụ thuộc vào số lượng mẫu $N$và tỷ lệ lấy mẫu $f_s$- Tôi không biết.

```math
\begin{aligned}
\text{Frequency of bin } k: \quad & f_k = k \cdot f_s / N \\
\text{Frequency resolution:} \quad & \Delta f = f_s / N \\
\text{Maximum frequency:} \quad & f_{\max} = f_s / 2 \quad \text{(Nyquist)}
\end{aligned}
```

Để giải quyết hai tần số gần nhau, bạn cần nhiều mẫu hơn. Để chụp tần số cao, bạn cần một tỷ lệ lấy mẫu cao hơn.

### Tiến lý convolution

Đây là một trong những kết quả quan trọng nhất trong xử lý tín hiệu và trực tiếp liên quan đến CNN.

**Convolution in the time domain equals pointwise multiplication in the frequency domain.**

```math
\begin{aligned}
& x * h = \text{IFFT}(\text{FFT}(x) \cdot \text{FFT}(h)) \\[4pt]
& \text{where } * \text{ is convolution and } \cdot \text{ is element-wise multiplication}
\end{aligned}
```

Tại sao điều này quan trọng:

- Sự xoắn thẳng của hai tín hiệu chiều dài $N$và $M$- Đưa ra$O(NM)$hoạt động.
- Sự xoay quanh dựa trên FFT$O(N \log N)$: biến đổi cả hai, nhân, biến đổi trở lại.
- Đối với các hạt nhân lớn, FFT convolution nhanh hơn đáng kể.
- Đây chính xác là những gì xảy ra trong các lớp convolutional với các lĩnh vực thụ thể lớn.

Lưu ý: DFT tính toán vòng tròn (sín hiệu bọc quanh). Đối với vòng tròn tuyến tính (không bao quanh), không pad cả hai tín hiệu dài $N + M - 1$trước khi tính toán.

```mermaid
graph LR
    subgraph "Time Domain"
        TA["Signal x[n]"] -->|"convolve (slow: O(NM))"| TC["Output y[n]"]
        TB["Filter h[n]"] -->|"convolve"| TC
    end
    subgraph "Frequency Domain"
        FA["FFT(x)"] -->|"multiply (fast: O(N))"| FC["FFT(x) * FFT(h)"]
        FB["FFT(h)"] -->|"multiply"| FC
        FC -->|"IFFT"| FD["y[n]"]
    end
    TA -.->|"FFT"| FA
    TB -.->|"FFT"| FB
    FD -.->|"same result"| TC
```

### Đường cửa sổ

DFT giả định tín hiệu là định kỳ - nó xử lý các $N$Các mẫu được tạo ra như một giai đoạn của một tín hiệu lặp lại vô tận. Nếu tín hiệu không bắt đầu và kết thúc ở cùng một giá trị, điều này tạo ra một sự gián đoạn ở biên giới, xuất hiện như hàm lượng tần số cao giả mạo.

Windowing làm giảm rò rỉ bằng cách giảm tín hiệu xuống 0 ở cả hai đầu trước khi tính toán DFT.

Chiếc cửa sổ chung:

| Window | Shape | Main lobe width | Side lobe level | Use case |
|--------|-------|----------------|-----------------|----------|
| Rectangular | Flat (no window) | Narrowest | Highest (-13 dB) | When signal is exactly periodic in N samples |
| Hann | Raised cosine | Moderate | Low (-31 dB) | General purpose spectral analysis |
| Hamming | Modified cosine | Moderate | Lower (-42 dB) | Audio processing, speech analysis |
| Blackman | Triple cosine | Wide | Very low (-58 dB) | When side lobe suppression is critical |

```math
\begin{aligned}
\text{Hann window:} \quad & w[n] = 0.5 \left(1 - \cos\frac{2\pi n}{N-1}\right) \\
\text{Hamming window:} \quad & w[n] = 0.54 - 0.46 \cos\frac{2\pi n}{N-1}
\end{aligned}
```

Sử dụng cửa sổ bằng cách nhân nó theo các yếu tố với tín hiệu trước DFT: `X = DFT(x * w)`- Tôi không biết.

### Các tính chất DFT

| Property | Time Domain | Frequency Domain |
|----------|-------------|-----------------|
| Linearity | $ax + by$ | $aX + bY$ |
| Time shift | $x[n - k]$ | $X[f] e^{-2\pi i f k/N}$ |
| Frequency shift | $x[n] e^{2\pi i f_0 n/N}$ | $X[f - f_0]$ |
| Convolution | $x * h$ | $X \cdot H$ (pointwise) |
| Multiplication | $x \cdot h$ (pointwise) | $X * H$ (circular convolution, scaled by $1/N$) |
| Parseval's theorem | $\sum \lvert x[n] \rvert^2$ | $\frac{1}{N} \sum \lvert X[k] \rvert^2$ |
| Conjugate symmetry (real input) | $x[n]$ real | $X[k] = \overline{X[N-k]}$ |

Lý thuyết của Parseval nói rằng tổng năng lượng là giống nhau trong cả hai lĩnh vực năng lượng được bảo tồn thông qua sự chuyển đổi.

### Kết nối với mã hóa vị trí

Transformer gốc sử dụng mã hóa vị trí chân lưng:

```math
\begin{aligned}
PE(pos, 2i) &= \sin\left(pos / 10000^{2i/d_{\text{model}}}\right) \\
PE(pos, 2i+1) &= \cos\left(pos / 10000^{2i/d_{\text{model}}}\right)
\end{aligned}
```

Mỗi cặp kích thước $(2i, 2i+1)$các tần số được phân cách theo hình học từ cao (kích thước 0,1) đến thấp (kích thước cuối cùng). Điều này cho mỗi vị trí một mô hình độc đáo trên tất cả các băng tần số - tương tự như cách các hệ số Fourier xác định một tín hiệu một cách độc đáo.

Các tính chất chính mà nó cung cấp:

- **Uniqueness:**Không có hai vị trí có mã hóa giống nhau.
- **Bounded values:**tội lỗi và cos luôn luôn trong $[-1, 1]$- Tôi không biết.
- **Relative position:**Mã hóa vị trí $p+k$có thể được thể hiện như một hàm tuyến tính của mã hóa tại vị trí $p$Mô hình có thể học cách tập để giữ các vị trí tương đối.

### Kết nối với CNN

Một lớp convolution áp dụng một bộ lọc được học (kernel) vào đầu vào bằng cách trượt nó qua tín hiệu hoặc hình ảnh.

Theo định lý convolution, điều này tương đương với:
1. FFT đầu vào
2. FFT hạt nhân
3. Tăng nhiều trong phạm vi tần số
4. IFFT kết quả

Các thực hiện CNN tiêu chuẩn sử dụng sự xoay quanh trực tiếp (nhanh hơn cho các lõi 3x3 nhỏ). Nhưng đối với các lõi lớn hoặc sự xoay quanh toàn cầu, các phương pháp dựa trên FFT nhanh hơn đáng kể. Một số kiến trúc (như FNet) thay thế sự chú ý hoàn toàn bằng FFT, đạt được độ chính xác cạnh tranh với $O(N \log N)$thay vì $O(N^2)$phức tạp.

### Phân quang và biến đổi Fourier thời gian ngắn

Một FFT đơn lẻ cho bạn nội dung tần số của toàn bộ tín hiệu, nhưng không cho bạn biết khi nào tần số đó xảy ra.

Phương pháp chuyển đổi Fourier thời gian ngắn (STFT) giải quyết vấn đề này bằng cách tính toán FFT trên các cửa sổ chồng chéo của tín hiệu. Kết quả là một quang phổ: một đại diện 2D với thời gian trên một trục và tần số trên một. Độ cường độ tại mỗi điểm cho thấy năng lượng tại tần số đó tại thời điểm đó.

```
STFT procedure:
1. Choose a window size (e.g., 1024 samples)
2. Choose a hop size (e.g., 256 samples -- 75% overlap)
3. For each window position:
   a. Extract the windowed segment
   b. Apply a Hann/Hamming window
   c. Compute FFT
   d. Store the magnitude spectrum as one column of the spectrogram
```

Spectrogram là đại diện đầu vào tiêu chuẩn cho các mô hình âm thanh ML. Mô hình nhận dạng giọng nói (Whisper, DeepSpeech) hoạt động trên các spectrogram mel - các spectrogram với tần số được lập bản đồ theo thang mel, phù hợp hơn với nhận thức giọng nói của con người.

### Tác giả

Nếu tín hiệu chứa tần số trên $f_s/2$(tần số Nyquist), lấy mẫu theo tốc độ $f_s$Một tín hiệu 90 Hz được lấy mẫu ở 100 Hz trông giống nhau với một tín hiệu 10 Hz. Không có cách nào để phân biệt chúng với các mẫu đơn lẻ.

```
Example:
  True signal: 90 Hz sine wave
  Sampling rate: 100 Hz
  Apparent frequency: 100 - 90 = 10 Hz

  The samples from the 90 Hz signal at 100 Hz sampling rate
  are identical to the samples from a 10 Hz signal.
  No amount of math can recover the original 90 Hz.
```

Đây là lý do tại sao các bộ chuyển đổi analog sang kỹ thuật số bao gồm các bộ lọc chống liêm mà loại bỏ tần số trên Nyquist trước khi lấy mẫu. Trong ML, liêm xuất hiện khi lấy mẫu xuống các bản đồ tính năng mà không cần lọc thấp thích hợp - một số kiến trúc giải quyết điều này bằng các lớp hợp nhất chống liêm.

### Việc làm bằng không không làm tăng độ phân giải

Một quan niệm sai lầm phổ biến: việc làm nét bằng không trước khi FFT cải thiện độ phân giải tần số. Nó không làm thế. Nét bằng không liên kết giữa các thùng tần số hiện có, cho bạn một quang phổ trông mượt mà hơn. Nhưng nó không thể tiết lộ chi tiết tần số không có trong các mẫu ban đầu.

Độ phân giải tần số thực sự chỉ phụ thuộc vào thời gian quan sát $T = N / f_s$Để giải quyết hai tần số tách biệt bởi$\Delta f$, anh cần ít nhất là$T = 1 / \Delta f$Không có số lượng không đệm thay đổi giới hạn cơ bản này.

```figure
fourier-synthesis
```

## Hãy xây dựng nó

### Bước 1: DFT từ đầu

- $O(N^2)$DFT theo nghĩa trực tiếp từ định nghĩa.

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

### Bước 2: DFT ngược

cùng cấu trúc, nhân tích, chia bằng $N$- Tôi không biết.

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

### Bước 3: FFT (Cooley-Tukey)

FFT thu hồi đòi hỏi sức mạnh của 2 chiều dài. chia thành ngang và lẻ, thu hồi, kết hợp với các yếu tố trộn.

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

### Bước 4: Các trợ lý phân tích quang phổ

```python
def power_spectrum(X):
    return [xk.real ** 2 + xk.imag ** 2 for xk in X]

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

## Sử dụng nó

Đối với công việc thực, sử dụng Numpy's FFT được hỗ trợ bởi các thư viện C tối ưu hóa cao.

```python
import numpy as np

signal = np.sin(2 * np.pi * 5 * np.arange(256) / 256)
spectrum = np.fft.fft(signal)
freqs = np.fft.fftfreq(256, d=1/256)

power = np.abs(spectrum) ** 2

positive_freqs = freqs[:len(freqs)//2]
positive_power = power[:len(power)//2]
```

Đối với việc phân tích quang phổ cửa sổ và tiên tiến hơn:

```python
from scipy.signal import windows, stft

window = windows.hann(256)
windowed = signal * window
spectrum = np.fft.fft(windowed)
```

Đối với sự xoắn:

```python
from scipy.signal import fftconvolve

result = fftconvolve(signal, kernel, mode='full')
```

Đối với các quang phổ:

```python
from scipy.signal import stft

frequencies, times, Zxx = stft(signal, fs=sample_rate, nperseg=256)
spectrogram = np.abs(Zxx) ** 2
```

Các mô hình của các quang phổ có hình dạng (n_frequencies, n_time_frames). Mỗi cột là quang phổ năng lượng tại một cửa sổ thời gian. Đây là những gì các mô hình âm thanh ML tiêu thụ như là đầu vào.

## Chuyển nó

Đi chạy`code/fourier.py`để tạo ra `outputs/prompt-spectral-analyzer.md`. Phiên bản TypeScript,`code/fourier.ts`, viết cùng một tập tin.

## Các bài tập

1. **Pure tone identification.**Tạo một tín hiệu với một sóng âm đạo duy nhất ở tần số không rõ (trên 1 đến 50 Hz), lấy mẫu ở 128 Hz trong 1 giây. Sử dụng DFT của bạn để xác định tần số. Kiểm tra sự phù hợp của câu trả lời. Bây giờ thêm tiếng ồn Gaussian với độ lệch chuẩn 0,5 và lặp lại.

2. **FFT vs DFT verification.**Tạo ra một tín hiệu ngẫu nhiên dài 64.$O(N^2){}$(DT) và FFT. Kiểm tra rằng tất cả các hệ số phù hợp với trong 1e-10. Thời gian cả hai hoạt động trên các tín hiệu dài 256, 512, 1024, và 2048.

3. **Convolution theorem proof by example.**Tạo tín hiệu x = [1, 2, 3, 4, 0, 0, 0, 0] và lọc h = [1, 1, 1, 0, 0, 0, 0, 0]. Xét kết cấu vòng tròn trực tiếp (đường tròn). Sau đó tính bằng FFT (giải đổi, nhân, đảo ngược chuyển đổi).

4. **Windowing effects.**Tạo một tín hiệu là tổng hợp hai sóng âm đạo ở 10 Hz và 12 Hz (rất gần). lấy mẫu ở 128 Hz trong 1 giây. Xét quang phổ điện mà không có cửa sổ, cửa sổ Hann và cửa sổ Hamming.

5. **Positional encoding analysis.**Tạo các mã hóa vị trí chân lề cho d_model = 128 và max_pos = 512.$(p_1, p_2)$, tính toán các điểm sản phẩm của các mã hóa của họ.$\lvert p_1 - p_2 \rvert$Điều gì xảy ra với điểm nhân khi khoảng cách tăng lên?

### Những gợi ý

**Exercise 1.**Với 128 mẫu trong 1 giây, bin $k$là $k$Hz, vì vậy cho tần số nguyên tử chỉ số giá trị lớn nhất trong thùng 1 đến 63 là tần số. chọn một số nguyên tử của hertz. tần số giữa hai thùng lan rộng ra vào hàng xóm của nó, và đỉnh chỉ đưa ra thùng gần nhất. sử dụng `generate_signal`và `magnitude_spectrum`Sau khi bạn thêm tiếng ồn, kiểm tra xem đỉnh vẫn ở cùng một thùng rác trong khi các thùng rác khác tăng lên.

**Exercise 2.**Sử dụng một sức mạnh của hai chiều dài, bởi vì `fft`chia tín hiệu thành hai phần.`max(abs(a - b))`Tỷ lệ thời gian sẽ tăng khoảng như$N / \log_2 N$- Tôi không biết.

**Exercise 3.**Đối với vòng xoắn vòng tròn, tính toán $y[n] = \sum_k h[k] x[(n-k) \bmod 8]$bằng tay cho $n$= 0, 1 và 2, và so sánh ba giá trị đầu tiên của `convolve_direct`và `convolve_fft`. Lòng xoắn có chiều dài 4 + 3 - 1 = 6, vì vậy trước tiên kiểm tra xem chiều dài 8 đã đủ dài.

**Exercise 4.**Sử dụng `hann_window`- `hamming_window`- `apply_window`, và`power_spectrum`, và đếm các đỉnh riêng biệt giữa 9 và 13 Hz. Cả 10 Hz và 12 Hz hoàn thành các chu kỳ hoàn chỉnh trong 1 giây, vì vậy không có cửa sổ có thể trông tốt nhất.

**Exercise 5.**Lập từng mã hóa với `positional_encoding(pos, 128)`. So sánh sản phẩm điểm cho các vị trí (0, 10) với sản phẩm điểm cho (100, 110): hai giá trị phải phù hợp với khoảng 1e-10. Sau đó vẽ sản phẩm điểm đối với $\lvert p_1 - p_2 \rvert$cho một cố định $p_1$- Tôi không biết.

## Các điều khoản chính

| Term | What it means |
|------|---------------|
| DFT (Discrete Fourier Transform) | Converts $N$ time-domain samples into $N$ frequency-domain coefficients. Each coefficient is the correlation with a complex sinusoid at that frequency |
| FFT (Fast Fourier Transform) | An $O(N \log N)$ algorithm to compute the DFT. The Cooley-Tukey algorithm splits even/odd indices recursively |
| Inverse DFT | Reconstructs the time-domain signal from frequency coefficients. Same formula as DFT with flipped exponent sign and $1/N$ scaling |
| Frequency bin | Each index $k$ in the DFT output represents frequency $k f_s/N$ Hz. The "bin" is the discrete frequency slot |
| DC component | $X[0]$, the zero-frequency coefficient. Proportional to the signal mean |
| Nyquist frequency | $f_s/2$, the maximum frequency representable at sampling rate $f_s$. Frequencies above this alias |
| Power spectrum | $\lvert X[k] \rvert^2$, the squared magnitude of each frequency coefficient. Shows energy distribution across frequencies |
| Phase spectrum | $\angle X[k]$, the phase offset of each frequency component. Often ignored in analysis |
| Spectral leakage | Spurious frequency content caused by treating a non-periodic signal as periodic. Reduced by windowing |
| Window function | A tapering function (Hann, Hamming, Blackman) applied before DFT to reduce spectral leakage |
| Twiddle factor | The complex exponential $e^{-2\pi i k/N}$ used to combine sub-DFTs in the FFT butterfly computation |
| Convolution theorem | Convolution in time domain equals pointwise multiplication in frequency domain. Fundamental to signal processing and CNNs |
| Circular convolution | Convolution where the signal wraps around. This is what the DFT naturally computes |
| Linear convolution | Standard convolution without wraparound. Achieved by zero-padding before DFT |
| Parseval's theorem | Total energy is preserved through the Fourier transform. $\sum \lvert x[n] \rvert^2 = \frac{1}{N} \sum \lvert X[k] \rvert^2$ |
| Aliasing | When frequencies above Nyquist appear as lower frequencies due to insufficient sampling rate |

## Đọc thêm

- [Cooley & Tukey: An Algorithm for the Machine Calculation of Complex Fourier Series (1965)](https://www.ams.org/journals/mcom/1965-19-090/S0025-5718-1965-0178586-1/)- giấy FFT ban đầu đã thay đổi máy tính
- [3Blue1Brown: But what is the Fourier Transform?](https://www.youtube.com/watch?v=spUNpyF58BY)- giới thiệu trực quan tốt nhất về biến Fourier
- [Lee-Thorp et al.: FNet: Mixing Tokens with Fourier Transforms (2021)](https://arxiv.org/abs/2105.03824)- thay thế sự chú ý tự mình bằng FFT trong các máy biến
- [Smith: The Scientist and Engineer's Guide to Digital Signal Processing](http://www.dspguide.com/)- sách giáo khoa trực tuyến miễn phí bao gồm FFT, cửa sổ và phân tích quang phổ sâu sắc
- [Vaswani et al.: Attention Is All You Need (2017)](https://arxiv.org/abs/1706.03762)- Mã hóa vị trí chân lưng có nguồn gốc từ phân hủy tần số Fourier
- [Radford et al.: Whisper (2022)](https://arxiv.org/abs/2212.04356)- nhận dạng giọng nói sử dụng các quang phổ mel như là đại diện đầu vào
