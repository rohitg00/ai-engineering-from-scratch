# AI için karmaşık sayılar

> -1'in kare kökü hayal edici değil. Dönüşümlerin, frekansların ve sinyal işleme yarısının anahtarıdır.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 01-04 (linear algebra, calculus)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- Katı ve kutup şeklinde karmaşık aritmetik (ekle, kat, böl, birleştir) yapın
- Karmaşık eksponensialler ve trigonometrik fonksiyonlar arasında dönüştürmek için Euler'in formülünü uygulayın
- Karmaşık birlik köklerini kullanarak Diskret Fourier Transform uygulamak
- Transformatörlerde RoPE ve sinusoidal pozisyon kodlamalarının karmaşık dönümlerin nasıl altında olduğunu açıklayın.

## Sorun

Fourier dönüşümleri üzerine bir makale açarsanız , orada bir şey var .`i`Transformer konum kodlamalarına bakıp görebilirsiniz.`sin`ve `cos`karmaşık eksponensallerin gerçek ve hayalsel kısımları. Kuantum bilgisayarı hakkında okuyorsunuz ve karmaşık vektör alanlarında ifade edilen her şeyi bulursunuz.

Karmaşık sayılar soyut görünüyor. -1 kare kökü üzerine inşa edilmiş bir sayı sistemi bir matematik hilesi gibi hisseder. Ama bu bir hile değil. Bu dönüm ve titreşimlerin doğal dili. Bir şey her döndüğünde, titreştiğinde veya titreştiğinde, karmaşık sayılar doğru araçtır.

Karmaşık sayıları anlamadan, Diskret Fourier Transform'u anlayamazsınız. FFT'yi anlayamazsınız. RoPE (Rotary Position Embedding) modern dil modellerinde nasıl çalışır anlamıyorsunuz.

Bu ders karmaşık aritmetikleri sıfırdan inşa eder, jeometriyle bağlar ve makine öğreniminde karmaşık sayılar tam olarak nerede göründüğünü gösterir.

## Anlaşım

### Karmaşık bir sayı nedir?

Karmaşık bir sayı iki parçaya sahiptir: gerçek bir bölüm ve hayali bir bölüm.

```
z = a + bi

where:
  a is the real part
  b is the imaginary part
  i is the imaginary unit, defined by i^2 = -1
```

Bu sayılar, bir düzlemde, gerçek sayılar bir tarafa, hayal sayılar diğer tarafa, her karmaşık sayı bu düzlemde bir nokta.

### Karmaşık aritmetik

**Addition.**Gerçek parçaları bir araya getirin, hayali parçaları bir araya getirin.

```math
\begin{aligned}
(a + bi) + (c + di) &= (a + c) + (b + d)i \\[4pt]
\text{Example: } (3 + 2i) + (1 + 4i) &= 4 + 6i
\end{aligned}
```

**Multiplication.**Paylaştırma yasasını kullan ve bunu unutma.$i^2 = -1$- Evet .

```math
\begin{aligned}
(a + bi)(c + di) &= ac + adi + bci + bdi^2 \\
&= ac + adi + bci - bd \\
&= (ac - bd) + (ad + bc)i \\[8pt]
\text{Example: } (3 + 2i)(1 + 4i) &= 3 + 12i + 2i + 8i^2 \\
&= 3 + 14i - 8 \\
&= -5 + 14i
\end{aligned}
```

**Conjugate.**Hayal gücünün işaretini çevir.

```math
\text{conjugate of } (a + bi) = a - bi
```

Karmaşık bir sayının ve onun eşleşmesinin ürünü her zaman gerçek olur:

```math
(a + bi)(a - bi) = a^2 + b^2
```

**Division.**Sayıcı ve adlendiricini adlendiricinin birleşikliği ile çarpın.

```math
\frac{a + bi}{c + di} = \frac{(a + bi)(c - di)}{c^2 + d^2}
```

Bu, isimlendiriciden hayali kısmı ortadan kaldırır ve size temiz karmaşık bir sayı verir.

### Karmaşık düzlem

Karmaşık düzlem her karmaşık sayıyı 2 boyutlu bir noktaya haritası yapar. Düz ekseni gerçek ekseni, dikey ekseni hayal ekseni.

```
z = 3 + 2i  corresponds to the point (3, 2)
z = -1 + 0i corresponds to the point (-1, 0) on the real axis
z = 0 + 4i  corresponds to the point (0, 4) on the imaginary axis
```

