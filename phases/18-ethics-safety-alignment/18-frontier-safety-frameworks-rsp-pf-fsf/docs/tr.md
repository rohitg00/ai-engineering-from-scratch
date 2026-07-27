# Sınır Güvenliği Framework'ler — RSP, PF, FSF

> Üç büyük laboratuvar framework, sınır yeteneğinin 2026 sektör yönetimini tanımlıyor. Antropik Sorumlu Ölçeklendirme Politikası v3.0 (Şubat 2026), KBRN ile ilgili modeller için Mayıs 2025'te ASL-3'ün etkinleştirilmesiyle biyogüvenlik seviyelerine göre modellenen kademeli Yapay Zeka Güvenlik Seviyelerini (ASL-1'den ASL-5+'ya) tanıtıyor. OpenAI Hazırlık Framework v2 (Nisan 2025), izlenen yetenekler için beş kriter tanımlar ve Yetenek Raporlarını Koruma Önlemleri Raporlarından ayırır. DeepMind Frontier Safety Framework v3.0 (Eylül 2025), yeni Zararlı Manipülasyon CCL'si de dahil olmak üzere Kritik Yetenek Düzeylerini tanıtıyor. Üçü de artık emsal laboratuvarların karşılaştırılabilir güvenlik önlemleri olmadan gönderilmesi durumunda ertelemeye izin veren rakip düzenleme maddeleri içeriyor. Laboratuvarlar arası uyum terminolojik değil yapısal olmaya devam ediyor: "Yetenek Eşikleri", "Yüksek Yetenek eşikleri" ve "Kritik Yetenek Düzeyleri" benzer yapıları ifade ediyor.

**Tür:** Öğren
**Diller:** yok
**Önkoşullar:** Aşama 18 · 17 (WMDP), Aşama 18 · 07-09 (aldatma başarısızlıkları)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- Anthropic'in ASL katman yapısını ve ASL-3'ü neyin etkinleştirdiğini açıklayın.
- İzlenen yetenekler için beş OpenAI Hazırlık Framework v2 kriterini adlandırın.
- DeepMind'ın Kritik Yetenek Seviyesi yapısını ve Zararlı Manipülasyon CCL'sini açıklayın.
- Rakip düzenleme maddelerini ve bunların yarış dinamikleri açısından neden önemli olduğunu açıklayın.
- Bir emniyet durumu tanımlayın ve üç sütunlu yapıyı (izleme, okunamazlık, yetersizlik) tanımlayın.

## Sorun

7-17. Dersler, aldatmanın mümkün olduğunu, ikili kullanım yeteneğinin mevcut olduğunu ve değerlendirmenin sınırlı olduğunu ortaya koyuyor. Sınırları aşabilen bir modele sahip bir laboratuvarın aşağıdaki özelliklere sahip bir iç yönetişim yapısına ihtiyacı vardır:
- Yeni koruma önlemlerinin gerekli olduğu durumlara ilişkin eşikleri tanımlar.
- Ölçeklendirme öncesi gerekli değerlendirmeleri tanımlar.
- Bir güvenlik durumunun neye benzediğini açıklar.
- Yarış dinamiği problemini çözer (rakipler koruma olmadan gemi gönderirse ne yaparsınız?).

2025-2026'nın üç framework'si son teknoloji ürünüdür; kusurludur, gelişmektedir ve laboratuvarlar arasında yeterince uyumlu hale gelmiştir; bu nedenle yönetişim sorusu artık framework'lerin var olup olmadıkları değil yeterli olup olmadığıdır.

## Konsept

### Antropik Sorumlu Ölçeklendirme Politikası v3.0 (Şubat 2026)

ASL'nin yapısı:
- ASL-1: bir sınır modeli değil (sınırdan daha zayıf temel çizgi tarafından kapsanır).
- ASL-2: mevcut sınır referans çizgisi; olağan güvenlik önlemleriyle konuşlandırıldı.
- ASL-3: büyük ölçüde daha yüksek suiistimal riski; KBRN ile ilgili yetenekler. Activated May 2025.
- ASL-4: Yapay Zeka Ar-Ge-2'yi geçme eşiği; Giriş seviyesi yapay zeka araştırmalarını otomatikleştirebilecek modeller.
- ASL-5+: gelişmiş Yapay Zeka Ar-Ge; Etkili ölçeklendirmeyi önemli ölçüde hızlandıran modeller.

