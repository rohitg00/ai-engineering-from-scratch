# Hızlı Kaydetme ve Kontext Kaydetme

> Sistem istekiniz 4.000 simge. RAG bağlamınız 20.000 simge. Her istekle her ikisini de gönderiyorsunuz. Her seferinde ikisini de ödersiniz. Anlık önbelleği sağlayıcıya bu önbellekleri yanlarında sıcak tutmalarını ve tekrar kullanma normal oranın% 10'unu ödemelerini sağlar. Doğru kullanıldığında, sonuçlama maliyetini % 50  90% ve ilk simge gecikmesini % 40  85% azaltır.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 11 · 01 (Prompt Engineering), Phase 11 · 05 (Context Engineering), Phase 11 · 11 (Caching and Cost)
**Time:** ~60 minutes

## Sorun

Bir kodlama ajanı, Claude'a her konuşmanın her dönüşünde aynı 15.000 jetonlu sistem uyarısını gönderir.$3/M input tokens is $Kullanıcının gerçek mesajlarından herhangi biri olmadan önce giriş maliyetinin sadece 0.90'u. Günde 10.000 konuşma ile çoğaltın ve hiç değişmeyen metin için fatura günde 9.000 dolara ulaşır.

Bu nedenle, bu konuyla ilgili bir görüşme yaparak, bu konuyla ilgili bir görüşme yaparak, bu konuyla ilgili bir görüşme yaparak, bu konuyla ilgili bir görüşme yaparak, bu konuyla ilgili bir görüşme yaparak, bu konuyla ilgili bir görüşme yaparak, bu konuyla ilgili bir görüşme yaparak, bu görüşme yaparak, bu görüşme yaparak, bu görüşme yaparak, bu görüşmeyi gerçekleştirmek için, bu görüşme yaparak, bu görüşmeyi gerçekleştirmek için, bu görüşme yaparak, bu görüşmeyi gerçekleştirmek için, bu görüşme yaparak, bu görüşmeyi gerçekleştirmek için, bu görüşme yaparak, bu görüşmeyi gerçekleştirmek için, bu görüşme yaparak, bu görüşme yaparak, bu görüşmeyi gerçekleştirmek için, bu görüşme yaparak, bu görüşme yaparak, bu görüşme yaparak, bu görüşme yaparak, bu görüşme yaparak, bu görüşme yaparak, bu görüşme yaparak, bu görüşme yaparak, bu görüşme yaparak, bu görüşme yaparak, bu görüşme yaparak, bu görüşme yaparak, bu görüşme yaparak, bu görüşme yaparak, bu görüşme konusunda, bu görüşme yaparak, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu, bu

Bu hareket hızlı önbelleğe girmek. Anthropic onu Ağustos 2024'te (2025'te 1 saatlik uzatılmış TTL varianti ile) gönderdi, OpenAI onu o yılın sonunda otomatikleştirdi, Google, Gemini 1.5 ile birlikte açık bağlamalı önbelleğe gönderdi ve şimdi üçü de sınır modelleri üzerinde birinci sınıf bir özellik olarak sunmaktadır.

## Anlaşım

![Prompt caching: write once, read cheap](../assets/prompt-caching.svg)

**The mechanic.**Bir istek önlüğü son bir istekle eşleşince, sağlayıcı, simgelerin yeniden kodlanması yerine önceki çalışmadan KV-cache'yi sunuyor.

**Three provider flavors in 2026.**

| Provider | API style | Hit discount | Write premium | Default TTL | Min cacheable |
|---------|-----------|--------------|---------------|-------------|---------------|
| Anthropic | Explicit `cache_control` markers on content blocks | 90% off input | 25% surcharge | 5 min (extendable to 1 hour) | 1,024 tokens (Sonnet/Opus), 2,048 (Haiku) |
| OpenAI | Automatic prefix detection | 50% off input | none | Up to 1 hour (best-effort) | 1,024 tokens |
| Google (Gemini) | Explicit `CachedContent` API | Storage-billed; read at ~25% of normal | Storage fee per token·hour | User-set (default 1 hour) | 4,096 tokens (Flash), 32,768 (Pro) |