Karmaşık bir sayı aynı zamanda bir noktayı ve bir kaynağı olan vektördür. Bu çift yorumlama karmaşık sayıları jeometri için yararlı kılan şeydir.

### Kutup şekli

Düzende herhangi bir nokta, kökeninden uzaklığı ve pozitif gerçek eksiden açısı ile tanımlanabilir.

```math
\begin{aligned}
z &= r (\cos\theta + i \sin\theta) \\[4pt]
\text{where: } r &= |z| = \sqrt{a^2 + b^2} \quad \text{(magnitude, or modulus)} \\
\theta &= \mathop{\mathrm{atan2}}(b, a) \quad \text{(phase, or argument)}
\end{aligned}
```

Dörtgen şekli$(a + bi)$- Bu, eklemek için iyi.$(r, \theta)$çarpma için iyi.

**Multiplication in polar form.**Büyüklükleri çarpıp açıları ekleyin.

```math
\begin{aligned}
z_1 &= r_1 e^{i\theta_1} \\
z_2 &= r_2 e^{i\theta_2} \\[4pt]
z_1 z_2 &= (r_1 r_2) \, e^{i(\theta_1 + \theta_2)}
\end{aligned}
```

Bu yüzden karmaşık sayılar dönümler için mükemmel. 1 büyüklüğü ile karmaşık sayılarla çarpmak saf bir dönümdür.

### Euler'in formülü

Karmaşık eksponensal ve trigonometri arasındaki köprü:

```math
e^{i\theta} = \cos\theta + i \sin\theta
```

Bu dersin en önemli formülü.$\theta = \pi$- ...

```math
\begin{aligned}
e^{i\pi} &= \cos\pi + i \sin\pi = -1 + 0i = -1 \\[4pt]
\text{Therefore: } e^{i\pi} + 1 &= 0
\end{aligned}
```

Beş temel sabit ($e$- Evet .$i$- Evet .$\pi$, 1, 0) bir denklemde bağlantılıdır.

### Euler'ın formülü ML için neden önemlidir

Euler'in formülü bunu söylüyor.$e^{i\theta}$Birlik çemberini izler $\theta$değişir.$\theta = 0$- Sen de varsın .$(1, 0)$- Ne ?$\theta = \pi/2$- Sen de varsın .$(0, 1)$- Ne ?$\theta = \pi$- Sen de varsın .$(-1, 0)$- Ne ?$\theta = 3\pi/2$- Sen de varsın .$(0, -1)$Tam bir dönüşüm .$\theta = 2\pi$- Evet .

Bu karmaşık eksponensialler Dönüştürücüdür ve sinyal işleme ve ML'de her yerde dönüştür.

### 2D dönüşümlere bağlanmak

Karmaşık sayıyı çarpmak $(x + yi)$- ...$e^{i\theta}$nokta dönüyor $(x, y)$açı ile$\theta$- Kaynakın kaynağı.

```math
\begin{aligned}
&\text{Rotation via complex multiplication:} \\
&\quad (x + yi)(\cos\theta + i \sin\theta) = (x \cos\theta - y \sin\theta) + (x \sin\theta + y \cos\theta)i \\[8pt]
&\text{Rotation via matrix multiplication:} \\
&\quad \begin{bmatrix} \cos\theta & -\sin\theta \\ \sin\theta & \cos\theta \end{bmatrix} \begin{bmatrix} x \\ y \end{bmatrix} = \begin{bmatrix} x \cos\theta - y \sin\theta \\ x \sin\theta + y \cos\theta \end{bmatrix}
\end{aligned}
```

Bu iki metrekal bir dönüştürücü matrisin bir matris notasyonunda yazılmış karmaşık çarpma.

```mermaid
graph TD
    subgraph "Complex Multiplication = 2D Rotation"
        A["z = x + yi<br/>Point (x, y)"] -->|"multiply by e^(i*theta)"| B["z' = z * e^(i*theta)<br/>Point rotated by theta"]
    end
    subgraph "Equivalent Matrix Form"
        C["vector [x, y]"] -->|"multiply by rotation matrix"| D["[x cos theta - y sin theta,<br/> x sin theta + y cos theta]"]
    end
    B -.->|"same result"| D
```

### Fasorlar ve dönük sinyaller

