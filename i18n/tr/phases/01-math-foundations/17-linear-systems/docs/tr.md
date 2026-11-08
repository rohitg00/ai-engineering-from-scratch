# Düzsel Sistemler

> Çözüm$Ax = b$Matematikte hâlâ sinir ağınızı çalıştıran en eski problem.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 01 (Linear Algebra Intuition), 02 (Vectors & Matrices), 03 (Matrix Transformations)
**Time:** ~120 minutes

## Öğrenme Hedefleri

- Çözüm$Ax = b$kısmi dönme ve geri dönüşle Gaussian ortadan kaldırımı kullanılarak
- LU, QR ve Cholesky parçalanmaları ile faktör matrisleri ve her biri ne zaman uygun olduğunu açıklayın
- En az kare için normal denklemleri çıkarın ve onları doğrusal ve kıyıs geri dönüşüne bağlayın
- Durum numarasını kullanarak kötü koşullu sistemleri teşhis edin ve onları istikrarlandırmak için düzenleme uygulayın

## Sorun

Her zaman bir çizgi gerilemeyi eğitirseniz, bir çizgi sistemi çözersiniz. En az kare uygunluğu hesapladığınızda, bir çizgi sistemi çözersiniz.`y = Wx + b`Bu, bir çizgi sistemin bir tarafını değerlendirmek. düzenleme eklediğinizde, sistemini değiştirirsiniz. Gaussian süreçlerini kullandığınızda, bir matrisi katkı yaparsınız.

- Denge .$Ax = b$Her yerde göründü.$A$bilinen katılımcıların bir matrisi. $b$bilinen çıkışların vektörüdür. $x$- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -$A$veri matrisiniz,$b$hedef vektörünüz ve $x$Tüm model aşağıya düşer: bul $x$Bu kadar .$Ax$en yakın $b$- Mümkün olduğunca.

Bu ders, bu denklemin sıfırdan çözülmesinin tüm önemli yöntemlerini oluşturur. Bazı yöntemlerin neden hızlı, diğerlerinin neden istikrarlı olduğunu, neden bazılarının sadece kare sistemler için çalışmasının ve diğerlerinin aşırı belirlenmiş sistemleri yönetmesinin neden olduğunu ve neden cevaplarınızın herhangi bir anlamı olup olmadığını matrisinizin koşul sayısı belirler.

## Anlaşım

### Ax = b'nin geometrik anlamı

Bir doğrusal denklem sistemi bir jeometrik yorumuna sahiptir. Her denklem bir hiper düzlem tanımlar. Çözüm tüm hiper düzlemlerin kesiştiği nokta (veya nokta kümesi) dır.

```
2x + y = 5          Two lines in 2D.
x - y  = 1          They intersect at x=2, y=1.
```

```mermaid
graph LR
    A["2x + y = 5"] --- S["Solution: (2, 1)"]
    B["x - y = 1"] --- S
```

Üç şey olabilir:

```mermaid
graph TD
    subgraph "One Solution"
        A1["Lines intersect at a single point"]
    end
    subgraph "No Solution"
        A2["Lines are parallel — no intersection"]
    end
    subgraph "Infinite Solutions"
        A3["Lines are identical — every point is a solution"]
    end
```

Matris biçiminde "tek çözüm" anlamı $A$"Hiçbir çözüm yok" sistemin tutarlı olmadığı anlamına gelir. "Sönümez çözümler"$A$ML sorunlarının çoğu "tam çözüm yok" kategorisine girer çünkü bilinmeyenlerden (parametrlerden) daha fazla denklem ( veri noktası) vardır.

### Sütun resmi vs. satır resmi

Okumanın iki yolu var .$Ax = b$- Evet .

**Row picture.**Her satır $A$Bu da bir denklemin bir çözümü. her denklem bir hiper düzlemdir.

**Column picture.**$A$Soru şu oluyor:  sütunlarının hangi doğrusal kombinasyonu$A$üretir $b$- Ne ?

