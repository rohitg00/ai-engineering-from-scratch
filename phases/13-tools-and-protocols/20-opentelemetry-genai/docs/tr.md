# OpenTelemetry GenAI — Uçtan Uca Aramaları İzleme Aracı

> Bir agent, beş aracı, üç MCP sunucusunu ve iki alt agent'yi çağırır. Hepsinde tek bir ize ihtiyacınız var. OpenTelemetry GenAI semantik kuralları (v1.37 ve üzeri sürümlerdeki kararlı nitelikler), Datadog, Langfuse, Arize Phoenix, OpenLLMetry ve AgentOps tarafından yerel olarak desteklenen 2026 standardıdır. Bu ders gerekli nitelikleri adlandırır, yayılma hiyerarşisini (agent → LLM → araç) yürütür ve herhangi bir OTel dışa aktarıcısına takabileceğiniz bir stdlib yayılma yayıcı gönderir.

**Tür:** Yapım
**Diller:** Python (stdlib, OTel yayılma yayıcı)
**Önkoşullar:** Aşama 13 · 07 (MCP sunucusu), Aşama 13 · 08 (MCP istemcisi)
**Süre:** ~75 dakika

## Öğrenme Hedefleri

- Bir LLM aralığı ve araç yürütme aralığı için gerekli OTel GenAI niteliklerini adlandırın.
- agent loop, LLM çağrısı, araç çağrısı ve MCP istemci gönderimini kapsayan bir izleme hiyerarşisi oluşturun.
- Hangi içeriğin yakalanacağına (katılma) ve redakte edileceğine (varsayılanlar) karar verin.
- Araç kodunu yeniden yazmaya gerek kalmadan yerel bir toplayıcıya (Jaeger, Langfuse) yayılmaları yayınlayın.

## Sorun

Şubat 2026'dan bir hata ayıklama: kullanıcı "agent cihazımın yanıt vermesi bazen 30 saniye sürüyor; diğer zamanlarda ise 3 saniye sürüyor." Hiçbir iz yok. Günlükler LLM çağrısını gösterir, ancak araç gönderimini, MCP sunucusunun gidiş dönüşünü veya agent altını göstermez. Tahmin et. Sonunda şunu bulursunuz: Bir MCP sunucusu ara sıra soğuk başlangıçta takılı kalıyor.

Uçtan uca izleme olmadan bunu bulamazsınız. OTel GenAI sorunu düzeltiyor.

Kurallar 2025-2026'da OpenTelemetry semantic-conventions grubu altında belirlendi. Datadog, Langfuse, Phoenix, OpenLLMetry ve AgentOps'un aynı yayılma alanlarını ayrıştırması için kararlı öznitelik adlarını tanımlarlar. Enstrüman bir kez; herhangi bir arka uca gönderin.

## Konsept

### Yayılma hiyerarşisi

```
agent.invoke_agent  (top, INTERNAL span)
 ├── llm.chat       (CLIENT span)
 ├── tool.execute   (INTERNAL)
 │    └── mcp.call  (CLIENT span)
 ├── llm.chat       (CLIENT span)
 └── subagent.invoke (INTERNAL)
```

Her şey tek bir izleme kimliğinin altında toplanıyor. Span kimlikleri üst-alt ilişkileri birbirine bağlar.

### Gerekli özellikler

2025-2026 semconv'a göre:

- `gen_ai.operation.name` — `"chat"`, `"text_completion"`, `"embeddings"`, `"execute_tool"`, `"invoke_agent"`.
- `gen_ai.provider.name` — `"openai"`, `"anthropic"`, `"google"`, `"azure_openai"`.
- `gen_ai.request.model` — istenen model dizisi (e.g. `"gpt-4o-2024-08-06"`).
- `gen_ai.response.model` — gerçekte hizmet veren model.
- `gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens`.
- `gen_ai.response.id` — korelasyon için sağlayıcı yanıt kimliği.

Takım aralıkları için:

- `gen_ai.tool.name` — takım tanımlayıcı.
- `gen_ai.tool.call.id` — belirli çağrı kimliği.
- `gen_ai.tool.description` — araç açıklaması (isteğe bağlı).

agent aralıkları için:

- `gen_ai.agent.name` / `gen_ai.agent.id` / `gen_ai.agent.description`.

### Açıklık türleri

- `SpanKind.CLIENT` bir süreç sınırını aşan çağrılar için (LLM sağlayıcısı, MCP sunucusu).
- agent'nin kendi döngü adımları ve araç uygulaması için `SpanKind.INTERNAL`.

### İçerik yakalamayı etkinleştirin

Varsayılan olarak aralıklar, prompt'leri veya tamamlamaları değil, metrikleri ve zamanlamayı taşır. Büyük veriler ve PII varsayılan olarak kapalıdır. İçeriği içerecek şekilde `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental` ve belirli içerik yakalama ortam değişkenlerini ayarlayın. Ürünü etkinleştirmeden önce dikkatlice inceleyin.

### Aralıklardaki etkinlikler

Token düzeyindeki olaylar yayılma olayları olarak eklenebilir:

- `gen_ai.content.prompt` — giriş mesajları.
- `gen_ai.content.completion` — çıktı mesajları.
- `gen_ai.content.tool_call` — kaydedildiği şekliyle araç çağrısı.

Ayrıntılı tekrar oynatma için bir aralık içindeki olayların zaman sırası.

### İhracatçılar

OTel ihracatı şu ülkelere kapsar:

- **Jaeger / Tempo.** OSS, şirket içi.
- **Langfuse.** LLM-observability'ye özel; token kullanımını görselleştirir.
- **Arize Phoenix.** Değerlendirmeler + izleme birleştirildi.
- **Datadog.** Ticari; `gen_ai.*` niteliklerini yerel olarak ayrıştırır.
- **Petek.** Sütun odaklı; sorgu dostu.

