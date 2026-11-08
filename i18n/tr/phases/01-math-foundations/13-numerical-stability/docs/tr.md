# Sayısal Kararlılık

> Dalga geçiş noktası, sızdırıcı bir soyutlama.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 01-04
**Time:** ~120 minutes

## Öğrenme Hedefleri

- Maksimum çıkarma hilesini kullanarak sayısal olarak stabil softmax ve log-sum-exp uygulamak
- Akış, akış ve felaket iptalinin yüzen nokta hesaplamalarında belirlenmesi
- Merkezli sınırlı farkları kullanarak analitik gradientleri sayısal gradientlere karşı doğrula
- Bfloat16'ın eğitim için float16'a neden tercih edildiğini ve kayıp ölçeklemesinin gradient akışının aşağı akışını nasıl engellediğini açıklayın.

## Sorun

Model trenleriniz üç saat boyunca, sonra kaybınız NaN olur.`inf`9.002 adımla her bir eğilimi `nan`Eğitim bitti.

Ya da: modeliniz tamamlanmaya hazır ama doğruluk kağıt iddialarından% 2 daha kötü. Her şeyi kontrol ediyorsunuz. Mimarlık eşleşir. Hiperparametre eşleşir. Veriler eşleşir. Sorun şu ki kağıt float32 kullanmış ve siz de doğru ölçeklendirme yapmadan float16 kullanmışsınız.

Ya da: sıfırdan çapraz entropi kaybı uyguluyorsunuz. Küçük logitlerde çalışır.`inf`- Yumuşaklık aşırı aktı çünkü`exp(100)`Bu, bir iki satırlık numara ile işlenir.

Sayısal istikrar teorik bir sorun değil. Başarılı bir eğitim koşusu ile sessiz bir şekilde başarısız olan bir eğitim koşusu arasındaki fark.

## Anlaşım

### IEEE 754: Bilgisayarlar Gerçek Sayıları Nasıl Saklar

Bilgisayarlar IEEE 754 standardına göre gerçek sayıları yüzen nokta değerleri olarak kaydetir.

```
Float32 layout (32 bits total):
[1 sign] [8 exponent] [23 mantissa]

Value = (-1)^sign * 2^(exponent - 127) * 1.mantissa
```

Mantissa, hassasiyet (ne kadar önemli rakam) belirler. Eksponent aralığı (bir sayı ne kadar büyük veya küçük olabileceğini) belirler.

```
Format     Bits   Exponent  Mantissa  Decimal digits  Range (approx)
float64    64     11        52        ~15-16          +/- 1.8e308
float32    32     8         23        ~7-8            +/- 3.4e38
float16    16     5         10        ~3-4            +/- 65,504
bfloat16   16     8         7         ~2-3            +/- 3.4e38
```

float32 size yaklaşık 7 onluk rakamlı bir doğruluk gösterir. Bu 1.0000001 ile 1.0000002 arasında ayrım yapabilir, ancak 1.00000001 ile 1.00000002 arasında ayrım yapamaz.

float16 size yaklaşık 3 rakam verir. en büyük sayı 65,504'dir. Bu, logitlerin, gradientlerin ve aktivasyonların rutin olarak bunu aşması için ML için rahatsız edici derecede küçüktür.

