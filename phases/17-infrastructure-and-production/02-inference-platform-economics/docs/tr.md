# Inference Platform Ekonomisi — Havai Fişek, Birlikte, Baseten, Modal, Replika, Her Ölçekte

> 2026 inference pazarı artık GPU zamanı kiralama değil. Özel silikon (Groq, Cerebras, SambaNova), GPU platformları (Baseten, Together, Fireworks, Modal) ve API öncelikli pazarlara (Replicate, DeepInfra) ayrılır. Fireworks, $1/hr per GPU on May 1, 2026, and $4B fiyatını 10T+ token/gün üzerinden artırdı, hacim odaklı modelin çalıştığını gösteriyor. Baseten, $300M Series E at $5B'yi Ocak 2026'da kapattı. Rekabetçi konumlandırma kuralı basittir: Fireworks gecikmeyi optimize eder, Together katalog genişliğini optimize eder, Baseten kurumsal cilayı optimize eder, Modal Python'a özgü DX'i optimize eder, Replicate çok modlu erişimi optimize eder, Anyscale dağıtılmış Python'u optimize eder. Bu ders size bir kurucuya verebileceğiniz bir matris verir.

**Tür:** Öğren
**Diller:** Python (stdlib, çağrı başına oyuncak ekonomisi karşılaştırıcısı)
**Önkoşullar:** Aşama 17 · 01 (Yönetilen LLM Platformları), Aşama 17 · 04 (Motorun Dahili Bileşenlerine Hizmet Verme)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Üç pazar segmentini adlandırın (özel silikon, GPU platformları, öncelikli API) ve her satıcıyı bir segmentle eşleştirin.
- "token başına" API fiyatlandırma modelinin neden donanımın değil, hizmet veren motorun maliyet eğrisine doğru sıkıştığını açıklayın.
- En az üç tedarikçi genelinde istek başına efektif maliyeti hesaplayın ve dakika başına (Baseten, Modal) token başına ne zaman üstün olduğunu açıklayın.
- Belirli bir iş yükü için hangi platformun doğru varsayılan olduğunu belirleyin (sunucusuz patlamalı, istikrarlı yüksek verim, ince ayarlı değişkenler, çok modlu).

## Sorun

Yönetilen hiper ölçekleyici platformlarını değerlendirdiniz. Daha dar kapsamlı, daha hızlı bir sağlayıcıya ihtiyacınız olduğuna karar verdiniz: Gecikme için Fireworks, genişlik için Together, ince ayarlı özel bir model için Baseten. Artık altı gerçek seçeneğiniz var ve fiyatlandırma sayfaları sıralanmıyor. Fireworks $/M tokens; Baseten shows $/dakika'yı gösterir; Modal, $/second; Replicate shows $/tahmini gösterir. İş yükünü modellemeden bunları bire bir karşılaştıramazsınız.

Daha da kötüsü, her fiyatlandırma sayfasının arkasındaki iş modeli farklıdır. Fireworks, paylaşılan GPU'larda kendi özel motorunu (FireAttention) çalıştırır; token başına oran kullanım eğrisini yansıtır. Baseten size Truss + özel GPU'lar sunar; Dakika başına düşen oran ayrıcalığı yansıtır. Modal, gerçek bir Python sunucusuzdur; saniyeden kısa süren soğuk başlatmalarla saniye başına faturalandırma. Aynı çıktı (bir LLM yanıtı), üç farklı maliyet fonksiyonu.

Bu ders altı kişiyi modeller ve her birinin ne zaman kazandığını size söyler.

## Konsept

### Üç bölüm

**Özel silikon** — Groq (LPU), Cerebras (WSE), SambaNova (RDU). Genellikle aynı modeldeki GPU tabanlı kümeye göre 5-10 kat daha hızlı kod çözme. token başına daha yüksek fiyat (Groq, 2025 sonlarında Llama-70B'de ~0,99$/milyon idi) ancak gecikmeye duyarlı kullanım durumları için rakipsizdir. Groq, sesli agent'ler ve gerçek zamanlı çeviri için üretim seçimidir.

**GPU platformları** — Baseten, Together, Fireworks, Modal, Anyscale. NVIDIA'da (2026'da H100, H200, B200) veya bazen AMD'de çalıştırın. "Ham GPU kiralama" (RunPod, Lambda) ve "aşırı ölçekleyici yönetilen hizmet" (Bedrock) arasındaki ekonomik katman.

**API öncelikli pazaryerleri** — Replicate, DeepInfra, OpenRouter, Fal. Geniş katalog, tahmin başına ödeme veya saniye başına ödeme, ilk aramaya kadar geçen süreyi vurgular.

