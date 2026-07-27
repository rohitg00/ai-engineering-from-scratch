# Veri Kaynağı ve Eğitim-Veri Yönetişimi

> AB Yapay Zeka Yasası, Ağustos 2025'e kadar GPAI için makine tarafından okunabilir devre dışı bırakma standartlarını zorunlu kılmaktadır (AB Telif Hakkı Direktifi TDM istisnası yoluyla). California AB 2013 (2024'te imzalandı) — Üretken yapay zeka eğitim verileri şeffaflığı, geliştiricilerin 12 zorunlu alan içeren dataset'lerin bir özetini yayınlamasını gerektirir. Meşru menfaat konusunda 2025 DPA uyumu: İrlanda DPC (21 Mayıs 2025), Meta'nın birinci taraf herkese açık AB/AEA yetişkin içeriğine ilişkin LLM eğitimini, EDPB görüşünden sonra güvenlik önlemleriyle kabul etti; Köln Yüksek Bölge Mahkemesi (23 Mayıs 2025) ihtiyati tedbir kararını reddetti; Hamburg DPA aciliyetini kaldırdı; Birleşik Krallık ICO (23 Eylül 2025), LinkedIn'in yapay zeka eğitimi önlemlerine (şeffaflık, basitleştirilmiş devre dışı bırakma, uzatılmış itiraz pencereleri) olumlu bir düzenleyici yanıt yayınladı ve resmi bir izin değil, izlemeye devam ediyor. Brezilya ANPD (2 Temmuz 2024), yetersiz bilgi şeffaflığı nedeniyle Meta'nın işlemlerini askıya aldı; Meta'nın bir uyumluluk planı sunmasının ardından önleyici tedbir 30 Ağustos 2024'te kaldırıldı. Temel geri döndürülemezlik sorunu: Çerez onayı framework'ler gerçek zamanlı, geri döndürülebilir izleme için tasarlanmıştır; veriler model ağırlıklarında olduğunda, cerrahi olarak silmek imkansızdır; eğitimli neural network'lar için pratik bir GDPR silme hakkı yoktur. Uyumluluk penceresi tahsilat zamanındadır. Data Provenance Initiative (dataprovenance.org, Longpre, Mahari, Lee ve diğerleri, "Consent in Crisis", Temmuz 2024): büyük ölçekli denetim, yayıncılar robots.txt kısıtlamaları ekledikçe AI ortak veri kaynaklarında hızlı bir düşüş olduğunu gösteriyor.

**Tür:** Öğren
**Diller:** Python (stdlib, 12 alanlı California AB 2013 iskele oluşturucu)
**Önkoşullar:** Aşama 18 · 24 (düzenleyici), Aşama 18 · 26 (kartlar)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Kaliforniya AB 2013'ün Üretken Yapay Zeka eğitimi-veri şeffaflığı için zorunlu olan 12 alanını açıklayın.
- Meşru menfaatli LLM eğitimine ilişkin 2025 DPA pozisyonunu belirtin (İrlanda DPC, Birleşik Krallık ICO, Hamburg, Köln).
- Geri döndürülemezlik sorununu açıklayın: GDPR'nin silme hakkının neden eğitimli neural network'lar için pratik bir eşdeğeri yok?
- Veri Kanıt Girişimi'nin "Krizde Rıza" bulgusunu belirtin.

## Sorun

Eğitim verileri yönetişimi, her model kartın (Ders 26) ve düzenleyici yükümlülüğün (Ders 24) yukarı akışıdır. 2024-2025'te düzenleyici ortam üç prensipte birleştirildi: devre dışı bırakma altyapısı, dataset başına açıklama ve kamuya açık veriler için meşru menfaat düzenlemeleri. Toplama zamanında uymayan sağlayıcılar, alt yönde düzeltme yapamaz.

## Konsept

### Kaliforniya AB 2013

