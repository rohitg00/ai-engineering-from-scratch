# Olasılık ve Dağılımlar

> Olasılık, yapay zekanın belirsizliği ifade etmek için kullandığı dildir.

**Tür:** Öğren
**Dil:** Python
**Önkoşullar:** Aşama 1, Dersler 01-04
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- Bernoulli, kategorik, Poisson, tek tip ve normal dağılımlar için PMF'leri ve PDF'leri sıfırdan uygulayın
- Beklenen değeri ve varyansı hesaplayın ve Gaussluların neden baskın olduğunu açıklamak için Merkezi Limit Teoremini kullanın
- Sayısal kararlılık numarasıyla softmax ve log-softmax fonksiyonlarını oluşturun (maksimum logit'i çıkarın)
- Logitlerden çapraz entropi kaybını hesaplayın ve bunu negatif log olasılığına bağlayın

## Sorun

Bir sınıflandırıcı `[0.03, 0.91, 0.06]` çıktısını verir. Bir dil modeli 50.000 aday arasından bir sonraki kelimeyi seçer. Bir yayılma modeli, öğrenilen dağılımlardan örnekleme yaparak görüntüler üretir. Bunların hepsi eylem halindeki olasılıklardır.

Bir modelin yaptığı her tahmin bir olasılık dağılımıdır. Her loss function, tahmin edilen dağılımın gerçek olandan ne kadar uzakta olduğunu ölçer. Her eğitim adımı, bir dağıtımın diğerine daha çok benzemesini sağlamak için parametreleri ayarlar. Olasılık olmadan, tek bir makine öğrenimi makalesini okuyamaz, tek bir modelde hata ayıklayamazsınız veya eğitim kaybınızın neden NaN olduğunu anlayamazsınız.

## Konsept

### Olaylar, Örnek Uzaylar ve Olasılık

Örnek uzayı S tüm olası sonuçların kümesidir. Bir olay, örnek uzayın bir alt kümesidir. Olasılık, olayları 0 ile 1 arasındaki sayılarla eşleştirir.

```
Coin flip:
  S = {H, T}
  P(H) = 0.5,  P(T) = 0.5

Single die roll:
  S = {1, 2, 3, 4, 5, 6}
  P(even) = P({2, 4, 6}) = 3/6 = 0.5
```

Üç aksiyom tüm olasılığı tanımlar:
1. Herhangi bir A olayı için P(A) >= 0
2. P(S) = 1 (her zaman bir şeyler olur)
3. A ve B'nin her ikisi birden oluşamadığında P(A veya B) = P(A) + P(B)

Diğer her şey (Bayes teoremi, beklentiler, dağılımlar) bu üç kuraldan kaynaklanır.

### Koşullu Olasılık ve Bağımsızlık

P(A|B), B'nin gerçekleştiği göz önüne alındığında A'nın olasılığıdır.

```
P(A|B) = P(A and B) / P(B)

Example: deck of cards
  P(King | Face card) = P(King and Face card) / P(Face card)
                      = (4/52) / (12/52)
                      = 4/12 = 1/3
```

Birinin size diğeri hakkında hiçbir şey söylemediği iki olay birbirinden bağımsızdır:

```
Independent:   P(A|B) = P(A)
Equivalent to: P(A and B) = P(A) * P(B)
```

Yazı-tura atışları bağımsızdır. Kartları değiştirmeden çekmek doğru değildir.

### Olasılık Kütle Fonksiyonları ve Olasılık Yoğunluk Fonksiyonları

Ayrık rastgele değişkenlerin olasılık kütle fonksiyonu (PMF) vardır. Her sonucun doğrudan okuyabileceğiniz belirli bir olasılığı vardır.

```
PMF: P(X = k)

Fair die:
  P(X = 1) = 1/6
  P(X = 2) = 1/6
  ...
  P(X = 6) = 1/6

  Sum of all probabilities = 1
```

Sürekli rastgele değişkenlerin bir olasılık yoğunluk fonksiyonu vardır (PDF). Tek bir noktadaki yoğunluk bir olasılık değildir. Olasılık, yoğunluğun bir aralıkta entegrasyonundan gelir.

```
PDF: f(x)

P(a <= X <= b) = integral of f(x) from a to b

f(x) can be greater than 1 (density, not probability)
integral from -inf to +inf of f(x) dx = 1
```

Bu ayrım ML'de önemlidir. Sınıflandırma çıktıları PMF'lerdir (ayrık seçenekler). VAE gizli alanları PDF'leri (sürekli) kullanır.

### Ortak Dağılımlar

**Bernoulli:** bir deneme, iki sonuç. Modeller ikili sınıflandırma.

```
P(X = 1) = p
P(X = 0) = 1 - p
Mean = p,  Variance = p(1-p)
```

**Kategorik:** bir deneme, k sonuç. Modeller çok sınıflı sınıflandırma (softmax çıkışı).

```
P(X = i) = p_i,  where sum of p_i = 1
Example: P(cat) = 0.7,  P(dog) = 0.2,  P(bird) = 0.1
```

**Tek tip:** tüm sonuçlar eşit derecede olasıdır. Rastgele başlatma için kullanılır.

```
Discrete: P(X = k) = 1/n for k in {1, ..., n}
Continuous: f(x) = 1/(b-a) for x in [a, b]
```

**Normal (Gauss):** çan eğrisi. Ortalama (mu) ve varyans (sigma^2) ile parametrelendirilmiştir.

```
f(x) = (1 / sqrt(2*pi*sigma^2)) * exp(-(x - mu)^2 / (2*sigma^2))

Standard normal: mu = 0, sigma = 1
  68% of data within 1 sigma
  95% within 2 sigma
  99.7% within 3 sigma
```

**Poisson:** sabit bir aralıktaki nadir olayların sayısı. Olay oranlarını modeller.

```
P(X = k) = (lambda^k * e^(-lambda)) / k!
Mean = lambda,  Variance = lambda
```

### Beklenen Değer ve Fark

Beklenen değer ağırlıklı ortalama sonuçtur.

```
Discrete:   E[X] = sum of x_i * P(X = x_i)
Continuous: E[X] = integral of x * f(x) dx
```

Varyans ölçüleri ortalamanın etrafına yayılır.

```
Var(X) = E[(X - E[X])^2] = E[X^2] - (E[X])^2
Standard deviation = sqrt(Var(X))
```

ML'de beklenen değer loss function (veri dağıtımındaki ortalama kayıp) olarak görünür. Varyans size model kararlılığı hakkında bilgi verir. gradient'lerdeki yüksek varyans, gürültülü eğitim anlamına gelir.

### Ortak ve Marjinal Dağılımlar

Ortak bir dağılım P(X, Y), iki rastgele değişkeni birlikte tanımlar.

Ortak PMF örneği (X = hava durumu, Y = şemsiye):

| | Y=0 (şemsiye yok) | Y=1 (şemsiye) | Marjinal P(X) |
|---|---|---|---|
| X=0 (güneş) | 0.40 | 0.10 | P(X=0) = 0,50 |
| X=1 (yağmur) | 0,05 | 0,45 | P(X=1) = 0,50 |
| **Marjinal P(Y)** | P(Y=0) = 0,45 | P(Y=1) = 0,55 | 1.00 |

Marjinal dağılım diğer değişkeni toplar:

```
P(X = x) = sum over all y of P(X = x, Y = y)
```

Yukarıdaki tabloda satır ve sütun toplamları marjinal değerlerdir.

### Neden Normal Dağılım Her Yerde Görünüyor?

Merkezi Limit Teoremi: Birçok bağımsız rastgele değişkenin toplamı (veya ortalaması), orijinal dağılımdan bağımsız olarak normal bir dağılıma yakınsar.

```
Roll 1 die:  uniform distribution (flat)
Average of 2 dice:  triangular (peaked)
Average of 30 dice: nearly perfect bell curve

This works for ANY starting distribution.
```

Bu yüzden:
- Ölçüm hataları yaklaşık olarak normaldir (birçok küçük bağımsız kaynak)
- neural network'lerdeki ağırlık başlatmaları normal dağılımları kullanır
- SGD'deki Gradient gürültüsü yaklaşık olarak normaldir (birçok örnek gradient'nin toplamı)
- Normal dağılım, belirli bir ortalama ve varyans için maksimum entropi dağılımıdır

