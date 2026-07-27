# Bitirme Taşı 11 — Yüksek Lisans Observability ve Değerlendirme Kontrol Paneli

> Langfuse açık çekirdeğe geçti. Arize Phoenix, 2026 GenAI semconv eşlemelerini yayınladı. Helicone ve Braintrust, kullanıcı başına maliyet ilişkilendirmesinde iki katına çıktı. Traceloop'un OpenLLMetry'si fiili SDK enstrümantasyonu haline geldi. Üretim şekli, izlemeler için ClickHouse, meta veriler için Postgres, kullanıcı arayüzü için Next.js ve örneklenmiş izlemeler üzerinde çalışan küçük bir değerlendirme işleri ordusudur (DeepEval, RAGAS, LLM-judge). Kendi kendine barındırılan bir tane oluşturun, en az dört SDK ailesinden yararlanın ve beş dakikadan kısa bir sürede enjekte edilen bir regresyonun yakalandığını gösterin.

**Tür:** Kapak taşı
**Diller:** TypeScript (UI), Python / TypeScript (alım + değerlendirmeler), SQL (ClickHouse)
**Önkoşullar:** Aşama 11 (LLM mühendislik), Aşama 13 (araçlar), Aşama 17 (altyapı), Aşama 18 (güvenlik)
**Uygulanan aşamalar:** P11 · P13 · P17 · P18
**Süre:** 25 saat

## Sorun

2026'da üretim trafiğini yürüten her AI ekibi, modelin yanında bir observability uçağı bulunduruyor. Maliyet ilişkilendirmesi. Halüsinasyon tespiti. Drift izleme. Jailbreak sinyali. SLO kontrol panelleri. PII sızıntı uyarıları. Açık kaynak referansları (Langfuse, Phoenix, OpenLLMetry) alım şeması olarak OpenTelemetry GenAI semantik kurallarında birleşti. Artık OpenAI, Anthropic, Google, LangChain, LlamaIndex ve vLLM'yi tek bir SDK ile kullanabilir ve uyumlu kapsamlar gönderebilirsiniz.

En az dört SDK ailesinden beslenen, örneklenmiş izler üzerinde küçük bir değerlendirme işleri kümesi çalıştıran, sapmaları ve uyarıları algılayan, kendi kendine barındırılan bir kontrol paneli oluşturacaksınız. Ölçüm çubuğu: Kasıtlı olarak enjekte edilen bir regresyon (PII üretmeye başlayan bir prompt) verildiğinde, kontrol paneli onu yakalar ve beş dakikadan kısa bir sürede bir uyarı başlatır.

## Konsept

Alım OTLP HTTP'dir. SDK, GenAI-semconv yayılma alanlarını üretir: `gen_ai.system`, `gen_ai.request.model`, `gen_ai.usage.input_tokens`, `gen_ai.response.id`, `llm.prompts`, `llm.completions`. Span'lar sütunlu analizler için ClickHouse'a gelir; meta veriler (kullanıcılar, oturumlar, uygulamalar) Postgres'e gelir.

Değerlendirmeler, örneklenmiş izler üzerinde toplu işler olarak çalıştırılır. DeepEval sadakati, zehirliliği ve yanıtların uygunluğunu puanlar. RAGAS, izlemenin alma bağlamını taşıdığı durumlarda alma metriklerini puanlar. Özel Yüksek Lisans jürileri, alana özel kontroller (PII sızıntısı, politika dışı yanıt) yürütür. Eval çalıştırmaları, üst izlemeyle bağlantılı değerlendirme yayılmalarıyla aynı ClickHouse'a geri yazma yapar.

