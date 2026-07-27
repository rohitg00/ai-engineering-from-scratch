# Doğal Dil Inference — Metinsel Gereklilik

> "t, h'yi gerektirir", insanın t okumasıyla h'nin doğru olduğu sonucuna varacağı anlamına gelir. NLI, gerekliliği/çelişkiyi/tarafsızı tahmin etme görevidir. Yüzeyde delik işleme, üretimde yük taşıma.

**Tür:** Öğren
**Diller:** Python
**Önkoşullar:** Aşama 5 · 05 (Duygu Analizi), Aşama 5 · 13 (Soru Yanıtlama)
**Süre:** ~60 dakika

## Sorun

Bir özetleyici oluşturdunuz. Bir özet çıkardı. Özetin halüsinasyon içermediğini nereden biliyorsunuz?

Bir chatbot oluşturdunuz. "Evet" cevabını verdi. Cevabın, alınan pasaj tarafından desteklendiğini nereden biliyorsunuz?

10.000 haber makalesini konularına göre sınıflandırmanız gerekiyor. Eğitim etiketiniz yok. Bir modeli tekrar kullanabilir misiniz?

Her üç sorun da Doğal Dil Inference'ye indirgenir. NLI şunu sorar: Bir `t` öncülü ve bir `h` hipotezi verildiğinde, `h`, `t` tarafından zorunlu kılınıyor mu, çelişkili mi yoksa tarafsız mı (ilgisiz)?

- **Halüsinasyon kontrolü:** `t` = kaynak belge, `h` = özet iddia. Gereklilik değil = halüsinasyon.
- **Geçerli QA:** `t` = alınan pasaj, `h` = oluşturulan yanıt. Gereklilik değil = fabrikasyon.
- **Sıfır atış sınıflandırması:** `t` = belge, `h` = sözlü etiket ("Bu sporla ilgilidir"). Gereklilik = öngörülen etiket.

Bir görev, üç üretim kullanımı. Bu nedenle her RAG değerlendirmesi framework, kaputun altına bir NLI modeli gönderir.

## Konsept

![NLI: üç yönlü sınıflandırma, öncül ve hipotez](../assets/nli.svg)

**Üç etiket.**

- **Koşullar.** `t` → `h`. "Kedi minderin üzerinde", "Bir kedi var" anlamına gelir.
- **Çelişki.** `t` → ¬`h`. "Kedi paspasın üstünde" ifadesi "Kedi yok" ifadesi ile çelişiyor.
- **Nötr.** Her iki durumda da inference yok. "Kedi minderin üzerinde" ifadesi "Kedi aç" ifadesine karşı nötrdür.

**Mantıksal gerektirme değil.** NLI *doğal* bir dildir inference — katı bir mantık değil, tipik bir insan okuyucunun çıkarımına göre. "John köpeğini gezdirdi" NLI'de "John'un bir köpeği var" anlamına gelir, ancak birinci dereceden katı mantık bunu ancak mülkiyeti aksiyomatize ettiğinizde kabul eder.

**Dataset'ler.**

- **SNLI** (2015). 570 bin insan açıklamalı çift, tesis olarak resim başlıkları. Dar etki alanı.
- **MultiNLI** (2017). 10 türde 433 bin çift. 2026'daki standart eğitim külliyatı.
- **ANLI** (2019). Düşman NLI. İnsanlar mevcut modelleri kırmak için özel olarak tasarlanmış örnekler yazdılar. Daha güçlü.
- **DocNLI, CONTROL** (2020–21). Belge uzunluğunda tesisler. Çok atlamalı ve uzun menzilli inference'yi test eder.

**Mimari.** Bir transformer kodlayıcı (BERT, RoBERTa, DeBERTa) `[CLS] premise [SEP] hypothesis [SEP]` okur. `[CLS]` gösterimi 3 yönlü bir softmax'ı besler. MNLI üzerinde eğitim alın, uzatılmış benchmark'leri değerlendirin, dağıtım içi çiftlerde %90'ın üzerinde doğruluk elde edin.

**NLI aracılığıyla sıfır atış.** Bir belge ve aday etiketleri verildiğinde, her etiketi bir hipoteze dönüştürün ("Bu metin sporla ilgilidir"). Her biri için gereklilik olasılığını hesaplayın. Maksimum değeri seçin. Hugging Face'in `zero-shot-classification` boru hattının arkasındaki mekanizma budur.

