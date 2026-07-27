# Prompt Önbelleğe Alma ve Bağlam Önbelleğe Alma

> prompt sisteminiz 4.000 tokens'dir. RAG bağlamınız 20.000 tokensn. Her istekte ikisini de gönderiyorsunuz. Ayrıca her ikisi için de ödeme yaparsınız. Prompt önbelleğe alma, sağlayıcının bu öneki kendi tarafında sıcak tutmasına ve yeniden kullanımda size normal ücretin %10'unu fatura etmesine olanak tanır. Doğru kullanıldığında, inference maliyetini %50–90 oranında ve ilk-token gecikmesini %40–85 oranında azaltır.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 11 · 01 (Prompt Mühendislik), Aşama 11 · 05 (Bağlam Mühendisliği), Aşama 11 · 11 (Önbelleğe Alma ve Maliyet)
**Süre:** ~60 dakika

## Sorun

Bir kodlama agent, konuşmanın her aşamasında aynı 15.000-token sistemini prompt Claude'a gönderir. Kullanıcının herhangi bir gerçek mesajından önce yalnızca giriş maliyetinde $3/M input tokens is $0,90'a yirmi tur. Günlük 10.000 konuşmayla çarptığınızda, hiç değişmeyen metinlerin faturası günde 9.000 ABD dolarına ulaşıyor.

Kaliteye zarar vermeden prompt'yi küçültemezsiniz. Onu göndermekten kaçınamazsınız; modelin ona her fırsatta ihtiyacı vardır. Yapılacak tek hamle, sağlayıcının daha önce gördüğü bir önek için tam fiyat ödemeyi bırakmaktır.

Bu hareket prompt önbelleklemedir. Anthropic bunu Ağustos 2024'te piyasaya sürdü (2025'te 1 saatlik uzatılmış TTL versiyonuyla), OpenAI bunu aynı yılın sonlarında otomatikleştirdi, Google, Gemini 1.5'in yanı sıra açık içerik önbelleğe almayı da gönderdi ve üçü de artık bunu kendi sınır modellerinde birinci sınıf bir özellik olarak sunuyor.

## Konsept

![Prompt önbelleğe alma: bir kere yaz, ucuz oku](../assets/prompt-caching.svg)

**Mekanik.** Bir isteğin öneki yakın tarihli bir istekteki önek ile eşleştiğinde, sağlayıcı, token'ları yeniden kodlamak yerine önceki çalıştırmanın KV önbelleğini sunar. İlk seferinde küçük bir yazma primi ödersiniz ve her seferinde büyük bir okuma indirimi ödersiniz.

**2026'da üç sağlayıcı çeşidi.**

| Sağlayıcı | API stili | İndirimi vur | Prim yaz | Varsayılan TTL | Minimum önbelleğe alınabilir |
|---------|-----------|--------------|---------------|-------------|---------------|
| Anthropic | İçerik bloklarında açık `cache_control` işaretçileri | Girişte %90 indirim | %25 ek ücret | 5 dakika (1 saate uzatılabilir) | 1.024 tokens (Sonnet/Opus), 2.048 (Haiku) |
| OpenAI | Otomatik önek algılama | Girişte %50 indirim | hiçbiri | 1 saate kadar (en iyi çaba) | 1.024 tokens |
| Google (İkizler) | Açık `CachedContent` API'si | Depolama faturalı; normalin ~%25'inde okundu | token·saat başına depolama ücreti | Kullanıcı ayarı (varsayılan 1 saat) | 4.096 tokens (Flash), 32.768 (Pro) |

**Değişmez.** Yalnızca üç önbellek önekinin tümü. İstekler arasında herhangi bir token farklılık gösterirse, ilk farklı token'dan sonraki her şey bir kayıptır. *Sabit* parçaları en üste, *değişken* parçaları en alta yerleştirin.

### Önbellek dostu düzen

```
[system prompt]          <-- cache this
[tool definitions]       <-- cache this
[few-shot examples]      <-- cache this
[retrieved documents]    <-- cache if reused, else don't
[conversation history]   <-- cache up to last turn
[current user message]   <-- never cache (different every time)
```

Sırayı ihlal edin - kullanıcı mesajını sistemin prompt üstüne koyun, dinamik alımları few-shot arasına ekleyin - ve önbellek asla isabet etmez.

### Başabaş hesaplaması

Anthropic'in %25'lik yazma primi, net tasarruf sağlamak için önbelleğe alınmış bir bloğun en az iki kez okunması gerektiği anlamına gelir. 1 yazma + 1 okuma ortalama olarak istek başına 0,675x maliyet (%32 tasarruf sağlar); 1 yazma + 10 okuma ortalama 0,205x (%80 tasarruf sağlar). Temel kural: TTL içinde yeniden kullanmayı düşündüğünüz her şeyi en az 3 kez önbelleğe alın.

## İnşa Et

### 1. Adım: Açık işaretleyicilerle Anthropic prompt önbelleğe alma

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

`cache_control` işaretçisi Anthropic'e bloğu 5 dakika boyunca saklamasını söyler. Bu pencere isabetlerinde yeniden kullanım; süresi dolduktan sonra yeniden kullanır ve tekrar yazar.