### Olasılıkları Günlüğe Kaydet

Ham olasılıklar sayısal sorunlara neden olur. Birçok küçük olasılığın çarpımı hızla sıfıra iner.

```
P(sentence) = P(word1) * P(word2) * ... * P(word_n)
            = 0.01 * 0.003 * 0.02 * ...
            -> 0.0 (underflow after ~30 terms)
```

Günlük olasılıkları bunu düzeltir. Çarpmalar toplama haline gelir.

```
log P(sentence) = log P(word1) + log P(word2) + ... + log P(word_n)
                = -4.6 + -5.8 + -3.9 + ...
                -> finite number (no underflow)
```

Kurallar:
- log(a * b) = log(a) + log(b)
- log olasılıkları her zaman <= 0'dır (0 < P <= 1 olduğundan)
- Daha olumsuz = daha az olasılık
- Çapraz entropi kaybı, doğru sınıfın negatif log olasılığıdır

### Olasılık Dağılımı Olarak Softmax

Neural network'ler ham puanların (logitlerin) çıktısını verir. Softmax bunları geçerli bir olasılık dağılımına dönüştürür.

```
softmax(z_i) = exp(z_i) / sum(exp(z_j) for all j)

Properties:
  - All outputs are in (0, 1)
  - All outputs sum to 1
  - Preserves relative ordering of inputs
  - exp() amplifies differences between logits
```

