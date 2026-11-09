# İki kullanım riski  Siber, Biyolojik, Kimya, Nükleer Geliştirme

> 2026 çift kullanımlı resmi, alanı alanı. Bio/kimya: Ders 17 WMDP'yi kapsar; Anthropic'in biyolojik silah edinme denemesi (2.53x yükseltme) ve OpenAI'nin Nisan 2025 Hazırlık Çerçevi v2 uyarısı ("Önce öğrencilere bilinen biyolojik tehditleri yaratmaya anlamlı bir şekilde yardımcı olmak üzere") dönüm noktasını işaretler. Siber (Kasım 2025 Anthropic raporu): Çin'le bağlantılı devlet aktörleri, insan müdahalesi ile yalnızca 4-6 adımda, siber saldırı kampanyasının %90'ına kadar otomatikleştirmek için Claude'un ajanlık kodlama aracından yararlandı. OpenAI "güvenilir erişim" pilot, kontrol edilmiş güvenlik kuruluşlarına savunma ikili kullanımlı çalışmalar için yetenek erişimini sağlar. Kimya/bio yürütme boşluğu erozyonu: klasik savunma "belirli bilgi erişimi yetersiz". Görüşe bağlı sınır modelleri (GPT-5.2, Gemini 3 Pro, Claude Opus 4.5, Grok 4.1) ıslak laboratuvar videosu gözlemleyebilir ve gerçek zamanlı düzeltme sağlayabilir. Aralık 2025: OpenAI, GPT-5'in ıslak laboratuvar deneylerinde tekrarlanmasını gösterdi ve AI yönlendirilmiş protokol optimizasyonu yoluyla 79 kat daha fazla verimlilik elde etti. Yeni başlayan ve uzman örneği: Yapay zeka yeni başlayanlara daha büyük nispeten yükseltme sağlar, ancak uzmanlara daha büyük mutlak kapasite sağlar.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 18 · 17 (WMDP), Phase 18 · 18 (safety frameworks), Phase 18 · 28 (ecosystem)
**Time:** ~75 minutes

## Öğrenme Hedefleri

- 2024-2025 biyolojik yükseltme anlatımını açıklayın: " hafif yükseltme " -> " küpede " -> " ASL-3'yi dışlamak için yeterli olmayan 2,53x yükseltme "
- Kasım 2025'te Antropic Siber Raporu'nu tanımlayın: Siber saldırı kampanyasının %90'ına kadar Çin bağlantılı otomasyon.
- Kimyasal/biyo yürütme boşluğu erozyonu tanımlayın: rüya laboratuvar deneylerinin görme yeteneğiyle gerçek zamanlı düzeltmesi.
- Yeni başlayan ve uzman arasındaki mutlak asimetri ve güvenlik durumunun yapımı için etkisi.

## Sorun

Ders 17 ölçüm metodolojisi. Ders 30 ölçümlerin 2026 durumu. 2024 ile 2025 yılının sonları arasında tablo önemli ölçüde değişti: dört alanın üçü 2024 çerçevelerinin öngörmediği bir eşiği geçti.

## Anlaşım

### Biyo-kimyasal yükseltme anlatısı

Üç aşama (tumuşaklık için 17. dersden tekrarlanır):

1. **2024 "mild uplift."**Erken Hazırlık/RSP değerlendirmeleri, internet aramalarına göre küçük yeni başlayan avantajları bildirmiştir.
2. **April 2025 "on the cusp."**OpenAI PF v2 modellerinin "biolojik tehditler yaratmak için yeni başlayanlara anlamlı bir şekilde yardımcı olma eğiliminde" olduğunu uyarmıştı.
3. **2025 Anthropic bioweapon-acquisition trial.**Kontrollü yeni başlayan çalışma; edinme aşamasındaki görevlerde 2,53 kat artış; ASL-3'yi reddetmek için yeterli değil.

Değişim kaliteli: "mükemmel" on sekiz ay içinde, yetenek açısından bir atılım olmadan bile "içerkin" hale dönüştü.

