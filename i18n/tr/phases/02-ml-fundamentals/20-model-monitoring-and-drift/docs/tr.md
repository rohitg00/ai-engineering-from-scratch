# Üretimdeki İzleme Modelleri  Veriler ve Konsepler

> Bir model bir hata mesajı olmadan başarısız olur. Dünya eğitim verilerinden uzaklaşırken puanları geri verir ve sadece izleme boşluğu gösterir.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 2, Lessons 09 (Model Evaluation), 16 (Anomaly Detection), and 19 (ML System Design)
**Time:** ~110 minutes

## Öğrenme Hedefleri

- Dört katmanlı izleme sinyallerini seçin: sistem sağlığı, girişler, tahminler ve sonuçlar
- Kopaylı sürükleme, önceki sürükleme ve kavram sürüklemeyi, değişen ortak dağılımın parçasıyla ayırt edin
- Nüfusun Durgunluk Endeksi, Kolmogorov-Smirnov istatistikinin iki örnekle ve çikre testiyi baştan başlatacak.
- Sıkı bir referans penceresini kaydırıcı akım pencereleri ile karşılaştırın ve pencerenin boyutunun gürültü ve gecikme değişikliklerini açıklayın
- Yanlış alarmların etki boyutları, birden fazla test doğrultusunda ve ısrar kuralıyla sınırlandırılacağı bir uyarı politikası tasarlayın
- Hangi sürükleme yeniden eğitime ihtiyacı olduğunu, hangi yeni etiketlere ihtiyacı olduğunu ve hangi hareketlere ihtiyacı olmadığını karar verin.

## Sorun

Ödeme risk modeli yüzde 95 doğrulukla canlı yayımlanıyor. İki ay sonra bir pazarlama kampanyası daha büyük sepetlerle uygulama kullanıcılarını içeri getiriyor.

Bu süre boyunca model hizmet her istek için HTTP 200'yi gönderir. Gecikme normaldir ve kayıtlar hata göstermez. Başarısızlığın ilk belirtisi hasarın haftaları sonra geri yükleme hakkında finans raporudur.

Yazılım izleme, bir hizmetin cevap verdiğini kontrol eder. Model izleme, cevapların hala doğru olup olmadığını ve verilerin hala modeli eğitmiş olan verilere benzeyip benzemeyeceğini kontrol eder. Bu ders, ikinci iş için istatistikleri, pencereleri ve uyarı politikasını oluşturur. Onları iki enjekte edilen değişiklikle sentetik akışta çalıştırır ve hangi monitör hangi değişikliğe tepki gösterdiğini izler.

## Anlaşım

### Neyi izlemek

Dört katmanı izle, ilk üç kat erken uyarılar verir, sadece dördüncü kat doğruyu ölçer ve geç gelir.

| Layer | Signals | Available | Question it answers |
|---|---|---|---|
| System health | p50 and p99 latency, error rate, throughput, memory | At once | Does the service answer? |
| Inputs | Distribution of each feature, missing-value rate, schema, new categories | At once | Does live data look like training data? |
| Predictions | Score distribution, positive rate, share of default answers | At once | Does the model behave as before? |
| Outcomes | Accuracy, precision, calibration, business metric | After the label delay | Is the model still right? |

Bu dersin ana konusu giriş izlemektir, çünkü etiketlerin gelmesinden önce çalışır. Demo'nun gösterdiği bir sınırı vardır: bazı değişiklikler girişleri dokunmadan bırakır.

### Üç çeşit sürükleme

Girişlerin ortak dağılımını yazın `x`ve etiketleri`y`İki şekilde:

```math
P(x, y) = P(x) \cdot P(y \mid x) = P(y) \cdot P(x \mid y)
```

Her tür sürükleme farklı bir faktörü değiştirir:

| Drift | What changes | What stays | Payment example | Which monitor sees it |
|---|---|---|---|---|
| Covariate drift | `P(x)` | `P(y \| x)` | More app users with larger baskets | Input monitors |
| Prior drift | `P(y)` | `P(x \| y)` | The fraud rate doubles during an attack, and fraud looks the same | Prediction and outcome monitors |
| Concept drift | `P(y \| x)` | Can stay | The same basket now has a different fraud risk | Outcome monitors only |

