# Örnekleme Yöntemleri

> Örnekleme, yapay zekanın olasılıklar alanını keşfetme şeklidir.

**Tür:** Yapım
**Dil:** Python
**Önkoşullar:** Aşama 1, Dersler 06-07 (Olasılık, Bayes Teoremi)
**Süre:** ~120 dakika

## Öğrenme Hedefleri

- Yalnızca tek tip rastgele sayılar kullanarak ters CDF, reddetme ve önem örneklemesini sıfırdan uygulayın
- token dil modeli oluşturma için sıcaklık, üst-k ve üst-p (çekirdek) örneklemesi oluşturun
- Yeniden parametrelendirme hilesini ve bunun neden VAE'lerde örnekleme yoluyla backpropagation'yi mümkün kıldığını açıklayın
- Normalleştirilmemiş bir hedef dağılımından örnekleme yapmak için Metropolis-Hastings MCMC'yi çalıştırın

## Sorun

Bir dil modeli, prompt'nizin işlenmesini tamamlar ve 50.000 logitlik bir vektör üretir. Sözlüğündeki her token için bir tane. Artık birini seçmesi gerekiyor. Nasıl?

Her zaman en yüksek olasılığa sahip token'yi seçerse her yanıt aynıdır. Deterministik. Sıkıcı. Eğer rastgele ve eşit bir şekilde seçerse, çıktı anlamsız olur. Cevap bu uç noktaların arasında bir yerde bulunuyor ve bir yer örneklemeyle kontrol ediliyor.

Örnekleme metin oluşturmayla sınırlı değildir. Takviyeli öğrenme, yörüngeleri örnekleyerek politika gradient'leri tahmin eder. VAE'ler, öğrenilen dağılımlardan örnek alarak ve rastgelelik yoluyla geriye yayılarak gizli temsilleri öğrenir. Difüzyon modelleri, gürültüyü örnekleyerek ve yinelemeli olarak gürültüyü gidererek görüntüler üretir. Monte Carlo yöntemleri, kapalı form çözümü olmayan integralleri tahmin eder. MCMC algoritmaları, numaralandırılması imkansız olan yüksek boyutlu sonsal dağılımları keşfeder.

Her üretken yapay zeka sistemi bir örnekleme sistemidir. Örnekleme stratejisi çıktının kalitesini, çeşitliliğini ve kontrol edilebilirliğini belirler. Bu ders, tekdüze rastgele sayılardan başlayarak modern yüksek lisans ve üretken modellere güç veren tekniklerle biten tüm önemli örnekleme yöntemlerini sıfırdan oluşturur.

## Konsept

### Örnekleme Neden Önemlidir

Örnekleme, AI ve machine learning genelinde dört temel rolde görünür:

**Nesil.** Dil modelleri, yayılma modelleri ve GAN'ların tümü örnekleme yoluyla çıktı üretir. Örnekleme algoritması yaratıcılığı, tutarlılığı ve çeşitliliği doğrudan kontrol eder. Sıcaklık, üst-k ve çekirdek örneklemesi mühendislerin her gün çevirdiği düğmelerdir.

**Eğitim.** Stokastik gradient iniş örnekleri mini grupları. Bırakma, devre dışı bırakılacak nöronları örnekler. Veri artırma rastgele dönüşümleri örnekler. Önem örneklemesi, takviyeli öğrenmedeki (PPO, TRPO) gradient varyansını azaltmak için örnekleri yeniden ağırlıklandırır.

**Tahmin.** ML'deki pek çok niceliğin kapalı form çözümü yoktur. Bir veri dağıtımında beklenen kayıp, enerji bazlı bir modelin bölümleme fonksiyonu, Bayesian inference'deki kanıtlar. Monte Carlo tahmini, örneklerin ortalamasını alarak tüm bunlara yaklaşır.

**Keşif.** MCMC algoritmaları Bayesian inference'deki sonsal dağılımları araştırır. Evrimsel stratejiler parametre bozukluklarını örneklendirir. Thompson örneklemesi, haydutlarda keşif ve sömürüyü dengeliyor.

Temel zorluk: yalnızca basit dağılımlardan (tek tip, normal) doğrudan örnekleme yapabilirsiniz. Diğer her şey için, basit örnekleri hedef dağıtımınızdaki örneklere dönüştürecek bir yönteme ihtiyacınız vardır.

### Tekdüze Rastgele Örnekleme

Her örnekleme yöntemi burada başlar. Düzgün bir rastgele sayı üreteci, eşit uzunluktaki her alt aralığın eşit olasılığa sahip olduğu [0, 1) cinsinden değerler üretir.

```
U ~ Uniform(0, 1)

P(a <= U <= b) = b - a    for 0 <= a <= b <= 1

Properties:
  E[U] = 0.5
  Var(U) = 1/12
```

N öğeden oluşan ayrı bir kümeden eşit şekilde örnekleme yapmak için, U oluşturun ve taban(n * U) değerini döndürün. Sürekli bir aralıktan [a, b] örnekleme yapmak için a + (b - a) * U'yu hesaplayın.

