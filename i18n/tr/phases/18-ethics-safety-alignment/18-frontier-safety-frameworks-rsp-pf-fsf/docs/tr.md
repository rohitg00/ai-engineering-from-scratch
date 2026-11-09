# Sınır Güvenlik Çerçeveleri  RSP, PF, FSF

> Üç büyük laboratuvar çerçevesinde, 2026 yılına kadar sınır kapasitesinin endüstri yönetimi tanımlanır. Anthropic Responsible Scaling Policy v3.0 (Febrúar 2026) biyolojik güvenlik seviyelerine dayalı dereceli AI Güvenlik Denizeleri (ASL-1'den ASL-5+'ye kadar) tanıttı. OpenAI Hazırlık Çerçevi v2 (Epril 2025) izlenen yetenekler için beş kriter tanımlar ve yetenek raporlarını güvenlik raporlarından ayırır. DeepMind Frontier Güvenlik Çerçeve v3.0 (Eylül 2025) yeni zararlı manipülasyon CCL'yi içeren kritik yetenek seviyelerini tanıttı. Şimdi üçü de rakip düzenleme şartlarını içerir. Eğer eşdeğer laboratuvarlar benzer korumalar almadan gemiyi gönderirse ertelenmeyi sağlar. Laboratuvar çapındaki uyumlama yapısal olarak kalır, terminolojik olarak değil: "Yeteneklilik Eğitimi", "Yüksek Yeteneklilik Eğitimi" ve "Kritik Yeteneklilik Denizi" benzer yapılandırmalar gösterir.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 18 · 17 (WMDP), Phase 18 · 07-09 (deception failures)
**Time:** ~75 minutes

## Öğrenme Hedefleri

- Anthropic'in ASL katman yapısını ve ASL-3'ü neyin aktive ettiğini açıklayın.
- İzleme yetenekleri için beş OpenAI Hazırlık Çerçevi v2 kriterini belirtin.
- DeepMind'in Kritik Yetenek Duruşumu ve Zararlı Manipülasyon CCL'si'ni açıklayın.
- Rekabetçi ayarlama klauzüllerini ve yarış dinamikleri için neden önemli olduğunu açıklayın.
- Güvenlik kapısını tanımlayın ve üç sütunlu yapıyı (öneticilik, okumayı engelleme, yetersizliği) açıklayın.

## Sorun

Dersler 7-17 aldatmanın mümkün olduğunu, çift kullanım kabiliyetinin var olduğunu ve değerlendirme sınırlarının olduğunu belirler. Sınırlara uygun bir model olan bir laboratuvarın, aşağıdakileri içeren bir yönetim yapısına ihtiyacı vardır:
- Yeni garantilerin gerekli olduğu için eşiği belirler.
- Ölçeklendirme öncesi gerekli değerlendirmeyi tanımlar.
- Güvenlik kafasının nasıl olduğunu anlatıyor.
- Yarış dinamik problemini ele alır (renişçiler koruma olmadan gemiyi açarsa ne yaparsınız?).

2025-2026 dönemindeki üç çerçeve, gelişmekte olan ve laboratuvarlar arasında yeterince uyumlu olan son teknoloji  kusurlu ve gelişmekte olan çerçeveler, yönetim sorusunun şimdi mevcut olup olmadığını değil, çerçevelerin yeterli olup olmadığını sormaktadır.

## Anlaşım

### Antropik Sorumlu Ölçekleme Politikası v3.0 (Feb. 2026)

ASL yapısı:
- ASL-1: sınır modeli değil (sınırdan zayıf bir temel çizgi ile toplamlanmıştır).
- ASL-2: mevcut sınır başlangıç çizgisi; normal güvenlik önlemleri ile uygulanmaktadır.
- ASL-3: felaketli kötüye kullanma riski önemli ölçüde daha yüksek; CBRN ile ilgili yetenekler.
- ASL-4: AI R&D-2 geçme eşiği; girişim düzeyinde AI araştırmasını otomatikleştirebilecek modeller.
- ASL-5+: etkili ölçeklendirmeyi çarpıcı bir şekilde hızlandıran gelişmiş AI R&D; modelleri.