```
A = | 2  1 |    b = | 5 |
    | 1 -1 |        | 1 |

Row picture: solve 2x + y = 5 and x - y = 1 simultaneously.

Column picture: find x1, x2 such that:
  x1 * [2, 1] + x2 * [1, -1] = [5, 1]
  2 * [2, 1] + 1 * [1, -1] = [4+1, 2-1] = [5, 1]   check.
```

Sütun resmi daha temel.$b$ sütun alanında yer alır$A$Eğer bu sistemde bir çözüm varsa,$b$Bu nokta en yakın nokta en az kare çözümüdür.

### Gaussian ortadan kaldırılması

Gaussian eliminasyonu dönüştürür.$Ax = b$Üst üçgenli bir sisteme.$Ux = c$Bu en doğrudan yöntemdir.

Algoritm:

```
1. For each column k (the pivot column):
   a. Find the largest entry in column k at or below row k (partial pivoting).
   b. Swap that row with row k.
   c. For each row i below k:
      - Compute multiplier m = A[i][k] / A[k][k]
      - Subtract m times row k from row i.
2. Back substitute: solve from the last equation upward.
```

Örnek:

```
Original:
| 2  1  1 | 8 |       R2 = R2 - (2)R1     | 2  1   1 |  8 |
| 4  3  3 |20 |  -->  R3 = R3 - (1)R1 --> | 0  1   1 |  4 |
| 2  3  1 |12 |                            | 0  2   0 |  4 |

                       R3 = R3 - (2)R2     | 2  1   1 |  8 |
                                       --> | 0  1   1 |  4 |
                                           | 0  0  -2 | -4 |

Back substitute:
  -2 * x3 = -4    -->  x3 = 2
  x2 + 2  = 4     -->  x2 = 2
  2*x1 + 2 + 2 = 8 --> x1 = 2
```

Gaussian ortadan kaldırma maliyetleri $O(n^3)$Operasyonlar.$1000 \times 1000$Bu bir milyar adet yüzen nokta işlemidir.$A$- Evet .

### Bölümsel dönüşüm: neden önemli

Eğer bir pivot elementi sıfırsa, sıfırla bölünürsünüz. Küçükse, yuvarlama hatalarını artırırsınız.

```
Bad pivot:                       With partial pivoting:
| 0.001  1 | 1.001 |            Swap rows first:
| 1      1 | 2     |            | 1      1 | 2     |
                                 | 0.001  1 | 1.001 |
m = 1/0.001 = 1000              m = 0.001/1 = 0.001
R2 = R2 - 1000*R1               R2 = R2 - 0.001*R1
| 0.001  1     | 1.001   |      | 1      1     | 2     |
| 0     -999   | -999.0  |      | 0      0.999 | 0.999 |

x2 = 1.000 (correct)            x2 = 1.000 (correct)
x1 = (1.001 - 1)/0.001          x1 = (2 - 1)/1 = 1.000 (correct)
   = 0.001/0.001 = 1.000        Stable because the multiplier is small.
```

Sınırlı hassasiyetle yüzen nokta aritmetikinde, çekilmemiş versiyon önemli rakamları kaybedebilir.

### LU parçalanması

LU parçalanma faktörleri $A$Alt üçgenli bir matrise dönüştü .$L$ve üst üçgenli bir matris $U$- Evet .$A = LU$- Ne ?$L$Matrix Gaussian ortadan kaldırma çarpımlarını depolar.$U$Matrix, ortadan kaldırma sonucu.

```
A = L @ U

| 2  1  1 |   | 1  0  0 |   | 2  1   1 |
| 4  3  3 | = | 2  1  0 | @ | 0  1   1 |
| 2  3  1 |   | 1  2  1 |   | 0  0  -2 |
```

Neden sadece ortadan kaldırmak yerine faktör?$L$ve $U$, çözme $Ax = b$Yeni bir şey için .$b$Sadece maliyetler $O(n^2)$- ...

```math
\begin{aligned}
Ax &= b \\
LUx &= b \\
&\text{Let } y = Ux\text{:} \\
Ly &= b \quad \text{(forward substitution, } O(n^2)\text{)} \\
Ux &= y \quad \text{(back substitution, } O(n^2)\text{)}
\end{aligned}
```

