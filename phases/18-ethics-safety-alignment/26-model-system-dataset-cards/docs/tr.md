# Model, Sistem ve Dataset Kart

> Üç belge formatı yapay zeka şeffaflığını yapılandırır. Model Kartları (Mitchell ve diğerleri 2019) — modeller için beslenme etiketleri: eğitim verileri, niceliksel olarak ayrıştırılmış analizler, etik hususlar, uyarılar; Hugging Face model kartlarının yalnızca %0,3'ü etik hususları belgelemektedir (Oreamuno ve ark. 2023). Dataset'lar için veri sayfaları (Gebru ve diğerleri 2018, CACM) — motivasyon, kompozisyon, toplama süreci, etiketleme, dağıtım, bakım; elektronik-veri sayfası benzetmesi. Veri Kartları (Pushkarna ve diğerleri, Google 2022) — farklı okuyucular için sınır nesneleri olarak modüler katmanlı ayrıntı (teleskopik, periskopik, mikroskobik). 2024-2025 gelişmeleri: LLM'ler aracılığıyla otomatik üretim (CardGen, Liu ve diğerleri 2024); model kartı ayrıntısı, HF'de %29'a varan indirme artışıyla ilişkilidir (Liang ve ark. 2024); doğrulanabilir kanıtlar (Laminator, Duddu ve diğerleri 2024); karbon/su için sürdürülebilirlik raporu eklemeleri (Jouneaux ve diğerleri Temmuz 2025); AB/ISO düzenleme kartları ortaya çıkıyor. Sistem Kartları (Sidhpurwala 2024; Meta sistem düzeyinde şeffaflık; "Güven Planları" arXiv:2509.20394) — güvenlik özelliklerini, prompt-enjeksiyon korumasını, veri sızma tespitini, insani değerlerle uyumu kapsayan uçtan uca yapay zeka sistem belgeleri.