### Kimyasal/biyo uygulama boşluğu erozyonu

Tarihi savunma: bilgi gerekli ama yeterli değildir; protokolü gerçekleştirme becerisi yeni başlayanları engeller. 2025 vizyonlu sınır modelleri bu savunmayı kısmen kırır:

- **Real-time protocol correction.**GPT-5.2, Gemini 3 Pro, Claude Opus 4.5, Grok 4.1, test sırasında video ve işaret hatalarını gözlemleyebilir.
- **December 2025 OpenAI demonstration.**GPT-5 ıslak laboratuvar deneylerinde tekrarlanan protokol optimizasyonu yoluyla 79 kat daha fazla verimlilik kazanır.

Sonuç: savunma becerileri eksikliği, tedarik ve ekipman boşlukları var, ama gizli bilgi boşluğu azalıyor.

### Siber yükseltme (Kasım 2025)

Anthropic'in Kasım 2025 raporunda: Çin'le bağlantılı devlet aktörleri, Claude'un ajanistik kodlama aracıyla siber saldırı kampanyasının %80-90'ını otomatikleştirdi.

Etkileri:
- Ajantik kodlama saldırı otomasyonu ilkeleridir. Önceki AI siber yardımı kod parçaları düzeyinde sınırlıydı; ajantik iş akışları keşif, sömürü, sömürü sonrası ve sömürü içermektedir.
- 4-6 insan adımları boğazın boğazıdır; gelecekteki kapasite kazanımları bu sayıyı azaltacaktır.
- Savunma ikili kullanımı: OpenAI'nin "güvenilir erişim" pilot sistemi, kontrol edilmiş güvenlik kuruluşlarına (tasarımlı olay tepkisi firmaları, hükümet) savunma için kapasite erişimi sağlar.

Bu çalışmanın savunma tarafı, oluşturulan kodun okunması ile başlar. 13'inci aşamada geri mühendislik yolu, sadece statik analizle kendi yapmanızı sağlayan programlarda öğretir:[Lesson 13.32](../../../13-tools-and-protocols/32-program-anatomy-elf-from-scratch/docs/en.md), [Lesson 13.33](../../../13-tools-and-protocols/33-disassembly-and-control-flow/docs/en.md), pseudokod olarak kaldırıldı [Lesson 13.34](../../../13-tools-and-protocols/34-lifting-to-pseudocode/docs/en.md), ve gözlemlenen gerçekleri , bir delil defterinde ,[Lesson 13.35](../../../13-tools-and-protocols/35-evidence-confidence-and-unknowns/docs/en.md)- Ne ?[Inside a Decompiler](https://aiengineeringfromscratch.com/inside-a-decompiler)Bu işi yapan bir ajan aynı başlıklara ihtiyaç duyar çünkü güvenli bir parçalanma hala bir tahmin üzerine dayanır.

### Nükleer

CBRN'in dört alanından en az analiz edilen kamu belgesinde. Tehdit modeli farklıdır: parçalanma malzemelerinin edinilmesi zorluğu, bilgi üzerinde değil. Bilgi katmanındaki AI yükseltmesi pratikte sınırlı yeni başlayanları yükseltir. 2024-2025 büyük laboratuvar raporunda nükleer özel bir eşiğin geçtiği belirlenir.

### Yeni başlayan ve uzmanlık alanı

Dört alanın da bir örneği:

- **Novice-relative uplift.**Yüksek, katılaştırıcı, Antropik 2025 biyografisi başına 2,53x.
- **Expert-absolute capability.**Bir uzman yeni başlayanlardan daha fazlasını çıkarır çünkü uzman ne sormayı ve nasıl yorumlamayı bilir.

Güvenlik vakaları için etkisi: Tek başlayanların yükseltilmesi (gönüllü filtreler, reddedilme, belirsizlik yoluyla) uzman-kesin kontrol için yetersiz.

### Bölge çapındaki sentez

