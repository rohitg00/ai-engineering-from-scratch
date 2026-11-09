# Yapılandırılmış Çıktımlar ve Zorlu Çözümleme

> JSON için LLM'den isteyin. Çoğu zaman JSON alın. Üretimde, "çoğu" sorundur. Sınırlama yapmadan önce logitleri düzenleyerek kısıtlı dekodlama "çoğu"yı "her zaman"a dönüştürür.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 17 (Chatbots), Phase 5 · 19 (Subword Tokenization)
**Time:** ~60 minutes

## Sorun

Bir sınıflandırıcı bir LLM'yi uyarır: " {pozitif, negatif, tarafsız} birini geri gönderin. " Model "Sentiman olumlu  bu inceleme aşırı derecede olumlu çünkü müşteri açıkça belirtir ki ...".

Özgür biçim üretimi bir sözleşme değil, bir önerimdir.

2026'da üç katman var.

1. **Prompting.**İyice sor. "Sadece JSON nesnesini geri gönder". Sınır modellerinde %80 oranında çalışır, daha küçüklerde daha az.
2. **Native structured output APIs.**Açıklama`response_format`, Antropik araç kullanımı, Gemini JSON modunda desteklenen şemalara güvenilir.
3. **Constrained decoding.**Logitleri her nesil adımında değiştirin böylece model *bilmez* geçersiz tokenler yayımlayabilir. %100 inşaat olarak geçerlidir.

Bu ders, üçü için de içgüdü geliştirir ve hangisine ulaşmak için ne zaman başvurmak gerektiğini belirler.

## Anlaşım

![Constrained decoding masking invalid tokens at each step](../assets/constrained-decoding.svg)

**How constrained decoding works.**LLM, her nesil adımında, tüm kelime birikimi üzerinde bir logit vektörü (~ 100k token) üretir. *Logit işlemcisi* model ve örnekleme cihazı arasında yer alır. Hedef gramerindeki mevcut pozisyonu göz önünde bulundurarak hangi jetonların geçerli olduğunu hesaplar  JSON Schema, regex, bağlamsız gramer  ve tüm geçersiz jetonların logitlerini negatif sonsuzluk olarak ayarlar. Geri kalan logitler üzerindeki yumuşak maksimum, olasılık kütlesini sadece geçerli devamlar üzerine koyar.

2026 yılındaki uygulamalar:

- **Outlines.**JSON Şema veya Regex'i sonlu bir makineye oluşturur.$O(1)$FSM tabanlı, bu yüzden geri dönüşlü sistemler düzeltilmelidir.
- **XGrammar / llguidance.**Açıklama, bağlamsız dilbilgisi motorları. Rekürsiv JSON Şema'yı işleme. Yaklaşık sıfır dekodlama üst düzey. OpenAI 2025 yapılandırılmış çıkış uygulamasında yönlendirmeyi kabul etti.
- **vLLM guided decoding.**İçeriye Eklenmiş`guided_json`- Evet .`guided_regex`- Evet .`guided_choice`- Evet .`guided_grammar`Süzler, XGrammar veya lm formatı uygulayıcı arka planları üzerinden.
- **Instructor.**Pydantic tabanlı ambalaj herhangi bir LLM üzerinde. Validasyon başarısızlığı üzerine geri çalışır. Cross-provider, ancak logitleri değiştirmez  yeniden deneylere + yapılandırılmış çıkış-açıklama bilgileri isteklerine dayanır.

### Anlaşılan karşıt sonuç

Sınırlı çözme genellikle kısıtlı oluşturulmadan * daha hızlı *. İki neden. Birincisi, bir sonraki belirti arama alanını azaltır. İkincisi, akıllı uygulamalar zorlu belirtiler için belirti üretimini tamamen atlar (scaffolding gibi `{"name": "` her bayt belirlenir).

### Seni mahveden tuzağa

Alan düzeninin önemi var.`answer`Daha önce`reasoning`JSON geçerlidir. Yanlış cevap. Hiçbir doğrulama onu yakalamaz.

```json
// BAD
{"answer": "yes", "reasoning": "because ..."}

// GOOD
{"reasoning": "... therefore ...", "answer": "yes"}
```

Şema alanları sırası, formattırma değil mantıklı.

```figure
constrained-decoder
```

## Yapın

### Adım 1: Regex kısıtlı nesil sıfırdan

Bakın .`code/main.py`30 satırlık temel fikir:

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

FSM, şimdiye kadar hangi dilbilgisi kısımlarını izlediğimizi takip ediyor.`valid_tokens(state, tokenizer)`FSM'nin kabul yolu bırakmadan hangi sözlük toponlarının ilerleyebileceğini hesaplar.

