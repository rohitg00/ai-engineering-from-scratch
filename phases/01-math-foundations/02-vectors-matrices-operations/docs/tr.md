# Vektörler, Matrisler ve İşlemler

> Her neural network, ekstra adımlarla yalnızca matris çarpımından oluşur.

**Tür:** Yapım
**Diller:** Python, Julia
**Önkoşullar:** Aşama 1, Ders 01 (Doğrusal Cebir Sezgisi)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Öğe bazında işlemler, matris çarpımı, devrik, determinant ve ters işlemleri içeren bir Matrix sınıfı oluşturun
- Eleman bazında çarpma işlemini matris çarpımından ayırın ve her birinin ne zaman geçerli olduğunu açıklayın
- Yalnızca sıfırdan Matrix sınıfını kullanarak tek bir yoğun neural network katmanı (`relu(W @ x + b)`) uygulayın
- neural network framework'lerde yayın kurallarını ve önyargı eklemenin nasıl çalıştığını açıklayın

## Sorun

Bir neural network oluşturmak istiyorsunuz. Kodu okuyup şunu görüyorsunuz:

```
output = activation(weights @ input + bias)
```

Bu `@` matris çarpımıdır. `weights` bir matristir. `input` bir vektördür. Eğer bu işlemlerin ne işe yaradığını bilmiyorsanız bu satır sihirlidir. Biliyorsanız, bir katmanın üç işlemdeki ileri geçişinin tamamıdır.

Modelinizin işlediği her görüntü bir piksel değerleri matrisidir. Her embedding kelimesi bir vektördür. Her neural network'nin her katmanı bir matris dönüşümüdür. Değişkenleri anlamadan kod yazamayacağınız gibi, matris işlemlerinde akıcı olmadan da yapay zeka sistemleri oluşturamazsınız.

Bu ders akıcılığı sıfırdan inşa eder.

## Konsept

### Vektörler: sıralı sayı listeleri

Bir vektör, yönü ve büyüklüğü olan sayıların bir listesidir. Yapay zekada vektörler veri noktalarını, özellikleri veya parametreleri temsil eder.

```
v = [3, 4]        -- a 2D vector
w = [1, 0, -2]    -- a 3D vector
```

2 boyutlu bir `[3, 4]` vektörü, bir düzlemdeki koordinatlara (3, 4) işaret eder. Uzunluğu (büyüklüğü) 5'tir (3-4-5 üçgeni).

### Matrisler: sayı tabloları

Matris 2 boyutlu bir ızgaradır. Satırlar ve sütunlar. Bir m x n matrisinin m satırı ve n sütunu vardır.

```
A = | 1  2  3 |     -- 2x3 matrix (2 rows, 3 columns)
    | 4  5  6 |
```

neural network'lerde ağırlık matrisleri giriş vektörlerini çıkış vektörlerine dönüştürür. 784 girişi ve 128 çıkışı olan bir katman, 128x784 ağırlık matrisini kullanır.

### Şekiller neden önemlidir?

Matris çarpımının katı bir kuralı vardır: `(m x n) @ (n x p) = (m x p)`. İç boyutlar eşleşmelidir.

```
(128 x 784) @ (784 x 1) = (128 x 1)
  weights       input       output

Inner dimensions: 784 = 784  -- valid
```

PyTorch'ta şekil uyuşmazlığı hatası alıyorsanız nedeni budur.

### Operasyon haritası

| Operasyon | Ne işe yarar | Neural network kullanımı |
|-----------|-------------|-------------------|
| İlave | Element bazında birleştirme | Çıktıya önyargı ekleme |
| Skaler çarpım | Her öğeyi ölçeklendirin | Öğrenme oranı * gradients |
| Matris çarpımı | Vektörleri dönüştürün | Katman ileri geçiş |
| Transpoze | Satırları ve sütunları çevir | Backpropagation |
| Belirleyici | Tek numara özeti | Tersine çevrilebilirliğin kontrol edilmesi |
| Ters | Dönüşümü geri alma | Doğrusal sistemleri çözme |
| Kimlik | Hiçbir şey yapmama matrisi | Başlatma, artık bağlantılar |

### Eleman bazında matris çarpımına karşı

Bu ayrım yeni başlayanları sürekli şaşırtıyor.

Öğe bazında: eşleşen konumları çarpın. Her iki matris de aynı şekilde olmalıdır.

```
| 1  2 |   | 5  6 |   | 5  12 |
| 3  4 | * | 7  8 | = | 21 32 |
```

Matris çarpımı: satır ve sütunların nokta çarpımı. İç boyutlar eşleşmelidir.

```
| 1  2 |   | 5  6 |   | 1*5+2*7  1*6+2*8 |   | 19  22 |
| 3  4 | @ | 7  8 | = | 3*5+4*7  3*6+4*8 | = | 43  50 |
```

Farklı işlemler, farklı sonuçlar, farklı kurallar.

### Yayıncılık

Bir çıktı matrisine önyargı vektörü eklediğinizde şekiller eşleşmez. Yayın, daha küçük diziyi sığacak şekilde genişletir.

