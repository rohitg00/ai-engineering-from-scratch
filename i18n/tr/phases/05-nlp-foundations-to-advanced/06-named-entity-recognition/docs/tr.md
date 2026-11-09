# Adlı Entite Tanınması

> Açıklama sınırları, yuvalar ve domen jargonları ile uğraşana kadar kolay geliyor.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 03 (Word Embeddings)
**Time:** ~75 minutes

## Sorun

"Apple, Google'ı ABD'deki iPhone arama anlaşması için dava etti". Beş kurum: Apple (ORG), Google (ORG), iPhone (PRODUCT), arama anlaşması (belki), US (GPE). İyi bir NER sistemi hepsini doğru türlerle çıkarır. Kötü bir iPhone'u kaçırır, Apple meyvesini Apple ile karıştırır ve "US" ı PERSON olarak etiketler.

NER, her yapılandırılmış çıkarma borusunun altındaki iş atıdır. Tekrarlama analizleri, uyumluluk günlükleri tarama, tıbbi kayıtların anonimleştirilmesi, arama sorgularını anlama, chatbot cevapları için yerleştirme, yasal sözleşme çıkarma. Bunu asla göremezsiniz; her zaman buna bağlısınız.

Bu ders klasik yolu (kurallara dayalı, HMM, CRF) modern yolu (BiLSTM-CRF, sonra dönüştürücüler) ile yürür.

## Anlaşım

**BIO tagging**(veya BILOU) birim çıkarımı bir dizi etiketleme sorunu haline getirir.`B-TYPE`(üçleme başlangıcı), `I-TYPE`(dışer bir kuruluş), veya `O`(herhangi bir kurum dışında).

```
Apple    B-ORG
sued     O
Google   B-ORG
over     O
its      O
iPhone   B-PRODUCT
search   O
deal     O
in       O
the      O
US       B-GPE
.        O
```

Çoklu tokenli kuruluşlar zinciri: `New B-GPE`- Evet .`York I-GPE`- Evet .`City I-GPE`Biyo'yu anlayan bir model keyfi alanları çıkarır.

Mimarlık ilerleme:

- **Rule-based.**Regex + gazeter aramaları, bilinen kurumlarda yüksek hassasiyet, yeni kurumlarda sıfır kapsam.
- **HMM.**Gizli Markov modeli, verilen token etiketinin emisyon olasılığı, etiket-etikete geçiş olasılığı, Viterbi dekodlaması, etiketlenmiş veriler üzerinde eğitilmiş.
- **CRF.**Şartlı Random Alan. HMM gibi ama ayrımcı, böylece keyfi özellikleri (söz şekli, başlık, komşu kelimeler) karıştırmak için.
- **BiLSTM-CRF.**LSTM cümleyi her iki yönde de okuyor, üstteki CRF katmanı tutarlı etiket dizilerini uyguluyor.
- **Transformer-based.**Token sınıflandırma başlığı ile ince ayarlı BERT. En iyi doğruluk.

```figure
ner-bio-tagging
```

## Yapın

### Adım 1: BIO etiketleme yardımcıları

```python
def spans_to_bio(tokens, spans):
    labels = ["O"] * len(tokens)
    for start, end, label in spans:
        labels[start] = f"B-{label}"
        for i in range(start + 1, end):
            labels[i] = f"I-{label}"
    return labels


def bio_to_spans(tokens, labels):
    spans = []
    current = None
    for i, label in enumerate(labels):
        if label.startswith("B-"):
            if current:
                spans.append(current)
            current = (i, i + 1, label[2:])
        elif label.startswith("I-") and current and current[2] == label[2:]:
            current = (current[0], i + 1, current[2])
        else:
            if current:
                spans.append(current)
                current = None
    if current:
        spans.append(current)
    return spans
```

```python
>>> tokens = ["Apple", "sued", "Google", "over", "iPhone", "sales", "."]
>>> labels = ["B-ORG", "O", "B-ORG", "O", "B-PRODUCT", "O", "O"]
>>> bio_to_spans(tokens, labels)
[(0, 1, 'ORG'), (2, 3, 'ORG'), (4, 5, 'PRODUCT')]
```