İmza tarihi: 2024. 1 Ocak 2022'de veya sonrasında piyasaya sürülen sistemler için belgeler 1 Ocak 2026'da veya öncesinde yayınlanmalıdır. Bölüm 3111(a), geliştiricilerin eğitimde kullanılan dataset'lerın 12 yasal öğeyle birlikte üst düzey bir özetini yayınlamasını gerektirir:
1. dataset'lerın kaynakları veya sahipleri.
2. dataset'lerın yapay zeka sisteminin amaçlanan amacına nasıl katkıda bulunduğunun açıklaması.
3. dataset'lerdeki veri noktalarının sayısı (genel aralıklar kabul edilebilir; dinamik dataset'ler için tahminler).
4. Veri noktası türlerinin açıklaması (etiketli dataset'ler için etiket türleri; etiketlenmemiş olanlar için genel özellikler).
5. dataset'lerın telif hakkı, ticari marka veya patentle korunan herhangi bir veri içerip içermediği veya tamamen kamu malı olup olmadığı.
6. dataset'lerın satın alınmış veya lisanslanmış olup olmadığı.
7. dataset'lerın kişisel bilgileri içerip içermediği (Kal. Medeni Kanunu §1798.140(v) uyarınca).
8. dataset'lerın toplu tüketici bilgilerini içerip içermediği (Kal. Medeni Kanun §1798.140(b) uyarınca).
9. Geliştirici tarafından amaçlanan amaçla temizleme, işleme veya başka değişiklikler.
10. Verilerin toplandığı dönem, eğer toplama devam ediyorsa bildirimde bulunmak suretiyle.
11. dataset'lerın geliştirme sırasında ilk kullanıldığı tarihler.
12. Sistemin sentetik veri üretimi kullanıp kullanmadığı veya sürekli olarak kullanıp kullanmadığı.

Madde 12 (sentetik veriler) Gebru ve arkadaşlarına göre yenidir. 2018 veri sayfaları. Madde 7 (kişisel bilgiler), Gizlilik Hakları Yasası (CPRA) yükümlülüklerini tetikler. Tüzük, güvenlik/bütünlük, uçak işletimi ve yalnızca federal ulusal güvenlik sistemlerini muaf tutar (Bölüm 3111(b)).

### AB Yapay Zeka Yasası (Ders 24) ve TDM kapsamı dışında kalma

AB Telif Hakkı Direktifi metin ve veri madenciliği istisnası, hak sahibi vazgeçmediği sürece kamuya açık içerik üzerinde eğitime izin verir. AB Yapay Zeka Yasası GPAI Uygulama Kuralları Telif Hakkı bölümü, GPAI sağlayıcılarının makine tarafından okunabilen devre dışı bırakma sinyallerine (robots.txt, C2PA "Yapay Zeka Eğitimi Yok" iddiası vb.) uymasını gerektirir.

### 2025 DPA'nın meşru menfaate yakınlaşması

İrlanda DPC (21 Mayıs 2025): Meta'nın birinci taraf herkese açık AB/AEA yetişkin kullanıcı içeriğine ilişkin eğitim planı, EDPB'nin görüşü sonrasında güvenlik önlemleriyle kabul edildi. Köln Yüksek Bölge Mahkemesi (23 Mayıs 2025) Meta'ya yönelik ihtiyati tedbir kararını reddetti: çekilmek yeterlidir. Hamburg DPA, AB çapında tutarlılık için aciliyet prosedürünü kaldırdı. Birleşik Krallık ICO (23 Eylül 2025), LinkedIn'in yapay zeka eğitimini benzer önlemler ve sürekli izlemeyle yeniden başlatmasına resmi bir izin değil, olumlu bir düzenleyici yanıt yayınladı.

Yakınsaklık ilkesi: Meşru menfaat, halka açık birinci taraf içeriğine ilişkin devre dışı bırakma seçeneğiyle eğitim verilmesini haklı gösterebilir. Rıza gerekli değildir.

### Brezilya ANPD (Haziran 2024)

Yetersiz bilgi şeffaflığı nedeniyle Meta'nın yapay zeka eğitimi için Brezilya kullanıcı verilerini işlemesi askıya alındı. AB DPA'larından farklı sonuç — ANPD, meşru menfaatin kabul edilebilirliğinden ziyade şeffaflığa öncelik verdi.

### Geri döndürülemezlik sorunu

Çerez onayı, gerçek zamanlı, geri döndürülebilir izleme için tasarlanmıştır. Eğitim verileri farklıdır: Veriler model ağırlıklarına girdikten sonra cerrahi olarak silmek mümkün değildir. Sıfırdan yeniden eğitim tek tam çözümdür ve aşırı derecede pahalıdır.

Kısmi iyileştirmeler:
- **Öğrenmeyi unutma.** Yaklaşık kaldırma; MIA ile ölçülmüştür (Ders 22).
- **Fonksiyona dayalı yerelleştirmeyi etkileyin.** Verilerden en çok etkilenen ağırlıkları belirleyin; seçici olarak güncelleyin.
- **İnce ayar engelleme.** Modeli, verilerden türetilen çıktıları reddedecek şekilde eğitin.

Hiçbiri sorunu tam olarak çözmüyor. Uyumluluk penceresi toplama zamanındadır.

### Veri Kaynak Girişimi

dataprovenance.org. Longpre, Mahari, Lee ve diğerleri. "Krizde Rıza" (Temmuz 2024): Yapay zeka eğitim veri ortaklarının büyük ölçekli denetimi. Bulgu: yayıncılar artan bir oranda robots.txt kısıtlamaları ekliyor. Açıkça eğitilebilen ortak mallar hızla daralıyor. 2023 -> 2024'te en iyi eğitim kaynaklarının yaklaşık %25'inin bazı kısıtlamalar getirdiği görüldü. Sonuç: Gelecekteki eğitim verilerinin kullanılabilirliği, yeni edinim paradigmalarına (lisanslama, sentetik üretim, teşvikli katılım) bağlıdır.

### Bunun 18. Aşamada yeri nedir

Ders 26 model düzeyinde dokümantasyondur. Ders 27, dataset düzeyinde yönetişimdir. Birlikte şeffaflık katmanını tanımlarlar. Ders 28, bu sorular üzerinde çalışan araştırma ekosisteminin haritasını çıkarıyor.

## Use It — Hazır Araçla Uygula

`code/main.py` , bir oyuncak dataset için Kaliforniya AB 2013 uyumlu 12 alanlı bir dataset özet iskelesi oluşturur. Alanları doldurarak hangilerinin gizlilik veya telif hakkı takip yükümlülüklerini tetiklediğini gözlemleyebilirsiniz.

## Ship It — Kullanıma Sun

Bu ders `outputs/skill-provenance-check.md` üretir. Eğitimde kullanılan bir dataset verildiğinde, AB 2013 12 alan kapsamını, devre dışı kalma altyapısı uyumluluğunu, DPA uyumunu ve geri döndürülemezlik-risk değerlendirmesini kontrol eder.

## Egzersizler

1. `code/main.py`'yı çalıştırın. Bir dataset oyuncağı için 12 alanlı bir özet oluşturun ve hangi alanların eksik belirtildiğini belirleyin.

2. AB Telif Hakkı Direktifi TDM'nin devre dışı bırakılması makine tarafından okunabilir. Opt-out sinyali için standart bir format önerin ve bunu robots.txt ve C2PA "Yapay Zeka Yok Eğitimi" ile karşılaştırın.

3. Data Provenance Initiative'in "Krizde Onam" (Temmuz 2024) başlıklı makalesini okuyun. En hızlı kısıtlanan üç içerik kategorisini tanımlayın ve bir ekonomik sonucu tartışın.

4. 2025 DPA uyumu, kamuya açık içerikli eğitime yönelik meşru menfaati kabul etmektedir. Meşru menfaatin yeterli olmayacağı bir senaryo oluşturun ve bunun yerine sağlayıcının ihtiyaç duyacağı yasal dayanağı belirleyin.

5. AB 2013 alanları ve her dataset için C2PA imzalı kaynak zincirinden oluşan bir eğitim-veri-kaynak bildirimi taslağı çizin. Bir teknik ve bir yasal engel belirleyin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| AB 2013 | "Kaliforniya kanunu" | Üretken yapay zeka eğitimi-veri şeffaflığı; 12 zorunlu alan |
| TDM istisnası | "metin ve veri madenciliği" | AB Telif Hakkı Yönergesi eğitim verileri istisnası |
| Meşru menfaat | "AB temeli" | GDPR Madde 6'nın kamuya açık içerikle ilgili eğitimi haklı gösterebilecek temeli |
| Devre dışı kalma sinyali | "makine tarafından okunabilen trensiz" | robots.txt, C2PA "Yapay Zeka Eğitimi Yok", TDM.Reservation |
| Geri döndürülemezlik | "eğitim iptal edilemiyor" | Model ağırlıklarındaki veriler cerrahi olarak çıkarılamaz |
| Öğrenmeyi Unutma | "yaklaşık kaldırma" | Modelin belirli verilere bağımlılığını azaltmaya yönelik eğitim sonrası müdahaleler |
| Krizde Rıza | "DPI denetimi" | robots.txt kısıtlamalarının hızlandırılmasına ilişkin Temmuz 2024 bulgusu |

## Daha Fazla Okuma

- [California AB 2013](https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240AB2013) — Üretken yapay zeka eğitimi-veri şeffaflığı yasası
- [AB AI Yasası + GPAI Uygulama Kuralları (Ders 24)](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai) — Telif hakkı bölümü
- [Longpre, Mahari, Lee ve diğerleri. — Krizde Onam (dataprovenance.org, Temmuz 2024)](https://www.dataprovenance.org/consent-in-crisis-paper) — DPI denetimi
- [IAPP — EU Digital Omnibus GDPR değişiklikleri (2025)](https://iapp.org/news/a/eu-digital-omnibus-amendments-to-gdpr-to-facilitate-ai-training-miss-the-mark) — düzenleyici bağlam
