# Sayısal Kararlılık

> Kayan nokta sızdıran bir soyutlamadır. Eğitim sırasında sizi ısıracak ve geldiğini görmeyeceksiniz.

**Tür:** Yapım
**Dil:** Python
**Önkoşullar:** Aşama 1, Dersler 01-04
**Süre:** ~120 dakika

## Öğrenme Hedefleri

- Maksimum çıkarma hilesini kullanarak sayısal olarak kararlı softmax ve log-sum-exp'yi uygulayın
- Kayan nokta hesaplamalarında taşma, yetersiz akış ve yıkıcı iptali belirleyin
- Merkezi sonlu farkları kullanarak analitik gradient'leri sayısal gradient'lere karşı doğrulayın
- Eğitim için float16'ya neden bfloat16'nın tercih edildiğini ve kayıp ölçeklendirmenin gradient taşmayı nasıl önlediğini açıklayın

## Sorun

Modeliniz üç saat boyunca antrenman yapıyor, ardından kayıp NaN oluyor. Bir yazdırma ifadesi eklersiniz. Logitler 9.000. adımda gayet iyi. 9.001. adımda bunlar `inf`'dir. 9.002. adıma göre her gradient, `nan`'dir ve eğitim sona ermiştir.

Veya: Modeliniz tamamlanmak üzere eğitiliyor ancak doğruluk, kağıtta iddia edilenlerden %2 daha kötü. Sen her şeyi kontrol et. Mimari eşleşir. Hiperparametreler eşleşiyor. Veriler eşleşiyor. Sorun, kağıdın float32 kullanması ve sizin float16'yı doğru ölçeklendirme olmadan kullanmanızdır. Otuz iki bitlik birikmiş yuvarlama hatası, doğruluğunuzu sessizce tüketti.

Veya: çapraz entropi kaybını sıfırdan uygularsınız. Küçük logitlerde çalışır. Logitler 100'ü aştığında `inf` değerini döndürür. Softmax taştı çünkü `exp(100)`, float32'nin temsil edebileceğinden daha büyük. Her ML framework bunu iki satırlık bir numarayla ele alır. Bu hilenin var olduğunu bilmiyordun.

Sayısal kararlılık teorik bir konu değildir. Başarılı bir eğitim koşusu ile sessizce başarısız olan bir eğitim koşusu arasındaki farktır. Hata ayıklayacağınız her ciddi makine öğrenimi hatası, eninde sonunda kayan noktaya iner.

## Konsept

### IEEE 754: Bilgisayarlar Gerçek Sayıları Nasıl Saklar?

Bilgisayarlar gerçek sayıları IEEE 754 standardına uygun olarak kayan nokta değerleri olarak saklar. Bir kayan noktanın üç bölümü vardır: bir işaret biti, bir üs ve bir mantis (anlamlı).

```
Float32 layout (32 bits total):
[1 sign] [8 exponent] [23 mantissa]

Value = (-1)^sign * 2^(exponent - 127) * 1.mantissa
```

Mantis kesinliği (kaç anlamlı basamak) belirler. Üs aralığı (bir sayının ne kadar büyük veya küçük olabileceğini) belirler.

```
Format     Bits   Exponent  Mantissa  Decimal digits  Range (approx)
float64    64     11        52        ~15-16          +/- 1.8e308
float32    32     8         23        ~7-8            +/- 3.4e38
float16    16     5         10        ~3-4            +/- 65,504
bfloat16   16     8         7         ~2-3            +/- 3.4e38
```

float32 size yaklaşık 7 ondalık basamak hassasiyeti verir. Bu, 1,0000001 ve 1,0000002'yi ayırt edebileceği, ancak 1,00000001 ve 1,00000002'yi ayıramayacağı anlamına gelir. 7 rakamdan sonra her şey yuvarlama gürültüsüdür.

float16 size yaklaşık 3 basamak verir. Temsil edebileceği en büyük sayı 65.504'tür. Bu, logitlerin, gradient'lerin ve aktivasyonların rutin olarak bunu aştığı ML için rahatsız edici derecede küçüktür.

bfloat16, Google'ın float16'nın menzil sorununa verdiği yanıttır. Float32 ile aynı 8 bitlik üsse sahiptir (aynı aralık, 3,4e38'e kadar) ancak yalnızca 7 mantis bitine sahiptir (float16'dan daha az hassasiyet). neural network'leri eğitmek için menzil hassasiyetten daha önemlidir, bu nedenle bfloat16 genellikle kazanır.

