# LLM Routing Layer  LiteLLM, OpenRouter, Portkey

> - Sağlayıcı kilitleme pahalı. Farklı araç çağrı yükleri farklı modeller için uygundur. Routing gateways bir API yüzeyi, tekrar deneme, başarısızlık, maliyet izleme ve koruma kapıları verir. 2026 yılında üç arketip hakim: LiteLLM (açık kaynaklı kendi kendine barındırılmış), OpenRouter ( yönetilen SaaS), Portkey (önemlilik derecesi, açık kaynaklı Mart 2026). Bu ders karar kriterlerini belirler ve bir stdlib yönlendirme kapısı yürür.

**Type:** Learn
**Languages:** Python (stdlib, routing + failover + cost tracker), TypeScript
**Prerequisites:** Phase 13 · 02 (function calling), Phase 13 · 17 (gateways)
**Time:** ~45 minutes

## Öğrenme Hedefleri

- Kendi kendine barındırılan, yönetilen ve üretim seviyesindeki yönlendirme seçeneklerini ayırt edin.
- Sağlayıcı hatalarını belirlenmiş bir öncelik sırasıyla tekrar deneden bir geri dönüş zinciri uygulayın.
- Teklifte maliyet ve token kullanımını sağlayıcılar arasında izleyin.
- Verilmiş bir üretim kısıtlaması için LiteLLM, OpenRouter ve Portkey arasında karar verin.

## Sorun

Sağlayıcı yönlendirme önemli olan senaryolar:

1. **Cost.**Claude Sonnet, Haiku'nun 3 katı maliyetini ödüyor.

2. **Failover.**OpenAI'nin kötü bir saati var, her istek başarısız oluyor, yeniden yerleştirilmeden otomatik olarak Anthropic'e geri dönmek istiyorsun.

3. **Latency.**Canlı sohbet kullanıcı aracının hızlı zaman-birinci belirti ihtiyacı var.

4. **Compliance.**AB kullanıcıları AB bölgelerinde kalmalıdır.

5. **Experimentation.**A/B, aynı çalışma yükünde iki model.

Bu bütünü birleştirme başına el kodlaması tekrarlayıcıdır. Bir yönlendirme geçidi bir OpenAI uyumlu API verir ve geri kalanı ele alır.

## Anlaşım

### OpenAI ile uyumlu vekil şekli

Herkes OpenAI şeklinde konuşuyor.`/v1/chat/completions`Bu, OpenAI şeması kabul eder ve Anthropic / Gemini / Cohere / Ollama / herhangi bir şeye içsel olarak vekillik yapar.

### Model isimler

Bir anlık fotoğraf kimliği yerine, kodunuz diyor ki`our_smart_model`Giriş haritası gerçek modellere takma isimler. Bir sağlayıcı yeni nesil gönderdiğinde, takma isim sunucu tarafını değiştirirsin; kodunuz hiçbir şeye dokunmaz.

### Çökme zincirleri

```
primary: openai/gpt-4o
on 5xx: anthropic/claude-3-5-sonnet
on 5xx: google/gemini-1.5-pro
on 5xx: refuse
```

Geçitler bunu bir yapılandırmada tanımlar. Geri denemeler bütçeye karşı sayılır böylece geri dönüş kaskadeleri maliyetin patlamasını engellemez.

### Semantik önbelleğe

Aynı veya neredeyse aynı istekler, sunucu yerine bir önbelleğe girdi. Tekrarlanan ajan döngüslerinde tasarruf yüzde 30 ila 60 olabilir. Anahtarlar yerleştirme tabanlıdır; neredeyse aynı istekler önbelleğe bölünür.

### Koruma rayları

Giriş seviyesi:

- **PII redaction.**İletişme göndermeden önce Regex veya ML tabanlı geçiş yapın.
- **Policy violations.**Yasak içeriği olan istekleri reddet.
- **Output filters.**Sızıntılar için tamamlamaları temizle.

Portkey ve Kong her ikisi de birer güvenlik koruma sistemi.

### Anahtarlık oranı sınırları

Bir API anahtarı = bir ekip. Anahtarlık bütçeleri bir ekibin paylaşılan kvota tüketmesini engeller. Çoğu geçit bunu destekler.

### Kendi kendine konutlanan ve yönetilen pazarlamalar

| Factor | LiteLLM (self-hosted) | OpenRouter (managed) | Portkey (production) |
|--------|----------------------|----------------------|----------------------|
| Code | Open source, Python | Managed SaaS | Open source (Mar 2026) + managed |
| Setup | Deploy a proxy | Sign up | Either |
| Providers | 100+ | 300+ | 100+ |
| Billing | Your own keys | OpenRouter credits | Your own keys |
| Observability | OpenTelemetry | Dashboard | Full OTel + PII redaction |
| Best for | Teams that want full control | Rapid prototyping | Production with compliance |

