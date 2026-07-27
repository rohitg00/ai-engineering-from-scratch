# Hizalama Araştırma Ekosistemi — MATS, Redwood, Apollo, METR

> Beş kuruluş 2026 laboratuvar dışı uyum araştırma katmanını tanımlamaktadır. MATS (ML Hizalama ve Teori Akademisyenleri): 2021'in sonlarından bu yana 527'den fazla araştırmacı, 180'den fazla makale, 10.000'den fazla alıntı, h-index 47; ~90 akademisyen ve 40 mentordan oluşan 501(c)(3) olarak birleştirilmiş 2024 yaz kohortu; 2025 öncesi mezunların %80'i, Anthropic, DeepMind, OpenAI, UK AISI, RAND, Redwood, METR, Apollo'da 200'den fazla kişiyle emniyet/güvenlik üzerinde çalışıyor. Redwood Research: Buck Shlegeris tarafından kurulan uygulamalı hizalama laboratuvarı; Yapay Zeka Kontrolü (Ders 10) tanıtıldı; Kontrol güvenliği vakaları konusunda Birleşik Krallık AISI ile işbirliği yapmaktadır. Apollo Araştırması: sınır laboratuvarları için ön-deployment planlama değerlendirmeleri; Bağlam İçi Planlama (Ders 8) ve Yapay Zeka Planlaması için Güvenlik Durumlarına Doğru'nun yazarıdır. METR (Model Değerlendirme ve Tehdit Araştırması): göreve dayalı yetenek değerlendirmeleri, otonom görev zaman-ufku çalışmaları; "Sınır Yapay Zeka Güvenlik Politikalarının Ortak Unsurları" laboratuvar framework'lerını karşılaştırır. Eleos Yapay Zeka Araştırması: model-refah ön-deployment değerlendirmeleri (Ders 19); Claude Opus 4 refah değerlendirmesini gerçekleştirdi.

**Tür:** Öğren
**Diller:** yok
**Önkoşullar:** Aşama 18 · 01-27 (önceki Aşama 18 dersleri)
**Süre:** ~45 dakika

## Öğrenme Hedefleri

- Laboratuvar dışı uyum araştırma ekosisteminin beş kuruluşunu ve bunların temel çıktılarını tanımlayın.
- MATS'in ölçeğini (akademisyenler, makaleler, h-endeksi) ve yetenek kanalı olarak rolünü açıklayın.
- Redwood'un Yapay Zeka Kontrol gündemini ve Birleşik Krallık AISI ile olan ortaklığını açıklayın.
- METR'nin göreve dayalı değerlendirme metodolojisini açıklayın.

## Sorun

Sınır laboratuvarları (Ders 18) dahili olarak güvenlik değerlendirmeleri üretir ve seçilen sonuçları yayınlar. Laboratuvarların dışındaki ekosistem, değerlendirmelerin doğrulandığı, yeni hata türlerinin ilk keşfedildiği ve yeteneklerin eğitildiği yerdir. Ekosistemin anlaşılması, hangi araştırma bulgularına kimlerin güvendiğinin yorumlanmasına yardımcı olur.

## Konsept

### MATS (ML Hizalama ve Teori Akademisyenleri)

2021'in sonlarında başladı. Araştırma mentorluğu programı; akademisyenler belirli bir uyum sorunu üzerinde kıdemli bir araştırmacıyla 10-12 hafta geçirirler.

Ölçek (2026):
- Kuruluşundan bu yana 527'den fazla araştırmacı.
- 180'den fazla makale yayınlandı.
- 10.000'den fazla alıntı.
- h-endeksi 47.
- Yaz 2024: 90 akademisyen + 40 mentor; 501(c)(3) olarak dahil edilmiştir.

Kariyer sonuçları: 2025 öncesi mezunların ~%80'i emniyet/güvenlik üzerinde çalışıyor. Anthropic, DeepMind, OpenAI, UK AISI, RAND, Redwood, METR, Apollo'da 200+.

### Redwood Araştırması

Uygulamalı hizalama laboratuvarı. Buck Shlegeris tarafından kuruldu. Yapay Zeka Kontrolü gündemi tanıtıldı (Ders 10). Kontrol güvenliği vakalarında Birleşik Krallık AISI ile işbirliği yapar. Değerlendirme tasarımı konusunda DeepMind ve Anthropic'e tavsiyelerde bulunur.

Kanonik makaleler: Greenblatt, Shlegeris ve diğerleri, "AI Control" (arXiv:2312.06942, ICML 2024); Hizalama Sahteciliği (Greenblatt, Denison, Wright ve diğerleri, arXiv:2412.14093, Anthropic ile ortak).

Tarz: Belirli tehdit modelleri, en kötü durumdaki rakipler, stres testine tabi tutulabilecek somut protokoller.

### Apollo Araştırması

Sınır laboratuvarları için ön-deployment planlama değerlendirmeleri. Bağlam İçi Planlama (Ders 8, arXiv:2412.04984) tarafından yazılmıştır. 2025 OpenAI planlama karşıtı eğitim işbirliğine ortak olun. Yapay Zeka Planlaması için Güvenlik Durumlarına Doğru Üretir (2024).

Stil: agentaldatmacanın ortaya çıkabileceği ortam değerlendirmeleri; üç sütunlu ayrıştırma (yanlış hizalama, hedefe yöneliklik, durumsal farkındalık).

### METR (Model Değerlendirme ve Tehdit Araştırması)

Görev bazlı yetenek değerlendirmeleri. Otonom görev tamamlama zaman-ufku çalışmaları. "Sınır Yapay Zeka Güvenlik Politikalarının Ortak Unsurları" (metr.org/common-elements, 2025) laboratuvar framework'lerını karşılaştırır.