v3.0'da yeni:
- Sınır Güvenliği Yol Haritaları (düzeltilmiş biçimde kamuya açık).
- Risk Raporları (üç ayda bir, bazıları dışarıdan incelenir).
- Yapay Zeka Ar-Ge'si, Yapay Zeka Ar-Ge-2 ve Yapay Zeka Ar-Ge-4'e ayrılmıştır.
- Yapay Zeka Ar-Ge-4'ü aşıldığında, yanlış hizalanmış hedefleri takip eden modellerden kaynaklanan yanlış hizalama risklerini tanımlayan olumlu bir güvenlik durumu gereklidir.

### OpenAI Hazırlık Framework v2 (15 Nisan 2025)

Takip edilen yetenekler için beş kriter:
- **Makul.** Makul tehdit modeli mevcuttur.
- **Ölçülebilir.** Ampirik değerlendirme mümkündür.
- **Şiddetli.** Zarar büyüktür.
- **Net-yeni.** Önceden var olan bir riskin ölçeği büyütülmemiştir.
- **Anında veya düzeltilemez.** Zarar hızlı bir şekilde meydana gelir veya geri alınamaz.

Beşini de karşılayan yetenekler izlenir. Diğerleri değil.

Diğer PF v2 yapısı:
- Yetenek Raporlarını (modelin neler yapabileceğini) Koruma Önlemleri Raporlarından (hangi kontrollerin mevcut olduğu) ayırın.
- Güvenlik Danışma Grubu incelemeleri.
- Liderlik onaylar; Kurulun Emniyet ve Güvenlik Komitesi denetler.
- "Ayarlama maddesi": Başka bir laboratuvarın benzer güvenlik önlemleri olmadan gönderilmesi durumunda OpenAI gereksinimleri azaltabilir.

### DeepMind Sınır Güvenliği Framework v3.0 (Eylül 2025)