Gama et al. bir değişiklik yapın.`P(y | x)`Gerçek kavram sürüşü.`P(x)`Bu da bırakıyor.`P(y | x)`Bu araştırma, sürüşün zaman içinde nasıl gerçekleşeceğine göre de sınıflandırılır: ani, aşamalı, yavaş veya tekrar gelen bir kavram olarak.

Kovariyatif çekim her zaman zarar vermez.`P(y | x)`Trafik çok az eğitim verisi olan veya karar sınırına yakın bölgelerde hareket ederken yine de doğruluğunu kaybedebilir.

### Gecikmiş etiketler

Sonuç tahminden sonra gelir. Gecikme soruna bağlıdır:

| Problem | When the label arrives |
|---|---|
| Ad click | Seconds |
| Churn in the next 30 days | 30 days |
| Card fraud | When the chargeback arrives, often weeks later |
| Loan default | Months or years |

Gecikme sırasında, giriş ve tahminleriniz var ama sonuçlar yoktur. Girişleri ve tahminleri izleyin, geldiğinde etiketlere katılın ve sadece etiketlenen bölümde sonuç ölçümlerini hesaplayın. Demo 500 olayın etiket gecikmesini kullanır, bu nedenle sonuç monitörü her zaman 500 olayı geçmişe bakır.

### Referans ve mevcut pencereler

Her sürükleme testi iki örnek karşılaştırır:

- **Reference window.**Eğitim verileri, ya da elle kontrol ettiğiniz üretim süresi.
- **Current window.**En son olaylar, ya da son olaylar.`N`olaylar veya son olaylar `T`Saatler.

Bir kaydırıcı pencerenin boyutundan bir adım daha küçük bir adım ileriye doğru hareket etmesi, böylece ardı ardına pencereler örtüşmektedir. Bir kaydırıcı pencerenin tam boyutuyla hareket etmesi. Pencere boyutu bir değişimdir. Küçük bir pencere hızlı bir şekilde tepki verir, ancak ses çıkışı olarak puanlar. Büyük bir pencere istikrarlıdır, ancak geç bir değişiklik bildirir.

Mevsimsellik saf pencereleri kırar. Pazartesi trafiği birçok üründe Cumartesi trafiğinden farklıdır. İpucu bir döngü kapsamasını tamamlayın veya her pencereni daha önceki döngüdeki aynı döneme karşılaştırın.

### Nüfusun Durgunluk Endeksi

PSI kredi puanlamasından gelir. Referans değerlerini kutulara, genellikle referans desillerinde on kutuya ayırın, böylece her kutu referansın yüzde 10'unu tutar.

```math
\text{PSI} = \sum_{\text{bins}} (\text{current\_share} - \text{reference\_share}) \cdot \ln\left(\frac{\text{current\_share}}{\text{reference\_share}}\right)
```

0'nun payı olan bir bin, günlük sonsuz yapar, bu nedenle her payı 0.0001 gibi küçük bir değere kadar kesin. PSI simetriktir.

Pratikçiler PSI'yi sabit bantlarla okuyor: 0.1'den aşağı sabit, 0.1'den 0.25'e kadar orta bir değişim ve 0.25'den yukarı önemli bir değişimdir. Bu bantları bir test değil bir konvensiyon olarak değerlendirin. PSI kutu sayısıyla büyüyor ve örnek boyutlarıyla küçülüyor.

### Kolmogorov-Smirnov istatistikleri

İki örnekli KS istatistikleri `D`iki empiriyel kumülatüel dağılım fonksiyonu arasındaki en büyük dikey boşluk:

```math
D = \max_x \left\lvert F_{\text{reference}}(x) - F_{\text{current}}(x) \right\rvert
```

`D`Aynı örnekler için 0 ve üst üste olmayan örnekler için 1'dir.`n * m / (n + m)`- Evet .

Büyük örnekler için, p değeri hiç kimsenin umurunda olmayan bir boşluk için sıfıra gider.`D`Efekt boyutu olarak kendini gösterir ve sadece her ikisinin de farkında olduğu zaman uyarılır.`D`ve p değeri eşiğinin sınırlarını geçiyor.

