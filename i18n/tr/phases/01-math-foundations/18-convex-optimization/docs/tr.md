# Konves Optimizasyon

> Konves sorunlarının tek bir vadisi var, sinir ağlarının milyonlarca.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 04 (Calculus for ML), 08 (Optimization)
**Time:** ~90 minutes

## Öğrenme Hedefleri

- Bir fonksiyonun tanım, ikinci türe ve Hessian kriterlerini kullanarak eğri olup olmadığını test edin
- Newton'un yöntemini uygulayın ve onun katraz dönüşümünü gradient düşüşü ile karşılaştırın
- Lagrange çarpıcıları kullanarak kısıtlı optimizasyon sorunlarını çözmek ve KKT koşullarını yorumlamak
- Neden sinir ağı kayıpları manzaraları konveks değil, SGD hala iyi çözümler bulduğunu açıkla

## Sorun

Ders 08'de, gradient düşüşü, momentum ve Adam'ı öğrendiniz. Bu optimizörler herhangi bir yüzeyde aşağıya doğru yürürler. Ama hiçbir garanti yok. Konves olmayan bir manzarada gradient düşüşü kötü bir yerel minimumda düşebilir, bir sedil noktasına sıkışabilir veya sonsuza dek sallanabilir. Neural ağlar konvessi olmayan ve başka bir alternatif olmadığı için yine de kullandınız.

Ama makine öğreniminde birçok sorun konveks. Düzsel gerileme, lojistik gerileme, SVM, LASSO, kıyılar gerileme. Bu kişiler için daha güçlü bir şey var: matematik garantileri ile optimizasyon. Bir konveks problemin yanlış vadileri yoktur: her yerel minimum küresel minimum. En az bir derecede yumuşak bir konveks fonksiyon için, uygun bir adım boyutu ile gradient düşüşü ona yaklaşıyor. Yeniden başlatmaya gerek yok. Öğrenme oranı programı yok. Dua yok.

Konvessiyet'i anlamak üç şey yapar. Birincisi, size sorununuz kolay (konves) ile sert (konvessi olmayan) olduğunda söyler. İkincisi, konves problemleri için Newton'un yöntemi gibi daha hızlı araçlar verir. Üçüncüsü, ML'de ortaya çıkan kavramları açıklar: düzenlenme bir kısıtlama, SVM'lerde çiftelik ve derin öğrenmenin neden her güzel konvessiyetin verilmesine rağmen çalışması.

## Anlaşım

### Konves setleri

Bir set .$S$                                                      $S$, aralarındaki çizgi bölümü de tamamen $S$- Evet .

| Convex sets | Not convex |
|---|---|
| **Rectangle**: any two points inside can be connected by a line segment that stays inside | **Star/crescent shape**: a line between two interior points can pass outside the set |
| **Triangle**: same property holds for all interior points | **Donut/annulus**: the hole means some line segments leave the set |
| The line segment between any two points stays within the set | The line segment between some pairs of points exits the set |

Formal test: herhangi bir nokta için $x, y$İçeride$S$Ve herhangi bir .$t \in [0, 1]$, nokta $tx + (1-t)y$Aynı zamanda $S$- Evet .

Konves setlerinin örnekleri:
- Bir hat, bir uçak, hepsi.$\mathbb{R}^n$
- Bir top (daire, küresi, hipersfer)
- Yarım boşluk:$\lbrace x : a^T x \le b \rbrace$
- Herhangi bir sayıda konveks setin kesişimi

Konveks olmayan kümelerin örnekleri:
- Bir çörek (annulus)
- İki bölünmüş çevrenin birleşimi
- "Dent" veya " delik" olan herhangi bir set

### Konves fonksiyonları

Bir fonksiyon$f$Eğer alanı bir konveks kümesi ise ve herhangi iki noktaya göre konveksse.$x, y$Bölüm ve alanında$t \in [0, 1]$- ...

```math
f(tx + (1-t)y) \le t f(x) + (1-t) f(y)
```

Jeometrik olarak: grafikteki herhangi iki nokta arasındaki çizgi bölümü, grafikten yukarıda veya üzerinde bulunur.