Etki alanına göre Kritik Yetenek Düzeyleri (CCL'ler):
- Biyolojik Silah Yükseltmesi
- Siber Yükseliş
- ML Ar-Ge Hızlandırması
- Zararlı Manipülasyon ( v3.0'da yeni): yüksek riskli bağlamlarda inançları/davranışları önemli ölçüde değiştirebilecek modeller.

v2.0 (Şubat 2025), ML Ar-Ge CCL'leri için Yanıltıcı Hizalama bölümü ve daha yüksek güvenlik düzeyleri ekledi.

### Laboratuvarlar arası hizalama

- Antropik "Yetenek Eşikleri."
- DeepMind "Kritik Yetenek Seviyeleri."
- OpenAI "Yüksek Yetenek eşikleri."

Endüstri standardı terminoloji yok. Yapısal olarak uyumlu: yayınlanmış değerlendirme kriterlerine sahip üç kademeli sınır yeteneği. Her üçü de rakiplere yönelik düzenleme maddeleri içermektedir (2025'ten itibaren).

### Güvenlik durumları

Güvenlik durumu, bir deployment'nin en kötü durum varsayımları altında kabul edilebilir düzeyde güvenli olduğunu gösteren yazılı bir argümandır. Standart yapı üç sütunu hedefler:

- **İzleme.** Kötü bir davranış meydana gelirse tespit edebilir miyiz?
- **Okunamazlık.** Model, zarar vermek için tutarlı bir plan uygulama becerisinden yoksun mu?
- **Yetersizlik.** Model söz konusu zarara sebep olma kabiliyetinden yoksun mu?

Farklı güvenlik durumları farklı unsurları hedef alır. ASL-3 KBRN vakasında, yetersizlik (öğrenmeyi unutma yoluyla) birincil hedeftir. Aldatıcı hizalama için izleme ve okunamazlık hedeftir. Siber yükseliş için üçü de önemlidir.

### Yarış dinamiği sorunu

Rakip ayarlama maddeleri tartışmalıdır. Eleştirmenler, dibe doğru bir yarış yarattıklarını ileri sürüyor: Bir rakip kusur gösterdiğinde her üç laboratuvar da gereksinimleri azaltırsa, denge ayrılmaya doğru kayar. Savunmacılar, kaçan laboratuvarın güvenlik konusunda daha az bilinçli olması durumunda alternatifin (tek taraflı korumaların) daha kötü sonuçlar doğuracağını savunuyor.

Birleşik Krallık AISI, ABD CAISI ve AB AI Ofisi (Ders 24) dış yönetişim muadilleridir. Laboratuvar framework'ler gönüllüdür; düzenleyici framework'ler ortaya çıkıyor.

### Bunun 18. Aşamada yeri nedir

17-18. dersler, aldatma ve kırmızı takım analizlerinin üzerindeki ölçüm ve yönetim katmanıdır. 19-24. dersler refah, önyargı, mahremiyet, damgalama ve düzenleyici yapıyı kapsamaktadır. Ders 28, değerlendirmeleri işlevsel hale getiren araştırma ekosisteminin (MATS, Redwood, Apollo, METR) haritasını çıkarır.

## Use It — Hazır Araçla Uygula

Bu ders için kod yok. Üç birincil kaynağı okuyun: RSP v3.0, PF v2, FSF v3.0. Her laboratuvarın katman yapısını diğerleriyle eşleştirin ve her laboratuvarın diğerlerinin tanımlamadığı bir eşiği belirleyin.

## Ship It — Kullanıma Sun

Bu ders `outputs/skill-framework-diff.md` üretir. Bir güvenlik framework veya sürüm notu verildiğinde, framework'ün eşik tanımlarını, gerekli değerlendirmeleri ve güvenlik durumu yapısını RSP v3.0, PF v2, FSF v3.0 ile karşılaştırır ve laboratuvarlar arası boşlukları işaretler.

## Egzersizler

1. RSP v3.0, PF v2 ve FSF v3.0'yi okuyun. Her laboratuvarın KBRN eşiğini, her birinin Yapay Zeka Ar-Ge eşiğini ve her birinin gerekli ön-deployment değerlendirmesini içeren bir tablo derleyin.

2. Rakip ayarlama maddesi her üç frameworks'de (2025+) bulunmaktadır. Bunu savunan bir paragraf yazın; karşı çıkan bir paragraf yazınız. Her pozisyonun bağlı olduğu varsayımı tanımlayın.

3. Anthropic'in AI Ar-Ge-4 eşiğini aşan bir model için bir güvenlik durumu tasarlayın. Üç sütunun (izleme, okunaksızlık, yetersizlik) her birinin gerektirdiği kanıtları adlandırın.

4. DeepMind'ın FSF'si v3.0 , Zararlı Manipülasyon CCL'sini sunar. Bir modelin bu eşiği geçtiğini gösteren üç ampirik ölçüm önerin.

5. METR'nin "Sınır Yapay Zeka Güvenlik Politikalarının Ortak Unsurları" (2025) başlıklı makaleyi okuyun. Laboratuvarlar arası en güçlü üç yakınsamayı ve en büyük iki farklılığı adlandırın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| RSP | "Antropik framework" | Sorumlu Ölçeklendirme Politikası; ASL katmanları; v3.0 Şubat 2026 |
| PF | "OpenAI'nin framework" | Hazırlık Framework; beş kriter; v2 Nisan 2025 |
| FSF | "DeepMind'ın framework" | Sınır Güvenliği Framework; CCL'ler; v3.0 Eylül 2025 |
| ASL-3 | "biyogüvenlik seviyesi 3-analog" | KBRN ile ilgili yetenekler için antropik katman; Mayıs 2025'te etkinleştirildi |
| CCL | "kritik yetenek düzeyi" | DeepMind'ın eşik yapısı; alan adı başına |
| Güvenlik çantası | "resmi argüman" | deployment'nin en kötü durumda U |
| Ayarlama maddesi | "rakipten ayrılma ödeneği" | Framework rakiplerin karşılaştırılabilir güvenlik önlemleri olmadan gönderim yapması durumunda gereksinimlerin azaltılmasına ilişkin hüküm |

## Daha Fazla Okuma

- [Antropik — Sorumlu Ölçeklendirme Politikası v3.0 (Şubat 2026)](https://www.anthropic.com/responsible-scaling-policy) — ASL katmanları, yol haritaları, AI Ar-Ge ayrıştırması
- [OpenAI — Hazırlık Durumunun Güncellenmesi Framework (15 Nisan 2025)](https://openai.com/index/updating-our-preparedness-framework/) — beş kriter, düzeltme maddesi
- [DeepMind — Sınır Güvenliğimizi Güçlendirmek Framework (Eylül 2025)](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) — CCL v3.0, Zararlı Manipülasyon
- [METR — Sınır Yapay Zeka Güvenlik Politikalarının Ortak Unsurları (2025)](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/) — laboratuvarlar arası karşılaştırma
