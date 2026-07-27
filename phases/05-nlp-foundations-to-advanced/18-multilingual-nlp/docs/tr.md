# Çok dilli NLP

> Tek model, 100'den fazla dil, çoğu için sıfır eğitim verisi. Diller arası aktarım 2020'lerin pratik mucizesidir.

**Tür:** Öğren
**Diller:** Python
**Önkoşullar:** Aşama 5 · 04 (GloVe, FastText, Subword), Aşama 5 · 11 (Makine Çevirisi)
**Süre:** ~45 dakika

## Sorun

İngilizcede milyarlarca etiketli örnek vardır. Urduca'da binlerce var. Maithili'de neredeyse hiç yok. Küresel bir kitleye hizmet veren herhangi bir pratik NLP sistemi, göreve özgü eğitim verilerinin mevcut olmadığı dillerin uzun kuyruğu üzerinde çalışmak zorundadır.

Çok dilli modeller, bir modeli aynı anda birçok dilde eğiterek bu sorunu çözer. Paylaşılan temsil, yüksek kaynaklı dillerde öğrenilen model becerilerinin düşük kaynaklı dillere aktarılmasına olanak tanır. Modele İngilizce duyarlılık analizi üzerinde ince ayar yapın ve Urduca hakkında şaşırtıcı derecede iyi duyarlılık tahminleri üretir. Bu, sıfır atışlı diller arası aktarımdır ve NLP'nin dünyaya nasıl gönderildiğini yeniden şekillendirdi.

Bu ders, ödünleşimleri, kanonik modelleri ve çok dilli çalışmaya yeni başlayan ekipleri şaşırtan tek kararı, yani aktarım için bir kaynak dil seçmeyi adlandırıyor.

## Konsept

![Paylaşılan çok dilli embedding alanı aracılığıyla diller arası aktarım](../assets/multilingual.svg)

**Paylaşılan kelime dağarcığı.** Çok dilli modeller, tüm hedef dillerdeki metinler üzerinde eğitilmiş bir Cümle Parçası veya WordPiece tokenizer kullanır. Kelime dağarcığı paylaşılır: Aynı alt kelime birimi, ilgili dillerde aynı morfemi temsil eder. İngilizce ve İtalyanca'da `anti-` aynı token değerini alır.

**Paylaşılan temsil.** Birçok dilde maskeli dil modelleme konusunda önceden eğitilmiş bir transformer, farklı dillerdeki anlamsal olarak benzer cümlelerin benzer gizli durumlar ürettiğini öğrenir. mBERT, XLM-R ve NLLB'nin tümü bunu sergiliyor. İngilizce'de "kedi" için Embedding'ler, Fransızca'da "sohbet" ve İspanyolca'da "gato"nun yanında kümelenir ve tam cümle embedding'ler de öyle.

**Sıfır atış aktarımı.** Tek bir dilde (genellikle İngilizce) etiketli veriler üzerinde modele ince ayar yapın. inference konumunda, modelin desteklediği herhangi bir dilde çalıştırın. Hedef dil etiketlerine gerek yok. Sonuçlar tipolojik olarak ilişkili diller için güçlü, uzak diller için ise zayıftır.

**Az çekim fine-tuning.** Hedef dilde 100-500 etiketli örnek ekleyin. Doğruluk, sınıflandırma görevlerinde İngilizce temelinin %95-98'ine atlar. Bu, çok dilli NLP'de en uygun maliyetli tek kaldıraçtır.

## Modeller

