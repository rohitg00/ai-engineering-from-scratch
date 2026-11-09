# Model, Sistem ve Veri Dizini Kartları

> Üç belge biçimi, Yapay zeka şeffaflığını yapılandırır. Model Kartlar (Mitchell et al. 2019'da,  modeller için beslenme etiketleri: eğitim verileri, miktarlı ayrıştırılmış analizler, etik düşünceler, uyarılar; Hugging Face model kartlarının sadece %0,3'ü etik düşünceler belgelendirir (Oreamuno et al. 2023 yılı). Verim Satıları Verim Sayfaları (Gebru et al. 2018 (CACM)  Motivasyon, kompozisyon, toplama süreci, etiketleme, dağıtım, bakım; elektronik- veri levha analogiyası. Veri Kartları (Pushkarna et al., Google 2022)  Modüler katmanlı detaylar (teleskopik, periskopik, mikroskopik) çeşitli okuyucular için sınır nesneleri olarak. 2024-2025 gelişmeleri: LLM'ler aracılığıyla otomatik üretim (CardGen, Liu et al. Bu nedenle, HF'nin yüklenmesi %29'a kadar artmıştır. 2024); doğrulanabilir sertifikalar (Laminator, Duddu et al. 2024); karbon/su için sürdürülebilirlik raporlama eklemeleri (Jouneaux et al. Temmuz 2025); Avrupa Birliği/ISO düzenleyici kartları ortaya çıkıyor. Sistem Kartları (Sidhpurwala 2024; Meta sistem düzeyinde şeffaflık; "Tevkiye dair Blueprints" arXiv:2509.20394)  Güvenlik yeteneklerini, hızlı enjeksiyon korumasını, veri filtrasyonunun tespitini, insan değerleriyle uyumluyu kapsayan sonundan sonuna kadar AI sistem belgeleri.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, model-card + datasheet + system-card generator)
**Prerequisites:** Phase 18 · 18 (safety frameworks), Phase 18 · 24 (regulatory)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- Mitchell et al. 2019 model kartını ve Gebru et al. 2018 veri sayfasını açıklayın.
- Veri Kartlarının teleskopik/periskopik/mikroskopik katmanını açıklayın.
- Sistem Kartlarını ve sonundan sonuna kadar kapsamını açıklayın.
- 2024-2025 yıllarındaki üç gelişmeyi belirtin (otomatik üretim, doğrulanabilir sertifikalar, sürdürülebilirlik raporlamaları).

## Sorun

Yönetim çerçeveleri (Desin 24) ve laboratuvar güvenliği politikaları (Desin 18) her ikisi de belgelendirme gerektirir. Belge biçimleri model-spesifik (model kartları) ile veri kümesi-spesifik ( veri levhaları) ile sistem-spesifik (sistem kartları) arasında gelişmiştir. Her biri farklı bir şeffaflık kapsamını ele alıyor. 2024-2025 otomasyon ve doğrulanabilir-sertifika çalışmaları uzun süredir devam eden kabul sorunu ele alıyor.

## Anlaşım

### Model Kartlar (Mitchell et al. 2019)

Bölümler:
- Model detayları.
- İstihbarat.
- Değerlendirme için önemli demografik veya çevresel faktörler.
- - Metrikler.
- Değerlendirme verileri.
- Eğitim verileri.
- Kvantitatif analizler (faktorlara göre ayrıştırılmış).
- Etik bakış açıları.
- Kafateler ve tavsiyeler.

Evlatlık sorunu: Oreamuno et al. Hugging Face model kartlarının 2023 denetiminde etik değerleri sadece %0,3'ü buldu.

### Verim Satıları Verim Sayfaları (Gebru et al. 2018)

Elektronik- veri levha analogiyası.
- Motivasyon (veriler kümesi neden oluşturuldu).
- Yapılandırma (bunlarda ne var).
- Toplama süreci (gönüllü olarak nasıl toplandı).
- Etiketleme (eğer geçerli ise).
- Kullanımlar (hükümlendirilmiş, yasaklanmış, riskler).
- - dağıtım.
- Bakım.

CACM 2021'de yayınlanmıştır. Veri sayfası yukarıdaki belgelendirme; model kartı veri sayfasının doğru olduğundan bağlıdır.

### Veri Kartları (Pushkarna et al., Google 2022)

Modüler katmanlı detaylar.
- **Telescopic.**Uzman olmayanlar için yüksek düzeyde özet.
- **Periscopic.**ML uygulayıcıları için orta düzeyde genel bakış.
- **Microscopic.**Denetçiler için ayrıntılı özellik düzeyde belgeler.

Sınır-objekt çerçeveli: farklı okuyucular aynı belgeye farklı bilgiler çıkarır.

### Sistem Kartları

Kapsam: Model + güvenlik yığın + dağıtım bağlamı dahil olmak üzere sonundan sonuna kadar AI sistemi. Bölümler genellikle şunları içerir:
- Güvenlik yetenekleri.
- Hızlı enjeksiyon koruması.
- Veri eksfiltrasyonu tespit.
- Açıklanan insan değerlerine uyum sağlamak.
- - Olay tepkisi.

Sidhpurwala 2024 ve Meta sistem düzeyinde şeffaflık çalışmaları. "Tiranç Buluçları" (arXiv:2509.20394) Sistem Kartını Model Kartlara dağıtım katmanının tamamı olarak resmileştirir.

### 2024-2025 gelişmeleri

- **CardGen (Liu et al. 2024).**LLM'ler aracılığıyla otomatik model kart üretimi; standart Mitchell 2019 alanlarında birçok insan tarafından yazılan karttan daha yüksek objektiflik raporları.
- **Download correlation (Liang et al. 2024).**Detaylı model kartlar HF  kabul basıncındaki en yüksek indirme oranlarının %29'a kadar oranıyla ilişkili olmakta sadece uyumluluk yönünde değil piyasa yönünde de ilerliyor.
- **Laminator (Duddu et al. 2024).**Hardver TEE / kriptografik imzalar yoluyla doğrulanabilir sertifikalar  model kartın sadece bir talebi değil, bir iddia kanıtı taşımasına izin verir.
- **Sustainability (Jouneaux et al. July 2025).**Karbon, su ve bilgisayar enerjisi ayak izi için eklemeler; ortaya çıkan ISO standartları.
- **Regulatory cards.**AB Yapay zeka Yasası (Deneyim 24) GPAI Uygulama Kodu Şeffaflık bölümünde uyumluluk eseri olarak model kartlar gerekmektedir.

### Bu 18 fazaya uygun.

Ders 24-25 düzenleyici ve CVE katmanlarıdır. Ders 26 belgeler katmanıdır. Ders 27 veri sayfasının yukarı akımı olan eğitim veri yönetimi. Ders 28 kartlarda referans edilen değerlendirmeleri üreten araştırma ekosistemidir.

```figure
an-card-scopes
```

## Kullan

`code/main.py`Oyuncak dağıtım için minimal bir model kartı, veri sayfası ve sistem kartı oluşturur. Her biri kanonik bölüm yapısını takip eder.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-card-audit.md`. Bir model kart, veri sayfası veya sistem kartı verilirse, bölüm kapsamını, sayısal parçalanmayı ve doğrulanabilir sertifikaların olup olmadığını denetler.

## Egzersizler

1. Çık .`code/main.py`- Yaratılan kartları incelemek. Zayıf olan bölümleri (sadece yer sahibi için) belirlemek ve bunları güçlendirecek kanıtları belirtmek.

2. Modeldeki kartı iki demografik gruba boyutlu bir analizle genişlet (Desin 20).

3. Oreamuno et al. 2023'te 0.3% kabul oranı hakkında okuyun. Etik düşüncelerle kabul edilmeyi artıran bir yapısal değişiklik önerin.

4. Laminator (Duddu et al. 2024) doğrulanabilir attestasyonlar için TEE'leri kullanır. Bir değerlendirme sonuçlarının kriptografik bir attestasyonu bulunan ve doğrulayıcının rolünü açıklayan bir model kart alanı tasarlayın.

5. Geçmiş projelerinizden biri veya hipotezici bir dağıtım için bir Sistem Kartı (Sistem Kartı, Model Kartı değil) yazın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Model Card | "the Mitchell card" | Mitchell et al. 2019 standard documentation for ML models |
| Datasheet | "the Gebru datasheet" | Gebru et al. 2018 standard documentation for datasets |
| Data Card | "the Pushkarna card" | Google 2022 modular layered data documentation |
| System Card | "the deployment card" | End-to-end AI system documentation including safety stack |
| Boundary object | "different readers, one doc" | Data Cards framing: same document serves diverse audiences |
| Verifiable attestation | "the Laminator attestation" | Cryptographic or TEE proof attached to a documentation claim |
| Sustainability field | "carbon / water footprint" | Emerging 2025 addition for environmental accounting |

## Daha Fazla Okumak

- [Mitchell et al. — Model Cards for Model Reporting (arXiv:1810.03993, FAT* 2019)](https://arxiv.org/abs/1810.03993) Kanonik model kartı
- [Gebru et al. — Datasheets for Datasets (CACM 2021, arXiv:1803.09010)](https://arxiv.org/abs/1803.09010) Verim sayfası kağıdı
- [Pushkarna et al. — Data Cards (Google 2022)](https://arxiv.org/abs/2204.01075) Katmanlı veri belgesi
- [Sidhpurwala et al. — Blueprints of Trust (arXiv:2509.20394)](https://arxiv.org/abs/2509.20394) Sistem Kartı resmileştirme
