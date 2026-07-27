# HTN ve Evrimsel Arama ile Planlama

> Sembolik planlama, planın kanıtlanabilir şekilde doğru olduğu durumları ele alır. Evrimsel kod araması, uygunluk fonksiyonunun makine tarafından kontrol edilebildiği durumları ele alır. ChatHTN (2025) ve AlphaEvolve (2025), bir Yüksek Lisans ile eşleştirildiğinde her birinin kilidinin açıldığını gösterir.

**Tür:** Yapım
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 14 · 02 (ReWOO ve Planla ve Yürüt)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- Hiyerarşik Görev Ağlarını açıklayın: görevler, yöntemler, operatörler, ön koşullar, etkiler.
- ChatHTN'nin hibrit döngüsünü açıklayın — LLM geri dönüş ayrıştırmasıyla sembolik arama.
- AlphaEvolve'un evrimsel döngüsünü ve neden yalnızca programlı bir değerlendiriciyle çalıştığını açıklayın.
- Bir oyuncak HTN planlayıcısının yanı sıra stdlib'de bir oyuncak evrimsel araması uygulayın.

## Sorun

ReWOO (Ders 02), Planla ve Yürüt ve ReAct çoğu agent planlamayı kapsar. İyi ele almadıkları iki vaka:

1. **Doğruluğu kanıtlanabilir planlar.** Programlama, uçuş rotası, uyumluluk iş akışları — planın yapısı gereği sağlam olması gerekir. Bazen bir adımı halüsinasyona uğratan akıcı bir Yüksek Lisans planı kabul edilemez.
2. **Makine tarafından kontrol edilebilen uygunluk işleviyle optimizasyonlar.** Matris çarpımı, zamanlama buluşsal yöntemleri, derleyici geçişleri — amaç "doğru bir plan" değil "en iyi plan"dır.

HTN planlama ve AlphaEvolve iki farklı sorunu çözüyor. Her ikisi de Yüksek Lisans'ı yedek parça olarak değil, yükseltici olarak kullanıyor.

## Konsept

### Hiyerarşik Görev Ağları

Bir HTN:

- **Görevler** — bileşik (ayrıştırılacak) ve ilkel (doğrudan yürütülebilir).
- **Yöntemler** — bileşik bir görevi önkoşullarla birlikte alt görevlere ayırmanın yolları.
- **Operatörler** — önkoşulları ve etkileri olan ilkel eylemler.
- **Devlet** — bir dizi gerçek.

Planlama: Bir hedef görev ve bir başlangıç ​​durumu verildiğinde, önkoşulları sırayla karşılanan ilkel operatörlere ayrıştırma bulun.

HTN, LLM'lerden daha eskidir ve hala doğru olduğu kanıtlanabilen planlar için referanstır.

### ChatHTN (Gopalakrishnan ve diğerleri, 2025)

ChatHTN (arXiv:2505.11814), sembolik HTN'yi LLM sorgularıyla birleştirir:

1. Mevcut bileşik görevi mevcut yöntemlerle ayrıştırmaya çalışın.
2. Hiçbir yöntem geçerli değilse Yüksek Lisans'a şunu sorun: "`task`'yi `s` durumunda nasıl ayrıştırırsınız?"
3. Yüksek Lisans yanıtını aday alt görevlere çevirin.
4. Operatör şemasına göre doğrulama yapın; geçersiz ayrıştırmaları reddedin.
5. Yineleme.

Makalenin temel iddiası: Üretilen her planın kanıtlanabilir bir şekilde sağlam olduğu, çünkü LLM önerilerinin doğrudan plan düzenlemeleri olarak değil, yalnızca aday ayrıştırmaları olarak girildiği. Sembolik katman doğruluğun sahibidir; Yüksek Lisans, yöntem kütüphanesini genişletir.

Çevrimiçi yöntem öğrenimi (OpenReview `gwYEDY9j2x`, 2025 takibi), LLM tarafından üretilen ayrıştırmaları regresyon yoluyla genelleştiren bir öğrenci ekler ve LLM sorgu sıklığını %75'e kadar azaltır.

### AlphaEvolve (Novikov ve diğerleri, 2025)

AlphaEvolve (arXiv:2506.13131, DeepMind, Haziran 2025) farklı bir canavardır: Gemini 2.0 Flash/Pro topluluğu tarafından yönetilen evrimsel kod araması.

Döngü:

1. Bir başlangıç ​​programı + programatik bir değerlendiriciyle başlayın (bir uygunluk puanı döndürür).
2. Yüksek Lisans Topluluğu mutasyonlar önermektedir.
3. Mutasyonları değerlendirici aracılığıyla çalıştırın.
4. En iyisini koruyun; tekrar mutasyona uğrar.

Yayınlanan kazançlar:

- 56 yıl içinde 4x4 karmaşık matris çarpımı için Strassen'e göre ilk gelişme (48 skaler çarpım).
- %0,7'si Google hesaplamasını Borg planlama buluşsal yöntemiyle kurtardı.
- Sınır iş yükünde %32 FlashAttention hızlandırması.

Zor kısıtlama: uygunluk fonksiyonu makine tarafından kontrol edilebilir olmalıdır. Düzyazı cevapları üzerindeki evrimsel araştırma birbirine yakınlaşmaz.

### Hangisi ne zaman kullanılmalı

| Sorun sınıfı | Kullan | Neden |
|---------------|-----|-----|
| Katı kısıtlamalarla planlama | HTN + SohbetHTN | Kanıtlanabilir sağlamlık |
| Derleyici optimizasyonu | AlphaEvolve | Makine tarafından kontrol edilebilir uygunluk |
| Çok adımlı görev yürütme | ReAct / ReWOO | Yüksek Lisans döngüde, resmi garanti yok |
| Testlerle kod iyileştirme | AlphaEvolve | Testlerin değerlendiricisi |
| Politikaya bağlı otomasyon | HTN | Önkoşullar kodlama politikası |