| Property | Convex function | Non-convex function |
|---|---|---|
| **Line segment test** | The line between any two points on the graph lies **above or on** the curve | The line between some points on the graph dips **below** the curve |
| **Shape** | Single bowl/valley curving upward | Multiple peaks and valleys with mixed curvature |
| **Local minima** | Every local minimum is the global minimum | Multiple local minima may exist at different heights |

Ortak konveks fonksiyonlar:
- $f(x) = x^2$- Evet .
- $f(x) = \lvert x \rvert$(mükemmel değer)
- $f(x) = e^x$(gelişmiş)
- $f(x) = \max(0, x)$(ReLU, parça olarak doğrusal olmasına rağmen)
- $f(x) = -\log(x)$için$x > 0$(Negatif kayıt)
- Herhangi bir doğrusal fonksiyon $f(x) = a^T x + b$(hem konveks hem de konkav)

### Çelişkinlik için test

En kolaytan en zorluya kadar üç pratik test.

**Test 1: Second derivative test (1D).**- Eğer$f''(x) \ge 0$Herkes için .$x$O zaman ...$f$-Konküks.

- $f(x) = x^2$- Evet .$f''(x) = 2 \ge 0$- Konves.
- $f(x) = x^3$- Evet .$f''(x) = 6x$- Negatif .$x < 0$- Kovaş değil.
- $f(x) = e^x$- Evet .$f''(x) = e^x > 0$- Konves.

**Test 2: Hessian test (multivariate).**Eğer Hessian matrisi $H(x)$Herkes için yarı belirlenmiş bir pozitif.$x$O zaman ...$f$Hessian ikinci kısmi türevlerin matrisidir.

**Test 3: Definition test.**Uygulmazlığı kontrol et .$f(tx + (1-t)y) \le t f(x) + (1-t) f(y)$Doğrudan. Derivatların hesaplanması zor olan fonksiyonlar için kullanışlı.

### Neden konveksi önemli

Konves optimizasyonunun merkezi teoremi:

**For a convex function, every local minimum is a global minimum.**

Bu, gradient düşüşünün kötü bir yerel minimumda sıkışamayacağı anlamına gelir. Başlayabileceği her minimum aynı kayba sahiptir.

```mermaid
graph LR
    subgraph "Convex: ONE answer"
        direction TB
        C1["Loss surface has no false valleys"] --> C2["Gradient descent with a suitable step converges to the global minimum"]
    end
    subgraph "Non-convex: MANY traps"
        direction TB
        N1["Loss surface has multiple valleys and peaks"] --> N2["Gradient descent may get stuck in a local minimum"]
        N2 --> N3["Global minimum might be missed"]
    end
```

Sonuçlar:
- - İhtiyacın yok .
- Gelişmiş öğrenme oranı programlarına gerek yok
- Dönüşüm kanıtları mümkündür (süreklilik fonksiyon özelliklerine bağlıdır)
- Çözüm benzersiz (taze bölgelerden)

### ML'de konveks vs konveks olmayan

| Problem | Convex? | Why |
|---------|---------|-----|
| Linear regression (MSE) | Yes | Loss is quadratic in weights |
| Logistic regression | Yes | Log-loss is convex in weights |
| SVM (hinge loss) | Yes | Maximum of linear functions |
| LASSO (L1 regression) | Yes | Sum of convex functions is convex |
| Ridge regression (L2) | Yes | Quadratic + quadratic = convex |
| Neural network (any loss) | No | Nonlinear activations create non-convex landscape |
| k-means clustering | No | Discrete assignment step |
| Matrix factorization | No | Product of unknowns |

Sınırlı kayıplarla çizgi modeller sarıdır.

### Hessian Matrix

Hessyan $H$bir fonksiyonun $f: \mathbb{R}^n \to \mathbb{R}$- Bu ...$n \times n$İkinci kısmi türevlerin matrisi.

```math
H_{ij} = \frac{\partial^2 f}{\partial x_i \, \partial x_j}
```

- Evet .$f(x, y) = x^2 + 3xy + y^2$- ...

```math
\begin{gathered}
\begin{aligned}
\frac{\partial f}{\partial x} &= 2x + 3y & \frac{\partial^2 f}{\partial x^2} &= 2 & \frac{\partial^2 f}{\partial x \, \partial y} &= 3 \\
\frac{\partial f}{\partial y} &= 3x + 2y & \frac{\partial^2 f}{\partial y \, \partial x} &= 3 & \frac{\partial^2 f}{\partial y^2} &= 2
\end{aligned} \\[8pt]
H = \begin{bmatrix} 2 & 3 \\ 3 & 2 \end{bmatrix}
\end{gathered}
```