Karmaşık bir eksponensal $e^{i\omega t}$birim döngüsünün etrafında açı frekansında dönen bir noktayı$\omega$- Nasıl ?$t$Artarsa nokta daireyi izler.

Bu dönüm noktasının gerçek kısmı $\cos(\omega t)$Hayal gücünün kısmı$\sin(\omega t)$Sinusoidal sinyal, dönen bir karmaşık sayının gölgesidir.

```math
\begin{aligned}
e^{i\omega t} &= \cos(\omega t) + i \sin(\omega t) \\[4pt]
\text{Real part: } & \cos(\omega t) \quad \text{-- a cosine wave} \\
\text{Imaginary part: } & \sin(\omega t) \quad \text{-- a sine wave}
\end{aligned}
```

Bu fazör temsilidir. Bir sinüs dalgasını izlemek yerine, düzgün bir şekilde dönen bir ok izlersiniz. Faz değişimleri açı bozuklukları haline gelir. Amplitude değişiklikleri büyüklük değişimleri haline gelir. Sinyal eklemesi vektör eklemesi haline gelir.

### Birliğin Temelleri

- Evet .$N$-Birliğin kökleri $N$Birlik dairesinde eşit mesafelerde bulunan noktalar:

```math
w_k = e^{2\pi i k/N} \quad \text{for } k = 0, 1, 2, \ldots, N-1
```

- Evet .$N = 4$, kökleri: $1, i, -1, -i$(dört pusula noktası).
- Evet .$N = 8$, dört pusula noktasını artı dört diyagonalı elde edersiniz.

Birlik kökleri Diskret Fourier Transform'un temelini oluşturur.$N$eşit derecede uzanan frekanslar.

### DFT'ye Bağlantı

Bir sinyalin Diskret Fourier dönüşümü$x[0], x[1], \ldots, x[N-1]$Bu:

```math
X[k] = \sum_{n=0}^{N-1} x[n] \, e^{-2\pi i k n/N}
```

Her biri .$X[k]$sinyalin  ile ne kadar ilişkili olduğunu ölçer.$k$-Birlik kökünün karmaşık bir sinusoidi.$k$DFT bir sinyal kırıyor .$N$Bu da, her bir fazörün genişliğini ve fazını gösterir.

### Neden ben hayali değilim?

"Hüse" kelimesi tarihsel bir kazadır.$i$Bu sayıların sayısı, negatif sayılardaki sayıların sayısı, negatif sayılardaki sayıların sayısı, negatif sayılardaki sayıların sayısı, negatif sayılardaki sayıların sayısı, negatif sayılardaki sayıların sayısı, negatif sayılardaki sayıların sayısı, negatif sayılardaki sayıların sayısı, negatif sayılardaki sayıların sayısı, negatif sayılardaki sayıların sayısı, negatif sayılardaki sayıların sayısı, negatif sayılardaki sayıların sayısı, negatif sayılardaki sayıların sayısı, negatif sayılardaki sayıların sayısı, negatif sayılardaki sayıların sayısı, negatif sayılardaki sayıların sayısı, negatif sayılardaki sayıların sayısı, negatif sayılardaki sayıların sayısı, negatif sayılardaki sayıların sayısı, negatif sayılardaki sayıların sayısı, negatif sayılardaki sayıların sayısı, negatif sayılardaki sayıların sayısı, negatif sayılardaki sayıların sayısı, negatif sayılardaki sayıların sayısı, negatif sayılardaki sayıların sayısı, negatif sayılardaki sayıların sayısı, negatif sayılardaki sayıların sayısı, negatif sayılardaki sayıların sayısı, negatif sayılardaki sayıların sayısı, negatif sayılardaki sayıların sayısı, yani negatif sayılardaki sayıların sayısı, negatif sayılardaki sayıların sayısı, negatif sayılardaki sayıların sayısı, yani, negatif sayılardaki sayıların sayısı, negatif sayılardaki sayıların sayısı, yani, negatif sayılardaki sayıların sayısı, sayılardaki sayıların sayısı, sayılardaki sayıların sayısı, sayılardaki sayıların sayısı, sayılardaki sayıların sayısı, sayılardaki sayıların sayısı, sayılardaki sayıların sayısı, sayılardaki sayıların sayısı, sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki sayılardaki