Temel fikir: Tek bir tekdüze rastgele sayı, herhangi bir dağılımdan bir örnek üretmek için tam olarak doğru miktarda rastgelelik içerir. İşin püf noktası doğru dönüşümü bulmaktır.

### Ters CDF Yöntemi (Ters Dönüşüm Örnekleme)

Kümülatif dağılım işlevi (CDF), değerleri olasılıklarla eşler:

```
F(x) = P(X <= x)

Properties:
  F is non-decreasing
  F(-inf) = 0
  F(+inf) = 1
  F maps the real line to [0, 1]
```

Ters CDF, olasılıkları tekrar değerlere eşler. Eğer U ~ Düzgün(0, 1) ise, o zaman X = F_inverse(U) hedef dağılımı takip eder.

```
Algorithm:
  1. Generate u ~ Uniform(0, 1)
  2. Return F_inverse(u)

Why it works:
  P(X <= x) = P(F_inverse(U) <= x) = P(U <= F(x)) = F(x)
```

**Üstel dağılım örneği:**

```
PDF: f(x) = lambda * exp(-lambda * x),   x >= 0
CDF: F(x) = 1 - exp(-lambda * x)

Solve F(x) = u for x:
  u = 1 - exp(-lambda * x)
  exp(-lambda * x) = 1 - u
  x = -ln(1 - u) / lambda

Since (1 - U) and U have the same distribution:
  x = -ln(u) / lambda
```

F_inverse'ü kapalı biçimde yazabildiğinizde bu mükemmel çalışır. Normal dağılım için kapalı formda ters CDF yoktur, bu nedenle başka yöntemler kullanırız (Box-Muller veya sayısal yaklaşım).

**Ayrık sürüm:** Ayrık dağıtımlar için CDF'yi kümülatif toplam olarak oluşturun, U oluşturun ve kümülatif toplamın U'yu aştığı ilk dizini bulun. `sample_categorical`, Ders 06'da bu şekilde çalışır.

### Reddetme Örneklemesi

CDF'yi ters çeviremediğinizde ancak hedef PDF'yi sabit bir değere kadar değerlendirebildiğinizde ret örneklemesi işe yarar.

```
Target distribution: p(x)  (can evaluate, possibly unnormalized)
Proposal distribution: q(x)  (can sample from)
Bound: M such that p(x) <= M * q(x) for all x

Algorithm:
  1. Sample x ~ q(x)
  2. Sample u ~ Uniform(0, 1)
  3. If u < p(x) / (M * q(x)), accept x
  4. Otherwise, reject and go to step 1

Acceptance rate = 1/M
```

M sınırı ne kadar sıkı olursa kabul oranı da o kadar yüksek olur. Düşük boyutlarda (1-3), ret örneklemesi iyi sonuç verir. Yüksek boyutlarda, teklif hacminin büyük bir kısmı reddedildiğinden kabul oranı katlanarak düşer. Bu, ret örneklemesi için boyutluluğun lanetidir.

**Örnek: kesik normalden örnekleme.** Kesilmiş aralıkta tek tip bir teklif kullanın. M zarfı, bu aralıktaki normal PDF'nin maksimumudur.

**Örnek: yarım daireden örnekleme.** Sınırlayıcı dikdörtgende eşit şekilde öneride bulunun. Noktanın yarım dairenin içine düşmesini kabul edin. Monte Carlo pi'yi bu şekilde hesaplıyor: kabul oranı pi/4 alan oranına eşittir.

### Önem Örnekleme

Bazen p(x) hedef dağılımından örneklere ihtiyacınız olmaz. p(x) altında bir beklenti tahmin etmeniz gerekiyor ve farklı bir q(x) dağılımından örnekleriniz var.

```
Goal: estimate E_p[f(x)] = integral of f(x) * p(x) dx

Rewrite:
  E_p[f(x)] = integral of f(x) * (p(x)/q(x)) * q(x) dx
            = E_q[f(x) * w(x)]

where w(x) = p(x) / q(x)  are the importance weights.

Estimator:
  E_p[f(x)] ~ (1/N) * sum(f(x_i) * w(x_i))    where x_i ~ q(x)
```

Takviyeli öğrenmede bu kritik öneme sahiptir. PPO'da (Yakınsal Politika Optimizasyonu), eski bir politika pi_old altında yörüngeleri topluyorsunuz, ancak yeni bir politika pi_new'i optimize etmek istiyorsunuz. Önem ağırlığı pi_new(a|s) / pi_old(a|s) şeklindedir. PPO, yeni politikanın eski politikadan çok fazla uzaklaşmasını önlemek için bu ağırlıkları kırpıyor.