Hessian, eğrilik hakkında şöyle diyor:
- Eigenvalue'ler tüm pozitif: fonksiyon her yönde yukarı eğrilir (o noktada sarı)
- Tüm öz değerleri negatif: her yönde aşağıya eğri (konkaf, yerel maksimum)
- Karışık işaretler: otlak noktası (bazı yönlerde yukarı eğri, diğerlerinde aşağı eğri)
- 0 öz değeri: bu yönde düz (degenerasyon)

Konvesisite için, Hessian pozitif yarı belirlenmiş olmalıdır (tüm öz değerleri $\ge 0$) her yerde, sadece bir noktada değil.

### Newton'un yöntemi

Gradyent inme birinci sıra bilgilerini (gradient) kullanır. Newton'un yöntemi ikinci sıra bilgilerini (Hessian) kullanır.

```math
\begin{aligned}
\text{Update rule:} \quad & x_{\text{new}} = x - H^{-1} \cdot \text{gradient} \\
\text{Compare to gradient descent:} \quad & x_{\text{new}} = x - \text{lr} \cdot \text{gradient}
\end{aligned}
```

Newton'un yöntemi, skalar öğrenme hızını ters Hessian ile değiştirir. Bu otomatik olarak yerel eğriliği temelinde adım boyutunu ve yönünü ayarlar.

```mermaid
graph TD
    subgraph "Gradient Descent"
        GD1["Start"] --> GD2["Step 1"]
        GD2 --> GD3["Step 2"]
        GD3 --> GD4["..."]
        GD4 --> GD5["Step ~500: Converged"]
        GD_note["Follows gradient blindly — many small steps"]
    end
    subgraph "Newton's Method"
        NM1["Start"] --> NM2["Step 1"]
        NM2 --> NM3["..."]
        NM3 --> NM4["Step ~5: Converged"]
        NM_note["Uses curvature for optimal steps"]
    end
```

Avantajlar:
- En az yakın olan kare dönüşüm (her adımdaki hata kare)
- Düzenleme için öğrenme oranı yok
- Ölçek değişkenliği (problemi nasıl parametrelediğine bakılmaksızın çalışır)

Eksiklikler:
- Hessian maliyetlerini hesaplamak $O(n^2)$hafıza ve $O(n^3)$tersine çevirmek
- Bir milyon ağırlıklı sinir ağı için, bu $10^{12}$Notlar ve $10^{18}$İşlemler
- Derin öğrenme için pratik değil

### Sınırlı optimizasyon

Sınırsız optimizasyon: en aza indir $f(x)$Her şeyde .$x$- Evet .
Sınırlı optimizasyon: en aza indirmek $f(x)$kısıtlamalara tabi.

Gerçek sorunların kısıtlamaları vardır. Masrafları en aza indirmek istiyorsunuz ama bütçeniz sınırlıdır. Hataları en aza indirmek istiyorsunuz ama model karmaşıklığınız sınırlıdır.

```mermaid
graph LR
    subgraph "Unconstrained"
        U1["Loss function"] --> U2["Free minimum: lowest point of the loss surface"]
    end
    subgraph "Constrained"
        C1["Loss function"] --> C2["Constrained minimum: lowest point within the feasible region"]
        C3["Constraint boundary limits the search space"]
    end
```

### Lagrange çarpıcıları

Lagrange çarpıcıları yöntemi, kısıtlı bir sorunu kısıtlı olmayan bir soruna dönüştürür.

Sorun: en aza indir .$f(x)$$g(x) = 0$- Evet .

Çözüm: yeni bir değişken (Lagrange çarpıcısı)$\lambda$) ve kısıtlamalar olmadan sorunu çözmek:

```math
L(x, \lambda) = f(x) + \lambda g(x)
```

Çözümde, $L$sıfırdır:

```math
\begin{aligned}
\frac{\partial L}{\partial x} &= \frac{\partial f}{\partial x} + \lambda \frac{\partial g}{\partial x} = 0 \\
\frac{\partial L}{\partial \lambda} &= g(x) = 0
\end{aligned}
```