**Yanıt kullanım alanları:**

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

CI'daki her iki alanı da kontrol edin; eğer `cache_read_input_tokens` istekler genelinde sıfırda kalırsa, önbellek anahtarlarınız değişiyor demektir.

### Adım 2: bir saatlik uzatılmış TTL

Uzun süren toplu işler için, varsayılan 5 dakikalık süre işler arasında sona erer. `ttl`'ı ayarlayın:

```python
{"type": "text", "text": RUBRIC, "cache_control": {"type": "ephemeral", "ttl": "1h"}}
```

1 saatlik TTL, yazma priminin 2 katı maliyeti (%25 yerine taban çizgisinin %50'si) ancak öneki 5 defadan fazla yeniden kullanan herhangi bir toplu işlemde hızlı bir şekilde geri ödeme yapar.

### 3. Adım: OpenAI otomatik önbelleğe alma

OpenAI size yapılandırılacak hiçbir şey vermez. Son istekle eşleşen 1.024 token'den fazla herhangi bir önek otomatik olarak %50 indirim alır.

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

Aynı önbellek dostu düzen kuralı geçerlidir. Anthropic'inkini öldürmeyen iki şey OpenAI'nin önbelleğini öldürür: `user` alanını değiştirmek (önbellek anahtarı bileşeni olarak kullanılır) ve araçları yeniden sıralamak.

### Adım 4: Gemini açık bağlamı önbelleğe alma

Gemini, önbelleğe, oluşturduğunuz ve adlandırdığınız birinci sınıf bir nesne gibi davranır:

```python
from google import genai
from google.genai import types

client = genai.Client()

cache = client.caches.create(
    model="gemini-3-pro",
    config=types.CreateCachedContentConfig(
        display_name="rubric-v3",
        system_instruction=RUBRIC,
        contents=[FEW_SHOT_EXAMPLES],
        ttl="3600s",
    ),
)

resp = client.models.generate_content(
    model="gemini-3-pro",
    contents=["Review this code:\n" + code],
    config=types.GenerateContentConfig(cached_content=cache.name),
)
```

Gemini, önbellek ömrü boyunca depolamayı token·saat başına ücretlendirir ve normal giriş hızının ~%25'inde okur. Bu, aynı dev prompt'yi günler boyunca birçok oturumda yeniden kullandığınızda doğru şekildir.

### 5. Adım: Üretimdeki isabet oranının ölçülmesi

Yazma/okuma/kaçırma sayımlarını izleyen ve 1K istek başına karma maliyeti hesaplayan simüle edilmiş üç sağlayıcılı bir muhasebeci için bkz. `code/main.py`. Gate, hedef isabet oranına göre konuşlandırılır; çoğu üretim Anthropic kurulumunda, ısınmadan sonra >%80 okuma oranı görülmelidir.

## 2026'da hâlâ gönderilecek tuzaklar

- **Dinamik zaman damgaları üstte.** `"Current time: 2026-04-22 15:30:02"` sistemin üst kısmında prompt. Her istek kaçırılıyor. Zaman damgalarını önbellek kesme noktasının altına taşıyın.
- **Araçların yeniden sıralanması.** Araçları sabit bir sırayla serileştirin; dağıtımlar arasında yapılan değişiklik, her isabeti bozar.
- **Serbest metin neredeyse kopyalar.** "Yardımcı oluyorsunuz." vs "Sen yardımsever bir asistanın." — bir byte fark = tam kayıp.
- **Çok küçük bloklar.** Anthropic 1,024-token tabanı (Haiku için 2,048) zorluyor. Daha küçük bloklar sessizce önbelleğe alınmaz.
- **Kör maliyet kontrol panelleri.** "Giriş token'leri" önbelleğe alınmış ve önbelleğe alınmamış olarak ayırın. Aksi halde trafik düşüşü, önbellek kazancı gibi görünür.

## Kullan onu

2026 önbellekleme yığını:

| Durum | Seç |
|-----------|------|
| Agent kararlı 10k+ sistemiyle prompt, birçok dönüş | 5 dakikalık TTL ile Anthropic `cache_control` |
| Bir öneki 30+ dakika boyunca yeniden kullanan toplu iş | `ttl: "1h"` ile Anthropic |
| GPT-5'te sunucusuz uç noktalar, özel altyapı yok | OpenAI otomatik (sadece önekinizi sabit ve uzun yapın) |
| Devasa bir kod/belge külliyatının birkaç gün boyunca yeniden kullanımı | İkizler burcu açık `CachedContent` |
| Sağlayıcılar arası geri dönüş | Her türlü isabetin işe yaraması için önbelleğe alınabilir önek düzenini sağlayıcılar arasında aynı tutun |

Kullanıcı mesajı katmanı için anlamsal önbelleğe alma (Aşama 11 · 11) ile birleştirin: prompt önbelleğe alma tutamaçları *token-özdeş* yeniden kullanım, anlamsal önbelleğe alma tutamaçları *anlam-özdeş* yeniden kullanım.

## Gönderin

`outputs/skill-prompt-caching-planner.md`'yi kaydet:

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

1. **Kolay.** Claude'a karşı 5.000-token sistemiyle prompt 10 turluk bir konuşma yapın. `cache_control` olmadan ve ardından ile çalıştırın. Her biri için giriş-token faturasını bildirin.
2. **Orta.** Bir prompt şablonu ve bir istek günlüğü verildiğinde, sağlayıcı başına beklenen isabet oranını ve dolar tasarrufunu hesaplayan bir test donanımı yazın (Anthropic 5 milyon, Anthropic 1h, OpenAI otomatik, Gemini açık).
3. **Zor.** Bir düzen optimize edici oluşturun: prompt ve `stable=True/False` işaretli alanların listesi verildiğinde, tek bir önbellek kesme noktasını bilgi kaybı olmadan maksimum önbellek dostu konuma yerleştirmek için prompt'yi yeniden yazın. Gerçek bir Anthropic uç noktada doğrulama yapın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|-----------------------|
| Prompt önbelleğe alma | "Uzun promptları ucuza getirir" | Önekleri eşleştirmek için sağlayıcı tarafındaki KV önbelleğinin yeniden kullanılması; Tekrarlanan giriş token'lerde %50-90 indirim. |
| `cache_control` | "Anthropic işaretleyici" | "Buraya kadar olan her şeyin önbelleğe alınabileceğini" bildiren Content-block özelliği; `{"type": "ephemeral"}`. |
| Önbelleğe yazma | "Prim ödeme" | Önbelleği dolduran ilk istek; Anthropic'te ~1,25x giriş ücretiyle faturalandırılır, OpenAI'de ücretsizdir. |
| Önbellek okuma | "İndirim" | Önekle eşleşen sonraki istekler; %10 (Anthropic), %50 (OpenAI), ~%25 (Gemini) olarak faturalandırılır. |
| TTL | "Ne kadar yaşar" | Önbellek saniyeler içinde sıcak kalır; Anthropic 5 m varsayılan (1 saate kadar uzatılabilir), 1 saate kadar OpenAI en iyi çaba, Gemini kullanıcı ayarı. |
| Genişletilmiş TTL | "1 saatlik Anthropic önbellek" | `{"type": "ephemeral", "ttl": "1h"}`; 2x yazma primi ancak toplu yeniden kullanım için buna değer. |
| Önek eşleşmesi | "Önbelleğim neden gözden kaçtı" | Önbellekler yalnızca başlangıçtan kesme noktasına kadar her token baytla aynı olduğunda isabet alır. |
| Bağlam önbelleğe alma (Gemini) | "Açık olan" | Google'ın adlandırılmış, depolama alanıyla faturalandırılan önbellek nesnesi; büyük korporaların birkaç gün boyunca yeniden kullanımı için en iyisi. |

## Daha Fazla Okuma

- [Anthropic — Prompt önbelleğe alma](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) — `cache_control`, 1 saatlik TTL, başa baş tabloları.
- [OpenAI — Prompt önbelleğe alma](https://platform.openai.com/docs/guides/prompt-caching) — otomatik önek eşleştirme.
- [Google — Bağlam önbelleğe alma](https://ai.google.dev/gemini-api/docs/caching) — `CachedContent` API ve depolama fiyatlandırması.
- [Anthropic mühendislik — Prompt uzun bağlamlı iş yükleri için önbelleğe alma](https://www.anthropic.com/news/prompt-caching) — gecikme sayılarını içeren orijinal lansman gönderisi.
- Aşama 11 · 05 (Bağlam Mühendisliği) — önbelleğin yerleşebilmesi için prompt'nın nerede dilimleneceği.
- Aşama 11 · 11 (Önbelleğe Alma ve Maliyet) — kullanıcı mesajlarında prompt önbelleğe almayı anlamsal önbellekle eşleştirin.
- [Pope ve diğerleri, "Etkili Şekilde Ölçeklendirme Transformer Inference" (2022)](https://arxiv.org/abs/2211.05102) — prompt önbelleğe almanın kullanıcılara sunduğu KV-önbellek bellek modeli; Önbelleğe alınmış bir öneki yeniden okumanın yeniden hesaplamaktan neden ~10 kat daha ucuz olduğunu açıklıyor.
- [Agrawal ve diğerleri, "SARATHI: Verimli LLM Inference by Piggybacking Decodes with Chunked Prefills" (2023)](https://arxiv.org/abs/2308.16369) — ön doldurma, prompt önbelleğe alma kısayolları aşamasıdır; bu makale, TPOT etkilenmezken TTFT'nin önbellek isabetinde neden önemli ölçüde düştüğünü açıklamaktadır.
- [Leviathan ve diğerleri, "Spekülatif Kod Çözme yoluyla Transformer'lardan hızlı Inference" (2023)](https://arxiv.org/abs/2211.17192) — prompt önbelleğe alma, inference maliyet eğrisini büken kaldıraçlar olarak spekülatif kod çözme, Flash Attention ve MQA/GQA'nın yanında yer alır; diğer üçü için bunu okuyun.