Apollo ile birlikte AI Scheming güvenlik durumu taslağının ortak yazarı.

Tarz: uzun ufuklu görev değerlendirmeleri, ampirik yetenek ölçümü, framework sentezi.

### Eleos Yapay Zeka Araştırması

Model refahı ön-deployment değerlendirmeleri. Sistem kartının 5.3 bölümünde belgelenen Claude Opus 4 refah değerlendirmesini gerçekleştirdi. Ders 19'un refahla ilgili iddiaları için harici metodoloji kontrolü sağlar.

### Akış

MATS araştırmacıları eğitiyor. Mezunlar Anthropic, DeepMind, OpenAI (laboratuvar güvenlik ekipleri) veya Redwood, Apollo, METR, Eleos'a (harici değerlendirme) giderler. Dış değerlendiriciler laboratuvarlarla ve Birleşik Krallık AISI / CAISI ile ortak çalışır. Yayınlar ekosistemi bir sonraki grup için MATS'e geri besliyor.

### Bu katman neden önemlidir?

Tek kaynaklı değerlendirmeler güvenilmezdir: Kendi modellerini değerlendiren laboratuvarlarda yapısal bir çıkar çatışması vardır. Harici değerlendiriciler, laboratuvarın eksik bildirebileceği arıza türlerini ortaya çıkarabilir ve doğrulayabilir. 2024 Sleeper Agent'nin makalesi (Ders 7) Antropik + Redwood'du; Hizalama Sahteciliği Antropik + Sekoya idi; Bağlam İçi Planlama Apollo'ydu; Anti-Scheming, Apollo + OpenAI idi. Çoklu organizasyon yapısı kalite kontrolüdür.

### Bunun 18. Aşamada yeri nedir

7-11. derslerde Redwood ve Apollo çalışmalarına atıfta bulunulur; Ders 18, METR'nin framework karşılaştırmasına atıfta bulunmaktadır; Ders 19 Eleos'a atıfta bulunuyor. Ders 28, Aşamanın geri kalanının dayandığı ekosistemin açık organizasyonel haritasıdır.

## Use It — Hazır Araçla Uygula

Kod yok. Harici sentezin laboratuvar içi politika çalışmalarına nasıl değer kattığının bir örneği olarak METR'nin "Sınır Yapay Zeka Güvenlik Politikalarının Ortak Unsurları" başlıklı makaleyi okuyun.

## Ship It — Kullanıma Sun

Bu ders `outputs/skill-ecosystem-map.md` üretir. Bir uyum iddiası veya değerlendirmesi verildiğinde, kuruluşu, yayın yerini ve metodolojik stili tanımlar ve bilinen muadili kuruluşlarla çapraz kontroller yapar.

## Egzersizler

1. Ders 7-15'ten bir makale seçin ve ilgili kuruluşları belirleyin. Yazarları MATS mezunları ve mevcut ekosistem bağlantıları ile karşılaştırın.

2. METR'nin "Sınır Yapay Zeka Güvenlik Politikalarının Ortak Unsurları"nı okuyun. Vurguladıkları üç laboratuvarlar arası yakınlaşmayı ve en büyük iki farklılığı tanımlayın.

3. MATS kariyer sonuçları ~%80 emniyet/güvenliktir. Bu seçim baskısının uyarlanabilir (alanı eğitiyor) veya taraflı (heterodoks konumları filtreliyor) olup olmadığını tartışın.

4. Redwood ve Apollo her ikisi de kontrol/planlama işi yapıyor ancak farklı tarzlarda. Bir arıza modu seçin ve her birinin bunu nasıl araştıracağını açıklayın.

5. Eleos AI tek saf model refah organizasyonudur. Refahla ilgili farklı bir soruna (bilişsel özgürlük, robotik düzenleme vb.) odaklanan varsayımsal bir ikinci organizasyon tasarlayın ve metodolojisini ifade edin.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| PASPASLAR | "mentorluk programı" | ML Hizalama ve Teori Akademisyenleri; 2021'den bu yana 527'den fazla araştırmacı |
| Sekoya Araştırması | "kontrol laboratuvarı" | Uygulanan hizalama; AI Kontrol yazarları; Birleşik Krallık AISI ortağı |
| Apollo Araştırması | "entrika değerlendirmeleri" | Sınır laboratuvarları için ön-deployment planlama değerlendirmeleri |
| METR | "görev ufku değerlendirmeleri" | Görev bazlı yetenek değerlendirmeleri; framework sentezi |
| Eleos AI | "refah laboratuvarı" | Model refahı ön-deployment değerlendirmeleri |
| Yetenek hattı | "MATS -> laboratuvarlar" | MATS mezunları Anthropic, DM, OpenAI, Redwood, Apollo, METR'ye akın ediyor |
| Dış değerlendirme | "laboratuar dışı kontrol" | Değerlendirme modelin yapımcısı tarafından yapılmadı; güvenilirlik katıyor |

## Daha Fazla Okuma

- [MATS (ML Alignment & Theory Scholars)](https://www.matsprogram.org/) — mentorluk programı
- [Redwood Research](https://www.redwoodresearch.org/) — Yapay Zeka Kontrol belgeleri
- [Apollo Research](https://www.apolloresearch.ai/) — planlama değerlendirmeleri
- [METR — Sınır Yapay Zeka Güvenlik Politikalarının Ortak Unsurları](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/) — framework karşılaştırması
- [Eleos Yapay Zeka Araştırması](https://www.eleosai.org/research) — model refah metodolojisi
