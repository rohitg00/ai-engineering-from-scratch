# Fourier Değişimi

> Her sinyal sinüs dalgalarının toplamıdır. Fourier dönüşümü hangisini söyler.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 01-04, 19 (complex numbers)
**Time:** ~90 minutes

## Öğrenme Hedefleri

- DFT ' yi sıfırdan uygula ve onu $O(N \log N)$Cooley-Tukey FFT
- Frekans koefisienlerini yorumlayın: bir sinyaldeki amplitud, faz ve güç spektrumu çıkarın
- FFT çarpımı yoluyla konvulsiyon gerçekleştirmek için konvulsiyon teoremi uygulayın
- Fourier frekansı parçalanmasını transformatör pozisyon kodlama ve CNN konvolisyon katmanlarına bağlayın

## Sorun

Bir ses kaydesi, zamanla basınç ölçümlerinin bir dizilemesidir. Bir stok fiyatı, günler boyunca değerlerin bir dizilemesidir. Bir görüntü, uzay üzerinde piksel yoğunluklarının bir çubuğudur. Bunların hepsi zaman alanındaki (veya uzay alanındaki) veridir.

Ancak zaman alanında birçok desen görünmez. Bu ses sinyali saf bir ton mu yoksa akord mu? Bu hisse senedi bir haftalık döngü mi var? Bu görüntü tekrarlayan bir doku mu var?

Fourier dönüşümü, bir sinyal alır ve farklı frekanslarda sinüs dalgalarına parçalayır. Her sinüs dalgasının bir amplitudusu (ne kadar güçlü olduğu) ve bir aşaması vardır (nereye başladığı). Fourier dönüşümü her ikisini de söyler.

Bu ML için önemlidir çünkü frekans alanı düşüncesi her yerde ortaya çıkar. Konvülsiyonal sinir ağları konvülsiyonu gerçekleştirir, bu da frekans alanında çarpma. Transformer pozisyon kodlamaları konumları temsil etmek için frekans parçalanmasını kullanır. Ses modelleri (söz tanıma, müzik üretimi) spektrogramlar üzerinde çalışır - seslerin frekans temsilleri. Zaman dizisi modelleri periyodik desenleri arıyor. Fourier dönüşümünü anlamak, bunların hepsini kullanmak için kelime birikimi verir.

## Anlaşım

### DFT tanımı

Verilmiştir .$N$örnekler $x[0], x[1], \ldots, x[N-1]$, Diskret Fourier Transform üretir $N$frekans katılıkları $X[0], X[1], \ldots, X[N-1]$- ...

```math
X[k] = \sum_{n=0}^{N-1} x[n] \, e^{-2\pi i k n/N} \qquad \text{for } k = 0, 1, \ldots, N-1
```

Her biri .$X[k]$Bu karmaşık bir sayıdır.$\lvert X[k] \rvert$frekans amplituduna orantılıdır $k$Normalleşme olmadan, genişliğin gerçek sinüsü.$A$Bu tam olarak bin ' e düşer .$k$ver .$\lvert X[k] \rvert = AN/2$, o yüzden böl $N/2$Amplitudu okumak için.$\angle X[k]$Bu frekansın faz geçişini gösterir.

Anahtar bilgi:$e^{-2\pi i k n/N}$frekansında dönen bir fazördür.$k$DFT , sinyal ve her bir sinyal arasındaki ilişkiyi hesaplar .$N$Eğer sinyal frekanslı bir enerji içerirse$k$Eğer bu değilse, sıfırın yakınında.

### Her bir katılamın anlamı

**$X[0]$: the DC component.**Bu, tüm örneklerin toplamı ortalama oranla oranlıdır.

```math
X[0] = \sum_{n=0}^{N-1} x[n] \, e^0 = \text{sum of all samples}
```

**$X[k]$ for $1 \le k \le N/2$: positive frequencies.** $X[k]$frekansı temsil eder $k$$N$Örnekler.$k$Daha yüksek frekans (hızlı bir titreşim) anlamına gelir.

**$X[N/2]$: the Nyquist frequency.**Yapabileceğiniz en yüksek frekans .$N$Bu örneğin üstünde, yüksek frekanslar düşük frekanslar gibi maske ederek isimlendirilir.

**$X[k]$ for $N/2 < k < N$: negative frequencies.**Gerçek değerli sinyaller için,$X[N-k] = \overline{X[k]}$Negatif frekanslar pozitif frekansların ayna görüntüleridir.$N/2 + 1$Koefisienler.

### Ters DFT

Ters DFT, orijinal sinyali frekans koefisienlerinden yeniden oluşturur:

```math
x[n] = \frac{1}{N} \sum_{k=0}^{N-1} X[k] \, e^{2\pi i k n/N} \qquad \text{for } n = 0, 1, \ldots, N-1
```

Önceki DFT'den sadece farklılıklar: Eksponentteki işaret olumlu (negatif değil) ve bir $1/N$Normalleşme faktörü.

DFT tersine dönüşüm mükemmel. Hiçbir bilgi kaybolmaz. Zaman alanından frekans alanına ve geri herhangi bir hata olmadan gidebilirsiniz. DFT temel değişikliği - aynı bilgileri farklı koordinat sisteminde yeniden ifade eder.

### FFT: hızlı hale getirmek

Yukarıda tanımlanan DFT $O(N^2)$: her biri için $N$Çıktılık koeficientleri, topladınız $N$Giriş örnekleri.$N$= 1 milyon, yani $10^{12}$İşlemler.

Fast Fourier Transform (FFT) aynı sonucu hesaplar $O(N \log N)$- Evet .$N$Bu da frekans analizini pratik kılan bir şey.

Cooley-Tukey algoritması (en yaygın FFT) bölme ve fetih yoluyla çalışır:

1. Sinyalı eşit indeksi ve eşsiz indeksi örneklere bölün.
2. Her yarısının DFT'sini geri dönüşlü olarak hesaplayın.
3. İki yarı boyutlu DFT'yi "twicel faktörler" kullanarak birleştirin.$e^{-2\pi i k/N}$- Evet .

```math
\begin{aligned}
X[k] &= E[k] + e^{-2\pi i k/N} \, O[k] && \text{for } k = 0, \ldots, N/2 - 1 \\
X[k + N/2] &= E[k] - e^{-2\pi i k/N} \, O[k] && \text{for } k = 0, \ldots, N/2 - 1 \\[6pt]
\text{where } E &= \text{DFT of even-indexed samples} \\
O &= \text{DFT of odd-indexed samples}
\end{aligned}
```

Simetri , her rekürsiyon seviyesinin $O(N)$İş ve var $\log_2(N)$Düzenler.$O(N \log N)$- Evet .

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

Burada oluşturulan radix-2 FFT sinyal uzunluğu 2'nin gücü olduğunda en hızlıdır. Bir alt sorunun eşsiz uzunluğu olduğunda, düzine geri düşer.`dft`, yani sinyaller genellikle hız için 2'nin bir sonraki gücüne sıfır olarak doldurulur.`numpy.fft`Karışık radikal algoritmaları ile herhangi bir uzunlukla çalışırlar, ancak küçük ilk faktörlerle uzunluklarda en hızlılar.

### Spektral analiz

- Evet .**power spectrum**- Evet .$\lvert X[k] \rvert^2$- her frekans katılamının karesi büyüklüğü.

- Evet .**phase spectrum**- Evet .$\angle X[k]$En çok analiz görevleri için güç spektrumuyla ilgilenir ve fazı görmezden gelirsiniz.

```math
\begin{aligned}
\text{Power at frequency } k: \quad P[k] &= |X[k]|^2 = \mathop{\mathrm{Re}}(X[k])^2 + \mathop{\mathrm{Im}}(X[k])^2 \\
\text{Phase at frequency } k: \quad \phi[k] &= \mathop{\mathrm{atan2}}(\mathop{\mathrm{Im}}(X[k]), \mathop{\mathrm{Re}}(X[k]))
\end{aligned}
```

### Frekans çözünürlüğü

DFT'nin frekans çözünürlüğü örneklerin sayısına bağlıdır $N$ve örnekleme oranı $f_s$- Evet .

```math
\begin{aligned}
\text{Frequency of bin } k: \quad & f_k = k \cdot f_s / N \\
\text{Frequency resolution:} \quad & \Delta f = f_s / N \\
\text{Maximum frequency:} \quad & f_{\max} = f_s / 2 \quad \text{(Nyquist)}
\end{aligned}
```

Birbiriyle yakın olan iki frekansı çözmek için daha fazla örnek gerekmektedir. Yüksek frekansları yakalamak için daha yüksek örnekleme oranına ihtiyacınız vardır.

### Konvulsiyon teoremi

Bu sinyal işleme alanındaki en önemli sonuçlardan biri ve CNN'lere doğrudan alakalı.

**Convolution in the time domain equals pointwise multiplication in the frequency domain.**

```math
\begin{aligned}
& x * h = \text{IFFT}(\text{FFT}(x) \cdot \text{FFT}(h)) \\[4pt]
& \text{where } * \text{ is convolution and } \cdot \text{ is element-wise multiplication}
\end{aligned}
```