### Neden 0,1 + 0,2 != 0,3

0,1 sayısı ikili kayan noktada tam olarak temsil edilemez. 2 tabanında tekrar eden bir kesirdir:

```
0.1 in binary = 0.0001100110011001100110011... (repeating forever)
```

Float32 bunu 23 bitlik mantis olarak kısaltır. Saklanan değer yaklaşık olarak 0,100000001490116'dır. Benzer şekilde 0,2, yaklaşık 0,200000002980232 olarak depolanır. Toplamları 0,3 değil 0,300000004470348'dir.

```
In Python:
>>> 0.1 + 0.2
0.30000000000000004

>>> 0.1 + 0.2 == 0.3
False
```

Bu ML için önemlidir çünkü:

1. `if loss < threshold` gibi kayıp karşılaştırmaları yanlış yanıtlar verebilir
2. Birçok küçük değerin toplanması (binlerce adımda gradient güncellemesi) gerçek toplamdan sapar
3. Kayan noktaları `==` ile karşılaştırırsanız sağlama toplamları ve tekrar üretilebilirlik testleri başarısız olur

Çözüm: Kayan noktaları asla `==` ile karşılaştırmayın. `abs(a - b) < epsilon` veya `math.isclose()`'yi kullanın.

### Felaketli İptal

Neredeyse eşit iki kayan noktalı sayıyı çıkardığınızda, anlamlı basamaklar iptal edilir ve baş basamaklara yükseltilen yuvarlama gürültüsüyle kalırsınız.

```
a = 1.0000001    (stored as 1.00000011920929 in float32)
b = 1.0000000    (stored as 1.00000000000000 in float32)

True difference:  0.0000001
Computed:         0.00000011920929

Relative error: 19.2%
```

Bu, tek bir çıkarmadan elde edilen %19'luk göreceli bir hatadır. ML'de bu durum şu durumlarda gerçekleşir:

- Verilerin varyansını büyük bir ortalamayla hesaplayın: E[x] büyük olduğunda `E[x^2] - E[x]^2`
- Neredeyse eşit log olasılıklarını çıkarın
- Çok küçük epsilon ile sonlu fark gradient'leri hesaplayın

Çözüm: büyük, neredeyse eşit sayıların çıkarılmasını önlemek için formülleri yeniden düzenleyin. Varyans için Welford algoritmasını kullanın veya önce verileri ortalayın. Günlük olasılıkları için, baştan sona günlük alanında çalışın.

### Taşma ve Azalma

Bir sonuç temsil edilemeyecek kadar büyük olduğunda taşma meydana gelir. Düşük akış çok küçük olduğunda meydana gelir (sıfıra temsil edilebilen en küçük pozitif sayıdan daha yakın).

```
Float32 boundaries:
  Maximum:  3.4028235e+38
  Minimum positive (normal): 1.175e-38
  Minimum positive (denorm): 1.401e-45
  Overflow:  anything > 3.4e38 becomes inf
  Underflow: anything < 1.4e-45 becomes 0.0
```

`exp()` işlevi, ML'deki taşmanın birincil kaynağıdır:

```
exp(88.7)  = 3.40e+38   (barely fits in float32)
exp(89.0)  = inf         (overflow)
exp(-87.3) = 1.18e-38   (barely above underflow)
exp(-104)  = 0.0         (underflow to zero)
```

`log()` işlevi diğer yöne gider:

```
log(0.0)   = -inf
log(-1.0)  = nan
log(1e-45) = -103.3      (fine)
log(1e-46) = -inf        (input underflowed to 0, then log(0) = -inf)
```

ML'de `exp()` softmax, sigmoid ve olasılık hesaplamalarında görünür. `log()` çapraz entropi, log-olasılık ve KL ıraksamasında görünür. `log(exp(x))` kombinasyonu, doğru hilelerin olmadığı bir mayın tarlasıdır.

### Log-Toplam-Exp Hilesi

`log(sum(exp(x_i)))`'nin doğrudan hesaplanması sayısal olarak tehlikelidir. Herhangi bir `x_i` büyükse `exp(x_i)` taşar. Tüm `x_i` çok negatifse, her `exp(x_i)` sıfıra düşer ve `log(0)`, `-inf` olur.