**The invariant.**Eğer herhangi bir token istekler arasında farklılık gösterirse, ilk farklı token sonrası her şey bir hata olur.

### Önbelleğe dostu düzen

```
[system prompt]          <-- cache this
[tool definitions]       <-- cache this
[few-shot examples]      <-- cache this
[retrieved documents]    <-- cache if reused, else don't
[conversation history]   <-- cache up to last turn
[current user message]   <-- never cache (different every time)
```

 Kullanıcı mesajını sistem uyarısının üstünde koyun, birkaç çekim arasında dinamik çekimleri  ve önbelleği asla vurmaz.

### Kesinlik hesaplama

Anthropic'in %25 yazma ödemesi (5 dakikalık TTL) ilk okuduktan sonra kendi başına ödüyor, çünkü bir önbelleği okuma 0,1x maliyetini ödüyor. 1 yaz + 1 okuyucu ortalama 0.675x talep başına maliyet (%32 tasarruf eder); 1 yaz + 10 okuyucu ortalama 0.205x (%80 tasarruf eder). 1 saatlik TTL yazmak için 2 kat ücret alır, bu yüzden blok iki okumaya ihtiyaç duyar. Basamak kural: TTL içinde en az 3 kez yeniden kullanmayı beklediğiniz her şeyi kaydetin; bu TTL'de de kırılma oranını temizler.

```figure
prompt-cache-hit
```

## Yapın

### Adım 1: Açık işaretle Antropik çağrı önbelleği

```python
import anthropic

client = anthropic.Anthropic()

SYSTEM = [
    {
        "type": "text",
        "text": "You are a senior Python reviewer. Follow the rubric exactly.\n\n" + RUBRIC_15K_TOKENS,
        "cache_control": {"type": "ephemeral"},
    }
]

def review(code: str):
    return client.messages.create(
        model="claude-opus-4-7",
        max_tokens=1024,
        system=SYSTEM,
        messages=[{"role": "user", "content": code}],
    )
```

- Evet .`cache_control`Markör, Anthropic'e blokun 5 dakika saklanmasını söyler.

**Response usage fields:**

```python
response = review(code_a)
response.usage
# InputTokensUsage(
#     input_tokens=120,
#     cache_creation_input_tokens=15023,   # paid at 1.25x
#     cache_read_input_tokens=0,
#     output_tokens=340,
# )

response_b = review(code_b)
response_b.usage
# cache_creation_input_tokens=0
# cache_read_input_tokens=15023           # paid at 0.1x
```

 if                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           `cache_read_input_tokens`İstekler boyunca sıfırda kalır, önbelleğin anahtarları sürüklenir.

### Adım 2: Bir saatlik uzatılmış TTL

Uzun süreli seri işlerde, 5 dakikalık özür işler arasında geçerlidir.`ttl`- ...

```python
{"type": "text", "text": RUBRIC, "cache_control": {"type": "ephemeral", "ttl": "1h"}}
```

1 saatlik TTL yazma priminin iki katı (50% yerine 25%) maliyetini artırır, ancak önbellekten 5'den fazla kez tekrar kullanılan her parti için hızlı bir şekilde ödenir.

### Adım 3: OpenAI otomatik önbelleği

OpenAI size yapılandırmak için hiçbir şey vermez. 1.024 tokenden fazla bir önbölüm son bir talebe eşleşir otomatik olarak %50 indirim alır.

```python
from openai import OpenAI
client = OpenAI()

resp = client.chat.completions.create(
    model="gpt-5",
    messages=[
        {"role": "system", "content": SYSTEM_PROMPT},   # long and stable
        {"role": "user", "content": user_msg},
    ],
)
resp.usage.prompt_tokens_details.cached_tokens  # the discounted portion
```

Aynı önbelleğe dostu düzen kuralı geçerlidir. OpenAI'nin önbelleğini öldüren iki şey Anthropic'i öldürmeyen:`user`alan (cache anahtar bileşen olarak kullanılır) ve yeniden düzenleme araçları.

