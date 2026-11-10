# OpenTelemetry GenAI  İzleme Aracı Sonundan Sonuna Çağrılar

> Bir ajan beş alet, üç MCP sunucusu ve iki alt ajanı çağırıyor. Hepsinin üzerinde bir iz gerektirir. OpenTelemetry GenAI semantik sözleşmeleri (v1.37 ve daha üstteki sabit özelliği) 2026 standardıdır, Doğal olarak Datadog, Langfuse, Arize Phoenix, OpenLLMetry ve AgentOps tarafından desteklenir. Bu ders, gerekli özellikleri isimlendirir, uzantı hiyerarşisini yürütür (astı → LLM → araç) ve herhangi bir OTel ihracatçısına bağlayabileceğiniz stdlib uzantı emiten bir cihaz gönderir.

**Type:** Build
**Languages:** Python (stdlib, OTel span emitter), TypeScript
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 08 (MCP client)
**Time:** ~75 minutes

## Öğrenme Hedefleri

- LLM süresi ve araç-öğretim süresi için gerekli OTel GenAI özelliklerini belirtin.
- Ajan döngüsünü, LLM çağrısını, araç çağrısını ve MCP istemcisinin gönderimini kapsayan bir iz hiyerarşisi oluşturun.
- Hangi içeriği yakalamak için karar verin (opt-in) vs. redakt (devalt).
- Araç kodunu yeniden yazmadan, yerel bir koleksiyoncuya (Jaeger, Langfuse) yayımlayın.

## Sorun

Şubat 2026'dan bir hata: kullanıcı raporları "Ajanım bazen 30 saniye alır cevap vermek için; diğer zamanlarda 3 saniye". İzlenmez. Günlükler LLM çağrısını gösterir, ancak araç gönderme, MCP sunucusu geri dönüş değil, alt-astı değil. Tahmin ediyorsunuz. Sonunda bulursunuz: bir MCP sunucusu bazen soğuk başlangıçta asılıdır.

Sonundan sonuna kadar izleme olmadan bunu bulamıyorsunuz.

Bu konvansiyonlar, OpenTelemetry semantik-konvensiyon grubunun altında 2025-2026 yıllarında yer aldı. Dayanıklı özelliği isimlerini tanımlarlar, böylece Datadog, Langfuse, Phoenix, OpenLLMetry ve AgentOps hepsi aynı alanları analiz eder.

## Anlaşım

### İspanyol hiyerarşi

```
agent.invoke_agent  (top, INTERNAL span)
 ├── llm.chat       (CLIENT span)
 ├── tool.execute   (INTERNAL)
 │    └── mcp.call  (CLIENT span)
 ├── llm.chat       (CLIENT span)
 └── subagent.invoke (INTERNAL)
```

Tüm bu şey tek bir iz kimliği altında yuvarlanır.

### Gerekli özellikler

2025-2026 döneminde:

- `gen_ai.operation.name` `"chat"`- Evet .`"text_completion"`- Evet .`"embeddings"`- Evet .`"execute_tool"`- Evet .`"invoke_agent"`- Evet .
- `gen_ai.provider.name` `"openai"`- Evet .`"anthropic"`- Evet .`"google"`- Evet .`"azure_openai"`- Evet .
- `gen_ai.request.model` istenen model dilimleri (örneğin `"gpt-4o-2024-08-06"`)
- `gen_ai.response.model` model aslında hizmet verdi.
- `gen_ai.usage.input_tokens`- Ne ?`gen_ai.usage.output_tokens`- Evet .
- `gen_ai.response.id` İlişki için sağlayıcı tepki kimliği.

Araç aralığı için:

- `gen_ai.tool.name` Araç tanımlayıcısı.
- `gen_ai.tool.call.id` özel çağrı kimliği.
- `gen_ai.tool.description` Araç tanımı (aksil).

Ajanlar için:

- `gen_ai.agent.name`- Ne ?`gen_ai.agent.id`- Ne ?`gen_ai.agent.description`- Evet .

### İtkisiz

- `SpanKind.CLIENT`Bir süreç sınırı geçen çağrılar için (LLM sağlayıcısı, MCP sunucusu).
- `SpanKind.INTERNAL`Ajanın kendi döngü adımları ve araç yürütme için.

### Seçili içeriği yakalama

Öntanımlı olarak, süreler metrik ve zamanlama  istekleri veya tamamlamaları taşır. Büyük payloadlar ve PII öntanımlı olarak kapatılır.`OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental`İçeriği dahil etmek için belirli içerik yakalama ortamı.

### Sapanlardaki olaylar

Token düzeyinde olaylar, uzantı olayları olarak eklenebilir:

- `gen_ai.content.prompt` Giriş mesajları.
- `gen_ai.content.completion` mesaj çıkışı.
- `gen_ai.content.tool_call` kayıtlı araç çağrısı.

Detaylı bir tekrarlama için bir süre içinde olayların zaman sıralaması.

### Dışarıya aktarıcılar

OTel, aşağıdaki ülkelere ihracat etmeyi kapsar:

- **Jaeger / Tempo.**- OSS, yeryüzünde.
- **Langfuse.**LLM- gözlemsellik-özel; token kullanımını görselleştirir.
- **Arize Phoenix.**Evals + izleme kombinasyonu.
- **Datadog.**Ticari; doğuştan analizler `gen_ai.*`- Bu özellikler.
- **Honeycomb.**Sütun odaklı, sorgu dostu.

Hepsi OTLP, tel biçimi konuşuyor.

### MCP'ler arasında yayılma

Bir MCP istemcisi bir sunucuyu aradığında, W3C izleme ana başlığını istek içine enjekte edin. Akışlı HTTP standart başlıkları destekler. Stdio HTTP başlıklarını doğal olarak taşımıyor; spesifikasyonun 2026 yol haritası bir `_meta.traceparent`JSON-RPC çağrılarında alan.

Bu gemiye kadar:                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         `_meta`Sunucu iz kimliğini kaydediyor.

### Metrikler

Genişlemenin semconv'i, alanlar yanında ölçümleri tanımlar:

- `gen_ai.client.token.usage` Istogram.
- `gen_ai.client.operation.duration` Istogram.
- `gen_ai.tool.execution.duration` Istogram.

Bu cihazları arama detaylarına ihtiyaç duymayan araç tablosu için kullanın.

### AgentOps katmanı

AgentOps (tasarım 2024) GenAI gözlemselliği konusunda uzmanlaşmıştır. Otel uzantıları otomatik olarak yaymak için popüler çerçeveleri (LangGraph, Pydantic AI, CrewAI) sarar.

```figure
t3-span-waterfall
```

## Kullan

`code/main.py`bir LLM'yi çağıran, iki araç gönderen ve bir MCP geri dönüş yolculuğu yapan bir ajan için OTel şeklinde stranslar gönderir. Gerçek bir ihracatçı  dersi stran şekli ve özelliği kümesine odaklanmaz. Çıkışı OTLP uyumlu bir izleyiciye yapıştır veya sadece oku.

Neye bakılır:

- İzleme kimliği tüm alanlarda paylaşıldı.
- Ebeveyn- çocuk bağlantıları `parentSpanId`- Evet .
- Gerekli`gen_ai.*`Özellikler dolu.
- İçerik yakalama standart olarak kapatılır; bir senaryo env var üzerinden etkinleştirir.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-otel-genai-instrumentation.md`- Bir ajan kod tabanı verildiğinde, yetenek bir araçlama planı oluşturur: nerede devreye eklenecek, hangi özellikleri nüfuslu hale getirecek ve hangi ihracatçıları hedefleyecek.

## Egzersizler

1. Çık .`code/main.py`- Sıraları say ve hangisi KLIENT ile içe düşen olduğunu belirle.

2. İçerik çekimi (env var) etkinleştir ve onaylayın `gen_ai.content.prompt`ve `gen_ai.content.completion`olaylar ortaya çıkar.

3. Araç- yürütme metrikini ekleyin `gen_ai.tool.execution.duration`ve her çağrıda histogram örneği olarak yayımlayın.

4. Ana-birliğin bir takipçi ailesini bir MCP talebinin uzaya yaymak `_meta.traceparent`MCP sunucusunun aynı iz kimliğini göreceğini kontrol et.

5. OTel GenAI semconv spesifikasını okuyun. Bu ders kodunun yaymadığı semconv'de listelenen bir özelliği belirleyin. Ekleyin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| OTel | "OpenTelemetry" | Open standard for traces, metrics, logs |
| GenAI semconv | "GenAI semantic conventions" | Stable attribute names for LLM / tool / agent spans |
| `gen_ai.*` | "The attribute namespace" | All GenAI attributes share this prefix |
| Span | "Timed operation" | A unit of work with a start, end, and attributes |
| Trace | "Cross-span ancestry" | Tree of spans sharing a trace id |
| SpanKind | "CLIENT / SERVER / INTERNAL" | Hints about span direction |
| OTLP | "OpenTelemetry Protocol" | Wire format for exporters |
| Opt-in content | "Prompt / completion capture" | Off by default; env var to enable |
| traceparent | "W3C header" | Propagates trace context across services |
| Exporter | "Backend-specific shipper" | Component that sends spans to Jaeger / Datadog / etc. |

## Daha Fazla Okumak

- [OpenTelemetry — GenAI semconv](https://opentelemetry.io/docs/specs/semconv/gen-ai/) GenAI kapsamları, ölçümleri ve etkinlikleri için kanonik konvensiyonlar
- [OpenTelemetry — GenAI spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/) LLM ve araç-öğretim süresi özellikleri listesi
- [OpenTelemetry — GenAI agent spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) ajan düzeyinde `invoke_agent`Uçuş
- [open-telemetry/semantic-conventions — GenAI spans](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-spans.md) GitHub'da barındırılan gerçeklik kaynağı
- [Datadog — LLM OTel semantic convention](https://www.datadoghq.com/blog/llm-otel-semantic-convention/) Üretim entegrasyonu yürüyüşü