- Evet .$O(n^3)$Bu işlemler, bir kere faktörleşme sırasında ödenir.$O(n^2)$Eğer 1000 tane sistemi aynı şekilde çözmek istiyorsan$A$Ama farklı .$b$vectörler, LU toplam iş için 1000/3 bir faktör tasarruf eder.

Bölümsel dönüşümle, elde edebilirsiniz.$PA = LU$nerede$P$Satır değişimlerini kaydeden bir permutasyon matrisi.

### QR parçalanması

QR parçalanma faktörleri $A$Ortogonal bir matrise dönüştürülür.$Q$ve üst üçgenli bir matris $R$- Evet .$A = QR$- Evet .

Ortogonal bir matrisin özelliği vardır .$Q^T Q = I$Sütunları ortonom vektörlerdir.$Q$Uzunluk ve açıları korur.

```
A = Q @ R

Q has orthonormal columns: Q^T Q = I
R is upper triangular

To solve Ax = b:
  QRx = b
  Rx = Q^T b    (just multiply by Q^T, no inversion needed)
  Back substitute to get x.
```

QR, en az kare problemlerini çözmek için LU'dan sayıca daha istikrarlıdır.$Q$Sütunlar:

```
Given columns a1, a2, ... of A:

q1 = a1 / ||a1||

q2 = a2 - (a2 . q1) * q1        (subtract projection onto q1)
q2 = q2 / ||q2||                (normalize)

q3 = a3 - (a3 . q1) * q1 - (a3 . q2) * q2
q3 = q3 / ||q3||

R[i][j] = qi . aj    for i <= j
```

Her adım , önceki tüm bileşenleri kaldırır .$q$Vectörler, sadece yeni ortogonal yönü bırakıyor.

### Cholesky parçalanması

Ne zaman ?$A$simetrik ($A = A^T$) ve pozitif kesin (tüm öz değerleri pozitif) olarak değerlendirebilirsiniz.$A = L L^T$nerede$L$Bu Cholesky parçalanması.

```
A = L @ L^T

| 4  2 |   | 2  0 |   | 2  1 |
| 2  5 | = | 1  2 | @ | 0  2 |

L[i][i] = sqrt(A[i][i] - sum(L[i][k]^2 for k < i))
L[i][j] = (A[i][j] - sum(L[i][k]*L[j][k] for k < j)) / L[j][j]    for i > j
```

Cholesky, LU'dan iki kat daha hızlı ve depolama alanının yarısını gerektirir.

- Kovariansa matrisleri simetrik pozitif yarı belirlenmiş (regularizasyonla pozitif belirlenmiş)lerdir.
- Gaussian süreçlerinde çekirdek matrisi simetrik pozitif kesin.
- En az bir konveks fonksiyonun Hessian'ı simetrik pozitif kesin.
- $A^T A$her zaman simetrik pozitif yarı belirlenmiş.

Gaussian süreçlerinde çekirdek matrisini faktörleştiriyorsunuz.$K$Cholesky ile konuşup sonra çöz.$K \alpha = y$Cholesky faktörü ayrıca sınırlı olasılığın log-determinansını verir:$\log \det(K) = 2 \sum \log(\mathop{\mathrm{diag}}(L))$- Evet .

### En az kare: Ax = b'nin tam çözümü olmadığı zaman

- Eğer$A$- Evet .$m \times n$- Evet .$m > n$Bu sistem çok fazla belirlenmiş ve tam bir çözüm bulunamıyor.

```
minimize ||Ax - b||^2

This is the sum of squared residuals:
  sum((A[i,:] @ x - b[i])^2 for i in range(m))
```

Minimizeci normal denklemleri tatmin eder:

```math
A^T A x = A^T b
```

Delivratör: genişle $\lVert Ax - b \rVert^2 = (Ax - b)^T (Ax - b) = x^T A^T A x - 2 x^T A^T b + b^T b$- Şekil ile ilgili olarak $x$, sıfır ayarlayın: $2 A^T A x - 2 A^T b = 0$- Evet .