Önem örnekleme tahmincisinin varyansı, q'nun p'ye ne kadar benzer olduğuna bağlıdır. Eğer q, p'den çok farklıysa, birkaç örnek çok büyük ağırlıklar alır ve tahmine hakim olur. Kendi kendine normalleştirilmiş önem örneklemesi, bu sorunu azaltmak için ağırlıkların toplamına bölünür:

```
E_p[f(x)] ~ sum(w_i * f(x_i)) / sum(w_i)
```

### Monte Carlo Tahmini

Monte Carlo tahmini, rastgele örneklerin ortalamasını alarak integrallere yaklaşır. Büyük sayılar kanunu yakınsamayı garanti eder.

```
Goal: estimate I = integral of g(x) dx over domain D

Method:
  1. Sample x_1, ..., x_N uniformly from D
  2. I ~ (Volume of D / N) * sum(g(x_i))

Error: O(1 / sqrt(N))   regardless of dimension
```

Hata oranı boyuttan bağımsızdır. Izgara tabanlı entegrasyonun imkansız olduğu yüksek boyutlarda Monte Carlo yöntemlerinin hakim olmasının nedeni budur.

**Pi tahmini:**

```
Sample (x, y) uniformly from [-1, 1] x [-1, 1]
Count how many fall inside the unit circle: x^2 + y^2 <= 1
pi ~ 4 * (count inside) / (total count)
```

**Beklentilerin tahmin edilmesi:**

```
E[f(X)] ~ (1/N) * sum(f(x_i))    where x_i ~ p(x)

The sample mean converges to the true expectation.
Variance of the estimator = Var(f(X)) / N
```

### Markov Zinciri Monte Carlo (MCMC): Metropolis-Hastings

MCMC, durağan dağılımı p(x) hedef dağılımı olan bir Markov zinciri oluşturur. Yeterli adımdan sonra, zincirden alınan örnekler (yaklaşık olarak) p(x)'ten alınan örneklerdir.

```
Target: p(x)  (known up to a normalizing constant)
Proposal: q(x'|x)  (how to propose the next state given the current state)

Metropolis-Hastings algorithm:
  1. Start at some x_0
  2. For t = 1, 2, ..., T:
     a. Propose x' ~ q(x'|x_t)
     b. Compute acceptance ratio:
        alpha = [p(x') * q(x_t|x')] / [p(x_t) * q(x'|x_t)]
     c. Accept with probability min(1, alpha):
        - If u < alpha (u ~ Uniform(0,1)): x_{t+1} = x'
        - Otherwise: x_{t+1} = x_t
  3. Discard first B samples (burn-in)
  4. Return remaining samples
```