### Bu modelin yanlış gittiği yer

- **Operatörsüz HTN.** Önkoşul/etki şemaları olmadan sağlamlık iddiası çöker. ChatHTN'nin "LLM ayrıştırmayı öneriyor" özelliği, şemanın geçersiz hamleleri reddetmesini gerektirir.
- **Gerçek bir değerlendirici olmadan AlphaEvolve.** "Kodun daha iyi olup olmadığını Yüksek Lisans'a sorun" bir uygunluk fonksiyonu değildir. Değerlendiricinin deterministik ve hızlı olması gerekir.
- **Aşırı mühendislik.** Çoğu agent görevinin de buna ihtiyacı yoktur. Önce ReAct veya ReWOO'ya ulaşın.

## İnşa Et

`code/main.py` iki oyuncak uyguluyor:

- Operatörler, yöntemler, ön koşullar, efektler ve bileşik bir görevle hiçbir yöntem eşleşmediğinde devreye giren bir `LLMFallback` içeren bir stdlib HTN planlayıcı. "LLM" komut dosyası içeren bir ayrıştırıcıdır, dolayısıyla planlayıcı çevrimdışı çalışır.
- Aritmetik programlar üzerinde stdlib evrimsel arama: bir test kümesinde çıktısı `|f(x) - target|` değerini en aza indiren ifadeleri büyütün. Değerlendirici deterministtir.

Çalıştır:

```
python3 code/main.py
```

İz, HTN planlayıcısının bileşik bir görevi (orta plan LLM geri dönüşüyle) ayrıştırdığını ve evrimsel döngünün bir hedef ifadeye yaklaştığını gösteriyor.

## Kullan onu

- **HTN planlayıcıları** — `pyhop`, `SHOP3` veya alana özel politika uygulaması için kendinizinkini oluşturun.
- **ChatHTN** — araştırma kodu; desen (sembolik + LLM geri dönüşü) herhangi bir HTN planlayıcıya temiz bir şekilde bağlanır.
- **AlphaEvolve** — DeepMind makalesi; model (topluluk + değerlendirici) tekrarlanabilir. OpenEvolve ve benzeri açık kaynak çatallar ortaya çıkıyor.
- **Agent frameworks** — hiçbiri birinci sınıf HTN veya AlphaEvolve'u henüz sunmuyor. Bunu bir altagent veya arka plan çalışanı olarak oluşturun.

## Gönderin

`outputs/skill-hybrid-planner.md`, LLM rolünün kapsamı açıkça belirlenmiş bir hibrit planlayıcı iskelesi (HTN veya evrimsel) oluşturur.

## Egzersizler

1. HTN planlayıcıyı geri izlemeyle genişletin: Bir operatörün sonkoşulu çalışma zamanında başarısız olduğunda geri dönün ve sonraki yöntemi deneyin.
2. ChatHTN'ye bir LLM yöntemi önbelleği ekleyin: LLM, `T` görevini `P` durum modelinde ayrıştırdığında, sonucu saklayın. Bir sonraki çağrıda ilk olarak yöntem kitaplığını yeniden kontrol edin.
3. Evrimsel arama değerlendiricisini gerçek bir test paketiyle değiştirin. 20 test senaryosunu geçen bir sıralama işlevi geliştirin; nesilleri yakınlaşmaya rapor edin.
4. AlphaEvolve'un değerlendirici tasarım notlarını okuyun. Önemsediğiniz bir alan adı için bir değerlendirici tasarlayın (SQL sorgu optimizasyonu, test paketi minimizasyonu, deployment YAML).
5. Birleştir: Bir bileşik görevi alt görevlere ayırmak için HTN'yi kullanın, ardından her alt görevin ilkel operatöründe evrimsel aramayı kullanın. Nerede parlıyor, nerede aşırı mühendislik yapıyor?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| HTN | "Hiyerarşik planlayıcı" | Operatörler, önkoşullar ve efektlerle görev ayrıştırma |
| Yöntem | "Ayrıştırma kuralı" | Bileşik bir görevi alt görevlere ayırmanın yolu |
| Operatör | "İlkel eylem" | Ön koşulu ve etkisi olan somut adım |
| SohbetHTN | "LLM + HTN" | Sembolik planlayıcı hiçbir yöntem eşleşmediğinde LLM'ye sorar |
| AlphaEvolve | "Evrimsel kod arama" | Topluluk Yüksek Lisansı'nın kodu değişir; deterministik değerlendirici seçer |
| Fitness fonksiyonu | "Değerlendirici" | Çıktılara göre deterministik, makine tarafından kontrol edilebilir puan |
| Çevrimiçi yöntem öğrenimi | "Önbelleğe alınmış LLM ayrıştırması" | Mağaza + genelleştirme Yüksek Lisans, sorgu maliyetini düşürmeyi planlıyor |

## Daha Fazla Okuma

- [Gopalakrishnan ve diğerleri, ChatHTN (arXiv:2505.11814)](https://arxiv.org/abs/2505.11814) — sembolik + LLM hibrit planlayıcı
- [Novikov ve diğerleri, AlphaEvolve (arXiv:2506.13131)](https://arxiv.org/abs/2506.13131) — LLM mutasyonlarıyla evrimsel kod araması
- [Antropik, Etkili Bina Oluşturma Agents](https://www.anthropic.com/research/building-effective-agents) — basit bir döngüye karşı bir planlayıcıya ne zaman ulaşılmalı