```
Original system (overdetermined, 4 equations, 2 unknowns):
| 1  1 |         | 3 |
| 1  2 | x     = | 5 |       No exact x satisfies all 4 equations.
| 1  3 |         | 6 |
| 1  4 |         | 8 |

Normal equations:
A^T A = | 4  10 |    A^T b = | 22 |
        | 10 30 |            | 63 |

Solve: x = [1.5, 1.7]

This is linear regression. x[0] is the intercept, x[1] is the slope.
```

### Normal denklemler = doğrusal gerileme

Bağlantı tamdır. Düzsel gerileme, veriler matrisiniz$X$Örnek başına bir satır ve bir sütun var.$y$Örnek başına bir giriş var.$w$Bu:

```math
\begin{aligned}
X^T X w &= X^T y \\
w &= (X^T X)^{-1} X^T y
\end{aligned}
```

Bu, doğrusal gerileme için kapalı biçimle yapılan çözüm.`sklearn.linear_model.LinearRegression.fit()`Bu işlemleri (veya QR veya SVD üzerinden eşdeğer bir işlem) hesaplar.

Düzenleme terimi ekleyin $\lambda I$Matris'e gittikçe, bir çizgi geri dönüşü elde ediyoruz.

```math
\begin{aligned}
(X^T X + \lambda I) w &= X^T y \\
w &= (X^T X + \lambda I)^{-1} X^T y
\end{aligned}
```

Düzenlenme, matrisin daha iyi koşullandırılmasını sağlar (tam tersine doğru dönüştürülmesini kolaylaştırır) ve ağırlıkları sıfıra doğru küçültmekle aşırı uyumlu olmayı önler.$X^T X + \lambda I$her zaman simetrik pozitif kesin olduğunda$\lambda > 0$, böylece Cholesky'yi çözebilirsiniz.

### Pseudoinverse (Moore-Penrose)

- Pseudoinverse .$A^+$Matris inversiyonunu, kareler olmayan ve tekerlekli matrislere genelleştirir.$A$- ...

```math
\begin{aligned}
x &= A^+ b \\[4pt]
\text{where } A^+ &= V \Sigma^+ U^T \quad \text{(computed via SVD)}
\end{aligned}
```

$\Sigma^+$Bu, her sıfır dışı tek değerin karşılıklılığını alıp sonuçları aktararak oluşur.$A = U \Sigma V^T$O zaman ...$A^+ = V \Sigma^+ U^T$- Evet .

```
A = U Sigma V^T        (SVD)

Sigma = | 5  0 |       Sigma+ = | 1/5  0  0 |
        | 0  2 |                | 0  1/2  0 |
        | 0  0 |

A+ = V Sigma+ U^T
```

Pseudoinverse, minimum norm en az kare çözümü verir.
- Bir çözüm: $A^+ b$- Evet.
- Çözüm yok: $A^+ b$En az kare çözümü verir.
- Sonsuz çözümler:$A^+ b$En küçük olan kişiye verir.$\lVert x \rVert$- Evet .

NumPy'nin `np.linalg.lstsq`ve `np.linalg.pinv`İkisi de SVD'yi içten kullanıyor.

### Şart numarası

Şart numarası, çözümün girişdeki küçük değişikliklere ne kadar hassas olduğunu ölçer.$A$, koşul numarası:

```math
\kappa(A) = \lVert A \rVert \cdot \lVert A^{-1} \rVert = \frac{\sigma_{\max}}{\sigma_{\min}}
```

nerede$\sigma_{\max}$ve $\sigma_{\min}$en büyük ve en küçük tek değerler.

```
Well-conditioned (kappa ~ 1):        Ill-conditioned (kappa ~ 10^15):
Small change in b -->                Small change in b -->
small change in x                    huge change in x

| 2  0 |   kappa = 2/1 = 2          | 1   1          |   kappa ~ 10^15
| 0  1 |   safe to solve            | 1   1+10^(-15) |   solution is garbage
```

Basamak kuralları:
- $\kappa < 100$: güvenli, çözüm doğru.
- $\kappa \approx 10^k$- Kaybettiğin şey ...$k$- Sürekli akış noktası aritmetikinden kesinlik rakamları.
- $\kappa \approx 10^{16}$(float64) için: çözümü anlamsızdır.