### Fireworks — gecikme süresi optimize edilmiş GPU platformu

- FireAttention motoru (özel); eşdeğer yapılandırmalarda vLLM'den 4 kat daha düşük gecikme süresi olarak pazarlanmaktadır.
- Etkileşimli olmayan iş yükleri için sunucusuz oranın ~%50'sinde toplu katman.
- İnce ayarlı model, temel modelle aynı oranda hizmet verir; LoRA'nız için premium ücret alan sağlayıcılara karşı gerçek bir fark yaratır.
- 2026 ortası: 1 Mayıs 2026'dan itibaren isteğe bağlı GPU kiralama ücreti saatte 1 ABD dolarına çıkarıldı. Toplu fiyatlandırmada belirli ölçekte pazarlık yapılabilir.
- Finansal sinyal: 4 milyar dolarlık değerleme, 10 trilyondan fazla token/gün işlendi.

### Birlikte — kapsamlı olarak optimize edilmiş

- Yukarı akış yayınlandıktan birkaç gün sonra açık kaynak sürümleri de dahil olmak üzere 200'den fazla model.
- Eşdeğer LLM modellerinde Replicate'den %50-70 daha ucuz — "AI Native Cloud" konumlandırması hacim ve katalogdur.
- Inference + fine-tuning + tek API'de eğitim.

### Baseten — kurumsal kullanım için optimize edilmiş

- Truss framework: bağımlılıkları, sırları, hizmet yapılandırmasını tek bildirimde içeren model paketleme.
- GPU aralığı T4'ten B200'e kadardır. Makul soğuk başlatma azaltımıyla dakika başına faturalandırma.
- SOC 2 Tip II, HIPAA'ya hazır. Ortak fintech ve sağlık hizmetleri seçimi.
- CapitalG, IVP, NVIDIA'dan $5B valuation, January 2026 Series E ($300M).

### Modal — Python'da yerel olarak optimize edilmiş

- Saf Python'da kod olarak altyapı. `@modal.function(gpu="A100")` ile bir işlevi dekore edin ve tek komutla dağıtın.
- Saniye başına faturalandırma. Soğuk, ön ısıtmayla 2-4 saniye başlar; Küçük modeller için <1s.
- $87M Series B at $1.1B değerlemesi (2025). Bağımsız anketlerde en güçlü geliştirici deneyimi puanı.

### Çoğalt — çok modlu genişlik

- Tahmin başına ödeme. Görüntü, video ve ses modelleri için varsayılan platform.
- Entegrasyon ekosistemi (Zapier, Vercel, CMS eklentileri).
- token başına LLM oranlarında daha az rekabetçi, ancak multimodal çeşitlilikte kazanıyor.

### Her Ölçek — Ray'e özgü

- Ray üzerine inşa edilmiştir; RayTurbo, Anyscale'in tescilli inference motorudur (vLLM ile rekabet eder).
- inference adımının daha büyük bir grafikteki bir düğüm olduğu dağıtılmış Python iş yükleri için en iyisi.
- Yönetilen Işın kümeleri; Ray AIR ve Ray Serve ile sıkı entegrasyon.

### token başına ve dakika başına karşılaştırması — her birinin kazandığı zaman

Per-token, iş yükünün gecikmeye duyarlı ve çok yoğun olduğu durumlarda mantıklıdır; yalnızca kullandığınız kadar ödersiniz. Kullanımın yüksek ve öngörülebilir olduğu durumlarda dakika başına değer anlamlıdır; GPU'yu doyurduğunuzda token başına geçersiniz.

Kaba kural: Özel bir GPU'nun ~%30'un üzerinde sürekli kullanımı olan iş yükleri için, dakika başına (Baseten, Modal), token'ye (Fireworks, Together) göre daha üstün olmaya başlar. Bunun altında, boşta kalmak için ödeme yapmaktan kaçındığınız için token başına kazanır.

### Özel motor asıl hendektir

vLLM ve SGLang'ın üzerindeki her platform özel bir motora sahiptir. FireAttention, RayTurbo, Baseten'in inference yığını. Özel motor, pazarlamayı gölgede bırakıyor — dürüst çerçeve, vLLM + SGLang'ın açık kaynaklı inference üretiminin yaklaşık %80'ini temsil ettiği ve platform katmanındaki farklılaştırıcıların DX, ilişkilendirme ve SLA'lar olduğu yönündedir.

### Hatırlamanız gereken sayılar

