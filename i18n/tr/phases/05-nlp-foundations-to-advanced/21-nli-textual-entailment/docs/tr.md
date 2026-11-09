# Doğal Dil Değerlendirme  Metin İçin Değişiklik

> "t h içerir" anlamı, t'nin insan okuma sonucu olarak h doğru olduğu anlamına gelir. NLI, içerme / çelişki / tarafsızlık öngörme görevi.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 05 (Sentiment Analysis), Phase 5 · 13 (Question Answering)
**Time:** ~60 minutes

## Sorun

Bir özetleme yaptırdın, özetleme yaptı.

Bir chatbot yaptın. "Evet" cevabını verdi. Cevabın alınan pasajla desteklendiğini nereden biliyorsun?

10.000 haber makalesini konuya göre sınıflandırmak gerekiyor.

Bu üç sorun da doğal dil çıkarımına dönüşür.`t`ve bir hipotez.`h`, `h``t`, çelişkili mi yoksa tarafsız mı (ait değil)?

- **Hallucination check:** `t`= Kaynak belge, `h`- Bu bir halüsinasyon değil.
- **Grounded QA:** `t`= alınmış geçiş,`h`- Bu cevaplar, sonuçlar değil.
- **Zero-shot classification:** `t`= belge,`h`= sözlü etiket ("Bu sporla ilgili").

Bir görev, üç üretim kullanımı. Bu yüzden her RAG değerlendirme çerçevesinde NLI modeli kapuk altına gönderilir.

## Anlaşım

![NLI: three-way classification, premise vs hypothesis](../assets/nli.svg)

**The three labels.**

- **Entailment.** `t`→ `h`"Kedi çarşafta" demek "Bir kedi var".
- **Contradiction.** `t`→`h`"Kedi çarşafta" "Kedi yok"a aykırı.
- **Neutral.**"Kedi çarşafta" "Kedi aç" ile karşılaştırıldığında tarafsızdır.

**Not logical entailment.**NLI, tipik bir insan okuyucuunun kesin mantıkla değil, kesin bir mantıkla çıkarması gereken * doğal * dil sonucu. "John dog walked his dog" NLI'de "John has a dog" anlamına gelir, ancak kesin bir birinci sınıf mantık, sahipliği aksiomatleştirirseniz bunu kabul eder.

**Datasets.**

- **SNLI**(2015). 570k insan tarafından not edilen çiftler, yer olarak görüntü başlıkları.
- **MultiNLI**2026 yılında standart eğitim kursu.
- **ANLI**(2019). Düşman NLI. İnsanlar mevcut modelleri kırmak için özel olarak tasarlanmış örnekler yazdı.
- **DocNLI, ConTRoL**(202021). Belge uzunluğu tesisleri.

**The architecture.**Bir transformatör kodlayıcı (BERT, RoBERTa, DeBERTa) okuyor `[CLS] premise [SEP] hypothesis [SEP]`- Ne ?`[CLS]`MNLI'de çalıştırmak, tutulan referans değerleri üzerinde değerlendirmek, dağıtımdaki çiftlerde %90+ doğruluk elde etmek.

**Zero-shot via NLI.**Bir belge ve aday etiketleri verildiğinde, her etiketini bir hipoteze dönüştürün ("Bu metin spor hakkında"). Her birinin içerik olasılığını hesaplayın. Maksimum seçin. Bu Hugging Face'ın arkasındaki mekanizmadır `zero-shot-classification`- Boru hattı.

```figure
nli-router
```

## Yapın

### Adım 1: önceden eğitilmiş bir NLI modeli çalıştır

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

Üretim NLI için, `facebook/bart-large-mnli`ve `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli`DeBERTa-v3 sıralama çizelgeleri üstündedir.

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

Şablon varsayılan olarak "Bu örnek yaklaşık {etiket}." olarak belirlenir.`hypothesis_template`Eğitim verileri gerekmiyor, ince ayarlamalar gerekmiyor, kasadan çıkıyor.

### Adım 3: RAG için sadakat kontrolü

```python
def is_faithful(answer, context, threshold=0.5):
    result = nli({"text": context, "text_pair": answer})[0]
    entail = next(s for s in result if s["label"] == "entailment")
    return entail["score"] > threshold
```

Bu RAGAS sadakatinin çekirdeğidir. Yaratılan cevabı atom iddialarına bölün. Her iddiayı alınan bağlamla kontrol edin.