ML'de, kötü koşullandırma özellikleri neredeyse üst-eğitken meydana gelir.$\lambda I$) durum sayısını arttırır $\sigma_{\max} / \sigma_{\min}$- ...$(\sigma_{\max} + \lambda) / (\sigma_{\min} + \lambda)$- Evet .

### İteratif yöntemler: konjugat gradiyenti

Çok büyük nadir sistemler (bilinmeyen milyonlarca) için, LU veya Cholesky gibi doğrudan yöntemler çok pahalıdır.

Konjugat gradiyenti (CG) çözülür $Ax = b$Ne zaman ?$A$Bu, en fazla tam çözümü bulur.$n$İterasyonlar (tam aritmetik olarak), ancak tipik olarak                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                $A$- Bir gruplar halinde.

```
Algorithm sketch:
  x0 = initial guess (often zero)
  r0 = b - A x0           (residual)
  p0 = r0                 (search direction)

  For k = 0, 1, 2, ...:
    alpha = (rk . rk) / (pk . A pk)
    x_{k+1} = xk + alpha * pk
    r_{k+1} = rk - alpha * A pk
    beta = (r_{k+1} . r_{k+1}) / (rk . rk)
    p_{k+1} = r_{k+1} + beta * pk
    if ||r_{k+1}|| < tolerance: stop
```

CG:
- Büyük ölçekli optimizasyon (Newton-CG yöntemi)
- PDE diskretleştirmelerini çözmek
- Kernel matrisi faktör için çok büyük olduğu çekirdek yöntemleri
- Diğer iteratif çözücüler için ön koşullama

Daha iyi koşullanmış sistemler daha hızlı bir şekilde bir araya gelir, bu da düzenlenmenin yardımcı olmasının bir başka nedeni.

### Tam tablo: hangi yöntem

| Method | Requirements | Cost | Use case |
|--------|-------------|------|----------|
| Gaussian elimination | Square, nonsingular $A$ | $O(n^3)$ | One-off solve of a square system |
| LU decomposition | Square, nonsingular $A$ | $O(n^3)$ factor + $O(n^2)$ solve | Multiple solves with the same $A$ |
| QR decomposition | Any $A$ ($m \ge n$) | $O(mn^2)$ | Least squares, numerically stable |
| Cholesky | Symmetric positive definite $A$ | $O(n^3/3)$ | Covariance matrices, Gaussian processes, ridge regression |
| Normal equations | Overdetermined ($m > n$) | $O(mn^2 + n^3)$ | Linear regression (small $n$) |
| SVD / pseudoinverse | Any $A$ | $O(mn^2)$ | Rank-deficient systems, minimum-norm solutions |
| Conjugate gradient | Symmetric positive definite, sparse $A$ | $O(n \cdot k \cdot \text{nnz})$ | Large sparse systems, $k$ = iterations |

### ML ile bağlantı

Bu dersdeki her yöntem üretim ML'de yer almaktadır:

**Linear regression.**Kapalı biçimli çözüm normal denklemleri çözür $X^T X w = X^T y$Bu Cholesky aracılığıyla yapılır.$n$küçük) veya QR (sayısal istikrarın önemli olduğu takdirde) veya SVD (matriks dereceleri eksik olabilirse).

**Ridge regression.**Ekler $\lambda I$- ...$X^T X$- Düzenlenmiş sistem .$(X^T X + \lambda I) w = X^T y$Her zaman Cholesky'den çözülebilir çünkü$X^T X + \lambda I$simetrik pozitif olarak tanımlanmıştır.$\lambda > 0$- Evet .

**Gaussian processes.**Önceden tahmin ortalaması çözülmeyi gerektirir .$K \alpha = y$nerede$K$Bu da çekirdek matrisidir.$K$Bu, standart yaklaşımdır.$\log \det(K) = 2 \sum \log(\mathop{\mathrm{diag}}(L))$- Evet .

**Neural network initialization.**Ortogonal başlangıç, derin ağlarda sinyal çökmesini önlerken sütunları ortonomik olan ağırlık matrislerini oluşturmak için QR parçalanmasını kullanır.

