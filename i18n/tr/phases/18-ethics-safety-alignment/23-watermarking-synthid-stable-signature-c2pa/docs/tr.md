# Su işaretleme  SynthID, Stabil İmza, C2PA

> Üç teknoloji 2026 Yapay zeka tarafından üretilen içeriğin kaynağı olarak yapılandırılmıştır. SynthID (Google DeepMind)  görüntü su işaretleme Ağustos 2023'te başlatıldı, metin + video Mayıs 2024 (Gemini + Veo), metin açık kaynaklı Ekim 2024'te Responsible GenAI Toolkit aracılığıyla, Gemini 3 Pro ile birlikte Kasım 2025'te birleşik çok medya dedektörü. Metin su işaretleme, sonraki belirti örneği seçme olasılığını fark edilemez şekilde ayarlar; görüntü/video su işaretleri sıkıştırma, kesim, filtre, çerçeve hızında değişiklikler hayatta kalır. Stable Signature (Fernandez et al., ICCV 2023, arXiv:2303.15435)  gizli difüzyon dekodörünü ince ayarlar, böylece her çıkış sabit bir mesaj içerir; kesilmiş (içindeki %10) oluşturulan görüntülerin %90'ı FPR<1e-6'da tespit edilmiştir. Ardından "Stabil İmza Durgun" (arXiv:2405.07145, Mayıs 2024)  ince ayarlama, kaliteyi korurken su işaretini çıkarır. C2PA  Kriptografik olarak imzalanan, bozukluktan açık metadata standardı (C2PA 2.2 Açıklama 2025). Su işaretleri ve C2PA tamamlayıcıdır: metadatalar silinebilir ancak daha zengin bir kaynak taşır; su işaretleri transkodlama yoluyla kalır ancak daha az bilgi taşır.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, token-watermark embed + detect)
**Prerequisites:** Phase 10 · 04 (sampling), Phase 01 · 09 (information theory)
**Time:** ~75 minutes

## Öğrenme Hedefleri

- Token seviyesindeki su işaretleme (SynthID-text tarzı) ve tespit edilebilme mekanizmasını açıklayın.
- Stable Signature'i ve 2024'te onu kıran kaldırma saldırısını açıkla.
- Devlet C2PA'nın rolü ve neden su işaretlemesine tamamlayıcıdır.
- Ana sınırlamaları açıklayın: model-sözlü sinyal, parafrase altında sağlamlık ve anlam koruyan saldırılar (arXiv:2508.20228).

## Sorun

2023-2024 yılları arasında derin sahtelik ve AI tarafından üretilen içerik politik ve tüketici bağlamlarına büyük ölçüde girmiştir. Su işaretleme önerilen teknik kaynak sinyalidır: yaratma sırasında nesilleri işaretleyin, onları daha sonra tespit edin. 2025 kanıtı: hiçbir su işaretinin koşulsuz sağlam olmadığı, ancak C2PA metadataları ile katlanmış olan kombinasyon kullanılabilir bir kaynak hikayesi sağlar.

## Anlaşım

### Metin su işaretleme (SynthID-metin tarzı)

Google tarafından üretilen Kirchenbauer et al. 2023 mekanizması:

1. Her dekodlama aşamasında, sözcük kaynağının "yeşil" ve "kırmızı" setlerine pseudorandom bir bölünmesi oluşturmak için önceki K jetonlarını hash edin.
2. Yeşil logitlere δ ekleyerek yeşil kümelere doğru tarafsız örnekleme.
3. Neslin içi, rastlantının ürettiğinden daha fazla yeşil token içerir.

Deteksiyon: her önbellek yeniden yazılsın, nesillerdeki yeşil işaretleri sayılsın, bir z puanı hesaplansın.

Özellikleri:
- Okuyucular için fark edilemez (δ kalitesi kaybı hafif olması için yeterince küçüktür).
- Sözcük bölme fonksiyonuna erişilebilir.
- Parrafraze etmek için sağlam değil  metni yeniden yazmak sinyali yok eder.

SynthID-text, Google'ın Responsible GenAI Araç Kütüfi aracılığıyla Ekim 2024'te açık kaynaklı.

### Kalıcı İmza (resim)

Fernandez et al. ICCV 2023. Latent difüzyon dekodörünü ince ayarlayın, böylece üretilen her görüntü, latent temsiline gömülü sabit ikili bir mesaj içerir. Deteksiyon, nöral dekodörle latentten dekod edilir.

Mayıs 2024 "Stable Signature is Unstable" (arXiv:2405.07145): decoder'in ince ayarlaması, görüntü kalitesini korurken su işaretini çıkarır.

### SynthID teker teker detektörü (Kasım 2025)

Gemini 3 Pro ile birlikte: Tek bir API'de metin, görüntü, ses ve videolardan SynthID sinyallerini okuyabilen bir multimedya dedektörü. Google'ın kaynak yığınını birleştirir.

### C2PA

İçerik Kaynak ve Doğruluk Koalisyonu. Kriptografik olarak imzalanan sahtekarlık kanıtlı metadata standardı. C2PA 2.2 Açıklayıcı (2025). C2PA manifestı, kaynak iddialarını kaydeder (kimler, ne zaman, hangi dönüşümler) yaratıcının anahtarı tarafından imzalanmıştır.