Bunun neden önemli olduğunu:

- İki uzunluk sinyalinin doğrudan kıvrımı $N$ve $M$Alıyor .$O(NM)$İşlemler.
- FFT tabanlı konvulsiyonlar $O(N \log N)$Her ikisini de dönüştür, çoğalt, geri dönüştür.
- Büyük çekirdekler için, FFT konvolyyonu çok daha hızlıdır.
- Büyük kabul alanları olan konvulsiyon katmanlarında da aynen böyle olur.

Not: DFT döngülik kıvrım hesaplar (sinyal etrafında sarılır).$N + M - 1$Bilgisayar yapmadan önce.

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

### Pencere

DFT sinyalin periyodik olduğunu varsayır.$N$Eğer sinyal aynı değerde başlamaz ve bitmezse, bu, sınırda bir kesintisizlik yaratır ve bu durum, yanlış yüksek frekanslı bir içeriğe sahip olarak ortaya çıkar.

Pencereleme, DFT'yi hesaplamadan önce sinyalin her iki ucunda sıfıra indirerek sızıntıları azaltır.

Genel pencereler:

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

Pencereyi DFT'den önceki sinyalle element ölçüsünde çarparak uygulayın: `X = DFT(x * w)`- Evet .

### DFT özellikleri

| Property | Time Domain | Frequency Domain |
|----------|-------------|-----------------|
| Linearity | $ax + by$ | $aX + bY$ |
| Time shift | $x[n - k]$ | $X[f] e^{-2\pi i f k/N}$ |
| Frequency shift | $x[n] e^{2\pi i f_0 n/N}$ | $X[f - f_0]$ |
| Convolution | $x * h$ | $X \cdot H$ (pointwise) |
| Multiplication | $x \cdot h$ (pointwise) | $X * H$ (circular convolution, scaled by $1/N$) |
| Parseval's theorem | $\sum \lvert x[n] \rvert^2$ | $\frac{1}{N} \sum \lvert X[k] \rvert^2$ |
| Conjugate symmetry (real input) | $x[n]$ real | $X[k] = \overline{X[N-k]}$ |

Parseval teoremi, her iki alanda toplam enerjinin aynı olduğunu söyler.

### Konaklama kodlamalarına bağ

Orijinal Transformer sinusoidal pozisyon kodlamaları kullanıyor:

```math
\begin{aligned}
PE(pos, 2i) &= \sin\left(pos / 10000^{2i/d_{\text{model}}}\right) \\
PE(pos, 2i+1) &= \cos\left(pos / 10000^{2i/d_{\text{model}}}\right)
\end{aligned}
```

Her boyut çiftini .$(2i, 2i+1)$Bu, her pozisyonun tüm frekans bantlarında benzersiz bir kalıp oluşturmasını sağlar. Fourier katılıklarının bir sinyalin benzersiz olarak tanımlandığı gibi.

Bu özellikler şunlardır:

- **Uniqueness:**İki pozisyon aynı kodlamada bulunamaz.
- **Bounded values:**Günah ve günah hep içindedir.$[-1, 1]$- Evet .
- **Relative position:**Konum kodlaması $p+k$konumdaki kodlamanın bir çizgi işlevi olarak ifade edilebilir $p$Model göreceli pozisyonlara katılmayı öğrenebilir.

### CNN'lere bağlantı

Bir konvolisyon katmanı, sinyal veya görüntü üzerinden kaydırarak girişine öğrenilmiş bir filtre (kernel) uyguluyor.

Konvulsiyon teoremi ile, bu eşdeğer:
1. FFT giriş
2. FFT çekirdeği
3. Frekans alanında çarpma
4. Sonuçı

Standart CNN uygulamalar doğrudan konvoluyonu kullanır (küçük 3x3 çekirdekler için daha hızlı). Ancak büyük çekirdekler veya küresel konvoluyon için, FFT tabanlı yaklaşımlar önemli ölçüde daha hızlıdır.$O(N \log N)$yerine$O(N^2)$karmaşıklık.

### Spektrogramlar ve Kısa Zamanlı Fourier Değişimi

Tek bir FFT size tüm sinyalin frekans içeriğini verir, ancak bu frekansların ne zaman meydana geldiği hakkında hiçbir şey söylemez. Bir çırp (sıkıntıları zamanla artış gösterdiği bir sinyal) ve bir akord (her frekans aynı anda mevcut) aynı büyüklük spektruma sahip olabilir.

