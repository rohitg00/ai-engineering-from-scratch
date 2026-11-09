# Diyalog Durum Takip

> "Şimalde ucuz bir restoran istiyorum... aslında onu moderat yapıp İtalyanca ekle". Üç dönüş, üç devlet güncelleme.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 17 (Chatbots), Phase 5 · 20 (Structured Outputs)
**Time:** ~75 minutes

## Sorun

Görev odaklı bir diyalog sisteminde, kullanıcı hedefi bir slot değer çiftleri kümesi olarak kodlanır: `{cuisine: italian, area: north, price: moderate}`Her kullanıcı bir yuva ekleyebilir, değiştirebilir veya kaldırabilir. Sistem tüm konuşmayı okumalı ve mevcut durumu doğru şekilde çıkartmalıdır.

Bir slot yanlış olursa sistem yanlış restoranı kaydeder, yanlış uçuşu programlar veya yanlış kartı ücretlendirir.

2026 yılında LLM'lere rağmen neden hâlâ önemli:

- Uyumluğa duyarlı alanlar (bankacılık, sağlık, hava yolculuğu rezervasyonu) serbest biçim üretimi değil, belirleyici slot değerlerini gerektirir.
- Araç kullanımı ajanları hala API'leri aramak için boşluk çözünürlüğüne ihtiyaç duyarlar.
- Çok dönüşlü düzeltme görünüşünden daha zor: "Gerçekten hayır, Perşembe yapın".

Modern boru hattı: klasik DST kavramları + LLM ekstraktörleri + yapılandırılmış çıkış koruyucu rayları.

## Anlaşım

![DST: dialog history → slot-value state](../assets/dst.svg)

**Task structure.**Bir şema alanları (restaurant, otel, taksi) ve yuvalarını (mutfak, alan, fiyat, insanlar) tanımlar. Her yuva boş olabilir, kapalı bir setten bir değerle doldurulabilir ( fiyat: { ucuz, ortalama, pahalı}), veya serbest bir değerle (adı: "Bakır Kettle ").

**Two DST formulations.**

- **Classification.**Her (slot, candidate_value) çift için evet/hayır tahmin edin. Kapalı kelime slots için çalışır. 2020'ye kadar standart.
- **Generation.**Diyaloglar verildiğinde, boş metin olarak slot değerleri oluşturun. Açık kelime slots için çalışır. Modern varsayılan.

**Metric.**Ortak Hedef Düzgünliği (JGA)  * her * slotun doğru olduğu virajların bölümü.

**Architectures.**

1. **Rule-based (slot regex + keyword).**Sıkı alanlar için güçlü bir başlangıç çizgisi.
2. **TripPy / BERT-DST.**BERT kodlaması ile kopyalı üretim.
3. **LDST (LLaMA + LoRA).**Eğitim ayarlı ve domen yuvası uyarı ile LLM. MultiWOZ 2.4 üzerinde ChatGPT seviyesine ulaşır.
4. **Ontology-free (2024–26).**Şema atlayın; doğrudan slot isimleri ve değerleri oluşturun. Açık alanları ele alır.
5. **Prompt + structured output (2024–26).**LLM Pydantic şema + kısıtlı çözme. 5 satır kod, üretim hazır.

### Klasik başarısızlık modları

- **Co-reference across turns.**"İlk seçeneği seçelim". Hangi seçeneği çözmek gerekiyor.
- **Over-write vs append.**Kullanıcı "İtalyanca ekle" diyor.
- **Implicit confirmations.**"OK güzel"  Bu teklif edilen rezervasyonu kabul etti mi?
- **Correction.**"Aslında saat 7'de olsun". Başka yerleri açmadan saatleri güncellemeli.
- **Coreference to previous system utterance.**"Evet, o. " Hangi "o"?

```figure
n5-slot-tracker
```

## Yapın

### Adım 1: Kurallara dayalı yuva çıkarıcı

Bakın .`code/main.py`. Regex + eşya sözlükleri , sıkı alanlarda bulunan kanonik ifadelerin % 70'ini kapsar:

```python
CUISINE_SYNONYMS = {
    "italian": ["italian", "pasta", "pizza", "italy"],
    "chinese": ["chinese", "chow mein", "noodles"],
}


def extract_cuisine(utterance):
    for canonical, synonyms in CUISINE_SYNONYMS.items():
        if any(syn in utterance.lower() for syn in synonyms):
            return canonical
    return None
```

Kanonik kelimeforum dışında kırık, belirleyici boşluk onayları için çalışır.

### Adım 2: Durum güncelleme döngüsü

```python
def update_state(state, utterance):
    new_state = dict(state)
    for slot, extractor in SLOT_EXTRACTORS.items():
        value = extractor(utterance)
        if value is not None:
            new_state[slot] = value
    for slot in NEGATION_CLEARS:
        if is_negated(utterance, slot):
            new_state[slot] = None
    return new_state
```

Üç değişken:

- Kullanıcının dokunmadığı bir yuva asla yeniden ayarlamayın.
- Açık bir inkar ("mutfakla ilgilenmeyin") netleşmelidir.
- Kullanıcı düzeltmesi ("gerçekten...") eklemek yerine yazılmalıdır.

### Adım 3: Struktürlü çıkış ile LLM yönlendirilmiş DST

```python
from pydantic import BaseModel
from typing import Literal, Optional
import instructor

class RestaurantState(BaseModel):
    cuisine: Optional[Literal["italian", "chinese", "indian", "thai", "any"]] = None
    area: Optional[Literal["north", "south", "east", "west", "center"]] = None
    price: Optional[Literal["cheap", "moderate", "expensive"]] = None
    people: Optional[int] = None
    day: Optional[str] = None


def llm_dst(history, llm):
    prompt = f"""You track the slot values of a restaurant booking across turns.
Dialogue so far:
{render(history)}

Update the state based on the latest user turn. Output only the JSON state."""
    return llm(prompt, response_model=RestaurantState)
```