LiteLLM, SRE ekibiniz ve veri egemenliği istediğinizde kazanır. OpenRouter tek bir abonelik istediğinizde kazanır ve infra yok. Portkey, koruma ve uyumluluk için bir şey yapmanız gerektiğinde kazanır.

### Maliyet izleme

Her talebinde bir şey var .`provider`- Evet .`model`- Evet .`input_tokens`- Evet .`output_tokens`. Modelle karşılıklı token fiyatları ile çarpın (Gateway tarafından korunan fiyat sayfasından alınarak). Kullanıcı / takım / proje başına toplam.

### MCP artı yönlendirme

Bir geçit hem LLM çağrılarını hem de MCP örnekleme isteklerini yönlendirebilir. Bir örnekleme istekinin modeliÖncelikler belirli bir modeli tercih ettiğinde, geçit doğru arka uçta çevrilir. Bu, Fase 13 · 17 (MCP geçit) ve bu dersin yönlendirme geçitinin bazen bir hizmette birleşmesidir.

### Yollama stratejileri

- **Static priority.**Listede ilk; hata yapmayı bırak.
- **Load balancing.**Dört-robin veya ağırlıklı.
- **Cost-aware.**En ucuz modelin geçicilik / kaliteyi karşılaması seçin.
- **Latency-aware.**Son N dakika içinde en hızlı modeli seç.
- **Task-aware.**Hızlı sınıflandırıcı yolları bir modele kodlama, diğerine özetleme.

```figure
tp-router-failover
```

## Kullan

`code/main.py`150 satırda bir yönlendirme geçitini uyguluyor: OpenAI şeklinde istekleri kabul eder, her sağlayıcının çubuklarına çevirir, öncelikli bir geri dönüş zinciri yürütür, her istek maliyetini izler ve girişte PII düzenleme geçişini uyguluyor.

Neye bakılır:

- `ROUTES`dik: alias -> öncelikli sıralamalı beton tedarikçiler listesi.
- 5xx'te geri dönüş döngüsü tekrar deneyin.
- Masraf takipçisi, token kullanımını model başına oranlarla çarpır.
- PII redaktörü, göndermeden önce SSN şeklinde kalıpları tarar.

## Gönder

Bu ders bize çok yararlı .`outputs/skill-routing-config-designer.md`. İş yükü profilini (kenaklık, maliyet, uyumluluk) göz önüne alarak, yetenek LiteLLM / OpenRouter / Portkey'i seçer ve bir yönlendirme yapılandırmasını oluşturur.

## Egzersizler

1. Çık .`code/main.py`. Kesinti senaryosunu tetikleyin; ikinci sağlayıcıya geri dönüşün doğru olduğunu ve maliyetin doğru şekilde hesaplandığını doğrulayın.

2. Semantik önbelleği ekleyin: SHA256'nın bir arama anahtarı vardır; önbelleğe vurma hemen geri döner. Tekrarlanan bir çağrıda maliyet tasarrufu ölçülür.

3. "Kod"... yönlendirici bir sınıflandırıcı ekle, "İstihbarat" ve "Cumratise"... hız yönlendirici bir isimle bağlantı kur.

4. Ekibe başına tasarlanmış bütçeler: her ekibin aylık harcama limiti vardır; kapı sınırına ulaştıktan sonra istekleri reddeder.

5. LiteLLM, OpenRouter ve Portkey belgelerini yan yana okuyun.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Routing gateway | "LLM proxy" | One-API-surface layer in front of many providers |
| OpenAI-compatible | "Speaks the OpenAI schema" | Accepts `/v1/chat/completions` shape, translates to any backend |
| Model alias | "our_smart_model" | Name in your code that the gateway maps to a concrete model |
| Fallback chain | "Retry list" | Ordered list of providers attempted on failure |
| Semantic caching | "Prompt-embedding cache" | Key is embedding of the prompt; near-duplicates share a cache hit |
| Guardrails | "Input/output filters" | Redact PII, reject policy violations |
| Per-key rate limit | "Team budget" | Quota scoped to an API key |
| Cost tracking | "Per-request spend" | Aggregate token usage x price per model |
| LiteLLM | "The open proxy" | Self-hostable OSS routing gateway |
| OpenRouter | "The managed SaaS" | Hosted gateway with credit-based billing |
| Portkey | "The production option" | Open-source + managed with guardrails built in |

## Daha Fazla Okumak

- [LiteLLM — docs](https://docs.litellm.ai/) Kendi kendine barındırılan yönlendirme geçidi
- [OpenRouter — quickstart](https://openrouter.ai/docs/quickstart) yönetilen yönlendirme SaaS
- [Portkey — docs](https://portkey.ai/docs) Çekilen üretim yönlendirme
- [TrueFoundry — LiteLLM vs OpenRouter](https://www.truefoundry.com/blog/litellm-vs-openrouter) Karar rehberi
- [Relayplane — LLM gateway comparison 2026](https://relayplane.com/blog/llm-gateway-comparison-2026) Satıcılar anketleri
