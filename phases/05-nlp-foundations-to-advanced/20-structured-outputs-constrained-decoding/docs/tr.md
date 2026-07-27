# Yapılandırılmış Çıkışlar ve Kısıtlı Kod Çözme

> JSON için Yüksek Lisans'a başvurun. Çoğu zaman JSON'u edinin. Üretimde "çoğu" sorundur. Kısıtlı kod çözme, örneklemeden önce logitleri düzenleyerek "çoğu"yu "her zaman"a dönüştürür.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 5 · 17 (Sohbet Robotları), Aşama 5 · 19 (Alt Kelime Tokenleştirme)
**Süre:** ~60 dakika

## Sorun

Bir sınıflandırıcı prompt bir LLM'dir: "{Pozitif, negatif, nötr}'den birini döndür." Model şu sonucu verir: "Duygular olumlu; bu inceleme son derece olumlu çünkü müşteri açıkça şunu belirtiyor ...". Ayrıştırıcınız çöküyor. Sınıflandırıcınızın F1'i 0,0'dır.

Serbest biçimli üretim bir sözleşme değildir. Bu bir öneri. Bir üretim sisteminin bir sözleşmeye ihtiyacı vardır.

2026'da üç katman var.

1. **Prompting.** Kibarca sor. "Yalnızca JSON nesnesini döndür." Sınır modellerde ~%80, daha küçük modellerde daha az çalışır.
2. **Yerel yapılandırılmış çıktı API'leri.** OpenAI `response_format`, Antropik araç kullanımı, Gemini JSON modu. Desteklenen şemalarda güvenilir. Satıcı kilitli.
3. **Kısıtlı kod çözme.** Modelin geçersiz token'ler *yayamaması* için her oluşturma adımında logitleri değiştirin. Yapı itibariyle %100 geçerlidir. Herhangi bir yerel modelde çalışır.

Bu ders her üçü için de sezgi geliştirir ve neye ne zaman ulaşılacağını belirtir.

## Konsept