İşin püf noktası: Üs alma işleminden önce maksimum değeri çıkarın.

```
log(sum(exp(x_i))) = max(x) + log(sum(exp(x_i - max(x))))
```

Bu neden işe yarıyor: `max(x)` çıkarıldıktan sonra en büyük üs `exp(0) = 1` olur. Taşma mümkün değildir. Toplamdaki en az bir terim 1'dir, dolayısıyla toplam en az 1'dir ve `log(1) = 0`'dir. `-inf`'ye taşma mümkün değildir.

Kanıt:

```
log(sum(exp(x_i)))
= log(sum(exp(x_i - c + c)))                    (add and subtract c)
= log(sum(exp(x_i - c) * exp(c)))               (exp(a+b) = exp(a)*exp(b))
= log(exp(c) * sum(exp(x_i - c)))               (factor out exp(c))
= c + log(sum(exp(x_i - c)))                    (log(a*b) = log(a) + log(b))
```

`c = max(x)` ayarlandığında taşma ortadan kaldırılır.

Bu numara ML'nin her yerinde görünür:
- Softmax normalizasyonu
- Çapraz entropi kaybı hesaplaması
- Sıra modellerinde log-olasılık toplamı
- Gaussianların Karışımı
- Değişken inference

### Softmax'ın Neden Maksimum Çıkarma Hilesi'ne İhtiyacı Var?

Softmax logitleri olasılıklara dönüştürür:

```
softmax(x_i) = exp(x_i) / sum(exp(x_j))
```

Hile olmadan, [100, 101, 102]'nin logitleri taşmaya neden olur:

```
exp(100) = 2.69e43
exp(101) = 7.31e43
exp(102) = 1.99e44
sum      = 2.99e44

These overflow float32 (max ~3.4e38)? No, 2.69e43 < 3.4e38? Actually:
exp(88.7) is already at the float32 limit.
exp(100) = inf in float32.
```

Bu hileyle max(x) = 102'yi çıkarın:

```
exp(100 - 102) = exp(-2) = 0.135
exp(101 - 102) = exp(-1) = 0.368
exp(102 - 102) = exp(0)  = 1.000
sum = 1.503

softmax = [0.090, 0.245, 0.665]
```

Olasılıklar aynıdır. Hesaplama güvenlidir. Bu bir optimizasyon değil. Doğruluğun bir gereğidir.

### NaN ve Inf: Tespit ve Önleme

`nan` (Sayı Değil) ve `inf` (sonsuz), hesaplama yoluyla viral olarak yayılır. gradient güncellemesindeki bir `nan`, `nan` ağırlığını oluşturur ve bu da sonraki her çıkışı `nan` yapar. Eğitim bir adımda ölür.

`inf` nasıl görünür:
- `exp()` büyük bir pozitif sayının
- Sıfıra bölme: `1.0 / 0.0`
- `float32` birikimlerde taşma

`nan` nasıl görünür:
- `0.0 / 0.0`
- `inf - inf`
- `inf * 0`
- Negatif bir sayının `sqrt()`'si
- Negatif bir sayının `log()`'si
- Mevcut bir `nan`'yi içeren herhangi bir aritmetik

Algılama:

```python
import math

math.isnan(x)       # True if x is nan
math.isinf(x)       # True if x is +inf or -inf
math.isfinite(x)    # True if x is neither nan nor inf
```

Önleme stratejileri:

1. Girişleri `exp()`'ye kelepçeleyin: `exp(clamp(x, -80, 80))`
2. Paydalara epsilon ekleyin: `x / (y + 1e-8)`
3. `log()`'nin içine epsilon ekleyin: `log(x + 1e-8)`
4. Kararlı uygulamalar kullanın (log-toplam-ifade, kararlı softmax)
5. Ağırlık patlamasını önlemek için Gradient kırpma
6. Hata ayıklama sırasında her ileri geçişten sonra `nan`/`inf`'yi kontrol edin

### Sayısal Gradient Kontrolü

Analitik gradient'lerde (backpropagation'den) hatalar bulunabilir. Sayısal gradient kontrolü, gradient'leri sonlu farklarla hesaplayarak bunları doğrular.

Merkezi fark formülü:

```
df/dx ~= (f(x + h) - f(x - h)) / (2h)
```

