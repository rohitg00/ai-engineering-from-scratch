# Çok dilli NLP

> Bir model, 100+ dil, çoğu için sıfır eğitim verisi. Diller arası transfer 2020'lerin pratik mucizesidir.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 04 (GloVe, FastText, Subword), Phase 5 · 11 (Machine Translation)
**Time:** ~45 minutes

## Sorun

İngilizce milyarlarca etiketli örneğe sahiptir. Urdu binlerce. Maithili neredeyse hiç bir şey. Küresel bir kitleye hizmet eden herhangi bir pratik NLP sistemi görev-özel eğitim verileri olmayan uzun kuyruğu dillerde çalışmalıdır.

Çok dilli modeller, bir modelin birden fazla dilde aynı anda eğitilmesiyle bunu çözer. Paylaşılan temsil, modelin yüksek kaynaklı dillerde öğrenilen becerileri düşük kaynaklı dillere aktarmasına olanak sağlar. İngilizce duygu analizi modelini ince ayarlayın ve bu, şaşırtıcı derecede iyi duygu tahminlerini Urdu dilinde ortaya çıkarır. Bu sıfır çekimli diller arası transfer ve NLP'nin dünyaya nasıl gönderildiğini yeniden şekillendirdi.

Bu ders, değişimlerin, kanonik modellerin ve ekiplerin çok dilli çalışmaya yeni başlamasını sağlayan tek kararın adını veriyor: transfer için bir kaynak dili seçmek.

## Anlaşım

![Cross-lingual transfer via shared multilingual embedding space](../assets/multilingual.svg)

**Shared vocabulary.**Çok dilli modeller tüm hedef dillerden metin üzerine eğitilmiş bir SentencePiece veya WordPiece işaretleyicisini kullanır. Sözlük paylaşılan: aynı alt kelime birimi ilgili diller arasında aynı morfemi temsil eder. `anti-`İngilizce ve İtalyanca aynı işaret.

**Shared representation.**Birçok dilde maskeli dil modelleme konusunda önceden eğitilmiş bir transformer, farklı dillerde semantik olarak benzer cümlelerin benzer gizli durumlar ürettiğini öğrenir. mBERT, XLM-R ve NLLB hepsi bunu gösterir.

**Zero-shot transfer.**Model, bir dilde (genellikle İngilizce) etiketlenmiş verilere dayalı modelde ince ayarlama yapın. Sonuç olarak, modelin desteklediği diğer dillerde çalıştırın. Hedef dili etiketlerine ihtiyaç yoktur. Sonuçlar tipolojik olarak ilişkili dillerde güçlüdür ve uzak dillerde daha zayıfdır.

**Few-shot fine-tuning.**Hedef dili 100-500 etiketli örnek ekleyin. Düzgünlük sınıflandırma görevleri için İngilizce temel çizginin 95-98%'ine kadar atlar. Bu, çok dilli NLP'de en ekonomik tek kaldıraçtır.

## Modeller

| Model | Year | Coverage | Notes |
|-------|------|----------|-------|
| mBERT | 2018 | 104 languages | Trained on Wikipedia. First practical multilingual LM. Weak on low-resource. |
| XLM-R | 2019 | 100 languages | Trained on CommonCrawl (much larger than Wikipedia). Sets the cross-lingual baseline. Base 270M, Large 550M. |
| XLM-V | 2023 | 100 languages | XLM-R with 1M-token vocabulary (vs 250k). Better on low-resource. |
| mT5 | 2020 | 101 languages | T5 architecture for multilingual generation. |
| NLLB-200 | 2022 | 200 languages | Meta's translation model; includes 55 low-resource languages. |
| BLOOM | 2022 | 46 languages + 13 programming | Open 176B LLM trained multilingually. |
| Aya-23 | 2024 | 23 languages | Cohere's multilingual LLM. Strong on Arabic, Hindi, Swahili. |

Kullanımsal durumlara göre seçin. Sınıflama akılda kalmış varsayım olarak XLM-R tabanıyla iyi çalışır. Doğruluk görevleri çevirime göre açık nesil için mT5 veya NLLB gerektirir. Açık bir çok dilli istek kullanan Aya-23 veya Claude ile LLM tarzında iş çiftleri.

## Kaynak dili kararı (2026 araştırması)

Çoğu ekip, ince ayarlama kaynağı olarak İngilizce'yi varsayım olarak kullanır.

Dil benzerliği, transfer kalitesini ham korpus boyutundan daha iyi tahmin eder. Slavic hedefleri için, Almanca veya Rusça genellikle İngilizce'yi yener.**qWALS**Dünya Dil Yapıları Atlası özelliklerine dayanan 2026 benzerlik metrikası bunu ölçüyor. **LANGRANK**(Lin et al., ACL 2019) dil benzerliği, korpus boyutu ve genetik ilişki kombinasyonundan aday kaynak dillerini sıralayan ayrı, daha eski bir yöntemdir.

Uygulanabilir kurallar: Eğer hedef dilizin tipik olarak yakın bir kaynaklı akrabası varsa, önce onu ince ayarlamaya çalışın, sonra İngilizce ince ayarına karşılaştırın.