### Kategori özellikleri için Chi-square testi

Ödeme kanalı gibi kategorik bir özelliğe göre, her kategoriye göre iki satır (referans, akım) ve bir sütunlu bir tablo oluşturun.

```math
\begin{aligned}
\text{expected}[r][c] &= \text{row\_total}[r] \cdot \text{column\_total}[c] / \text{grand\_total} \\
\text{chi2} &= \sum_{\text{cells}} (\text{observed} - \text{expected})^2 / \text{expected}
\end{aligned}
```

Testin sonucu`k - 1``k`Kategori. Sadece mevcut pencerede görünen bir kategori büyük bir terim ekler, bu nedenle test yeni değerlere tepki verir. Cramér'in V'si etki boyutudur.`chi2 / grand_total`- Evet .

### Alarm eşiği ve sahte alarmlar

Her testin yanlış alarm oranı vardır .`alpha`Bu yüzden, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir süre sonra, bir sürece, bir sürece, bir sürece, bir sürece, bir sürececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececececece`alpha = 0.05`İnsanlar uyarıları daha çok önce okumayı bırakırlar.

Alarm oranını kullanışlı kılan dört kural:

1. **Correct for multiple tests.**Bonferroni düzeltmesi bölünür.`alpha`Demo bir aileyi kullanıyor.`alpha`İki test üzerinde 0,01'in, bu nedenle her testde 0,005 kullanılır.
2. **Require an effect size.**Sadece PSI'de uyarı`D`, ya da Cramér'in V'si de bir eşiği geçiyor.
3. **Require persistence.**Sadece uyarı sonrası `k`Demos kullanıyor.`k = 2`- Evet .
4. **Separate warnings from alerts.**Bir uyarı bir taklaya, bir uyarı bir kişiye gidiyor.

Demo, 2. kuralın çalışmasını gösteriyor. Bir temiz pencerenin chi-square p değeri 0.0009'dur.`alpha`Cramér'in V oranı 0.1'den aşağı, bu yüzden polis bir uyarı kaydeder, uyarı değil.

### Yeniden eğitimin tetikleyicileri

Yeniden eğitim için üç ortak tetikleyici vardır:

- **Schedule.**Bu basit ama hiçbir şey değişmediğinde yeniden antrenman yapar ve bir şey olduğunda bekler.
- **Drift.**Önemli özellikler üzerinde giriş süresi eşiğin üzerinde kaldığında geri dönüş.
- **Performance.**Bir sonuç metrikinin referans değeri eksik bir toleransın altında düştüğünde yeniden eğitil.

Bu tür bir sürükleme yeniden eğitimin ne yapabileceğini belirler:

| Drift | Useful action |
|---|---|
| Covariate drift, accuracy stable | Often none. Keep watching the outcome metric. |
| Covariate drift into regions with little data | Retrain on recent data that includes those regions |
| Prior drift | Recalibrate the scores or move the decision threshold |
| Concept drift | Collect new labels first. Retraining on old labels teaches the old concept again. |

Yeniden eğitildikten sonra, yeni modeli en son etiketlenmiş verilere test edin. Sistem tasarımı dersi'nden gölge ve kanarya aşamalarıyla birlikte oynatın. Sonra referans penceresini yeni eğitim verilerine yeniden ayarlayın.

```figure
mlprod-drift-psi
```

## Yapın

Kodun içinde .`code/main.py`Sadece standart kütüphaneden kullanıyor.

### Adım 1: Kvantil kutular ve PSI

Çöp kenarları referans desillerdir.`bisect_right`Her değerin çöplüğünü bulur.

```python
def quantile_edges(reference: list[float], bins: int = 10) -> list[float]:
    ordered = sorted(reference)
    n = len(ordered)
    edges = [ordered[min(n - 1, (n * i) // bins)] for i in range(1, bins)]
    return sorted(set(edges))


def psi_from_fractions(expected: list[float], actual: list[float], eps: float = 1e-4) -> float:
    total = 0.0
    for e, a in zip(expected, actual):
        e, a = max(e, eps), max(a, eps)
        total += (a - e) * math.log(a / e)
    return total
```