### Adım 2: JSON Şeması Açıklamaları

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

FSM geçersiz çıkışları erişilemez hale getirir.

### Adım 3: Pydantic' in tedarikçi-agnostik eğitmeni

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

Farklı mekanizma. Öğretmen logitlere dokunmaz. Şema'yı istekle biçimlendirir, çıkışını analiz eder ve onaylama başarısızlığı (ergin olarak 3 kez) için tekrar çalışır. Herhangi bir sağlayıcıyla çalışır. Geri deneyler gecikme ve maliyet ekler.

### Adım 4: Doğal Satıcı API'leri

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

Sunucu tarafında kısıtlı şifreleme, desteklenen şemalar için güvenilirlik paritesi, yerel model yönetimi yok, satıcıya kilitli.

## Tuzaklar

- **Recursive schemas.**Çizgi çizgiler, geri dönüşü sabit bir derinliğe düzeltir.Ağaç yapılı çıkışlar (köşük yorumlar, AST) XGrammar veya ilguidance (CFG tabanlı) gerektirir.
- **Huge enums.**10.000 seçenek enum yavaş veya zaman dışarı oluşturur. bir retriever geç: önce en iyi adayları tahmin, sınırlama.
- **Grammar too strict.**Güç .`date: "YYYY-MM-DD"`Regex ve model çıkarabilir `"unknown"`Model bir tarih icat ederek telafi eder.`null`Ya da bir bekçi.
- **Premature commitment.**Yukarıda yer alan bir tuzak gör.
- **Vendor JSON mode without schema.**Temiz JSON modu sadece geçerli JSON'u garanti eder, *kullanım durumunuz için geçerli değildir*. Her zaman tam bir şema sağlayın.

## Kullan

2026'da:

| Situation | Pick |
|-----------|------|
| OpenAI/Anthropic/Google model, simple schema | Native vendor structured output |
| Any provider, Pydantic workflow, can tolerate retries | Instructor |
| Local model, need 100% validity, flat schema | Outlines (FSM) |
| Local model, recursive schema | XGrammar or llguidance |
| Self-hosted inference server | vLLM guided decoding |
| Batch processing with retries acceptable | Instructor + cheapest model |

## Gönder

- Kaydet .`outputs/skill-structured-output-picker.md`- ...

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

1. **Easy.**Küçük açık ağırlıklı bir model (örneğin Llama-3.2-3B) oluşturmak için kısıtlı bir kodlama yapmayın.`Review(sentiment, confidence, evidence_span)`. 100 inceleme üzerinde geçerli JSON olarak analiz edilen bölümü ölçün.
2. **Medium.**JSON moduna benzer bir korpus. Uyum oranı, gecikme ve semantik doğruluk ile karşılaştırın.
3. **Hard.**Telefon numaraları için regex kısıtlı bir dekodör uygulaması (`\d{3}-\d{3}-\d{4}`) 1000 numune üzerinde 0 geçersiz çıkışı doğrula.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Constrained decoding | Force valid output | Mask invalid-token logits at every generation step. |
| Logit processor | The thing that constrains | Function: `(logits, state) -> masked_logits`. |
| FSM | Finite-state machine | Compiled grammar representation; $O(1)$ valid-next-token lookup. |
| CFG | Context-free grammar | Grammar that handles recursion; slower but more expressive than FSM. |
| Schema field order | Does it matter? | Yes — first field commits; always put reasoning before answer. |
| Guided decoding | vLLM's name for it | Same concept, integrated into the inference server. |
| JSON mode | OpenAI's early version | Guarantees JSON syntax; does NOT guarantee schema match. |

## Daha Fazla Okumak

- [Willard, Louf (2023). Efficient Guided Generation for LLMs](https://arxiv.org/abs/2307.09702) Outlines gazetesi.
- [XGrammar paper (2024)](https://arxiv.org/abs/2411.15100) CFG tabanlı hızlı kısıtlı şifreleme.
- [vLLM — Structured Outputs](https://docs.vllm.ai/en/latest/features/structured_outputs.html) İhtiyaçlı sunucu entegrasyonu.
- [OpenAI — Structured Outputs guide](https://platform.openai.com/docs/guides/structured-outputs) API referansı + gotchas.
- [Instructor library](https://python.useinstructor.com/) Pydantic +, tüm tedarikçiler arasında yeniden denemeler yapıyor.
- [JSONSchemaBench (2025)](https://arxiv.org/abs/2501.10868) Benchmarking 6 kısıtlı dekodlama çerçevesini.