**Tür:** Yapım
**Diller:** Python (stdlib, model kartı + veri sayfası + sistem kartı oluşturucu)
**Önkoşullar:** Aşama 18 · 18 (güvenlik framework'ler), Aşama 18 · 24 (düzenleyici)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Orijinal Mitchell ve ark.'nı tanımlayın. 2019 model kart ve Gebru vd. 2018 veri sayfası.
- Veri Kartlarının teleskopik/periskopik/mikroskobik katmanlamasını açıklayın.
- Sistem Kartlarını ve bunların uçtan uca kapsamını açıklayın.
- 2024-2025'e ilişkin üç gelişmeyi belirtin (otomatik üretim, doğrulanabilir tasdikler, sürdürülebilirlik raporlaması).

## Sorun

Düzenleyici framework'ler (Ders 24) ve laboratuvar güvenliği politikalarının (Ders 18) her ikisi de belgelendirme gerektirir. Dokümantasyon formatları, modele özel (model kartları), dataset'ye özel (veri sayfaları), oradan da sisteme özel (sistem kartları) şekilde gelişti. Her biri farklı bir şeffaflık kapsamına hitap ediyor. 2024-2025 otomasyonu ve doğrulanabilir tasdik çalışması, uzun süredir devam eden benimseme sorununu ele alıyor.

## Konsept

### Model Kartlar (Mitchell ve diğerleri 2019)

Bölümler:
- Model ayrıntıları.
- Kullanım amacı.
- Faktörler (değerlendirme için ilgili demografik veya çevresel faktörler).
- Metrikler.
- Değerlendirme verileri.
- Eğitim verileri.
- Kantitatif analizler (faktörlere göre ayrıştırılmış).
- Etik hususlar.
- Uyarılar ve öneriler.

Evlat edinme sorunu: Oreamuno ve ark. Hugging Face model kartların 2023 denetiminde yalnızca %0,3'ünün etik hususları belgelediği bulundu.

### Dataset'lar için veri sayfaları (Gebru ve diğerleri 2018)

Elektronik-veri sayfası benzetmesi. Bölümler:
- Motivasyon (neden dataset oluşturuldu).
- Kompozisyon (içinde ne var).
- Toplama süreci (nasıl bir araya getirildi).
- Etiketleme (varsa).
- Kullanımlar (amaçlanan, yasaklanan, riskler).
- Dağıtım.
- Bakım.

CACM 2021'de yayınlandı. Veri sayfası yukarı yöndeki belgelerdir; model kartı veri sayfasının doğru olmasına bağlıdır.

### Veri Kartları (Pushkarna ve diğerleri, Google 2022)

Modüler katmanlı detay. Üç yakınlaştırma düzeyi:
- **Teleskopik.** Uzman olmayanlar için üst düzey özet.
- **Periskopik.** Makine öğrenimi uygulayıcıları için orta düzeyde genel bakış.
- **Mikroskobik.** Denetleyiciler için ayrıntılı özellik düzeyinde belgeler.

Sınır-nesne çerçeveleme: farklı okuyucular aynı belgeden farklı bilgiler çıkarır.

### Sistem Kartları

Kapsam: Model + güvenlik yığını + deployment bağlamını içeren uçtan uca yapay zeka sistemi. Bölümler genellikle şunları içerir:
- Güvenlik yetenekleri.
- Prompt-enjeksiyon koruması.
- Veri sızıntısı tespiti.
- Belirtilen insani değerlere uyum.
- Olaya müdahale.

Sidhpurwala 2024 ve Meta sistem düzeyinde şeffaflık çalışması. "Güven Planları" (arXiv:2509.20394), Sistem Kartını Model Kartların deployment-katman tamamlayıcısı olarak resmileştirir.

### 2024-2025 gelişmeleri

- **CardGen (Liu ve diğerleri 2024).** LLM'ler yoluyla otomatik model kart üretimi; standartlaştırılmış Mitchell 2019 alanlarında insan tarafından yazılan birçok karttan daha yüksek objektiflik rapor ediyor.
- **İndirme korelasyonu (Liang ve ark. 2024).** Ayrıntılı model kartları, HF'de %29'a kadar daha yüksek indirme oranlarıyla ilişkilidir — benimseme baskısı artık yalnızca uyumluluk odaklı değil, pazar odaklıdır.
- **Laminatör (Duddu ve ark. 2024).** Donanım TEE / kriptografik imzalar aracılığıyla doğrulanabilir tasdikler — model kartının yalnızca bir iddia değil, bir iddia kanıtı taşımasına olanak tanır.
- **Sürdürülebilirlik (Jouneaux ve diğerleri Temmuz 2025).** Karbon, su ve bilgi işlem enerjisi ayak izine yönelik eklemeler; ortaya çıkan ISO standartları.
- **Düzenleyici kartlar.** AB AI Yasası (Ders 24) GPAI Uygulama Kuralları Şeffaflık bölümü, uyumluluk olarak model kartları gerektirir artifact.

### Bunun 18. Aşamada yeri nedir

24-25. dersler düzenleyici ve CVE katmanlarıdır. Ders 26 dokümantasyon katmanıdır. Ders 27, veri sayfasının yukarı akışı olan eğitim-veri yönetimidir. Ders 28, kartlarda atıfta bulunulan değerlendirmeleri üreten araştırma ekosistemidir.

## Use It — Hazır Araçla Uygula

`code/main.py` , bir deployment oyuncağı için minimum model kartı, veri sayfası ve sistem kartını oluşturur. Her biri kanonik bölüm yapısını takip eder. Formatı inceleyebilir ve üç kapsamı karşılaştırabilirsiniz.

## Ship It — Kullanıma Sun

Bu ders `outputs/skill-card-audit.md` üretir. Bir model kartı, veri sayfası veya sistem kartı verildiğinde bölüm kapsamını, sayısal ayrıştırmayı ve doğrulanabilir kanıtların mevcut olup olmadığını denetler.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Oluşturulan kartları inceleyin. Zayıf olan bölümleri belirleyin (yalnızca yer tutucu) ve bunları hangi kanıtların güçlendireceğini belirtin.

2. Model kartını niceliksel olarak ayrıştırılmış bir analizle iki demografik gruba genişletin (Ders 20).

3. Oreamuno ve ark.'nı okuyun. 2023'te %0,3 benimseme oranı. Model kartı spesifikasyonunda, etik hususların benimsenmesini artıracak bir yapısal değişiklik önerin.

4. Laminatör (Duddu ve ark. 2024) doğrulanabilir tasdikler için TEE'leri kullanır. Bir değerlendirme sonucunun kriptografik kanıtını taşıyan ve doğrulayıcının rolünü açıklayan bir model kart alanı tasarlayın.

5. Geçmiş projelerinizden biri veya varsayımsal bir deployment için bir Sistem Kartı (Sistem Kartı, Model Kartı değil) yazın. Üçüncü taraf denetçiler için en yüksek değere sahip bölümü belirleyin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| Modeli Kartı | "Mitchell kartı" | Mitchell ve ark. ML modelleri için 2019 standart belgeleri |
| Veri Sayfası | "Gebru veri sayfası" | Gebru ve ark. dataset'ler için 2018 standart belgeleri |
| Veri Kartı | "Pushkarna kartı" | Google 2022 modüler katmanlı veri belgeleri |
| Sistem Kartı | "deployment kartı" | Güvenlik yığınını da içeren uçtan uca yapay zeka sistemi belgeleri |
| Sınır nesnesi | "farklı okuyucular, tek belge" | Veri Kartları çerçevesi: aynı belge farklı hedef kitlelere hizmet ediyor |
| Doğrulanabilir tasdik | "Laminatör onayı" | Belge talebine eklenen kriptografik veya TEE kanıtı |
| Sürdürülebilirlik alanı | "karbon/su ayak izi" | Çevre muhasebesine yönelik 2025'te öne çıkan eklemeler |

## Daha Fazla Okuma

- [Mitchell ve ark. — Model Raporlama için Model Kartları (arXiv:1810.03993, FAT* 2019)](https://arxiv.org/abs/1810.03993) — kanonik model kartı
- [Gebru ve ark. — Dataset'ler için veri sayfaları (CACM 2021, arXiv:1803.09010)](https://arxiv.org/abs/1803.09010) — veri sayfası kağıdı
- [Pushkarna ve ark. — Veri Kartları (Google 2022)](https://arxiv.org/abs/2204.01075) — katmanlı veri dokümantasyonu
- [Sidhpurwala ve ark. — Güven Planları (arXiv:2509.20394)](https://arxiv.org/abs/2509.20394) — Sistem Kartı resmileştirmesi