### Adım 4: Gemini açık bağlamı önbelleği

Gemini , önbelleği oluşturup adlandırdığınız birinci sınıf bir nesne olarak değerlendirir:

```python
from google import genai
from google.genai import types

client = genai.Client()

cache = client.caches.create(
    model="gemini-3.8-flash",
    config=types.CreateCachedContentConfig(
        display_name="rubric-v3",
        system_instruction=RUBRIC,
        contents=[FEW_SHOT_EXAMPLES],
        ttl="3600s",
    ),
)

resp = client.models.generate_content(
    model="gemini-3.8-flash",
    contents=["Review this code:\n" + code],
    config=types.GenerateContentConfig(cached_content=cache.name),
)
```

Gemini, önbelleğin ömrü boyunca her token·saati depolama ücretini alır ve normal giriş oranının %25'inde okur.

### Adım 5: Üretimdeki vurma oranını ölçmek

Bakın .`code/main.py`1K talepleri başına yazma/okuma/kayıp sayıları izleyen ve karışık maliyet hesaplayan simülasyonlu üç sağlayıcı muhasebeci için.

## 2026'da hala yolculuk eden tuzaklar

- **Dynamic timestamps at the top.** `"Current time: 2026-04-22 15:30:02"`Sistem isteklerinin üst kısmında, her istek kayıp olur.
- **Tool reordering.**Düzenli bir sırada araçları seriye etmek  bir devre yeniden düzenlemesi her vurguyu bozar.
- **Free-text near-duplicates.**"Yardımcısın". vs "Yardımcı bir asistansın".  bir bayt fark = tam eksiklik.
- **Too-small blocks.**Anthropic 1.024 token zemini (2.048 Haiku için) zorlar.
- **Blind cost dashboards.**"Geliş tokensini" önbelleğe alınan ve önbelleğe alınmayan bölün. Yoksa trafik düşüşü önbelleğe alınan kazanç gibi görünür.

## Kullan

2026'da önbelleğe alınan:

| Situation | Pick |
|-----------|------|
| Agent with stable 10k+ system prompt, many turns | Anthropic `cache_control` with 5-min TTL |
| Batch job reusing a prefix for 30+ minutes | Anthropic with `ttl: "1h"` |
| Serverless endpoints on GPT-5, no custom infra | OpenAI automatic (just make your prefix stable and long) |
| Multi-day reuse of a giant code/doc corpus | Gemini explicit `CachedContent` |
| Cross-provider fallback | Keep the cacheable prefix layout identical across providers so any hit works |

Kullanıcı mesaj katmanı için semantik önbelleğe (Fase 11 · 11) birleştirin: prompt önbelleğe *token-identical* reuse, semantic caching handles *meaning-identical* reuse.

## Gönder

- Kaydet .`outputs/skill-prompt-caching-planner.md`- ...

```markdown
---
name: prompt-caching-planner
description: Design a cache-friendly prompt layout and pick the right provider caching mode.
version: 1.0.0
phase: 11
lesson: 15
tags: [llm-engineering, caching, cost]
---

Given a prompt (system + tools + few-shot + retrieval + history + user) and a usage profile (requests per hour, TTL needed, provider), output:

1. Layout. Reordered sections with a single cache breakpoint marked; explain which sections are stable, which are volatile.
2. Provider mode. Anthropic cache_control, OpenAI automatic, or Gemini CachedContent. Justify from TTL and reuse pattern.
3. Break-even. Expected reads per write within TTL; net cost vs no-cache with math.
4. Verification plan. CI assertion that cache_read_input_tokens > 0 on the second identical request; dashboard split by cached vs uncached tokens.
5. Failure modes. List the three most likely reasons the cache will miss in this setup (dynamic timestamp, tool reorder, near-duplicate text) and how you will prevent each.

Refuse to ship a cache plan that places a dynamic field above the breakpoint. Refuse to enable 1h TTL without a reuse count that makes the 2x write premium pay back.
```