## İnşa Et

### Adım 1: önceden eğitilmiş bir NLI modeli çalıştırın

```python
from transformers import pipeline

nli = pipeline("text-classification",
               model="facebook/bart-large-mnli",
               top_k=None)  # return all labels; replaces deprecated return_all_scores=True

premise = "The cat is sleeping on the couch."
hypothesis = "There is a cat in the room."

result = nli({"text": premise, "text_pair": hypothesis})[0]
print(result)
# [{'label': 'entailment', 'score': 0.97},
#  {'label': 'neutral', 'score': 0.02},
#  {'label': 'contradiction', 'score': 0.01}]
```

Üretim NLI için `facebook/bart-large-mnli` ve `microsoft/deberta-v3-large-mnli` açık varsayılanlardır. DeBERTa-v3 skor tablolarının zirvesinde.

### Adım 2: sıfır atış sınıflandırması

```python
zs = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")

text = "The stock market rallied after the central bank cut interest rates."
labels = ["finance", "sports", "politics", "technology"]

result = zs(text, candidate_labels=labels)
print(result)
# {'labels': ['finance', 'politics', 'technology', 'sports'],
#  'scores': [0.92, 0.05, 0.02, 0.01]}
```

Şablon "Bu örnek {label} ile ilgilidir." varsayılan olarak. `hypothesis_template` ile özelleştirin. Eğitim verisi gerekmez. fine-tuning yok. Kutunun dışında çalışır.

### Adım 3: RAG için doğruluk kontrolü

```python
def is_faithful(answer, context, threshold=0.5):
    result = nli({"text": context, "text_pair": answer})[0]
    entail = next(s for s in result if s["label"] == "entailment")
    return entail["score"] > threshold
```

Bu, RAGAS sadakatinin özüdür. Oluşturulan yanıtı atomik iddialara bölün. Her talebi, alınan bağlama göre kontrol edin. Bunu gerektiren kesri bildirin.

### Adım 4: elle haddelenmiş NLI sınıflandırıcısı (kavramsal)

Yalnızca stdlib'e özgü bir oyuncak için `code/main.py`'ye bakın: öncül ve hipotez, sözcüksel örtüşme + olumsuzluk tespiti yoluyla karşılaştırılır. transformer modelleriyle rekabet edemez - ancak görevin şeklini gösterir: iki metin girişi, 3 yönlü etiketleme, kayıp = `{entail, contradict, neutral}` üzerinde çapraz entropi.

## Tuzaklar

- **Yalnızca hipotezden oluşan kısayollar.** Modeller, SNLI'de ~%60 oranında yalnızca hipotezden etiketi tahmin edebilir çünkü "değil", "hiç kimse", "asla" çelişkiyle ilişkilidir. Etiket sızıntısını tespit etmek için güçlü temel.
- **Sözcüksel örtüşme buluşsal yöntemi.** Alt dizi buluşsal yöntemi ("her alt dizi gereklidir") SNLI'yi geçer ancak HANS/ANLI'de başarısız olur. Rakip benchmark'leri kullanın.
- **Belge uzunluğunda bozulma.** Tek cümlelik NLI modelleri, belge uzunluğu tesislerinde 20+ F1 düşer. Uzun bağlam için DocNLI tarafından eğitilmiş modelleri kullanın.
- **Sıfır atış şablon hassasiyeti.** "Bu örnek, {label} ile ilgilidir" ve "{label}" ile "Konu {label}" ile ilgilidir, doğruluğu 10'dan fazla puan artırabilir. Şablonu ayarlayın.
- **Etki alanı uyuşmazlığı.** MNLI genel İngilizce eğitimi verir. Yasal, tıbbi ve bilimsel metinler, alana özgü NLI modellerine (e.g., SciNLI, MedNLI) ihtiyaç duyar.

## Kullan onu

2026 yığını:

| Kullanım örneği | Modeli |
|---------|-------|
| Genel amaçlı NLI | `microsoft/deberta-v3-large-mnli` |
| Hızlı / kenar | `cross-encoder/nli-deberta-v3-base` |
| Sıfır atış sınıflandırması (hafif) | `facebook/bart-large-mnli` |
| Belge düzeyinde NLI | `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli` |
| Çok dilli | `MoritzLaurer/multilingual-MiniLMv2-L6-mnli-xnli` |
| RAG'da halüsinasyon tespiti | RAGAS / DeepEval içindeki NLI katmanı |