```
| 1  2  3 |   +   [10, 20, 30]
| 4  5  6 |

Broadcasting stretches the vector across rows:

| 1  2  3 |   | 10  20  30 |   | 11  22  33 |
| 4  5  6 | + | 10  20  30 | = | 14  25  36 |
```

Her modern framework bunu otomatik olarak yapar. Bunu anlamak, şekiller yanlış göründüğü halde kod çalıştığında kafa karışıklığını önler.

```figure
vector-projection
```

## Derin Matematik: Bir Matris Neden Dönüşümdür?

Bir matrisi yalnızca sayı tablosu olarak okumak, işlemi yapmayı öğretir fakat neden
çalıştığını açıklamaz. \(A\in\mathbb{R}^{m\times n}\) matrisi aslında
\(\mathbb{R}^n\) uzayındaki bir vektörü \(\mathbb{R}^m\) uzayına taşıyan doğrusal
bir fonksiyondur:

\[
T_A(x)=Ax.
\]

“Doğrusal” sözcüğünün kesin anlamı iki koşuldur:

\[
T_A(x+y)=T_A(x)+T_A(y), \qquad T_A(cx)=cT_A(x).
\]

Bu iki eşitlik, dönüşümün toplama ve ölçekleme yapısını koruduğunu söyler. Bu
yüzden \(x=x_1e_1+\cdots+x_ne_n\) biçimindeki her vektör için yalnızca baz
vektörlerinin nereye gittiğini bilmek yeterlidir:

\[
Ax=x_1Ae_1+\cdots+x_nAe_n.
\]

Burada \(Ae_j\), \(A\)'nın \(j\). sütunudur. Başka bir deyişle matrisin sütunları,
girdi uzayının baz yönlerinin çıktı uzayında nereye taşındığını kaydeder. Bu,
matris çarpımını ezberlenen satır-sütun kuralından çıkarıp geometrik bir
mekanizmaya dönüştürür.

### Çarpımı iki farklı ama eşdeğer biçimde okuyun

\[
A=
\begin{bmatrix}
2&-1\\
1&3
\end{bmatrix},
\qquad
x=
\begin{bmatrix}
4\\2
\end{bmatrix}.
\]

Satır bakışı, her çıktı koordinatını bir iç çarpım olarak verir:

\[
Ax=
\begin{bmatrix}
(2,-1)\cdot(4,2)\\
(1,3)\cdot(4,2)
\end{bmatrix}
=
\begin{bmatrix}
6\\10
\end{bmatrix}.
\]

Sütun bakışı ise aynı sonucu dönüşmüş bazların birleşimi olarak üretir:

\[
Ax=4
\begin{bmatrix}2\\1\end{bmatrix}
+2
\begin{bmatrix}-1\\3\end{bmatrix}
=
\begin{bmatrix}6\\10\end{bmatrix}.
\]

İlk okuma bir nöronun “girdiye ne kadar uyduğunu”, ikinci okuma ise çıktının
hangi öğrenilmiş yönlerden kurulduğunu gösterir. İkisini de kullanabilmek,
attention projeksiyonlarını ve embedding katmanlarını yorumlarken önemlidir.

### Determinant ve tersin profesyonel yorumu

İki boyutta \(|\det A|\), dönüşümden sonra birim karenin alanıdır. İşaret,
yönelimin korunup korunmadığını; sıfır değeri ise en az bir boyutun çöktüğünü
gösterir. \(\det A=0\) olduğunda farklı girdiler aynı çıktıya gidebilir. Bilgi
kaybolduğu için tek bir \(A^{-1}\) dönüşümüyle girdiyi geri kazanmak imkânsızdır.

Uygulamada “determinant sıfır değilse sorun yok” demek yeterli değildir.
Determinant sıfıra çok yakınsa veya en büyük ve en küçük tekil değerlerin oranı
çok büyükse matris kötü koşulludur. Küçük ölçüm hataları çözümde büyüyebilir.
Bu nedenle üretim kodunda açıkça ters almak yerine çoğunlukla `solve`, QR ya da
SVD tabanlı çözücüler tercih edilir.

### Sinir ağı bağlantısı: \(Wx+b\)

\(W\), öğrenilmiş doğrusal dönüşümdür; \(b\), dönüşümün orijinden geçme
zorunluluğunu kaldıran ötelemedir. Bir etkinleştirme fonksiyonu olmadan ardışık
iki katman yine tek bir afin dönüşüme indirgenir:

\[
W_2(W_1x+b_1)+b_2=(W_2W_1)x+(W_2b_1+b_2).
\]

Bu türetim, derin ağların neden ReLU, GELU veya sigmoid gibi doğrusal olmayan
işlevlere ihtiyaç duyduğunu kesin olarak açıklar: doğrusal olmayanlık yoksa
katman sayısı artsa bile temsil gücü artmaz.

### Anlama kontrolü

