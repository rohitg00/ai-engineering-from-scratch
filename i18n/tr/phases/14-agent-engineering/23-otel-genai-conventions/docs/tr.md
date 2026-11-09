# OpenTelemetry GenAI Semantik Sözleşmeleri

> OpenTelemetry'nin GenAI SIG (April 2024'te başlatıldı) ajan telemetrisi için standart şema tanımlar. Span isimleri, özellikleri ve içerik yakalama kuralları satıcılar arasında birleştiğinden ajan izleri Datadog, Grafana, Jaeger ve Honeycomb'da aynı şeyi ifade eder.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 13 (LangGraph), Phase 14 · 24 (Observability Platforms)
**Time:** ~60 minutes

## Öğrenme Hedefleri

- GenAI alan kategorilerini isimlendirin: model/klient, ajan, araç.
- Farklılık`invoke_agent`KLIENT vs. İKİNİRİK ve her biri geçerli olduğunda.
- GenAI'nin en üst düzey özelliklerini listelen: sağlayıcı adı, talep modeli, veri kaynağı kimliği.
- İçerik yakalama sözleşmesini açıklayın:`OTEL_SEMCONV_STABILITY_OPT_IN`, dış referans tavsiyesi.

## Sorun

Her satıcı kendi uzantı isimlerini icat eder. operasyon ekipleri çerçeveye göre araç tablosu oluşturur. OpenTelemetry'nin GenAI SIG, tüm ekosistem hedeflerini tek standart olarak tanımlayarak bunu düzeltir.

## Anlaşım

### Sıkıntı kategorileri

1. **Model / client spans.**Servis sağlayıcı SDK'ler (Anthropic, OpenAI, Bedrock) ve çerçeve model adaptörleri tarafından yayınlanan çiğ LLM çağrılarını kapsar.
2. **Agent spans.** `create_agent`(Agent inşa edildiğinde) ve `invoke_agent`(hareket ederken).
3. **Tool spans.**Bir araç çağrısı başına; ebeveyn-öğdül ilişkisi ile ajan uzaya bağlı.

### Ajanın adı

- İspanyol adı: `invoke_agent {gen_ai.agent.name}`Eğer adı belirtilmişse , `invoke_agent`- Evet .
- - İtfaiye türü:
  - **CLIENT** uzaktan temsilci hizmetleri için (OpenAI Asistan API, Bedrock Agents).
  - **INTERNAL** işleme içindeki ajan çerçeveleri (LangChain, CrewAI, local ReAct).

### Ana özellikler

- `gen_ai.provider.name` `anthropic`- Evet .`openai`- Evet .`aws.bedrock`- Evet .`google.vertex`- Evet .
- `gen_ai.request.model` Model kimliği.
- `gen_ai.response.model` çözülmüş model (ruutlama nedeniyle istekten farklı olabilir).
- `gen_ai.agent.name` ajan kimliği.
- `gen_ai.operation.name` `chat`- Evet .`completion`- Evet .`invoke_agent`- Evet .`tool_call`- Evet .
- `gen_ai.data_source.id` RAG için: hangi depo veya depo ile görüşüldü.

Anthropic, Azure AI Inference, AWS Bedrock, OpenAI için teknolojiye özgü sözleşmeler mevcuttur.

### İçerik yakalama

Öntanımlı kural: Aygıtlar öntanımlı olarak giriş/çıktıları yakalamamalıdır. Yakalama:

- `gen_ai.system_instructions`
- `gen_ai.input.messages`
- `gen_ai.output.messages`

Önerilen üretim tarzı: içeriği dışa saklayın (S3, günlük depolarınız), referansları uzantılar üzerinde kaydetin (sözlü değil, işaretçi kimlikleri). Bu, gözlemlenebilirliğe kablolanmış 27.

### Dayanıklılık

Çoğu konferans Mart 2026 itibariyle deneysel olarak yapılır.

```
OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental
```

GenAI'nin LLM gözlemlenebilirlik şemasındaki özgün özellikleri oluşturan veriler. Diğer arka planlar (Grafana, Honeycomb, Jaeger) ham özellikleri destekler.

### Bu kalıp yanlış gittiğinde

- **Capturing full prompts in spans.**Bilgi, sırlar, müşteri verileri, operasyonların okuyabileceği izlerde.
- **No `gen_ai.provider.name`.**Çoklu sağlayıcıların kontrol panelleri atribut eksik olduğunda kırılır.
- **Spans without parent links.**Yetim araçlar, her zaman bağlamı yayıyor.
- **Not setting stability opt-in.**Özellikleriniz arka uç yükseltme sırasında yeniden adlandırılabilir.

```figure
ae-genai-span-tree
```

## Yapın

`code/main.py`GenAI'nin sözleşmelerine uygun bir stdlib uzantı emiten uygulamaktadır:

- `Span`GenAI özelliği şeması ile.
- `Tracer`- Evet .`start_span`, yuva bağlamları.
- Bir senaryolu ajan çalıştırır:`create_agent`- Evet .`invoke_agent`(İNTERNAL), her aletin genişliği, `chat`Yüksek lisans görüşmeleri için zaman.
- İçerik yakalama modunun, dıştan uyarıları sakladığı ve taramalarda kimlikleri kaydettiği bir modudur.

Çek şunu:

```
python3 code/main.py
npx tsx code/main.ts
```

Çıktı: Tüm gerekli GenAI özellikleri olan bir uzantı ağacı ve seçme içeriği referanslarını gösteren bir "dış dükkân".

## Kullan

- **Datadog LLM Observability**(v1.37+) harita özelliği doğuştan.
- **Langfuse / Phoenix / Opik**(Denevi 24)  Otomatik araçlar ekosistem.
- **Jaeger / Honeycomb / Grafana Tempo** ham OTel izleri; GenAI özelliklerinden araç tablosu oluşturun.
- **Self-hosted** OTel Collector'u GenAI işlemcisi ile çalıştırın.

## Gönder

`outputs/skill-otel-genai.md`Teller OTel GenAI, içeriği yakalama ve dış referans depolama standartları ile mevcut bir ajanın içine uzanır.

## Egzersizler

1. 01 Dersinize bir alet yapın .`invoke_agent`(İİNTERNAL) + her aletin uzantısı.
2. "Sadece referanslar" modunda içerik yakalama ekleyin: SQLite'e gelen istekler, uzanan özellikler sadece satır kimliklerini taşır.
3. Spec-i oku `gen_ai.data_source.id`9. Ders Memorandumunuza bağlayın.
4. Yapıştır `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental`ve özelliklerinizin koleksiyoncu tarafından yeniden adlandırılmadığını kontrol et.
5. Bir araç tablosu oluşturun: GenAI özelliğinden sadece "heç hangi araç hataları hangi modellerle ilişkili"

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| GenAI SIG | "OpenTelemetry GenAI group" | OTel working group defining the schema |
| invoke_agent | "Agent span" | Name of the span representing an agent run |
| CLIENT span | "Remote call" | Span for a call to a remote agent service |
| INTERNAL span | "In-process" | Span for an in-process agent run |
| gen_ai.provider.name | "Provider" | anthropic / openai / aws.bedrock / google.vertex |
| gen_ai.data_source.id | "RAG source" | Which corpus/store a retrieval hit |
| Content capture | "Prompt logging" | Opt-in capture of messages; store externally in prod |
| Stability opt-in | "Preview mode" | Env var to pin experimental conventions |

## Daha Fazla Okumak

- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) Spec
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) GenAI varsayılan olarak uzanır
- [AutoGen v0.4 (Microsoft Research)](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) Otel kaplamaları
- [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview) W3C iz bağlamı yayılması