bfloat16 Google'ın float16'ın aralığı sorunu için verdiği cevap. float32 ile aynı 8 bitli bir gösterge (eşit aralığı, 3.4e38) ama sadece 7 mantissa bit (float16'dan daha az hassasiyet) vardır.

### Neden 0,1 + 0,2 != 0,3

0.1 sayı tam olarak ikili yüzen noktada temsil edilemez.

```
0.1 in binary = 0.0001100110011001100110011... (repeating forever)
```

Float32 bunu 23 bit mantissa'ya kısaltır. Kaydedilen değer yaklaşık 0.100000001490116. Benzer şekilde 0.2 yaklaşık 0.200000002980232 olarak kaydedilir.

```
In Python:
>>> 0.1 + 0.2
0.30000000000000004

>>> 0.1 + 0.2 == 0.3
False
```

ML için önemli olan bu:

1. Kayıp karşılaştırmaları gibi`if loss < threshold`Yanlış cevaplar verebilir.
2. Birçok küçük değer (binlerce adım boyunca aşamalı güncellemeler) birikimi gerçek toplamdan uzaklaştırılır
3.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              `==`

Düzene: asla akıntıları `==`Kullan .`abs(a - b) < epsilon`veya `math.isclose()`- Evet .

### Fena İptal

İki neredeyse eşit yüzen nokta sayısını çıkarırsanız, önemli rakamlar iptal edilir ve yuvarlak gürültü ileri rakamlara yükseltilmiş kalır.

```
a = 1.0000001    (stored as 1.00000011920929 in float32)
b = 1.0000000    (stored as 1.00000000000000 in float32)

True difference:  0.0000001
Computed:         0.00000011920929

Relative error: 19.2%
```

Bu, tek bir çıkarmadan elde edilen %19 oranlı bir hata. ML'de, bu her zaman olur:

- Büyük ortalama ile verilerin değişkenliğini hesaplayın: $\mathbb{E}[x^2] - \mathbb{E}[x]^2$Ne zaman ?$\mathbb{E}[x]$büyük
- Yaklaşık eşit log olasılığı çıkar
- Çok küçük epsilon ile son fark gradiyenti hesaplayın

Düzeltme: büyük, neredeyse eşit sayıları çıkarmaktan kaçınmak için formülleri yeniden düzenleyin. Değişiklik için önce Welford algoritmasını veya verileri merkeze edin.

### Aşırı Akış ve Alt Akış

Bir sonuç temsil edilecek kadar büyük olduğunda aşırı akış oluşur. Düşük akış çok küçük olduğunda oluşur (en küçük temsil edilebilir olumlu sayıdan sıfıra yakın).

```
Float32 boundaries:
  Maximum:  3.4028235e+38
  Minimum positive (normal): 1.175e-38
  Minimum positive (denorm): 1.401e-45
  Overflow:  anything > 3.4e38 becomes inf
  Underflow: anything < 1.4e-45 becomes 0.0
```

- Evet .`exp()`işlevi, ML'de aşırı akışın ana kaynağıdır:

```
exp(88.7)  = 3.40e+38   (barely fits in float32)
exp(89.0)  = inf         (overflow)
exp(-87.3) = 1.18e-38   (barely above underflow)
exp(-104)  = 0.0         (underflow to zero)
```

- Evet .`log()`İşlev diğer yöne doğru geçer:

```
log(0.0)   = -inf
log(-1.0)  = nan
log(1e-45) = -103.3      (fine)
log(1e-46) = -inf        (input underflowed to 0, then log(0) = -inf)
```

ML'de, `exp()`softmax, sigmoid ve olasılık hesaplamalarında ortaya çıkar. `log()`Bu, çapraz entropi, log-e benzerlik ve KL farklılıklarında ortaya çıkar.`log(exp(x))`Doğru numaralar olmadan bir mayın alanı.

### Log-Sum-Exp Trick

Bilgisayar `log(sum(exp(x_i)))`- Bu sayısal olarak tehlikeli.`x_i`büyüktür.`exp(x_i)`Eğer hepsi `x_i`Çok negatif, her zaman.`exp(x_i)`sıfırdan aşağı akışlar ve `log(0)`- Evet .`-inf`- Evet .

İşin tek yolu, eksponenciyalanmadan önce maksimum değeri çıkarmak.

```math
\log\left(\sum_i \exp(x_i)\right) = \max(x) + \log\left(\sum_i \exp(x_i - \max(x))\right)
```

Neden bu işe yarıyor: çıkarmadan sonra `max(x)`, en büyük gösterge `exp(0) = 1`. Üstü akış mümkün değildir. toplamda en az bir terim 1'dir, bu yüzden toplam en az 1'dir ve `log(1) = 0`- Akış yok .`-inf`- Bu mümkün.

Kanıt:

```math
\begin{aligned}
& \log\left(\sum_i \exp(x_i)\right) \\
&= \log\left(\sum_i \exp(x_i - c + c)\right) && \text{(add and subtract } c\text{)} \\
&= \log\left(\sum_i \exp(x_i - c) \cdot \exp(c)\right) && (\exp(a+b) = \exp(a) \cdot \exp(b)) \\
&= \log\left(\exp(c) \cdot \sum_i \exp(x_i - c)\right) && \text{(factor out } \exp(c)\text{)} \\
&= c + \log\left(\sum_i \exp(x_i - c)\right) && (\log(a \cdot b) = \log(a) + \log(b))
\end{aligned}
```

Yapıştır `c = max(x)`Ve aşırı akış ortadan kalktı.

Bu numara ML'de her yerde görünebilir:
- Softmax normalleşmesi
- Çarpıcı entropik kaybı hesaplaması
- Kayıt olasılıklarının sırayla modellerde toplamı
- Gaussiler karışımı
- Değişiklik sonucu

### Softmax'ın Max-Kürtme Trick'e Neden İhtiyacı Var ?

Softmax logitleri olasılıklara dönüştürür:

```math
\mathop{\mathrm{softmax}}(x_i) = \frac{\exp(x_i)}{\sum_j \exp(x_j)}
```

Bu hile olmadan, [100, 101, 102] logitleri aşırı akışa neden olur:

```
exp(100) = 2.69e43
exp(101) = 7.31e43
exp(102) = 1.99e44
sum      = 2.99e44

2.69e43 > 3.4e38, the float32 maximum, so every term overflows.
exp(88.7) is already at the float32 limit.
exp(100) = inf in float32.
```

Bu numarayla maksimum x = 102'yi çıkarın.

```
exp(100 - 102) = exp(-2) = 0.135
exp(101 - 102) = exp(-1) = 0.368
exp(102 - 102) = exp(0)  = 1.000
sum = 1.503

softmax = [0.090, 0.245, 0.665]
```

Muhtemelen aynıdır. Hesaplama güvenli. Bu bir optimizasyon değil. Doğru bir şart.

### NaN ve Inf: tespit ve önleme

`nan`(Bir Sayı değil) ve `inf`(Bekayolu) hesaplama yoluyla virüs yoluyla yayılır.`nan`Bir gradient güncelleme ağırlığı yapar `nan`, bu da sonraki tüm çıkışları yapar .`nan`Eğitim bir adımdan sonra biter.

Nasıl ?`inf`Görünür:
- `exp()`büyük bir pozitif sayının
- 0 ile bölün: `1.0 / 0.0`
- `float32`toplanmalarda aşırı akış

Nasıl ?`nan`Görünür:
- `0.0 / 0.0`
- `inf - inf`
- `inf * 0`
- `sqrt()`negatif bir sayı
- `log()`negatif bir sayı
- Var olan bir matematikle ilgili herhangi bir aritmetik `nan`

İzleme:

```python
import math

math.isnan(x)       # True if x is nan
math.isinf(x)       # True if x is +inf or -inf
math.isfinite(x)    # True if x is neither nan nor inf
```

Önleme stratejileri:

1.          `exp()`- Evet .`exp(clamp(x, -80, 80))`
2. Epsilon isimlendirici ekle: `x / (y + 1e-8)`
3. İçeride epsilon ekleyin `log()`- Evet .`log(x + 1e-8)`
4. Kalıcı uygulamalar kullanın (log-sum-exp, stabil softmax)
5. Ağırlık patlaması önlemek için dereceli kesim
6. Kontrol et .`nan`- Ne ?`inf`Debug sırasında her ileri geçişten sonra

### Sayısal Gradyant Kontrolü

Analizsel gradientler (geri yayılma) hatalara sahip olabilir. Sayısal gradient kontrolü onları sınırlı farklılıklara sahip gradientleri hesaplayarak doğruluyor.

Merkezi fark formülü:

```math
\frac{df}{dx} \approx \frac{f(x + h) - f(x - h)}{2h}
```

Bu ...$O(h^2)$- Evet. - Evet.$(f(x+h) - f(x)) / h$Bu sadece $O(h)$- Evet .

Seçim$h$Bu nedenle, bu konuyla ilgili bir görüşü daha da genişletmek için, bu konuyla ilgili bir görüşü daha da genişletmek için, bu konuyla ilgili bir görüşü daha da genişletmek için, bu konuyla ilgili bir görüşü daha da genişletmek için, bu konuyla ilgili bir görüşü daha da genişletmek için, bu konuyla ilgili bir görüşü daha da genişletmek için, bu konuyla ilgili bir görüşü daha da genişletmek için, bu konuyla ilgili bir görüşü daha da genişletmek için, bu konuyla ilgili bir görüşü daha da genişletmek için, bu konuyla ilgili bir görüşü daha da genişletmek için, bu konuyla ilgili bir görüşü daha da genişletmek için, bu konuyla ilgili bir görüşü daha da genişletmek için, bu konuyla ilgili bir görüşü daha da genişletmek için, bu konuyla ilgili bir çözüm de daha fazla bir çözüm olarak, bir çözüm olarak, bir çözüm olarak, bir çözüm olarak, bir çözüm olarak, bir çözüm olarak, bir çözüm olarak, bir çözüm olarak, bir çözüm olarak, bir çözüm olarak, bir çözüm olarak, bir şekilde, bir çözüm olarak, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, ve, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, ve, bir şekilde, bir şekilde, bir şekilde, bir şekilde, bir şekilde, ve, bir şekilde, bir şekilde`h = 1e-5`- ...`1e-7`Tipik bir durum.

Kontrol: analitik ve sayısal gradientler arasındaki göreceli farkı hesaplayın.

```math
\text{relative\_error} = \frac{\lvert \text{grad}_{\text{analytical}} - \text{grad}_{\text{numerical}} \rvert}{\max(\lvert \text{grad}_{\text{analytical}} \rvert, \lvert \text{grad}_{\text{numerical}} \rvert, 10^{-8})}
```

Basamak kuralları:
- relative_error < 1e-7: mükemmel, gradient doğru
- relative_error < 1e-5: kabul edilebilir, muhtemelen doğru
- relative_error > 1e-3: bir şey yanlış
- relative_error > 1: gradient tamamen yanlış

Yeni bir katman veya kaybı işlevi uygulandığında her zaman gradientleri kontrol edin. PyTorch `torch.autograd.gradcheck()`Bu yüzden.

### Karışık Düzgünlük Eğitimleri

Modern GPU'lar float16 matris çarpımlarını float32'den 2-8 kat daha hızlı hesaplayan özel donanımlara (Tensor Cores) sahiptir.

```
1. Maintain float32 master copy of weights
2. Forward pass in float16 (fast)
3. Compute loss in float32 (prevents overflow)
4. Backward pass in float16 (fast)
5. Scale gradients to float32
6. Update float32 master weights
```

Temiz float16 eğitiminde sorun: gradientler genellikle çok küçüktür (1e-8 veya daha küçük). Float16 ~ 6e-8'den aşağı herhangi bir şeyi sıfıra kadar akıtır.

Çözüm kaybı ölçeklemesi:

```
1. Multiply loss by a large scale factor (e.g., 1024)
2. Backward pass computes gradients of (loss * 1024)
3. All gradients are 1024x larger (pushed above float16 underflow)
4. Divide gradients by 1024 before updating weights
5. Net effect: same update, but no underflow
```

Dinamik kayıp ölçekleme otomatik olarak ölçek faktörü ayarlar. Büyük bir değerle başlayın (65536).`inf`- Yarıya ayır.$N$Aşırı aşmadan adımlar geçiyor, iki katına çıkıyor.

### Bfloat16 vs. Float16: Neden Bfloat16 Yararlar

```
float16:   [1 sign] [5 exponent]  [10 mantissa]
bfloat16:  [1 sign] [8 exponent]  [7 mantissa]
```

float16 daha fazla hassaslığa sahiptir (10 mantissa bit vs 7) ancak sınırlı aralığı vardır (maksimum ~65,504). bfloat16 daha az hassaslığa sahiptir ancak float32 ile aynı aralığı vardır (maksimum ~3.4e38).

Nöral ağların eğitimi için:

- Eğitim zirveleri sırasında etkinleştirmeler ve logitler düzenli olarak 65.504'i aşar. float16 overflows; bfloat16 onu ele alır.
- Kayıp ölçeklemesi float16 ile gereklidir, ancak genellikle bfloat16 ile gereksizdir, çünkü aralığı gradient büyüklük spektrumu kapsar.
- bfloat16 float32'nin basit bir kesimi: mantissa'nın alt 16 bitini düşür.

float16 değerlerin sınırlı olduğu ve hassasiyet daha önemli olduğu yerlerde çıkarım için tercih edilir. bfloat16 aralığın daha önemli olduğu yerlerde eğitim için tercih edilir. Bu nedenle TPU'lar ve modern NVIDIA GPU'lar (A100, H100) native bfloat16 desteğine sahiptir.

### Aralıklı kesim

Patlama gradientleri, gradientlerin birden fazla katman boyunca (RNN'lerde, derin ağlarda ve transformörlerde yaygın) eksponensial olarak büyüdüğünde meydana gelir.

İki tür kesim:

**Clip by value:**Her gradient elementini bağımsız olarak sıkıştır.

```
grad = clamp(grad, -max_val, max_val)
```

Basit ama gradient vektörünün yönünü değiştirebilir.

**Clip by norm:**Tüm gradient vektörünü ölçerek normunu bir eşiği aşamaz.

```
if ||grad|| > max_norm:
    grad = grad * (max_norm / ||grad||)
```

Bu, ırmakların eğilimi yönünü korur.`torch.nn.utils.clip_grad_norm_()`Bu standart bir seçim.

Tipik değerler: `max_norm=1.0`transformatörler için, `max_norm=0.5`RL için, `max_norm=5.0`Daha basit ağlar için.

Bu bir güvenlik mekanizmasıdır.Bunu yapmadan, tek bir atış bileşimi haftalarca eğitimini mahvedecek kadar büyük bir atış üretebilir.

### Normalleşme katmanları sayısal stabilizatör olarak

Batch normallendirme, katman normallendirme ve RMS normallendirme genellikle eğitimlerin birleştiğine yardımcı olan düzenleyiciler olarak sunulur.

Normalleşme olmadan, aktivasyonlar katmanlar üzerinden eksponansiel olarak büyüyebilir veya küçülebilir:

```
Layer 1: values in [0, 1]
Layer 5: values in [0, 100]
Layer 10: values in [0, 10,000]
Layer 50: values in [0, inf]
```

Normalleştirme modernleştiriciler ve her katman üzerinde yeniden ölçeklendirme aktivasyonları:

```math
\mathop{\mathrm{LayerNorm}}(x) = \frac{x - \mathop{\mathrm{mean}}(x)}{\mathop{\mathrm{std}}(x) + \epsilon} \cdot \gamma + \beta
```

- Evet .`epsilon`(genellikle 1e-5) tüm aktivasyonlar aynı olduğunda sıfırla bölünmeyi engeller.`gamma`ve `beta`Ağın ihtiyaç duyduğu herhangi bir ölçekini geri getirmesine izin verin.

Bu, değerleri ağ boyunca sayısal olarak güvenli bir aralığında tutar ve hem ileri geçideki hem de geri geçideki eğri patlamanın hem de aşırı akışın önlenir.

### Genel ML Sayı Hataları

**Bug: Loss is NaN after a few epochs.**
Sebep: logitler çok büyük, softmax aşırı aktı. Ya da öğrenme hızı çok yüksek ve ağırlıklar farklıydı.
Düzeltme: sabit softmax (maksimum çıkarma) kullanın, öğrenme hızını azaltın, gradient kesimi ekleyin.

**Bug: Loss is stuck at log(num_classes).**
Sebep: model çıkışları neredeyse aynı olasılıklardır. Genellikle gradientlerin kaybolduğu veya modelin hiç öğrenmediği anlamına gelir.
Düzeltme: Veri etiketlerinin doğru olup olmadığını kontrol edin, kayıp işlevi doğrulayın, ölü RELU'ları kontrol edin.

**Bug: Validation accuracy is lower than expected by 1-3%.**
Sebep: uygun bir kayıp ölçeklemesi olmadan karışık hassasiyet.
Düzeltme: dinamik kayıp ölçeklemesini etkinleştir veya bfloat16'a geçin.

**Bug: Gradient norms are 0.0 for some layers.**
Sebep: ölü ReLU nöronları (tüm girişler negatif) veya float16 akış altındaki akış.
Düzeltme: LeakyReLU veya GELU kullanın, gradient ölçeklemesini kullanın, ağırlık başlangıçını kontrol edin.

**Bug: Model works on one GPU but gives different results on another.**
Sebep: belirlenmez yüzen nokta birikimi sırası. GPU paralel azaltmaları farklı donanımlarda farklı sırada toplamlanır ve yüzen nokta eklenmesi ilişkili değildir.
Düzeltme: küçük farkları kabul edin (1e-6), veya ayarlayın `torch.use_deterministic_algorithms(True)`Ve hız cezasını kabul et.

**Bug: `exp()` returns `inf` in loss computation.**
Sebep: Hızlı malzeme `exp()`Maksimum çıkarma hilesi olmadan.
Düzeltme: kullan `torch.nn.functional.log_softmax()`Bu da log-sum-exp'i içtenlikle uyguluyor.

**Bug: Training diverges after switching from float32 to float16.**
Sebep: float16 6e-8'den aşağıdaki gradient büyüklüklerini veya 65,504'ten yüksek aktivasyonları temsil edemez.
Düzeltme: Kayıp ölçeklemesi (AMP) ile karışık hassaslık kullanın veya bunun yerine bfloat16 kullanın.

```figure
logsumexp-stability
```

## Yapın

### Adım 1: Sürükleyici noktaların doğruluk sınırlarını göster

```python
print("=== Floating Point Precision ===")
print(f"0.1 + 0.2 = {0.1 + 0.2}")
print(f"0.1 + 0.2 == 0.3? {0.1 + 0.2 == 0.3}")
print(f"Difference: {(0.1 + 0.2) - 0.3:.2e}")
```

### Adım 2: Naif vs. sabit softmax uygulamak

```python
import math

def softmax_naive(logits):
    exps = [math.exp(z) for z in logits]
    total = sum(exps)
    return [e / total for e in exps]

def softmax_stable(logits):
    max_logit = max(logits)
    exps = [math.exp(z - max_logit) for z in logits]
    total = sum(exps)
    return [e / total for e in exps]

safe_logits = [2.0, 1.0, 0.1]
print(f"Naive:  {softmax_naive(safe_logits)}")
print(f"Stable: {softmax_stable(safe_logits)}")

dangerous_logits = [100.0, 101.0, 102.0]
print(f"Stable: {softmax_stable(dangerous_logits)}")
# softmax_naive(dangerous_logits) would return [nan, nan, nan]
```

### Adım 3: Durgan log-sum-exp uygulaması

```python
def logsumexp_naive(values):
    return math.log(sum(math.exp(v) for v in values))

def logsumexp_stable(values):
    c = max(values)
    return c + math.log(sum(math.exp(v - c) for v in values))

safe = [1.0, 2.0, 3.0]
print(f"Naive:  {logsumexp_naive(safe):.6f}")
print(f"Stable: {logsumexp_stable(safe):.6f}")

large = [500.0, 501.0, 502.0]
print(f"Stable: {logsumexp_stable(large):.6f}")
# logsumexp_naive(large) returns inf
```

### 4. Adım: Dayanıklı çapraz entropi uygula

```python
def cross_entropy_naive(true_class, logits):
    probs = softmax_naive(logits)
    return -math.log(probs[true_class])

def cross_entropy_stable(true_class, logits):
    max_logit = max(logits)
    shifted = [z - max_logit for z in logits]
    log_sum_exp = math.log(sum(math.exp(s) for s in shifted))
    log_prob = shifted[true_class] - log_sum_exp
    return -log_prob

logits = [2.0, 5.0, 1.0]
true_class = 1
print(f"Naive:  {cross_entropy_naive(true_class, logits):.6f}")
print(f"Stable: {cross_entropy_stable(true_class, logits):.6f}")
```

### Adım 5: Aralıklı kontrol

```python
def numerical_gradient(f, x, h=1e-5):
    grad = []
    for i in range(len(x)):
        x_plus = x[:]
        x_minus = x[:]
        x_plus[i] += h
        x_minus[i] -= h
        grad.append((f(x_plus) - f(x_minus)) / (2 * h))
    return grad

def check_gradient(analytical, numerical, tolerance=1e-5):
    for i, (a, n) in enumerate(zip(analytical, numerical)):
        denom = max(abs(a), abs(n), 1e-8)
        rel_error = abs(a - n) / denom
        status = "OK" if rel_error < tolerance else "FAIL"
        print(f"  param {i}: analytical={a:.8f} numerical={n:.8f} "
              f"rel_error={rel_error:.2e} [{status}]")

def f(params):
    x, y = params
    return x**2 + 3*x*y + y**3

def f_grad(params):
    x, y = params
    return [2*x + 3*y, 3*x + 3*y**2]

point = [2.0, 1.0]
analytical = f_grad(point)
numerical = numerical_gradient(f, point)
check_gradient(analytical, numerical)
```

## Kullan

### Karışık hassaslık simülasyonu

```python
import struct

def float32_to_float16_round(x):
    packed = struct.pack('f', x)
    f32 = struct.unpack('f', packed)[0]
    packed16 = struct.pack('e', f32)
    return struct.unpack('e', packed16)[0]

def simulate_bfloat16(x):
    packed = struct.pack('f', x)
    as_int = int.from_bytes(packed, 'little')
    truncated = as_int & 0xFFFF0000
    repacked = truncated.to_bytes(4, 'little')
    return struct.unpack('f', repacked)[0]
```

### Sıfırlama

```python
def clip_by_norm(gradients, max_norm):
    total_norm = math.sqrt(sum(g**2 for g in gradients))
    if total_norm > max_norm:
        scale = max_norm / total_norm
        return [g * scale for g in gradients]
    return gradients

grads = [10.0, 20.0, 30.0]
clipped = clip_by_norm(grads, max_norm=5.0)
print(f"Original norm: {math.sqrt(sum(g**2 for g in grads)):.2f}")
print(f"Clipped norm:  {math.sqrt(sum(g**2 for g in clipped)):.2f}")
print(f"Direction preserved: {[c/clipped[0] for c in clipped]} == {[g/grads[0] for g in grads]}")
```

### NaN/Inf tespit

```python
def check_tensor(name, values):
    has_nan = any(math.isnan(v) for v in values)
    has_inf = any(math.isinf(v) for v in values)
    if has_nan or has_inf:
        print(f"WARNING {name}: nan={has_nan} inf={has_inf}")
        return False
    return True

check_tensor("good", [1.0, 2.0, 3.0])
check_tensor("bad",  [1.0, float('nan'), 3.0])
check_tensor("ugly", [1.0, float('inf'), 3.0])
```

Bakın .`code/numerical.py`Tüm kenar durumları gösterilen tam uygulamalar için.`code/numerical.ts`Aynı fonksiyon ve demo ile bir TypeScript portu.

## Gönder

Bu ders şunları ortaya çıkarır:
- `code/numerical.py`Kalıcı softmax, log-sum-exp, çapraz entropi, gradient kontrolü ve karışık hassaslık simülasyonu ile
- `outputs/prompt-numerical-debugger.md`eğitimde NaN/Inf ve sayısal sorunların teşhis edilmesi için

Bu istikrarlı uygulamalar eğitim döngüsünün oluşturulmasında 3. aşamada ve dikkat mekanizmaları uygulmasında 4. aşamada tekrar ortaya çıkar.

## Egzersizler

1. **Catastrophic cancellation.**Naif formülü kullanarak [1000000.0, 1000001.0, 1000002.0] değişikliğini hesaplayın $\mathbb{E}[x^2] - \mathbb{E}[x]^2$Sonra Welford'un çevrimiçi algoritmasını kullanarak hesaplayın.

2. **Precision hunt.**En küçük pozitif float32 değerini bul `x`Bu kadar .`1.0 + x == 1.0`Python'da. Bu makine epsilon.`numpy.finfo(numpy.float32).eps`- Evet .

3. **Log-sum-exp edge cases.**Testini yap .`logsumexp_stable`Bu, (a) tüm değerlerin eşit olması, (b) diğerlerinden çok daha büyük bir değer olması, (c) tüm değerlerin çok negatif olması (-1000) ile birlikte geçerlidir.

4. **Gradient checking a neural network layer.**Tek bir çizgi katmanı uygula `y = Wx + b`ve analitik geriye geçişini.`numerical_gradient`3x2 ağırlık matrisinin doğruluğunu kontrol etmek için.

5. **Loss scaling experiment.**float16 ile eğitim simülasyonu: [1e-9, 1e-3 aralığında rastgele gradientler oluşturun, float16'a dönüştürün ve hangi fraksiyon sıfır haline geldiğini ölçün.

### İpuçlar

**Exercise 1.**Üç değerini  ile dönüştür`np.float32`Onları düzeltmeden önce, sonra aramak.`variance_naive`ve `welford_variance`- Yaklaşık bir değer .$10^{12}$float32'de 1'den çok daha büyük bir mesafe var, bu yüzden saf sonuç 0.6667'den uzak ve Welford sonucu yakın olmasını bekleyin.

**Exercise 2.**Başlayın .`x = np.float32(1.0)`Ve yarıya kadar kes .`np.float32(1.0) + x != np.float32(1.0)`. Her değerini float32'de tut ve son değerini karşılaştır.`numpy.finfo(numpy.float32).eps`, yani $2^{-23}$- Evet .

**Exercise 3.**Önce her cevabı tahmin et.$n$eşit değerler $c$Sonuç şu:$c + \ln n$Bir büyük değer için, sonuç bu değerle yakın. -1000 yakın değerler için, sonuç yakın $-1000 + \ln n$,`logsumexp_naive`Devamı`-inf`Çünkü her eksponensal 0'a düşüyor.

**Exercise 4.**- Evet .$y = Wx + b$Kayıplarla.$L$,  için eğrilik$W$                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             $x$- Kayıpları düzeltme fonksiyonu olarak sarın .$W$- Arayın .`numerical_gradient`, ve her iki sonucu da `check_gradient`- Evet .

**Exercise 5.**Büyüklükleri bir log ölçeğinde örnekleyin .`10 ** np.random.uniform(-9, -3, n)`ve dönüştürmek için `np.float16`. Float16 değerleri yaklaşık olarak aşağıda tutamaz .$6 \times 10^{-8}$Bu nedenle, değerlerin yaklaşık dörtte biri ölçeklendirmeden önce sıfır olur ve 1024 ile çarpıldıktan sonra neredeyse hiç olmaz.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| IEEE 754 | "The float standard" | International standard defining binary floating point formats, rounding rules, and special values (inf, nan). Every modern CPU and GPU implements it. |
| Machine epsilon | "The precision limit" | The smallest value $e$ such that $1.0 + e \ne 1.0$ in a given float format. For float32, it is about 1.19e-7. |
| Catastrophic cancellation | "Precision loss from subtraction" | When subtracting nearly equal floating point numbers, significant digits cancel and rounding noise dominates the result. |
| Overflow | "Number too big" | A result exceeds the maximum representable value and becomes inf. exp(89) overflows float32. |
| Underflow | "Number too small" | A result is closer to zero than the smallest representable positive number and becomes 0.0. exp(-104) underflows float32. |
| Log-sum-exp trick | "Subtract the max first" | Computing $\log(\sum \exp(x))$ by factoring out $\exp(\max(x))$ to prevent overflow and underflow. Used in softmax, cross-entropy, and log-probability math. |
| Stable softmax | "Softmax that does not explode" | Subtracting $\max(\text{logits})$ before exponentiating. Numerically identical result, no overflow possible. |
| Gradient checking | "Verify your backprop" | Comparing analytical gradients from backpropagation against numerical gradients from finite differences to catch implementation bugs. |
| Mixed precision | "Float16 forward, float32 backward" | Using lower-precision floats for speed-critical operations and higher-precision floats for numerically sensitive operations. Typical speedup is 2-3x. |
| Loss scaling | "Prevent gradient underflow" | Multiplying the loss by a large constant before backprop so gradients stay in float16's representable range, then dividing by the same constant before weight updates. |
| bfloat16 | "Brain floating point" | Google's 16-bit format with 8 exponent bits (same range as float32) and 7 mantissa bits (less precision than float16). Preferred for training. |
| Gradient clipping | "Cap the gradient norm" | Scaling the gradient vector so its norm does not exceed a threshold. Prevents exploding gradients from ruining weights. |
| NaN | "Not a Number" | Special float value from undefined operations (0/0, inf-inf, sqrt(-1)). Propagates through all subsequent arithmetic. |
| Inf | "Infinity" | Special float value from overflow or division by zero. Can combine to produce NaN (inf - inf, inf * 0). |
| Numerical gradient | "Brute force derivative" | Approximating a derivative by evaluating $f(x+h)$ and $f(x-h)$ and dividing by $2h$. Slow but reliable for verification. |

## Daha Fazla Okumak

- [What Every Computer Scientist Should Know About Floating-Point Arithmetic (Goldberg 1991)](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html)-- kesin referans, yoğun ama tam
- [Mixed Precision Training (Micikevicius et al., 2018)](https://arxiv.org/abs/1710.03740)-- float16 eğitiminde kaybı ölçeklemeyi tanıtan NVIDIA makalesinde
- [AMP: Automatic Mixed Precision (PyTorch docs)](https://pytorch.org/docs/stable/amp.html)-- PyTorch'de karışık hassaslık için pratik rehber
- [bfloat16 format (Google Cloud TPU docs)](https://cloud.google.com/tpu/docs/bfloat16)-- Google neden TPU'lar için bu biçimi seçti
- [Kahan Summation (Wikipedia)](https://en.wikipedia.org/wiki/Kahan_summation_algorithm)-- yüzen nokta toplamlarında yuvarlanma hatasını azaltmak için algoritma