| Domain | 2024 | 2025 | Inflection |
|---|---|---|---|
| Bio | mild uplift | 2.53x uplift, ASL-3 approach | acquisition-phase automation |
| Chem | mild uplift | execution-gap erosion via vision | real-time wet-lab correction |
| Cyber | code assistance | 80-90% campaign automation | agentic coding |
| Nuclear | limited | limited | material-access bottleneck holds |

Üç alan eşiği geçti. Birinde bilgi dışı engeller var.

### Bu 18 fazaya uygun.

Ders 30 baş taşıdır: her önceki dersin ölçüm, sınırlama veya yönetme için katkıda bulunduğu mevcut çift kullanım resmi. Ders 17-18 ölçüm ve çerçeveyi verir; Ders 12-16 değerlendirme araçlarını verir; Ders 24-25 düzenleyici ve açıklama katmanını verir; Ders 28 araştırma ekosistemini verir. Ders 30 kanıtların yer aldığı yerdir.

```figure
an-uplift-asymmetry
```

## Kullan

Antropic Kasım 2025 siber raporunu, OpenAI'nin Hazırlık Çerçevi v2 Nisan 2025 güncelleştirmesini ve 2025 Stratejik Riskler Konseyi AI x Bio sonucunu okuyun.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-dual-use-triage.md`. 2026 kapasite iddiası veya olay raporunu göz önüne alarak, dört alan arasında ayrıntılar yaparak iddiaların yeni başlayanlara ilişkin yükseltme, uzman-mükemmel kapasite veya her ikisini de etkileyip etkilemediğini belirler.

## Egzersizler

1. Anthropic'in Kasım 2025 siber raporunu okuyun. İnsan müdahalelerinin 4-6 adımını sıralayın ve bir sonraki nesil modelinde ilk otomatik olarak hangisi olacağını tartışın.

2. Kimya/biyo uygulanma boşluğu görsel olarak azalıyor. ITAR/EAR sınırlarını geçmeden sessiz bilgi yükseltmesini ölçen bir değerlendirme tasarlayın.

3. Nükleer yükseltme, maddi erişimle sınırlı görünüyor. Gelecekteki bir AI atılımının bu boğaz boğazını değiştirebileceği görüşünü savunuyor ve karşıda.

4. Yeni başlayanların ve uzmanların yükseltmesini sınırlayan bir siber yeteneği olan bir sınır modeli için bir güvenlik kazası (Lection 18 üç direk) oluşturun.

5. Dört alandan birini seçin ve 2024-2025 yörüngesine dayanan bir paragraflı 2027 tahminini yazın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Uplift | "AI helps attackers" | Increase in attacker capability attributable to AI assistance |
| Novice-relative uplift | "multiplicative" | How much AI helps a novice vs status-quo |
| Expert-absolute capability | "ceiling" | Maximum capability an expert can extract from the model |
| Execution gap | "doing vs knowing" | Historical defense: tacit wet-lab skill blocks novices |
| Agentic coding | "autonomous attacks" | Multi-step autonomous cyber-task execution |
| Acquisition phase | "pre-synthesis steps" | Procurement, equipment, permit stages of a bio threat |
| Trusted access | "defender-only pilot" | OpenAI 2025 program giving vetted defenders capability access |

## Daha Fazla Okumak

- [Anthropic — November 2025 cyber threat report](https://www.anthropic.com/news/disrupting-AI-espionage) Çin'le bağlantılı kampanya otomasyonu
- [OpenAI — Preparedness Framework v2 (April 15, 2025)](https://openai.com/index/updating-our-preparedness-framework/) "Köşe" biyografisi
- [Anthropic — RSP v3.0 (February 2026)](https://www.anthropic.com/responsible-scaling-policy) ASL-3 biyolojik eşiği
- [Council on Strategic Risks — 2025 AI x Bio wrapup](https://councilonstrategicrisks.org/2025/12/22/2025-aixbio-wrapped-a-year-in-review-and-projections-for-2026/) Yıl sonu sentezi
