# LLM Observability Yığın Seçimi

> 2026 observability pazarı iki kategoriye ayrılıyor. Geliştirme platformları (LangSmith, Langfuse, Comet Opik) değerlendirmeleri, prompt yönetimini ve oturum tekrarlarını içeren izlemeyi bir araya getirir. Ağ geçidi/enstrümantasyon araçları (Helicone, SigNoz, OpenLLMetry, Phoenix) telemetriye odaklanır. Langfuse, güçlü OSS dengesine (ayda 50.000 olay ücretsiz bulut) sahip MIT lisanslı bir çekirdektir. Phoenix, Elastic License 2.0 kapsamında OpenTelemetry'de yereldir; kalıcı bir üretim arka ucu değil, sürüklenme/RAG görselleştirmesi için mükemmeldir. Arize AX, monolitik observability'den 100 kat daha ucuz olduğunu iddia eden sıfır kopya Buzdağı/Parke entegrasyonunu kullanıyor. LangSmith, yalnızca Kurumsal'da LangChain/LangGraph için kullanıcı/ay başına 39 ABD doları, kendi kendine barındırılan hizmette lider konumdadır. Helicone, 15-30 dakikalık kurulumla proxy tabanlıdır, 100K istek/ay ücretsizdir, ancak agent izlerinde daha az derinlik vardır. Ortak üretim modeli: OpenTelemetry tarafından yapıştırılmış Ağ Geçidi (Helicone/Portkey) + değerlendirme platformu (Phoenix/TruLens).