Simetrik önermeler için (q(x'|x) = q(x|x')), oran p(x')/p(x) şeklinde basitleştirilir. Bu orijinal Metropolis algoritmasıdır.

**Neden işe yarıyor.** Kabul kuralı ayrıntılı bir denge sağlar: x'te olma ve x'e gitme olasılığı, x'de olma ve x'e gitme olasılığına eşittir. Ayrıntılı denge, p(x)'in zincirin durağan dağılımı olduğunu ima eder.

**Pratik hususlar:**
- Yanma: zincir dengeye ulaşmadan önce erken numuneleri atın
- İnceltme: otokorelasyonu azaltmak için her k'inci örneği saklayın
- Teklif ölçeği: çok küçük ve zincir yavaş hareket ediyor (yüksek kabul, yavaş keşif); çok büyük ve tekliflerin çoğu reddediliyor (düşük kabul, yerinde kalmış)
- Yüksek boyutlarda bir Gauss teklifinin optimal kabul oranı yaklaşık 0,234'tür.

### Gibbs Örneklemesi

Gibbs örneklemesi, çok değişkenli dağılımlar için MCMC'nin özel bir durumudur. Aynı anda tüm boyutlarda bir hareket önermek yerine, koşullu dağılımından her seferinde bir değişkeni günceller.

```
Target: p(x_1, x_2, ..., x_d)

Algorithm:
  For each iteration t:
    Sample x_1^{t+1} ~ p(x_1 | x_2^t, x_3^t, ..., x_d^t)
    Sample x_2^{t+1} ~ p(x_2 | x_1^{t+1}, x_3^t, ..., x_d^t)
    ...
    Sample x_d^{t+1} ~ p(x_d | x_1^{t+1}, x_2^{t+1}, ..., x_{d-1}^{t+1})
```

Gibbs örneklemesi, her koşullu p(x_i | x_{-i}) dağılımından örnekleme yapabilmenizi gerektirir. Bu birçok model için basittir:
- Bayes ağları: koşul ifadeleri grafik yapısından gelir
- Gauss karışımları: koşul ifadeleri Gauss'tur
- Ising modelleri: her spinin koşulu yalnızca komşularına bağlıdır

Kabul oranı her zaman 1'dir (her teklif kabul edilir), çünkü tam koşulludan örnekleme ayrıntılı dengeyi otomatik olarak karşılar.

**Sınırlama.** Değişkenler yüksek düzeyde korelasyona sahip olduğunda, Gibbs örneklemesi yavaş karışır çünkü bir seferde bir değişkenin güncellenmesi, dağılımda büyük çapraz hareketler yapamaz.

### Sıcaklık Örneklemesi (LLM'lerde Kullanılır)

Dil modelleri, sözlükteki her token için z_1, ..., z_V logitlerinin çıktısını alır. Softmax bunları olasılıklara dönüştürür. Sıcaklık, softmax'tan önce logitleri yeniden ölçeklendirir:

```
p_i = exp(z_i / T) / sum(exp(z_j / T))

T = 1.0: standard softmax (original distribution)
T -> 0:  argmax (deterministic, always picks highest logit)
T -> inf: uniform (all tokens equally likely)
T < 1.0: sharpens the distribution (more confident, less diverse)
T > 1.0: flattens the distribution (less confident, more diverse)
```

**Neden işe yarıyor?** Logitleri T < 1'e bölmek logitler arasındaki farkları artırır. z_1 = 2 ve z_2 = 1 ise, T = 0,5'e bölmek z_1/T = 4 ve z_2/T = 2'yi verir, bu da boşluğu daha büyük hale getirir. Softmax'tan sonra en yüksek logitli token çok daha büyük bir pay alıyor.

**Uygulamada:**
- T = 0,0: açgözlü kod çözme, gerçek soru-cevap için en iyisi
- T = 0,3-0,7: biraz yaratıcı, kod oluşturmak için iyi
- T = 0,7-1,0: dengeli, genel sohbet için iyi
- T = 1.0-1.5: yaratıcı yazma, beyin fırtınası
- T > 1,5: giderek daha rastgele, nadiren kullanışlı

Sıcaklık hangi token'lerin mümkün olduğunu değiştirmez. Her token'ye tahsis edilen olasılık kütlesini değiştirir.

### Top-k Örnekleme

Top-k örnekleme, aday kümesini en yüksek olasılığa sahip k token ile sınırlandırır, ardından yeniden normalleştirir ve bu sınırlı kümeden örnekler alır.

```
Algorithm:
  1. Compute softmax probabilities for all V tokens
  2. Sort tokens by probability (descending)
  3. Keep only the top k tokens
  4. Renormalize: p_i' = p_i / sum(p_j for j in top-k)
  5. Sample from the renormalized distribution

k = 1:  greedy decoding
k = V:  no filtering (standard sampling)
k = 40: typical setting, removes long tail of unlikely tokens
```

Top-k, modelin, kelime dağarcığının uzun kuyruğunda bulunan son derece olası olmayan token'leri (yazım hataları, anlamsız) seçmesini önler. Sorun: k bağlamdan bağımsız olarak düzeltildi. Model kendinden emin olduğunda (bir token'nin olasılığı %95'tir), k = 40 yine de 39 alternatife izin verir. Model belirsiz olduğunda (olasılık 1000 token'ye yayılmıştır), k = 40 makul seçenekleri devre dışı bırakır.

### Üst-p (Çekirdek) Örnekleme

Top-p örnekleme, aday kümesi boyutunu dinamik olarak ayarlar. Sabit sayıda token tutmak yerine, kümülatif olasılığı p'yi aşan en küçük token kümesini tutar.

```
Algorithm:
  1. Compute softmax probabilities for all V tokens
  2. Sort tokens by probability (descending)
  3. Find smallest k such that sum of top-k probabilities >= p
  4. Keep only those k tokens
  5. Renormalize and sample

p = 0.9:  keeps tokens covering 90% of probability mass
p = 1.0:  no filtering
p = 0.1:  very restrictive, nearly greedy
```

Model kendinden emin olduğunda, çekirdek örneklemesi birkaç token (belki 2-3) tutar. Model belirsiz olduğunda birçok (belki 200) tutar. Bu uyarlanabilir davranış, çekirdek örneklemenin genellikle üst-k'den daha iyi metin üretmesinin nedenidir.

**Ortak kombinasyonlar:**
- Sıcaklık 0,7 + üst-p 0,9: iyi genel amaçlı ayar
- Sıcaklık 0,0 (açgözlü): deterministik görevler için en iyisi
- Sıcaklık 1,0 + üst-k 50: Fan ve ark. (2018) orijinal kağıt ayarı

Top-k ve top-p birleştirilebilir. Kalan sete önce top-k'yi, ardından top-p'yi uygulayın.

### Yeniden Parametrelendirme Hilesi (VAE'lerde Kullanılır)