3.0'da yeni:
- Sınır Güvenliği Yol Haritaları (sözlenmiş biçimde halka açık).
- Risk Raporları (tört yılda bir, bazılarının dıştan gözden geçirilmesi).
- AI R&D, AI R&D-2 ve AI R&D-4'e ayrıştırılmıştır.
- AI R&D-4'i geçtikten sonra, yanlış uyumlu hedefleri takip eden modellerden yanlış uyum sağlama risklerini belirleyen bir onaylı güvenlik durumu gerekmektedir.

### OpenAI Hazırlık Çerçeve v2 (15 Nisan 2025)

Takip edilen yetenekler için beş kriter:
- **Plausible.**Makul bir tehdit modeli var.
- **Measurable.**Empirik değerlendirme mümkün.
- **Severe.**Zarar çok büyük.
- **Net-new.**Daha önce var olan bir risk değil.
- **Instantaneous-or-irremediable.**Zarar hızlı bir şekilde olur veya telafi edilmez.

Beş kişiyi de karşılayan yetenekler izlenir.

Diğer PF v2 yapısı:
- Kapayolu Raporları (modelin yapabileceği şeyler) ve Koruma Raporları (kontrollerin varlığı) için ayrı.
- Güvenlik Danışmanlık Grubu'nun incelemeleri.
- Yönetim onaylıyor; Kurul Güvenlik ve Güvenlik Komitesi gözetim yapıyor.
- "Düzeltme klazuli": OpenAI, diğer laboratuvar gemileri karşılaştırılabilir güvenlik önlemleri almıyorsa gereklilikleri azaltabilir.

### DeepMind Sınır Güvenlik Çerçeve v3.0 (Eylül 2025)