Bu O(h^2) doğrudur, yalnızca O(h) olan `(f(x+h) - f(x)) / h` ileri farkından çok daha iyidir.

h: çok büyük seçilirse yaklaşım yanlış olur. Çok küçük ve yıkıcı bir iptal, cevabı yok eder. `h = 1e-5` ila `1e-7` tipiktir.

Kontrol: Analitik ve sayısal gradient'ler arasındaki göreli farkı hesaplayın.

```
relative_error = |grad_analytical - grad_numerical| / max(|grad_analytical|, |grad_numerical|, 1e-8)
```

Temel kurallar:
-relative_error < 1e-7: mükemmel, gradient doğru
-relative_error < 1e-5: kabul edilebilir, muhtemelen doğru
-relative_error > 1e-3: bir sorun var
-relative_error > 1: gradient tamamen yanlış

Yeni bir katman veya loss function uygularken daima gradient'leri kontrol edin. PyTorch bunun için `torch.autograd.gradcheck()`'yi sağlar.

### Karma Hassasiyet Eğitimi

Modern GPU'lar, float16 matris çarpımlarını float32'den 2-8 kat daha hızlı hesaplayan özel donanıma (Tensör Çekirdekleri) sahiptir. Karma hassas eğitim bundan yararlanır:

```
1. Maintain float32 master copy of weights
2. Forward pass in float16 (fast)
3. Compute loss in float32 (prevents overflow)
4. Backward pass in float16 (fast)
5. Scale gradients to float32
6. Update float32 master weights
```

Saf float16 eğitiminin sorunu: gradient'ler genellikle çok küçüktür (1e-8 veya daha küçük). Float16, ~6e-8'in altındaki herhangi bir şeyi sıfıra düşürür. Tüm gradient güncellemeleri sıfır olduğundan modeliniz öğrenmeyi durduruyor.

Çözüm kayıp ölçeklendirmedir:

```
1. Multiply loss by a large scale factor (e.g., 1024)
2. Backward pass computes gradients of (loss * 1024)
3. All gradients are 1024x larger (pushed above float16 underflow)
4. Divide gradients by 1024 before updating weights
5. Net effect: same update, but no underflow
```

Dinamik kayıp ölçeklendirme, ölçek faktörünü otomatik olarak ayarlar. Büyük bir değerle başlayın (65536). gradient'ler `inf`'ye taşarsa yarıya indirin. N adım taşmadan geçerse ikiye katlayın.

### bfloat16 vs float16: Neden bfloat16 Eğitimde Kazanıyor?

```
float16:   [1 sign] [5 exponent]  [10 mantissa]
bfloat16:  [1 sign] [8 exponent]  [7 mantissa]
```

float16'nın hassasiyeti daha fazladır (7'ye karşı 10 mantis biti) ancak aralığı sınırlıdır (maksimum ~65.504). bfloat16'nın hassasiyeti daha azdır ancak float32 ile aynı aralığa sahiptir (maks ~3,4e38).

neural network'leri eğitmek için:

- Eğitim artışları sırasında aktivasyonlar ve logitler düzenli olarak 65.504'ü aşıyor. float16 taşmaları; bfloat16 bunu hallediyor.
- Float16 için kayıp ölçeklendirmesi gereklidir ancak bfloat16 için genellikle gereksizdir çünkü aralığı gradient büyüklük spektrumunu kapsar.
- bfloat16, float32'nin basit bir kesimidir: mantisin alttaki 16 bitini bırakın. Üstelde dönüşüm önemsizdir ve kayıpsızdır.

Değerlerin sınırlı olduğu ve hassasiyetin daha önemli olduğu inference için float16 tercih edilir. Menzilin daha önemli olduğu eğitimlerde bfloat16 tercih edilir. Bu nedenle TPU'lar ve modern NVIDIA GPU'lar (A100, H100) yerel bfloat16 desteğine sahiptir.

### Gradient Kırpma

gradient'lerin patlaması, gradient'lerin birçok katman boyunca katlanarak büyümesiyle meydana gelir (RNN'lerde, derin ağlarda ve transformer'lerde yaygındır). Tek bir büyük gradient, tek adımda tüm ağırlıkları bozabilir.

İki tür kırpma:

**Değere göre kırpma:** her gradient öğesini bağımsız olarak sıkıştırın.