### 4. adım: Elle yuvarlanan NLI sınıflandırıcısı (konseptik)

Bakın .`code/main.py`Sadece stdlib oyuncak için: premise ve hipotezi leksik üst üstelik + inkâr tespit yoluyla karşılaştırılır. Transformer modelleriyle rekabetçi değil  ama görevin şeklini gösterir: iki metin içeri, üç yönlü etiket dışarı, kayb = çapraz entropi üzerinde `{entail, contradict, neutral}`- Evet .

## Tuzaklar

- **Hypothesis-only shortcuts.**Modeller, SNLI'de sadece hipotezden etiketleri% 60'da tahmin edebilir çünkü "hayır", "hiç kimse", "hiçbir zaman" çelişki ile ilişkilidir.
- **Lexical overlap heuristic.**Sonraki heuristik ("her sonraklılık içerir") SNLI'yi geçer ancak HANS/ANLI'yi başarısız eder.
- **Document-length degradation.**Tek cümle NLI modelleri, belge uzunluğu olan yerlerde 20+ F1 düşürür.
- **Zero-shot template sensitivity.**"Bu örnek {etiket}" vs "{etiket}" vs "Teması {etiket}" doğruluğunu 10+ puan değiştirebilir. Şablonu ayarlayın.
- **Domain mismatch.**MNLI genel İngilizce eğitimini sağlar. Hukuk, tıbbi ve bilimsel metin alanlara özel NLI modellerine ihtiyaç duyar (örneğin, SciNLI, MedNLI).

## Kullan

2026'da:

| Use case | Model |
|---------|-------|
| General-purpose NLI | `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli` |
| Fast / edge | `cross-encoder/nli-deberta-v3-base` |
| Zero-shot classification (lightweight) | `facebook/bart-large-mnli` |
| Document-level NLI | `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli` |
| Multilingual | `MoritzLaurer/multilingual-MiniLMv2-L6-mnli-xnli` |
| Hallucination detection in RAG | NLI layer inside RAGAS / DeepEval |

2026 meta-önemesi: NLI metin anlama yapıştırıcı bandıdır. "A B'yi destekliyor mu?" veya "A B'ye karşı çıkıyor mu?"

## Gönder

- Kaydet .`outputs/skill-nli-picker.md`- ...

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

1. **Easy.**Çık .`facebook/bart-large-mnli`20 el yapımı (premise, hipotez, etiket) üç sınıfı kapsayan üçlü üzerinde. Düzgünliği ölçün.
2. **Medium.**sıfır çekim şablonunu karşılaştır `"This text is about {label}"``"The topic is {label}"`ve `"{label}"`100 AG Haber başlıklarında.
3. **Hard.**RAG sadakat kontrolcüsü oluşturun: atomik iddia ayrıntı + iddia başına NLI. Altın bağlamlı 50 RAG oluşturulan yanıt üzerinde değerlendirin. Yanlış olumlu ve yanlış olumsuz oranları ile el etiketleri karşılaştırın.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| NLI | Natural Language Inference | 3-way classification of premise-hypothesis relationship. |
| RTE | Recognizing Textual Entailment | Older name for NLI; same task. |
| Entailment | "t implies h" | A typical reader would conclude h is true given t. |
| Contradiction | "t rules out h" | A typical reader would conclude h is false given t. |
| Neutral | "undecided" | No inference from t to h either way. |
| Zero-shot classification | NLI as classifier | Verbalize labels as hypotheses, pick max entailment. |
| Faithfulness | Is the answer supported? | NLI over (retrieved context, generated answer). |

## Daha Fazla Okumak

- [Bowman et al. (2015). A large annotated corpus for learning natural language inference](https://arxiv.org/abs/1508.05326) SNLI.
- [Williams, Nangia, Bowman (2017). A Broad-Coverage Challenge Corpus for Sentence Understanding through Inference](https://arxiv.org/abs/1704.05426) MultiNLI.
- [Nie et al. (2019). Adversarial NLI](https://arxiv.org/abs/1910.14599) ANLI referans değerini.
- [Yin, Hay, Roth (2019). Benchmarking Zero-shot Text Classification](https://arxiv.org/abs/1909.00161) NLI-as-classifier.
- [He et al. (2021). DeBERTa: Decoding-enhanced BERT with Disentangled Attention](https://arxiv.org/abs/2006.03654) 2026 NLI iş atı.