### Adım 2: KS istatistikleri ve p değeri

Her iki örneği birlikte yürütün. Her farklı değerde, her iki örneğin her kopyasını geçin, sonra iki toplam payı karşılaştırın. Bu, bağları doğru şekilde ele alır.

```python
def ks_statistic(sample_a: list[float], sample_b: list[float]) -> float:
    a, b = sorted(sample_a), sorted(sample_b)
    n, m = len(a), len(b)
    i = j = 0
    d = 0.0
    while i < n and j < m:
        x = min(a[i], b[j])
        while i < n and a[i] <= x:
            i += 1
        while j < m and b[j] <= x:
            j += 1
        d = max(d, abs(i / n - j / m))
    return d
```

P değeri Kolmogorov dağılımında serileri kullanır.`2 * sum((-1)^(k-1) * exp(-2 k^2 lambda^2))`, ile`lambda = sqrt(n * m / (n + m)) * D`- Evet .

### Adım 3: Chi-square testi

`chi2_sf`Çiktirilmiş üst eksik gamma fonksiyonu ile chi-square hayatta kalma fonksiyonunu hesaplar. Küçük argümanlar için bir dizi ve büyükler için devamlı bir kırık kullanır. `chi_square_test`iki sıralı tablo oluşturur, istatistikleri hesaplar ve p değerini ve Cramér'in V'sini gönderir.

```python
def chi_square_test(reference_counts: dict[str, int], current_counts: dict[str, int]) -> ChiSquareResult:
    categories = [c for c in sorted(set(reference_counts) | set(current_counts))
                  if reference_counts.get(c, 0) + current_counts.get(c, 0) > 0]
    rows = [[reference_counts.get(c, 0) for c in categories], [current_counts.get(c, 0) for c in categories]]
    row_totals = [sum(r) for r in rows]
    grand = sum(row_totals)
    if len(categories) < 2 or 0 in row_totals:
        return ChiSquareResult(0.0, 0, 1.0, 0.0)
    statistic = 0.0
    for col, _ in enumerate(categories):
        col_total = rows[0][col] + rows[1][col]
        for r in range(2):
            expected = row_totals[r] * col_total / grand
            statistic += (rows[r][col] - expected) ** 2 / expected
    dof = len(categories) - 1
    return ChiSquareResult(statistic, dof, chi2_sf(statistic, dof), math.sqrt(statistic / grand))
```

### Adım 4: Pencere ve sürükleme monitörü

`SlidingWindow`Sonuncusu tutar.`size`bir olayda`deque`- Evet .`DriftMonitor`Referans kutularını hesaplar ve bir kez sayar.`check`Metot PSI'yi gönderir.`D`, ve her sayısal özelliğin KS p değeri ve her kategorik özelliğin chi-square sonucu.

### Adım 5: Alarm politikası

Politika, her metrik ayarını bir seviyeye dönüştürür ve sinyal başına ardıcıl sürükleme pencerelerini sayır:

```python
def level(self, metrics: dict[str, float]) -> str:
    if "psi" in metrics:
        if metrics["psi"] >= self.psi_drift or (metrics["ks"] >= self.ks_drift and metrics["ks_p"] < self.alpha):
            return "drift"
        return "warn" if metrics["psi"] >= self.psi_warn else "ok"
    if metrics["p"] < self.alpha and metrics["v"] >= self.min_cramers_v:
        return "drift"
    return "warn" if metrics["p"] < self.alpha else "ok"
```

`update`Devamı`ALERT`Çizgiyi tamamlayan pencerede ve`resolved`Alarmdan sonra ilk temiz pencerede.

### Adım 6: Enjeksiyonu olan akıntı

Akışta 9000 ödeme olayı var .`amount`, a `channel`, ve bir dolandırıcılık .`label`Dört bölümden oluşuyor:

| Events | Amount | Channel mix (app, store, web) | Label boundary | Change |
|---|---|---|---|---|
| 0 to 2999 | mean 100, sd 20 | 35, 15, 50 percent | 120 | Reference period |
| 3000 to 4999 | mean 118, sd 24 | 60, 10, 30 percent | 120 | Covariate drift |
| 5000 to 6499 | mean 100, sd 20 | 35, 15, 50 percent | 120 | Back to normal |
| 6500 to 8999 | mean 100, sd 20 | 35, 15, 50 percent | 105 | Concept drift |