```
grad = clamp(grad, -max_val, max_val)
```

Basit ama gradient vektörünün yönünü değiştirebilir.

**Norma göre kırpma:** gradient vektörünün tamamını, normu bir eşiği aşmayacak şekilde ölçeklendirin.

```
if ||grad|| > max_norm:
    grad = grad * (max_norm / ||grad||)
```

gradient'nin yönünü korur. `torch.nn.utils.clip_grad_norm_()`'nin yaptığı budur. Standart seçimdir.

Tipik değerler: transformer'ler için `max_norm=1.0`, RL için `max_norm=0.5`, daha basit ağlar için `max_norm=5.0`.

Gradient kırpma bir hack değildir. Bu bir güvenlik mekanizmasıdır. Bu olmadan, tek bir aykırı grup, haftalarca süren eğitimi mahvedecek kadar büyük bir gradient üretebilir.

### Sayısal Dengeleyici Olarak Normalleştirme Katmanları

Toplu normalizasyon, katman normalizasyonu ve RMS normalizasyonu genellikle eğitimin yakınsamasına yardımcı olan düzenleyiciler olarak sunulur. Bunlar aynı zamanda sayısal stabilizatörlerdir.

Normalleştirme olmadan aktivasyonlar katmanlar boyunca katlanarak büyüyebilir veya küçülebilir:

```
Layer 1: values in [0, 1]
Layer 5: values in [0, 100]
Layer 10: values in [0, 10,000]
Layer 50: values in [0, inf]
```

Normalleştirme, her katmandaki etkinleştirmeleri yeniden ölçeklendirir ve yeniden ölçeklendirir:

```
LayerNorm(x) = (x - mean(x)) / (std(x) + epsilon) * gamma + beta
```

`epsilon` (tipik olarak 1e-5), tüm aktivasyonlar aynı olduğunda sıfıra bölünmeyi önler. Öğrenilen parametreler `gamma` ve `beta`, ağın ihtiyaç duyduğu ölçeği geri yüklemesine olanak tanır.

Bu, değerleri ağ genelinde sayısal olarak güvenli bir aralıkta tutarak hem ileri geçişte taşmayı hem de geri geçişte gradient patlamayı önler.

### Yaygın ML Sayısal Hataları

**Hata: Birkaç dönem sonunda kayıp NaN olur.**
Sebep: logitler çok büyüdü, softmax taştı. Veya öğrenme oranı çok yüksek ve ağırlıklar farklı.
Düzeltme: Kararlı softmax (maksimum çıkarma) kullanın, öğrenme oranını azaltın, gradient kırpma ekleyin.

**Hata: Kayıp log(num_classes)'ta takılı kaldı.**
Neden: model çıktıları neredeyse aynı olasılıklardır. Çoğunlukla gradient'lerin kaybolduğu veya modelin hiç öğrenmediği anlamına gelir.
Düzeltme: Veri etiketlerinin doğru olup olmadığını kontrol edin, loss function'yi doğrulayın, ölü ReLU'ları kontrol edin.

**Hata: Doğrulama doğruluğu beklenenden %1-3 daha düşük.**
Neden: Uygun kayıp ölçeklendirmesi olmadan karışık hassasiyet. Gradient yetersiz akışı, küçük güncellemeleri sessizce sıfırlar.
Düzeltme: Dinamik kayıp ölçeklendirmeyi etkinleştirin veya bfloat16'ya geçin.

**Hata: Gradient normları bazı katmanlar için 0,0'dır.**
Nedeni: ölü ReLU nöronları (tüm girişler negatif) veya float16'nın yetersiz akışı.
Düzeltme: LeakyReLU veya GELU kullanın, gradient ölçeklendirmeyi kullanın, ağırlık başlatmayı kontrol edin.

**Hata: Model bir GPU'da çalışıyor ancak diğerinde farklı sonuçlar veriyor.**
Neden: deterministik olmayan kayan nokta birikim sırası. GPU paralel azaltmaları farklı donanımlarda farklı sıralarda toplanır ve kayan nokta eklemesi ilişkisel değildir.
Düzeltme: Küçük farkları (1e-6) kabul edin veya `torch.use_deterministic_algorithms(True)` ayarını yapın ve hız cezasını kabul edin.