Daha faydalı: $i$90 derecelik bir dönüm operatörü.$i$Bir kere, 90 dereceye denk silkeleyerek çarpın.$i$Yine ($i^2$Bu yüzden, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde, bu yönde,$i^2 = -1$Bu gizemli değil. İki çeyrek dönüşten inşa edilen bir yarı dönüş.

Bu yüzden mühendislikte karmaşık sayılar her yerde var. Dönen her şey - elektromanyetik dalgalar, kuantum durumları, sinyal titreşimleri, konum kodlamaları - doğal olarak karmaşık sayılarla tanımlanır.

### Karmaşık eksponensaller vs. trigonometrik fonksiyonlar

Euler'ın formülü öncesinde mühendisler sinyalleri şöyle yazıyordu:$A \cos(\omega t + \phi)$-- amplitud$A$, frekans $\omega$, aşama$\phi$Bu işe yarıyor ama aritmetik ağrılı hale getiriyor.

Karmaşık eksponensiallerle aynı sinyal $A e^{i(\omega t + \phi)}$İki sinyal eklemek sadece iki karmaşık sayıyı eklemek demektir. Karşılaştırmak (modülasyon) sadece büyüklükleri çarpmak ve açıları eklemek demektir. Faz değişikliği açı eklemelerine dönüşür. Frekans değişikliği fazörlerle çarpımlara dönüşür.

Tüm sinyal işleme alanı karmaşık eksponensel notasyona geçmiştir çünkü matematik daha temizdir. "gerçek sinyal" her zaman karmaşık temsilin gerçek bir parçasıdır. Hayali kısım da hesaplama olarak taşınır ve tüm cebir doğal olarak çalışır.

### Transformatörlere bağlama

**Sinusoidal positional encodings**(Orijinal Transformer kağıdı):

```math
\begin{aligned}
PE(pos, 2i) &= \sin\left(pos / 10000^{2i/d}\right) \\
PE(pos, 2i+1) &= \cos\left(pos / 10000^{2i/d}\right)
\end{aligned}
```

Günah ve cos çiftleri, karmaşık eksponensallerin gerçek ve hayalsel parçalarıdır. Her frekans kodlama pozisyonu için farklı bir " çözünürlük " sağlar. Düşük frekanslar yavaşça (kaşlı pozisyon) değişir. Yüksek frekanslar hızlıca (sık pozisyon) değişir. Birlikte her pozisyonu benzersiz bir frekans parmak izi verirler.

**RoPE (Rotary Position Embedding)**Bu, sorgu ve anahtar vektörlerini karmaşık döngü matrisleri ile açıkça çoğaltır. İki simge arasındaki göreceli konum bir döngü açısına dönüşür. Dikkat bu döngü vektörleri kullanarak hesaplanır.

| Operation | Algebraic Form | Geometric Meaning |
|-----------|---------------|-------------------|
| Addition | $(a+c) + (b+d)i$ | Vector addition in the plane |
| Multiplication | $(ac-bd) + (ad+bc)i$ | Rotate and scale |
| Conjugate | $a - bi$ | Reflect over real axis |
| Magnitude | $\sqrt{a^2 + b^2}$ | Distance from origin |
| Phase | $\mathop{\mathrm{atan2}}(b, a)$ | Angle from positive real axis |
| Division | multiply by conjugate | Reverse rotation and rescale |
| Power | $r^n e^{in\theta}$ | Rotate $n$ times, scale by $r^n$ |

```mermaid
graph LR
    subgraph "Unit Circle"
        direction TB
        U1["e^(i*0) = 1"] -.-> U2["e^(i*pi/2) = i"]
        U2 -.-> U3["e^(i*pi) = -1"]
        U3 -.-> U4["e^(i*3pi/2) = -i"]
        U4 -.-> U1
    end
    subgraph "Applications"
        A1["Euler's formula:<br/>e^(i*theta) = cos + i*sin"]
        A2["DFT uses roots of unity:<br/>e^(2*pi*i*k/N)"]
        A3["RoPE uses rotation:<br/>q * e^(i*m*theta)"]
    end
    U1 --> A1
    U1 --> A2
    U1 --> A3
```

```figure
roots-of-unity
```

## Yapın

### Adım 1: Karmaşık sınıf

Dörtgen ve kutup şekiller arasındaki aritmetik, büyüklük, faz ve dönüşümü destekleyen karmaşık bir sayı sınıfı oluşturun.

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

### Adım 2: Kutup dönüşümü ve Euler formülü

```python
def to_polar(z):
    return z.magnitude(), z.phase()

def from_polar(r, theta):
    return Complex(r * math.cos(theta), r * math.sin(theta))

def euler(theta):
    return Complex(math.cos(theta), math.sin(theta))
```

Kontrol edin:`euler(theta).magnitude()`Her zaman 1.0 olmalı.`euler(0)`vermesi gerekir (1, 0). `euler(pi)`(-1, 0) vermeli.

### Adım 3: Dönüşüm

Bir noktayı döndürmek$(x, y)$açı ile$\theta$bir karmaşık çarpma:

```python
point = Complex(3, 4)
rotated = point * euler(math.pi / 4)
```

Büyüklük aynı kalır. Sadece açı değişir.

### Adım 4: Karmaşık aritmetikten DFT

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

Bu da $O(N^2)$DFT. Her çıkış $X[k]$sinyal örneklerinin toplamı, birlik kökleriyle çarpılır.

### Adım 5: Ters DFT

Ters DFT, orijinal sinyali spektrumundan yeniden oluşturur. Ön DFT'den gelen tek değişiklikler: işaretini katılamada çevir ve böl $N$- Evet .

```python
def idft(spectrum):
    N = len(spectrum)
    result = []
    for n in range(N):
        total = Complex(0, 0)
        for k in range(N):
            angle = 2 * math.pi * k * n / N
            total = total + spectrum[k] * euler(angle)
        result.append(Complex(total.real / N, total.imag / N))
    return result
```

Bu size mükemmel bir yeniden yapılandırma sağlar. DFT uygulayın, sonra IDFT, ve orijinal sinyal makine hassaslığına geri gelir. Hiçbir bilgi kaybolmaz.

### 6 . Adım: Birliğin Temelleri

```python
def roots_of_unity(N):
    return [euler(2 * math.pi * k / N) for k in range(N)]
```

İki özellik doğrulanıyor:
- Her kökenin büyüklüğü tam olarak 1'dir.
- Hepsinin toplamı$N$kökler sıfırdır (simetri ile ortadan kaldırılırlar).

Bu özellikler DFT'yi dönüştürülebilir yapanlardır. Birlik kökleri frekans alanı için ortogonal bir temel oluşturur.

## Kullan

Python'da karmaşık sayı desteği yer alıyor.`j`Hayal birimi temsil eder.

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

Arraylar için, numpy karmaşık sayıları doğuştan ele alır:

```python
import numpy as np

z = np.array([1+2j, 3+4j, 5+6j])
print(np.abs(z))
print(np.angle(z))
print(np.conj(z))
print(np.real(z))
print(np.imag(z))

signal = np.sin(2 * np.pi * 5 * np.linspace(0, 1, 128))
spectrum = np.fft.fft(signal)
freqs = np.fft.fftfreq(128, d=1/128)
```

## Gönder

Çık .`code/complex_numbers.py`veya `npx tsx code/complex_numbers.ts`üretmek için`outputs/skill-complex-arithmetic.md`- Evet .

## Egzersizler

1. **Complex arithmetic by hand.**Hesaplama$(2 + 3i)(4 - i)$Sonra hesaplayın.$(5 + 2i) / (1 - 3i)$. Her iki sonucu da karmaşık düzlemde çiz ve çarpımın ilk sayıyı döndüğünü ve ölçeklendirdiğini kontrol et.

2. **Rotation sequence.**Önemli noktayla başla.$(1, 0)$- Karşılıklı çarpım$e^{i\pi/6}$12 kez.$(1, 0)$12 çarpımdan sonra, her adımda koordinatları yazdır ve düzenli bir 12gon izlemelerini onayla.

3. **DFT of a known signal.**Bir sinyal oluştur ki $\sin(2\pi \cdot 3t)$ve $0.5 \sin(2\pi \cdot 7t)$Büyüklük spektrumun 3 ve 7 frekanslarında zirveye sahip olduğunu kontrol edin. 7'deki zirve 3'teki zirvenin yüksekliğinin yarısını içerir.

4. **Roots of unity visualization.**Birliğin 8. kökü hesaplayın. Onların sıfıra kadar toplamını kontrol edin.$e^{2\pi i/8}$Bir sonraki kök verir.

5. **Rotation matrix equivalence.**10 rastgele açı ve 10 rastgele nokta için, karmaşık çarpımın 2x2 döngü matrisinde matris-vektor çarpımı ile aynı sonucu verdiğini kontrol edin.

### İpuçlar

**Exercise 1.**Ürünü genişletmek için $i^2 = -1$, sonra üst ve altını eşleşik ile çarparak bölünür .$1 + 3i$Ürünü kontrol edin .`Complex(2, 3) * Complex(4, -1)`: onun `magnitude()`İki büyüklüğün ürünü olmalıdır ve onun `phase()`iki aşamanın toplamına eşit olmalıdır.

**Exercise 2.**İşe devam et .`euler(math.pi / 6)`Bu sayede, bu değerin en yüksek seviyesinin 1'de kalıp en yüksek seviyesinin 30 derece büyüdüğünü kontrol etmeniz gerekir.

**Exercise 3.**Zaman noktalarını  ile yazın .$t = n/32$Ve aramak .`dft`Sadece 0 ila 15 arası kutulara bak, çünkü üst yarısı aynalı bir görüntü.$k$Amplitude sinüs için$A$- Evet .$AN/2$Bin 3'de 16'nin ve Bin 7'de 8'in olacağını bekle.

**Exercise 4.**Arama .`roots_of_unity(8)`Ve kökleri ekleyin: toplamın büyüklüğü 0'ya yakın olmalıdır. Her kökü önceki kökle bölün ve her sonuç eşit olup olmadığını kontrol edin.`euler(2 * math.pi / 8)`- Evet .

**Exercise 5.**Dönüş matrisi [[cos t, -sin t], [sin t, cos t]]. Her açı ve nokta için hesaplayın `euler(t) * Complex(x, y)`ve matris ürünü, sonra en büyük mutlak farkı kaydet.$10^{-15}$- Evet .

## Anahtar Terimler

| Term | What it means |
|------|---------------|
| Complex number | A number $a + bi$ where $a$ is the real part, $b$ is the imaginary part, and $i^2 = -1$ |
| Imaginary unit | The number $i$, defined by $i^2 = -1$. Not imaginary in the philosophical sense -- it is a rotation operator |
| Complex plane | The 2D plane where the x-axis is real and the y-axis is imaginary. Also called the Argand plane |
| Magnitude (modulus) | The distance from the origin: $\sqrt{a^2 + b^2}$. Written as $\lvert z \rvert$ |
| Phase (argument) | The angle from the positive real axis: $\mathop{\mathrm{atan2}}(b, a)$. Written as $\arg(z)$ |
| Conjugate | The mirror image across the real axis: conjugate of $a + bi$ is $a - bi$ |
| Polar form | Expressing $z$ as $r e^{i\theta}$ instead of $a + bi$. Makes multiplication easy |
| Euler's formula | $e^{i\theta} = \cos\theta + i \sin\theta$. Connects exponentials to trigonometry |
| Phasor | A rotating complex number $e^{i\omega t}$ representing a sinusoidal signal |
| Roots of unity | The $N$ complex numbers $e^{2\pi i k/N}$ for $k = 0$ to $N-1$. $N$ equally spaced points on the unit circle |
| DFT | Discrete Fourier Transform. Decomposes a signal into complex sinusoidal components using roots of unity |
| RoPE | Rotary Position Embedding. Uses complex multiplication to encode relative position in transformer attention |

## Daha Fazla Okumak

- [Visual Introduction to Euler's Formula](https://betterexplained.com/articles/intuitive-understanding-of-eulers-formula/)- ağır notasyon olmadan geometrik algı oluşturur
- [Su et al.: RoFormer (2021)](https://arxiv.org/abs/2104.09864)- karmaşık dönümleri kullanarak Rotary Position Embedding'i tanıtan kağıt
- [Vaswani et al.: Attention Is All You Need (2017)](https://arxiv.org/abs/1706.03762)- Sinusoidal pozisyon kodlamaları olan orijinal Transformer kağıdı
- [3Blue1Brown: Euler's formula with introductory group theory](https://www.youtube.com/watch?v=mvmuCPvRoWQ)- nedenini görsel açıklama$e^{i\pi} = -1$
- [Needham: Visual Complex Analysis](https://global.oup.com/academic/product/visual-complex-analysis-9780198534464)- karmaşık sayılar için en iyi görsel tedavi, geometrik anlayışla dolu
- [Strang: Introduction to Linear Algebra, Ch. 10](https://math.mit.edu/~gs/linearalgebra/)- Düzsel cebir ve öz değerler bağlamında karmaşık sayılar