![Kısıtlı kod çözme, her adımda geçersiz token'leri maskeliyor](../assets/constrained-decoding.svg)

**Kısıtlı kod çözme nasıl çalışır?** Her nesil adımında LLM, tüm kelime dağarcığı (~100k tokens) üzerinden bir logit vektörü üretir. Model ile örnekleyici arasında bir *logit işlemci* bulunur. Hedef dilbilgisindeki mevcut konum (JSON Şeması, regex, bağlamdan bağımsız dilbilgisi) göz önüne alındığında hangi token'lerin geçerli olduğunu hesaplar ve tüm geçersiz token'lerin logitlerini negatif sonsuza ayarlar. Kalan logitlerin softmax'ı olasılık kütlesini yalnızca geçerli devamlara koyar.

2026 yılındaki uygulamalar:

- **Anahatlar.** JSON Şemasını veya normal ifadeyi sonlu durumlu bir makinede derler. Her token, bir O(1) geçerli-sonraki-token aramasını alır. FSM tabanlı olduğundan özyinelemeli şemaların düzleştirilmesi gerekir.
- **XGrammar / llguidance.** Bağlamdan bağımsız dilbilgisi motorları. Özyinelemeli JSON Şemasını yönetin. Sıfıra yakın kod çözme yükü. OpenAI, 2025 yapılandırılmış çıktı uygulamalarında rehberliğe itibar etti.
- **vLLM destekli kod çözme.** Outlines, XGrammar veya lm-format-enforcer arka uçları aracılığıyla yerleşik `guided_json`, `guided_regex`, `guided_choice`, `guided_grammar`.
- **Eğitmen.** Herhangi bir LLM üzerinde Pydantic tabanlı sarmalayıcı. Doğrulama hatası durumunda yeniden deneme yapılır. Çapraz sağlayıcı, ancak logit'leri değiştirmez; yeniden denemelere + yapılandırılmış çıktıya duyarlı prompt'lara dayanır.

### Mantığa aykırı sonuç

Kısıtlı kod çözme, genellikle kısıtsız oluşturmaya göre *daha hızlıdır*. İki sebep. İlk olarak, sonraki-token arama alanını daraltır. İkincisi, akıllı uygulamalar zorunlu token'ler için token neslini tamamen atlar (`{"name": "` gibi iskele — her bayt belirlenir).

### Size maliyeti olan tuzak

Saha sırası önemlidir. `answer`'yi `reasoning`'nin önüne koyarsanız model, düşünmeden önce bir cevabı taahhüt eder. JSON geçerlidir. Cevap yanlış. Hiçbir doğrulama onu yakalayamaz.

```json
// BAD
{"answer": "yes", "reasoning": "because ..."}

// GOOD
{"reasoning": "... therefore ...", "answer": "yes"}
```

Şema alanı sırası biçimlendirme değil mantıksaldır.

## İnşa Et

### Adım 1: sıfırdan normal ifadeyle kısıtlı oluşturma

Bağımsız bir FSM uygulaması için bkz. `code/main.py`. 30 satırdaki ana fikir:

```python
def mask_logits(logits, valid_token_ids):
    mask = [float("-inf")] * len(logits)
    for tid in valid_token_ids:
        mask[tid] = logits[tid]
    return mask


def generate_constrained(model, tokenizer, prompt, fsm):
    ids = tokenizer.encode(prompt)
    state = fsm.initial_state
    while not fsm.is_accept(state):
        logits = model.next_token_logits(ids)
        valid = fsm.valid_tokens(state, tokenizer)
        logits = mask_logits(logits, valid)
        tok = sample(logits)
        ids.append(tok)
        state = fsm.transition(state, tok)
    return tokenizer.decode(ids)
```

FSM, gramerin şu ana kadar hangi kısımlarını tamamladığımızı takip ediyor. `valid_tokens(state, tokenizer)`, hangi token sözlüğünün kabul edilebilir bir yol bırakmadan FSM'de ilerleyebileceğini hesaplar.

### Adım 2: JSON Şemasının Ana Hatları

```python
from pydantic import BaseModel
from typing import Literal
import outlines


class Review(BaseModel):
    sentiment: Literal["positive", "negative", "neutral"]
    confidence: float
    evidence_span: str


model = outlines.models.transformers("meta-llama/Llama-3.2-3B-Instruct")
generator = outlines.generate.json(model, Review)

result = generator("Classify: 'The wait staff was attentive and the food arrived hot.'")
print(result)
# Review(sentiment='positive', confidence=0.93, evidence_span='attentive ... hot')
```

Sıfır doğrulama hatası. Durmadan. FSM geçersiz çıktıyı erişilemez hale getirir.

### Adım 3: Sağlayıcıdan bağımsız Pydantic eğitmeni

```python
import instructor
from anthropic import Anthropic
from pydantic import BaseModel, Field


class Invoice(BaseModel):
    vendor: str
    total_usd: float = Field(ge=0)
    line_items: list[str]


client = instructor.from_anthropic(Anthropic())
invoice = client.messages.create(
    model="claude-opus-4-7",
    max_tokens=1024,
    response_model=Invoice,
    messages=[{"role": "user", "content": "Extract from: 'Acme Corp $420. Widget, Gizmo.'"}],
)
```

Farklı mekanizma. Eğitmen logitlere dokunmaz. Şemayı prompt olarak biçimlendirir, çıktıyı ayrıştırır ve doğrulama hatası durumunda yeniden dener (varsayılan 3 kez). Herhangi bir sağlayıcıyla çalışır. Yeniden denemeler gecikmeyi ve maliyeti artırır. Sağlayıcılar arası taşınabilirlik satış noktasıdır.

### Adım 4: yerel satıcı API'leri

```python
from openai import OpenAI

client = OpenAI()
response = client.responses.create(
    model="gpt-5",
    input=[{"role": "user", "content": "Classify: 'The food was cold.'"}],
    text={"format": {"type": "json_schema", "name": "sentiment",
          "schema": {"type": "object", "required": ["sentiment"],
                     "properties": {"sentiment": {"type": "string",
                                                  "enum": ["positive", "negative", "neutral"]}}}}},
)
print(response.output_parsed)
```

Sunucu tarafı kısıtlı kod çözme. Desteklenen şemalar için Outlines ile güvenilirlik eşitliği. Yerel model yönetimi yok. Sizi satıcıya kilitler.

## Tuzaklar

- **Özyinelemeli şemalar.** Ana hatlar, yinelemeyi sabit bir derinliğe kadar düzleştirir. Ağaç yapılı çıktılar (iç içe yorumlar, AST) XGrammar'a veya rehberliğe (CFG tabanlı) ihtiyaç duyar.
- **Çok büyük numaralandırmalar.** 10.000 seçenekli numaralandırma yavaş derlenir veya zaman aşımına uğrar. Bir av köpeğine geçin: ilk önce en iyi adayları tahmin edin, bunlarla sınırlandırın.
- **Dilbilgisi çok katı.** `date: "YYYY-MM-DD"` normal ifadesini zorlarsanız model, eksik tarihler için `"unknown"` çıktısını alamaz. Model bir tarih icat ederek bunu telafi ediyor. `null` veya bir nöbetçiye izin ver.
- **Vaktinden önce taahhüt.** Yukarıdaki saha siparişi tuzağına bakın. Her zaman mantığı ilk sıraya koyun.
- **Şema olmadan satıcı JSON modu.** Saf JSON modu yalnızca geçerli JSON'u garanti eder, *kullanım durumunuz* için geçerli değildir. Her zaman tam bir şema sağlayın.

## Kullan onu

2026 yığını:

| Durum | Seç |
|-----------|------|
| OpenAI/Antropik/Google modeli, basit şema | Yerel satıcı yapılandırılmış çıktısı |
| Herhangi bir sağlayıcı, Pydantic iş akışı, yeniden denemeleri tolere edebilir | eğitmen |
| Yerel model, %100 geçerlilik gerektirir, düz şema | Ana Hatlar (FSM) |
| Yerel model, özyinelemeli şema | XGrammar veya Rehberlik |
| Kendi kendine barındırılan inference sunucusu | vLLM rehberli kod çözme |
| Yeniden denemelerle toplu işleme kabul edilebilir | Eğitmen + en ucuz model |

## Gönderin

`outputs/skill-structured-output-picker.md` olarak kaydet:

```markdown
---
name: structured-output-picker
description: Choose a structured output approach, schema design, and validation plan.
version: 1.0.0
phase: 5
lesson: 20
tags: [nlp, llm, structured-output]
---

Given a use case (provider, latency budget, schema complexity, failure tolerance), output:

1. Mechanism. Native vendor structured output, Instructor retries, Outlines FSM, or XGrammar CFG. One-sentence reason.
2. Schema design. Field order (reasoning first, answer last), nullable fields for "unknown", enum vs regex, required fields.
3. Failure strategy. Max retries, fallback model, graceful `null` handling, out-of-distribution refusal.
4. Validation plan. Schema compliance rate (target 100%), semantic validity (LLM-judge), field-coverage rate, latency p50/p99.

Refuse any design that puts `answer` or `decision` before reasoning fields. Refuse to use bare JSON mode without a schema. Flag recursive schemas behind an FSM-only library.
```

## Egzersizler

1. **Kolay.** Küçük bir open-weights modeli (e.g., Llama-3.2-3B) `Review(sentiment, confidence, evidence_span)` için constrained decoding kullanmadan prompt'layın. 100 değerlendirmede geçerli JSON olarak parse edilen çıktıların oranını ölçün.
2. **Orta.** Outlines JSON moduyla aynı yapı. Uyumluluk oranını, gecikmeyi ve anlamsal doğruluğu karşılaştırın.
3. **Zor.** Telefon numaraları (`\d{3}-\d{3}-\d{4}`) için sıfırdan normal ifadeyle sınırlandırılmış bir kod çözücü uygulayın. 1000 örnekte 0 geçersiz çıkışı doğrulayın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|-----------------------|
| Kısıtlı kod çözme | Geçerli çıktıyı zorla | Her nesil adımında geçersiz-token logları maskele. |
| Logit işlemci | Kısıtlayan şey | İşlev: `(logits, state) -> masked_logits`. |
| FSM | Sonlu durum makinesi | Derlenmiş gramer gösterimi; O(1) geçerli-sonraki-token araması. |
| CFG | Bağlamdan bağımsız dilbilgisi | Özyinelemeyi işleyen dilbilgisi; FSM'den daha yavaş ama daha etkileyici. |
| Şema alanı sırası | Önemli mi? | Evet — ilk alan taahhütleri; Her zaman cevaptan önce muhakemeyi koyun. |
| Kılavuzlu kod çözme | vLLM'nin buna verdiği isim | Aynı konsept, inference sunucusuna entegre edilmiştir. |
| JSON modu | OpenAI'nin ilk sürümü | JSON sözdizimini garanti eder; şema eşleşmesini garanti etmez. |

## Daha Fazla Okuma

- [Willard, Louf (2023). LLM'ler için Verimli Rehberli Üretim](https://arxiv.org/abs/2307.09702) — Outlines makalesi.
- [XGrammar makalesi (2024)](https://arxiv.org/abs/2411.15100) — hızlı CFG tabanlı kısıtlı kod çözme.
- [vLLM — Yapılandırılmış Çıkışlar](https://docs.vllm.ai/en/latest/features/structured_outputs.html) — inference sunucu entegrasyonu.
- [OpenAI — Yapılandırılmış Çıkışlar kılavuzu](https://platform.openai.com/docs/guides/structured-outputs) — API referansı + kazanımlar.
- [Eğitmen kitaplığı](https://python.useinstructor.com/) — Pydantic + sağlayıcılar arasında yeniden denemeler.
- [JSONSchemaBench (2025)](https://arxiv.org/abs/2501.10868) — benchmark6 kısıtlı kod çözme frameworks.