**Hata: `exp()`, kayıp hesaplamasında `inf` değerini döndürüyor.**
Nedeni: Ham logitler, maksimum çıkarma numarası olmadan `exp()`'ye aktarıldı.
Düzeltme: Log-sum-exp'yi dahili olarak uygulayan `torch.nn.functional.log_softmax()`'yi kullanın.

**Hata: Float32'den float16'ya geçişten sonra eğitim farklılaşıyor.**
Neden: float16, 6e-8'in altındaki gradient büyüklüklerini veya 65.504'ün üzerindeki aktivasyonları temsil edemez.
Düzeltme: Kayıp ölçeklendirme (AMP) ile karma hassasiyet kullanın veya bunun yerine bfloat16 kullanın.

```figure
logsumexp-stability
```

## İnşa Et

### Adım 1: Kayan nokta hassasiyet sınırlarını gösterin

```python
print("=== Floating Point Precision ===")
print(f"0.1 + 0.2 = {0.1 + 0.2}")
print(f"0.1 + 0.2 == 0.3? {0.1 + 0.2 == 0.3}")
print(f"Difference: {(0.1 + 0.2) - 0.3:.2e}")
```

### Adım 2: Saf ve kararlı softmax'ı uygulayın

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

### Adım 3: Kararlı log-sum-exp'yi uygulayın

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

### Adım 4: Kararlı çapraz entropiyi uygulayın

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

### Adım 5: Gradient kontrolü

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

## Kullan onu

### Karma hassas simülasyon

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

### Gradient kırpma

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

### NaN/Inf tespiti

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

Gösterilen tüm uç durumlarla birlikte eksiksiz uygulamalar için `code/numerical.py`'ye bakın.

## Gönderin

Bu ders şunları üretir:
- Kararlı softmax, log-toplam-exp, çapraz entropi, gradient kontrolü ve karışık hassasiyet simülasyonu ile `code/numerical.py`
- Eğitimdeki NaN/Inf ve sayısal sorunları teşhis etmek için `outputs/prompt-numerical-debugger.md`

Bu kararlı uygulamalar, eğitim döngüsünü oluştururken Aşama 3'te ve attention mechanism'leri uygularken Aşama 4'te yeniden ortaya çıkar.

## Egzersizler

1. **Felaket iptal.** Float32'deki basit `E[x^2] - E[x]^2` formülünü kullanarak [1000000,0, 1000001,0, 1000002,0] varyansını hesaplayın. Daha sonra bunu Welford'un çevrimiçi algoritmasını kullanarak hesaplayın. Hataları gerçek varyansla (0,6667) karşılaştırın.

2. **Hassas arama.** Python'da `1.0 + x == 1.0` olacak şekilde en küçük pozitif float32 değeri `x`'yi bulun. Bu epsilon makinesi. `numpy.finfo(numpy.float32).eps` ile eşleştiğini doğrulayın.

3. **Log-sum-exp uç durumları.** `logsumexp_stable` işlevinizi şununla test edin: (a) tüm değerler eşit, (b) bir değer diğerlerinden çok daha büyük, (c) tüm değerler çok negatif (-1000). Saf sürümün başarısız olduğu durumlarda doğru sonuçları verdiğini doğrulayın.

4. **Gradient, bir neural network katmanını kontrol ediyor.** Tek bir doğrusal katman `y = Wx + b` ve onun analitik geri geçişini uygulayın. 3x2 ağırlık matrisinin doğruluğunu doğrulamak için `numerical_gradient` kullanın.