```figure
n5-crosslingual-bridge
```

## Yapın

### Adım 1: sıfır çekimli diller arası sınıflandırma

```python
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

tok = AutoTokenizer.from_pretrained("joeddav/xlm-roberta-large-xnli")
model = AutoModelForSequenceClassification.from_pretrained("joeddav/xlm-roberta-large-xnli")


def classify(text, candidate_labels, hypothesis_template="This text is about {}."):
    scores = {}
    for label in candidate_labels:
        hypothesis = hypothesis_template.format(label)
        inputs = tok(text, hypothesis, return_tensors="pt", truncation=True)
        with torch.no_grad():
            logits = model(**inputs).logits[0]
        entail_score = torch.softmax(logits, dim=-1)[2].item()
        scores[label] = entail_score
    return dict(sorted(scores.items(), key=lambda x: -x[1]))


print(classify("I love this product!", ["positive", "negative", "neutral"]))
print(classify("मुझे यह उत्पाद पसंद है!", ["positive", "negative", "neutral"]))
print(classify("J'adore ce produit !", ["positive", "negative", "neutral"]))
```

Bir model, üç dil, aynı API. NLI'de eğitimli XLM-R verileri entailment hilesi ile sınıflandırmaya iyi aktarır.

### Adım 2: Çok Dilli Eklentime Alanı

```python
from sentence_transformers import SentenceTransformer
import numpy as np

model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")

pairs = [
    ("The cat is sleeping.", "Le chat dort."),
    ("The cat is sleeping.", "El gato está durmiendo."),
    ("The cat is sleeping.", "Die Katze schläft."),
    ("The cat is sleeping.", "The dog is barking."),
]

for eng, other in pairs:
    emb_eng = model.encode([eng], normalize_embeddings=True)[0]
    emb_other = model.encode([other], normalize_embeddings=True)[0]
    sim = float(np.dot(emb_eng, emb_other))
    print(f"  {eng!r} <-> {other!r}: cos={sim:.3f}")
```

Çevirmeler yerleşim alanında yakındır. Farklı bir İngilizce cümlesi daha da ilerler. Bu, diller arası arama, gruplama ve benzerlik işlevini yapar.

### Adım 3: Birkaç atışlı ince ayarlama stratejisi

```python
from transformers import TrainingArguments, Trainer
from datasets import Dataset


def few_shot_finetune(base_model, base_tokenizer, examples):
    ds = Dataset.from_list(examples)

    def tokenize_fn(ex):
        out = base_tokenizer(ex["text"], truncation=True, max_length=128)
        out["labels"] = ex["label"]
        return out

    ds = ds.map(tokenize_fn)
    args = TrainingArguments(
        output_dir="out",
        per_device_train_batch_size=8,
        num_train_epochs=5,
        learning_rate=2e-5,
        save_strategy="no",
    )
    trainer = Trainer(model=base_model, args=args, train_dataset=ds)
    trainer.train()
    return base_model
```

100-500 hedef dil örneği için, `num_train_epochs=5`ve `learning_rate=2e-5`Yüksek öğrenme oranları, çok dilli uyumluğun çökmesine neden olur ve sadece İngilizce bir model elde edilir.

## Gerçekten işe yarayan değerlendirme

- **Per-language accuracy on held-out sets.**Toplantı uzun kuyruğu saklıyor.
- **Benchmark against monolingual baseline.**Yeterince veri olan diller için, sıfırdan eğitilen tek dilli bir model bazen çok dilli olanı yener.
- **Entity-level tests.**Çok dilli modeller genellikle Latin'den uzak metinler için zayıf bir işaretlemeye sahiptir.
- **Cross-lingual consistency.**İki dilde aynı anlam aynı tahmin oluşturmalı.

## Kullan

2026'da:

| Task | Recommended |
|-----|-------------|
| Classification, 100 languages | XLM-R-base (~270M) fine-tuned |
| Zero-shot text classification | `joeddav/xlm-roberta-large-xnli` |
| Multilingual sentence embeddings | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` |
| Translation, 200 languages | `facebook/nllb-200-distilled-600M` (see lesson 11) |
| Generative multilingual | Claude, GPT-4, Aya-23, mT5-XXL |
| Low-resource language NLP | XLM-V or a domain-specific fine-tune on related high-resource language |

Eğer performans önemli ise hedef dilde ince ayarlamalar için her zaman bütçe yapın.

### Tokenizasyon vergisi (az kaynaklı diller için ne yanlış gider)

Çok dilli modeller tüm dillerinde tek bir işaretlemeci paylaşırlar. Bu kelime birikimi İngilizce, Fransızca, İspanyolca, Çinli, Almanca tarafından baskın bir corpus üzerinde eğitilir.

- **Fertility tax.**Düşük kaynaklı dil metni İngilizce'den çok daha fazla kelime için işaretleme yapar. Bir Hint cümlesi, eşdeğer bir İngilizce cümlesinin 3-5 katına kadar işaretlere ihtiyaç duyabilir. Bu 3-5 kat bağlam pencerenizi, eğitim verimliliğini ve gecikmeyi tüketir.
- **Variant recovery tax.**Her yazı tipi hatası, diyakritik varyansı, Unicode normallaşımının eşleşmemesi veya durum değişimi yerleşim alanında soğuk başlangıçla ilişkisiz bir dizige dönüşür.
- **Capacity spillover tax.**Vergi 1 ve 2 bağlam pozisyonlarını, katman derinliğini ve yerleştirme boyutlarını tüketir. Gerçek mantık için kalan sistematik olarak aynı modelden yüksek kaynaklı bir dilin aldığından daha küçüktür.

Pratik semptom: modeliniz normalde Hintçe eğitim alır, kayıp eğri doğru görünür, değerleme karmaşıklığı makul görünür ve üretim sonuçları ince yanlışdır. Morfoloji cümle ortasında çökür. Nadir eğrilikler geri kazanılamaz kalır. **You cannot data-scale your way out of a broken tokenizer.**

Yumuşaklıklar: hedef dili için iyi bir kapsamlılık olan bir tokenizer seçin (XLM-V'nin 1M-token kelime birikimi doğrudan bir düzeltme); eğitimden önce tutulan hedef metin üzerinde tokenleştirme verimliliğini kontrol edin; bayt seviyesindeki geri dönüşü kullanın (SentencePiece `byte_fallback=True`, GPT-2-style byte-level BPE) için gerçekten uzun kuyruklu senaryolar için hiçbir şey asla OOV değildir.

## Gönder

- Kaydet .`outputs/skill-multilingual-picker.md`- ...

```markdown
---
name: multilingual-picker
description: Pick source language, target model, and evaluation plan for a multilingual NLP task.
version: 1.0.0
phase: 5
lesson: 18
tags: [nlp, multilingual, cross-lingual]
---

Given requirements (target languages, task type, available labeled data per language), output:

1. Source language for fine-tuning. Default English; check LANGRANK or qWALS if target language has a typologically close high-resource language.
2. Base model. XLM-R (classification), mT5 (generation), NLLB (translation), Aya-23 (generative LLM).
3. Few-shot budget. Start with 100-500 target-language examples if available. Zero-shot only if labeling is infeasible.
4. Evaluation plan. Per-language accuracy (not aggregate), cross-lingual consistency, entity-level F1 on non-Latin scripts.

Refuse to ship a multilingual model without per-language evaluation — aggregate metrics hide long-tail failures. Flag scripts with low tokenization coverage (Amharic, Tigrinya, many African languages) as needing a model with byte-fallback (SentencePiece with byte_fallback=True, or byte-level tokenizer like GPT-2).
```

## Egzersizler

1. **Easy.**İngilizce, Fransızca, Hintçe ve Arapça dillerinde her dilde 10 cümle üzerinde sıfır atış sınıflandırma borusunu çalıştırın. Her birinde doğruluk raporlayın. Güçlü Fransızca, onurlu Hintçe, değişken Arapça görmeniz gerekir.
2. **Medium.**Kullanım`paraphrase-multilingual-MiniLM-L12-v2`İngilizce sorgulama, herhangi bir dilde belgeler almak.
3. **Hard.**Bir Hint sınıflandırma görevi için İngilizce kaynak ve Hintçe kaynak ince ayarlamaları karşılaştırın. Her iki rejimde birkaç atış ince ayarlama için 500 hedef dil örneğini kullanın. Hangi kaynak daha iyi Hintçe doğruluğu ürettiğini ve ne kadar rapor edin.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Multilingual model | One model, many languages | Shared vocabulary and parameters across languages. |
| Cross-lingual transfer | Train on one language, run on another | Fine-tune on source, evaluate on target without target-language labels. |
| Zero-shot | No target-language labels | Transfer without fine-tuning on the target language. |
| Few-shot | Small target labels | 100-500 target-language examples used for fine-tuning. |
| mBERT | First multilingual LM | 104-language BERT pretrained on Wikipedia. |
| XLM-R | Standard cross-lingual baseline | 100-language RoBERTa pretrained on CommonCrawl. |
| NLLB | Meta's 200-language MT | No Language Left Behind. Includes 55 low-resource languages. |

## Daha Fazla Okumak

- [Conneau et al. (2019). Unsupervised Cross-lingual Representation Learning at Scale](https://arxiv.org/abs/1911.02116)- XLM-R kağıdı.
- [Pires, Schlinger, Garrette (2019). How Multilingual is Multilingual BERT?](https://arxiv.org/abs/1906.01502) diller arası transfer araştırma hattına başlayan analiz makalesi.
- [Costa-jussà et al. (2022). No Language Left Behind](https://arxiv.org/abs/2207.04672) NLLB-200 makalesi.
- [Üstün et al. (2024). Aya Model: An Instruction Finetuned Open-Access Multilingual Language Model](https://arxiv.org/abs/2402.07827)Aya, Cohere'nin çok dilli LLM.
- [Language Similarity Predicts Cross-Lingual Transfer Learning Performance (2026)](https://www.mdpi.com/2504-4990/8/3/65) QWALS / LANGRANK kaynak dili kağıdı.
