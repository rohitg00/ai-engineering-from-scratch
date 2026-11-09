# Düzeltme Araştırma Ekosistemi  MATS, Redwood, Apollo, METR

> Beş organizasyon 2026 laboratuvar dışı birleştirme araştırma katmanı tanımlıyor. MATS (ML Alignment & Theory Scholars): 2021'in sonundan bu yana 527+ araştırmacı, 180+ makale, 10K+ alıntılar, h-indeksi 47; 2024 yazında 501 ((c) ((3) olarak kurulmuş olan kohort; ~ 90 akademisyen ve 40 mentor ile; 2025'ten önceki mezuniyetlerin %80'i Anthropic, DeepMind, OpenAI, UK AISI, RAND, Redwood, METR, Apollo'da 200+ ile güvenlik/güven üzerinde çalışıyor. Redwood Araştırmaları: Buck Shlegeris tarafından kurulan uygulanabilir uyumlu bir laboratuvar; AI Kontrolü (Denevi 10) başlatıldı; kontrol güvenlik vakalarında İngiltere AISI ile işbirliği yaptı. Apollo Araştırmaları: Sınır laboratuvarları için görevlendirme öncesi planlama değerlendirmeleri; İç bağlamlı planlama (Desin 8) ve AI planlama için güvenlik durumlarına doğru yazar. METR (Model Değerlendirme ve Tehdit Araştırması): görev tabanlı kapasite değerlendirmeleri, özerk görev zaman ufukları çalışmaları; "Sınırlı AI Güvenlik Politikası Ortak Elemleri" laboratuvar çerçevelerini karşılaştırır. Eleos AI Araştırması: model refah öncesi değerlendirmeler (Deneyim 19); Claude Opus 4 refah değerlendirmesini gerçekleştirdi.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 18 · 01-27 (prior Phase 18 lessons)
**Time:** ~45 minutes

## Öğrenme Hedefleri

- Laboratuvar dışı araştırma ekosisteminin beş örgütünü ve temel üretilerini tanımlamak.
- MATS'in ölçeğini (bilim adamları, makaleler, h-indeksi) ve yetenekler boru hattı rolünü açıklayın.
- Redwood'un AI Kontrol gündemi ve İngiltere AISI ile ortaklığı anlatın.
- METR'nin görev tabanlı değerlendirme metodolojisini açıklayın.

## Sorun

Sınır laboratuvarları (Denevi 18) güvenlik değerlendirmeleri içtenlikle yaparlar ve seçilmiş sonuçları yayınlar. Laboratuvarların dışındaki ekosistem değerlendirmelerin doğrulanması, yeni başarısızlık modlarının ilk kez keşfedilmesi ve yeteneklerin eğitilmesi yeridir.

## Anlaşım

### MATS (ML Alignment & Theory Scholars)

Araştırma danışmanlığı programı 2021'in sonlarında başladı; akademisyenler belirli bir uyum sorunu üzerinde üst düzey bir araştırmacı ile 10-12 hafta geçirirler.