5. **Kayıp ölçeklendirme deneyi.** Float16 ile eğitimi simüle edin: [1e-9, 1e-3] aralığında rastgele gradient'ler oluşturun, float16'ya dönüştürün ve hangi kesrin sıfıra dönüştüğünü ölçün. Daha sonra kayıp ölçeklendirmesi uygulayın (1024 ile çarpın), float16'ya dönüştürün, ölçeklendirin ve sıfır kesirini tekrar ölçün.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|----------------------|
| IEEE754 | "Şamandıra standardı" | İkili kayan nokta formatlarını, yuvarlama kurallarını ve özel değerleri (inf, nan) tanımlayan uluslararası standart. Her modern CPU ve GPU bunu uygular. |
| Makine epsilon | "Hassaslık sınırı" | Belirli bir float formatında 1,0 + e != 1,0 olacak şekilde en küçük e değeri. Floa32 için bu yaklaşık 1,19e-7'dir. |
| Felaket iptali | "Çıkarmadan kaynaklanan hassas kayıp" | Neredeyse eşit kayan nokta sayılarını çıkarırken, anlamlı basamaklar iptal edilir ve yuvarlama gürültüsü sonuca hakim olur. |
| Taşma | "Sayı çok büyük" | Sonuç, temsil edilebilir maksimum değeri aşar ve inf olur. exp(89) float32'den taşıyor. |
| Taşma | "Sayı çok küçük" | Sonuç sıfıra temsil edilebilen en küçük pozitif sayıdan daha yakındır ve 0,0 olur. exp(-104) float32'nin altından taşıyor. |
| Log-toplam-exp numarası | "Önce maksimumu çıkarın" | Taşma ve yetersiz akışı önlemek için log(sum(exp(x))), exp(max(x))'i çarpanlara ayırarak hesaplama. Softmax, çapraz entropi ve log-olasılık matematiğinde kullanılır. |
| Kararlı softmax | "Patlamayan Softmax" | Üstelleştirmeden önce max(logits)'i çıkarma. Sayısal olarak aynı sonuç, taşma mümkün değil. |
| Gradient kontrol ediliyor | "Backprop'unuzu doğrulayın" | Uygulama hatalarını yakalamak için backpropagation'deki analitik gradient'leri sonlu farklardan sayısal gradient'lerle karşılaştırmak. |
| Karışık hassasiyet | "Float16 ileri, float32 geri" | Hızın kritik olduğu işlemler için daha düşük hassasiyetli şamandıraların ve sayısal olarak hassas işlemler için daha yüksek hassasiyetli şamandıraların kullanılması. Tipik hızlanma 2-3x'tir. |
| Kayıp ölçeklendirme | "gradient taşmasını önleyin" | gradient'lerin float16'nın temsil edilebilir aralığında kalması için kaybı backprop'tan önce büyük bir sabitle çarpmak, ardından ağırlık güncellemelerinden önce aynı sabite bölmek. |
| bfloat16 | "Beyin kayan noktası" | Google'ın 8 üslü bit (float32 ile aynı aralık) ve 7 mantis biti (float16'dan daha az hassasiyet) içeren 16 bit biçimi. Eğitim için tercih edilir. |
| Gradient kırpma | "gradient normunu sınırlayın" | gradient vektörünün, normu bir eşiği aşmayacak şekilde ölçeklendirilmesi. Patlayan gradient'lerin ağırlıklara zarar vermesini önler. |
| NaN | "Sayı Değil" | Tanımlanmamış işlemlerden özel float değeri (0/0, inf-inf, sqrt(-1)). Sonraki tüm aritmetik işlemlere yayılır. |
| Bilgi | "Sonsuzluk" | Taşma veya sıfıra bölmeden kaynaklanan özel float değeri. NaN (inf - inf, inf * 0) üretmek için birleşebilir. |
| Sayısal gradient | "Kaba kuvvet türevi" | f(x+h) ve f(x-h) değerlerini hesaplayıp 2h'ye bölerek bir türevi tahmin etmek. Doğrulama için yavaş ama güvenilir. |

## Daha Fazla Okuma

- [Kayan Nokta Aritmetiği Hakkında Her Bilgisayar Bilimcisinin Bilmesi Gerekenler (Goldberg 1991)](https://docs.oracle.com/cd/E19957-01/806-3568/ncg_goldberg.html) -- kesin referans, yoğun ama eksiksiz
- [Karma Hassas Eğitim (Micikevicius ve diğerleri, 2018)](https://arxiv.org/abs/1710.03740) -- float16 eğitimi için kayıp ölçeklendirmeyi tanıtan NVIDIA makalesi
- [AMP: Otomatik Karma Hassasiyet (PyTorch docs)](https://pytorch.org/docs/stable/amp.html) -- PyTorch'ta karma hassasiyet için pratik kılavuz
- [bfloat16 biçimi (Google Cloud TPU belgeleri)](https://cloud.google.com/tpu/docs/bfloat16) -- Google neden TPU'lar için bu biçimi seçti?
- [Kahan Summation (Wikipedia)](https://en.wikipedia.org/wiki/Kahan_summation_algorithm) -- kayan noktalı toplamlarda yuvarlama hatasını azaltmaya yönelik algoritma