### Adım 2: El yapımı özellikler

Klasik (neural olmayan) NER için özellikler oyundur.

```python
def token_features(token, prev_token, next_token):
    return {
        "lower": token.lower(),
        "is_upper": token.isupper(),
        "is_title": token.istitle(),
        "has_digit": any(c.isdigit() for c in token),
        "suffix_3": token[-3:].lower(),
        "shape": word_shape(token),
        "prev_lower": prev_token.lower() if prev_token else "<BOS>",
        "next_lower": next_token.lower() if next_token else "<EOS>",
    }


def word_shape(word):
    out = []
    for c in word:
        if c.isupper():
            out.append("X")
        elif c.islower():
            out.append("x")
        elif c.isdigit():
            out.append("d")
        else:
            out.append(c)
    return "".join(out)
```

`word_shape("iPhone")`Devamı`xXxxxx`- Evet .`word_shape("USA-2024")`Devamı`XXX-dddd`Başlık kalıpları, gerçek isimler için yüksek sinyallidir.

### Adım 3: Basit bir kural tabanlı + sözlük tabanı

```python
ORG_GAZETTEER = {"Apple", "Google", "Microsoft", "OpenAI", "Meta", "Amazon", "Netflix"}
GPE_GAZETTEER = {"US", "USA", "UK", "India", "Germany", "France"}
PRODUCT_GAZETTEER = {"iPhone", "Android", "Windows", "ChatGPT", "Claude"}


def rule_based_ner(tokens):
    labels = []
    for token in tokens:
        if token in ORG_GAZETTEER:
            labels.append("B-ORG")
        elif token in GPE_GAZETTEER:
            labels.append("B-GPE")
        elif token in PRODUCT_GAZETTEER:
            labels.append("B-PRODUCT")
        else:
            labels.append("O")
    return labels
```

Üretim gazetelerinde Wikipedia ve DBpedia'dan milyonlarca giriş çıkartılmıştır.`Apple`Bu yüzden istatistik modeller kazanmış.

### 4. adım: CRF adım (sketch, full implant değil)

50 satırdaki sıfırdan tam CRF, olasılık teorisi temelleri olmadan aydınlatıcı değildir.`sklearn-crfsuite`Bunun yerine:

```python
import sklearn_crfsuite

def to_features(tokens):
    out = []
    for i, tok in enumerate(tokens):
        prev = tokens[i - 1] if i > 0 else ""
        nxt = tokens[i + 1] if i + 1 < len(tokens) else ""
        out.append({
            "word.lower()": tok.lower(),
            "word.isupper()": tok.isupper(),
            "word.istitle()": tok.istitle(),
            "word.isdigit()": tok.isdigit(),
            "word.suffix3": tok[-3:].lower(),
            "word.shape": word_shape(tok),
            "prev.word.lower()": prev.lower(),
            "next.word.lower()": nxt.lower(),
            "BOS": i == 0,
            "EOS": i == len(tokens) - 1,
        })
    return out


crf = sklearn_crfsuite.CRF(algorithm="lbfgs", c1=0.1, c2=0.1, max_iterations=100, all_possible_transitions=True)
X_train = [to_features(s) for s in sentences_tokenized]
crf.fit(X_train, bio_labels_train)
```

`c1`ve `c2`L1 ve L2 düzenlenmesi. `all_possible_transitions=True`modelin yasa dışı diziler öğrenmesine izin verir (örneğin,`I-ORG`Sonra .`O`) olasılığı düşüktür, bu nedenle bir CRF, kısıtlama yazmadan BIO tutarlılığını nasıl zorlar.

### Adım 5: BiLSTM-CRF'nin ne eklediği

Özellikler öğrenilmektedir. Girişler: simge yerleştirmeler (GloVe veya fastText). LSTM soldan sağa ve sağdan sola okuyor. Konkaten gizli durumlar bir CRF çıkış katmanı üzerinden geçer. CRF hala etiket-seyrek tutarlılığını zorlar; LSTM el yapımı özellikleri öğrenilmiş özelliklerle değiştirir.