- Fireworks GPU kiralama: 1 Mayıs 2026'dan itibaren saatte 1 ABD doları artış.
- Fireworks'ün iddiası: eşdeğer yapılandırmalarda vLLM'den 4 kat daha düşük gecikme.
- Birlikte: LLM'lerdeki Replicate'den %50-70 daha ucuz.
- Temel değerleme: $5B (Series E, Jan 2026, $300M turu).
- Modal değerleme: 1,1 Milyar Dolar (Seri B, 2025).
- token başına dakika başına atış sayısı ~%30'un üzerinde sürekli kullanım.

```figure
cost-per-token
```

## Kullan onu

`code/main.py`, altı tedarikçiyi sentetik iş yükünde farklı fiyatlandırma modellerinde karşılaştırıyor. $/day and effective $/M token'leri raporlar. token başına ve dakika başına başabaş noktasını bulmak için bunu çalıştırın.

## Gönderin

Bu ders `outputs/skill-inference-platform-picker.md`'yi üretir. İş yükü profili, SLA ve bütçe göz önüne alındığında, birincil inference platformunu seçer ve ikinciyi belirler.

## Egzersizler

1. `code/main.py`'yi çalıştırın. Baseten hangi sürekli kullanımda (dakika başına), bir H100'de 70B modeli için Fireworks'ü (token başına) geride bırakıyor? Çapraz geçişi kendiniz türetin ve temel kuralla karşılaştırın.
2. Ürününüz görüntü oluşturmanın yanı sıra sohbetin yanı sıra konuşmayı metne dönüştürme olanağı da sunuyor. Her modalite için platformlar seçin ve bunları birleştiren ağ geçidi modelini adlandırın.
3. Fireworks, birincil modelinizde fiyatları saatte 1$ artırır. Trafiğinizin %40'ı toplu katmana geçerse (%50 indirim) karma maliyet etkisini modelleyin.
4. Düzenlemelere tabi bir müşteri, SOC 2 Tip II + HIPAA + özel GPU'lara ihtiyaç duyar. Hangi üç platform geçerli ve FinOps'ta hangisi kazanıyor?
5. Fireworks sunucusuz, Birlikte isteğe bağlı, Baseten ayrılmış ve Replicate API'de Llama 3.1 70B için 1.000 tahmin başına maliyeti karşılaştırın. Günde 10 tahminle hangisi en ucuz? 10.000'de mi?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Özel silikon | "GPU olmayan çipler" | Groq LPU, Cerebras WSE, SambaNova RDU — kod çözme için optimize edildi |
| YangınDikkat | "Havai fişek motoru" | Özel dikkat çekirdeği; vLLM'den 4 kat daha düşük gecikmeyle pazarlanıyor |
| Kafes | "Baseten'in formatı" | Model paketleme manifestosu; bağımlılıklar + sırlar + hizmet yapılandırması |
| token başına | "API fiyatlandırması" | Tüketilen token kadar şarj; boşta kalmamak için ödeme yapın |
| Dakika başına | "özel fiyatlandırma" | Duvar saati GPU süresine göre şarj edin; yüksek kullanımda kazanıyor |
| Tahmin başına | "Yinelenen fiyatlandırma" | Model çağrısı başına ücret; görüntü/video için ortak |
| RayTurbo | "Her ölçekteki motor" | Ray'de tescilli inference; Ray kümelerinde vLLM ile rekabet ediyor |
| Toplu katman | "%50 indirim" | İndirimli oranda etkileşimli olmayan kuyruk; Fireworks ve OpenAI'de yaygın |
| Temel ücrete göre ince ayar | "Havai fişek LoRA" | LoRA tarafından sunulan istekleri temel modelin ücreti (farklılaştırıcı) üzerinden ücretlendirin |

## Daha Fazla Okuma

- [Fireworks Fiyatlandırması](https://fireworks.ai/pricing) — token başına ücretler, toplu katman, GPU kiralama.
- [Temel Fiyatlandırma](https://www.baseten.co/pricing/) — dakika başına ücretler, taahhüt edilen kapasite, kurumsal katmanlar.
- [Modal Fiyatlandırma](https://modal.com/pricing) — saniye başına GPU oranları ve ücretsiz katman.
- [Birlikte AI Fiyatlandırması](https://www.together.ai/pricing) — model kataloğu ve token başına ücretler.
- [Her Ölçekte Fiyatlandırma](https://www.anyscale.com/pricing) — RayTurbo ve yönetilen Ray fiyatlandırması.
- [Northflank — Fireworks AI Alternatifleri](https://northflank.com/blog/7-best-fireworks-ai-alternatives-for-inference) — karşılaştırmalı değerlendirme.
- [Infrabase — AI Inference API Sağlayıcıları 2026](https://infrabase.ai/blog/ai-inference-api-providers-compared) — tedarikçi ortamı.