**Preconditioning.**Büyük ölçekli optimizörler, eşleşik gradient çözücüler için önceden koşullar olarak eksik Cholesky veya eksik LU kullanır.

**Feature engineering.**Şart numarası $X^T X$Eğer bu özelliklerin üst çizgilerden olup olmadığını söyler.$\kappa$büyük, özellikleri düşürmek veya düzenlenme eklemek.

```figure
linear-system-conditioning
```

## Yapın

### Adım 1: kısmi dönümle Gaussian ortadan kaldırılması

```python
import numpy as np

def gaussian_elimination(A, b):
    n = len(b)
    Ab = np.hstack([A.astype(float), b.reshape(-1, 1).astype(float)])

    for k in range(n):
        max_row = k + np.argmax(np.abs(Ab[k:, k]))
        Ab[[k, max_row]] = Ab[[max_row, k]]

        if abs(Ab[k, k]) < 1e-12:
            raise ValueError(f"Matrix is singular or nearly singular at pivot {k}")

        for i in range(k + 1, n):
            m = Ab[i, k] / Ab[k, k]
            Ab[i, k:] -= m * Ab[k, k:]

    x = np.zeros(n)
    for i in range(n - 1, -1, -1):
        x[i] = (Ab[i, -1] - Ab[i, i+1:n] @ x[i+1:n]) / Ab[i, i]

    return x
```

### Adım 2: LU parçalanması

```python
def lu_decompose(A):
    n = A.shape[0]
    L = np.eye(n)
    U = A.astype(float).copy()
    P = np.eye(n)

    for k in range(n):
        max_row = k + np.argmax(np.abs(U[k:, k]))
        if max_row != k:
            U[[k, max_row]] = U[[max_row, k]]
            P[[k, max_row]] = P[[max_row, k]]
            if k > 0:
                L[[k, max_row], :k] = L[[max_row, k], :k]

        for i in range(k + 1, n):
            L[i, k] = U[i, k] / U[k, k]
            U[i, k:] -= L[i, k] * U[k, k:]

    return P, L, U

def lu_solve(P, L, U, b):
    n = len(b)
    Pb = P @ b.astype(float)

    y = np.zeros(n)
    for i in range(n):
        y[i] = Pb[i] - L[i, :i] @ y[:i]

    x = np.zeros(n)
    for i in range(n - 1, -1, -1):
        x[i] = (y[i] - U[i, i+1:] @ x[i+1:]) / U[i, i]

    return x
```

### Adım 3: Cholesky parçalanması

```python
def cholesky(A):
    n = A.shape[0]
    L = np.zeros_like(A, dtype=float)

    for i in range(n):
        for j in range(i + 1):
            s = A[i, j] - L[i, :j] @ L[j, :j]
            if i == j:
                if s <= 0:
                    raise ValueError("Matrix is not positive definite")
                L[i, j] = np.sqrt(s)
            else:
                L[i, j] = s / L[j, j]

    return L
```

### Adım 4: Normal denklemler üzerinden en az kare

```python
def least_squares_normal(A, b):
    AtA = A.T @ A
    Atb = A.T @ b
    return gaussian_elimination(AtA, Atb)

def ridge_regression(A, b, lam):
    n = A.shape[1]
    AtA = A.T @ A + lam * np.eye(n)
    Atb = A.T @ b
    L = cholesky(AtA)
    y = np.zeros(n)
    for i in range(n):
        y[i] = (Atb[i] - L[i, :i] @ y[:i]) / L[i, i]
    x = np.zeros(n)
    for i in range(n - 1, -1, -1):
        x[i] = (y[i] - L.T[i, i+1:] @ x[i+1:]) / L.T[i, i]
    return x
```

### Adım 5: Şart numarası

```python
def condition_number(A):
    U, S, Vt = np.linalg.svd(A)
    return S[0] / S[-1]
```

## Kullan

Gerçek veriler üzerinde çizgisi geri dönüş ve kıyıs geri dönüş için parçaları bir araya getirmek:

```python
np.random.seed(42)
X_raw = np.random.randn(100, 3)
w_true = np.array([2.0, -1.0, 0.5])
y = X_raw @ w_true + np.random.randn(100) * 0.1

X = np.column_stack([np.ones(100), X_raw])

w_ols = least_squares_normal(X, y)
print(f"OLS weights (ours):    {w_ols}")

w_np = np.linalg.lstsq(X, y, rcond=None)[0]
print(f"OLS weights (numpy):   {w_np}")
print(f"Max difference: {np.max(np.abs(w_ols - w_np)):.2e}")

w_ridge = ridge_regression(X, y, lam=1.0)
print(f"Ridge weights (ours):  {w_ridge}")

from sklearn.linear_model import Ridge
ridge_sk = Ridge(alpha=1.0, fit_intercept=False)
ridge_sk.fit(X, y)
print(f"Ridge weights (sklearn): {ridge_sk.coef_}")
```

## Gönder

Bu ders şunları ortaya çıkarır:
- `code/linear_systems.py`Gaussian ortadan kaldırma, LU parçalanma, Cholesky parçalanma, en az kare ve kıyıs geri dönüşü baştan başlayan uygulamalar içerir.
- `code/linear_systems.ts`Bu, küçük sıfırdan referans çözücülerine karşı karşılaştırılır, çünkü TypeScript'in NumPy'si yoktur.
- Normal denklemlerin ve sklearn'ın Hattı Gerileme'nin aynı ağırlıkları ürettiğini gösteren bir çalışma göstergesi

## Egzersizler

1. Sistem çözülüyor.`[[1,2,3],[4,5,6],[7,8,10]] x = [6, 15, 27]`Gaussian eliminasyonunuzu, LU çözücüünüzü kullanarak ve`np.linalg.solve`Üçü de aynı cevabı kayarak tolerans içinde verilecek.

2. 50x5 rastgele bir matris X oluşturun ve hedef y = X @ w_true + gürültü.`np.linalg.qr`), SVD (önteminde `np.linalg.svd`), ve `np.linalg.lstsq`. Dört çözümü de karşılaştır.$X^T X$ve hangi yönteme güvendiğinizi nasıl etkilediğini açıklayın.