Varyasyonel otomatik kodlayıcılar (VAE'ler), girdileri gizli uzaydaki bir dağıtıma kodlayarak, bu dağılımdan örnek alarak ve örneğin geri kodunu çözerek öğrenir. Sorun: Bir örnekleme işlemi yoluyla geriye yayılım yapamazsınız.

```
Standard sampling (not differentiable):
  z ~ N(mu, sigma^2)

  The randomness blocks gradient flow.
  d/d_mu [sample from N(mu, sigma^2)] = ???
```

Yeniden parametrelendirme numarası, rastgeleliği parametrelerden ayırır:

```
Reparameterized sampling:
  epsilon ~ N(0, 1)          (fixed random noise, no parameters)
  z = mu + sigma * epsilon   (deterministic function of parameters)

  Now z is a deterministic, differentiable function of mu and sigma.
  d(z)/d(mu) = 1
  d(z)/d(sigma) = epsilon

  Gradients flow through mu and sigma.
```

Bu işe yarar çünkü N(mu, sigma^2), mu + sigma * N(0, 1) ile aynı dağılıma sahiptir. Temel fikir: rastgeleliği parametresiz bir kaynağa (epsilon) taşıyın, ardından örneği parametrelerin türevlenebilir bir dönüşümü olarak ifade edin.

**VAE eğitim döngüsünde:**
1. Kodlayıcı her giriş için mu ve log(sigma^2) çıktısı verir
2. Örnek epsilon ~ N(0, 1)
3. z = mu + sigma * epsilon'u hesaplayın
4. Girişi yeniden oluşturmak için z'nin kodunu çözün
5. 4, 3, 2, 1. adımlarla geriye yayılım yapın (3. adımın türevlenebilir olması nedeniyle mümkündür)

Yeniden parametrelendirme hilesi olmadan VAE'ler standart backpropagation ile eğitilemez. Bu tek içgörü VAE'leri pratik hale getirdi.

### Gumbel-Softmax (Farklılaştırılabilir Kategorik Örnekleme)

Yeniden parametrelendirme hilesi sürekli dağılımlar (Gaussian) için işe yarar. Ayrık kategorik dağılımlar için farklı bir yaklaşıma ihtiyacımız var. Gumbel-Softmax, kategorik örneklemeye farklılaştırılabilir bir yaklaşım sağlar.

**Gumbel-Max numarası (diferansiyellenemeyen):**

```
To sample from a categorical distribution with log-probabilities log(p_1), ..., log(p_k):
  1. Sample g_i ~ Gumbel(0, 1) for each category
     (g = -log(-log(u)), where u ~ Uniform(0, 1))
  2. Return argmax(log(p_i) + g_i)

This produces exact categorical samples.
```

**Gumbel-Softmax (diferansiyellenebilir yaklaşım):**

```
Replace the hard argmax with a soft softmax:
  y_i = exp((log(p_i) + g_i) / tau) / sum(exp((log(p_j) + g_j) / tau))

tau (temperature) controls the approximation:
  tau -> 0:  approaches a one-hot vector (hard categorical)
  tau -> inf: approaches uniform (1/k, 1/k, ..., 1/k)
  tau = 1.0: soft approximation
```

Gumbel-Softmax ayrı bir numunenin sürekli gevşemesini sağlar. Çıktı, sert bir sıcak yerine bir olasılık vektörüdür (yumuşak bir sıcak). Gradient'ler softmax üzerinden akar. Eğitimde ileri geçiş sırasında "düz" tahminciyi kullanabilirsiniz: ileri geçiş için sert argmax'ı, geri geçiş için ise yumuşak Gumbel-Softmax gradient'leri kullanın.

**Uygulamalar:**
- VAE'lerde ayrık gizli değişkenler
- Sinir mimarisi araması (ayrı işlemleri seçme)
- Sert attention mechanism'ler
- Ayrık eylemlerle pekiştirmeli öğrenme

### Tabakalı Örnekleme

Standart Monte Carlo örneklemesi, örnek uzayda şans eseri boşluklar bırakabilir. Katmanlı örnekleme, alanı katmanlara bölerek ve her birinden örnek alarak eşit kapsama alanı sağlar.

```
Standard Monte Carlo:
  Sample N points uniformly from [0, 1]
  Some regions may have clusters, others gaps

Stratified sampling:
  Divide [0, 1] into N equal strata: [0, 1/N), [1/N, 2/N), ..., [(N-1)/N, 1)
  Sample one point uniformly within each stratum
  x_i = (i + u_i) / N   where u_i ~ Uniform(0, 1),  i = 0, ..., N-1
```

Katmanlı örnekleme, standart Monte Carlo'ya kıyasla her zaman daha düşük veya eşit varyansa sahiptir:

```
Var(stratified) <= Var(standard Monte Carlo)

The improvement is largest when f(x) varies smoothly.
For piecewise-constant functions, stratified sampling is exact.
```

**Uygulamalar:**
- Sayısal entegrasyon (Monte Carlo benzeri)
- Eğitim verisi bölmeleri (her katlamada sınıf dengesinin sağlanması)
- Tabakalandırmayla önem örneklemesi (her iki tekniğin birleştirilmesi)
- NeRF (Nöral Parlaklık Alanları), kamera ışınları boyunca katmanlı örneklemeyi kullanır

### Difüzyon Modellerine Bağlantı

Difüzyon modelleri bir örnekleme süreci yoluyla görüntüler üretir. İleri işlem, saf gürültü haline gelinceye kadar T adımları boyunca bir görüntüye Gauss gürültüsünü ekler. Ters işlem, orijinal görüntüyü adım adım kurtararak gürültüyü gidermeyi öğrenir.

```
Forward process (known):
  x_t = sqrt(alpha_t) * x_{t-1} + sqrt(1 - alpha_t) * epsilon
  where epsilon ~ N(0, I)

  After T steps: x_T ~ N(0, I)  (pure noise)

Reverse process (learned):
  x_{t-1} = (1/sqrt(alpha_t)) * (x_t - (1 - alpha_t)/sqrt(1 - alpha_bar_t) * epsilon_theta(x_t, t)) + sigma_t * z
  where z ~ N(0, I)

  Each denoising step is a sampling step.
```

Bu dersteki yöntemlerle bağlantı:
- Her gürültü giderme adımında yeniden parametrelendirme hilesi kullanılır (örnek gürültü, deterministik dönüşüm uygulanır)
- Gürültü programı {alpha_t} bir tür sıcaklık tavlamasını kontrol eder
- Eğitim, ELBO'ya (kanıt alt sınırı) yaklaşmak için Monte Carlo tahminini kullanır
- Difüzyon modellerinde atalardan kalma örnekleme bir Markov zinciridir (her adım yalnızca mevcut duruma bağlıdır)

Görüntü oluşturma sürecinin tamamı yinelemeli örneklemedir: gürültüden başlayın ve her adımda öğrenilen gürültü giderme modeline göre biraz daha az gürültülü bir versiyonu örnekleyin.

```figure
monte-carlo-pi
```

## İnşa Et

### Adım 1: Tek tip ve ters CDF örneklemesi

```python
import math
import random

def sample_uniform(a, b):
    return a + (b - a) * random.random()

def sample_exponential_inverse_cdf(lam):
    u = random.random()
    return -math.log(u) / lam
```

10.000 üstel örnek oluşturun ve ortalamanın 1/lambda olduğunu doğrulayın.

### Adım 2: Reddetme örneklemesi

```python
def rejection_sample(target_pdf, proposal_sample, proposal_pdf, M):
    while True:
        x = proposal_sample()
        u = random.random()
        if u < target_pdf(x) / (M * proposal_pdf(x)):
            return x
```

Kesilmiş bir normal dağılımdan yararlanmak için ret örneklemesini kullanın. Örnekleri histogramlayarak şekli doğrulayın.

### Adım 3: Önem örneklemesi

```python
def importance_sampling_estimate(f, target_pdf, proposal_pdf, proposal_sample, n):
    total = 0
    for _ in range(n):
        x = proposal_sample()
        w = target_pdf(x) / proposal_pdf(x)
        total += f(x) * w
    return total / n
```

Tek tip bir öneri kullanarak normal dağılım altında E[X^2]'yi tahmin edin. Bilinen yanıtla karşılaştırın (mu^2 + sigma^2).

### Adım 4: Pi'nin Monte Carlo tahmini

```python
def monte_carlo_pi(n):
    inside = 0
    for _ in range(n):
        x = random.uniform(-1, 1)
        y = random.uniform(-1, 1)
        if x*x + y*y <= 1:
            inside += 1
    return 4 * inside / n
```

### Adım 5: Metropolis-Hastings MCMC

```python
def metropolis_hastings(target_log_pdf, proposal_sample, proposal_log_pdf, x0, n_samples, burn_in):
    samples = []
    x = x0
    for i in range(n_samples + burn_in):
        x_new = proposal_sample(x)
        log_alpha = (target_log_pdf(x_new) + proposal_log_pdf(x, x_new)
                     - target_log_pdf(x) - proposal_log_pdf(x_new, x))
        if math.log(random.random()) < log_alpha:
            x = x_new
        if i >= burn_in:
            samples.append(x)
    return samples
```

Bimodal dağılımdan örnek (iki Gauss'un karışımı). Zincirin yörüngesini gözünüzde canlandırın.

### Adım 6: Gibbs örneklemesi

```python
def gibbs_sampling_2d(conditional_x_given_y, conditional_y_given_x, x0, y0, n_samples, burn_in):
    x, y = x0, y0
    samples = []
    for i in range(n_samples + burn_in):
        x = conditional_x_given_y(y)
        y = conditional_y_given_x(x)
        if i >= burn_in:
            samples.append((x, y))
    return samples
```

### Adım 7: Sıcaklık örneklemesi

```python
def softmax(logits):
    max_l = max(logits)
    exps = [math.exp(z - max_l) for z in logits]
    total = sum(exps)
    return [e / total for e in exps]

def temperature_sample(logits, temperature):
    scaled = [z / temperature for z in logits]
    probs = softmax(scaled)
    return sample_from_probs(probs)
```

token logit kümesi için sıcaklığın çıkış dağılımını nasıl değiştirdiğini gösterin.

### Adım 8: Üst-k ve üst-p örneklemesi

```python
def top_k_sample(logits, k):
    indexed = sorted(enumerate(logits), key=lambda x: -x[1])
    top = indexed[:k]
    top_logits = [l for _, l in top]
    probs = softmax(top_logits)
    idx = sample_from_probs(probs)
    return top[idx][0]

def top_p_sample(logits, p):
    probs = softmax(logits)
    indexed = sorted(enumerate(probs), key=lambda x: -x[1])
    cumsum = 0
    selected = []
    for token_idx, prob in indexed:
        cumsum += prob
        selected.append((token_idx, prob))
        if cumsum >= p:
            break
    sel_probs = [pr for _, pr in selected]
    total = sum(sel_probs)
    sel_probs = [pr / total for pr in sel_probs]
    idx = sample_from_probs(sel_probs)
    return selected[idx][0]
```

### Adım 9: Yeniden parametrelendirme numarası

```python
def reparam_sample(mu, sigma):
    epsilon = random.gauss(0, 1)
    return mu + sigma * epsilon

def reparam_gradient(mu, sigma, epsilon):
    dz_dmu = 1.0
    dz_dsigma = epsilon
    return dz_dmu, dz_dsigma
```

gradient'lerin yeniden parametrelendirilmiş örnek üzerinden aktığını ancak doğrudan örnekleme yoluyla akmadığını gösterin.

### Adım 10: Gumbel-Softmax

```python
def gumbel_sample():
    u = random.random()
    return -math.log(-math.log(u))

def gumbel_softmax(logits, temperature):
    gumbels = [math.log(p) + gumbel_sample() for p in logits]
    return softmax([g / temperature for g in gumbels])
```

Azalan sıcaklığın çıktının bir sıcak vektöre nasıl yaklaştığını gösterin.

Tüm görselleştirmelerle birlikte tam uygulamalar `code/sampling.py`'dedir.

## Kullan onu

NumPy ve SciPy ile üretim versiyonları:

```python
import numpy as np

rng = np.random.default_rng(42)

exponential_samples = rng.exponential(scale=2.0, size=10000)
print(f"Exponential mean: {exponential_samples.mean():.4f} (expected 2.0)")

from scipy import stats
normal = stats.norm(loc=0, scale=1)
print(f"CDF at 1.96: {normal.cdf(1.96):.4f}")
print(f"Inverse CDF at 0.975: {normal.ppf(0.975):.4f}")

logits = np.array([2.0, 1.0, 0.5, 0.1, -1.0])
temperature = 0.7
scaled = logits / temperature
probs = np.exp(scaled - scaled.max()) / np.exp(scaled - scaled.max()).sum()
token = rng.choice(len(logits), p=probs)
print(f"Sampled token index: {token}")
```

Geniş ölçekte MCMC için özel kitaplıkları kullanın:
- PyMC: NUTS (adaptif HMC) ile tam Bayesian modelleme
- sunucu: topluluk MCMC örnekleyici
- NumPyro/JAX: GPU hızlandırmalı MCMC

Bunları sıfırdan inşa ettin. Artık kütüphane çağrılarının ne yaptığını biliyorsunuz.

## Egzersizler

1. Cauchy dağılımı için ters CDF örneklemesini uygulayın. CDF, F(x) = 0,5 + arktan(x)/pi'dir. 10.000 örnek oluşturun ve histogramı gerçek PDF'ye göre çizin. Ağır kuyruklara dikkat edin (merkezden uzaktaki uç değerler).

2. Tekdüzen(0, 1) önerisini kullanarak Beta(2, 5) dağılımından örnekler oluşturmak için ret örneklemesini kullanın. Kabul edilen örnekleri gerçek Beta PDF'ye göre çizin. Teorik kabul oranı nedir?

3. 1.000, 10.000 ve 100.000 örnekli Monte Carlo'yu kullanarak sin(x)'in 0'dan pi'ye integralini tahmin edin. Her seviyedeki hatayı karşılaştırın. Hatanın O(1/sqrt(N)) olarak ölçeklendiğini doğrulayın.

4. Metropolis-Hastings'i uygulayarak exp(-(x^2 * y^2 + x^2 + y^2 - 8*x - 8*y) / 2) ile orantılı bir 2 boyutlu p(x, y) dağılımından örnekleme yapın. Örnekleri ve zincir yörüngesini çizin. Farklı teklif standart sapmalarıyla denemeler yapın.

5. Tam bir metin oluşturma demosu oluşturun: logitlerle birlikte 10 kelimelik bir kelime dağarcığı verildiğinde, (a) greedy, (b) sıcaklık=0,7, (c) top-k=3, (d) top-p=0,9'u kullanarak 20 token dizisi oluşturun. 5 çalıştırmadaki çıktı çeşitliliğini karşılaştırın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|----------------------|
| Örnekleme | "Rastgele değerler çizme" | Olasılık dağılımına göre değerlerin üretilmesi. Tüm üretken yapay zekanın arkasındaki mekanizma |
| Düzgün dağıtım | "Hepsi eşit derecede muhtemel" | [a, b]'deki her değer eşit olasılık yoğunluğuna 1/(b-a) sahiptir. Tüm numune alma yöntemlerinin başlangıç ​​noktası |
| Ters CDF | "Olasılık dönüşümü" | F_inverse(U), tekdüze bir numuneyi, bilinen CDF'ye sahip herhangi bir dağılımdan bir numuneye dönüştürür. Kesin ve etkili |
| Reddetme örneklemesi | "Öner ve kabul et/reddet" | Basit bir tekliften yola çıkarak hedef/teklif oranıyla orantılı olasılıkla kabul edin. Aynen ama örnekleri israf ediyor |
| Önem örneklemesi | "Örnekleri yeniden tartın" | Her numuneyi p(x)/q(x) ile ağırlıklandırarak q(x)'ten alınan numuneleri kullanarak p(x) kapsamındaki beklentileri tahmin edin. RL'de PPO'ya Çekirdek |
| Monte Carlo | "Ortalama rastgele örnekler" | Örnek ortalamaları olarak yaklaşık integraller. Hata O(1/sqrt(N)) boyuttan bağımsız olarak |
| MCMC | "Yakınlaşan rastgele yürüyüş" | Durağan dağılımı hedef olan bir Markov zinciri oluşturun. Metropolis-Hastings temel algoritmadır |
| Metropolis-Hastings | "Yokuş yukarıyı, bazen yokuş aşağıyı kabul edin" | Hareket önerin, yoğunluk oranına göre kabul edin. Ayrıntılı denge, hedef dağılıma yakınlaşmayı sağlar |
| Gibbs örneklemesi | "Aynı anda tek değişken" | Her değişkeni, diğerlerini sabit tutarak koşullu dağılımından güncelleyin. %100 kabul oranı |
| Sıcaklık | "Güven düğmesi" | Logitleri softmax'tan önce T'ye böler. T<1 keskinleştirir (daha güvenli), T>1 düzleştirir (daha çeşitli) |
| En iyi örnekleme | "K'yi en iyi şekilde tutun" | En yüksek olasılıklı token dışında hepsini sıfırlayın, yeniden normalleştirin, örnekleyin. Sabit aday kümesi boyutu |
| Çekirdek örneklemesi (üst-p) | "Olası olanları saklayın" | Kümülatif olasılığı p'yi aşan en küçük token kümesini tutun. Uyarlanabilir aday kümesi boyutu |
| Yeniden parametrelendirme numarası | "Rastgeleliği dışarıya taşı" | z = mu + sigma * epsilon yazın; burada epsilon ~ N(0,1) olur. Örneklemeyi farklılaştırılabilir hale getirir. VAE eğitimi için gerekli |
| Gumbel-Softmax | "Yumuşak kategorik örnekleme" | Gumbel gürültüsü + softmax ve sıcaklık kullanılarak kategorik örneklemeye farklılaştırılabilir yaklaşım |
| Tabakalı örnekleme | "Zorunlu kapsama" | Örnek uzayı katmanlara bölün ve her birinden örnek alın. Saf Monte Carlo'dan her zaman daha düşük sapma |
| Yanma | "Isınma süresi" | Zincir sabit dağılımına ulaşmadan ilk MCMC örnekleri atıldı |
| Ayrıntılı bakiye | "Tersinilebilirlik koşulu" | p(x) * T(x->y) = p(y) * T(y->x). P'nin Markov zincirinin durağan dağılımı olması için yeterli koşul |
| Difüzyon örneklemesi | "Yinelemeli gürültü giderme" | Gürültüden başlayarak ve öğrenilen gürültü giderme adımlarını uygulayarak veri oluşturun. Her adım koşullu bir örnekleme işlemidir |

## Daha Fazla Okuma

- [Holbrook (2023): Metropolis-Hastings Algoritması](https://arxiv.org/abs/2304.07010) - MCMC temelleri hakkında ayrıntılı eğitim
- [Jang, Gu, Poole (2017): Gumbel-Softmax ile Kategorik Yeniden Parametrelendirme](https://arxiv.org/abs/1611.01144) - orijinal Gumbel-Softmax makalesi
- [Holtzman ve ark. (2020): Sinirsel Metin Dejenerasyonunun Tuhaf Hikayesi](https://arxiv.org/abs/1904.09751) - çekirdek (üst-p) örnekleme makalesi
- [Kingma ve Welling (2014): Değişken Bayes'i Otomatik Kodlama](https://arxiv.org/abs/1312.6114) - Yeniden parametrelendirme hilesini tanıtan VAE makalesi
- [Ho, Jain, Abbeel (2020): Gürültüyü Azaltan Difüzyon Olasılık Modelleri](https://arxiv.org/abs/2006.11239) - DDPM, örneklemeyi görüntü oluşturmaya bağlar