Kısa Zaman Fourier Transform (STFT) bunu sinyalin üst üstü örtüşen pencerelerinde FFT'leri hesaplayarak çözür. Sonuç bir spektrogramdır: bir eksede zaman ve diğerinde frekans ile 2 boyutlu bir temsil.

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

Spektrogramlar, ses ML modelleri için standart giriş temsilidir. Konuşma tanıma modelleri (Shisper, DeepSpeech) mel-spektrogramlar üzerinde çalışır - mel ölçeğine haritelenen frekansları olan spektrogramlar, insan yüksek ses algılamalarına daha iyi uymaktadır.

### İsimsiz

Eğer bir sinyal yukarıdaki frekansları içerirse $f_s/2$(Nyquist frekansı), örnekleme hızında $f_s$90 Hz sinyalinin 100 Hz'de örneklenmesi 10 Hz sinyaline benzer görünüyor.

```
Example:
  True signal: 90 Hz sine wave
  Sampling rate: 100 Hz
  Apparent frequency: 100 - 90 = 10 Hz

  The samples from the 90 Hz signal at 100 Hz sampling rate
  are identical to the samples from a 10 Hz signal.
  No amount of math can recover the original 90 Hz.
```

Bu nedenle analog-dijital dönüştürücüler, örnekleme yapmadan önce Nyquist'in üzerindeki frekansları kaldıran anti-aliasing filtrelerini içerir. ML'de, düşük geçiş filtresi olmadan özellik haritalarını aşağı örneklemekte, aliasing görünür. Bazı mimarlıklar bunu anti-aliased birleştirme katmanlarıyla ele alır.

### sıfır patlama çözünürlüğünü arttırmaz

Genel bir yanlış anlama: FFT'den önce bir sinyalin sıfır patlaması frekans çözünürlüğünü artırır. Yapmaz. sıfır patlama mevcut frekans kutuları arasında aralaşır, size daha düzgün görünen bir spektrum verir. Ama orijinal örneklerde bulunmayan frekans ayrıntılarını ortaya çıkaramaz.

Gerçek frekans çözünürlüğü sadece gözlem süresine bağlıdır .$T = N / f_s$. İki frekansın çözülmesi için $\Delta f$En azından ihtiyacın var .$T = 1 / \Delta f$Hiçbir sıfır dolgu miktarı bu temel sınırı değiştirmez.

```figure
fourier-synthesis
```

## Yapın

### Adım 1: DFT sıfırdan

- Evet .$O(N^2)$DFT, tanımdan doğrudan bir şekilde çıkar.

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

### Adım 2: Ters DFT

Aynı yapı, pozitif katılımcı, bölme $N$- Evet .

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

### Adım 3: FFT (Cooley-Tukey)

Rekürsiv FFT'nin 2 uzunluğun güçünü gerektirir.

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

### Adım 4: Spektral analiz yardımcıları

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

## Kullan

Gerçek çalışmalar için, yüksek düzeyde optimize edilmiş C kütüphaneleri tarafından desteklenen numpy'nin FFT's'ini kullanın.

```python
import numpy as np

signal = np.sin(2 * np.pi * 5 * np.arange(256) / 256)
spectrum = np.fft.fft(signal)
freqs = np.fft.fftfreq(256, d=1/256)

power = np.abs(spectrum) ** 2

positive_freqs = freqs[:len(freqs)//2]
positive_power = power[:len(power)//2]
```

Pencereleme ve daha gelişmiş spektral analiz için:

```python
from scipy.signal import windows, stft

window = windows.hann(256)
windowed = signal * window
spectrum = np.fft.fft(windowed)
```

Çelişki için:

```python
from scipy.signal import fftconvolve

result = fftconvolve(signal, kernel, mode='full')
```

Spektrogramlar için:

```python
from scipy.signal import stft

frequencies, times, Zxx = stft(signal, fs=sample_rate, nperseg=256)
spectrogram = np.abs(Zxx) ** 2
```

Spektrogram matrisinin şekli vardır (n_frequencies, n_time_frames). Her sütun bir zaman penceresinde güç spektrumudır.

## Gönder

Çık .`code/fourier.py`üretmek için`outputs/prompt-spectral-analyzer.md`TypeScript sürümü,`code/fourier.ts`, aynı dosyayı yazıyor.

## Egzersizler

1. **Pure tone identification.**Bilinmeyen bir frekansta (1-50 Hz arasında) tek sinüs dalgasıyla bir sinyal oluşturun ve 128 Hz'de 1 saniye boyunca örnek alın. DFT'ni kullanarak frekansı tanımlayın. Cevap eşleşmesini kontrol edin. Şimdi standart sapma 0.5 ile Gaussian gürültüsünü ekleyin ve tekrarlayın.