Modeldeki bir eşiğin `amount`Windows 500 etkinliği düzenler ve 250'e kadar hareket eder.

```bash
python3 code/main.py
npx tsx code/main.ts
```

```console
  end    PSI   KS D   chi2 p    acc  levels (amount/channel/accuracy)  events
 3000  0.010  0.041  3.0e-01  0.932  ok/ok/ok
 3250  0.152  0.163  7.6e-06  0.924  drift/warn/ok
 3500  0.463  0.298  2.8e-26  0.936  drift/drift/ok                     ALERT amount
 3750  0.609  0.343  3.5e-35  0.942  drift/drift/ok                     ALERT channel
 ...
 5500  0.026  0.044  2.6e-01  0.898  ok/ok/ok                           resolved amount, resolved channel
 ...
 7250  0.040  0.048  7.1e-01  0.848  ok/ok/drift
 7500  0.022  0.039  6.1e-01  0.778  ok/ok/drift                        ALERT accuracy
```

Sonuçları üç bölümde okuyun:

- **Covariate drift.**Drift 3000'de başlar ve `amount`Alarm 3500'e kadar devam eder.
- **Recovery.**Girişler 5000'de normal hale döner ve her iki uyarı da 5500'de çözülür.
- **Concept drift.**Drift 6500'de başlar ve giriş monitörleri sessiz kalır çünkü girişler değişmez. Düzgünlük 0.946'dan 0.76 ile 0.79 arasında düşer. Düzgünlik uyarısı 7500'de gelir, değişimden sonra 1000 olay ve etiket gecikmesi 500'ü oluşturur.

## Kullan

**scipy.** `scipy.stats`Bu ders için bir ders programı gerekmez.

```python
from scipy import stats

result = stats.ks_2samp(reference_amounts, current_amounts)
print(result.statistic, result.pvalue)

table = [[1000, 700, 300], [140, 290, 70]]
chi2 = stats.chi2_contingency(table)
print(chi2.statistic, chi2.pvalue, chi2.dof)
```

Kontrol ettik .`ks_statistic`ve `chi_square_test`KS istatistik, chi-skvadar istatistik ve chi-skvadar p değeri yüzen nokta doğruluğuna eşleşmiştir. 200'den fazla rastgele örnek çiftinden fazla, KS p değerleri scipy'nin değerinin yüzde 18'ine kadar farklıdır. En büyük boşluklar çok küçük p değerlerindeydi.

Bu boşluk yöntemden kaynaklanıyor. kodumuz Kolmogorov sınırlı dağılımını kullanıyor.`ks_2samp`Bu yöntem, her iki örnekten en fazla 10.000 değer olduğu zaman tam bir yöntem kullanır. Asimptotik modunda, yuvarlak etkili örnek boyutu ile sınırlı örnek dağılımını kullanır.`chi2_contingency`Yates'in süreklilik düzeltmesini varsayılan olarak uyguluyor, bu yüzden istatistikler farklıdır.

**Monitoring libraries.**Birçok açık kaynaklı kütüphanede bu testler raporlar ve araç tablosu ile paketlenir:

- **Evidently**1000 satır veya daha az bir referans için, sayısal sütunlar için KS testi ve kategorik sütunlar için chi kare testi kullanır. Daha büyük veriler için, Wasserstein mesafesini ve 0,1 eşiği olan Jensen-Shannon farklılığını kullanır. PSI seçilebilecek diğer yöntemlerden biridir.
- **NannyML**Etiketlerin gelmesinden önce model performansını tahmin eder. Güvenli Baslı Performance Estimation (CBPE) modelin tahmin edilmiş olasılıklarını kullanır, bu da iyi kalibrelenmelidir. NannyML belgesinde CBPE'nin değişkenlik kaydırmasını hallediğini ancak konsept sürüklenmesiyle başa çıkmadığını belirtiyor. Demo akışı nedenini gösterir: sadece etiketler konsept sürüklenmesini ortaya koydu.
- **TensorFlow Data Validation**Kategoriyel özellikler için L- sonsuzluk mesafesini ve sayısal özellikler için yaklaşık Jensen-Shannon farklılığını kullanır.