Geometrik algı: sınırlı minimumda, $f$Zorunluğun eğilimi ile paralel olmalıdır $g$Eğer paralel değillerse, kısıtlama yüzeyi boyunca hareket edip,$f$Daha ileri.

```mermaid
graph LR
    A["Contours of f(x,y): concentric ellipses"] --- S["Solution point"]
    B["Constraint curve g(x,y) = 0"] --- S
    S --- C["At the solution, gradient of f is parallel to gradient of g"]
```

Örnek: en aza indirmek$f(x,y) = x^2 + y^2$$x + y = 1$- Evet .

```math
\begin{aligned}
L &= x^2 + y^2 + \lambda(x + y - 1) \\[4pt]
\frac{\partial L}{\partial x} &= 2x + \lambda = 0 \implies x = -\lambda/2 \\
\frac{\partial L}{\partial y} &= 2y + \lambda = 0 \implies y = -\lambda/2 \\
\frac{\partial L}{\partial \lambda} &= x + y - 1 = 0 \\[4pt]
&\text{From first two: } x = y \\
&\text{Substituting: } 2x = 1, \text{ so } x = y = 0.5, \ \lambda = -1
\end{aligned}
```

Hatın en yakın noktası .$x + y = 1$Kaynak:$(0.5, 0.5)$- Evet .

### KKT koşulları

Karush-Kuhn-Tucker koşulları Lagrange çarpıcılarını eşitsizlik kısıtlamalarına kadar uzattır.

Sorun: en aza indir .$f(x)$$g_i(x) \le 0$için$i = 1, \ldots, m$- Evet .

KKT koşulları (optimallık için gerekli):

```math
\begin{aligned}
&\text{1. Stationarity:} && \frac{\partial f}{\partial x} + \sum_i \lambda_i \frac{\partial g_i}{\partial x} = 0 \\
&\text{2. Primal feasibility:} && g_i(x) \le 0 \quad \text{for all } i \\
&\text{3. Dual feasibility:} && \lambda_i \ge 0 \quad \text{for all } i \\
&\text{4. Complementary slackness:} && \lambda_i \, g_i(x) = 0 \quad \text{for all } i
\end{aligned}
```