```python
import torch
import torch.nn as nn


class BiLSTM_CRF_Head(nn.Module):
    def __init__(self, vocab_size, embed_dim, hidden_dim, n_labels):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, embed_dim)
        self.lstm = nn.LSTM(embed_dim, hidden_dim, bidirectional=True, batch_first=True)
        self.fc = nn.Linear(hidden_dim * 2, n_labels)

    def forward(self, token_ids):
        e = self.embed(token_ids)
        h, _ = self.lstm(e)
        emissions = self.fc(h)
        return emissions
```

CRF katmanı için kullan `torchcrf.CRF`El yapımı CRF'den elde edilen kazanç ölçülebilir ama on binlerce etiketli cümle yoksa beklediğinizden daha küçüktür.

## Kullan

spaCy üretim derecesindeki NER'leri kutudan çıkarıyor.

```python
import spacy

nlp = spacy.load("en_core_web_sm")
doc = nlp("Apple sued Google over its iPhone search deal in the US.")
for ent in doc.ents:
    print(f"{ent.text:20s} {ent.label_}")
```

```
Apple                ORG
Google               ORG
iPhone               ORG
US                   GPE
```

Not:`iPhone`etiketlenmiş`ORG`- Hayır .`PRODUCT` spaCy'nin küçük modeli zayıf ürün birimi kapsamına sahiptir.`en_core_web_lg`Transformer modeli (`en_core_web_trf`) daha iyi yapıyor.

BERT tabanlı NER için Kucaklı Yüz:

```python
from transformers import pipeline

ner = pipeline("ner", model="dslim/bert-base-NER", aggregation_strategy="simple")
print(ner("Apple sued Google over its iPhone in the US."))
```

```
[{'entity_group': 'ORG', 'word': 'Apple', ...},
 {'entity_group': 'ORG', 'word': 'Google', ...},
 {'entity_group': 'MISC', 'word': 'iPhone', ...},
 {'entity_group': 'LOC', 'word': 'US', ...}]
```

`aggregation_strategy="simple"`Bu işlem olmadan, simge seviyesindeki etiketler elde eder ve kendinizi birleştirmek zorundasınız.

### LLM tabanlı NER (2026 seçeneği)

Zero-shot ve few-shot LLM NER artık birçok alanda ince ayarlanmış modellerle rekabetçi ve etiketlenmiş veriler kıt olduğunda çarpıcı olarak daha iyi.

- **Zero-shot prompting.**LLM'ye bir varlık türlerinin listesini ve örnek bir şemayı verin. JSON çıkışını isteyin. Kutunun dışına çalışır; doğruluk yeni alanlarda orta derecede.
- **ZeroTuneBio-style prompting.**Görevyi aday çıkarma → anlam açıklama → yargı → tekrar kontrol edin. Çok aşamalı bir istek (tek çekim değil) biyomedikal NER'de doğruluğu önemli ölçüde yükseltir. Aynı model yasal, finansal ve bilimsel alanlarda çalışır.
- **Dynamic prompting with RAG.**Her sonuç çağrısı için küçük bir notlu tohum seti ile en benzer etiketlenen örnekleri alın; birkaç atışlı istekleri uçan bir şekilde oluşturun. 2026 referans değerlerinde, bu, GPT-4 biyomedikal NER F1'i statik isteklere göre %11-12 oranında yükseltir.
- **Per-entity-type decomposition.**Uzun belgelere göre, tüm varlık türlerini bir anda çıkaran tek bir çağrı, uzunluk arttıkça hatırlanmayı kaybeder. Varlık tipi başına bir çıkarma geçitini çalıştırın. Daha yüksek sonuçlama maliyeti, önemli ölçüde daha yüksek doğruluk. Bu klinik notlar ve yasal sözleşmeler için standart bir örnektir.

2026'dan itibaren üretim önerisi: Eğitim verileri toplamanızdan önce LLM sıfır çekim başlangıç çizgisinden başlayın.

### Klasik NER hala kazanırken

LLM'ler mevcut olsa bile, klasik NER:

- Gecikme bütçesi 50 ms'den aşağı.
- Binlerce etiketli örnek var ve %98+ F1 gerekiyor.
- Alanın, önceden eğitilmiş bir CRF veya BiLSTM'nin iyi transfer ettiği istikrarlı bir ontolojisi vardır.
- Yasal kısıtlamalar, yerleşim yerinde, üreticisiz bir model gerektirir.

### - Nerede düşüyor ?

- **Domain shift.**CoNLL'de yasal sözleşmeler konusunda eğitimli olan NER gazeteciden daha kötü bir performans gösteriyor.
- **Nested entities.**"Bank of America Tower" aynı zamanda bir ORG ve bir FASILITY'dir. Standart BIO üst üste dönen uzantıları temsil edemez.
- **Long entities.**"United States Federal Deposit Insurance Corporation". Token seviyesindeki modeller bazen bunu bölüyor.`aggregation_strategy`veya işlemi sonrası.
- **Sparse types.**Tıp NER etiketleri Drug_Brand, ADVERSE_EVENT, DOSE. Genel amaçlı modeller hiçbir fikre sahip değiller. Scispacy ve BioBERT bu noktalar için başlangıç noktasıdır.

## Gönder

- Kaydet .`outputs/skill-ner-picker.md`- ...

```markdown
---
name: ner-picker
description: Pick the right NER approach for a given extraction task.
version: 1.0.0
phase: 5
lesson: 06
tags: [nlp, ner, extraction]
---

Given a task description (domain, label set, language, latency, data volume), output:

1. Approach. Rule-based + gazetteer, CRF, BiLSTM-CRF, or transformer fine-tune.
2. Starting model. Name it (spaCy model ID, Hugging Face checkpoint ID, or "custom, trained from scratch").
3. Labeling strategy. BIO, BILOU, or span-based. Justify in one sentence.
4. Evaluation. Use `seqeval`. Always report entity-level F1 (not token-level).

Refuse to recommend fine-tuning a transformer for under 500 labeled examples unless the user already has a pretrained domain model. Flag nested entities as needing span-based or multi-pass models. Require a gazetteer audit if the user mentions "production scale" and labels are unchanged from CoNLL-2003.
```

## Egzersizler

1. **Easy.**Uygulama`bio_to_spans`(Tüm yönleri `spans_to_bio`) ve 10 cümle ile geri dönüş tutarlılığını kontrol etmektedir.
2. **Medium.**Bu nedenle, bu durumun üstündeki sklearn-crfsuite CRF'yi CoNLL-2003 İngilizce NER veri kümesine göre eğitmek gerekir.`seqeval`Tipik sonuç: ~84 F1.
3. **Hard.**- Güzel sesli .`distilbert-base-cased`Bu, bir alanın özel bir NER veri kümesi (tıp, hukuki veya finansal) üzerinde yapılmıştır.

## Anahtar Terimler

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| NER | Extract names | Label token spans with types (PERSON, ORG, GPE, DATE, ...). |
| BIO | Tagging scheme | `B-X` begins, `I-X` continues, `O` outside. |
| BILOU | Better BIO | Adds `L-X` (last), `U-X` (unit) for cleaner boundaries. |
| CRF | Structured classifier | Models transitions between labels, not just emissions. Enforces valid sequences. |
| Nested NER | Overlapping entities | One span is a different entity than a sub-span of it. BIO cannot express this. |
| Entity-level F1 | Proper NER metric | Predicted span must match true span exactly. Token-level F1 overstates accuracy. |

## Daha Fazla Okumak

- [Lample et al. (2016). Neural Architectures for Named Entity Recognition](https://arxiv.org/abs/1603.01360)BiLSTM-CRF kağıdı.
- [Devlin et al. (2018). BERT: Pre-training of Deep Bidirectional Transformers](https://arxiv.org/abs/1810.04805) standart haline gelen token sınıflandırma modelini tanıttı.
- [spaCy linguistic features — named entities](https://spacy.io/usage/linguistic-features#named-entities)    `Doc.ents`ve `Span`- Evet .
- [seqeval](https://github.com/chakki-works/seqeval) doğru metrik kütüphanesi.