| Modeli | Yıl | Kapsam | Notlar |
|-------|------|----------|-------|
| mBERT | 2018 | 104 dil | Vikipedi'de eğitim aldı. İlk pratik çok dilli LM. Düşük kaynak konusunda zayıf. |
| XLM-R | 2019 | 100 dil | CommonCrawl (Wikipedia'dan çok daha büyük) konusunda eğitim aldı. Diller arası taban çizgisini ayarlar. Taban 270M, Büyük 550M. |
| XLM-V | 2023 | 100 dil | 1M-token kelime dağarcığına sahip XLM-R (250k'ye karşı). Düşük kaynakta daha iyi. |
| mT5 | 2020 | 101 dil | Çok dilli nesil için T5 mimarisi. |
| NLLB-200 | 2022 | 200 dil | Meta'nın çeviri modeli; 55 düşük kaynaklı dil içerir. |
| ÇİÇEK | 2022 | 46 dil + 13 programlama | Open 176B LLM çok dilli olarak eğitilmiştir. |
| Aya-23 | 2024 | 23 dil | Cohere'in çok dilli LLM'si. Arapça, Hintçe ve Swahili dilinde güçlü. |

Kullanım durumuna göre seçim yapın. Sınıflandırma, makul varsayılan olarak XLM-R-base ile iyi çalışır. Oluşturma görevleri, çeviriye ve açık oluşturmaya bağlı olarak mT5 veya NLLB'yi gerektirir. LLM tarzı çalışma, açık çok dilli prompting kullanarak Aya-23 veya Claude ile eşleşir.

## Kaynak dil kararı (2026 araştırması)

Çoğu ekip varsayılan olarak fine-tuning kaynağı olarak İngilizce'yi kullanır. Son araştırmalar (2026) bunun çoğunlukla yanlış olduğunu gösteriyor.

Dil benzerliği, aktarım kalitesini ham derlem boyutundan daha iyi tahmin eder. Slav hedefleri için Almanca veya Rusça genellikle İngilizceyi yener. Hintçe hedefler için Hintçe genellikle İngilizceyi yener. **qWALS** benzerlik metriği (2026, Dünya Dil Yapıları Atlası özelliklerine dayanmaktadır) bunu ölçer. **LANGRANK** (Lin ve diğerleri, ACL 2019), aday kaynak dilleri dilsel benzerlik, derlem boyutu ve genetik akrabalık kombinasyonuna göre sıralayan ayrı ve daha eski bir yöntemdir.

Pratik kural: Hedef dilinizin tipolojik olarak yakın yüksek kaynak akrabası varsa, önce bunun üzerinde fine-tuning deneyin, ardından İngilizce ince ayarıyla karşılaştırın.

## İnşa Et

### Adım 1: Sıfır atışlı diller arası sınıflandırma

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

Bir model, üç dil, aynı API. NLI veri aktarımı konusunda eğitilmiş XLM-R, gereklilik hilesi yoluyla sınıflandırmaya iyi bir şekilde aktarılır.

### Adım 2: çok dilli embedding alanı

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

Çeviriler embedding uzayına yaklaşıyor. Farklı bir İngilizce cümle daha da ileri gidiyor. Diller arası erişimin, kümelemenin ve benzerliğin işe yaramasını sağlayan şey budur.

### 3. Adım: birkaç atışlık fine-tuning stratejisi

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

100-500 hedef dil örneği için `num_train_epochs=5` ve `learning_rate=2e-5` güvenli varsayılanlardır. Daha yüksek öğrenme oranları, çok dilli uyumun çökmesine neden olur ve yalnızca İngilizce bir model elde edersiniz.

## Gerçekten işe yarayan değerlendirme

- **Uzatılan setlerde dil başına doğruluk.** Toplanmamıştır. Agrega uzun kuyruğu gizler.
- **Benchmark tek dilli taban çizgisine karşı.** Yeterli veriye sahip diller için, sıfırdan eğitilmiş tek dilli bir model bazen çok dilli modeli yenebilir. Test.
- **Varlık düzeyinde testler.** Hedef dilde adlandırılmış varlıklar. Çok dilli modeller genellikle Latince'den uzak alfabeler için zayıf tokenizasyona sahiptir.
- **Diller arası tutarlılık.** İki dilde aynı anlam, aynı tahmini üretmelidir. Boşluğu ölçün.

## Kullan onu

2026 yığını:

| Görev | Önerilen |
|-----|-------------|
| Sınıflandırma, 100 dil | XLM-R-tabanı (~270M) ince ayarlı |
| Sıfır noktalı metin sınıflandırması | `joeddav/xlm-roberta-large-xnli` |
| Çok dilli cümle embeddings | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` |
| Çeviri, 200 dil | `facebook/nllb-200-distilled-600M` (bkz. ders 11) |
| Üretken çok dilli | Claude, GPT-4, Aya-23, mT5-XXL |
| Düşük kaynaklı dil NLP | XLM-V veya ilgili yüksek kaynak dil üzerinde alana özel ince ayar |

Performans önemliyse her zaman hedef dilde fine-tuning için bütçe ayırın. Sıfır atış bir başlangıç ​​noktasıdır, nihai bir cevap değil.

### tokenizasyon vergisi (düşük kaynaklı dillerde neyin yanlış gittiği)

Çok dilli modeller tüm dillerde bir tokenizer paylaşır. Bu kelime dağarcığı İngilizce, Fransızca, İspanyolca, Çince ve Almanca'nın hakim olduğu bir külliyat üzerinde eğitilmiştir. Baskın grubun dışındaki herhangi bir dil için üç vergi sessizce birleşir:

- **Doğurganlık vergisi.** Düşük kaynaklı dil metni tokenkelime başına İngilizce'den çok daha fazla token'ye dönüştürülür. Hintçe bir cümle, eşdeğer bir İngilizce cümlenin 3-5 katı tokens'ye ihtiyaç duyabilir. Bu 3-5x, context window'nızı, eğitim verimliliğinizi ve gecikme sürenizi tüketir.
- **Varyant kurtarma vergisi.** Her yazım hatası, aksan varyantı, Unicode normalleştirme uyumsuzluğu veya büyük/küçük harf varyasyonu, embedding alanında soğuk başlangıçla ilgisi olmayan bir dizi haline gelir. Model, anadili İngilizce olan birinin açıkça anladığı yazım yazışmalarını öğrenemez.
- **Kapasite yayılma vergisi.** 1 ve 2 numaralı vergiler bağlam konumlarını, katman derinliğini ve embedding boyutlarını kullanır. Gerçek muhakeme için geriye kalan şey, yüksek kaynaklı bir dilin aynı modelden elde ettiğinden sistematik olarak daha küçüktür.

Pratik semptom: modeliniz normal olarak Hintçe eğitim alıyor, kayıp eğrisi doğru görünüyor, değerlendirme karışıklığı makul görünüyor ve üretim çıktıları çok yanlış. Morfoloji cümlenin ortasında çöküyor. Nadir çekimler kurtarılamaz durumda kalır. **Bozuk bir tokenizer'dan veri ölçeklendirmesi yapamazsınız.**

Azaltıcı önlemler: Hedef diliniz için iyi kapsama sahip bir tokenizer seçin (XLM-V'nin 1M-token kelime dağarcığı doğrudan bir çözümdür); eğitimden önce uzatılan hedef metinde tokenizasyon verimliliğini doğrulayın; Gerçekten uzun kuyruklu komut dosyaları için bayt düzeyinde geri dönüş (SentencePiece `byte_fallback=True`, GPT-2 tarzı bayt düzeyinde BPE) kullanın, böylece hiçbir şey asla OOV olmaz.

## Gönderin

`outputs/skill-multilingual-picker.md` olarak kaydet:

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

1. **Kolay.** İngilizce, Fransızca, Hintçe ve Arapça'da dil başına 10 cümle üzerinden sıfır adımlı sınıflandırma hattını çalıştırın. Her birinin doğruluğunu bildirin. Güçlü Fransızca, düzgün Hintçe, değişken Arapça görmelisiniz.
2. **Orta.** Küçük, karışık dilli bir külliyat üzerinde diller arası bir avlayıcı oluşturmak için `paraphrase-multilingual-MiniLM-L12-v2` kullanın. İngilizce sorgulayın, belgeleri istediğiniz dilde alın. Geri çağırma@5'i ölçün.
3. **Zor.** Hintçe sınıflandırma görevi için İngilizce kaynak ile Hintçe kaynağı fine-tuning karşılaştırın. Her iki rejimde de az sayıda fine-tuning için 500 hedef dil örneği kullanın. Hangi kaynağın Hintçe doğruluğunu ne kadar daha iyi sağladığını bildirin. Bu LANGRANK'ın minyatür tezidir.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|-----------------------|
| Çok dilli model | Tek model, birçok dil | Diller arasında paylaşılan kelime dağarcığı ve parametreler. |
| Diller arası transfer | Bir dilde antrenman yapın, diğerinde koşun | Kaynakta ince ayar yapın, hedef dil etiketleri olmadan hedefe göre değerlendirme yapın. |
| Sıfır atış | Hedef dil etiketi yok | Hedef dilde fine-tuning olmadan aktarın. |
| Birkaç atış | Küçük hedef etiketleri | fine-tuning için kullanılan 100-500 hedef dil örneği. |
| mBERT | İlk çok dilli LM | 104 dilli BERT, Wikipedia'da önceden eğitilmiştir. |
| XLM-R | Standart diller arası temel | 100 dilli RoBERTa, CommonCrawl'da önceden eğitilmiştir. |
| NLLB | Meta'nın 200 dilli MT'si | Geride Dil Kalmadı. 55 düşük kaynaklı dil içerir. |

## Daha Fazla Okuma

- [Conneau ve diğerleri. (2019). Geniş Ölçekte Denetimsiz Diller Arası Temsil Öğrenimi](https://arxiv.org/abs/1911.02116) — XLM-R makalesi.
- [Pires, Schlinger, Garrette (2019). Çok Dilli BERT Ne Kadar Çok Dillidir?](https://arxiv.org/abs/1906.01502) — diller arası transfer araştırma hattını başlatan analiz makalesi.
- [Costa-jussà ve ark. (2022). Geride Dil Kalmadı](https://arxiv.org/abs/2207.04672) — NLLB-200 makalesi.
- [Üstün ve ark. (2024). Aya Modeli: İnce Ayarlı Açık Erişimli Çok Dilli Dil Modeli](https://arxiv.org/abs/2402.07827) — Aya, Cohere'in çok dilli Yüksek Lisansı.
- [Dil Benzerliği Diller Arası Transfer Öğrenme Performansını Tahmin Ediyor (2026)](https://www.mdpi.com/2504-4990/8/3/65) — qWALS / LANGRANK kaynak dil makalesi.