Su işaretlemesine ek olarak:
- Metadatalar silinebilir; su işaretleri (sadece) silinebilir.
- Metadata zengin (tam kaynak zinciri); su işaretleri bit taşıyor.
- C2PA platformun kabul edilmesine bağlıdır; su işaretleri otomatik olarak yerleştirilmiştir.

Google hem Arama, Reklamlar hem de "Bu görüntü hakkında" ile birlikte.

### Sınırlamalar

- **Model-specific.**SynthID'den kaynaklanan bir neslin nesiller. SynthID'den kaynaklanan bir neslin nesiller, SynthID'den kaynaklanan bir neslin nesilleridir.
- **Paraphrase.**Metin su işaretleri anlamı koruyan bir parafrasiyi sağlayamaz.
- **Transformation attacks.**arXiv:2508.20228 (2025) hem metin su işaretlerini hem de birçok görüntü su işaretlerini yok eden anlam koruma saldırıları gösterir.
- **Fine-tune removal.**"Stabil İmza Dursunmaz" için, nesneden sonraki ince ayarlama yerleştirilmiş su işaretlerini kaldırır.

### AB AI Yasası 50 Maddesi

Yapay zeka ile üretilen içerik etiketlemesi için şeffaflık kodu (birinci taslak Aralık 2025, ikinci taslak Mart 2026, beklenen son Haziran 2026'da[European Commission status page](https://digital-strategy.ec.europa.eu/en/policies/code-practice-ai-generated-content)Kode Nisan 2026'dan itibaren taslakta kalır ve zaman çizelgesi değişebilir. Teknik katmanı gerektiren düzenleyici katman. Deepfakes etiketlenmelidir.

### Bu 18 fazaya uygun.

Dersler 22-23 modelin yaydığı (özel veriler, kaynak sinyali) hakkında. Ders 27 eğitim- veri yönetimi kapsamaktadır. Ders 24 bu teknik önlemleri gerektiren düzenleyici çerçeve.

```figure
an-watermark-greenlist
```

## Kullan

`code/main.py`Oyuncak metni bir su işaretini oluşturur. Tokenler tam sayı 0..N-1; su işaretli örnekleme taraftarları, hash tanımlı yeşil kümelere doğru. Bir detektör yeşil token z puanını hesaplar. 1000 token nesillerinde tespit gözlemleyebilir, sinyali yok etmeyi izleyebilir ve insan metni üzerinde yanlış pozitif oranı ölçebilirsiniz.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-provenance-audit.md`. Kaynak iddiası ile içerik dağıtımını göz önünde bulundurarak, su işaretleri mekanizmasını (varsa), C2PA imzalı zincirini (varsa), her birinin karşı karşılıksızlığını ve modalite kapsamını denetlemektedir.

## Egzersizler

1. Çık .`code/main.py`. Su işareti 1000 token üretimi karşılığı insan yazılı metin için z puanları bildirin. 95% güven eşiğinde yanlış pozitif oranı belirleyin.

2. Paraphrase saldırısını uygulayın ve 30%'i eşanımlarla değiştirin.

3. Kirchenbauer et al. 2023 Bölüm 6'da dayanıklılık hakkında okuyun.

4. SynthID-text + C2PA metadatalarını kullanan bir dağıtım tasarlayın. Bir tüketicinin gördüğü kaynak zincirini açıklayın. Her bileşenin bir başarısızlık modunu tanımlayın.

5. 2024 "Stabil İmza Durgun" sonucu, ince ayarlama görüntü su işaretini kaldırır. Bu saldırıyı sınırlayan bir dağıtım kontrolü tasarlayın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| SynthID | "Google's watermark" | Cross-modal provenance signal; text, image, audio, video |
| Token watermark | "Kirchenbauer-style" | Biased-sampling text watermark detectable via green-token z-score |
| Stable Signature | "image watermark" | Fine-tuned-decoder watermark; ICCV 2023 |
| C2PA | "the metadata standard" | Cryptographically signed tamper-evident provenance metadata |
| Paraphrase robustness | "does rewording break it" | Text watermark property; currently limited |
| Fine-tune removal | "adversarial unwatermark" | Attack that removes image watermark via decoder fine-tuning |
| Cross-modal detector | "unified SynthID" | November 2025 unified API across modalities |

## Daha Fazla Okumak

- [Kirchenbauer et al. — A Watermark for Large Language Models (ICML 2023, arXiv:2301.10226)](https://arxiv.org/abs/2301.10226) simge-su işaretleri mekanizması
- [Fernandez et al. — Stable Signature (ICCV 2023, arXiv:2303.15435)](https://arxiv.org/abs/2303.15435) resim su işaretleri kağıdı
- ["Stable Signature is Unstable" (arXiv:2405.07145)](https://arxiv.org/abs/2405.07145) Kaldırma saldırısı
- [Google DeepMind — SynthID](https://deepmind.google/models/synthid/) çapraz modal su işaretleri
- [C2PA 2.2 Explainer (2025)](https://c2pa.org/specifications/specifications/2.2/explainer/Explainer.html) Metadata Standartı