Bu araçların her birinin hesapladığını gösteren sıfırdan kod, depolama, programlama, araç tablosu ve daha birçok testi ekler.

LLM başvuruları için,[LLM observability lesson](../../../17-infrastructure-and-production/13-llm-observability/docs/en.md)Bu dersdeki fikirler hala bu sistemlerin giriş ve çıkışlarına uygulanmaktadır.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-drift-monitoring.md`. Yetenek, monitörleri yeni bir model için planlıyor ve drift uyarısını seçiyor. Hangi katman ateşlendiğini, hangi tür bir drift'in kanıtlara uygun olduğunu ve doğru eylemin beklemek, yeniden kalibrlemek, etiket toplamak veya yeniden eğitmek olup olmadığını sorar.

## Egzersizler

1. 200 ve 2000 olayları ile akışını çalıştırın.
2. Yapıştır `n_tests=1`- Evet .`patience=1`ve`min_cramers_v=0`Temizlik döneminde uyarıları 5000 ile 6500 arasında sayın.
3. Ortalama 100 olay başına 0.01 oranında büyüyen bir özelliği ekleyin. Hangi sinyal, PSI veya KS, önce tepki gösterdiğini bulun.
4. Jensen-Shannon mesafesini aynı çöp çöplerinde uygulayın ve her pencerede PSI ile karşılaştırın.
5. Modelin olumlu tahmin oranını gösteren bir monitör ekleyin.

## Anahtar Terimler

| Term | What people say | What it means |
|------|----------------|----------------------|
| Data drift | "The data changed" | A change in the distribution of inputs, predictions, or labels compared with a reference window |
| Covariate drift | "New kinds of users" | `P(x)` changes while `P(y \| x)` stays the same |
| Prior drift | "More positives than before" | `P(y)` changes while `P(x \| y)` stays the same, also called label shift |
| Concept drift | "The rules of the game changed" | `P(y \| x)` changes, so the same input now has a different correct answer |
| Reference window | "The baseline data" | A fixed sample, often the training data, that every current window is compared with |
| PSI | "The stability score" | A symmetric sum over bins of (current share minus reference share) times the log of their ratio |
| KS statistic | "The KS test" | The largest gap between two empirical cumulative distribution functions |
| Cramér's V | "Effect size for categories" | The chi-square statistic scaled to the range 0 to 1 |
| Label delay | "Ground truth comes later" | The time between a prediction and the arrival of its true outcome |
| Alert fatigue | "Too many pages" | People ignore alerts because most of them were false alarms |

## Daha Fazla Okumak

- [Gama et al., A Survey on Concept Drift Adaptation (ACM Computing Surveys, 2014)](https://research.tue.nl/en/publications/a-survey-on-concept-drift-adaptation): gerçek ve sanal sürükleme, sürükleme kalıpları ve uyum yöntemleri
- [Rabanser, Günnemann, and Lipton, Failing Loudly: An Empirical Study of Methods for Detecting Dataset Shift (NeurIPS 2019)](https://arxiv.org/abs/1810.11953): Değişiklik tespit için iki örnek testleri
- [Lu et al., Learning under Concept Drift: A Review (2020)](https://arxiv.org/abs/2004.05785): sürükleme algılama, anlama ve uyum yöntemleri
- [Yurdakul, Statistical Properties of Population Stability Index (Western Michigan University, 2018)](https://scholarworks.wmich.edu/dissertations/3208/): PSI'nin örnek boyutu ve kutu sayısına ilişkin davranış tarzı
- [scipy.stats.ks_2samp documentation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.ks_2samp.html): iki örnekli KS testi için kesin ve asimptotik p değerli yöntemler
- [Evidently, How data drift detection works](https://docs.evidentlyai.com/metrics/explainer_drift): sütun tipi ve veri boyutu ile standart test seçimi
- [NannyML, Performance estimation](https://nannyml.readthedocs.io/en/stable/how_it_works/performance_estimation.html): CBPE ve varsayımları