Sürüklenme tespiti, zaman içindeki embedding-uzay dağılımlarını (prompt embedding'lerdeki PSI veya KL sapması) artı değerlendirme puanı eğilimlerini izler. Uyarılar Prometheus Alertmanager'ı ve ardından Slack / PagerDuty'yi besler. Kullanıcı Arayüzü Yeniden Grafikler ile Next.js 15'tir.

## Mimarlık

```
production apps:
  OpenAI SDK  +  Anthropic SDK  +  Google GenAI SDK
  LangChain + LlamaIndex + vLLM
       |
       v
  OpenTelemetry SDK with GenAI semconv
       |
       v  OTLP HTTP
  collector (ingest, sample, fan-out)
       |
       +-------------+-----------+
       v             v           v
   ClickHouse    Postgres    S3 archive
   (spans)       (metadata)  (raw events)
       |
       +---> eval jobs (DeepEval, RAGAS, LLM-judge)
       |     sampled or all-trace
       |     write eval spans back
       |
       +---> drift detector (PSI / KL on prompt embeddings)
       |
       +---> Prometheus metrics -> Alertmanager -> Slack / PagerDuty
       |
       v
   Next.js 15 dashboard (Recharts)
```

## Yığın

- Alma: OpenTelemetry SDK'ları + GenAI anlam kuralları; OTLP HTTP aktarımı
- Toplayıcı: Kuyruk örnekleme işlemcili OpenTelemetry Toplayıcı (maliyet kontrolü için)
- Depolama: Aralıklar için ClickHouse, meta veriler için Postgres, ham olay arşivi için S3
- Değerlendirmeler: DeepEval, RAGAS 0.2, Arize Phoenix değerlendirici paketi, özel Yüksek Lisans jürisi
- Drift: haftalık olarak havuzlanmış prompt embeddings (sentence-transformers) üzerinde PSI / KL
- Uyarı: Prometheus Alertmanager -> Slack / PagerDuty
- Kullanıcı Arayüzü: Next.js 15 Uygulama Yönlendiricisi + Yeniden Grafikler + sunucu eylemleri
- Kutudan çıktığı anda desteklenen SDK'lar: OpenAI, Anthropic, Google GenAI, LangChain, LlamaIndex, vLLM

## Build It — Kendin Geliştir

1. **Collector yapılandırması** OTLP HTTP alıcısına sahip OpenTelemetry Collector, hatalı izlerin %100'ünü ve başarıların %10'unu tutan bir kuyruk örnekleyici ve ClickHouse ve S3'e aktarıcılar.

2. **ClickHouse şeması.** GenAI semconv'u yansıtan sütunlara sahip tablo `spans` : `gen_ai_system`, `gen_ai_request_model`, `input_tokens`, `output_tokens`, `latency_ms`, `prompt_hash`, `trace_id`, `parent_span_id` ve ayrıca uzun yükler için JSON çantası. user_id ve app_id'ye göre ikincil dizinler ekleyin.

3. **SDK kapsam testi.** OpenLLMetry otomatik aracıyla her SDK'yı (OpenAI, Anthropic, Google, LangChain, LlamaIndex, vLLM) kullanarak küçük bir istemci uygulaması yazın. Her birinin ClickHouse'a ulaşan kanonik GenAI kapsamları ürettiğini doğrulayın.

4. **İşleri değerlendir.** Zamanlanmış bir iş, son 15 dakikada örneklenen izleri okur ve DeepEval doğruluğunu, zehirliliğini ve yanıt alaka düzeyini çalıştırır. Çıkışlar, üst izlemeye bağlı değerlendirme aralıklarıdır.

5. **Özel LLM hakemi.** Kişisel Bilgi Sızıntısı yargıcı: Yanıt verildiğinde, PII sızıntısı olasılığını puanlamak için bir koruma Yüksek Lisans Diplomasını çağırın. Yüksek puanlı yanıtlar triyaj kuyruğuna girer.

6. **Sürüklenme tespiti.** Haftalık iş, bu haftanın havuzlanmış prompt embedding'leri ile takip eden 4 haftalık taban çizgisi arasındaki PSI'yı hesaplar. PSI eşiğin üzerindeyse uyarı verin.

7. **Kontrol Paneli.** Next.js 15 sayfa: genel bakış (aralık/sn, maliyet/kullanıcı, p95 gecikmesi), izler (arama + şelale), değerlendirmeler (sadıklık eğilimi, zehirlilik), sapma (zaman içinde PSI), uyarılar.

8. **Uyarı zinciri.** Prometheus ihracatçısı değerlendirme puanı toplamlarını ve gecikme yüzdelik dilimlerini okur; Alertmanager, uyarılar için Slack'e, kritik ihlaller için ise PagerDuty'ye yönlendirilir.

9. **Regresyon araştırması.** Bir hata enjekte edin: değerlendirilen sohbet robotu, %1 oranında sahte SSN'leri sızdırmaya başlar. MTTR'yi ölçün: dağıtılan hatadan Slack uyarısına kadar.

## Use It — Hazır Araçla Uygula

```
$ curl -X POST https://my-otel-collector/v1/traces -d @trace.json
[collector]  accepted 1 trace, 3 spans
[clickhouse] inserted 3 spans (app=chat, user=u_42)
[eval]       DeepEval faithfulness 0.82, toxicity 0.03
[drift]      weekly PSI 0.08 (below 0.2 threshold)
[ui]         live at https://obs.example.com
```

## Ship It — Kullanıma Sun

`outputs/skill-llm-observability.md` teslim edilebilirdir. Bir LLM uygulaması göz önüne alındığında, kontrol paneli onun izlerini alır, değerlendirmeleri çalıştırır, sürüklenmeyle ilgili uyarılar verir ve Next.js'de maliyet/kullanıcı dökümünü ortaya çıkarır.

| Ağırlık | Kriter | Nasıl ölçülür |
|:-:|---|---|
| 25 | İzleme şeması kapsamı | Kurallı GenAI yayılmaları üreten SDK ailelerinin sayısı (hedef: 6+) |
| 20 | Doğruluğu değerlendirin | DeepEval / RAGAS puanları elle etiketlenmiş sete karşı |
| 20 | Kontrol Paneli Kullanıcı Deneyimi | Enjekte edilmiş regresyonda MTTR (5 dakikalık hedefin altında) |
| 20 | Maliyet / ölçek | Birikme olmadan saniyede 1.000 aralıkla sürekli alım |
| 15 | Uyarı + sürüklenme tespiti | Prometheus/Alertmanager zinciri uçtan uca uygulandı |
| **100** | | |

## Egzersizler

1. Saman Yığını framework için özel enstrümantasyon ekleyin. Kanonik yayılmaların ClickHouse'a sadık `gen_ai.*` nitelikleriyle ulaştığını doğrulayın.

2. DeepEval'i Phoenix değerlendiricileri için aynı izler üzerinde değiştirin. İki değerlendirme motoru arasındaki puan kaymasını ölçün.

3. Sürüklenme dedektörünü keskinleştirin: PSI'yı genel olarak hesaplamak yerine uygulama kimliği başına hesaplayın. Uygulama başına sürüklenme yollarını gösterin.

4. Bir "kullanıcı etkisi" sayfası ekleyin: mini grafiklerle kullanıcı başına maliyet ve kullanıcı başına başarısızlık oranı.

5. Toksisite > 0,5 olan izlerin %100'ünü artı geri kalanın %10'luk tabakalı örneğini tutan bir kuyruk örnekleme politikası oluşturun. Örnekleme önyargısının ölçülmesi.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|------------------------|
| GenAI semconv | "OTel LLM nitelikleri" | Yüksek Lisans yayılma nitelikleri için 2025 OpenTelemetry spesifikasyonu (sistem, model, token'lar) |
| Kuyruk örneklemesi | "İzleme sonrası örnek" | Toplayıcı, bir izi tamamlandıktan sonra tutmaya veya bırakmaya karar verir (hatalara göz atabilir) |
| PSI | "Nüfus istikrar endeksi" | İki dağılımı karşılaştıran sürüklenme metriği; > 0,2 tipik olarak anlamlı bir sapmaya işaret eder |
| Yüksek Lisans Hakimi | "Model olarak değerlendirin" | Bir LLM'nin başka bir LLM'nin çıktısını bir değerlendirme tablosuna göre puanlaması (sadıklık, zehirlilik, PII) |
| Kuyruk örnekleme politikası | "Kuralını koru" | Hangi izlerin devam edeceğine veya düşeceğine karar veren kural; hatalı + örnekleme oranı |
| Değerlendirme açıklığı | "Bağlantılı değerlendirme izleme" | Orijinal LLM çağrı aralığına bağlı bir değerlendirme puanı taşıyan çocuk aralığı |
| Kullanıcı başına maliyet | "Birim Ekonomisi" | Bir pencere üzerinden user_id ile ilişkilendirilen dolar maliyeti; temel ürün metriği |

## Daha Fazla Okuma

- [Langfuse](https://github.com/langfuse/langfuse) — referans açık çekirdekli observability platformu
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) — güçlü drift desteğine sahip alternatif referans
- [OpenLLMetry (Traceloop)](https://github.com/traceloop/openllmetry) — otomatik enstrümantasyon SDK ailesi
- [OpenTelemetry GenAI anlam kuralları](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — alma şeması
- [Helicone](https://www.helicone.ai) — alternatif barındırılan observability
- [Braintrust](https://www.braintrust.dev) — alternatif değerlendirme öncelikli platform
- [ClickHouse belgeleri](https://clickhouse.com/docs) — sütunlu yayılma deposu
- [DeepEval](https://github.com/confident-ai/deepeval) — değerlendirici kitaplığı