Bölümler açısından kritik kapasite seviyeleri (CCL):
- Biyolojik Silahların Yüklenmesi
- Siber Yüklenme
- ML Araştırma ve Gelişim Hızlandırması
- Zararlı Manipülasyon (v3.0'da yeni): yüksek riskli bağlamlarda inançları / davranışları önemli ölçüde değiştirebilecek modeller.

V2.0 (Feb. 2025) bir aldatıcı uyum bölümünü ve ML R&D CCL'ler için daha yüksek güvenlik seviyelerini ekledi.

### Laboratuvar çaplı uyum

- Antropik "Kapalet Eğitimi".
- DeepMind "Kritik yetenek seviyeleri".
- OpenAI "Yüksek Yeteneklilik Eğitimi".

Endüstri standart terminoloji yoktur. Struktörel olarak uyumlu: üç çerçevenin her biri yayınlanmış değerlendirme kriterleri ile derecelendirilen kapasite eşiğini tanımlar.

### Güvenlik kapıları

Güvenlik durumu, en kötü durumlarda bir dağıtımın kabul edilebilir bir şekilde güvenli olduğunu gösteren yazılı bir argümandır.

- **Monitoring.**Eğer kötü bir davranış olursa onu tespit edebilir miyiz?
- **Illegibility.**Model zarar vermek için tutarlı bir plan yürütme yeteneğine sahip değil mi?
- **Incapability.**Model, söz konusu zararı yaratabilecek yeteneği yok mu?

Farklı güvenlik vakaları farklı direkleri hedef alır. ASL-3 CBRN vakaları için, yetersizlik (öğrenmeyi bırakmak yoluyla) ana hedefdir. Yanlış uyum, izleme ve okumayı hedefler. Siber yükseltme için, üçü de önemlidir.

### Yarış dinamik problemi

Rekabetçi ayarlama klauzüleri tartışmalıdır. Eleştirmenler, aşağıya bir yarış yarattıklarını savunuyor: rekabetçi kusurlu olduğunda üç laboratuvar da gereklilikleri azaltırsa, denge kaçaklığa doğru kayar. Savunmacılar alternatif (bir taraflı korumalar) kaçakçı laboratuvarın güvenliği konusunda daha az bilinçli olması durumunda daha kötü sonuçlar doğurduğunu savunuyor.

İngiltere AISI, ABD CAISI ve AB AI Ofisi (Denevi 24) dış yönetim eşleri. Laboratuvar çerçeveleri gönüllüdür; düzenleyici çerçeveler ortaya çıkmaktadır.

### Bu 18 fazaya uygun.

Dersler 17-18, aldatma ve kırmızı takım analizlerinin üstündeki ölçüm ve yönetim katmanıdır. Dersler 19-24 refah, tarafsızlık, gizlilik, su işaretleme ve düzenleyici yapıyı kapsar. Ders 28 değerlendirmeleri işletiyen araştırma ekosistemini (MATS, Redwood, Apollo, METR) haritalar.

```figure
al-asl-ladder
```

## Kullan

Bu ders için kod yok. Üç ana kaynağı okuyun: RSP v3.0, PF v2, FSF v3.0. Her laboratuvarın katman yapısını diğerlerine haritasın ve her laboratuvarın diğerlerinin tanımlamadığı bir eşiği belirleyin.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-framework-diff.md`. Bir güvenlik çerçevesini veya açıklama notunu göz önünde bulundurarak, çerçevenin eşiğin tanımlarını, gerekli değerlendirmeleri ve güvenlik durumunun yapısını RSP v3.0, PF v2, FSF v3.0 ile karşılaştırır ve laboratuvar çapındaki boşlukları işaretler.

## Egzersizler

1. RSP v3.0, PF v2 ve FSF v3.0'u okuyun. Her laboratuvarın CBRN eşiğinin, her birinin AI araştırma ve geliştirme eşiğinin ve her birinin gerekli görevlendirme öncesi değerlendirmesinin bir tablosunu oluşturun.

2. Rekabetçi ayarlama klazuli üç çerçeve (2025+) de bulunmaktadır. Bunun için bir paragraf yazın; karşı bir paragraf yazın. Her pozisyonun bağlı olduğu varsayımı tanımlayın.

3. Anthropic'in AI R&D-4 eşiğine geçen bir model için bir güvenlik kazası tasarlayın.

4. DeepMind'in FSF v3.0'u zararlı Manipülasyon CCL'yi tanıttı. Bir modelin bu eşiği geçtiğini gösteren üç empiriyel ölçüm önerin.

5. METR'nin "Sınırlı AI Güvenlik Politikası Ortak Elemleri" (2025) 'ni okuyun. En güçlü üç laboratuvar çapındaki birleştiği ve en büyük iki farklılığı isimlendirin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| RSP | "Anthropic's framework" | Responsible Scaling Policy; ASL tiers; v3.0 February 2026 |
| PF | "OpenAI's framework" | Preparedness Framework; five criteria; v2 April 2025 |
| FSF | "DeepMind's framework" | Frontier Safety Framework; CCLs; v3.0 September 2025 |
| ASL-3 | "biosafety level 3-analog" | Anthropic tier for CBRN-relevant capabilities; activated May 2025 |
| CCL | "critical capability level" | DeepMind's threshold construct; per-domain |
| Safety case | "the formal argument" | Written argument that deployment is acceptably safe under worst-case U |
| Adjustment clause | "competitor defection allowance" | Framework provision for reducing requirements if competitors ship without comparable safeguards |

## Daha Fazla Okumak

- [Anthropic — Responsible Scaling Policy v3.0 (February 2026)](https://www.anthropic.com/responsible-scaling-policy) ASL seviyeleri, yol hariteleri, AI Araştırma ve Gelişim bölümü
- [OpenAI — Updating the Preparedness Framework (April 15, 2025)](https://openai.com/index/updating-our-preparedness-framework/) Beş kriter, uyumsal hüküm
- [DeepMind — Strengthening our Frontier Safety Framework (September 2025)](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) CCL v3.0, Zararlı Yönetim
- [METR — Common Elements of Frontier AI Safety Policies (2025)](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/) Laboratuvarlar arası karşılaştırma