1. \(A\) matrisi \(3\times5\), \(x\) vektörü \(5\times1\) ise sonuç neden
   \(3\times1\)'dir? Yanıtı hem satır hem sütun bakışıyla açıklayın.
2. \(W_2W_1\) ile \(W_1W_2\)'nin genellikle neden farklı olduğunu, dönüşümlerin
   uygulanma sırasına bağlayın.
3. Bir ağırlık matrisinin iki sütunu aynıysa hangi giriş bilgisinin ayırt
   edilemeyeceğini gösteren iki farklı vektör bulun.

## İnşa Et

### Adım 1: Vektör sınıfı

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

### Adım 2: Temel işlemlerle matris sınıfı

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

### 3. Adım: İşe yaradığını görün

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

### Adım 4: neural network'lere bağlanın

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

Bu tek bir yoğun katmandır: `output = relu(W @ x + b)`. Her neural network'deki her yoğun katman tam olarak bunu yapar.

## Kullan onu

NumPy yukarıdaki her şeyi daha az satırda ve çok daha hızlı bir şekilde yapar.

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

Python'daki `@` operatörü `__matmul__`'yi çağırır. NumPy bunu C ve Fortran'da yazılmış optimize edilmiş BLAS rutinleriyle uygular. Aynı matematik, 100 kat daha hızlı.

NumPy'de yayın yapmak:

```python
matrix = np.array([[1, 2, 3], [4, 5, 6]])
bias = np.array([10, 20, 30])
print(matrix + bias)
```

NumPy, 1 boyutlu önyargıyı her iki satıra da otomatik olarak yayınlar. Her neural network framework'de önyargı ekleme bu şekilde çalışır.

## Gönderin

Bu ders, matris işlemlerini geometrik sezgi yoluyla öğretmek için bir prompt üretir. Bkz. `outputs/prompt-matrix-operations.md`.

Burada oluşturulan Matrix sınıfı, Aşama 3, Ders 10'da oluşturduğumuz mini neural network framework'nin temelini oluşturur.

## Egzersizler

1. **Tersini doğrulayın.** `A @ A.inverse_2x2()`'yi çarpın ve birim matrisi elde ettiğinizi onaylayın. Üç farklı 2x2 matrisle deneyin. Determinant sıfır olduğunda ne olur?

2. **3x3 tersini uygulayın.** Adjugate yöntemini kullanarak 3x3 matrislerin terslerini hesaplamak için Matrix sınıfını genişletin. NumPy'nin `np.linalg.inv`'sine karşı test edin.

3. **İki katmanlı bir ağ oluşturun.** Yalnızca Matrix sınıfınızı kullanarak (NumPy yok), iki katmanlı bir neural network oluşturun: giriş (3) -> gizli (4) -> çıkış (2). Rastgele ağırlıkları başlatın, ileri bir geçiş yapın ve tüm şekillerin doğru olduğunu doğrulayın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|----------------------|
| vektör | "Bir ok" | Sıralı bir sayı listesi. Yapay zekada: yüksek boyutlu uzayda bir nokta. |
| Matris | "Sayılardan oluşan bir tablo" | Doğrusal bir dönüşüm. Vektörleri bir uzaydan diğerine eşler. |
| Matris çarpımı | "Sadece sayıları çarpın" | Birinci matrisin her satırı ile ikincinin her sütunu arasındaki nokta çarpımlar. Sipariş önemlidir. |
| Transpoze | "Çevir" | Satırları ve sütunları değiştirin. Bir m x n matrisini n x m'ye dönüştürür. backpropagation'de kritik. |
| Belirleyici | "Matristeki bazı sayılar" | Matrisin alanı (2B) veya hacmi (3B) ne kadar ölçeklendirdiğini ölçer. Sıfır, dönüşümün bir boyutu ezdiği anlamına gelir. |
| Ters | "Matrisi geri al" | Dönüşümü tersine çeviren matris. Yalnızca determinant sıfır olmadığında mevcuttur. |
| Kimlik matrisi | "Sıkıcı matris" | 1 ile çarpmanın matris eşdeğeri. Artık bağlantılarda (ResNets) kullanılır. |
| Yayıncılık | "Sihirli şekil sabitleme" | Eksik boyutlar boyunca tekrarlanarak daha küçük bir diziyi daha büyük bir diziyle eşleşecek şekilde genişletmek. |
| Öğe bazında | "Düzenli çarpma" | Eşleşen konumları çarpın. Her iki dizinin de aynı şekle sahip olması (veya yayınlanabilir olması) gerekir. |

## Daha Fazla Okuma

- [3Blue1Brown: Doğrusal Cebirin Özü](https://www.3blue1brown.com/topics/linear-algebra) - burada ele alınan her işlem için görsel sezgi
- [Yayınla ilgili NumPy belgeleri](https://numpy.org/doc/stable/user/basics.broadcasting.html) - NumPy'nin izlediği kesin kurallar
- [Stanford CS229 Doğrusal Cebir İncelemesi](http://cs229.stanford.edu/section/cs229-linalg.pdf) - Makine öğrenimine özgü doğrusal cebir için kısa referans