2. **FFT vs DFT verification.**64 uzunluğundaki rastgele bir sinyal oluşturun.$O(N^2){}$DFT zamanının FFT zaman oranını çizin.

3. **Convolution theorem proof by example.**Sinyal x = [1, 2, 3, 4, 0, 0, 0, 0] oluşturun ve h = [1, 1, 1, 0, 0, 0, 0, 0] filtreleyin. Dört kıvrımlarını doğrudan hesaplayın (bir yuva).

4. **Windowing effects.**Bir sinyal oluşturun ki bu sinyal 10 Hz ve 12 Hz (çok yakın) iki sinüs dalgasının toplamıdır. 128 Hz'de 1 saniye boyunca örnek alın. Pencere olmayan güç spektrumu, Hann pencere ve Hamming pencereyi hesaplayın. Hangi pencere iki zirveyi ayırt etmenin en kolayını sağlar?

5. **Positional encoding analysis.**D_model = 128 ve max_pos = 512 için sinusoidal pozisyon kodlamaları oluşturun.$(p_1, p_2)$, kodlamalarının nokta ürünü hesaplar.$\lvert p_1 - p_2 \rvert$- Uzaklık arttıkça nokta ürünü ne olur?

### İpuçlar

**Exercise 1.**128 numune ile 1 saniye boyunca bin $k$- Evet .$k$Hz, yani tam sayı frekansı için 1 ila 63 kutulardaki en büyük değer indeksi frekansdır.`generate_signal`ve `magnitude_spectrum`Ses ekledikten sonra, diğer kutular yükselirken zirve aynı kutuda olup olmadığını kontrol et.

**Exercise 2.**İki uzunluklu bir güç kullanın, çünkü `fft`- Siyalı ikiye ayırır.`max(abs(a - b))`Zaman oranı yaklaşık olarak $N / \log_2 N$- Evet .

**Exercise 3.**Dört dönüklik için hesaplayın.$y[n] = \sum_k h[k] x[(n-k) \bmod 8]$el ile $n$= 0, 1 ve 2 ve 'nin ilk üç değerini karşılaştırın.`convolve_direct`ve `convolve_fft`Düzsel kıvrım uzunluğu 4 + 3 - 1 = 6'dur, bu yüzden önce 8'in uzunluğu yeterince uzun olup olmadığını kontrol edin.

**Exercise 4.**Kullanım`hann_window`- Evet .`hamming_window`- Evet .`apply_window`ve`power_spectrum`10 Hz ve 12 Hz her ikisi de 1 saniye içinde tüm döngüleri tamamlar, bu nedenle hiçbir pencere en iyi görünmez olabilir. Pencerelerin sızdırılmasını azaltmak için 10.5 Hz ve 12.5 Hz ile tekrarlayın.

**Exercise 5.**Her kodlamayı  ile hesaplayın`positional_encoding(pos, 128)`. Konumlar (0, 10) için nokta ürünü ile (100, 110) için nokta ürünü karşılaştırın: iki değer yaklaşık 1e-10 ile eşleşmelidir.$\lvert p_1 - p_2 \rvert$Bir tane sabit .$p_1$- Evet .

## Anahtar Terimler

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

## Daha Fazla Okumak

- [Cooley & Tukey: An Algorithm for the Machine Calculation of Complex Fourier Series (1965)](https://www.ams.org/journals/mcom/1965-19-090/S0025-5718-1965-0178586-1/)- Bilgisayarı değiştiren orijinal FFT kağıdı
- [3Blue1Brown: But what is the Fourier Transform?](https://www.youtube.com/watch?v=spUNpyF58BY)- Fourier dönüşümlerine en iyi görsel giriş
- [Lee-Thorp et al.: FNet: Mixing Tokens with Fourier Transforms (2021)](https://arxiv.org/abs/2105.03824)- transformörlerde kendini dikkatle kullanmayı FFT ile değiştirir
- [Smith: The Scientist and Engineer's Guide to Digital Signal Processing](http://www.dspguide.com/)- FFT, pencereler ve spektral analizleri hakkında ücretsiz çevrimiçi ders kitabı
- [Vaswani et al.: Attention Is All You Need (2017)](https://arxiv.org/abs/1706.03762)- Fourier frekanslı parçalanma ile elde edilen sinusoidal pozisyon kodlamalar
- [Radford et al.: Whisper (2022)](https://arxiv.org/abs/2212.04356)- mel spektrogramları kullanarak konuşma tanıma giriş temsilciliği