Ek gevşeklik, ana anlayıştır: ya kısıtlama aktif ($g_i = 0$Soluğun sınır üzerinde oturduğu veya katılayıcının sıfır olduğu (sıkıntı önemli değildir).$\lambda = 0$- Evet .

KKT koşulları SVM'lerin merkezinde bulunur. Destek vektörleri kısıtlamanın aktif olduğu veri noktalarıdır ($\lambda > 0$Bütün diğer veri noktaları $\lambda = 0$Ve karar sınırını etkilemez.

### Düzenlendirme kısıtlı optimizasyon olarak

L1 ve L2 düzenlenmesi keyfi hileler değil, maskeli kısıtlı optimizasyon problemleri.

**L2 regularization (Ridge):**

```math
\begin{aligned}
&\text{minimize } \text{Loss}(w) \text{ subject to } \lVert w \rVert^2 \le t \\[4pt]
&\text{Equivalent unconstrained form:} \\
&\text{minimize } \text{Loss}(w) + \lambda \lVert w \rVert^2
\end{aligned}
```

Zorluklar $\lVert w \rVert^2 \le t$Bir top (toku 2 boyutlu, küre 3 boyutlu) tanımlar.

**L1 regularization (LASSO):**

```math
\begin{aligned}
&\text{minimize } \text{Loss}(w) \text{ subject to } \lVert w \rVert_1 \le t \\[4pt]
&\text{Equivalent unconstrained form:} \\
&\text{minimize } \text{Loss}(w) + \lambda \lVert w \rVert_1
\end{aligned}
```

Zorluklar $\lVert w \rVert_1 \le t$bir elmas tanımlar (2 boyutlu bir döngü)

| Property | L2 constraint (circle) | L1 constraint (diamond) |
|---|---|---|
| **Constraint shape** | Circle (sphere in higher dims) | Diamond (rotated square in 2D) |
| **Where loss contour touches** | Smooth boundary — any point on the circle | Corner — aligned with an axis |
| **Solution behavior** | Weights are small but nonzero | Some weights are exactly zero (sparse) |
| **Result** | Weight shrinkage | Feature selection |

Bu, L1'nin neden nadir modeller ürettiğini (önümlük seçimi) açıklarken L2'nin sadece ağırlıkları azaltmasının nedenini açıklar. Elmasın ekselerle uyumlu köşeleri vardır. Kayıp konturların bir köşe dokunma olasılığı daha yüksektir, bir veya daha fazla ağırlığı tam olarak sıfıra ayarlar.

### İkiliğe

Her kısıtlı optimizasyon sorunu (birincil) bir eş sorunu (ikili) vardır. Konves problemler için, birincil ve ikili aynı optimal değere sahiptir. Bu güçlü bir ikili.

Lagrangian çift fonksiyonu:

```math
\begin{aligned}
&\text{Primal:} && \text{minimize } f(x) \text{ subject to } g(x) \le 0 \\
&\text{Lagrangian:} && L(x, \lambda) = f(x) + \lambda g(x) \\
&\text{Dual function:} && d(\lambda) = \min_x L(x, \lambda) \\
&\text{Dual problem:} && \text{maximize } d(\lambda) \text{ subject to } \lambda \ge 0
\end{aligned}
```

İkiliğin neden önemli olduğu:
- İkilem problemini çözmek bazen ilk problemden daha kolay.
- SVM'ler ikili şeklinde çözülür, burada sorun veri noktaları arasındaki nokta ürünlerine bağlıdır (kernel hilesini etkinleştirir)
- Dual, çözünürlük kalitesini kontrol etmek için yararlı olan ilk optimum'un alt sınırını sağlar.

Özellikle SVM için:

```
Primal: find w, b that maximize the margin 2/||w|| subject to
        y_i(w^T x_i + b) >= 1 for all i

Dual:   maximize sum(alpha_i) - 0.5 * sum_ij(alpha_i * alpha_j * y_i * y_j * x_i^T x_j)
        subject to alpha_i >= 0 and sum(alpha_i * y_i) = 0

The dual only involves dot products x_i^T x_j.
Replace x_i^T x_j with K(x_i, x_j) to get the kernel trick.
```

### Derin öğrenmenin neden konveksiyetsiz olmasına rağmen işe yarıyor

Neural ağ kaybı fonksiyonları oldukça konveks değildir. Her klasik ölçümle, onları optimize etmek başarısız olmalıdır.

**Most local minima are good enough.**Yüksek boyutlu alanlarda, rastgele kritik noktalar (gelişme sıfır olduğu yerlerde) yerel minimumlar değil, büyük ölçüde otlak noktalarıdır. Var olan birkaç yerel minimum, küresel minimumın yakınında kayıp değerlerine sahip olma eğilimindedir. Parametre alanının milyonlarca boyutunda olduğu zaman korkunç bir yerel minimumda sıkışmak son derece muhtemel değildir.

**Saddle points, not local minima, are the real obstacle.**Bir fonksiyonda $n$Bu nedenle, bir dilimde bir dilimde bir dilimde bir dilimde bir dilimde bir dilimde bir dilimde bir dilimde bir dilimde bir dilimde bir dilimde bir dilimde bir dilimde bir dilimde bir dilimde bir dilimde bir dilimde bir dilimde bir dilimde bir dilimde bir dilimde bir dilimde bir dilimde bir dilimde bir dilimde bir dilimde bir dilimde bir dilimde bir dilimde bir dilimde bir dilimde bir dilimde bir karışım vardır.$n$öz değerleri pozitif (yerel minimum) yaklaşık olarak $2^{-n}$Neredeyse tüm kritik noktalar otlak noktaları.

**Overparameterization smooths the landscape.**Eğitim örneklerinden daha fazla parametreye sahip ağlar daha düzgün, daha bağlantılı kayıp yüzeylerine sahiptir. Daha geniş ağlar daha az kötü yerel minimumlara sahiptir. Bu, mantık dışı ancak empiri olarak tutarlıdır.

**Loss landscape structure:**

| Property | Low-dimensional space | High-dimensional space |
|---|---|---|
| **Landscape** | Many isolated peaks and valleys | Smoothly connected valleys |
| **Minima** | Many isolated local minima | Few bad local minima; most are near-optimal |
| **Navigation** | Hard to find global minimum | Many paths lead to good solutions |
| **Critical points** | Mix of local minima and saddle points | Overwhelmingly saddle points, not local minima |

**Stochastic noise acts as implicit regularization.**Mini-batch SGD, keskin minimumlara yerleşmeyi engelleyen gürültü ekler. Keskin minimumlar aşırı uyum sağlar; düz minimumlar genelleştirir. Gürültü kayıp manzarasının düz bölgelerine yönelik optimize etmeyi engeller.

### İkinci sırada uygulanan yöntemler

Pure Newton'un yöntemi büyük modeller için pratik değildir.

**L-BFGS (Limited-memory BFGS):**Sonuncu Hessian'ı kullanarak ters Hessian'ı yaklaştırır $m$Gelişme farkları.$O(mn)$- Anımsamak yerine .$O(n^2)$. ~ 10.000 parametre kadar olan sorunlarda iyi çalışır. Klasik ML (logistik gerileme, CRF) için kullanılır, ancak derin öğrenme için kullanılmaz.

**Natural gradient:**Standart Hessian yerine Fisher bilgi matrisini (log- olasılık beklenen Hessian) kullanır. Bu olasılık dağılımlarının jeometri için hesap verir. K-FAC (Kronecker-Faktörlü Yaklaşım Kürürümesi) Fisher matrisini Kronecker ürünü olarak yaklaştırır ve sinir ağları için pratik hale getirir.

**Hessian-free optimization:**Çözmek için konjugat gradiyenti kullanır $Hx = g$Hiç oluşmadan.$H$Sadece Hessian vektör ürünleri gerektirir.$O(n)$otomatik farklılık yoluyla zaman.

**Diagonal approximations:**Adam'ın ikinci anı, Hessian'ın diyagonalının diyagonal yaklaşımıdır. AdaHessian bunu Hutchinson'un tahmincisi aracılığıyla gerçek Hessian diyagonal unsurlarını kullanarak genişletiyor.

| Method | Memory | Per-step cost | When to use |
|--------|--------|--------------|-------------|
| Gradient descent | $O(n)$ | $O(n)$ | Baseline, large models |
| Newton's method | $O(n^2)$ | $O(n^3)$ | Small convex problems |
| L-BFGS | $O(mn)$ | $O(mn)$ | Medium convex problems |
| Adam | $O(n)$ | $O(n)$ | Deep learning default |
| K-FAC | $O(n)$ | $O(n)$ per layer | Research, large-batch training |

```figure
convex-vs-nonconvex
```

## Yapın

### Adım 1: Konvesitlik kontrolü

Örnek noktaları ve tanımı kontrol ederek konvessiyetini empiri olarak test eden bir fonksiyon oluşturun.

```python
import random
import math

def check_convexity(f, dim, bounds=(-5, 5), samples=1000):
    violations = 0
    for _ in range(samples):
        x = [random.uniform(*bounds) for _ in range(dim)]
        y = [random.uniform(*bounds) for _ in range(dim)]
        t = random.uniform(0, 1)
        mid = [t * xi + (1 - t) * yi for xi, yi in zip(x, y)]
        lhs = f(mid)
        rhs = t * f(x) + (1 - t) * f(y)
        if lhs > rhs + 1e-10:
            violations += 1
    return violations == 0, violations
```

### Adım 2: 2D için Newton'un yöntemi

Newton'un yöntemini açık bir Hessian kullanarak uygulayın.

```python
def newtons_method(f, grad_f, hessian_f, x0, steps=50, tol=1e-12):
    x = list(x0)
    history = [x[:]]
    for _ in range(steps):
        g = grad_f(x)
        H = hessian_f(x)
        det = H[0][0] * H[1][1] - H[0][1] * H[1][0]
        if abs(det) < 1e-15:
            break
        H_inv = [
            [H[1][1] / det, -H[0][1] / det],
            [-H[1][0] / det, H[0][0] / det],
        ]
        dx = [
            H_inv[0][0] * g[0] + H_inv[0][1] * g[1],
            H_inv[1][0] * g[0] + H_inv[1][1] * g[1],
        ]
        x = [x[0] - dx[0], x[1] - dx[1]]
        history.append(x[:])
        if sum(gi ** 2 for gi in g) < tol:
            break
    return history
```

### Adım 3: Lagrange çarpıcı çözücü

Lagrangian'daki gradient düşüşünü kullanarak kısıtlı optimizasyonu çözün.

```python
def lagrange_solve(f_grad, g_val, g_grad, x0, lr=0.01,
                   lr_lambda=0.01, steps=5000):
    x = list(x0)
    lam = 0.0
    history = []
    for _ in range(steps):
        fg = f_grad(x)
        gv = g_val(x)
        gg = g_grad(x)
        x = [
            xi - lr * (fgi + lam * ggi)
            for xi, fgi, ggi in zip(x, fg, gg)
        ]
        lam = lam + lr_lambda * gv
        history.append((x[:], lam, gv))
    return history
```

### Adım 4: Birinci sırayı ikincisi sıraya karşı karşılaştır

Aynı kare işlevi üzerinde gradient düşüşünü ve Newton'un yöntemini çalıştırın.

```python
def quadratic(x):
    return 5 * x[0] ** 2 + x[1] ** 2

def quadratic_grad(x):
    return [10 * x[0], 2 * x[1]]

def quadratic_hessian(x):
    return [[10, 0], [0, 2]]
```

Newton'un yöntemi 1 adımla (kvadratik için tamdır) birleştiğinde, derecelendirme yüzlerce adım sürecek çünkü Hessian'ın öz değerleri 5 katı farklılık göstererek uzanan bir vadide oluşur.

## Kullan

Çelişkililik analizi, ML modellerini ve çözücüleri seçerken doğrudan uygulanır.

Konves sorunlar için (logistik gerileme, SVM, LASSO):
- Özel çözücüler kullanın (liblinear, CVXPY, scipy.optimize.minimize method='L-BFGS-B')
- Eşsiz bir küresel çözüm bekleyin
- İkinci sırada uygulanabilir ve hızlı yöntemler

Konveks olmayan problemler için (nervüler ağlar):
- İlk sıradaki yöntemleri kullanın (SGD, Adam)
- Çözümün başlangıç ve rastlantıya bağlı olduğunu kabul edin
- İstifadeden dolayı düzenlenme olarak aşırı parametreleştirme, gürültü ve öğrenme hızı programlarını kullanın
- Yerel minimum için zaman harcamayın.

```python
from scipy.optimize import minimize

result = minimize(
    fun=lambda w: sum((y - X @ w) ** 2) + 0.1 * sum(w ** 2),
    x0=np.zeros(d),
    method='L-BFGS-B',
    jac=lambda w: -2 * X.T @ (y - X @ w) + 0.2 * w,
)
```

SVM için, çift formülasyon çekirdek hilesini kullanmanıza olanak tanır:

```python
from sklearn.svm import SVC

svm = SVC(kernel='rbf', C=1.0)
svm.fit(X_train, y_train)
print(f"Support vectors: {svm.n_support_}")
```

## Egzersizler

1. **Convexity gallery.**Bu fonksiyonları kontrol cihazı kullanarak konveksiyet için test edin: $f(x) = x^4$- Evet .$f(x) = \sin(x)$- Evet .$f(x,y) = x^2 + y^2$- Evet .$f(x,y) = xy$- Evet .$f(x) = \max(x, 0)$Her sonuç neden mantıklı olduğunu açıkla.

2. **Newton vs gradient descent race.**Her iki yöntemi de kullan $f(x,y) = 50x^2 + y^2$Başlangıç noktasından $(10, 10)$. Her bir kaybı < 1e-10'a ulaşmak için kaç adım gerekir? Şart sayısının (en büyük Hessian öz değeri oranı) artması halinde gradient düşüşü ne olur?

3. **Lagrange multiplier geometry.**En azını azaltın .$f(x,y) = (x-3)^2 + (y-3)^2$$x + 2y = 4$. Çözümün                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         $f$                                           $g$Çözümde.

4. **Regularization constraint.**L1 kısıtlı optimizasyonu uygulayın: en aza indirmek $(x-3)^2 + (y-2)^2$$\lvert x \rvert + \lvert y \rvert \le 1$. Çözümün sıfır eşit bir koordinatının olduğunu göster (elmas kısıtlamasından ayırt edicilik).

5. **Hessian eigenvalue analysis.**Rosenbrock fonksiyonunun Hessian'ı (1,1) ve (-1,1) ile hesaplayın.

### İpuçlar

**Exercise 1.**Koşmadan önce her sonucu tahmin et .`check_convexity`Bir boyutta, $f''(x)$Hessian'ın öz değerlerine iki boyutta bakın.$f(x,y) = xy$, Hessian'ın öz değerleri 1 ve -1'dir, bu yüzden kontrolcü, konveks olmadığını bildirmelidir.

**Exercise 2.**Arama .`optimize_gd`ve `newtons_method`                        $f$Newton'un yöntemi bir adımla bir kare çözür.$2/100$Çünkü $50x^2$term, yani $y$Yön yavaş hareket eder.$100x^2$Ve adımları tekrar sayın.

**Exercise 3.**Kullanım`lagrange_solve`- Evet .$g(x,y) = x + 2y - 4$Cevabı verip kontrol et.$x + 2y = 4$Ve bu da ...$\nabla f = (2(x-3), 2(y-3))$$\nabla g = (1, 2)$- Evet .

**Exercise 4.**Sınırsız minimum (3, 2) elmasın dışında, bu nedenle cevap onun sınırında.$\lvert x \rvert + \lvert y \rvert \le 1$Sonuç eşitlik ile kısıtlama karşılıyor mu kontrol edin ve karşılaştırın `demo_regularization_geometry`- Evet .

**Exercise 5.**Arama .`rosenbrock_hessian`Her noktada sonuçları `hessian_eigenvalues_2d`. (1, 1)'de her iki öz değer de pozitif ve oranları çok büyüktür, bu nedenle vadisi bir yönde dar ve diğerinde düz.

## Anahtar Terimler

| Term | What it means |
|------|---------------|
| Convex set | A set where the line segment between any two points in the set stays inside the set |
| Convex function | A function where the line between any two points on its graph lies above or on the graph. Equivalently, Hessian is positive semidefinite everywhere |
| Local minimum | A point lower than all nearby points. For convex functions, every local minimum is the global minimum |
| Global minimum | The lowest point of a function over its entire domain |
| Hessian matrix | The matrix of all second partial derivatives. Encodes curvature information |
| Positive semidefinite | A matrix whose eigenvalues are all non-negative. The multidimensional analogue of "second derivative >= 0" |
| Condition number | Ratio of largest to smallest eigenvalue of the Hessian. High condition number means elongated valleys and slow gradient descent |
| Newton's method | Second-order optimizer that uses the inverse Hessian to determine step direction and size. Quadratic convergence near the minimum |
| Lagrange multiplier | A variable introduced to convert a constrained optimization problem into an unconstrained one |
| KKT conditions | Necessary conditions for optimality with inequality constraints. Generalize Lagrange multipliers |
| Complementary slackness | At the solution, either a constraint is active or its multiplier is zero. Never both nonzero |
| Duality | Every constrained problem has a companion dual problem. For convex problems, both have the same optimal value |
| Strong duality | Primal and dual optimal values are equal. Holds for convex problems satisfying Slater's condition |
| L-BFGS | Approximate second-order method that stores the last $m$ gradient differences instead of the full Hessian |
| Saddle point | A point where the gradient is zero but it is a minimum in some directions and a maximum in others |
| Overparameterization | Using more parameters than training examples. Smooths the loss landscape and reduces bad local minima |

## Daha Fazla Okumak

- [Boyd & Vandenberghe: Convex Optimization](https://web.stanford.edu/~boyd/cvxbook/)- standart ders kitabı, internette ücretsiz olarak kullanılabilir
- [Bottou, Curtis, Nocedal: Optimization Methods for Large-Scale Machine Learning (2018)](https://arxiv.org/abs/1606.04838)- Köprüler, konveks optimizasyon teorisi ve derin öğrenme uygulaması
- [Choromanska et al.: The Loss Surfaces of Multilayer Networks (2015)](https://arxiv.org/abs/1412.0233)- neden konveks olmayan sinir ağları manzaraları görünüşleri kadar kötü değil
- [Nocedal & Wright: Numerical Optimization](https://link.springer.com/book/10.1007/978-0-387-40065-5)- Newton'un yöntemi, L-BFGS ve kısıtlı optimizasyon için kapsamlı bir referans