Softmax numarası: taşmayı önlemek için üstelleştirmeden önce maksimum logit'i çıkarın.

```
z = [100, 101, 102]
exp(102) = overflow

z_shifted = z - max(z) = [-2, -1, 0]
exp(0) = 1  (safe)

Same result, no overflow.
```

Log-softmax, sayısal kararlılık için softmax ve log'u birleştirir. PyTorch bunu çapraz entropi kaybı için dahili olarak kullanır.

### Örnekleme

Örnekleme, bir dağılımdan rastgele değerler çıkarmak anlamına gelir. ML'de:
- Bırakma, hangi nöronların sıfırlanacağını rastgele örnekler
- Veri artırma örnekleri rastgele dönüşümler
- Dil modelleri tahmin edilen dağıtımdan sonraki token'yi örnekliyor
- Difüzyon modelleri gürültüyü örneklendirir ve aşamalı olarak gürültüyü giderir

Rastgele dağılımlardan örnekleme, ters dönüşüm örneklemesi, reddetme örneklemesi veya yeniden parametrelendirme hilesi (VAE'lerde kullanılır) gibi teknikleri gerektirir.

```figure
gaussian-pdf
```

## Derin Matematik: Olasılığı Modelleme Dili Olarak Kurmak

Olasılık, yalnızca “bir olayın olma yüzdesi” değildir. Eksik bilgi altında
tutarlı çıkarım yapmanın matematiksel dilidir. Bir olasılık modeli üç parçadan
oluşur: olası sonuçlar kümesi \(\Omega\), ilgilendiğimiz olaylar ve her olaya
\([0,1]\) aralığında değer veren \(P\) ölçüsü. Bu ölçü
\(P(\Omega)=1\) ve ayrık olaylar için toplamsallık koşullarını sağlar.

### Yoğunluk neden olasılık değildir?

Sürekli bir değişkende tek bir noktanın olasılığı sıfırdır:
\(P(X=x)=0\). Olasılık, yoğunluk fonksiyonunun bir aralık üzerindeki alanıdır:

\[
P(a\le X\le b)=\int_a^b f_X(x)\,dx.
\]

Bu nedenle bir PDF değeri 1'den büyük olabilir; yasak olan yoğunluğun değil,
toplam alanın 1'den farklı olmasıdır. Örneğin \([0,0.5]\) üzerinde sabit
\(f(x)=2\) geçerli bir yoğunluktur, çünkü alan \(2\times0.5=1\)'dir.

### Beklenen değer uzun dönem ortalamasından daha geneldir

Ayrık durumda

\[
\mathbb{E}[g(X)]=\sum_x g(x)P(X=x),
\]

sürekli durumda ise toplamın yerini integral alır. Bu tanım, model eğitimindeki
risk minimizasyonunu açıklar:

\[
R(\theta)=\mathbb{E}_{(X,Y)\sim p_{\text{veri}}}
[\ell(f_\theta(X),Y)].
\]

Elimizde gerçek dağılım olmadığı için bu beklentiyi veri kümesi ortalamasıyla
yaklaştırırız. Mini-batch gradyanı da tam gradyanın gürültülü fakat uygun
koşullarda yansız bir tahminidir. “Loss neden ortalanıyor?” sorusunun kesin
cevabı budur.

### Varyansı cebirsel olarak açın

\[
\operatorname{Var}(X)
=\mathbb{E}[(X-\mu)^2]
=\mathbb{E}[X^2]-\mathbb{E}[X]^2.
\]

Son eşitlik, kareyi açıp beklentinin doğrusallığını kullanarak elde edilir.
Bağımsız \(n\) örneğin ortalaması için

\[
\operatorname{Var}(\bar X)=\frac{\sigma^2}{n}.
\]

Standart hata bu yüzden \(1/\sqrt n\) hızında azalır. Hatayı yarıya indirmek
için iki değil yaklaşık dört kat örnek gerekir. Bu sonuç veri toplama maliyetini
planlarken doğrudan kullanılabilir.

### Koşullama ve bağımsızlık

\[
P(A\mid B)=\frac{P(A\cap B)}{P(B)}
\]

ifadesi, örnek uzayını \(B\) gerçekleşmiş gibi yeniden normalize eder.
\(A\) ve \(B\) bağımsızsa \(P(A\mid B)=P(A)\); fakat koşullu bağımsızlık çok
daha ince bir kavramdır. İki değişken, üçüncü bir değişken bilindiğinde bağımsız
olabilir veya tam tersine koşullama sahte bir ilişki yaratabilir. Nedensel
modellerde “korelasyon gördüm” ile “müdahale edersem sonuç değişir” arasındaki
fark burada başlar.

### Log-olabilirlik ve çapraz entropi aynı hikâyedir

Bağımsız gözlemler için olabilirlik çarpımdır:

\[
L(\theta)=\prod_{i=1}^n p_\theta(y_i\mid x_i).
\]

Logaritma monoton olduğu için en büyük noktayı değiştirmeden çarpımı toplama
dönüştürür:

\[
\log L(\theta)=\sum_i\log p_\theta(y_i\mid x_i).
\]

Negatif log-olabilirliği küçültmek, sınıflandırmada çapraz entropiyi küçültmekle
aynıdır. Böylece “istatistiksel tahmin” ve “sinir ağı loss'u” iki ayrı konu
olmaktan çıkar. `log_softmax` kullanılması da yalnızca hız için değil,
çok küçük olasılıkların sıfıra yuvarlanmasını önlemek içindir.

### Anlama kontrolü

1. \(f(x)=3x^2\), \(0\le x\le1\) yoğunluğunun normalize olduğunu gösterin ve
   \(P(X>0.5)\)'i integral ile hesaplayın.
2. Bağımsız 100 ölçümün ortalamasının standart hatasını 10 kat azaltmak için
   kaç ölçüm gerektiğini türetin.
3. `softmax` çıktısındaki doğru sınıf olasılığı \(0.8\)'den \(0.4\)'e düştüğünde
   negatif log-olabilirliğin ne kadar değiştiğini hesaplayıp yorumlayın.

## İnşa Et

### 1. Adım: Olasılığın temelleri

```python
import math
import random

def factorial(n):
    result = 1
    for i in range(2, n + 1):
        result *= i
    return result

def combinations(n, k):
    return factorial(n) // (factorial(k) * factorial(n - k))

def conditional_probability(p_a_and_b, p_b):
    return p_a_and_b / p_b

p_king_given_face = conditional_probability(4/52, 12/52)
print(f"P(King | Face card) = {p_king_given_face:.4f}")
```

### Adım 2: Sıfırdan PMF ve PDF

```python
def bernoulli_pmf(k, p):
    return p if k == 1 else (1 - p)

def categorical_pmf(k, probs):
    return probs[k]

def poisson_pmf(k, lam):
    return (lam ** k) * math.exp(-lam) / factorial(k)

def uniform_pdf(x, a, b):
    if a <= x <= b:
        return 1.0 / (b - a)
    return 0.0

def normal_pdf(x, mu, sigma):
    coeff = 1.0 / (sigma * math.sqrt(2 * math.pi))
    exponent = -0.5 * ((x - mu) / sigma) ** 2
    return coeff * math.exp(exponent)
```

### Adım 3: Beklenen değer ve varyans

```python
def expected_value(values, probabilities):
    return sum(v * p for v, p in zip(values, probabilities))

def variance(values, probabilities):
    mu = expected_value(values, probabilities)
    return sum(p * (v - mu) ** 2 for v, p in zip(values, probabilities))

die_values = [1, 2, 3, 4, 5, 6]
die_probs = [1/6] * 6
mu = expected_value(die_values, die_probs)
var = variance(die_values, die_probs)
print(f"Die: E[X] = {mu:.4f}, Var(X) = {var:.4f}, SD = {var**0.5:.4f}")
```

### Adım 4: Dağıtımlardan örnekleme

```python
def sample_bernoulli(p, n=1):
    return [1 if random.random() < p else 0 for _ in range(n)]

def sample_categorical(probs, n=1):
    cumulative = []
    total = 0
    for p in probs:
        total += p
        cumulative.append(total)
    samples = []
    for _ in range(n):
        r = random.random()
        for i, c in enumerate(cumulative):
            if r <= c:
                samples.append(i)
                break
    return samples

def sample_normal_box_muller(mu, sigma, n=1):
    samples = []
    for _ in range(n):
        u1 = random.random()
        u2 = random.random()
        z = math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)
        samples.append(mu + sigma * z)
    return samples
```

### Adım 5: Softmax ve log olasılıkları

```python
def softmax(logits):
    max_logit = max(logits)
    shifted = [z - max_logit for z in logits]
    exps = [math.exp(z) for z in shifted]
    total = sum(exps)
    return [e / total for e in exps]

def log_softmax(logits):
    max_logit = max(logits)
    shifted = [z - max_logit for z in logits]
    log_sum_exp = max_logit + math.log(sum(math.exp(z) for z in shifted))
    return [z - log_sum_exp for z in logits]

def cross_entropy_loss(logits, target_index):
    log_probs = log_softmax(logits)
    return -log_probs[target_index]
```

### Adım 6: Merkezi Limit Teoremi gösterimi

```python
def demonstrate_clt(dist_fn, n_samples, n_averages):
    averages = []
    for _ in range(n_averages):
        samples = [dist_fn() for _ in range(n_samples)]
        averages.append(sum(samples) / len(samples))
    return averages
```

### Adım 7: Görselleştirme

```python
import matplotlib.pyplot as plt

xs = [mu + sigma * (i - 500) / 100 for i in range(1001)]
ys = [normal_pdf(x, mu, sigma) for x, mu, sigma in ...]
plt.plot(xs, ys)
```

Tüm görselleştirmelerle birlikte tam uygulamalar `code/probability.py`'dedir.

## Kullan onu

NumPy ve SciPy ile yukarıdaki her şey tek satırlıktır:

```python
import numpy as np
from scipy import stats

normal = stats.norm(loc=0, scale=1)
samples = normal.rvs(size=10000)
print(f"Mean: {np.mean(samples):.4f}, Std: {np.std(samples):.4f}")
print(f"P(X < 1.96) = {normal.cdf(1.96):.4f}")

logits = np.array([2.0, 1.0, 0.1])
from scipy.special import softmax, log_softmax
probs = softmax(logits)
log_probs = log_softmax(logits)
print(f"Softmax: {probs}")
print(f"Log-softmax: {log_probs}")
```

Bunları sıfırdan inşa ettin. Artık kütüphane çağrılarının ne yaptığını biliyorsunuz.

## Egzersizler

1. Üstel dağılım için ters dönüşüm örneklemesini uygulayın. 10.000 değeri örnekleyerek ve histogramı gerçek PDF ile karşılaştırarak doğrulayın.

2. Yüklü iki zar için ortak bir dağıtım tablosu oluşturun. Marjinal dağılımları hesaplayın ve zarların bağımsız olup olmadığını kontrol edin.

3. Doğru sınıf indeks 3 olduğunda `[2.0, 0.5, -1.0, 3.0, 0.1]` logitlerini çıkaran 5 sınıflı bir sınıflandırıcı için çapraz entropi kaybını hesaplayın. Ardından cevabınızı PyTorch'un `nn.CrossEntropyLoss` ile doğrulayın.

4. Log olasılıklarının bir listesini alan ve en olası diziyi, toplam log olasılığını ve eşdeğer ham olasılığı döndüren bir fonksiyon yazın. Her kelimenin olasılığının 0,01 olduğu 50 kelimelik bir cümleyle test edin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|----------------------|
| Örnek uzay | "Tüm olasılıklar" | Bir deneyin olası her sonucunun S kümesi |
| PMF | "Olasılık fonksiyonu" | Toplamı 1 | olan, her ayrık sonucun kesin olasılığını veren bir fonksiyon.
| PDF | "Olasılık eğrisi" | Sürekli değişkenler için yoğunluk fonksiyonu. Olasılığı elde etmek için bunu bir aralıkta entegre edin |
| Koşullu olasılık | "Olasılık verilen bir şey" | P(A\|B) = P(A ve B) / P(B). Bayes düşüncesinin temeli ve Bayes teoremi |
| Bağımsızlık | "Birbirlerini etkilemezler" | P(A ve B) = P(A) * P(B). Bir olayı bilmek diğeri hakkında hiçbir şey söylemez |
| Beklenen değer | "Ortalama" | Tüm sonuçların olasılık ağırlıklı toplamı. loss function beklenen bir değerdir |
| Varyans | "Nasıl yayıldı" | Ortalamadan beklenen sapmanın karesi. Yüksek varyans = gürültülü, istikrarsız tahminler |
| Normal dağılım | "Çan eğrisi" | f(x) = (1/sqrt(2*pi*sigma^2)) * exp(-(x-mu)^2/(2*sigma^2)). CLT sayesinde her yerde görünür |
| Merkezi Limit Teoremi | "Ortalamalar normale dönüyor" | Birçok bağımsız örneğin ortalaması, kaynaktan bağımsız olarak normal dağılıma yakınsar |
| Ortak dağıtım | "İki değişken bir arada" | P(X, Y), X ve Y sonuçlarının her kombinasyonunun olasılığını tanımlar |
| Marjinal dağılım | "Diğer değişkeni toplayın" | P(X) = toplam_y P(X, Y). Bir değişkenin dağılımını eklemden kurtarır |
| Günlük olasılığı | "Olasılık günlüğü" | log P(x). Ürünleri toplamlara dönüştürerek uzun dizilerdeki sayısal taşkınları önler |
| Softmax | "Puanları olasılıklara dönüştürün" | softmax(z_i) = exp(z_i) / toplam(exp(z_j)). Gerçek değerli logitleri geçerli bir olasılık dağılımıyla eşler |
| Çapraz entropi | "loss function" | -sum(p_true * log(p_predicted)). İki dağılımın ne kadar farklı olduğunu ölçer. Daha düşük daha iyidir |
| Logitler | "Ham model çıktıları" | Softmax'tan önceki normalleştirilmemiş puanlar. Adını lojistik fonksiyonundan alıyor |
| Örnekleme | "Rastgele değerler çizme" | Olasılık dağılımına göre değerlerin üretilmesi. Modeller nasıl çıktı üretir |

## Daha Fazla Okuma

- [3Blue1Brown: Peki Merkezi Limit Teoremi nedir?](https://www.youtube.com/watch?v=zeJD6dqJ5lo) - ortalamaların neden normal hale geldiğinin görsel kanıtı
- [Stanford CS229 Olasılık İncelemesi](https://cs229.stanford.edu/section/cs229-prob.pdf) - buradaki her şeyi ve daha fazlasını kapsayan kısa bir referans
- [Log-Toplam-Exp Hilesi](https://gregorygundersen.com/blog/2020/02/09/log-sum-exp/) - sayısal kararlılık neden önemlidir ve buna nasıl ulaşılır