Ölçüsü (2026):
- Başlangıçtan beri 527+ araştırmacı.
- 180'den fazla makale yayınlandı.
- 10 bin+ alıntı.
- h-indeksi 47.
- 2024 yazı: 90 akademisyen + 40 mentor; 501 ((c) ((3) olarak kurulmuştur.

Kariyer sonuçları: 2025'e kadar mezun olanların %80'i güvenlik/güvenlik üzerine çalışıyor. 200+'ü Anthropic, DeepMind, OpenAI, UK AISI, RAND, Redwood, METR, Apollo'da.

### Redwood Araştırmaları

Buck Shlegeris tarafından kurulan uygulanan uyumlandırma laboratuvarı. AI Kontrol gündemi (Desin 10) tanıttı. UK AISI ile kontrol güvenlik vakalarında işbirliği yapıyor. Değerlendirme tasarımı konusunda DeepMind ve Anthropic'e danışmanlık yapıyor.

Kanonik makaleler: Greenblatt, Shlegeris et al., "AI Kontrol" (arXiv:2312.06942, ICML 2024); Alignment Faking (Greenblatt, Denison, Wright et al., arXiv:2412.14093, Anthropic ile ortak).

Stil: spesifik tehdit modelleri, en kötü durumda düşmanlar, stres testi yapılabilecek konkret protokoller.

### Apollo Araştırmaları

Sınır laboratuvarları için önceden dağıtım planlama değerlendirmeleri. İçerikli planlama (Lection 8, arXiv:2412.04984). 2025 OpenAI anti-planning eğitim işbirliği ortak.

Stil: aldatmaca ortaya çıkabilecek ajans değerlendirmeleri; üç direkli parçalanma (sahte bir çizgi, hedef yönlendirme, durum farkındalığı).

### METR (Model Değerlendirme ve Tehdit Araştırması)

Görev tabanlı yetenek değerlendirmeleri. Otonom görev tamamlama zaman ufukları çalışmaları. "Sınırlı AI Güvenlik Politikası Ortak Elementi" (metr.org/common-elements, 2025) laboratuvar çerçevelerini karşılaştırır.

Apollo ile birlikte AI'nin güvenlik kazasını tasarlama konusundaki ortak yazar.

Stil: uzun uzayda görev değerlendirmeleri, empiriyel kapasite ölçümü, çerçeve sentezi.

### Eleos AI Araştırmaları

Modelle refah öncesi değerlendirmeler. Sistem kartının 5.3 bölümünde belgelenmiş Claude Opus 4 refah değerlendirmesini gerçekleştirdi. Ders 19'da refah ile ilgili iddialar için dış metodoloji kontrolü sağlıyor.

### Akış

MATS araştırmacıları eğitir. Mezunlar Anthropic, DeepMind, OpenAI (laboratör güvenlik takımları) veya Redwood, Apollo, METR, Eleos (dış değerlendirme) 'e giderler. Dış değerlendirmeciler laboratuvarlarla ve İngiltere AISI / CAISI ile ortaklık kurar. Yayınlar ekosistemin bir sonraki kohort için MATS'e geri verilmesini sağlar.

### Bu katman neden önemli?

Tek kaynaklı değerlendirmeler güvenilir değildir: Kendi modelleri değerlendiren laboratuvarlar yapısal bir çıkar çatışmasına sahiptir. Laboratuvarın rapor veremeyeceği hata modlarını dış değerlendirici yükseltebilir ve doğrulayabilir. 2024 Uykucu Ajanlar makalesi (Desin 7) Anthropic + Redwood; Alignment Faking Anthropic + Redwood; Kontext İçinde Planlama Apollo; Anti-Scheming Apollo + OpenAI idi. Çok organlı yapı kalite kontrolüdür.

### Bu 18 fazaya uygun.

Ders 7-11 Redwood ve Apollo çalışmalarına değiniyor; Ders 18 METR çerçevesinin karşılaştırmasına değiniyor; Ders 19 Eleos'a değiniyor. Ders 28 Fasanın geri kalanı için ekosistem için açık bir örgütle ilgili haritadır.

```figure
sae-features
```

## Kullan

METR'nin "Sınırlı AI Güvenlik Politikası Ortak Elemleri"'ni okuyun.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-ecosystem-map.md`. Bir uyumlandırma iddiası veya değerlendirmeyi göz önünde bulundurarak, örgüt, yayın yeri ve metodolojik tarzı belirlenir ve bilinen karşı taraf örgütlerine karşı karşı verilebilir.

## Egzersizler

1. Derslerden 7-15'ten bir makale seçin ve katılan örgütleri belirleyin.

2. METR'nin "Sınırlı AI Güvenlik Politikası Ortak Elemleri"'ni okuyun.

3. MATS kariyer sonuçları %80'lik güvenlik/güvenliktir.Bu seçim basıncının uyarlayıcı olup olmadığını (sahası eğitimi) veya tarafsız olup olmadığını (heterodok pozisyonları filtreliyor) tartışın.

4. Redwood ve Apollo her ikisi de kontrol ve planlama işi yapar ama farklı stillerle.

5. Eleos AI, saf model refah örgütüdür. Farklı bir refah sorusuna (bilgi özgürlüğü, robot gerçekleştirme vb.) odaklanan bir hipotetik ikinci örgüt tasarlayın ve metodolojisini ifade edin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| MATS | "the mentorship program" | ML Alignment & Theory Scholars; 527+ researchers since 2021 |
| Redwood Research | "the control lab" | Applied alignment; AI Control authors; UK AISI partner |
| Apollo Research | "the scheming evals" | Pre-deployment scheming evaluations for frontier labs |
| METR | "the task-horizon evals" | Task-based capability evaluations; framework synthesis |
| Eleos AI | "the welfare lab" | Model-welfare pre-deployment evaluations |
| Talent pipeline | "MATS -> labs" | MATS graduates flow to Anthropic, DM, OpenAI, Redwood, Apollo, METR |
| External evaluation | "non-lab check" | Evaluation not done by the model's producer; adds credibility |

## Daha Fazla Okumak

- [MATS (ML Alignment & Theory Scholars)](https://www.matsprogram.org/) Öğretmenlik programı
- [Redwood Research](https://www.redwoodresearch.org/) AI Kontrol kağıtları
- [Apollo Research](https://www.apolloresearch.ai/) planlama değerlendirmeleri
- [METR — Common Elements of Frontier AI Safety Policies](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/) Çerçeve karşılaştırması
- [Eleos AI Research](https://www.eleosai.org/research) model refah metodolojisi