3. İki sütunun neredeyse aynı olması (örneğin, sütun 2 = sütun 1 + 1e-10 * gürültü) ile neredeyse tek bir matris oluşturun.$Ax = b$Düzenlenme ile ve olmadan (add $0.01 I$Çözümleri ve kalıntıları karşılaştırın.

4. 100x100 rastgele simetrik pozitif belirlenmiş matris için konjugat gradient algoritmasını uygulayın. 1e-8 toleransına doğru kaç iterasyon gerekiyor.$n$İterasyonlar.

5. Cholesky çözücü ile LU çözücü ile zaman ayır .`np.linalg.solve`10'ın, 50'nin, 200'nin, 500'ün ölçüsündeki simetrik pozitif belirlenmiş matrisler üzerinde.

### İpuçlar

**Exercise 1.**Arama .`gaussian_elimination(A, b)`O zaman ...`lu_decompose(A)`Ardından `lu_solve(P, L, U, b)`O zaman ...`np.linalg.solve(A, b)`Her cevabı kontrol et .`np.allclose(A @ x, b)`ve üç cevabı karşılaştır `np.allclose`- Evet .

**Exercise 2.**Kullanım`least_squares_normal`Normal denklemler için ve diğer yöntemler için üç NumPy işlevi için.`w_true`- Ben de .`condition_number(X.T @ X)`- Evet .`condition_number(X)`: ilk ikinci kare, normal denklemler en çok hassaslığı kaybeder.

**Exercise 3.**Yukarıdaki bir durum numarasını bekleyin .$10^{9}$- Çözmek için `np.linalg.solve`ve ile`ridge_regression(A, b, 0.01)`, sonra karşılaştır `np.linalg.norm(x)`Her iki kalıntı da küçük olabilir, ancak düzenlenmeden çözünürlük genellikle çok büyük girişlere sahiptir.

**Exercise 4.**Simetrik pozitif kesin matris yapın `B @ B.T + n * np.eye(n)`, böylece her öz değeri pozitif.`conjugate_gradient`, sonra son kalan normunun 1e-8'den aşağı olup olmadığını ve sayının en fazla 100 olduğunu kontrol et.

**Exercise 5.**Aynı şeyi kullan `B @ B.T + n * np.eye(n)`Üç çözücü için matrisler ve zaman her çözücü ile `time.perf_counter`Cholesky'nin LU'nun yaklaşık yarısını kullanması gerekiyor, bu yüzden oran daha büyük boyutlarda en net olur.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Linear system | "Solve for x" | A set of linear equations $Ax = b$. Finding $x$ means finding the input that produces output $b$ under transformation $A$. |
| Gaussian elimination | "Row reduce" | Systematically zero out entries below the diagonal using row operations, producing an upper triangular system solvable by back substitution. $O(n^3)$. |
| Partial pivoting | "Swap rows for stability" | Before eliminating in column $k$, swap the row with the largest absolute value in that column to the pivot position. Prevents division by small numbers. |
| LU decomposition | "Factor into triangles" | Write $A = LU$ where $L$ is lower triangular (stores multipliers) and $U$ is upper triangular (the eliminated matrix). Amortizes the $O(n^3)$ cost over multiple solves. |
| QR decomposition | "Orthogonal factorization" | Write $A = QR$ where $Q$ has orthonormal columns and $R$ is upper triangular. More stable than LU for least squares. |
| Cholesky decomposition | "Square root of a matrix" | For symmetric positive definite $A$, write $A = LL^T$. Half the cost of LU. Used for covariance matrices, kernel matrices, and ridge regression. |
| Least squares | "Best fit when exact is impossible" | Minimize the sum of squared residuals $\lVert Ax - b \rVert^2$ when the system is overdetermined (more equations than unknowns). |
| Normal equations | "The calculus shortcut" | $A^T A x = A^T b$. Setting the gradient of $\lVert Ax - b \rVert^2$ to zero. This IS the closed-form solution to linear regression. |
| Pseudoinverse | "Inversion for non-square matrices" | $A^+ = V \Sigma^+ U^T$ via SVD. Gives the minimum-norm least-squares solution for any matrix, square or rectangular, singular or not. |
| Condition number | "How trustworthy is this answer" | $\kappa = \sigma_{\max} / \sigma_{\min}$. Measures sensitivity to input perturbations. Lose about $\log_{10}(\kappa)$ digits of precision. |
| Ridge regression | "Regularized least squares" | Solve $(X^T X + \lambda I) w = X^T y$. Adding $\lambda I$ improves conditioning and shrinks weights toward zero. Prevents overfitting. |
| Conjugate gradient | "Iterative Ax=b for big matrices" | An iterative solver for symmetric positive definite systems. Converges in at most $n$ steps. Practical for large sparse systems where factorization is too expensive. |
| Overdetermined system | "More data than parameters" | $m > n$ in an $m\text{-by-}n$ system. No exact solution exists. Least squares finds the best approximation. This is every regression problem. |
| Back substitution | "Solve from the bottom up" | Given an upper triangular system, solve the last equation first, then substitute backward. $O(n^2)$. |
| Forward substitution | "Solve from the top down" | Given a lower triangular system, solve the first equation first, then substitute forward. $O(n^2)$. Used in the L step of LU solves. |

## Daha Fazla Okumak

- [MIT 18.06: Linear Algebra](https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/)(Gilbert Strang) - Düzsel sistemler ve matris faktörleşmeleri konusunda kesin ders.
- [Numerical Linear Algebra](https://people.maths.ox.ac.uk/trefethen/text.html)(Trefethen & Bau) - Sayısal istikrarı, koşullamaları ve algoritmaların neden başarısız olduğunu anlamak için standart referans
- [Matrix Computations](https://www.press.jhu.edu/books/title/10678/matrix-computations)(Golub & Van Loan) - her matris algoritması için ansiklopedik referans
- [3Blue1Brown: Inverse Matrices](https://www.3blue1brown.com/lessons/inverse-matrices)- Görsel algı , neyi çözmek için .$Ax = b$Geometri anlamında