Instructor + Pydantic geçerli bir durum nesnesini garanti eder.

### 4. Adım: JGA değerlendirme

```python
def joint_goal_accuracy(predicted_states, gold_states):
    correct = sum(1 for p, g in zip(predicted_states, gold_states) if p == g)
    return correct / len(predicted_states)
```

Kalibrasyon: sistem tüm slotları hangi bölümde doğru yapar? MultiWOZ 2.4 için, en iyi 2026 sistemleri: 80-83%.

### Adım 5: Yönetim düzeltmesi

```python
CORRECTION_CUES = {"actually", "no wait", "on second thought", "change that to"}


def is_correction(utterance):
    return any(cue in utterance.lower() for cue in CORRECTION_CUES)
```

Bir tespit edilen düzeltme üzerine, eklemek yerine son güncellenmiş boşluğu yazın. LLM yardımı olmadan doğru olmak zordur. Modern örnektir: her zaman LLM'nin tarihten tüm durumu güncelleştirmesine izin verin.

## Tuzaklar

- **Full-history regeneration cost.**LLM ' nin her dönüşte yeniden kurulmasına izin vermek , maliyetleri artırır .$O(n^2)$Toplam tokenler. Kap geçmişi veya eski dönümleri özetlemek.
- **Schema drift.**Post hoc yeni yuvalar eklemek eski eğitim verilerini kırır.
- **Case sensitivity.**"İtalyan" vs. "İtalyan" vs. "İtalyan"  her yerde normalleşir.
- **Implicit inheritance.**Kullanıcı daha önce "4 kişi için" belirlediyse, farklı bir zaman için yeni bir talebin insanları temizlemesi gerekmez.
- **Free-form vs closed-set.**Adlar, saatler ve adresler serbest şekil slotları gerektirir; mutfaklar ve alanlar kapalıdır.

## Kullan

2026'da:

| Situation | Approach |
|-----------|----------|
| Narrow domain (one or two intents) | Rule-based + regex |
| Broad domain, labeled data available | LDST (LLaMA + LoRA on MultiWOZ-style data) |
| Broad domain, no labels, prod-ready | LLM + Instructor + Pydantic schema |
| Spoken / voice | ASR + normalizer + LLM-DST |
| Multi-domain booking flow | Schema-guided LLM with per-domain Pydantic models |
| Compliance-sensitive | Rule-based primary, LLM fallback with confirmation flow |

## Gönder

- Kaydet .`outputs/skill-dst-designer.md`- ...

```markdown
---
name: dst-designer
description: Design a dialogue state tracker — schema, extractor, update policy, evaluation.
version: 1.0.0
phase: 5
lesson: 29
tags: [nlp, dialogue, task-oriented]
---

Given a use case (domain, languages, vocab openness, compliance needs), output:

1. Schema. Domain list, slots per domain, open vs closed vocabulary per slot.
2. Extractor. Rule-based / seq2seq / LLM-with-Pydantic. Reason.
3. Update policy. Regenerate-whole-state / incremental; correction handling; negation handling.
4. Evaluation. Joint Goal Accuracy on a held-out dialogue set, slot-level precision/recall, confusion on the hardest slot.
5. Confirmation flow. When to explicitly ask the user to confirm (destructive actions, low-confidence extractions).

Refuse LLM-only DST for compliance-sensitive slots without a rule-based secondary check. Refuse any DST that cannot roll back a slot on user correction. Flag schemas without version tags.
```

## Egzersizler

1. **Easy.**Kurallara dayalı bir devlet izleme cihazı oluşturun `code/main.py`3 slot için (mutfak, alan, fiyat) 10 el yapımı diyalog üzerinde test. JGA ölçüm.
2. **Medium.**Aynı veri kümesi, Enstrüctor + Pydantic + küçük bir LLM ile. JGA'yı karşılaştırın. En zor dönüşleri inceleyin.
3. **Hard.**Her iki yönü de uygulayın: kural tabanlı ilk, kural tabanlı < 2 boşluk güvenle yayıldığında LLM geri dönüşü.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| DST | Dialogue state tracking | Maintain the slot-value dict across dialogue turns. |
| Slot | Unit of user intent | Named parameter the backend needs (cuisine, date). |
| Domain | The task area | Restaurant, hotel, taxi — sets of slots. |
| JGA | Joint Goal Accuracy | Fraction of turns where every slot is correct. All-or-nothing. |
| MultiWOZ | The benchmark | Multi-domain WOZ dataset; standard DST evaluation. |
| Ontology-free DST | No schema | Generate slot names and values directly, no fixed list. |
| Correction | "Actually..." | Turn that overwrites a previously-filled slot. |

## Daha Fazla Okumak

- [Budzianowski et al. (2018). MultiWOZ — A Large-Scale Multi-Domain Wizard-of-Oz](https://arxiv.org/abs/1810.00278) Kanonik referans.
- [Feng et al. (2023). Towards LLM-driven Dialogue State Tracking (LDST)](https://arxiv.org/abs/2310.14970) DST için LLaMA + LoRA talimat ayarlaması.
- [Heck et al. (2020). TripPy — A Triple Copy Strategy for Value Independent Neural Dialog State Tracking](https://arxiv.org/abs/2005.02877) kopyalı DST iş atı.
- [King, Flanigan (2024). Unsupervised End-to-End Task-Oriented Dialogue with LLMs](https://arxiv.org/abs/2404.10753) EM tabanlı denetimsiz ölüm.
- [MultiWOZ leaderboard](https://github.com/budzianowski/multiwoz) Kanonik DST sonuçları.
