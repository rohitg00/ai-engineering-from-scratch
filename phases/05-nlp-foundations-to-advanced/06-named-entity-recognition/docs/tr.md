# Adlandırılmış Varlık Tanıma

> İsimleri dışarı çekin. Belirsiz sınırlarla, iç içe geçmiş varlıklarla ve alan jargonuyla uğraşana kadar kulağa kolay geliyor.

**Tür:** Yapım
**Diller:** Python
**Önkoşullar:** Aşama 5 · 02 (BoW + TF-IDF), Aşama 5 · 03 (Word Embeddings)
**Süre:** ~75 dakika

## Sorun

"Apple, ABD'deki iPhone arama anlaşması nedeniyle Google'a dava açtı." Beş varlık: Apple (ORG), Google (ORG), iPhone (ÜRÜN), arama anlaşması (belki), ABD (GPE). İyi bir NER sistemi hepsini doğru türlerle çıkarır. Kötü biri iPhone'u özlüyor, Apple'ı meyveyle Apple'ı şirket olarak karıştırıyor ve "ABD"yi KİŞİ olarak etiketliyor.

NER, her yapısal ekstraksiyon boru hattının altında yatan iş gücüdür. Özgeçmiş ayrıştırma, uyumluluk günlüğü taraması, tıbbi kayıtların anonimleştirilmesi, arama sorgusunun anlaşılması, chatbot yanıtlarının temellendirilmesi, yasal sözleşme çıkarma. Onu asla tam olarak göremezsiniz; her zaman ona bağlısın.