**Tür:** Öğren
**Diller:** Python (stdlib, oyuncak izleme örnekleme simülatörü)
**Önkoşullar:** Aşama 17 · 08 (Inference Metrikleri), Aşama 14 (Agent Mühendislik)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- Geliştirme platformlarını (paketlenmiş: değerlendirmeler + prompt'ler + oturumlar) ağ geçidi/telemetri araçlarından (yalnızca izlemeler + ölçümler) ayırın.
- Altı ana aracı (Langfuse, LangSmith, Phoenix, Arize AX, Helicone, Opik) lisanslama, fiyatlandırma ve etkin nokta kullanım durumlarıyla eşleştirin.
- Bir ağ geçidi aracını ayrı bir değerlendirme platformuyla birleştirmenize olanak tanıyan OpenTelemetry-tutkal modelini açıklayın.
- 2026 maliyet farklılaştırıcısını adlandırın (Arize AX'in sıfır kopya yaklaşımı ile yekpare alım karşılaştırması) ve yaklaşık 100x çarpanını belirtin.

## Sorun

Bir LLM özelliği gönderdiniz. İşe yarıyor. prompt hatalarına, araç döngülerine, gecikme gerilemelerine, maliyet artışlarına veya prompt önbellek isabet oranına ilişkin görünürlüğünüz yoktur. Google'da "LLM observability" yazıyorsunuz ve hepsi aynı sorunu üç farklı fiyat noktasında çözdüğünü iddia eden sekiz araç alıyorsunuz.

Aynı sorunu çözmüyorlar. LangSmith "Bu LangGraph çalıştırması neden başarısız oldu?" sorusunu yanıtlıyor. Phoenix şöyle yanıtlıyor: "RAG boru hattım sürükleniyor mu?" Helicone "token'leri hangi uygulama yakıyor?" sorusunu yanıtlıyor. Langfuse, "Her şeyi kendim barındırabilir miyim?" diye yanıtlıyor. Farklı araçlar, farklı hedef kitleler.

Toplama dört eksen içerir: yığın (LangChain? ham SDK? çok satıcılı?), lisans toleransı (yalnızca MIT? Elastic OK? ticari para cezası?), bütçe (ücretsiz katman? $100/mo? $1000/ay?) ve kendi kendine barındırma (olmalı mı? olması güzel mi? asla?).

## Konsept

### İki kategori

**Geliştirme platformları** observability'yi değerlendirmeler, prompt yönetimi, dataset sürüm oluşturma ve oturum tekrarı özellikleriyle bir araya getirir. Deneyler yaparsınız, hangi prompt'nin işe yaradığını görürsünüz, eski kazananlara karşı yeni bir prompt'yi dataset-regresyona tabi tutarsınız. LangSmith, Langfuse, Opik Kuyruklu Yıldızı.

**Ağ geçidi/telemetri araçları** enstrüman inference çağrıları — prompt, yanıt, token'ler, gecikme, model, maliyet. Helicone, SigNoz, OpenLLMetry, Phoenix. Minimalist. OpenTelemetry aracılığıyla ayrı bir değerlendirme aracıyla birleştirilebilir.

### Langfuse — OSS dengesi

- Çekirdek Apache / MIT lisanslı; Docker aracılığıyla kendi kendine barındırma.
- Bulut ücretsiz kullanımı: Ayda 50.000 etkinlik. Ödenen: Takım için ayda 29$.
- Değerlendirmeler, prompt yönetimi, izlemeler, dataset'ler. Dört geliştirme platformu özelliğinin tamamının makul kapsamı.
- Avantajlı nokta: LangSmith sınıfı özellikler istiyorsunuz ancak kendi kendine barındırmanız veya OSS lisansında kalmanız gerekiyor.

### Phoenix (Arize) — telemetride ilk, OpenTelemetry'de yerel

- Esnek Lisans 2.0; kendi kendine barındırma önemsiz.
- RAG ve sürüklenme görselleştirmesinde mükemmeldir. Embedding-uzay dağılım grafikleri birinci sınıf olarak gönderilir.
- Kalıcı üretim arka ucu olarak tasarlanmamıştır; öncelikli olarak geliştirme zamanı observability.
- Avantajlı nokta: RAG boru hattı geliştirme, sürüklenme hata ayıklaması, üretim için ayrı bir ağ geçidiyle eşleşme.

### Arize AX — ölçek oyunu

- Ticari. Iceberg/Parquet aracılığıyla sıfır kopyalı veri gölü entegrasyonu.
- Monolitik observability'den (Datadog sınıfı) ölçekte ~100 kat daha ucuz olduğu iddia ediliyor. Matematik: izleri S3'teki kendi Parkenizde saklarsınız; Arize doğrudan okur.
- Avantajlı nokta: >10 milyon iz/gün, mevcut veri gölü, Datadog fiyatlandırması olmayan LLM'ye özel kontrol panelleri istiyor.

### LangSmith — Önce LangChain/LangGraph

- Ticari, 39$/kullanıcı/ay. Yalnızca Enterprise'da kendi kendine barındırma.
- LangChain ve LangGraph yığınları için sınıfının en iyisi. Her ikisinde de değilseniz, daha az zorlayıcıdır.
- Avantajlı nokta: LangChain'e bağlı, ödemeye hazır ekip.

### Helicone — proxy tabanlı minimum uygulanabilirlik

- `OPENAI_API_BASE`'nizi Helicone proxy'ye değiştirerek 15-30 dakikalık kurulum.
- MIT lisanslı; 100.000 talep/ay ücretsiz, 20$/ay+ ödenir.
- Yük devretme, önbelleğe alma ve hız sınırlarını içerir; aynı zamanda bir ağ geçidi görevi de görür.
- agent/çok adımlı izlerde daha az derinlik.
- Faydalı nokta: hızlı başlangıç, tek yığınlı uygulama, ağ geçidi + observability'nin bir arada olması gerekir.

### Opik (Comet) — OSS geliştirme platformu

- Apache 2.0, tamamen OSS.
- Benzer özellik Comet mirasıyla Langfuse'a ayarlandı.
- Güzel nokta: ML ekipleri zaten Comet'te, LLM observability'nin aynı bölmede olmasını istiyor.

### SigNoz — OpenTelemetry'nin ilk tam APM'si

-Apache 2.0. OpenTelemetry aracılığıyla genel APM ve LLM'yi yönetir.
- Avantajlı nokta: hizmetler ve LLM çağrıları genelinde birleştirilmiş observability.

### Birleştirici: OpenTelemetry + GenAI anlam kuralları

OpenTelemetry, 2025'in sonlarında GenAI semantik kurallarını yayınladı (`gen_ai.system`, `gen_ai.request.model`, `gen_ai.usage.input_tokens`). OTel'i tüketen araçlar birlikte çalışabilir. Ortaya çıkan üretim modeli:

1. Her LLM çağrısından GenAI konvansiyonlarıyla OTel'i yayınlayın.
2. Günlük kullanım için ağ geçidine (Helicone / Portkey) yönlendirin.
3. Regresyonlar için değerlendirme platformuna (Phoenix / Langfuse) ikili gönderim.
4. Arize AX veya DuckDB aracılığıyla uzun vadeli analiz için veri gölünde (Buzdağı) arşivleyin.

### Tuzak: yanlış katmanda enstrümantasyon

agent framework (e.g., LangSmith izlerini ekleyerek) içindeki enstrümanlar sizi bu framework ile eşleştirir. HTTP/OpenAI-SDK katmanındaki araçlar (OpenLLMetry veya ağ geçidiniz aracılığıyla) taşınabilirdir.

### Örnekleme — her şeyi saklayamazsınız

Günde 1 milyondan fazla istek olduğunda, tam izlemeyi elde tutmanın maliyeti LLM çağrılarından daha fazladır. Kurallara göre örnekleme: %100 hata, %100 yüksek maliyet, %5 başarı. Agregaları her zaman saklayın; uzun kuyruk için ham tutun.

### Hatırlamanız gereken sayılar

- Langfuse ücretsiz bulut: ayda 50.000 etkinlik.
- LangSmith: 39$/kullanıcı/ay.
- Helicone içermez: 100.000 talep/ay.
- Arize AX iddiası: ölçekte monolitikten ~100 kat daha ucuz.
- OpenTelemetry GenAI sözleşmeleri: 2025 nakliye, 2026 yaygın olarak benimsenmiştir.

## Kullan onu

`code/main.py`, elde tutma stratejileri (%100 alım, örnekleme, örnekleme + hatalar) genelinde 1 milyon izleme gününü simüle eder. Depolama maliyetini ve her birinin altında nelerin kaybolduğunu raporlar.

## Gönderin

Bu ders `outputs/skill-observability-stack.md`'yi üretir. Yığın, ölçek, bütçe, lisans durumu göz önüne alındığında araç(lar)ı seçer.

## Egzersizler

1. LangChain'deki ekibiniz OSS'nin kendi kendine barındırılan observability'yi istiyor. Langfuse veya Opik'i seçin ve gerekçelendirin.
2. Datadog'un ayda 150.000$ fiyat teklifiyle günde 5 milyon iz ile Arize AX için başabaş noktasını hesaplayın.
3. Her LLM çağrısında kuruluşunuzun yönergesini zorunlu kılacak bir OpenTelemetry GenAI özniteliği tasarlayın.
4. Phoenix'in üretim için tek başına yeterli olup olmadığını tartışın. Ne zaman yeterli olmaz?
5. Helicone 20ms proxy ek yüküdür. P99 TTFT 300 ms'de bu kabul edilebilir mi? SLA 100 ms ise ne olur?

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| OpenLLMetry | "LLM'ler için OTEL" | Yüksek Lisans'lar için açık kaynaklı OpenTelemetry enstrümantasyonu |
| GenAI sözleşmeleri | "OTel özellikleri" | Yüksek Lisans çağrıları için standart OTel özellik adları |
| LangSmith | "LangChain observability" | LangChain ekosistemiyle birlikte gelen ticari platform |
| Langfuse | "OSS LangSmith" | Benzer özelliklere sahip MIT OSS |
| Phoenix | "Arize geliştirme aracı" | OpenTelemetry-yerel geliştirme/değerlendirme platformu |
| Arize AX | "ölçek observability" | Ticari sıfır kopya Buzdağı/Parke observability |
| Helikon | "proxy observability" | Yüksek Lisans telemetrisi + ağ geçidi özelliklerini toplayan HTTP proxy |
| Opik | "Kuyrukluyıldız Yüksek Lisans" | Comet'ten Apache 2.0 OSS geliştirme platformu |
| Oturum tekrarı | "izleme yeniden çalıştırma" | Araç çağrılarıyla tam bir agent oturumunu yeniden oynatın |
| Değerlendirme | "çevrimdışı test" | Aday modeli/prompt, dataset etiketli üzerinde çalıştırılıyor |

## Daha Fazla Okuma

- [SigNoz — En İyi LLM Observability Araçları 2026](https://signoz.io/comparisons/llm-observability-tools/)
- [Langfuse — Arize AX Alternatif analizi](https://langfuse.com/faq/all/best-phoenix-arize-alternatives)
- [PremAI — Langfuse, LangSmith, Helicone, Phoenix'i Ayarlama](https://blog.premai.io/llm-observability-setting-up-langfuse-langsmith-helicone-phoenix/)
- [OpenTelemetry GenAI Anlamsal Kuralları](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
- [Arize Phoenix belgeleri](https://docs.arize.com/phoenix)
- [Helicone belgeleri](https://docs.helicone.ai/)