Herkes kablolu format olan OTLP'yi konuşur. Kodunuz umursamıyor.

### MCP genelinde yayılma

Bir MCP istemcisi bir sunucuyu aradığında, isteğe W3C traceparent başlığını ekleyin. Akış yapılabilir HTTP standart başlıkları destekler. Stdio, HTTP başlıklarını yerel olarak taşımaz; spesifikasyonun 2026 yol haritası, JSON-RPC çağrılarına `_meta.traceparent` alanının eklenmesini tartışıyor.

Bu gönderilene kadar: traceparent'ı her isteğin `_meta` dosyasına manuel olarak ekleyin. Sunucu izleme kimliğini günlüğe kaydeder.

### Metrikler

GenAI semconv, aralıkların yanı sıra metrikleri de tanımlar:

- `gen_ai.client.token.usage` — histogram.
- `gen_ai.client.operation.duration` — histogram.
- `gen_ai.tool.execution.duration` — histogram.

Bunları arama başına ayrıntıya ihtiyaç duymayan kontrol panelleri için kullanın.

### AgentOps katmanı

AgentOps (2024'te kuruldu), GenAI observability konusunda uzmandır. OTel yayılmalarını otomatik olarak yaymak için popüler framework'leri (LangGraph, Pydantic AI, CrewAI) sarar. Yığınınız desteklenen bir framework kullanıyorsa kullanışlıdır; aksi takdirde manuel enstrümantasyon kullanın.

## Kullan onu

`code/main.py`, bir LLM'yi çağıran, iki araç gönderen ve bir MCP gidiş-dönüş yapan bir agent için stdout'a (OTLP-JSON benzeri formatta) OTel şeklinde yayılmalar yayar. Gerçek bir ihracatçı yok; ders yayılma şekli ve nitelik kümesine odaklanıyor. Çıktıyı OTLP uyumlu bir görüntüleyiciye yapıştırın veya sadece okuyun.

Neye bakmalı:

- İzleme kimliği tüm aralıklarda paylaşılır.
- Ebeveyn-çocuk bağlantıları `parentSpanId` aracılığıyla kodlanır.
- Gerekli `gen_ai.*` öznitelikleri doldurulur.
- İçerik yakalama varsayılan olarak kapalıdır; bir senaryo onu env var aracılığıyla açar.

## Gönderin

Bu ders `outputs/skill-otel-genai-instrumentation.md`'yi üretir. Bir agent kod tabanı verildiğinde, beceri bir enstrümantasyon planı üretir: aralıkların nereye ekleneceği, hangi niteliklerin doldurulacağı ve hangi dışa aktarıcıların hedefleneceği.

## Egzersizler

1. `code/main.py`'yi çalıştırın. Aralıkları sayın ve hangisinin MÜŞTERİ ve DAHİLİ olduğunu belirleyin.

2. İçerik yakalamayı açın (env var) ve `gen_ai.content.prompt` ve `gen_ai.content.completion` olaylarının göründüğünü onaylayın. Kişisel Bilgilere İlişkin Etkilere Dikkat Edin.

3. Araç yürütme metriğini `gen_ai.tool.execution.duration` ekleyin ve bunu çağrı başına bir histogram örneği olarak yayınlayın.

4. Bir üst agent yayılma alanından bir izleme ebeveynini bir MCP isteğinin `_meta.traceparent` alanına yayar. MCP sunucusunun aynı izleme kimliğini göreceğini doğrulayın.

5. OTel GenAI semconv spesifikasyonunu okuyun. Semconv'da listelenen ve bu dersin kodunun yaymadığı bir özelliği tanımlayın. Ekle.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| Otel | "Açık Telemetri" | İzler, ölçümler ve günlükler için açık standart |
| GenAI semconv | "GenAI anlamsal kuralları" | LLM / tool / agent aralıkları için kararlı öznitelik adları |
| `gen_ai.*` | "Öznitelik ad alanı" | Tüm GenAI özellikleri bu öneki paylaşıyor |
| Açıklık | "Zamanlanmış çalışma" | Başlangıcı, bitişi ve nitelikleri olan bir iş birimi |
| İzleme | "Çapraz aralıklı soy" | İzleme kimliğini paylaşan açıklık ağacı |
| SpanKind | "İSTEMCİ / SUNUCU / DAHİLİ" | Açıklık yönü hakkında ipuçları |
| OTLP | "AçıkTelemetri Hattı Protokolü" | İhracatçılar için tel formatı |
| Katılım içeriği | "Prompt / tamamlama yakalama" | Varsayılan olarak kapalı; etkinleştirmek için env var |
| izleme ebeveyni | "W3C başlığı" | İzleme bağlamını hizmetler genelinde yayar |
| İhracatçı | "Arka uca özel gönderici" | Jaeger / Datadog / vb.'ye yayılma gönderen bileşen |

## Daha Fazla Okuma

- [OpenTelemetry — GenAI semconv](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — GenAI aralıkları, ölçümleri ve olayları için standart kurallar
- [OpenTelemetry — GenAI yayılmaları](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/) — Yüksek Lisans ve araç yürütme yayılma özelliği listesi
- [OpenTelemetry — GenAI agent aralıkları](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) — agent düzeyi `invoke_agent` aralığı
- [açık telemetri/semantik kurallar — GenAI kapsamları](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-spans.md) — GitHub tarafından barındırılan gerçek kaynağı
- [Datadog — LLM OTEL semantik kuralı](https://www.datadoghq.com/blog/llm-otel-semantic-convention/) — üretim entegrasyonuna yönelik izlenecek yol