Bu ders klasik yoldan (kural tabanlı, HMM, CRF) modern yola (BiLSTM-CRF, ardından transformer'ler) doğru yürür. Her adım, kendisinden öncekinin belirli bir sınırlamasını çözer. Desen derstir.

## Konsept

**BIO etiketleme** (veya BILOU), varlık çıkarma işlemini bir dizi etiketleme sorununa dönüştürür. Her token'yi `B-TYPE` (varlığın başlangıcı), `I-TYPE` (varlık içi) veya `O` (herhangi bir varlığın dışında) ile etiketleyin.

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

Çoklu token varlık zinciri: `New B-GPE`, `York I-GPE`, `City I-GPE`. BIO'yu anlayan bir model, isteğe bağlı aralıkları çıkarabilir.

Mimari ilerleme:

- **Kural tabanlı.** Regex + gazetteer aramaları. Bilinen varlıklarda yüksek hassasiyet, yenilerinde sıfır kapsam.
- **HMM.** Gizli Markov Modeli. Verilen etiketin token emisyon olasılığı, etiketten etikete geçiş olasılığı. Viterbi'nin şifresi çözüldü. Etiketli veriler üzerine eğitim verildi.
- **CRF.** Koşullu Rastgele Alan. HMM'ye benzer ancak ayırt edicidir, böylece isteğe bağlı özellikleri (kelime şekli, büyük harf kullanımı, komşu kelimeler) karıştırabilirsiniz. Düşük kaynaklı deployment'ler için 2026'da hâlâ klasik üretim gücü.
- **BiLSTM-CRF.** El yapımı yerine sinirsel özellikler. LSTM cümleyi her iki yönde de okur, üstteki CRF katmanı tutarlı etiket dizilerini zorlar.
- **Transformer tabanlı.** token sınıflandırma başlığıyla BERT'e ince ayar yapın. En iyi doğruluk. Çoğu işlem yapar.

```figure
ner-bio-tagging
```

## İnşa Et

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

### Adım 2: el yapımı özellikler

Klasik (nöral olmayan) NER için özellikler oyundur. Yararlı olanlar:

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

`word_shape("iPhone")`, `xXxxxx` değerini döndürür. `word_shape("USA-2024")`, `XXX-dddd`'yi döndürür. Büyük harf kullanım kalıpları özel isimler için yüksek sinyaldir.

### Adım 3: basit bir kural tabanlı + sözlük temeli

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

Üretim gazetleyicilerinde Wikipedia ve DBpedia'dan alınmış milyonlarca giriş var. Kapsama alanı iyi. Belirsizliğin giderilmesi (`Apple` şirkete karşı meyve) berbat. Bu nedenle istatistiksel modeller kazandı.

### Adım 4: CRF adımı (taslak, tam uygulama değil)

50 satırlık sıfırdan tam CRF, olasılık teorisinin temelleri olmadan aydınlatıcı değildir. Bunun yerine `sklearn-crfsuite` kullanın:

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

`c1` ve `c2`, L1 ve L2 düzenlemesidir. `all_possible_transitions=True`, modelin yasadışı dizileri (`O`'den sonra e.g., `I-ORG`) öğrenmesine izin verir; bu, bir CRF'nin siz kısıtlamayı yazmadan BIO tutarlılığını bu şekilde zorlar.

### Adım 5: BiLSTM-CRF'nin kattıkları

Özellikler öğrenilir. Girişler: token embedding'ler (GloVe veya fastText). LSTM soldan sağa ve sağdan sola okur. Birleştirilmiş gizli durumlar bir CRF çıkış katmanından geçer. CRF hâlâ etiket dizisi tutarlılığını zorunlu kılıyor; LSTM, el yapımı özellikleri öğrenilen özelliklerle değiştirir.

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

CRF katmanı için `torchcrf.CRF` (pip install pytorch-crf) kullanın. El yapımı CRF'ye göre kazanç ölçülebilir ancak on binlerce etiketli cümleniz olmadığı sürece beklediğinizden daha küçüktür.

## Kullan onu

spaCy, üretim sınıfı NER'i kutudan çıkar çıkmaz gönderir.

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

`PRODUCT` yerine `iPhone` etiketli `ORG`'ye dikkat edin — spaCy'nin küçük modeli zayıf ürün varlığı kapsamına sahiptir. Büyük model (`en_core_web_lg`) daha iyi sonuç verir. transformer modeli (`en_core_web_trf`) daha da iyisini yapıyor.

BERT tabanlı NER için Sarılma Yüzü:

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

`aggregation_strategy="simple"`, bitişik B-X, I-X token'leri bir yayılma alanında birleştirir. Bu olmadan token düzeyinde etiketler alırsınız ve kendinizi birleştirmeniz gerekir.

### Yüksek Lisans tabanlı NER (2026 seçeneği)

Sıfır atımlı ve az atımlı LLM NER artık birçok alanda ince ayarlı modellerle rekabet edebiliyor ve etiketli veriler kıt olduğunda önemli ölçüde daha iyi.

- **Sıfır atış prompting.** LLM'ye varlık türlerinin bir listesini ve örnek bir şema verin. JSON çıktısını isteyin. Kutunun dışında çalışır; yeni alanlarda doğruluk orta düzeydedir.
- **ZeroTuneBio tarzı prompting.** Görevi aday çıkarma → anlam açıklaması → yargılama → yeniden kontrol olarak parçalara ayırın. Çok aşamalı prompt (tek seferlik değil), biyomedikal NER'de doğruluğu önemli ölçüde artırır. Aynı model hukuki, mali ve bilimsel alanlar için de geçerlidir.
- **RAG ile dinamik prompting.** Her inference çağrısı için küçük açıklamalı bir çekirdek kümesinden en benzer etiketli örnekleri alın; Birkaç atışlık prompt'yi anında oluşturun. 2026 benchmark'lerde bu, GPT-4 biyomedikal NER F1'i statik prompting'e göre %11-12 oranında yükseltir.
- **Varlık türüne göre ayrıştırma.** Uzun belgeler için, tüm varlık türlerini aynı anda ayıklayan tek bir çağrı, uzunluk arttıkça hatırlanma özelliğini kaybeder. Varlık türü başına bir çıkarma geçişi çalıştırın. Daha yüksek inference maliyeti, önemli ölçüde daha yüksek doğruluk. Bu, klinik notlar ve yasal sözleşmeler için standart kalıptır.

2026 itibarıyla üretim önerisi: Eğitim verilerini toplamadan önce LLM sıfır atış temel çizgisiyle başlayın. Çoğu zaman F1, ince ayar yapmanıza gerek kalmayacak kadar iyidir.

### Klasik NER'in hâlâ kazandığı yer

LLM'ler mevcut olsa bile klasik NER şu durumlarda kazanır:

- Gecikme bütçesi 50 ms'nin altındadır.
- Binlerce etiketli örneğiniz var ve %98+ F1'e ihtiyacınız var.
- Alan, önceden eğitilmiş bir CRF veya BiLSTM'nin iyi transfer edildiği stabil bir ontolojiye sahiptir.
- Düzenleyici kısıtlamalar şirket içi, üretken olmayan bir model gerektirir.

### Parçalandığı yer

- **Alan değişikliği.** CoNLL tarafından eğitilmiş NER, yasal sözleşmeler konusunda bir gazeteciden daha kötü performans gösteriyor. Alanınızda ince ayar yapın.
- **İç içe geçmiş varlıklar.** "Bank of America Tower" aynı anda bir ORG ve TESİS'tir. Standart BIO, örtüşen aralıkları temsil edemez. Yuvalanmış NER'e (çoklu geçişli veya yayılma tabanlı modeller) ihtiyacınız vardır.
- **Uzun kuruluşlar.** "Amerika Birleşik Devletleri Federal Mevduat Sigorta Kurumu." Token düzeyindeki modeller bazen bunu böler. `aggregation_strategy` veya işlem sonrası kullanın.
- **Seyrek türler.** DRUG_BRAND, ADVERSE_EVENT, DOSE gibi tıbbi NER etiketleri. Genel amaçlı modellerin hiçbir fikri yoktur. Scistacy ve BioBERT buradaki başlangıç ​​noktalarıdır.

## Gönderin

`outputs/skill-ner-picker.md` olarak kaydet:

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

1. **Kolay.** `bio_to_spans`'yi (`spans_to_bio`'nin tersi) uygulayın ve 10 cümlede gidiş-dönüş tutarlılığını doğrulayın.
2. **Medium.** Yukarıdaki sklearn-crfsuite CRF'yi CoNLL-2003 İngilizce NER dataset üzerinde eğitin. `seqeval` kullanarak varlık başına F1'i raporlayın. Tipik sonuç: ~84 F1.
3. **Zor.** Etki alanına özgü bir NER dataset (tıbbi, hukuki veya finansal) üzerinde `distilbert-base-cased`'de ince ayar yapın. spaCy küçük modeliyle karşılaştırın. Veri sızıntısı kontrollerini belgeleyin ve sizi şaşırtan şeyleri yazın.

## Anahtar Terimler

| Dönem | İnsanlar ne diyor | Aslında ne anlama geliyor |
|------|-----------------|-----------------------|
| NER | İsimleri çıkar | token aralıklarını türlerle (KİŞİ, ORG, GPE, DATE, ...) etiketleyin. |
| BİYOGRAFİ | Etiketleme şeması | `B-X` başlıyor, `I-X` devam ediyor, `O` dışarıda. |
| BİLO | Daha iyi Biyografi | Daha temiz sınırlar için `L-X` (sonuncu), `U-X` (birim) ekler. |
| CRF | Yapılandırılmış sınıflandırıcı | Yalnızca emisyonları değil, etiketler arasındaki geçişleri de modeller. Geçerli dizileri zorlar. |
| İç içe NER | Çakışan varlıklar | Bir açıklık onun alt-açıklığından farklı bir varlıktır. BIO bunu ifade edemez. |
| Varlık düzeyinde F1 | Uygun NER metriği | Tahmin edilen yayılmanın gerçek yayılmayla tam olarak eşleşmesi gerekir. Token düzeyindeki F1 doğruluğu abartıyor. |

## Daha Fazla Okuma

- [Lample ve ark. (2016). Adlandırılmış Varlık Tanıma için Sinir Mimarileri](https://arxiv.org/abs/1603.01360) — BiLSTM-CRF makalesi. Kanonik.
- [Devlin ve ark. (2018). BERT: Derin Çift Yönlü Transformer'lerin ön eğitimi](https://arxiv.org/abs/1810.04805) — standart hale gelen token sınıflandırma modelini tanıtır.
- [spaCy dil özellikleri — adlandırılmış varlıklar](https://spacy.io/usage/linguistic-features#named-entities) — `Doc.ents` ve `Span`'deki her öznitelik için pratik referans.
- [seqeval](https://github.com/chakki-works/seqeval) — doğru metrik kitaplığı. Her zaman kullanın.