2026 meta modeli: NLI, metin anlamanın koli bandıdır. Ne zaman "A, B'yi destekliyor?" veya "A, B ile çelişiyor mu?" — başka bir LLM çağrısına ulaşmadan önce NLI'ye ulaşın.

## Gönderin

`outputs/skill-nli-picker.md` olarak kaydet:

```markdown
---
name: nli-picker
description: Pick an NLI model, label template, and evaluation setup for a classification / faithfulness / zero-shot task.
version: 1.0.0
phase: 5
lesson: 21
tags: [nlp, nli, zero-shot]
---

Given a use case (faithfulness check, zero-shot classification, document-level inference), output:

1. Model. Named NLI checkpoint. Reason tied to domain, length, language.
2. Template (if zero-shot). Verbalization pattern. Example.
3. Threshold. Entailment cutoff for the decision rule. Reason based on calibration.
4. Evaluation. Accuracy on held-out labeled set, hypothesis-only baseline, adversarial subset.

Refuse to ship zero-shot classification without a 100-example labeled sanity check. Refuse to use a sentence-level NLI model on document-length premises. Flag any claim that NLI solves hallucination — it reduces it; it does not eliminate it.
```

## Egzersizler

1. **Kolay.** `facebook/bart-large-mnli`'yi üç sınıfın tümünü kapsayan 20 el yapımı (öncül, hipotez, etiket) üçlü üzerinde çalıştırın. Doğruluğu ölçün. Rakip "sonraki buluşsal" tuzaklar ekleyin ("Pastayı yemedim" vs "Pastayı yedim") ve kırılıp kırılmadığına bakın.
2. **Orta.** Sıfır atış şablonunu `"This text is about {label}"` ile 100 AG Haber manşetlerindeki `"The topic is {label}"` ve `"{label}"` ile karşılaştırın. Doğruluk salınımını rapor edin.
3. **Zor.** Bir RAG doğruluk denetleyicisi oluşturun: atomik iddia ayrıştırması + iddia başına NLI. RAG tarafından oluşturulan 50 yanıtı altın bağlamla değerlendirin. El etiketlerine göre yanlış pozitif ve yanlış negatif oranları ölçün.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|-----------------------|
| NLI | Doğal Dil Inference | Öncül-hipotez ilişkisinin 3 yönlü sınıflandırılması. |
| RTE | Metinsel Gerekliliği Tanıma | NLI'nin eski adı; aynı görev. |
| Gereklilik | "t h anlamına gelir" | Tipik bir okuyucu t verildiğinde h'nin doğru olduğu sonucuna varacaktır. |
| Çelişki | "t h'yi dışlıyor" | Tipik bir okuyucu, t göz önüne alındığında h'nin yanlış olduğu sonucuna varacaktır. |
| Nötr | "kararsızım" | Her iki durumda da t'den h'ye inference yok. |
| Sıfır atış sınıflandırması | sınıflandırıcı olarak NLI | Etiketleri hipotez olarak sözlü hale getirin, maksimum gerekliliği seçin. |
| Sadakat | Cevap destekleniyor mu? | NLI bitti (alınan bağlam, oluşturulan yanıt). |

## Daha Fazla Okuma

- [Bowman ve ark. (2015). Doğal dil öğrenmeye yönelik geniş açıklamalı bir külliyat inference](https://arxiv.org/abs/1508.05326) — SNLI.
- [Williams, Nangia, Bowman (2017). Inference](https://arxiv.org/abs/1704.05426) — MultiNLI Aracılığıyla Cümleyi Anlamak için Geniş Kapsamlı Bir Zorluk Derlemi.
- [Nie ve ark. (2019). Çekişmeli NLI](https://arxiv.org/abs/1910.14599) — ANLI benchmark.
- [Yin, Hay, Roth (2019). Benchmarking Sıfır Atışlı Metin Sınıflandırması](https://arxiv.org/abs/1909.00161) — Sınıflandırıcı olarak NLI.
- [O ve ark. (2021). DeBERTa: Çözülmüş Dikkat ile Kod Çözme özelliği geliştirilmiş BERT](https://arxiv.org/abs/2006.03654) — 2026 NLI'nın güçlü ürünü.