## Egzersizler

1. **Easy.**Claude'a karşı 5000 tokenli bir sistemle 10 dönüş konuşma yapın.`cache_control`Her biri için giriş belirti faktürünü rapor edin.
2. **Medium.**Bir istek şablonu ve bir talep günlüğü verildiğinde, bir sağlayıcıya göre beklenen hit oranını ve dolar tasarrufini hesaplayan bir test harnesini yaz (Anthropic 5m, Anthropic 1h, OpenAI otomatik, Gemini açık).
3. **Hard.**Bir düzenleme optimizörü oluştur: bir istek ve işaretli alanların bir listesini göster `stable=True/False`, bir tek önbelleği kırılma noktasını gerçek bir Anthropic son noktasında doğrulayın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Prompt caching | "Makes long prompts cheap" | Reusing a provider-side KV-cache for matching prefixes; 50-90% discount on repeated input tokens. |
| `cache_control` | "The Anthropic marker" | Content-block attribute that declares "everything up to here is cacheable"; `{"type": "ephemeral"}`. |
| Cache write | "Paying the premium" | The first request that populates the cache; billed at ~1.25x input rate on Anthropic, free on OpenAI. |
| Cache read | "The discount" | Subsequent requests matching the prefix; billed at 10% (Anthropic), 50% (OpenAI), ~25% (Gemini). |
| TTL | "How long it lives" | Seconds the cache stays warm; Anthropic 5m default (extendable 1h), OpenAI best-effort up to 1h, Gemini user-set. |
| Extended TTL | "1-hour Anthropic cache" | `{"type": "ephemeral", "ttl": "1h"}`; 2x write premium but worth it for batch reuse. |
| Prefix match | "Why my cache missed" | Caches only hit when every token from the start up to the breakpoint is byte-identical. |
| Context caching (Gemini) | "The explicit one" | Google's named, storage-billed cache object; best for multi-day reuse of large corpora. |

## Daha Fazla Okumak

- [Anthropic — Prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) `cache_control`1 saat TTL, düzlem masaları.
- [OpenAI — Prompt caching](https://platform.openai.com/docs/guides/prompt-caching) otomatik ön işaret eşleşimi.
- [Google — Context caching](https://ai.google.dev/gemini-api/docs/caching) `CachedContent`API ve depolama fiyatları.
- [Anthropic engineering — Prompt caching for long-context workloads](https://www.anthropic.com/news/prompt-caching) gecikme numaraları ile orijinal başlatma noktası.
- 11 · 05 aşaması (Kontext Mühendisliği)  Kaynak yerleşebilsin diye istekleneni kesmek için nerede.
- Fase 11 · 11 (Kesleme ve Maliyet)  kullanıcı mesajlarında semantik bir önbelleğe sahip bir önbelleğe sahip bir çift önbelleğe girme.
- [Pope et al., "Efficiently Scaling Transformer Inference" (2022)](https://arxiv.org/abs/2211.05102) KV-cache bellek modeli, önbelleği kullanan kullanıcılara açığa çıkarır; önbelleği önbelleğin yeniden okumak için yeniden hesaplamaktan ~ 10x daha ucuz olduğunu açıklar.
- [Agrawal et al., "SARATHI: Efficient LLM Inference by Piggybacking Decodes with Chunked Prefills" (2023)](https://arxiv.org/abs/2308.16369) prefill, faz prompt önbelleğe geçirme kısayollarıdır; bu makale TTFT'nin neden TPOT'nin etkilenmediği sürece önbelleğe geçirilmesinde önemli ölçüde düştüğünü açıklar.
- [Leviathan et al., "Fast Inference from Transformers via Speculative Decoding" (2023)](https://arxiv.org/abs/2211.17192) hızlı önbelleğe kaydedilme spekülatör çözme, Flash Dikkat ve MQA/GQA ile birlikte sonuç maliyet eğriğini eğdiren kaldıraçlar olarak yer alır; diğer üç için bunu okuyun.
