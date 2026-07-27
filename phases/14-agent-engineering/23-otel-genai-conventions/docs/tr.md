# OpenTelemetry GenAI Anlamsal Kuralları

> OpenTelemetry'nin GenAI SIG'si (Nisan 2024'te piyasaya sürüldü), agent telemetrisi için standart şemayı tanımlar. Yayılma adları, öznitelikler ve içerik yakalama kuralları satıcılar arasında birleşir; dolayısıyla agent izleri Datadog, Grafana, Jaeger ve Honeycomb'da aynı anlama gelir.

**Tür:** Öğren + Oluştur
**Diller:** Python (stdlib)
**Önkoşullar:** Aşama 14 · 13 (LangGraph), Aşama 14 · 24 (Observability Platformları)
**Süre:** ~60 dakika

## Öğrenme Hedefleri

- GenAI yayılma kategorilerini adlandırın: model/istemci, agent, araç.
- `invoke_agent` İSTEMCİ ile DAHİLİ aralıkları ve her birinin ne zaman geçerli olduğunu ayırt edin.
- Üst düzey GenAI niteliklerini listeleyin: sağlayıcı adı, istek modeli, veri kaynağı kimliği.
- İçerik yakalama sözleşmesini açıklayın: katılım, `OTEL_SEMCONV_STABILITY_OPT_IN`, harici referans önerisi.

## Sorun

Her satıcı kendi yayılma adlarını icat eder. Operasyon ekipleri framework başına gösterge tabloları oluşturmaya başlar. OpenTelemetry'nin GenAI SIG'si, tüm ekosistemin hedeflediği tek bir standart tanımlayarak bu sorunu çözer.

## Konsept

### Aralık kategorileri

1. **Model/istemci kapsamları.** Ham LLM çağrılarını kapsar. Sağlayıcı SDK'ları (Anthropic, OpenAI, Bedrock) ve framework model bağdaştırıcıları tarafından yayılır.
2. **Agent yayılır.** `create_agent` (agent oluşturulduğunda) ve `invoke_agent` (çalıştığında).
3. **Araç kapsamları.** Araç çağrısı başına bir; ebeveyn-çocuk ilişkisiyle agent aralığına bağlı.

### Agent aralık adlandırma

- Yayılma adı: Adlandırılmışsa `invoke_agent {gen_ai.agent.name}`; `invoke_agent`'ye geri dönüş.
- Açıklık türü:
  - **İSTEMCİ** — uzak agent hizmetleri için (OpenAI Assistants API, Bedrock Agent'ler).
  - **DAHİLİ** — süreç içi agent framework'ler için (LangChain, CrewAI, yerel ReAct).

### Temel özellikler

- `gen_ai.provider.name` — `anthropic`, `openai`, `aws.bedrock`, `google.vertex`.
- `gen_ai.request.model` — model kimliği.
- `gen_ai.response.model` — çözümlenen model (yönlendirme nedeniyle istekten farklı olabilir).
- `gen_ai.agent.name` — agent tanımlayıcı.
- `gen_ai.operation.name` — `chat`, `completion`, `invoke_agent`, `tool_call`.
- `gen_ai.data_source.id` — RAG için: hangi derlem veya mağazaya başvurulduğu.

Anthropic, Azure AI Inference, AWS Bedrock, OpenAI için teknolojiye özgü kurallar mevcuttur.

### İçerik yakalama

Varsayılan kural: enstrümantasyonlar varsayılan olarak girişleri/çıkışları YAKALAMAMALIDIR. Yakalama şu şekilde etkinleştirilir:

- `gen_ai.system_instructions`
- `gen_ai.input.messages`
- `gen_ai.output.messages`

Önerilen üretim modeli: içeriği harici olarak saklayın (S3, günlük deponuz), aralıklara referansları kaydedin (işaretçi kimlikleri, düzyazı değil). Bu, observability'ye bağlanan Ders 27 içerik zehirlenmesi savunmasıdır.

### Kararlılık

Çoğu sözleşme Mart 2026 itibarıyla deneyseldir. Şunlarla kararlı önizlemeye kaydolun:

```
OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental
```

Datadog v1.37+, GenAI niteliklerini yerel olarak LLM Observability şemasına eşler. Diğer arka uçlar (Grafana, Honeycomb, Jaeger) ham nitelikleri destekler.

### Bu modelin yanlış gittiği yer

- **Açıklıklarda tam prompt'lerin yakalanması.** Operasyonların okuyabileceği izlerdeki kişisel bilgiler, sırlar, müşteri verileri. Harici olarak saklayın.
- **`gen_ai.provider.name` yok.** İlişkilendirme eksik olduğunda çoklu sağlayıcı kontrol panelleri bozulur.
- **Üst bağlantıların olmadığı kapsamlar.** Artık araç kapsamları. Her zaman bağlamı yayın.
- **Kararlılık etkinleştirmesi ayarlanmıyor.** Arka uç yükseltmesinde öznitelikleriniz yeniden adlandırılabilir.

## İnşa Et

`code/main.py`, GenAI kurallarına uygun bir stdlib yayılma yayıcı uygular:

- GenAI öznitelik şemasına sahip `Span`.
- `start_span` ile `Tracer`, iç içe bağlamlar.
- Komut dosyası içeren bir agent çalıştırması şunları yayar: `create_agent`, `invoke_agent` (DAHİLİ), araç başına kapsamlar, LLM çağrıları için `chat` kapsamlar.
- prompt'leri harici olarak depolayan ve aralıklara kimlikleri kaydeden bir içerik yakalama modu.

Çalıştır:

```
python3 code/main.py
```

Çıktı: gerekli tüm GenAI niteliklerini içeren bir yayılma ağacı ve isteğe bağlı içerik referanslarını gösteren bir "harici depo".

## Kullan onu

- **Datadog LLM Observability** (v1.37+) öznitelikleri yerel olarak eşler.
- **Langfuse / Phoenix / Opik** (Ders 24) — ekosistemi otomatik olarak çalıştır.
- **Jaeger / Honeycomb / Grafana Tempo** — ham OTel izleri; GenAI özelliklerinden kontrol panelleri oluşturun.
- **Kendi kendine barındırılan** — OTel Collector'ı bir GenAI işlemciyle çalıştırın.

## Gönderin

`outputs/skill-otel-genai.md` kabloları OTel GenAI, içerik yakalama varsayılanları ve harici referans depolamasıyla mevcut agent'ye yayılır.

## Egzersizler

1. Ders 01 ReAct döngünüzü `invoke_agent` (DAHİLİ) + araç başına aralıklarla donatın. Bir Jaeger örneğine gönderin.
2. "Yalnızca referanslar" modunda içerik yakalama ekleyin: SQLite'a prompt'ler, yayılma nitelikleri yalnızca satır kimliklerini taşır.
3. `gen_ai.data_source.id` teknik özelliklerini okuyun. Bunu Ders 09 Mem0 aramanıza bağlayın.
4. `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental`'yi ayarlayın ve niteliklerinizin toplayıcı tarafından yeniden adlandırılmadığını doğrulayın.
5. Bir kontrol paneli oluşturun: yalnızca GenAI özelliklerinden "hangi araç hatalarının hangi modellerle ilişkili olduğu".

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|----------------|------------------------|
| GenAI SIG | "OpenTelemetry GenAI grubu" | OTel çalışma grubu şemayı tanımlıyor |
| invoke_agent | "Agent yayılma alanı" | agent çalıştırmasını temsil eden yayılma alanının adı |
| MÜŞTERİ aralığı | "Uzaktan arama" | Uzak bir agent hizmetine yapılan çağrı için kapsam |
| İÇ açıklık | "İşlemde" | Süreç içi agent çalıştırma aralığı |
| gen_ai.provider.name | "Sağlayıcı" | antropik / açık / aws.bedrock / google.vertex |
| gen_ai.data_source.id | "RAG kaynağı" | Bir geri alma isabeti hangi derlem/mağaza |
| İçerik yakalama | "Prompt günlüğe kaydetme" | İletilerin yakalanmasını etkinleştirin; harici olarak üründe saklayın |
| Kararlılık seçeneği | "Önizleme modu" | Deneysel kuralları sabitlemek için Env var |

## Daha Fazla Okuma

- [OpenTelemetry GenAI anlam kuralları](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — spesifikasyon
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) — GenAI varsayılan olarak yayılır
- [AutoGen v0.4 (Microsoft Research)](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) — Yerleşik OTel aralıkları
- [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview) — W3C izleme bağlamı yayılımı
